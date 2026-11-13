from django.db import transaction
from django.utils import timezone

from apps.billing.models import Membership
from apps.members.models import Member

from .models import Asistencia, RegistroAcceso

DOOR_GROUP = "Puerta"
RECEPTION_MESSAGE = "Acércate a recepción."


def _dias(n):
    return f"{n} día" if n == 1 else f"{n} días"


def evaluar_acceso(numero_documento, hoy=None):
    """Aplica la regla de acceso sin escribir en la base de datos."""
    hoy = hoy or timezone.localdate()
    member = Member.objects.filter(numero_documento=numero_documento).first()
    if member is None:
        return {
            "permitido": False, "nivel": "rojo", "member": None, "dias_restantes": None,
            "motivo": RegistroAcceso.Motivo.NO_ENCONTRADO,
            "mensaje": f"Documento no registrado. {RECEPTION_MESSAGE}",
        }

    nombre = (member.nombres.split() or [""])[0].title()
    denied = {"permitido": False, "member": member, "nombre": nombre, "dias_restantes": None}

    if member.archivado:
        return {**denied, "nivel": "rojo", "motivo": RegistroAcceso.Motivo.ARCHIVADO,
                "mensaje": f"{nombre}, tu cuenta se encuentra inactiva. {RECEPTION_MESSAGE}"}

    operativas = member.memberships.operativas()
    vigente = operativas.filter(fecha_inicio__lte=hoy, fecha_fin__gte=hoy).order_by("-fecha_fin").first()
    if vigente:
        dias = (vigente.fecha_fin - hoy).days
        if dias == 0:
            nivel, mensaje = "rojo", f"Bienvenido/a {nombre}, tu plan vence hoy."
        else:
            nivel = "naranja" if dias <= 3 else "verde"
            verbo = "falta" if dias == 1 else "faltan"
            mensaje = f"Bienvenido/a {nombre}, te {verbo} {_dias(dias)}."
        return {"permitido": True, "nivel": nivel, "member": member, "nombre": nombre,
                "dias_restantes": dias, "motivo": "", "mensaje": mensaje}

    proxima = operativas.filter(fecha_inicio__gt=hoy).order_by("fecha_inicio").first()
    if proxima:
        return {**denied, "nivel": "naranja", "motivo": RegistroAcceso.Motivo.PROXIMA,
                "mensaje": f"{nombre}, tu membresía inicia el {proxima.fecha_inicio:%d/%m/%Y}. {RECEPTION_MESSAGE}"}
    vencida = operativas.order_by("-fecha_fin").first()
    if vencida:
        return {**denied, "nivel": "rojo", "motivo": RegistroAcceso.Motivo.VENCIDA,
                "mensaje": f"{nombre}, tu membresía venció el {vencida.fecha_fin:%d/%m/%Y}. {RECEPTION_MESSAGE}"}
    if Membership.objects.filter(member=member).exists():
        return {**denied, "nivel": "rojo", "motivo": RegistroAcceso.Motivo.ANULADA,
                "mensaje": f"{nombre}, tu pago fue anulado y no tienes una membresía activa. {RECEPTION_MESSAGE}"}
    return {**denied, "nivel": "rojo", "motivo": RegistroAcceso.Motivo.SIN_MEMBRESIA,
            "mensaje": f"{nombre}, aún no tienes una membresía. {RECEPTION_MESSAGE}"}


def abrir_puerta():
    """Punto de integración con el hardware; por ahora la apertura es simulada."""
    return "abierta_simulada"


@transaction.atomic
def registrar_ingreso(numero_documento, dispositivo=""):
    ahora = timezone.now()
    resultado = evaluar_acceso(numero_documento, timezone.localdate(ahora))
    member = resultado["member"]
    RegistroAcceso.objects.create(
        member=member,
        numero_documento_digitado="" if member else numero_documento,
        fecha_hora=ahora,
        resultado=RegistroAcceso.Resultado.PERMITIDO if resultado["permitido"] else RegistroAcceso.Resultado.DENEGADO,
        motivo=resultado["motivo"],
        dias_restantes=resultado["dias_restantes"],
        dispositivo=dispositivo[:150],
    )
    if resultado["permitido"]:
        Asistencia.objects.get_or_create(
            member=member,
            fecha=timezone.localdate(ahora),
            defaults={"hora_entrada": ahora, "origen": Asistencia.Origen.PUERTA},
        )
        resultado["puerta"] = abrir_puerta()
    else:
        resultado["puerta"] = "cerrada"
    return resultado
