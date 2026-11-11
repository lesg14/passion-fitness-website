from django import forms
from django.contrib import admin

from .models import Membership, Payment


class MembershipAdminForm(forms.ModelForm):
    class Meta:
        model = Membership
        fields = "__all__"

    def clean_plan(self):
        plan = self.cleaned_data["plan"]
        if plan.es_pareja and (not self.instance.pk or not self.instance.es_pareja):
            raise forms.ValidationError("Los planes de pareja se registran con ambos participantes.")
        return plan


class PaymentAdminForm(forms.ModelForm):
    class Meta:
        model = Payment
        fields = "__all__"

    def clean_membership(self):
        membership = self.cleaned_data["membership"]
        if membership.es_pareja:
            raise forms.ValidationError("Los pagos de pareja se registran con ambos participantes.")
        return membership


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    form = MembershipAdminForm
    list_display = ("member", "plan", "fecha_inicio", "fecha_fin", "congelada", "esta_vigente")
    list_filter = ("plan",)
    search_fields = ("member__nombres", "member__apellidos", "member__numero_documento")
    autocomplete_fields = ("member",)
    readonly_fields = ("congelada",)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.es_pareja:
            return self.readonly_fields + ("fecha_inicio", "fecha_fin", "member", "plan", "es_pareja", "grupo_pareja")
        return self.readonly_fields + ("es_pareja", "grupo_pareja")

    @admin.display(boolean=True, description="Vigente")
    def esta_vigente(self, obj):
        return obj.esta_vigente


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    form = PaymentAdminForm
    list_display = ("fecha", "member", "monto_cop", "metodo", "anulado")
    list_filter = ("metodo", "anulado", "fecha")
    search_fields = ("member__nombres", "member__apellidos", "member__numero_documento", "referencia")
    autocomplete_fields = ("member",)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.membership.es_pareja:
            return ("anulado", "membership", "member")
        return ()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            obj.registrado_por = request.user
        super().save_model(request, obj, form, change)
