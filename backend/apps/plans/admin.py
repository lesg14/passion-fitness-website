from django.contrib import admin

from .models import Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("nombre", "precio_cop", "duracion_dias", "activo", "es_pareja")
    list_filter = ("activo",)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.memberships.exists():
            return ("es_pareja",)
        return ()
