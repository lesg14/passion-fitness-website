from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("members", "0004_normalize_member_names"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RenewalContact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("canal", models.CharField(choices=[("llamada", "Llamada"), ("whatsapp", "WhatsApp"), ("mensaje", "Mensaje")], max_length=20)),
                ("nota", models.CharField(blank=True, max_length=500)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("member", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="renewal_contacts", to="members.member")),
                ("registrado_por", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-creado_en", "-id"]},
        ),
    ]
