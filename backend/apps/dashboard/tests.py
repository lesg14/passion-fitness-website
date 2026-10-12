from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.billing.models import registrar_pago
from apps.dashboard.views import calcular_estadisticas
from apps.members.models import Member
from apps.plans.models import Plan


class FlujoPagosTests(TestCase):
    def setUp(self):
        self.hoy = timezone.localdate()
        self.mensual = Plan.objects.create(nombre="Mensual", precio_cop=80000, duracion_dias=30)
        self.semanal = Plan.objects.create(nombre="Semanal", precio_cop=25000, duracion_dias=7)
        self.m1 = Member.objects.create(nombres="Ana", apellidos="Gómez", numero_documento="1")
        self.m2 = Member.objects.create(nombres="Luis", apellidos="Pérez", numero_documento="2")

    def test_renovacion_extiende_desde_fin_vigente(self):
        p1 = registrar_pago(self.m1, self.mensual, "efectivo", fecha=self.hoy)
        p2 = registrar_pago(self.m1, self.mensual, "nequi", fecha=self.hoy)
        self.assertEqual(p2.membership.fecha_inicio, p1.membership.fecha_fin + timedelta(days=1))

    def test_activos_vencidos_y_planes(self):
        registrar_pago(self.m1, self.mensual, "efectivo", fecha=self.hoy)
        registrar_pago(self.m2, self.semanal, "nequi", fecha=self.hoy - timedelta(days=20))
        s = calcular_estadisticas(self.hoy)
        self.assertEqual((s["activos"], s["vencidos"]), (1, 1))
        self.assertEqual(sorted(s["planes_labels"]), ["Mensual", "Semanal"])

    def test_por_vencer(self):
        registrar_pago(self.m1, self.semanal, "efectivo", fecha=self.hoy)
        registrar_pago(self.m2, self.mensual, "efectivo", fecha=self.hoy)
        self.assertEqual(calcular_estadisticas(self.hoy)["por_vencer"], 1)

    def test_django_no_sirve_el_dashboard_frontend(self):
        self.assertEqual(self.client.get("/").status_code, 404)
