from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.utils import timezone


validate_ten_digits = RegexValidator(
    regex=r"\A[0-9]{10}\Z",
    message="Debe contener exactamente 10 dígitos, sin letras ni caracteres especiales.",
)


def validate_birth_date(value):
    if value > timezone.localdate():
        raise ValidationError("La fecha de nacimiento no puede ser posterior a hoy.")
