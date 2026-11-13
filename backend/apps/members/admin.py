from django import forms
from django.contrib import admin

from .models import Member
from .validators import validate_birth_date, validate_document_number, validate_ten_digits


class MemberAdminForm(forms.ModelForm):
    numero_documento = forms.CharField(max_length=20, strip=False, validators=[validate_document_number])
    telefono = forms.CharField(max_length=20, required=False, strip=False, validators=[validate_ten_digits])
    fecha_nacimiento = forms.DateField(required=False, validators=[validate_birth_date])

    class Meta:
        model = Member
        fields = "__all__"


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    form = MemberAdminForm
    list_display = ("__str__", "tipo_documento", "numero_documento", "telefono", "esta_activo", "archivado")
    search_fields = ("nombres", "apellidos", "numero_documento", "telefono", "email")
    list_filter = ("tipo_documento", "archivado")
    actions = ("archivar_miembros", "restaurar_miembros")

    @admin.action(description="Archivar miembros seleccionados")
    def archivar_miembros(self, request, queryset):
        queryset.update(archivado=True)

    @admin.action(description="Restaurar miembros seleccionados")
    def restaurar_miembros(self, request, queryset):
        queryset.update(archivado=False)

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(boolean=True, description="Activo")
    def esta_activo(self, obj):
        return obj.esta_activo
