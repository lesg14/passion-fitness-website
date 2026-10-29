from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.db.models import Prefetch, Q
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Membership, Payment, registrar_pago
from apps.dashboard.views import calcular_estadisticas
from apps.members.models import Member
from apps.plans.models import Plan


class IsAdminRole(BasePermission):
    message = 'Se requieren permisos de Administrador para realizar esta acción.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'csrfToken': get_token(request)})


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        requested_role = request.data.get('role')

        User = get_user_model()
        auth_username = username
        if '@' in username:
            user_match = User.objects.filter(email__iexact=username).first()
            if user_match:
                auth_username = user_match.get_username()
        else:
            user_match = User.objects.filter(username__iexact=username).first()
            if user_match:
                auth_username = user_match.get_username()

        user = authenticate(request, username=auth_username, password=password)
        if user is None or not user.is_active or not (user.is_staff or user.is_superuser):
            return Response(
                {'detail': 'Usuario o contraseña incorrectos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if requested_role == 'admin' and not user.is_superuser:
            return Response(
                {'detail': 'Esta cuenta no tiene permisos de Administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        login(request, user)
        new_csrf = get_token(request)
        return Response({
            'username': user.get_username(),
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'role': 'admin' if user.is_superuser else 'staff',
            'csrfToken': new_csrf,
        })


class SessionView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Inicia sesión.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Se requiere una cuenta de staff o administrador.'}, status=status.HTTP_403_FORBIDDEN)
        return Response({
            'username': request.user.get_username(),
            'is_staff': request.user.is_staff,
            'is_superuser': request.user.is_superuser,
            'role': 'admin' if request.user.is_superuser else 'staff',
            'csrfToken': get_token(request),
        })


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    def get(self, request):
        stats = calcular_estadisticas()
        try:
            months = min(max(int(request.query_params.get('months', 6)), 1), 12)
        except ValueError:
            raise serializers.ValidationError({'months': 'Usa un número entre 1 y 12.'})
        revenue = list(zip(stats['ingresos_labels'], stats['ingresos_data']))[-months:]
        plans = list(zip(stats['planes_labels'], stats['planes_data']))
        return Response({
            'metrics': {
                'miembros': stats['total'],
                'activos': stats['activos'],
                'proximos': stats.get('proximos', 0),
                'vencidos': stats['vencidos'],
                'por_vencer': stats['por_vencer'],
                'ingresos_mes': stats['ingresos_mes'],
            },
            'revenue': [{'month': month, 'revenue': total} for month, total in revenue],
            'plans': [{'name': name, 'memberships': count} for name, count in plans],
        })


class PlanSerializer(serializers.ModelSerializer):
    total_memberships = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = ('id', 'nombre', 'precio_cop', 'duracion_dias', 'activo', 'total_memberships')

    def get_total_memberships(self, obj):
        return obj.memberships.count()


class PlanListCreateView(generics.ListCreateAPIView):
    serializer_class = PlanSerializer

    def get_queryset(self):
        if self.request.user.is_superuser or self.request.query_params.get('all') == 'true':
            return Plan.objects.all().order_by('duracion_dias', 'nombre')
        return Plan.objects.filter(activo=True).order_by('duracion_dias', 'nombre')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminRole()]
        return super().get_permissions()


class PlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PlanSerializer
    queryset = Plan.objects.all()

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        if instance.memberships.exists():
            instance.activo = False
            instance.save(update_fields=['activo'])
        else:
            instance.delete()


class MemberSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    plan_id = serializers.SerializerMethodField()
    fecha_fin = serializers.SerializerMethodField()
    fecha_inicio = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    iniciales = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            'id',
            'nombre',
            'nombres',
            'apellidos',
            'tipo_documento',
            'numero_documento',
            'telefono',
            'email',
            'plan',
            'plan_id',
            'fecha_fin',
            'fecha_inicio',
            'estado',
            'iniciales',
            'archivado',
        )

    def to_representation(self, instance):
        if not hasattr(instance, 'api_memberships'):
            instance.api_memberships = list(
                instance.memberships.select_related('plan').order_by('-fecha_fin')
            )
        return super().to_representation(instance)

    def get_nombre(self, obj):
        return str(obj)

    def _memberships(self, obj):
        return obj.api_memberships

    def _vigente(self, obj):
        today = timezone.localdate()
        return next(
            (item for item in self._memberships(obj) if item.fecha_inicio <= today <= item.fecha_fin),
            None,
        )

    def _latest(self, obj):
        memberships = self._memberships(obj)
        return memberships[0] if memberships else None

    def get_plan(self, obj):
        membership = self._latest(obj)
        return membership.plan.nombre if membership else ''

    def get_plan_id(self, obj):
        membership = self._latest(obj)
        return membership.plan_id if membership else None

    def get_fecha_inicio(self, obj):
        membership = self._latest(obj)
        return membership.fecha_inicio.isoformat() if membership else None

    def get_fecha_fin(self, obj):
        membership = self._latest(obj)
        return membership.fecha_fin.isoformat() if membership else None

    def get_estado(self, obj):
        if obj.archivado:
            return 'Archivado'
        today = timezone.localdate()
        memberships = self._memberships(obj)
        if not memberships:
            return 'Sin membresía'
        latest = memberships[0]
        if latest.fecha_fin < today:
            return 'Vencido'
        vigente = self._vigente(obj)
        if not vigente and latest.fecha_inicio > today:
            return 'Próxima'
        dias = (latest.fecha_fin - today).days
        if dias == 0:
            return 'Vence hoy'
        elif dias == 1:
            return 'Vence mañana'
        elif dias == 2:
            return 'Vence en 2 días'
        elif dias == 3:
            return 'Vence en 3 días'
        return 'Activo'

    def get_iniciales(self, obj):
        return ''.join(part[0] for part in (obj.nombres, obj.apellidos) if part).upper()[:2]


class MemberRegistrationSerializer(serializers.Serializer):
    nombres = serializers.CharField(max_length=100)
    apellidos = serializers.CharField(max_length=100)
    tipo_documento = serializers.ChoiceField(choices=Member.TipoDocumento.choices)
    numero_documento = serializers.CharField(max_length=20)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    fecha_inicio = serializers.DateField(required=False, allow_null=True)
    acepta_datos = serializers.BooleanField(write_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(source='plan', queryset=Plan.objects.filter(activo=True))
    metodo = serializers.ChoiceField(choices=Payment.Metodo.choices)

    def validate_acepta_datos(self, value):
        if not value:
            raise serializers.ValidationError('Se requiere autorización para el tratamiento de datos.')
        return value

    def validate(self, attrs):
        duplicate = Member.objects.filter(
            tipo_documento=attrs['tipo_documento'],
            numero_documento=attrs['numero_documento'],
        ).exists()
        if duplicate:
            raise serializers.ValidationError({'numero_documento': 'Ya existe un miembro con este documento.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        plan = validated_data.pop('plan')
        metodo = validated_data.pop('metodo')
        fecha_inicio = validated_data.pop('fecha_inicio', None)
        validated_data.pop('acepta_datos')
        member = Member.objects.create(acepta_datos_en=timezone.now(), **validated_data)
        registrar_pago(
            member,
            plan,
            metodo,
            usuario=self.context['request'].user,
            fecha_inicio=fecha_inicio,
        )
        return member


class MemberUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ('id', 'nombres', 'apellidos', 'tipo_documento', 'numero_documento', 'telefono', 'email', 'archivado')

    def validate(self, attrs):
        tipo = attrs.get('tipo_documento', self.instance.tipo_documento if self.instance else None)
        num = attrs.get('numero_documento', self.instance.numero_documento if self.instance else None)
        if tipo and num:
            qs = Member.objects.filter(tipo_documento=tipo, numero_documento=num)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'numero_documento': 'Ya existe otro miembro con este documento.'})
        return attrs


class MemberListCreateView(generics.ListCreateAPIView):
    serializer_class = MemberSerializer

    def get_queryset(self):
        memberships = Membership.objects.select_related('plan').order_by('-fecha_fin')
        queryset = Member.objects.prefetch_related(
            Prefetch('memberships', queryset=memberships, to_attr='api_memberships')
        ).order_by('apellidos', 'nombres')
        include_archived = (
            self.request.user.is_superuser
            and self.request.query_params.get('include_archived') == 'true'
        )
        if not include_archived:
            queryset = queryset.filter(archivado=False)
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(nombres__icontains=search)
                | Q(apellidos__icontains=search)
                | Q(email__icontains=search)
                | Q(numero_documento__icontains=search)
            )
        return queryset

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MemberRegistrationSerializer
        return MemberSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        return Response(MemberSerializer(member).data, status=status.HTTP_201_CREATED)


class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Member.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_superuser:
            queryset = queryset.filter(archivado=False)
        return queryset

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return MemberUpdateSerializer
        return MemberSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE' or (
            self.request.method in ('PUT', 'PATCH') and 'archivado' in self.request.data
        ):
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        instance.archivado = True
        instance.save(update_fields=['archivado'])


class PaymentCreateSerializer(serializers.Serializer):
    member_id = serializers.PrimaryKeyRelatedField(source='member', queryset=Member.objects.all())
    plan_id = serializers.PrimaryKeyRelatedField(source='plan', queryset=Plan.objects.filter(activo=True))
    metodo = serializers.ChoiceField(choices=Payment.Metodo.choices)
    monto_cop = serializers.IntegerField(min_value=1, required=False)
    referencia = serializers.CharField(max_length=100, required=False, allow_blank=True)
    fecha_inicio = serializers.DateField(required=False, allow_null=True)

    def create(self, validated_data):
        return registrar_pago(
            validated_data['member'],
            validated_data['plan'],
            validated_data['metodo'],
            monto_cop=validated_data.get('monto_cop'),
            referencia=validated_data.get('referencia', ''),
            usuario=self.context['request'].user,
            fecha_inicio=validated_data.get('fecha_inicio'),
        )


class PaymentSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(source='member.id', read_only=True)
    member_nombre = serializers.SerializerMethodField()
    member_tipo_documento = serializers.CharField(source='member.tipo_documento', read_only=True)
    member_numero_documento = serializers.CharField(source='member.numero_documento', read_only=True)
    member_telefono = serializers.CharField(source='member.telefono', read_only=True)
    member_email = serializers.CharField(source='member.email', read_only=True)
    plan_nombre = serializers.CharField(source='membership.plan.nombre', read_only=True)
    fecha_inicio = serializers.DateField(source='membership.fecha_inicio', read_only=True)
    fecha_fin = serializers.DateField(source='membership.fecha_fin', read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()
    metodo_display = serializers.CharField(source='get_metodo_display', read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id',
            'member_id',
            'member_nombre',
            'member_tipo_documento',
            'member_numero_documento',
            'member_telefono',
            'member_email',
            'plan_nombre',
            'fecha_inicio',
            'fecha_fin',
            'monto_cop',
            'metodo',
            'metodo_display',
            'fecha',
            'referencia',
            'anulado',
            'registrado_por_nombre',
        )

    def get_member_nombre(self, obj):
        return f"{obj.member.nombres} {obj.member.apellidos}"

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.get_username() if obj.registrado_por else 'Sistema'


class PaymentListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PaymentCreateSerializer
        return PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('member', 'membership__plan', 'registrado_por').order_by('-fecha', '-id')
        member_id = self.request.query_params.get('member_id')
        if member_id:
            qs = qs.filter(member_id=member_id)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(member__nombres__icontains=search)
                | Q(member__apellidos__icontains=search)
                | Q(member__numero_documento__icontains=search)
                | Q(referencia__icontains=search)
                | Q(membership__plan__nombre__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response({
            'id': payment.id,
            'monto_cop': payment.monto_cop,
            'metodo': payment.metodo,
            'fecha': payment.fecha.isoformat(),
            'membresia': {
                'id': payment.membership_id,
                'fecha_inicio': payment.membership.fecha_inicio.isoformat(),
                'fecha_fin': payment.membership.fecha_fin.isoformat(),
            },
        }, status=status.HTTP_201_CREATED)


class PaymentVoidView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'detail': 'Pago no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        payment.anulado = True
        payment.save(update_fields=['anulado'])
        return Response({'id': payment.id, 'anulado': True})
