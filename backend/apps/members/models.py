from django.conf import settings
from django.db import models
from django.utils import timezone


class Member(models.Model):
    class TipoDocumento(models.TextChoices):
        CC = "CC", "Cédula de ciudadanía"
        CE = "CE", "Cédula de extranjería"
        TI = "TI", "Tarjeta de identidad"
        PAS = "PAS", "Pasaporte"

    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    tipo_documento = models.CharField(max_length=3, choices=TipoDocumento.choices, default=TipoDocumento.CC)
    numero_documento = models.CharField(max_length=20)
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    fecha_registro = models.DateField(default=timezone.localdate)
    # Habeas Data (Ley 1581 de 2012)
    acepta_datos_en = models.DateTimeField("autorización de datos", null=True, blank=True)
    # Se enlaza cuando se habilite el portal del cliente
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="member"
    )

    class Meta:
        ordering = ["apellidos", "nombres"]
        constraints = [
            models.UniqueConstraint(fields=["tipo_documento", "numero_documento"], name="documento_unico")
        ]

    def __str__(self):
        return f"{self.nombres} {self.apellidos}"

    @property
    def membresia_vigente(self):
        hoy = timezone.localdate()
        return (
            self.memberships.filter(fecha_inicio__lte=hoy, fecha_fin__gte=hoy).order_by("-fecha_fin").first()
        )

    @property
    def esta_activo(self):
        return self.membresia_vigente is not None
