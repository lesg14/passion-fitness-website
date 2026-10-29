import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from apps.billing.models import Membership, Payment, registrar_pago
from apps.members.models import Member
from apps.plans.models import Plan


class DashboardApiTests(TestCase):
    def setUp(self):
        self.hoy = timezone.localdate()
        self.staff = get_user_model().objects.create_user(
            username='manager', password='test-password', is_staff=True
        )
        self.admin = get_user_model().objects.create_superuser(
            username='boss', password='test-password', email='boss@example.com'
        )
        self.plan = Plan.objects.create(nombre='Mensual', precio_cop=80000, duracion_dias=30)
        self.member = Member.objects.create(
            nombres='Ana', apellidos='Gómez', numero_documento='12345'
        )

    def csrf_token(self, client=None):
        client = client or self.client
        response = client.get('/api/auth/csrf/')
        self.assertEqual(response.status_code, 200)
        return response.json()['csrfToken']

    def test_api_requires_staff_login(self):
        response = self.client.get('/api/members/')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)

    def test_staff_can_read_dashboard_plans_and_members(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/dashboard/').status_code, 200)
        self.assertEqual(self.client.get('/api/plans/').json()[0]['nombre'], 'Mensual')
        response = self.client.get('/api/members/').json()
        self.assertEqual(response[0]['nombre'], 'Ana Gómez')
        self.assertEqual(response[0]['estado'], 'Sin membresía')

    def test_registration_creates_member_membership_and_payment(self):
        self.client.force_login(self.staff)
        token = self.csrf_token()
        response = self.client.post(
            '/api/members/',
            data=json.dumps({
                'nombres': 'Luis',
                'apellidos': 'Pérez',
                'tipo_documento': 'CC',
                'numero_documento': '67890',
                'email': 'luis@example.com',
                'acepta_datos': True,
                'plan_id': self.plan.id,
                'metodo': 'nequi',
            }),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Member.objects.count(), 2)
        self.assertEqual(Membership.objects.count(), 1)
        payment = Payment.objects.get()
        self.assertEqual(payment.member.nombres, 'Luis')
        self.assertEqual(payment.registrado_por, self.staff)
        self.assertIsNotNone(payment.member.acepta_datos_en)

    def test_registration_requires_consent_and_unique_document(self):
        self.client.force_login(self.staff)
        token = self.csrf_token()
        payload = {
            'nombres': 'Ana',
            'apellidos': 'Otra',
            'tipo_documento': 'CC',
            'numero_documento': '12345',
            'acepta_datos': False,
            'plan_id': self.plan.id,
            'metodo': 'efectivo',
        }
        response = self.client.post(
            '/api/members/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Member.objects.count(), 1)
        self.assertEqual(Membership.objects.count(), 0)
        self.assertEqual(Payment.objects.count(), 0)

    def test_payment_endpoint_renews_membership_and_records_staff(self):
        first_payment = registrar_pago(self.member, self.plan, 'efectivo')
        self.client.force_login(self.staff)
        token = self.csrf_token()
        response = self.client.post(
            '/api/payments/',
            data=json.dumps({
                'member_id': self.member.id,
                'plan_id': self.plan.id,
                'metodo': 'nequi',
            }),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(
            response.json()['membresia']['fecha_inicio'],
            (first_payment.membership.fecha_fin + timedelta(days=1)).isoformat(),
        )
        self.assertEqual(Payment.objects.count(), 2)
        self.assertEqual(Payment.objects.order_by('-id').first().registrado_por, self.staff)

    def test_payment_endpoint_with_custom_plan_and_custom_start_date(self):
        plan_tradicional = Plan.objects.create(nombre='Tradicional', precio_cop=120000, duracion_dias=90)
        self.client.force_login(self.staff)
        token = self.csrf_token()
        custom_date = (timezone.localdate() + timedelta(days=5)).isoformat()
        response = self.client.post(
            '/api/payments/',
            data=json.dumps({
                'member_id': self.member.id,
                'plan_id': plan_tradicional.id,
                'metodo': 'daviplata',
                'fecha_inicio': custom_date,
            }),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['membresia']['fecha_inicio'], custom_date)

        # Al consultar el miembro, ahora su plan es 'Tradicional'
        member_resp = self.client.get('/api/members/').json()
        self.assertEqual(member_resp[0]['plan'], 'Tradicional')
        self.assertEqual(member_resp[0]['fecha_inicio'], custom_date)

    def test_payment_list_and_filter_by_member(self):
        registrar_pago(self.member, self.plan, 'efectivo')
        self.client.force_login(self.staff)
        resp = self.client.get('/api/payments/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 1)
        self.assertEqual(resp.json()[0]['member_id'], self.member.id)
        self.assertEqual(resp.json()[0]['member_nombre'], 'Ana Gómez')

        # Filtro por member_id
        filtered_resp = self.client.get(f'/api/payments/?member_id={self.member.id}')
        self.assertEqual(filtered_resp.status_code, 200)
        self.assertEqual(len(filtered_resp.json()), 1)

    def test_login_requires_csrf_and_only_accepts_staff_or_admin(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'manager', 'password': 'test-password'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        response = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'manager', 'password': 'test-password'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self.csrf_token(client),
        )
        self.assertEqual(response.status_code, 200)
        session_info = client.get('/api/auth/session/').json()
        self.assertEqual(session_info['role'], 'staff')

        # Permite iniciar sesión con correo electrónico
        self.staff.email = 'staff@passionfitness.com'
        self.staff.save()
        response_email = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'staff@passionfitness.com', 'password': 'test-password'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self.csrf_token(client),
        )
        self.assertEqual(response_email.status_code, 200)

        get_user_model().objects.create_user(username='member-user', password='test-password')
        response = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'member-user', 'password': 'test-password'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self.csrf_token(client),
        )
        self.assertEqual(response.status_code, 400)

    def test_expiration_states_detailed(self):
        self.client.force_login(self.staff)
        # 1. Vence hoy
        m_hoy = Member.objects.create(nombres='Hoy', apellidos='Test', numero_documento='101')
        Membership.objects.create(member=m_hoy, plan=self.plan, fecha_inicio=self.hoy - timedelta(days=29), fecha_fin=self.hoy)

        # 2. Vence mañana
        m_manana = Member.objects.create(nombres='Manana', apellidos='Test', numero_documento='102')
        Membership.objects.create(member=m_manana, plan=self.plan, fecha_inicio=self.hoy - timedelta(days=28), fecha_fin=self.hoy + timedelta(days=1))

        # 3. Vence en 2 días
        m_2dias = Member.objects.create(nombres='DosDias', apellidos='Test', numero_documento='103')
        Membership.objects.create(member=m_2dias, plan=self.plan, fecha_inicio=self.hoy - timedelta(days=27), fecha_fin=self.hoy + timedelta(days=2))

        # 4. Vence en 3 días
        m_3dias = Member.objects.create(nombres='TresDias', apellidos='Test', numero_documento='104')
        Membership.objects.create(member=m_3dias, plan=self.plan, fecha_inicio=self.hoy - timedelta(days=26), fecha_fin=self.hoy + timedelta(days=3))

        # 5. Activo (> 3 días)
        m_activo = Member.objects.create(nombres='Activo', apellidos='Test', numero_documento='105')
        Membership.objects.create(member=m_activo, plan=self.plan, fecha_inicio=self.hoy, fecha_fin=self.hoy + timedelta(days=10))

        # 6. Vencido
        m_vencido = Member.objects.create(nombres='Vencido', apellidos='Test', numero_documento='106')
        Membership.objects.create(member=m_vencido, plan=self.plan, fecha_inicio=self.hoy - timedelta(days=40), fecha_fin=self.hoy - timedelta(days=1))

        members = {item['nombre']: item['estado'] for item in self.client.get('/api/members/').json()}
        self.assertEqual(members['Hoy Test'], 'Vence hoy')
        self.assertEqual(members['Manana Test'], 'Vence mañana')
        self.assertEqual(members['DosDias Test'], 'Vence en 2 días')
        self.assertEqual(members['TresDias Test'], 'Vence en 3 días')
        self.assertEqual(members['Activo Test'], 'Activo')
        self.assertEqual(members['Vencido Test'], 'Vencido')

    def test_admin_login_and_role_distinction(self):
        client = Client(enforce_csrf_checks=True)
        token = self.csrf_token(client)
        # Staff trying to login as admin gets 403
        resp = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'manager', 'password': 'test-password', 'role': 'admin'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 403)

        # Admin logs in as admin successfully
        resp = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'boss', 'password': 'test-password', 'role': 'admin'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['role'], 'admin')

    def test_admin_can_manage_plans(self):
        token = self.csrf_token()
        # Staff cannot create plan
        self.client.force_login(self.staff)
        resp = self.client.post(
            '/api/plans/',
            data=json.dumps({'nombre': 'Trimestral', 'precio_cop': 220000, 'duracion_dias': 90}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 403)

        # Admin can create plan
        self.client.force_login(self.admin)
        resp = self.client.post(
            '/api/plans/',
            data=json.dumps({'nombre': 'Trimestral', 'precio_cop': 220000, 'duracion_dias': 90}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201)
        plan_id = resp.json()['id']

        # Admin can edit plan
        resp = self.client.patch(
            f'/api/plans/{plan_id}/',
            data=json.dumps({'precio_cop': 210000}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['precio_cop'], 210000)

    def test_admin_can_edit_and_delete_member(self):
        token = self.csrf_token()
        # Admin can edit member
        self.client.force_login(self.admin)
        resp = self.client.patch(
            f'/api/members/{self.member.id}/',
            data=json.dumps({'telefono': '3001234567'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.telefono, '3001234567')

        # Staff cannot delete member
        self.client.force_login(self.staff)
        resp = self.client.delete(f'/api/members/{self.member.id}/', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 403)

        # Admin can delete member
        self.client.force_login(self.admin)
        resp = self.client.delete(f'/api/members/{self.member.id}/', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Member.objects.filter(id=self.member.id).exists())

    def test_admin_can_void_payment(self):
        token = self.csrf_token()
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        self.assertFalse(payment.anulado)

        # Staff cannot void payment
        self.client.force_login(self.staff)
        resp = self.client.post(f'/api/payments/{payment.id}/void/', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 403)

        # Admin can void payment
        self.client.force_login(self.admin)
        resp = self.client.post(f'/api/payments/{payment.id}/void/', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 200)
        payment.refresh_from_db()
        self.assertTrue(payment.anulado)
