from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.access.services import DOOR_GROUP
from apps.members.models import Member


class Command(BaseCommand):
    help = (
        "Crea o actualiza las cuentas del portal de miembros usando el número "
        "de identificación como usuario y contraseña de pruebas."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra las cuentas que se crearían sin modificar la base de datos.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        members = Member.objects.select_related("user").order_by("pk")
        created_count = 0
        updated_count = 0

        for member in members:
            username = member.numero_documento
            existing = User.objects.filter(username__iexact=username).first()
            user = member.user

            if existing and user and existing.pk != user.pk:
                raise CommandError(
                    f"El documento {username} ya pertenece a otro usuario y no se puede vincular."
                )
            if existing and not user:
                user = existing
            if user and (user.is_staff or user.is_superuser or user.groups.filter(name=DOOR_GROUP).exists()):
                raise CommandError(
                    f"El usuario {user.username} ya es una cuenta administrativa o de puerta."
                )

            if user and user.username.casefold() != username.casefold():
                username_owner = User.objects.filter(username__iexact=username).exclude(pk=user.pk).first()
                if username_owner:
                    raise CommandError(
                        f"No se puede cambiar el usuario de {user.username}: "
                        f"{username} ya está en uso."
                    )

            if options["dry_run"]:
                action = "actualizaría" if user else "crearía"
                self.stdout.write(f"{action}: {member} -> {username}")
                continue

            with transaction.atomic():
                if user is None:
                    user = User(username=username)
                    created_count += 1
                else:
                    updated_count += 1
                    user.username = username
                user.first_name = member.nombres
                user.last_name = member.apellidos
                user.email = member.email
                user.is_active = True
                user.is_staff = False
                user.is_superuser = False
                user.set_password(member.numero_documento)
                user.save()
                member.user = user
                member.save(update_fields=["user"])
            self.stdout.write(f"Cuenta preparada: {member} -> {username}")

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Simulación completada; no se modificó la base de datos."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Credenciales preparadas: {created_count} creadas, {updated_count} actualizadas."
                )
            )
