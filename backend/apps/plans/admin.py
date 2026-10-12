from django.contrib import admin

from .models import Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("nombre", "precio_cop", "duracion_dias", "activo")
    list_filter = ("activo",)
