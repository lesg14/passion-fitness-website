# ADR-0006: Integridad y trazabilidad de pagos

- Estado: Aceptada (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

Registrar un pago también crea una membresía. El modelo conserva el usuario que lo registró, y el administrador impide borrar pagos. Los pagos pueden anularse con una marca lógica.

## Decisión

Crear el pago y su membresía dentro de una transacción atómica; conservar los pagos registrados y representar su anulación mediante `anulado`, en lugar de borrarlos.

## Motivos

El código agrupa ambas escrituras con `transaction.atomic` y documenta que los pagos se anulan para conservar la auditoría. El administrador deshabilita el borrado.

## Consecuencias

- La operación no deja un pago sin su membresía asociada si falla una escritura.
- Los registros de pago conservan su historial y usuario registrador.
- Los reportes de ingresos excluyen los pagos anulados.
- La anulación requiere una operación de negocio explícita; no equivale a borrar ni a revertir automáticamente una membresía.
