from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from .admin import MemberAdminForm


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
        for field, value in (
            ("numero_documento", "123456789a"),
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
