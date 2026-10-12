# ADR-0005: Autenticación Django y administración interna

- Estado: Aceptada (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

El proyecto instala las aplicaciones de autenticación, sesiones y administración de Django. El dashboard está protegido con `login_required`; `LOGIN_URL` apunta a `/admin/login/`, y la ruta `/admin/` expone Django Admin.

## Decisión

Usar la autenticación integrada y Django Admin como acceso administrativo interno, y requerir inicio de sesión para el dashboard.

## Motivos

Este comportamiento está implementado directamente en la configuración, rutas y vista del dashboard. No consta si se evaluaron alternativas.

## Consecuencias

- Las cuentas de Django controlan el acceso al dashboard y al sitio administrativo.
- El flujo no representa un portal de autoservicio para miembros; el campo de usuario del miembro es opcional y se reserva para una posible capacidad futura.
- Antes de producción deben revisarse permisos, creación de cuentas y configuración de seguridad.
