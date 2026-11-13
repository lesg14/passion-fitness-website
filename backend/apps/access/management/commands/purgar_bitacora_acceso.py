from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.access.models import RegistroAcceso

RETENCION_DIAS = 365


class Command(BaseCommand):
    help = "Elimina registros de la bitácora de acceso con más de 12 meses. Las asistencias no se tocan."

    def handle(self, *args, **options):
        limite = timezone.now() - timedelta(days=RETENCION_DIAS)
        deleted, _ = RegistroAcceso.objects.filter(fecha_hora__lt=limite).delete()
        self.stdout.write(f"Registros eliminados: {deleted}")
