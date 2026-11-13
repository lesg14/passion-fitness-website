from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .admin import MemberAdminForm
from .models import Member


class MemberAdminValidationTests(TestCase):
    def test_member_form_validates_birth_date_and_numbers(self):
        today = timezone.localdate()
        data = {
            "nombres": "Ana",
            "apellidos": "Gómez",
            "tipo_documento": "CC",
            "numero_documento": "0123456789",
            "telefono": "",
            "fecha_nacimiento": today.isoformat(),
            "fecha_registro": today.isoformat(),
        }
        form = MemberAdminForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        form = MemberAdminForm(data={**data, "numero_documento": "12345678"})
        self.assertTrue(form.is_valid(), form.errors)
        for field, value in (
            ("numero_documento", "123456789a"),
            ("numero_documento", "12345678901"),
            ("telefono", "123-567890"),
            ("fecha_nacimiento", (today + timedelta(days=1)).isoformat()),
        ):
            with self.subTest(field=field):
                form = MemberAdminForm(data={**data, field: value})
                self.assertFalse(form.is_valid())
                self.assertIn(field, form.errors)

    def test_member_form_validates_optional_email(self):
        data = {
            "nombres": "Ana", "apellidos": "Gómez", "tipo_documento": "CC",
            "numero_documento": "0123456789", "fecha_registro": timezone.localdate().isoformat(),
        }
        for email in ("", "ana@example.com"):
            form = MemberAdminForm(data={**data, "email": email})
            self.assertTrue(form.is_valid(), form.errors)
        form = MemberAdminForm(data={**data, "email": "correo-invalido"})
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)


class DocumentoUnicoTests(TestCase):
    def test_numero_documento_is_unique_regardless_of_type(self):
        Member.objects.create(nombres='Ana', apellidos='Gomez', tipo_documento='CC', numero_documento='1234567890')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Member.objects.create(nombres='Luis', apellidos='Diaz', tipo_documento='CE', numero_documento='1234567890')
