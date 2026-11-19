import hashlib
import hmac
import json
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _setting(name):
    value = getattr(settings, name, "")
    if not value:
        raise ImproperlyConfigured(f"Configura {name} para usar los pagos Wompi.")
    return value


def checkout_url(*, reference, amount_cop, email, full_name, phone, redirect_url=None):
    amount_in_cents = amount_cop * 100
    integrity_secret = _setting("WOMPI_INTEGRITY_SECRET")
    integrity = hashlib.sha256(
        f"{reference}{amount_in_cents}COP{integrity_secret}".encode()
    ).hexdigest()
    redirect_url = redirect_url or _setting("WOMPI_REDIRECT_URL")
    query = {
        "public-key": _setting("WOMPI_PUBLIC_KEY"),
        "currency": "COP",
        "amount-in-cents": amount_in_cents,
        "reference": reference,
        "signature:integrity": integrity,
        "redirect-url": redirect_url,
        "customer-data:email": email,
        "customer-data:full-name": full_name,
        "customer-data:phone-number": phone,
    }
    return f"{getattr(settings, 'WOMPI_CHECKOUT_URL', 'https://checkout.wompi.co/p/')}?{urlencode(query)}"


def verify_event(event):
    secret = _setting("WOMPI_EVENTS_SECRET")
    signature = event.get("signature") or {}
    properties = signature.get("properties") or []
    data = event.get("data") or {}
    transaction = data.get("transaction") or {}

    values = []
    for property_path in properties:
        current = data
        for part in property_path.split("."):
            if not isinstance(current, dict) or part not in current:
                return False
            current = current[part]
        values.append(str(current))
    values.extend([str(event.get("timestamp", "")), secret])
    expected = hashlib.sha256("".join(values).encode()).hexdigest().upper()
    checksum = str(signature.get("checksum") or "").upper()
    return bool(transaction and checksum and hmac.compare_digest(expected, checksum))


def serializable_event(event):
    try:
        json.dumps(event)
    except (TypeError, ValueError):
        return {}
    return event
