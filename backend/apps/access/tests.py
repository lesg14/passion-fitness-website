from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import Membership, Payment
from apps.members.models import Member
from apps.plans.models import Plan

from .models import Asistencia, RegistroAcceso
from .services import DOOR_GROUP

URL = "/api/access/check-in/"


class CheckInTests(TestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.door = User.objects.create_user("puerta", password="Clave-Segura-123")
        self.door.groups.add(Group.objects.create(name=DOOR_GROUP))
        self.client = APIClient()
        self.client.force_authenticate(self.door)
        self.plan = Plan.objects.create(nombre="Mensual", precio_cop=70000, duracion_dias=30)
        self.today = timezone.localdate()

    def member(self, documento="1234567890", nombres="ana maria", dias_inicio=-5, dias_fin=20, **kwargs):
        member = Member.objects.create(nombres=nombres, apellidos="Gómez", numero_documento=documento, **kwargs)
        if dias_fin is not None:
            membership = Membership.objects.create(
                member=member, plan=self.plan,
                fecha_inicio=self.today + timedelta(days=dias_inicio),
                fecha_fin=self.today + timedelta(days=dias_fin),
            )
            Payment.objects.create(member=member, membership=membership, monto_cop=70000)
        return member

    def check(self, documento="1234567890"):
        return self.client.post(URL, {"numero_documento": documento}, format="json")

    def test_green_when_more_than_three_days_left(self):
        self.member(dias_fin=25)
        data = self.check().json()
        self.assertTrue(data["permitido"])
        self.assertEqual(data["nivel"], "verde")
        self.assertEqual(data["mensaje"], "Bienvenido/a Ana, te faltan 25 días.")
        self.assertEqual(data["puerta"], "abierta_simulada")

    def test_orange_for_three_two_and_one_days(self):
        for dias, texto in ((3, "faltan 3 días"), (2, "faltan 2 días"), (1, "falta 1 día")):
            with self.subTest(dias=dias):
                member = self.member(documento=f"10000000{dias:02d}", dias_fin=dias)
                data = self.check(member.numero_documento).json()
                self.assertTrue(data["permitido"])
                self.assertEqual(data["nivel"], "naranja")
                self.assertIn(texto, data["mensaje"])

    def test_red_when_it_expires_today(self):
        self.member(dias_fin=0)
        data = self.check().json()
        self.assertTrue(data["permitido"])
        self.assertEqual(data["nivel"], "rojo")
        self.assertIn("vence hoy", data["mensaje"])

    def test_denied_cases_explain_and_refer_to_reception(self):
        cases = {
            "vencida": dict(dias_inicio=-40, dias_fin=-10),
            "proxima": dict(dias_inicio=5, dias_fin=35),
            "sin_membresia": dict(dias_fin=None),
            "archivado": dict(archivado=True),
        }
        for index, (motivo, kwargs) in enumerate(cases.items()):
            with self.subTest(motivo=motivo):
                member = self.member(documento=f"200000000{index}", **kwargs)
                data = self.check(member.numero_documento).json()
                self.assertFalse(data["permitido"])
                self.assertEqual(data["puerta"], "cerrada")
                self.assertIn("recepción", data["mensaje"])
                self.assertTrue(RegistroAcceso.objects.filter(member=member, motivo=motivo).exists())
        self.assertFalse(Asistencia.objects.exists())

    def test_voided_payment_denies_access(self):
        member = self.member()
        Payment.objects.filter(member=member).update(anulado=True)
        data = self.check().json()
        self.assertFalse(data["permitido"])
        self.assertEqual(RegistroAcceso.objects.get().motivo, "anulada")

    def test_unknown_document_is_denied_and_logged(self):
        data = self.check("9999999999").json()
        self.assertFalse(data["permitido"])
        self.assertEqual(data["nivel"], "rojo")
        registro = RegistroAcceso.objects.get()
        self.assertIsNone(registro.member)
        self.assertEqual(registro.numero_documento_digitado, "9999999999")

    def test_reentry_keeps_one_attendance_and_two_log_entries(self):
        self.member()
        self.check()
        self.check()
        self.assertEqual(Asistencia.objects.count(), 1)
        self.assertEqual(RegistroAcceso.objects.count(), 2)

    def test_frozen_membership_uses_extended_end_date(self):
        member = self.member(dias_fin=0)
        Membership.objects.filter(member=member).update(
            fecha_fin=self.today + timedelta(days=5), congelada=True
        )
        self.assertEqual(self.check().json()["dias_restantes"], 5)

    def test_invalid_documents_are_rejected(self):
        for value in ("12345678901", "12345abcde", "123-456789", "", " 123"):
            with self.subTest(value=value):
                self.assertEqual(self.check(value).status_code, 400)
        self.assertFalse(RegistroAcceso.objects.exists())

    def test_documents_shorter_than_ten_digits_are_accepted(self):
        self.member(documento="12345678")
        self.assertTrue(self.check("12345678").json()["permitido"])

    def test_repeated_unknown_documents_lock_the_device(self):
        for index in range(5):
            self.assertEqual(self.check(f"900000000{index}").status_code, 200)
        self.assertEqual(self.check("9000000009").status_code, 429)

    def test_rate_limit(self):
        self.member()
        statuses = [self.check().status_code for _ in range(12)]
        self.assertEqual(statuses[:10], [200] * 10)
        self.assertIn(429, statuses[10:])

    def test_other_accounts_cannot_use_the_door_or_staff_endpoints(self):
        User = get_user_model()
        client = APIClient()
        self.assertIn(client.post(URL, {"numero_documento": "1234567890"}, format="json").status_code, (401, 403))
        staff = User.objects.create_user("recep", password="x", is_staff=True)
        client.force_authenticate(staff)
        self.assertEqual(client.post(URL, {"numero_documento": "1234567890"}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/members/").status_code, 403)
        self.assertEqual(self.client.get("/api/payments/").status_code, 403)
        self.assertEqual(self.client.get("/api/access/today/").status_code, 403)

    def test_reception_lists_today_entries(self):
        self.member()
        self.check()
        User = get_user_model()
        client = APIClient()
        client.force_authenticate(User.objects.create_user("recep", password="x", is_staff=True))
        rows = client.get("/api/access/today/").json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["resultado"], "permitido")


class DoorLoginTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.door = User.objects.create_user("puerta", password="Clave-Segura-123")
        self.door.groups.add(Group.objects.create(name=DOOR_GROUP))
        User.objects.create_user("recep", password="Clave-Segura-123", is_staff=True)
        self.client = APIClient()

    def login(self, username, role):
        return self.client.post(
            "/api/auth/login/", {"username": username, "password": "Clave-Segura-123", "role": role}, format="json"
        )

    def test_door_account_logs_in_only_as_door(self):
        self.assertEqual(self.login("puerta", "staff").status_code, 403)
        response = self.login("puerta", "door")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "door")
        self.assertEqual(self.client.get("/api/auth/session/").json()["role"], "door")
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)

    def test_staff_cannot_log_in_as_door(self):
        self.assertEqual(self.login("recep", "door").status_code, 403)
