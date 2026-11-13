import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import Client, TestCase

from apps.access.services import DOOR_GROUP


User = get_user_model()


class DoorAccountManagementTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', password='Admin-test-pass-934!')
        self.staff = User.objects.create_user('recepcion', password='Staff-test-pass-934!', is_staff=True)
        self.member = User.objects.create_user('miembro', password='Member-test-pass-934!')
        self.door = User.objects.create_user('puerta', password='Door-test-pass-934!')
        self.door.groups.add(Group.objects.create(name=DOOR_GROUP))
        self.client.force_login(self.admin)

    def post(self, url, data):
        return self.client.post(url, json.dumps(data), content_type='application/json')

    def patch(self, url, data):
        return self.client.patch(url, json.dumps(data), content_type='application/json')

    def test_create_list_and_update_door_account(self):
        response = self.post('/api/door-accounts/', {'username': 'puerta2', 'password': 'Segura-clave-934!'})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertNotIn('password', response.json())
        account = User.objects.get(username='puerta2')
        self.assertFalse(account.is_staff)
        self.assertFalse(account.is_superuser)
        self.assertTrue(account.check_password('Segura-clave-934!'))
        self.assertTrue(account.groups.filter(name=DOOR_GROUP).exists())
        self.assertEqual({row['username'] for row in self.client.get('/api/door-accounts/').json()}, {'puerta', 'puerta2'})
        response = self.patch(f'/api/door-accounts/{account.pk}/', {'username': 'entrada2'})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['username'], 'entrada2')
        self.assertEqual(self.client.delete(f'/api/door-accounts/{account.pk}/').status_code, 405)

    def test_created_account_can_log_in_and_check_in_with_csrf(self):
        response = self.post('/api/door-accounts/', {'username': 'puerta2', 'password': 'Segura-clave-934!'})
        self.assertEqual(response.status_code, 201, response.content)
        client = Client(enforce_csrf_checks=True)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        response = client.post('/api/auth/login/', json.dumps({
            'username': 'puerta2', 'password': 'Segura-clave-934!', 'role': 'door',
        }), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['role'], 'door')
        response = client.post('/api/access/check-in/', json.dumps({
            'numero_documento': '1234567890',
        }), content_type='application/json', HTTP_X_CSRFTOKEN=response.json()['csrfToken'])
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(response.json()['permitido'])
        self.assertEqual(client.get('/api/door-accounts/').status_code, 403)

    def test_permissions_and_account_isolation(self):
        for user in (None, self.staff, self.member, self.door):
            self.client.logout()
            if user:
                self.client.force_login(user)
            self.assertEqual(self.client.get('/api/door-accounts/').status_code, 403)
            self.assertEqual(self.post('/api/door-accounts/', {'username': 'nueva', 'password': 'Segura-clave-934!'}).status_code, 403)
            self.assertEqual(self.patch(f'/api/door-accounts/{self.door.pk}/', {'is_active': False}).status_code, 403)
        self.client.force_login(self.admin)
        for user in (self.admin, self.staff, self.member):
            self.assertEqual(self.patch(f'/api/door-accounts/{user.pk}/', {'is_active': False}).status_code, 404)
        self.assertEqual(self.patch(f'/api/door-accounts/{self.door.pk}/', {'is_staff': True}).status_code, 400)
        self.assertEqual(self.post('/api/door-accounts/', {'username': 'recepcion', 'password': 'Segura-clave-934!'}).status_code, 400)
        self.assertEqual(self.post('/api/door-accounts/', {'username': 'nueva', 'password': '12345678'}).status_code, 400)

    def test_reset_and_deactivation_invalidate_sessions(self):
        client = Client()
        client.force_login(self.door)
        self.assertEqual(client.get('/api/auth/session/').status_code, 200)
        self.assertEqual(self.patch(f'/api/door-accounts/{self.door.pk}/', {'password': 'Nueva-clave-segura-981!'}).status_code, 200)
        self.assertEqual(client.get('/api/auth/session/').status_code, 401)
        self.assertTrue(client.login(username='puerta', password='Nueva-clave-segura-981!'))
        self.assertEqual(self.patch(f'/api/door-accounts/{self.door.pk}/', {'is_active': False}).status_code, 200)
        self.assertEqual(client.get('/api/auth/session/').status_code, 401)
        self.assertFalse(client.login(username='puerta', password='Nueva-clave-segura-981!'))
        self.assertEqual(self.patch(f'/api/door-accounts/{self.door.pk}/', {'is_active': True}).status_code, 200)
        self.assertTrue(client.login(username='puerta', password='Nueva-clave-segura-981!'))
        self.assertEqual(client.get('/api/dashboard/').status_code, 403)

    def test_csrf_required(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        data = json.dumps({'username': 'entrada', 'password': 'Segura-clave-934!'})
        self.assertEqual(client.post('/api/door-accounts/', data, content_type='application/json').status_code, 403)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(client.post('/api/door-accounts/', data, content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 201)
