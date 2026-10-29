from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
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
