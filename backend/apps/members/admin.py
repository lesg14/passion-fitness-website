from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("__str__", "tipo_documento", "numero_documento", "telefono", "esta_activo")
    search_fields = ("nombres", "apellidos", "numero_documento", "telefono", "email")
    list_filter = ("tipo_documento",)

    @admin.display(boolean=True, description="Activo")
    def esta_activo(self, obj):
        return obj.esta_activo
