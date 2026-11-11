import json
from datetime import date, timedelta

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
            nombres='Ana', apellidos='Gómez', numero_documento='1234567890'
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
                'numero_documento': '0678901234',
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
            'numero_documento': '1234567890',
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

    def test_registration_stores_optional_birth_date_without_linking_a_user(self):
        self.client.force_login(self.staff)
        payload = {
            'nombres': 'Luis', 'apellidos': 'Pérez',
            'tipo_documento': 'CC', 'numero_documento': '0678901234',
            'fecha_nacimiento': '1995-03-20',
            'acepta_datos': True, 'plan_id': self.plan.id, 'metodo': 'nequi',
        }
        response = self.client.post('/api/members/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['fecha_nacimiento'], '1995-03-20')
        member = Member.objects.get(pk=response.json()['id'])
        self.assertEqual(member.fecha_nacimiento, date(1995, 3, 20))
        self.assertIsNone(member.user_id)
        listed = next(item for item in self.client.get('/api/members/').json() if item['id'] == member.id)
        self.assertEqual(listed['fecha_nacimiento'], '1995-03-20')

    def test_optional_birth_date_and_invalid_birth_date_on_registration(self):
        self.client.force_login(self.staff)
        payload = {
            'nombres': 'Luis', 'apellidos': 'Pérez',
            'tipo_documento': 'CC', 'numero_documento': '0678901234',
            'acepta_datos': True, 'plan_id': self.plan.id, 'metodo': 'nequi',
        }
        payload['fecha_nacimiento'] = '2024-02-30'
        response = self.client.post('/api/members/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('fecha_nacimiento', response.json())
        self.assertEqual(Payment.objects.count(), 0)
        del payload['fecha_nacimiento']
        response = self.client.post('/api/members/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNone(response.json()['fecha_nacimiento'])
        self.assertIsNone(Member.objects.get(pk=response.json()['id']).fecha_nacimiento)

    def test_update_and_clear_birth_date_without_changing_payments(self):
        self.client.force_login(self.staff)
        url = f'/api/members/{self.member.id}/'
        for value in ('1988-04-25', None):
            response = self.client.patch(
                url, data=json.dumps({'fecha_nacimiento': value}), content_type='application/json',
            )
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()['fecha_nacimiento'], value)
            self.member.refresh_from_db()
            self.assertEqual(
                self.member.fecha_nacimiento,
                date(1988, 4, 25) if value else None,
            )
        response = self.client.patch(
            url, data=json.dumps({'fecha_nacimiento': 'fecha inválida'}), content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('fecha_nacimiento', response.json())
        self.assertEqual(Payment.objects.count(), 0)

    def test_registration_validates_identification_phone_and_birth_date(self):
        self.client.force_login(self.staff)
        payload = {
            'nombres': 'Luis', 'apellidos': 'Pérez', 'tipo_documento': 'CC',
            'numero_documento': '0123456789', 'telefono': '3001234567',
            'acepta_datos': True, 'plan_id': self.plan.id, 'metodo': 'nequi',
            'fecha_nacimiento': self.hoy.isoformat(),
        }
        cases = [
            ('numero_documento', '123456789'),
            ('numero_documento', '12345678901'),
            ('numero_documento', '123456789a'),
            ('numero_documento', '12345-7890'),
            ('numero_documento', ' 123456789'),
            ('numero_documento', '١٢٣٤٥٦٧٨٩٠'),
            ('telefono', '123456789'),
            ('telefono', '12345678901'),
            ('telefono', '300123456a'),
            ('telefono', '300-234567'),
            ('telefono', '300123456 '),
            ('fecha_nacimiento', (self.hoy + timedelta(days=1)).isoformat()),
        ]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                response = self.client.post(
                    '/api/members/', data=json.dumps({**payload, field: value}), content_type='application/json',
                )
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn(field, response.json())
                self.assertEqual(Payment.objects.count(), 0)
        response = self.client.post('/api/members/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        member = Member.objects.get(pk=response.json()['id'])
        self.assertEqual(member.numero_documento, '0123456789')
        self.assertEqual(member.telefono, '3001234567')
        self.assertEqual(member.fecha_nacimiento, self.hoy)

    def test_member_update_validates_only_submitted_fields(self):
        self.client.force_login(self.staff)
        url = f'/api/members/{self.member.id}/'
        for field, value in (
            ('numero_documento', '123abc7890'),
            ('telefono', '123'),
            ('fecha_nacimiento', (self.hoy + timedelta(days=1)).isoformat()),
        ):
            with self.subTest(field=field):
                response = self.client.patch(url, data=json.dumps({field: value}), content_type='application/json')
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn(field, response.json())
        response = self.client.patch(
            url, data=json.dumps({'telefono': '', 'fecha_nacimiento': None}), content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.numero_documento, '1234567890')
        self.assertEqual(self.member.telefono, '')
        self.assertIsNone(self.member.fecha_nacimiento)

    def test_registration_and_update_validate_optional_email(self):
        self.client.force_login(self.staff)
        payload = {
            'nombres': 'Luis', 'apellidos': 'Pérez', 'tipo_documento': 'CC',
            'numero_documento': '0123456789', 'acepta_datos': True,
            'plan_id': self.plan.id, 'metodo': 'nequi',
        }
        url = f'/api/members/{self.member.id}/'
        for value in ('correo-sin-arroba', 'nombre@', '@ejemplo.com', 'nombre@ejemplo'):
            with self.subTest(email=value):
                response = self.client.post(
                    '/api/members/', data=json.dumps({**payload, 'email': value}), content_type='application/json',
                )
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn('email', response.json())
                response = self.client.patch(
                    url, data=json.dumps({'email': value}), content_type='application/json',
                )
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn('email', response.json())
        self.assertEqual(Payment.objects.count(), 0)
        response = self.client.post(
            '/api/members/', data=json.dumps({**payload, 'email': 'luis@example.com'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Member.objects.get(pk=response.json()['id']).email, 'luis@example.com')
        for email in ('ana@example.com', ''):
            response = self.client.patch(
                url, data=json.dumps({'email': email}), content_type='application/json',
            )
            self.assertEqual(response.status_code, 200, response.content)
            self.member.refresh_from_db()
            self.assertEqual(self.member.email, email)

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

    def test_freeze_is_admin_only_once_and_does_not_change_payments(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        membership = payment.membership
        original_end = membership.fecha_fin
        url = f'/api/memberships/{membership.id}/freeze/'
        self.client.force_login(self.staff)
        self.assertEqual(self.client.post(url).status_code, 403)
        self.client.force_login(self.admin)
        before = self.client.get('/api/dashboard/').json()['metrics']['ingresos_mes']
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200, response.content)
        membership.refresh_from_db()
        self.assertEqual(membership.fecha_fin, original_end + timedelta(days=5))
        self.assertTrue(membership.congelada)
        self.assertEqual(self.client.post(url).status_code, 400)
        membership.refresh_from_db()
        self.assertEqual(membership.fecha_fin, original_end + timedelta(days=5))
        self.assertEqual(Payment.objects.count(), 1)
        payment.refresh_from_db()
        self.assertEqual(payment.monto_cop, self.plan.precio_cop)
        self.assertEqual(self.client.get('/api/dashboard/').json()['metrics']['ingresos_mes'], before)
        entry = self.client.get('/api/payments/').json()[0]
        self.assertEqual(entry['membership_id'], membership.id)
        self.assertTrue(entry['congelada'])
        self.assertTrue(entry['membresia_vigente'])
        renewal = registrar_pago(self.member, self.plan, 'nequi')
        self.assertEqual(renewal.membership.fecha_inicio, membership.fecha_fin + timedelta(days=1))

    def test_freeze_only_accepts_current_memberships(self):
        self.client.force_login(self.admin)
        for start, end in (
            (self.hoy - timedelta(days=3), self.hoy - timedelta(days=1)),
            (self.hoy + timedelta(days=1), self.hoy + timedelta(days=3)),
        ):
            membership = Membership.objects.create(
                member=self.member, plan=self.plan, fecha_inicio=start, fecha_fin=end,
            )
            response = self.client.post(f'/api/memberships/{membership.id}/freeze/')
            self.assertEqual(response.status_code, 400)
            membership.refresh_from_db()
            self.assertFalse(membership.congelada)
            self.assertEqual(membership.fecha_fin, end)
        self.assertEqual(self.client.post('/api/memberships/999999/freeze/').status_code, 404)

    def test_freeze_allows_membership_on_its_final_day(self):
        membership = Membership.objects.create(
            member=self.member, plan=self.plan,
            fecha_inicio=self.hoy - timedelta(days=29), fecha_fin=self.hoy,
        )
        self.client.force_login(self.admin)
        response = self.client.post(f'/api/memberships/{membership.id}/freeze/')
        self.assertEqual(response.status_code, 200, response.content)
        membership.refresh_from_db()
        self.assertEqual(membership.fecha_fin, self.hoy + timedelta(days=5))

    def test_staff_corrects_start_preserving_duration_freeze_and_income(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        membership = payment.membership
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/memberships/{membership.id}/freeze/').status_code, 200)
        membership.refresh_from_db()
        old_start, old_end = membership.fecha_inicio, membership.fecha_fin
        other = registrar_pago(self.member, self.plan, 'nequi').membership
        old_other_start, old_other_end = other.fecha_inicio, other.fecha_fin
        self.client.force_login(self.staff)
        income = self.client.get('/api/dashboard/').json()['metrics']['ingresos_mes']
        new_start = old_start - timedelta(days=7)
        response = self.client.patch(
            f'/api/memberships/{membership.id}/start-date/',
            data=json.dumps({'fecha_inicio': new_start.isoformat()}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        membership.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(membership.fecha_inicio, new_start)
        self.assertEqual(membership.fecha_fin, old_end - timedelta(days=7))
        self.assertTrue(membership.congelada)
        self.assertEqual((other.fecha_inicio, other.fecha_fin), (old_other_start, old_other_end))
        self.assertEqual(Payment.objects.count(), 2)
        self.assertEqual(self.client.get('/api/dashboard/').json()['metrics']['ingresos_mes'], income)
        entry = next(p for p in self.client.get('/api/payments/').json() if p['id'] == payment.id)
        self.assertEqual(entry['fecha_inicio'], new_start.isoformat())
        self.assertEqual(entry['fecha_fin'], membership.fecha_fin.isoformat())
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/memberships/{membership.id}/freeze/').status_code, 400)

    def test_correct_start_rejects_invalid_date_overflow_and_archived_for_staff(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        membership = payment.membership
        url = f'/api/memberships/{membership.id}/start-date/'
        self.client.force_login(self.staff)
        for start in ('invalid', '9999-12-31', None):
            response = self.client.patch(
                url, data=json.dumps({'fecha_inicio': start}), content_type='application/json',
            )
            self.assertEqual(response.status_code, 400, response.content)
        membership.refresh_from_db()
        self.assertEqual(membership.fecha_inicio, self.hoy)
        self.member.archivado = True
        self.member.save(update_fields=['archivado'])
        response = self.client.patch(
            url, data=json.dumps({'fecha_inicio': self.hoy.isoformat()}), content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)
        self.client.force_login(self.admin)
        response = self.client.patch(
            url, data=json.dumps({'fecha_inicio': self.hoy.isoformat()}), content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

    def test_membership_changes_require_session_and_csrf(self):
        membership = registrar_pago(self.member, self.plan, 'efectivo').membership
        freeze_url = f'/api/memberships/{membership.id}/freeze/'
        date_url = f'/api/memberships/{membership.id}/start-date/'
        self.assertEqual(self.client.post(freeze_url).status_code, 403)
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(client.post(freeze_url).status_code, 403)
        self.assertEqual(client.patch(
            date_url, data=json.dumps({'fecha_inicio': self.hoy.isoformat()}),
            content_type='application/json',
        ).status_code, 403)
        token = self.csrf_token(client)
        self.assertEqual(client.post(freeze_url, HTTP_X_CSRFTOKEN=token).status_code, 200)

    def test_archiving_member_preserves_financial_history_and_can_be_reversed(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        self.client.force_login(self.staff)
        denied = self.client.delete(f'/api/members/{self.member.id}/')
        self.assertEqual(denied.status_code, 403)

        self.client.force_login(self.admin)
        response = self.client.delete(f'/api/members/{self.member.id}/')
        self.assertEqual(response.status_code, 204)
        self.member.refresh_from_db()
        self.assertTrue(self.member.archivado)
        self.assertTrue(Payment.objects.filter(pk=payment.pk).exists())
        self.assertTrue(Membership.objects.filter(pk=payment.membership_id).exists())
        self.assertEqual(self.client.get('/api/members/').json(), [])
        archived = self.client.get('/api/members/?include_archived=true').json()
        self.assertEqual(len(archived), 1)
        self.assertEqual(archived[0]['estado'], 'Archivado')

        restored = self.client.patch(
            f'/api/members/{self.member.id}/',
            data=json.dumps({'archivado': False}),
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200)
        self.member.refresh_from_db()
        self.assertFalse(self.member.archivado)

    def test_archived_members_do_not_affect_dashboard_counts(self):
        registrar_pago(self.member, self.plan, 'efectivo')
        self.member.archivado = True
        self.member.save(update_fields=['archivado'])
        self.client.force_login(self.staff)
        metrics = self.client.get('/api/dashboard/').json()['metrics']
        self.assertEqual(metrics['miembros'], 0)
        self.assertEqual(metrics['activos'], 0)
        self.assertEqual(metrics['vencidos'], 0)

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
        self.member.refresh_from_db()
        self.assertTrue(self.member.archivado)
        self.assertTrue(Member.objects.filter(id=self.member.id).exists())

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

    def test_voided_payment_disables_membership_and_preserves_audit(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        membership = payment.membership
        old_dates = (membership.fecha_inicio, membership.fecha_fin)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/payments/{payment.id}/void/').status_code, 200)
        membership.refresh_from_db()
        self.assertEqual((membership.fecha_inicio, membership.fecha_fin), old_dates)
        self.assertFalse(membership.esta_vigente)
        self.assertFalse(self.member.esta_activo)
        member_data = self.client.get('/api/members/').json()[0]
        self.assertEqual(member_data['estado'], 'Sin membresía')
        self.assertIsNone(member_data['fecha_fin'])
        dashboard = self.client.get('/api/dashboard/').json()
        self.assertEqual(dashboard['metrics']['activos'], 0)
        self.assertEqual(dashboard['metrics']['por_vencer'], 0)
        self.assertEqual(dashboard['metrics']['ingresos_mes'], 0)
        self.assertEqual(dashboard['plans'], [])
        entry = self.client.get('/api/payments/').json()[0]
        self.assertTrue(entry['anulado'])
        self.assertFalse(entry['membresia_vigente'])
        self.assertEqual(entry['fecha_fin'], old_dates[1].isoformat())
        response = self.client.post(f'/api/memberships/{membership.id}/freeze/')
        self.assertEqual(response.status_code, 400, response.content)
        membership.refresh_from_db()
        self.assertFalse(membership.congelada)
        self.assertEqual(membership.fecha_fin, old_dates[1])

    def test_previously_voided_payments_are_excluded_from_renewal_and_states(self):
        payment = registrar_pago(self.member, self.plan, 'efectivo')
        payment.anulado = True
        payment.save(update_fields=['anulado'])
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get('/api/members/').json()[0]['estado'], 'Sin membresía')
        self.assertFalse(self.client.get('/api/payments/').json()[0]['membresia_vigente'])
        renewal = registrar_pago(self.member, self.plan, 'nequi')
        self.assertEqual(renewal.membership.fecha_inicio, self.hoy)
        self.assertTrue(self.member.esta_activo)
        self.assertEqual(self.client.get('/api/dashboard/').json()['metrics']['activos'], 1)

    def test_voiding_preserves_scheduled_renewal_and_other_memberships(self):
        initial = registrar_pago(self.member, self.plan, 'efectivo')
        renewal = registrar_pago(self.member, self.plan, 'nequi')
        dates = (renewal.membership.fecha_inicio, renewal.membership.fecha_fin)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/payments/{initial.id}/void/').status_code, 200)
        renewal.membership.refresh_from_db()
        self.assertEqual((renewal.membership.fecha_inicio, renewal.membership.fecha_fin), dates)
        self.assertEqual(self.client.get('/api/members/').json()[0]['estado'], 'Próxima')
        metrics = self.client.get('/api/dashboard/').json()['metrics']
        self.assertEqual(metrics['activos'], 0)
        self.assertEqual(metrics['proximos'], 1)
        self.assertEqual(metrics['ingresos_mes'], renewal.monto_cop)

    def test_voiding_future_membership_keeps_other_active_membership(self):
        active = registrar_pago(self.member, self.plan, 'efectivo')
        future = registrar_pago(self.member, self.plan, 'nequi')
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/payments/{future.id}/void/').status_code, 200)
        member_data = self.client.get('/api/members/').json()[0]
        self.assertEqual(member_data['fecha_fin'], active.membership.fecha_fin.isoformat())
        self.assertEqual(member_data['estado'], 'Activo')
        self.assertTrue(self.member.esta_activo)
        self.assertEqual(self.client.get('/api/dashboard/').json()['metrics']['activos'], 1)
        payments = self.client.get('/api/payments/').json()
        self.assertTrue(next(item for item in payments if item['id'] == active.id)['membresia_vigente'])
        self.assertFalse(next(item for item in payments if item['id'] == future.id)['membresia_vigente'])
