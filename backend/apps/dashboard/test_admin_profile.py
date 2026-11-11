import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase


User = get_user_model()


class AdminProfileTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', password='Admin-test-pass-934!')
        self.other = User.objects.create_superuser('other', password='Other-test-pass-934!', email='other@example.com')
        self.staff = User.objects.create_user('reception', password='Staff-test-pass-934!', is_staff=True)
        self.client.force_login(self.admin)
        self.url = '/api/auth/admin-profile/'

    def patch(self, client, data, **kwargs):
        return client.patch(self.url, json.dumps(data), content_type='application/json', **kwargs)

    def test_update_own_profile_and_session(self):
        self.assertEqual(self.client.get(self.url).json()['username'], 'admin')
        response = self.patch(self.client, {
            'username': 'admin-nuevo', 'first_name': 'María', 'last_name': 'Pérez', 'email': 'admin@example.com',
        })
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('password', response.json())
        self.admin.refresh_from_db()
        self.assertEqual((self.admin.username, self.admin.first_name, self.admin.last_name, self.admin.email),
                         ('admin-nuevo', 'María', 'Pérez', 'admin@example.com'))
        self.assertTrue(self.admin.is_superuser)
        session = self.client.get('/api/auth/session/').json()
        self.assertEqual((session['username'], session['first_name']), ('admin-nuevo', 'María'))
        self.other.refresh_from_db()
        self.assertEqual(self.other.username, 'other')

    def test_rejects_other_accounts_roles_and_invalid_values(self):
        for data in (
            {'id': self.other.pk, 'first_name': 'Alterado'},
            {'is_superuser': False}, {'is_active': False}, {'is_staff': False},
            {'username': 'OTHER'}, {'email': 'OTHER@example.com'}, {'email': 'inválido'},
        ):
            self.assertEqual(self.patch(self.client, data).status_code, 400, data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_superuser)
        self.assertTrue(self.admin.is_active)
        self.assertEqual(self.admin.first_name, '')
        self.assertEqual(self.client.put(self.url, '{}', content_type='application/json').status_code, 405)
        for user in (None, self.staff):
            self.client.logout()
            if user:
                self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.patch(self.client, {'first_name': 'Prohibido'}).status_code, 403)

    def test_password_change_requires_current_and_invalidates_other_sessions(self):
        other_session = Client()
        other_session.force_login(self.admin)
        for data in (
            {'password': 'Nueva-clave-segura-981!'},
            {'password': 'Nueva-clave-segura-981!', 'current_password': 'incorrecta'},
            {'password': '12345678', 'current_password': 'Admin-test-pass-934!'},
            {'current_password': 'Admin-test-pass-934!'},
        ):
            self.assertEqual(self.patch(self.client, data).status_code, 400, data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('Admin-test-pass-934!'))
        response = self.patch(self.client, {
            'password': 'Nueva-clave-segura-981!', 'current_password': 'Admin-test-pass-934!',
        })
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('password', response.json())
        self.assertNotIn('current_password', response.json())
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 200)
        self.assertEqual(other_session.get('/api/auth/session/').status_code, 401)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('Nueva-clave-segura-981!'))

    def test_profile_update_requires_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(self.patch(client, {'first_name': 'Ana'}).status_code, 403)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(self.patch(client, {'first_name': 'Ana'}, HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(self.patch(client, {
            'password': 'Nueva-clave-segura-981!', 'current_password': 'Admin-test-pass-934!',
        }, HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(self.patch(client, {'last_name': 'Pérez'}, HTTP_X_CSRFTOKEN=token).status_code, 200)
