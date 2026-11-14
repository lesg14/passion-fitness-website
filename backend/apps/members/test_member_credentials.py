from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.members.models import Member


class MemberCredentialsCommandTests(TestCase):
    def test_creates_linked_member_accounts_with_document_credentials(self):
        member = Member.objects.create(
            nombres="Ana", apellidos="Gómez", numero_documento="12345678", email="ana@example.com"
        )
        call_command("crear_credenciales_miembros", stdout=StringIO())
        member.refresh_from_db()
        self.assertIsNotNone(member.user)
        self.assertEqual(member.user.username, "12345678")
        self.assertTrue(member.user.check_password("12345678"))
        self.assertFalse(member.user.is_staff)
        self.assertFalse(member.user.is_superuser)
        self.assertEqual(member.user.email, "ana@example.com")

    def test_is_idempotent_and_resets_existing_member_password(self):
        user = get_user_model().objects.create_user("old-user", password="old-password")
        member = Member.objects.create(nombres="Ana", apellidos="Gómez", numero_documento="987654", user=user)
        call_command("crear_credenciales_miembros", stdout=StringIO())
        call_command("crear_credenciales_miembros", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.username, "987654")
        self.assertTrue(user.check_password("987654"))
        self.assertEqual(get_user_model().objects.filter(username="987654").count(), 1)

    def test_refuses_to_take_over_staff_user(self):
        get_user_model().objects.create_user("555", password="secret", is_staff=True)
        Member.objects.create(nombres="Ana", apellidos="Gómez", numero_documento="555")
        with self.assertRaises(CommandError):
            call_command("crear_credenciales_miembros", stdout=StringIO())
