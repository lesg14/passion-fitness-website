from django.contrib import admin

from .models import Membership, Payment


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("member", "plan", "fecha_inicio", "fecha_fin", "esta_vigente")
    list_filter = ("plan",)
    search_fields = ("member__nombres", "member__apellidos", "member__numero_documento")
    autocomplete_fields = ("member",)

    @admin.display(boolean=True, description="Vigente")
    def esta_vigente(self, obj):
        return obj.esta_vigente


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("fecha", "member", "monto_cop", "metodo", "anulado")
    list_filter = ("metodo", "anulado", "fecha")
    search_fields = ("member__nombres", "member__apellidos", "member__numero_documento", "referencia")
    autocomplete_fields = ("member",)

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            obj.registrado_por = request.user
        super().save_model(request, obj, form, change)
