from getpass import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.access.services import DOOR_GROUP


class Command(BaseCommand):
    help = "Crea o actualiza la cuenta del dispositivo de la puerta (solo puede registrar ingresos)."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="puerta")

    def handle(self, *args, **options):
        password = getpass("Contraseña de la puerta: ")
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages))
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=options["username"], defaults={"is_staff": False, "is_superuser": False}
        )
        if user.is_staff or user.is_superuser:
            raise CommandError("Ese usuario ya es personal; usa un nombre de usuario distinto.")
        user.is_active = True
        user.set_password(password)
        user.save()
        user.groups.add(Group.objects.get_or_create(name=DOOR_GROUP)[0])
        self.stdout.write(self.style.SUCCESS(f"Cuenta de puerta {'creada' if created else 'actualizada'}: {user.username}"))
