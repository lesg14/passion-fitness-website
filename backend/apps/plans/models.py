from django.db import models


class Plan(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    precio_cop = models.PositiveIntegerField("precio (COP)")
    duracion_dias = models.PositiveIntegerField("duración (días)")
    activo = models.BooleanField(default=True)
    es_pareja = models.BooleanField(default=False)

    class Meta:
        ordering = ["duracion_dias", "nombre"]

    def __str__(self):
        return self.nombre
