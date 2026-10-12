from datetime import timedelta

from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.billing.models import Membership, Payment
from apps.members.models import Member


def calcular_estadisticas(hoy=None):
    hoy = hoy or timezone.localdate()
    limite = hoy + timedelta(days=3)
    vigentes = Membership.objects.filter(fecha_inicio__lte=hoy, fecha_fin__gte=hoy)
    total = Member.objects.count()
    activos = vigentes.values("member").distinct().count()
    # Activos cuya membresía más larga termina en los próximos 3 días (hoy, mañana, en 2 días o en 3 días)
    por_vencer = (
        Membership.objects.filter(member__in=vigentes.values("member"), fecha_fin__gte=hoy)
        .values("member")
        .annotate(fin=Max("fecha_fin"))
        .filter(fin__lte=limite)
        .count()
    )
    pagos = Payment.objects.filter(anulado=False)
    desde = (hoy.replace(day=1) - timedelta(days=150)).replace(day=1)
    ingresos = (
        pagos.filter(fecha__gte=desde)
        .annotate(mes=TruncMonth("fecha"))
        .values("mes")
        .annotate(total=Sum("monto_cop"))
        .order_by("mes")
    )
    planes = Membership.objects.values("plan__nombre").annotate(n=Count("id")).order_by("-n")[:5]
    metodos = pagos.values("metodo").annotate(total=Sum("monto_cop")).order_by("-total")
    return {
        "total": total,
        "activos": activos,
        "vencidos": total - activos,
        "por_vencer": por_vencer,
        "ingresos_mes": pagos.filter(fecha__year=hoy.year, fecha__month=hoy.month).aggregate(t=Sum("monto_cop"))["t"]
        or 0,
        "ingresos_labels": [i["mes"].strftime("%Y-%m") for i in ingresos],
        "ingresos_data": [i["total"] for i in ingresos],
        "planes_labels": [p["plan__nombre"] for p in planes],
        "planes_data": [p["n"] for p in planes],
        "metodos_labels": [m["metodo"] for m in metodos],
        "metodos_data": [m["total"] for m in metodos],
    }


