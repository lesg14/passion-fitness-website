from django.db import models
from django.utils import timezone


class Asistencia(models.Model):
    class Origen(models.TextChoices):
        PUERTA = "puerta", "Puerta"
        MANUAL = "manual", "Manual"

    member = models.ForeignKey("members.Member", on_delete=models.PROTECT, related_name="asistencias")
    fecha = models.DateField(default=timezone.localdate)
    hora_entrada = models.DateTimeField(default=timezone.now)
    origen = models.CharField(max_length=10, choices=Origen.choices, default=Origen.PUERTA)

    class Meta:
        ordering = ["-fecha", "-hora_entrada"]
        verbose_name_plural = "asistencias"
        constraints = [models.UniqueConstraint(fields=["member", "fecha"], name="asistencia_unica_por_dia")]

    def __str__(self):
        return f"{self.member} - {self.fecha}"


class RegistroAcceso(models.Model):
    class Resultado(models.TextChoices):
        PERMITIDO = "permitido", "Permitido"
        DENEGADO = "denegado", "Denegado"

    class Motivo(models.TextChoices):
        NO_ENCONTRADO = "no_encontrado", "Documento no registrado"
        ARCHIVADO = "archivado", "Miembro archivado"
        SIN_MEMBRESIA = "sin_membresia", "Sin membresía"
        PROXIMA = "proxima", "Membresía aún no inicia"
        VENCIDA = "vencida", "Membresía vencida"
        ANULADA = "anulada", "Pago anulado"

    member = models.ForeignKey(
        "members.Member", null=True, blank=True, on_delete=models.PROTECT, related_name="registros_acceso"
    )
    # Solo se conserva cuando no corresponde a ningún miembro
    numero_documento_digitado = models.CharField(max_length=20, blank=True)
    fecha_hora = models.DateTimeField(default=timezone.now, db_index=True)
    resultado = models.CharField(max_length=10, choices=Resultado.choices)
    motivo = models.CharField(max_length=20, choices=Motivo.choices, blank=True)
    dias_restantes = models.IntegerField(null=True, blank=True)
    dispositivo = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name_plural = "registros de acceso"

    def __str__(self):
        return f"{self.fecha_hora:%Y-%m-%d %H:%M} {self.resultado}"
