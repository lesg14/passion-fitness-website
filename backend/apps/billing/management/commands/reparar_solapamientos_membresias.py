from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Prefetch

from apps.billing.models import Membership, Payment
from apps.members.models import Member


class Command(BaseCommand):
    help = (
        'Detecta solapamientos entre membresías operativas y, con --apply, '
        'las encadena según el orden de registro.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Guarda las fechas corregidas. Sin esta opción solo muestra el reporte.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']
        payments = Payment.objects.filter(anulado=False).order_by('fecha', 'id')
        total = 0
        changed = 0

        for member in Member.objects.order_by('id'):
            memberships = list(
                member.memberships.operativas()
                .prefetch_related(
                    Prefetch('payments', queryset=payments, to_attr='valid_payments')
                )
            )
            memberships.sort(key=self._registration_key)
            previous_end = None

            for membership in memberships:
                total += 1
                original_start = membership.fecha_inicio
                original_end = membership.fecha_fin
                if previous_end is not None and membership.fecha_inicio <= previous_end:
                    membership.fecha_inicio = previous_end + timedelta(days=1)
                    membership.fecha_fin = membership.fecha_inicio + (
                        original_end - original_start
                    )
                    changed += 1
                    action = 'Corregida' if apply_changes else 'Detectada'
                    self.stdout.write(
                        f'{action}: miembro {member.id}, membresía {membership.id}, '
                        f'{original_start}–{original_end} -> '
                        f'{membership.fecha_inicio}–{membership.fecha_fin}'
                    )
                    if apply_changes:
                        membership.save(update_fields=['fecha_inicio', 'fecha_fin'])
                previous_end = max(previous_end or membership.fecha_fin, membership.fecha_fin)

        mode = 'aplicadas' if apply_changes else 'detectadas (sin cambios)'
        self.stdout.write(
            self.style.SUCCESS(
                f'Solapamientos {mode}: {changed}. Membresías revisadas: {total}.'
            )
        )

    @staticmethod
    def _registration_key(membership):
        payment = membership.valid_payments[0] if membership.valid_payments else None
        return (
            payment.fecha if payment else membership.fecha_inicio,
            payment.id if payment else membership.id,
            membership.id,
        )
