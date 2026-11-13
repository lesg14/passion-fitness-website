from django.core.cache import cache
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.members.validators import validate_document_number

from .models import RegistroAcceso
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


class TodayAccessView(APIView):
    """Entradas y denegaciones del día para recepción."""

    def get(self, request):
        hoy = timezone.localdate()
        registros = RegistroAcceso.objects.filter(fecha_hora__date=hoy).select_related("member")
        return Response([
            {
                "id": registro.id,
                "hora": timezone.localtime(registro.fecha_hora).strftime("%H:%M"),
                "nombre": str(registro.member) if registro.member else "Documento no registrado",
                "resultado": registro.resultado,
                "motivo": registro.get_motivo_display() if registro.motivo else "",
                "dias_restantes": registro.dias_restantes,
            }
            for registro in registros
        ])
