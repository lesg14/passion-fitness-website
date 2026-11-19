import hashlib
import json
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import Membership, OnlinePayment, Payment, registrar_pago
from apps.members.models import Member
from apps.plans.models import Plan


@override_settings(
    WOMPI_ENVIRONMENT='test',
    WOMPI_PUBLIC_KEY='pub_test_key',
    WOMPI_INTEGRITY_SECRET='integrity-secret',
    WOMPI_EVENTS_SECRET='events-secret',
    WOMPI_REDIRECT_URL='http://localhost:5173/member/payment-result',
)
class WompiPaymentTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='member-online', password='Password-123')
        self.member = Member.objects.create(
            nombres='Ana', apellidos='Gómez', numero_documento='1234567890',
            email='ana@example.com', telefono='3001234567', user=self.user,
        )
        self.plan = Plan.objects.create(nombre='Mensual online', precio_cop=70000, duracion_dias=30)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def signed_event(self, transaction, properties=None):
        properties = properties or [
            'transaction.id', 'transaction.status', 'transaction.amount_in_cents',
        ]
        values = [str(transaction[property_path.split('.')[1]]) for property_path in properties]
        checksum = hashlib.sha256(
            ''.join(values + ['1234567890', 'events-secret']).encode()
        ).hexdigest().upper()
        return {
            'event': 'transaction.updated',
            'data': {'transaction': transaction},
            'environment': 'test',
            'signature': {'properties': properties, 'checksum': checksum},
            'timestamp': 1234567890,
        }

    def test_checkout_uses_current_membership_end_date_and_audit_date_is_payment_date(self):
        today = timezone.localdate()
        current = registrar_pago(
            self.member, self.plan, Payment.Metodo.EFECTIVO,
            fecha_inicio=today - timedelta(days=27),
        ).membership
        current.fecha_fin = today + timedelta(days=2)
        current.save(update_fields=['fecha_fin'])

        response = self.client.post(
            '/api/member/payments/checkout/',
            {'plan_id': self.plan.id},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        order = OnlinePayment.objects.get()
        self.assertEqual(order.fecha_inicio, current.fecha_fin)
        query = parse_qs(urlparse(response.json()['checkout_url']).query)
        self.assertEqual(query['reference'], [order.referencia])
        self.assertEqual(query['amount-in-cents'], ['7000000'])

        transaction = {
            'id': 'wompi-test-1',
            'status': 'APPROVED',
            'amount_in_cents': 7000000,
            'currency': 'COP',
            'reference': order.referencia,
            'payment_method_type': 'NEQUI',
            'finalized_at': f'{today.isoformat()}T15:00:00Z',
        }
        webhook = self.client.post(
            '/api/payments/webhook/wompi/',
            data=json.dumps(self.signed_event(transaction)),
            content_type='application/json',
        )

        self.assertEqual(webhook.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.estado, OnlinePayment.Estado.APROBADO)
        self.assertEqual(order.payment.fecha, today)
        self.assertEqual(order.payment.membership.fecha_inicio, current.fecha_fin)
        self.assertEqual(order.payment.membership.fecha_fin, current.fecha_fin + timedelta(days=29))
        self.assertEqual(Payment.objects.filter(member=self.member).count(), 2)

        self.client.post(
            '/api/payments/webhook/wompi/',
            data=json.dumps(self.signed_event(transaction)),
            content_type='application/json',
        )
        self.assertEqual(Payment.objects.filter(member=self.member).count(), 2)

    def test_webhook_rejects_invalid_signature_without_activation(self):
        response = self.client.post(
            '/api/member/payments/checkout/',
            {'plan_id': self.plan.id},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        order = OnlinePayment.objects.get()
        transaction = {
            'id': 'wompi-test-2',
            'status': 'APPROVED',
            'amount_in_cents': self.plan.precio_cop * 100,
            'currency': 'COP',
            'reference': order.referencia,
        }
        event = self.signed_event(transaction)
        event['signature']['checksum'] = 'invalid'

        webhook = self.client.post(
            '/api/payments/webhook/wompi/',
            data=json.dumps(event),
            content_type='application/json',
        )

        self.assertEqual(webhook.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.estado, OnlinePayment.Estado.PENDIENTE)
        self.assertEqual(Payment.objects.count(), 0)
