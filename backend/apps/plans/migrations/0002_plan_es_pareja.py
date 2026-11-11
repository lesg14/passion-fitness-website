from django.db import migrations, models


def mark_pair_plan(apps, schema_editor):
    Plan = apps.get_model("plans", "Plan")
    Plan.objects.filter(nombre__iexact="Pareja").update(es_pareja=True)


class Migration(migrations.Migration):
    dependencies = [("plans", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="plan", name="es_pareja", field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_pair_plan, migrations.RunPython.noop),
    ]
