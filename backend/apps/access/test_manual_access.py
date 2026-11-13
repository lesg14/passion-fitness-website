from datetime import datetime, timedelta, timezone as utc_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import Membership, Payment
from apps.members.models import Member
from apps.plans.models import Plan

from .models import Asistencia, RegistroAcceso
from .services import DOOR_GROUP

MANUAL = "/api/access/manual/"
LOG = "/api/access/today/"


class ManualAccessTests(TestCase):
    def setUp(self):
        user = get_user_model()
        self.staff = user.objects.create_user("recepcion", password="test-pass", is_staff=True)
        self.admin = user.objects.create_superuser("admin", password="test-pass")
        self.door = user.objects.create_user("puerta", password="test-pass")
        self.door.groups.add(Group.objects.create(name=DOOR_GROUP))
        self.normal = user.objects.create_user("normal", password="test-pass")
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.plan = Plan.objects.create(nombre="Mensual", precio_cop=70000, duracion_dias=30)
        self.today = timezone.localdate()

    def member(self, document, start=-5, end=20, archived=False, voided=False):
        member = Member.objects.create(nombres="Ana", apellidos="Gómez", numero_documento=document, archivado=archived)
        if end is not None:
            membership = Membership.objects.create(
                member=member, plan=self.plan, fecha_inicio=self.today + timedelta(days=start),
                fecha_fin=self.today + timedelta(days=end),
            )
            Payment.objects.create(member=member, membership=membership, monto_cop=70000, anulado=voided)
        return member

    def test_allowed_reentry_audit_and_no_door_or_billing_changes(self):
        member = self.member("123")
        membership = member.memberships.get()
        original_dates = (membership.fecha_inicio, membership.fecha_fin)
        with patch("apps.access.services.abrir_puerta") as door:
            first = self.client.post(MANUAL, {"member_id": member.pk}, format="json")
            second = self.client.post(MANUAL, {"member_id": member.pk}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json()["permitido"])
        self.assertTrue(first.json()["asistencia_creada"])
        self.assertFalse(second.json()["asistencia_creada"])
        door.assert_not_called()
        attendance = Asistencia.objects.get()
        self.assertEqual((attendance.origen, attendance.registrado_por), ("manual", self.staff))
        self.assertEqual(RegistroAcceso.objects.count(), 2)
        self.assertEqual(RegistroAcceso.objects.filter(
            origen="manual", registrado_por=self.staff, usuario_registro="recepcion"
        ).count(), 2)
        membership.refresh_from_db()
        self.assertEqual((membership.fecha_inicio, membership.fecha_fin), original_dates)
        self.assertEqual(Payment.objects.count(), 1)

    def test_denied_cases_are_logged_without_attendance(self):
        cases = [
            ("1", -40, -10, False, "vencida"),
            ("2", 5, 35, False, "proxima"),
            ("3", 0, None, False, "sin_membresia"),
            ("4", -5, 20, True, "anulada"),
        ]
        for document, start, end, voided, reason in cases:
            with self.subTest(reason=reason):
                member = self.member(document, start, end, voided=voided)
                response = self.client.post(MANUAL, {"member_id": member.pk}, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()["permitido"])
                self.assertIn("recepción", response.json()["mensaje"])
                self.assertEqual(RegistroAcceso.objects.get(member=member).motivo, reason)
        self.assertFalse(Asistencia.objects.exists())

    def test_archived_member_hidden_from_staff_but_denied_and_audited_for_admin(self):
        member = self.member("9", archived=True)
        self.assertEqual(self.client.post(MANUAL, {"member_id": member.pk}, format="json").status_code, 400)
        self.client.force_authenticate(self.admin)
        response = self.client.post(MANUAL, {"member_id": member.pk}, format="json")
        self.assertFalse(response.json()["permitido"])
        self.assertEqual(RegistroAcceso.objects.get().motivo, "archivado")
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(LOG).json(), [])
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get(LOG).json()), 1)

    def test_permissions_and_invalid_input(self):
        member = self.member("123")
        for user in (None, self.door, self.normal):
            self.client.force_authenticate(user)
            self.assertIn(self.client.post(MANUAL, {"member_id": member.pk}, format="json").status_code, (401, 403))
            self.assertIn(self.client.get(LOG).status_code, (401, 403))
        self.client.force_authenticate(self.staff)
        for data in ({}, {"member_id": 999999}, {"member_id": "abc"}):
            self.assertEqual(self.client.post(MANUAL, data, format="json").status_code, 400)
        self.assertEqual(self.client.get(LOG, {"fecha": "invalid"}).status_code, 400)
        self.assertFalse(RegistroAcceso.objects.exists())

    def test_staff_account_in_door_group_cannot_use_reception_endpoints(self):
        self.door.is_staff = True
        self.door.save()
        self.client.force_authenticate(self.door)
        self.assertEqual(self.client.get(LOG).status_code, 403)
        self.assertEqual(self.client.post(MANUAL, {"member_id": 1}, format="json").status_code, 403)

    def test_kiosk_and_manual_share_the_same_daily_attendance(self):
        member = self.member("123")
        self.client.force_authenticate(self.door)
        self.assertTrue(self.client.post(
            "/api/access/check-in/", {"numero_documento": "123"}, format="json"
        ).json()["permitido"])
        self.client.force_authenticate(self.staff)
        result = self.client.post(MANUAL, {"member_id": member.pk}, format="json").json()
        self.assertTrue(result["permitido"])
        self.assertFalse(result["asistencia_creada"])
        self.assertEqual(Asistencia.objects.get().origen, "puerta")
        self.assertEqual(RegistroAcceso.objects.count(), 2)

    def test_expiring_today_is_allowed(self):
        member = self.member("123", end=0)
        result = self.client.post(MANUAL, {"member_id": member.pk}, format="json").json()
        self.assertTrue(result["permitido"])
        self.assertEqual(result["dias_restantes"], 0)
        self.assertIn("vence hoy", result["mensaje"])

    def test_username_snapshot_survives_user_deletion(self):
        member = self.member("123")
        self.client.post(MANUAL, {"member_id": member.pk}, format="json")
        self.staff.delete()
        entry = RegistroAcceso.objects.get()
        self.assertIsNone(entry.registrado_por)
        self.assertEqual(entry.usuario_registro, "recepcion")

    def test_date_filter_uses_bogota_and_legacy_door_records(self):
        member = self.member("123")
        # 04:30 UTC is still the previous calendar day in Colombia.
        entry = RegistroAcceso.objects.create(
            member=member, fecha_hora=datetime(2025, 1, 2, 4, 30, tzinfo=utc_timezone.utc),
            resultado=RegistroAcceso.Resultado.PERMITIDO, dispositivo="puerta",
        )
        rows = self.client.get(LOG, {"fecha": "2025-01-01"}).json()
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["id"], rows[0]["hora"], rows[0]["origen"]), (entry.pk, "23:30", "puerta"))
        self.assertEqual(rows[0]["registrado_por"], "")
        self.assertEqual(self.client.get(LOG, {"fecha": "2025-01-02"}).json(), [])

    def test_session_authentication_requires_csrf(self):
        member = self.member("123")
        client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(client.login(username="recepcion", password="test-pass"))
        self.assertEqual(client.post(MANUAL, {"member_id": member.pk}, format="json").status_code, 403)
        self.assertFalse(RegistroAcceso.objects.exists())
