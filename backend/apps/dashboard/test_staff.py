import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase


User = get_user_model()


class StaffManagementTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', password='Admin-test-pass-934!')
        self.staff = User.objects.create_user('existing', password='Staff-test-pass-934!', is_staff=True)
        self.member = User.objects.create_user('member', password='Member-test-pass-934!')
        self.client.force_login(self.admin)

    def post(self, url, data):
        return self.client.post(url, json.dumps(data), content_type='application/json')

    def patch(self, url, data):
        return self.client.patch(url, json.dumps(data), content_type='application/json')

    def test_create_and_list_receptionists_with_hashed_password(self):
        response = self.post('/api/staff/', {
            'username': 'recepcion1', 'password': 'Una-clave-segura-981!',
            'first_name': 'Ana', 'email': 'ana@example.com',
        })
        self.assertEqual(response.status_code, 201, response.content)
        self.assertNotIn('password', response.json())
        user = User.objects.get(username='recepcion1')
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password('Una-clave-segura-981!'))
        self.assertNotEqual(user.password, 'Una-clave-segura-981!')
        users = self.client.get('/api/staff/').json()
        self.assertEqual({item['username'] for item in users}, {'existing', 'recepcion1'})
        self.assertNotIn('password', users[0])

    def test_permissions_prevent_staff_and_anonymous_management(self):
        for user in (None, self.staff, self.member):
            self.client.logout()
            if user:
                self.client.force_login(user)
            for response in (
                self.client.get('/api/staff/'),
                self.post('/api/staff/', {'username': 'new', 'password': 'Una-clave-segura-981!'}),
                self.patch(f'/api/staff/{self.staff.pk}/', {'is_active': False}),
            ):
                self.assertEqual(response.status_code, 403)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)

    def test_created_receptionist_can_log_in_with_operational_permissions(self):
        response = self.post('/api/staff/', {
            'username': 'recepcion2', 'password': 'Una-clave-segura-981!',
        })
        self.assertEqual(response.status_code, 201)
        client = Client(enforce_csrf_checks=True)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        login = client.post('/api/auth/login/', json.dumps({
            'username': 'recepcion2', 'password': 'Una-clave-segura-981!', 'role': 'staff',
        }), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(login.status_code, 200, login.content)
        self.assertEqual(login.json()['role'], 'staff')
        self.assertEqual(client.get('/api/dashboard/').status_code, 200)
        self.assertEqual(client.get('/api/staff/').status_code, 403)
        token = login.json()['csrfToken']
        response = client.post('/api/plans/', json.dumps({
            'nombre': 'Prohibido', 'precio_cop': 100, 'duracion_dias': 1,
        }), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 403)

    def test_api_cannot_modify_admin_or_grant_privileges(self):
        self.assertEqual(self.patch(f'/api/staff/{self.admin.pk}/', {'is_active': False}).status_code, 404)
        self.assertEqual(self.patch(f'/api/staff/{self.member.pk}/', {'is_active': True}).status_code, 404)
        response = self.post('/api/staff/', {
            'username': 'new', 'password': 'Una-clave-segura-981!', 'is_superuser': True,
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='new').exists())
        self.assertEqual(self.patch(f'/api/staff/{self.staff.pk}/', {'is_superuser': True}).status_code, 400)
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.is_superuser)
        self.assertEqual(self.client.delete(f'/api/staff/{self.staff.pk}/').status_code, 405)

    def test_validation_duplicate_identity_and_password(self):
        self.assertEqual(self.post('/api/staff/', [{'username': 'bad'}]).status_code, 400)
        for data in (
            {'username': 'EXISTING', 'password': 'Una-clave-segura-981!'},
            {'username': 'test@example.com', 'password': 'Una-clave-segura-981!'},
            {'username': 'other', 'password': '12345678'},
            {'username': 'other', 'password': ''},
            {'username': 'other', 'password': 'Una-clave-segura-981!', 'email': 'incorrecto'},
        ):
            self.assertEqual(self.post('/api/staff/', data).status_code, 400, data)
        self.staff.email = 'staff@example.com'
        self.staff.save()
        response = self.post('/api/staff/', {
            'username': 'other', 'password': 'Una-clave-segura-981!', 'email': 'STAFF@example.com',
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='other').exists())

    def test_update_password_and_deactivation_end_existing_session(self):
        session = Client()
        session.force_login(self.staff)
        self.assertEqual(session.get('/api/dashboard/').status_code, 200)
        response = self.patch(f'/api/staff/{self.staff.pk}/', {
            'first_name': 'Ana', 'password': 'Nueva-clave-segura-981!',
        })
        self.assertEqual(response.status_code, 200, response.content)
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.first_name, 'Ana')
        self.assertTrue(self.staff.check_password('Nueva-clave-segura-981!'))
        self.assertEqual(session.get('/api/auth/session/').status_code, 401)
        self.assertTrue(session.login(username='existing', password='Nueva-clave-segura-981!'))
        self.assertEqual(self.patch(f'/api/staff/{self.staff.pk}/', {'is_active': False}).status_code, 200)
        self.assertEqual(session.get('/api/auth/session/').status_code, 401)
        self.assertFalse(session.login(username='existing', password='Nueva-clave-segura-981!'))
        self.assertEqual(self.patch(f'/api/staff/{self.staff.pk}/', {'is_active': True}).status_code, 200)
        self.assertTrue(session.login(username='existing', password='Nueva-clave-segura-981!'))

    def test_csrf_required_for_staff_changes(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        response = client.post('/api/staff/', json.dumps({
            'username': 'recepcion2', 'password': 'Una-clave-segura-981!',
        }), content_type='application/json')
        self.assertEqual(response.status_code, 403)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        response = client.post('/api/staff/', json.dumps({
            'username': 'recepcion2', 'password': 'Una-clave-segura-981!',
        }), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201, response.content)

    def test_django_admin_exposes_existing_user_management(self):
        response = self.client.get('/admin/auth/user/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'existing')
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/admin/auth/user/').status_code, 403)
