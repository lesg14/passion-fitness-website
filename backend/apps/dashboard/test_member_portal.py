from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.access.models import Asistencia
from apps.billing.models import Membership, Payment
from apps.members.models import Member
from apps.plans.models import Plan


class MemberPortalTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='portal-ana', password='Portal-pass-123', first_name='Ana'
        )
        self.member = Member.objects.create(
            nombres='Ana María', apellidos='Gómez', numero_documento='12345678', user=self.user
        )
        self.plan = Plan.objects.create(nombre='Mensual', precio_cop=70000, duracion_dias=30)
        today = timezone.localdate()
        self.membership = Membership.objects.create(
            member=self.member, plan=self.plan,
            fecha_inicio=today.replace(day=1), fecha_fin=today + timedelta(days=20),
        )
        Payment.objects.create(
            member=self.member, membership=self.membership, monto_cop=70000,
            metodo=Payment.Metodo.NEQUI, referencia='REF-001',
        )
        self.client = APIClient()

    def login(self, role='member'):
        return self.client.post(
            '/api/auth/login/',
            {'username': 'portal-ana', 'password': 'Portal-pass-123', 'role': role},
            format='json',
        )

    def test_member_can_login_and_only_receive_own_read_only_portal(self):
        self.assertEqual(self.login().status_code, 200)
        session = self.client.get('/api/auth/session/').json()
        self.assertEqual(session['role'], 'member')
        response = self.client.get('/api/member/portal/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['member']['nombre'], 'Ana María')
        self.assertEqual(data['payments'], [{
            'id': data['payments'][0]['id'],
            'fecha': timezone.localdate().isoformat(),
            'monto_cop': 70000,
            'metodo': 'Nequi',
            'referencia': 'REF-001',
        }])
        self.assertIn('days', data['attendance'])

    def test_attendance_percentage_excludes_sundays_and_streak_starts_at_three(self):
        today = timezone.localdate()
        attended_days = []
        cursor = today - timedelta(days=2)
        while len(attended_days) < 3:
            if cursor.weekday() != 6:
                attended_days.append(cursor)
            cursor -= timedelta(days=1)
        for day in attended_days:
            Asistencia.objects.create(member=self.member, fecha=day)
        self.client.force_authenticate(self.user)
        data = self.client.get('/api/member/portal/').json()
        self.assertEqual(data['attendance']['streak'], 3)
        self.assertTrue(data['attendance']['streak_active'])
        sunday = next(day for day in data['attendance']['days'] if day['estado'] == 'cerrado')
        self.assertEqual(sunday['estado'], 'cerrado')

    def test_archived_member_and_staff_cannot_use_portal(self):
        self.member.archivado = True
        self.member.save(update_fields=['archivado'])
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/member/portal/').status_code, 403)
        staff = get_user_model().objects.create_user('staff', password='Staff-pass-123', is_staff=True)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get('/api/member/portal/').status_code, 403)

    def test_expired_membership_returns_renewal_alert_details(self):
        self.membership.fecha_fin = timezone.localdate() - timedelta(days=1)
        self.membership.save(update_fields=['fecha_fin'])
        self.client.force_authenticate(self.user)
        membership = self.client.get('/api/member/portal/').json()['membership']
        self.assertEqual(membership['estado'], 'vencida')
        self.assertEqual(membership['dias_restantes'], 0)
        self.assertIn('Renuévalo', membership['mensaje'])

    def test_membership_expiry_messages_use_each_remaining_day(self):
        today = timezone.localdate()
        for days, status, expected in (
            (0, 'vence_hoy', 'vence hoy'),
            (1, 'vence_1_dia', 'vence mañana'),
            (2, 'vence_2_dias', 'vence dentro de 2 días'),
            (3, 'vence_3_dias', 'vence dentro de 3 días'),
        ):
            with self.subTest(days=days):
                self.membership.fecha_inicio = today - timedelta(days=10)
                self.membership.fecha_fin = today + timedelta(days=days)
                self.membership.save(update_fields=['fecha_inicio', 'fecha_fin'])
                self.client.force_authenticate(self.user)
                membership = self.client.get('/api/member/portal/').json()['membership']
                self.assertEqual(membership['estado'], status)
                self.assertIn(expected, membership['mensaje'])

    def test_member_cannot_login_as_staff_or_view_staff_data(self):
        self.assertEqual(self.login(role='staff').status_code, 403)
        self.assertEqual(self.login(role='admin').status_code, 403)

    def test_member_can_request_attendance_for_an_adjacent_month(self):
        today = timezone.localdate()
        previous_month = (today.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
        attendance_day = today.replace(day=1) - timedelta(days=1)
        if attendance_day.weekday() == 6:
            attendance_day -= timedelta(days=1)
        Asistencia.objects.create(member=self.member, fecha=attendance_day)

        self.client.force_authenticate(self.user)
        response = self.client.get(f'/api/member/portal/?month={previous_month}')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['month'], previous_month)
        self.assertIn(
            {'fecha': attendance_day.isoformat(), 'estado': 'asistio'},
            data['attendance']['days'],
        )

    def test_member_portal_rejects_invalid_month(self):
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/member/portal/?month=noviembre')
        self.assertEqual(response.status_code, 400)
