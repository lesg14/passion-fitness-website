# ADR-0009: API REST autenticada por sesión

- Estado: Aceptada
- Fecha: 2026-10-11

## Contexto

React y Django se ejecutan en puertos distintos durante el desarrollo. Los datos de sesión ya pertenecen a Django y el dashboard es una herramienta interna para el personal del gimnasio.

## Decisión

Exponer endpoints REST con Django REST Framework y autenticación por sesión. Limitar el acceso de negocio a usuarios `staff`, proteger escrituras con CSRF y usar el proxy de Vite para `/api` durante el desarrollo.

## Consecuencias

- React usa las mismas cuentas administrativas de Django; no se agregan tokens ni un segundo sistema de identidad.
- Registrar un miembro con su primera membresía y pago es una operación atómica. Las renovaciones llaman al servicio de dominio `registrar_pago`.
- En producción, frontend y API deben compartir origen mediante proxy inverso, o configurarse explícitamente CORS, cookies seguras y orígenes CSRF permitidos.
- La API no implementa actualmente edición/borrado de miembros ni anulación de pagos; estas operaciones siguen disponibles mediante Django Admin cuando corresponda.