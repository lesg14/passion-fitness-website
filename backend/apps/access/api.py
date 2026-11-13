from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.members.models import Member
from apps.members.validators import validate_document_number

from .models import Asistencia, RegistroAcceso
from .services import DOOR_GROUP, registrar_ingreso

MAX_FALLOS = 5
BLOQUEO_SEGUNDOS = 60


def es_cuenta_puerta(user):
    return bool(
        user and user.is_authenticated and user.is_active
        and user.groups.filter(name=DOOR_GROUP).exists()
    )


class IsDoorDevice(BasePermission):
    def has_permission(self, request, view):
        return es_cuenta_puerta(request.user) or bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )


class IsReceptionOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active
            and (user.is_superuser or (user.is_staff and not es_cuenta_puerta(user)))
        )


class CheckInSerializer(serializers.Serializer):
    numero_documento = serializers.CharField(max_length=20, trim_whitespace=False)

    def validate_numero_documento(self, value):
        validate_document_number(value)
        return value


class CheckInView(APIView):
    permission_classes = [IsDoorDevice]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "door"

    def post(self, request):
        lock_key = f"door-fails-{request.user.pk}"
        if cache.get(lock_key, 0) >= MAX_FALLOS:
            return Response(
                {"detail": "Demasiados intentos con documentos no registrados. Acércate a recepción."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = registrar_ingreso(
            serializer.validated_data["numero_documento"], dispositivo=request.user.get_username()
        )
        if result["motivo"] == RegistroAcceso.Motivo.NO_ENCONTRADO:
            cache.add(lock_key, 0, BLOQUEO_SEGUNDOS)
            try:
                cache.incr(lock_key)
            except ValueError:
                cache.set(lock_key, 1, BLOQUEO_SEGUNDOS)
        else:
            cache.delete(lock_key)
        return Response({
            "permitido": result["permitido"],
            "nivel": result["nivel"],
            "mensaje": result["mensaje"],
            "nombre": result.get("nombre", ""),
            "dias_restantes": result["dias_restantes"],
            "puerta": result["puerta"],
        })


class ManualCheckInSerializer(serializers.Serializer):
    member_id = serializers.PrimaryKeyRelatedField(source="member", queryset=Member.objects.all())

    def get_fields(self):
        fields = super().get_fields()
        if not self.context["request"].user.is_superuser:
            fields["member_id"].queryset = Member.objects.filter(archivado=False)
        return fields


class ManualCheckInView(APIView):
    permission_classes = [IsReceptionOrAdmin]

    def post(self, request):
        serializer = ManualCheckInSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data["member"]
        result = registrar_ingreso(member.numero_documento, origen=Asistencia.Origen.MANUAL, usuario=request.user)
        return Response({
            "permitido": result["permitido"],
            "mensaje": result["mensaje"],
            "dias_restantes": result["dias_restantes"],
            "asistencia_creada": result["asistencia_creada"],
        })


class AccessDateSerializer(serializers.Serializer):
    fecha = serializers.DateField(required=False)


class TodayAccessView(APIView):
    """Entradas y denegaciones por fecha local para recepción."""

    permission_classes = [IsReceptionOrAdmin]

    def get(self, request):
        serializer = AccessDateSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        fecha = serializer.validated_data.get("fecha", timezone.localdate())
        registros = RegistroAcceso.objects.filter(fecha_hora__date=fecha).select_related("member")
        if not request.user.is_superuser:
            registros = registros.filter(Q(member__isnull=True) | Q(member__archivado=False))
        return Response([
            {
                "id": registro.id,
                "hora": timezone.localtime(registro.fecha_hora).strftime("%H:%M"),
                "nombre": str(registro.member) if registro.member else "Documento no registrado",
                "resultado": registro.resultado,
                "motivo": registro.get_motivo_display() if registro.motivo else "",
                "dias_restantes": registro.dias_restantes,
                "documento": registro.member.numero_documento if registro.member else registro.numero_documento_digitado,
                "origen": registro.origen,
                "registrado_por": registro.usuario_registro,
                "dispositivo": registro.dispositivo,
            }
            for registro in registros
        ])
