import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import Membership, Payment, registrar_pago
from apps.members.models import Member
from apps.plans.models import Plan


class PairRegistrationTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("admin", "admin@example.com", "password")
        self.client.force_login(self.admin)
        self.plan = Plan.objects.create(nombre="Pareja", precio_cop=70000, duracion_dias=30, es_pareja=True)
        self.first = Member.objects.create(nombres="Ana", apellidos="Gómez", numero_documento="1000000001")
        self.second = Member.objects.create(nombres="Luis", apellidos="Pérez", numero_documento="1000000002")
        self.today = timezone.localdate()
        self.payload = {
            "plan_id": self.plan.pk, "fecha_inicio": self.today.isoformat(),
            "participantes": [
                {"member_id": self.first.pk, "metodo": "efectivo"},
                {"member_id": self.second.pk, "metodo": "nequi"},
            ],
        }

    def post_pair(self, payload):
        return self.client.post("/api/pair-registrations/", data=json.dumps(payload), content_type="application/json")

    def test_pair_creates_two_linked_payments_and_freezes_independently(self):
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        payments = list(Payment.objects.select_related("membership").order_by("id"))
        self.assertEqual(len(payments), 2)
        self.assertEqual([p.monto_cop for p in payments], [70000, 70000])
        first, second = [p.membership for p in payments]
        self.assertTrue(first.es_pareja)
        self.assertEqual(first.grupo_pareja, second.grupo_pareja)
        self.assertEqual(first.fecha_inicio, second.fecha_inicio)
        response = self.client.post(f"/api/memberships/{first.id}/freeze/")
        self.assertEqual(response.status_code, 200, response.content)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.fecha_fin, second.fecha_fin + timedelta(days=5))
        self.assertFalse(second.congelada)
        self.assertEqual(self.client.post(f"/api/payments/{payments[0].id}/void/").status_code, 400)
        self.assertEqual(self.client.patch(
            f"/api/memberships/{first.id}/start-date/",
            data=json.dumps({"fecha_inicio": self.today.isoformat()}), content_type="application/json",
        ).status_code, 400)

    def test_pair_rejects_conflict_and_uses_shared_date_after_latest(self):
        individual = Plan.objects.create(nombre="Individual", precio_cop=50000, duracion_dias=30)
        existing = registrar_pago(self.first, individual, "efectivo")
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Payment.objects.count(), 1)
        self.payload["fecha_inicio"] = (existing.membership.fecha_fin + timedelta(days=1)).isoformat()
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Payment.objects.count(), 3)

    def test_duplicate_and_invalid_new_member_roll_back(self):
        self.payload["participantes"][1]["member_id"] = self.first.pk
        self.assertEqual(self.post_pair(self.payload).status_code, 400)
        self.payload["participantes"][1] = {
            "nuevo_miembro": {"nombres": "Nueva", "apellidos": "Persona", "tipo_documento": "CC",
                              "numero_documento": "1000000003", "acepta_datos": False},
            "metodo": "efectivo",
        }
        self.assertEqual(self.post_pair(self.payload).status_code, 400)
        self.assertEqual(Member.objects.count(), 2)
        self.assertEqual(Payment.objects.count(), 0)
        self.payload["participantes"][1]["nuevo_miembro"]["acepta_datos"] = True
        self.assertEqual(self.post_pair(self.payload).status_code, 201)
        self.assertEqual(Member.objects.count(), 3)

    def test_existing_pair_membership_is_immutable_and_single_flow_rejected(self):
        old = registrar_pago(self.first, self.plan, "efectivo")
        self.assertEqual(self.client.post(f"/api/payments/{old.id}/void/").status_code, 400)
        self.assertEqual(self.client.patch(
            f"/api/memberships/{old.membership_id}/start-date/",
            data=json.dumps({"fecha_inicio": self.today.isoformat()}), content_type="application/json",
        ).status_code, 400)
        response = self.client.post("/api/payments/", data=json.dumps({
            "member_id": self.second.id, "plan_id": self.plan.id, "metodo": "efectivo",
        }), content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_staff_can_register_new_pair_with_different_partner(self):
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        first_group = response.json()["grupo_pareja"]
        first_end = Membership.objects.get(pk=response.json()["pagos"][0]["membership_id"]).fecha_fin
        staff = get_user_model().objects.create_user("staff", password="password", is_staff=True)
        self.client.force_login(staff)
        self.payload["fecha_inicio"] = (first_end + timedelta(days=1)).isoformat()
        self.payload["participantes"][1] = {
            "nuevo_miembro": {
                "nombres": "Otra", "apellidos": "Persona", "tipo_documento": "CC",
                "numero_documento": "1000000003", "acepta_datos": True,
            },
            "metodo": "tarjeta",
        }
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertNotEqual(first_group, response.json()["grupo_pareja"])
        self.assertEqual(Member.objects.count(), 3)
        self.assertEqual(Payment.objects.filter(registrado_por=staff).count(), 2)

    def test_pair_plan_cannot_be_retyped_after_membership_exists(self):
        registrar_pago(self.first, self.plan, "efectivo")
        response = self.client.patch(
            f"/api/plans/{self.plan.id}/", data=json.dumps({"es_pareja": False}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.plan.refresh_from_db()
        self.assertTrue(self.plan.es_pareja)

    def test_two_new_members_created_atomically_with_consent(self):
        self.payload["participantes"] = [
            {"nuevo_miembro": {"nombres": "Pepito", "apellidos": "Pérez", "tipo_documento": "CC",
                               "numero_documento": "1000000003", "acepta_datos": True}, "metodo": "efectivo"},
            {"nuevo_miembro": {"nombres": "Josefina", "apellidos": "González", "tipo_documento": "CC",
                               "numero_documento": "1000000004", "acepta_datos": True}, "metodo": "nequi"},
        ]
        response = self.post_pair(self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Member.objects.count(), 4)
        self.assertEqual(Member.objects.filter(acepta_datos_en__isnull=False).count(), 2)
        self.assertEqual(Payment.objects.count(), 2)

    def test_historical_pair_flag_blocks_actions_even_without_group(self):
        membership = Membership.objects.create(
            member=self.first, plan=self.plan, fecha_inicio=self.today,
            fecha_fin=self.today + timedelta(days=29), es_pareja=True,
        )
        payment = Payment.objects.create(
            member=self.first, membership=membership, monto_cop=70000, metodo="efectivo",
        )
        self.assertIsNone(membership.grupo_pareja)
        self.assertEqual(self.client.post(f"/api/payments/{payment.id}/void/").status_code, 400)
        self.assertEqual(self.client.patch(
            f"/api/memberships/{membership.id}/start-date/",
            data=json.dumps({"fecha_inicio": self.today.isoformat()}), content_type="application/json",
        ).status_code, 400)
