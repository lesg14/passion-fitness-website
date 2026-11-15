from django.db import migrations


def normalize_person_name(value):
    words = value.strip().split()
    return " ".join(
        " ".join(part.capitalize() for part in word.split("-"))
        for word in words
    )


def normalize_names(apps, schema_editor):
    Member = apps.get_model("members", "Member")
    for member in Member.objects.all().iterator():
        member.nombres = normalize_person_name(member.nombres)
        member.apellidos = normalize_person_name(member.apellidos)
        member.save(update_fields=["nombres", "apellidos"])


class Migration(migrations.Migration):
    dependencies = [
        ("members", "0003_acceso_y_documento_unico"),
    ]

    operations = [
        migrations.RunPython(normalize_names, migrations.RunPython.noop),
    ]
