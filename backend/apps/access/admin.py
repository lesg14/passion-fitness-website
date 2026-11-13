from django.contrib import admin

from .models import Asistencia, RegistroAcceso


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Asistencia)
class AsistenciaAdmin(ReadOnlyAdmin):
    list_display = ("member", "fecha", "hora_entrada", "origen")
    list_filter = ("origen", "fecha")


@admin.register(RegistroAcceso)
class RegistroAccesoAdmin(ReadOnlyAdmin):
    list_display = ("fecha_hora", "member", "resultado", "motivo", "dias_restantes")
    list_filter = ("resultado", "motivo")
