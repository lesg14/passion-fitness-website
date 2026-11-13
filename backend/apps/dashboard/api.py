from datetime import timedelta
from collections.abc import Mapping
from uuid import uuid4

from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.api import es_cuenta_puerta
from apps.billing.models import Membership, Payment, registrar_pago
from apps.dashboard.views import calcular_estadisticas
from apps.members.models import Member
from apps.members.validators import validate_birth_date, validate_document_number, validate_ten_digits
from apps.plans.models import Plan


class IsAdminRole(BasePermission):
    message = 'Se requieren permisos de Administrador para realizar esta acción.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class ReceptionistSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False, style={'input_type': 'password'})

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'is_active', 'password')
        read_only_fields = ('id',)

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: 'Este campo no se puede modificar.' for field in sorted(unknown)})
        return super().to_internal_value(data)

    def validate_username(self, value):
        if '@' in value:
            raise serializers.ValidationError('El usuario no puede contener @; usa el correo por separado.')
        users = get_user_model().objects.filter(username__iexact=value)
        if self.instance:
            users = users.exclude(pk=self.instance.pk)
        if users.exists():
            raise serializers.ValidationError('Este nombre de usuario ya está en uso.')
        return value

    def validate_email(self, value):
        if value:
            users = get_user_model().objects.filter(email__iexact=value)
            if self.instance:
                users = users.exclude(pk=self.instance.pk)
            if users.exists():
                raise serializers.ValidationError('Este correo ya está en uso.')
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        if not self.instance and not password:
            raise serializers.ValidationError({'password': 'Establece una contraseña para la cuenta.'})
        if password:
            user = get_user_model()(
                username=attrs.get('username', self.instance.username if self.instance else ''),
                first_name=attrs.get('first_name', self.instance.first_name if self.instance else ''),
                last_name=attrs.get('last_name', self.instance.last_name if self.instance else ''),
                email=attrs.get('email', self.instance.email if self.instance else ''),
            )
            try:
                validate_password(password, user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return get_user_model().objects.create_user(password=password, is_staff=True, is_superuser=False, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance


class ReceptionistListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = ReceptionistSerializer

    def get_queryset(self):
        return get_user_model().objects.filter(is_staff=True, is_superuser=False).order_by('username', 'pk')


class ReceptionistDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = ReceptionistSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return get_user_model().objects.filter(is_staff=True, is_superuser=False)


class AdminProfileSerializer(ReceptionistSerializer):
    current_password = serializers.CharField(write_only=True, required=False, trim_whitespace=False, style={'input_type': 'password'})

    class Meta(ReceptionistSerializer.Meta):
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'password', 'current_password')

    def to_internal_value(self, data):
        if isinstance(data, Mapping) and 'id' in data:
            raise serializers.ValidationError({'id': 'Este campo no se puede modificar.'})
        return super().to_internal_value(data)

    def validate_username(self, value):
        return value if value == self.instance.username else super().validate_username(value)

    def validate_email(self, value):
        return value if value == self.instance.email else super().validate_email(value)

    def validate(self, attrs):
        current_password = attrs.pop('current_password', None)
        if 'password' in attrs:
            if not current_password or not self.instance.check_password(current_password):
                raise serializers.ValidationError({'current_password': 'La contraseña actual es incorrecta.'})
        elif current_password is not None:
            raise serializers.ValidationError({'password': 'Indica la nueva contraseña.'})
        return super().validate(attrs)


class AdminProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = AdminProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        password_changed = 'password' in serializer.validated_data
        user = serializer.save()
        if password_changed:
            update_session_auth_hash(self.request, user)


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
        is_door = es_cuenta_puerta(user)
        if user is None or not user.is_active or not (user.is_staff or user.is_superuser or is_door):
            return Response(
                {'detail': 'Usuario o contraseña incorrectos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (requested_role == 'door') != is_door:
            return Response(
                {'detail': 'Esta cuenta no corresponde a este tipo de acceso.'},
                status=status.HTTP_403_FORBIDDEN,
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
            'first_name': user.first_name,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'role': 'door' if is_door else 'admin' if user.is_superuser else 'staff',
            'csrfToken': new_csrf,
        })


class SessionView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Inicia sesión.'}, status=status.HTTP_401_UNAUTHORIZED)
        if es_cuenta_puerta(request.user):
            return Response({
                'username': request.user.get_username(),
                'first_name': request.user.first_name,
                'is_staff': False,
                'is_superuser': False,
                'role': 'door',
                'csrfToken': get_token(request),
            })
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Se requiere una cuenta de staff o administrador.'}, status=status.HTTP_403_FORBIDDEN)
        return Response({
            'username': request.user.get_username(),
            'first_name': request.user.first_name,
            'is_staff': request.user.is_staff,
            'is_superuser': request.user.is_superuser,
            'role': 'admin' if request.user.is_superuser else 'staff',
            'csrfToken': get_token(request),
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

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
        fields = ('id', 'nombre', 'precio_cop', 'duracion_dias', 'activo', 'es_pareja', 'total_memberships')

    def validate_es_pareja(self, value):
        if self.instance and value != self.instance.es_pareja and self.instance.memberships.exists():
            raise serializers.ValidationError('No se puede cambiar el tipo de un plan con membresías registradas.')
        return value

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
            'fecha_nacimiento',
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
                instance.memberships.operativas().select_related('plan').order_by('-fecha_fin')
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


class MemberValidationFieldsMixin:
    def validate_numero_documento(self, value):
        validate_document_number(value)
        return value

    def validate_telefono(self, value):
        if value:
            validate_ten_digits(value)
        return value

    def validate_fecha_nacimiento(self, value):
        if value is not None:
            validate_birth_date(value)
        return value


class MemberRegistrationSerializer(MemberValidationFieldsMixin, serializers.Serializer):
    nombres = serializers.CharField(max_length=100)
    apellidos = serializers.CharField(max_length=100)
    tipo_documento = serializers.ChoiceField(choices=Member.TipoDocumento.choices)
    numero_documento = serializers.CharField(max_length=20, trim_whitespace=False)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    fecha_inicio = serializers.DateField(required=False, allow_null=True)
    acepta_datos = serializers.BooleanField(write_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(source='plan', queryset=Plan.objects.filter(activo=True))
    metodo = serializers.ChoiceField(choices=Payment.Metodo.choices)

    def validate_acepta_datos(self, value):
        if not value:
            raise serializers.ValidationError('Se requiere autorización para el tratamiento de datos.')
        return value

    def validate(self, attrs):
        if attrs['plan'].es_pareja:
            raise serializers.ValidationError({'plan_id': 'Registra los planes de pareja con ambos participantes.'})
        duplicate = Member.objects.filter(numero_documento=attrs['numero_documento']).exists()
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


class MemberUpdateSerializer(MemberValidationFieldsMixin, serializers.ModelSerializer):
    numero_documento = serializers.CharField(max_length=20, trim_whitespace=False)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = Member
        fields = ('id', 'nombres', 'apellidos', 'tipo_documento', 'numero_documento', 'telefono', 'email', 'fecha_nacimiento', 'archivado')

    def validate(self, attrs):
        num = attrs.get('numero_documento', self.instance.numero_documento if self.instance else None)
        if num:
            qs = Member.objects.filter(numero_documento=num)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'numero_documento': 'Ya existe otro miembro con este documento.'})
        return attrs


class MemberListCreateView(generics.ListCreateAPIView):
    serializer_class = MemberSerializer

    def get_queryset(self):
        memberships = Membership.objects.operativas().select_related('plan').order_by('-fecha_fin')
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

    def validate_plan_id(self, value):
        if value.es_pareja:
            raise serializers.ValidationError('Registra los planes de pareja con ambos participantes.')
        return value

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


class PairNewMemberSerializer(MemberValidationFieldsMixin, serializers.Serializer):
    nombres = serializers.CharField(max_length=100)
    apellidos = serializers.CharField(max_length=100)
    tipo_documento = serializers.ChoiceField(choices=Member.TipoDocumento.choices)
    numero_documento = serializers.CharField(max_length=20, trim_whitespace=False)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    acepta_datos = serializers.BooleanField()

    def validate_acepta_datos(self, value):
        if not value:
            raise serializers.ValidationError('Se requiere autorización para el tratamiento de datos.')
        return value

    def validate(self, attrs):
        if Member.objects.filter(numero_documento=attrs['numero_documento']).exists():
            raise serializers.ValidationError({'numero_documento': 'Ya existe un miembro con este documento.'})
        return attrs


class PairParticipantSerializer(serializers.Serializer):
    member_id = serializers.PrimaryKeyRelatedField(
        source='member', queryset=Member.objects.filter(archivado=False), required=False
    )
    nuevo_miembro = PairNewMemberSerializer(required=False)
    metodo = serializers.ChoiceField(choices=Payment.Metodo.choices)
    referencia = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate(self, attrs):
        if ('member' in attrs) == ('nuevo_miembro' in attrs):
            raise serializers.ValidationError('Selecciona un miembro existente o registra uno nuevo.')
        return attrs


class PairRegistrationSerializer(serializers.Serializer):
    plan_id = serializers.PrimaryKeyRelatedField(
        source='plan', queryset=Plan.objects.filter(activo=True, es_pareja=True)
    )
    fecha_inicio = serializers.DateField()
    participantes = PairParticipantSerializer(many=True, min_length=2, max_length=2)

    def validate_participantes(self, participants):
        ids = [p['member'].id for p in participants if 'member' in p]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Los participantes deben ser personas diferentes.')
        documents = [p['nuevo_miembro']['numero_documento'] for p in participants if 'nuevo_miembro' in p]
        if len(documents) != len(set(documents)):
            raise serializers.ValidationError('Los participantes no pueden compartir documento.')
        return participants

    @transaction.atomic
    def create(self, validated_data):
        plan = Plan.objects.select_for_update().get(pk=validated_data['plan'].pk)
        if not plan.activo or not plan.es_pareja:
            raise serializers.ValidationError({'plan_id': 'El plan de pareja ya no está disponible.'})
        participants = validated_data['participantes']
        ids = sorted(p['member'].id for p in participants if 'member' in p)
        members = {member.id: member for member in Member.objects.select_for_update().filter(pk__in=ids).order_by('pk')}
        if len(members) != len(ids) or any(member.archivado for member in members.values()):
            raise serializers.ValidationError({'participantes': 'Uno de los miembros ya no está disponible.'})
        start = validated_data['fecha_inicio']
        today = timezone.localdate()
        latest = Membership.objects.operativas().filter(
            member_id__in=ids, fecha_fin__gte=today,
        ).order_by('-fecha_fin').first()
        if latest and start <= latest.fecha_fin:
            raise serializers.ValidationError({
                'fecha_inicio': f'La fecha debe ser posterior al {latest.fecha_fin.isoformat()}.',
            })
        try:
            start + timedelta(days=plan.duracion_dias - 1)
        except OverflowError:
            raise serializers.ValidationError({'fecha_inicio': 'La fecha final excede el límite permitido.'})
        group = uuid4()
        payments = []
        for participant in participants:
            if 'member' in participant:
                member = members[participant['member'].id]
            else:
                data = participant['nuevo_miembro'].copy()
                data.pop('acepta_datos')
                member = Member.objects.create(acepta_datos_en=timezone.now(), **data)
            payments.append(registrar_pago(
                member, plan, participant['metodo'], referencia=participant.get('referencia', ''),
                usuario=self.context['request'].user, fecha_inicio=start, grupo_pareja=group,
            ))
        return payments


class PairRegistrationView(generics.CreateAPIView):
    serializer_class = PairRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payments = serializer.save()
        return Response({
            'grupo_pareja': str(payments[0].membership.grupo_pareja),
            'pagos': [{'id': p.id, 'member_id': p.member_id, 'membership_id': p.membership_id,
                       'monto_cop': p.monto_cop} for p in payments],
        }, status=status.HTTP_201_CREATED)


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
    membership_id = serializers.IntegerField(read_only=True)
    congelada = serializers.BooleanField(source='membership.congelada', read_only=True)
    membresia_vigente = serializers.SerializerMethodField()
    member_archivado = serializers.BooleanField(source='member.archivado', read_only=True)
    es_pareja = serializers.BooleanField(source='membership.es_pareja', read_only=True)
    grupo_pareja = serializers.UUIDField(source='membership.grupo_pareja', read_only=True, allow_null=True)
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
            'membership_id',
            'congelada',
            'membresia_vigente',
            'member_archivado',
            'es_pareja',
            'grupo_pareja',
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

    def get_membresia_vigente(self, obj):
        today = timezone.localdate()
        return (
            not obj.membership_has_void_payment
            and obj.membership.fecha_inicio <= today <= obj.membership.fecha_fin
        )

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.get_username() if obj.registrado_por else 'Sistema'


class PaymentListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PaymentCreateSerializer
        return PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('member', 'membership__plan', 'registrado_por').annotate(
            membership_has_void_payment=Exists(
                Payment.objects.filter(membership_id=OuterRef('membership_id'), anulado=True)
            )
        ).order_by('-fecha', '-id')
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

    @transaction.atomic
    def post(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk)
        membership = get_object_or_404(Membership.objects.select_for_update(), pk=payment.membership_id)
        if membership.es_pareja:
            raise serializers.ValidationError({'detail': 'No se pueden anular pagos de planes de pareja.'})
        payment = get_object_or_404(Payment.objects.select_for_update(), pk=pk)
        payment.anulado = True
        payment.save(update_fields=['anulado'])
        return Response({'id': payment.id, 'anulado': True})


class MembershipStartDateSerializer(serializers.Serializer):
    fecha_inicio = serializers.DateField()


def membership_response(membership):
    return {
        'id': membership.id,
        'fecha_inicio': membership.fecha_inicio.isoformat(),
        'fecha_fin': membership.fecha_fin.isoformat(),
        'congelada': membership.congelada,
    }


class MembershipFreezeView(APIView):
    permission_classes = [IsAdminRole]

    @transaction.atomic
    def post(self, request, pk):
        membership = get_object_or_404(Membership.objects.select_for_update(), pk=pk)
        today = timezone.localdate()
        if membership.payments.filter(anulado=True).exists():
            raise serializers.ValidationError({'detail': 'No se puede congelar una membresía con un pago anulado.'})
        if membership.congelada:
            raise serializers.ValidationError({'detail': 'Esta membresía ya fue congelada.'})
        if not membership.fecha_inicio <= today <= membership.fecha_fin:
            raise serializers.ValidationError({'detail': 'Solo se pueden congelar membresías vigentes.'})
        try:
            end_date = membership.fecha_fin + timedelta(days=5)
        except OverflowError:
            raise serializers.ValidationError({'detail': 'La fecha final excede el límite permitido.'})
        updated = Membership.objects.operativas().filter(
            pk=pk,
            congelada=False,
            fecha_inicio=membership.fecha_inicio,
            fecha_fin=membership.fecha_fin,
        ).update(fecha_fin=end_date, congelada=True)
        if not updated:
            return Response(
                {'detail': 'La membresía cambió. Actualiza la información e inténtalo de nuevo.'},
                status=status.HTTP_409_CONFLICT,
            )
        membership.fecha_fin = end_date
        membership.congelada = True
        return Response(membership_response(membership))


class MembershipStartDateView(APIView):
    def patch(self, request, pk):
        queryset = Membership.objects.all()
        if not request.user.is_superuser:
            queryset = queryset.filter(member__archivado=False)
        membership = get_object_or_404(queryset, pk=pk)
        if membership.es_pareja:
            raise serializers.ValidationError({'detail': 'No se puede corregir el inicio de una membresía de pareja.'})
        serializer = MembershipStartDateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_date = serializer.validated_data['fecha_inicio']
        try:
            end_date = start_date + (membership.fecha_fin - membership.fecha_inicio)
        except OverflowError:
            raise serializers.ValidationError({'fecha_inicio': 'La fecha final excede el límite permitido.'})
        updated = queryset.filter(
            pk=pk,
            fecha_inicio=membership.fecha_inicio,
            fecha_fin=membership.fecha_fin,
            congelada=membership.congelada,
        ).update(fecha_inicio=start_date, fecha_fin=end_date)
        if not updated:
            return Response(
                {'detail': 'La membresía cambió. Actualiza la información e inténtalo de nuevo.'},
                status=status.HTTP_409_CONFLICT,
            )
        membership.fecha_inicio = start_date
        membership.fecha_fin = end_date
        return Response(membership_response(membership))
