# ADR-0003: Renderizado con plantillas Django

- Estado: Reemplazada por ADR-0008
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

Antes de adoptar React, Django renderizaba el dashboard con plantillas y servía los recursos CSS y JavaScript desde `frontend/`.

## Decisión anterior

Para el dashboard Django, mantener el renderizado del lado del servidor con plantillas Django y servir los recursos estáticos desde `frontend/`.

## Motivos anteriores

Este es el flujo conectado en la configuración y enrutamiento actuales, además de estar descrito explícitamente en el README.

## Consecuencias de reemplazarla

- Esta decisión describía el dashboard antes de elegir React como interfaz.
- Las plantillas y recursos de esa implementación se retiraron.
- La decisión vigente sobre el frontend está registrada en el ADR-0008.
