from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class Membership(models.Model):
    member = models.ForeignKey("members.Member", on_delete=models.PROTECT, related_name="memberships")
    plan = models.ForeignKey("plans.Plan", on_delete=models.PROTECT, related_name="memberships")
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()

    class Meta:
        ordering = ["-fecha_fin"]

    def __str__(self):
        return f"{self.member} - {self.plan} ({self.fecha_inicio} a {self.fecha_fin})"

    @property
    def esta_vigente(self):
        hoy = timezone.localdate()
        return self.fecha_inicio <= hoy <= self.fecha_fin


class Payment(models.Model):
    class Metodo(models.TextChoices):
        EFECTIVO = "efectivo", "Efectivo"
        NEQUI = "nequi", "Nequi"
        DAVIPLATA = "daviplata", "Daviplata"
        TRANSFERENCIA = "transferencia", "Transferencia / PSE"
        TARJETA = "tarjeta", "Tarjeta"

    member = models.ForeignKey("members.Member", on_delete=models.PROTECT, related_name="payments")
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="payments")
    monto_cop = models.PositiveIntegerField("monto (COP)")
    metodo = models.CharField(max_length=20, choices=Metodo.choices, default=Metodo.EFECTIVO)
    fecha = models.DateField(default=timezone.localdate)
    referencia = models.CharField(max_length=100, blank=True)
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    # Los pagos no se borran: se anulan para conservar la auditoría
    anulado = models.BooleanField(default=False)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.member} - ${self.monto_cop:,} ({self.fecha})"


@transaction.atomic
def registrar_pago(member, plan, metodo, monto_cop=None, fecha=None, referencia="", usuario=None, fecha_inicio=None):
    """Registra un pago y crea la membresía. Si se especifica fecha_inicio se usa; de lo contrario inicia al terminar la última vigente."""
    fecha = fecha or timezone.localdate()
    if fecha_inicio:
        inicio = fecha_inicio
    else:
        ultima = member.memberships.filter(fecha_fin__gte=fecha).order_by("-fecha_fin").first()
        inicio = ultima.fecha_fin + timedelta(days=1) if ultima else fecha
    membership = Membership.objects.create(
        member=member, plan=plan, fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=plan.duracion_dias - 1)
    )
    return Payment.objects.create(
        member=member,
        membership=membership,
        monto_cop=plan.precio_cop if monto_cop is None else monto_cop,
        metodo=metodo,
        fecha=fecha,
        referencia=referencia,
        registrado_por=usuario,
    )
