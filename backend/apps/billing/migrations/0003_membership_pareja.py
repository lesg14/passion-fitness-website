from django.db import migrations, models


def mark_pair_memberships(apps, schema_editor):
    Membership = apps.get_model("billing", "Membership")
    Membership.objects.filter(plan__es_pareja=True).update(es_pareja=True)


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0002_membership_congelada"),
        ("plans", "0002_plan_es_pareja"),
    ]
    operations = [
        migrations.AddField(
            model_name="membership", name="es_pareja", field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="membership", name="grupo_pareja",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(mark_pair_memberships, migrations.RunPython.noop),
    ]
