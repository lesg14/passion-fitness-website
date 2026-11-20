from datetime import timedelta

from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.billing.models import Membership, Payment
from apps.members.models import Member


def calcular_estadisticas(hoy=None):
    hoy = hoy or timezone.localdate()
    limite = hoy + timedelta(days=3)
    miembros_activos = Member.objects.filter(archivado=False)
    operativas = Membership.objects.operativas()
    vigentes = operativas.filter(
        member__archivado=False,
        fecha_inicio__lte=hoy,
        fecha_fin__gte=hoy,
    )
    total = miembros_activos.count()
    # Activos cuya membresía más larga termina en los próximos 3 días (hoy, mañana, en 2 días o en 3 días)
    por_vencer = (
        operativas.filter(
            member__archivado=False,
            member__in=vigentes.values("member"),
            fecha_fin__gte=hoy,
        )
        .values("member")
        .annotate(fin=Max("fecha_fin"))
        .filter(fin__lte=limite)
        .count()
    )
    miembros_por_vencer = (
        operativas.filter(
            member__archivado=False,
            member__in=vigentes.values("member"),
            fecha_fin__gte=hoy,
        )
        .values("member")
        .annotate(fin=Max("fecha_fin"))
        .filter(fin__lte=limite)
        .values("member")
    )
    activos = vigentes.exclude(member__in=miembros_por_vencer).values("member").distinct().count()
    # Miembros con membresía futura (próxima a iniciar) que no tienen membresía activa hoy
    proximos = (
        operativas.filter(member__archivado=False, fecha_inicio__gt=hoy)
        .exclude(member__in=vigentes.values("member"))
        .values("member")
        .distinct()
        .count()
    )
    pagos = Payment.objects.filter(anulado=False)
    previous_month_end = hoy.replace(day=1) - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)
    previous_vigentes = operativas.filter(
        member__archivado=False,
        fecha_inicio__lte=previous_month_end,
        fecha_fin__gte=previous_month_end,
    )
    previous_active = previous_vigentes.values("member").distinct().count()
    previous_due = (
        previous_vigentes.values("member")
        .annotate(fin=Max("fecha_fin"))
        .filter(fin__lte=previous_month_end + timedelta(days=3))
        .count()
    )
    previous_total = miembros_activos.filter(fecha_registro__lte=previous_month_end).count()
    previous_income = pagos.filter(
        fecha__gte=previous_month_start, fecha__lte=previous_month_end
    ).aggregate(t=Sum("monto_cop"))["t"] or 0

    def comparison(current, previous, positive_when='up'):
        if previous == 0:
            percentage = 100 if current else 0
        else:
            percentage = round((current - previous) * 100 / previous, 1)
        direction = 'neutral' if percentage == 0 else 'up' if percentage > 0 else 'down'
        positive = direction == positive_when or direction == 'neutral'
        return {
            'porcentaje': abs(percentage),
            'direccion': direction,
            'positivo': positive,
            'anterior': previous,
        }
    desde = (hoy.replace(day=1) - timedelta(days=150)).replace(day=1)
    ingresos = (
        pagos.filter(fecha__gte=desde)
        .annotate(mes=TruncMonth("fecha"))
        .values("mes")
        .annotate(total=Sum("monto_cop"))
        .order_by("mes")
    )
    planes = operativas.values("plan__nombre").annotate(n=Count("id")).order_by("-n")[:5]
    metodos = pagos.values("metodo").annotate(total=Sum("monto_cop")).order_by("-total")
    return {
        "total": total,
        "activos": activos,
        "proximos": proximos,
        "vencidos": max(total - activos - proximos, 0),
        "por_vencer": por_vencer,
        "ingresos_mes": pagos.filter(fecha__year=hoy.year, fecha__month=hoy.month).aggregate(t=Sum("monto_cop"))["t"]
        or 0,
        "ingresos_labels": [i["mes"].strftime("%Y-%m") for i in ingresos],
        "ingresos_data": [i["total"] for i in ingresos],
        "planes_labels": [p["plan__nombre"] for p in planes],
        "planes_data": [p["n"] for p in planes],
        "metodos_labels": [m["metodo"] for m in metodos],
        "metodos_data": [m["total"] for m in metodos],
        "comparativos": {
            "miembros": comparison(total, previous_total),
            "por_vencer": comparison(por_vencer, previous_due, positive_when='down'),
            "ingresos_mes": comparison(
                pagos.filter(fecha__year=hoy.year, fecha__month=hoy.month).aggregate(t=Sum("monto_cop"))["t"] or 0,
                previous_income,
            ),
            "activos": comparison(activos, previous_active),
        },
    }

