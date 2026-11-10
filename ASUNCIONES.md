# Asunciones del negocio

Este documento reúne decisiones provisionales e incógnitas que conviene confirmar con el negocio. **No sustituye** las reglas ya implementadas en [AGENTS.md](./AGENTS.md): una asunción no debe tratarse como requisito aprobado ni como comportamiento garantizado por el sistema.

## Contexto y alcance

- Se asume que el gimnasio opera en Colombia: los importes se expresan en COP, se manejan documentos colombianos y las fechas de negocio usan `America/Bogota`.
- El sistema está pensado para uso interno de recepción y administración. No se asume que los miembros tengan acceso al sistema; el campo de usuario asociado al miembro está reservado para un posible portal futuro.
- Se asume que cada miembro es una persona identificada por un tipo y número de documento. El sistema no define un proceso para fusionar duplicados ni para reutilizar un documento que ya figure en un miembro archivado.
- La importación histórica desde Excel aún no está definida. Antes de importar, se deben acordar la correspondencia de columnas, el tratamiento de documentos duplicados, la reconstrucción de períodos y la conciliación de pagos.

## Pagos y contabilidad

- Se asume que registrar un pago crea una membresía vinculada. No está definido un flujo para registrar anticipos, pagos parciales, cuotas, pagos sin membresía o varios pagos para una misma membresía.
- El monto puede diferir del precio del plan y debe ser positivo. No se especifica cómo autorizar, registrar ni reportar descuentos, recargos, devoluciones o reembolsos.
- Los métodos admitidos hoy son efectivo, Nequi, Daviplata, transferencia/PSE y tarjeta. No se define el tratamiento de otros medios ni las comisiones de los proveedores.
- Anular un pago conserva el registro y no cambia las fechas de la membresía. Se asume que cualquier ajuste financiero o corrección de la membresía requiere un procedimiento administrativo aparte; ese procedimiento todavía no está definido.
- No se especifica qué comprobante debe entregarse, si la referencia es obligatoria para algunos métodos, ni qué información debe contener un cierre de caja.

## Membresías, vigencia y renovaciones

- La duración del plan se interpreta como días calendario inclusivos: una duración de `N` días termina en `fecha_inicio + N - 1 días`.
- Si no se indica una fecha de inicio, una renovación se programa al día siguiente del vencimiento más lejano que no haya terminado en la fecha del pago; de lo contrario, comienza en la fecha del pago.
- Se asume que la fecha del pago y la fecha de inicio de la membresía son conceptos distintos. Actualmente el endpoint de pago no permite indicar la fecha del pago; esta toma el valor predeterminado del sistema.
- El sistema acepta una fecha de inicio explícita. No se ha definido una política de negocio para evitar períodos superpuestos, permitir retroactividad, exigir que la fecha sea futura o corregir una fecha ingresada por error.
- Las membresías históricas conservan sus fechas al cambiar o desactivar un plan. No está definido si modificar el nombre de un plan debe cambiar cómo se presenta en el historial.
- La congelación añade cinco días a una membresía vigente, una sola vez y por acción del administrador. No se define una pausa con fechas de ausencia, transferencia, prórroga por cierre del gimnasio ni cancelación anticipada.
- La corrección del inicio desplaza la fecha final sin crear un pago y conserva la congelación. Otras membresías no se modifican; queda por definir cómo resolver posibles solapamientos con renovaciones.

## Miembros y operación

- Archivar un miembro se entiende como retirarlo de los flujos operativos sin eliminar su información financiera ni sus membresías. No se define un plazo de retención ni un proceso de anonimización o eliminación por solicitud del titular.
- El código permite consultar o registrar pagos seleccionando miembros por identificador, pero no se ha definido si un miembro archivado debe poder recibir pagos o renovaciones.
- El consentimiento se registra como un indicador y una fecha/hora. No se define cómo se presenta y conserva el texto autorizado, cómo se demuestra su versión o cómo se registra su revocación.
- No se especifican requisitos obligatorios para teléfono, correo electrónico o fecha de nacimiento más allá de las validaciones técnicas actuales.
- Los roles actuales se basan en los permisos de Django (`is_staff` y `is_superuser`). No se ha definido un catálogo de permisos más granular ni otros perfiles (por ejemplo, gerente, contador o entrenador).

## Estados e informes

- Los estados visibles se calculan con fechas locales y los períodos incluyen tanto la fecha de inicio como la de fin.
- Se asume que las alertas «vence hoy» y «vence en 1–3 días» son suficientes para la operación. No se han definido notificaciones automáticas, responsables, frecuencia o canales de aviso.
- Los informes excluyen pagos anulados de ingresos. No se define una contabilidad de caja frente a ingresos devengados, el tratamiento de pagos registrados con fecha retroactiva ni una política de cierres contables.
- Si existen períodos superpuestos, varios planes simultáneos o membresías futuras junto con una vigente, no se ha aprobado qué membresía debe prevalecer en todas las pantallas e informes.

## Decisiones pendientes de confirmar

1. ¿Se deben permitir fechas de inicio manuales que causen solapamientos o períodos retroactivos?
2. ¿Se pueden registrar pagos o renovaciones para miembros archivados?
3. ¿Qué proceso debe seguirse para corregir una anulación o devolver dinero, y se debe ajustar la membresía?
4. ¿Qué reglas aplican a pagos parciales, descuentos, comprobantes y cierres de caja?
5. ¿Qué datos de consentimiento deben conservarse y cómo se atiende su revocación?
6. ¿Qué procedimiento de retención, anonimización o eliminación aplica a los datos de miembros?
7. ¿Qué reglas de negocio deben aplicarse al importar y conciliar el historial de Excel?

## Cómo mantener este documento

- Añadir aquí las decisiones que aún requieren confirmación, indicando responsable o fecha si se conocen.
- Cuando una decisión sea aprobada, actualizar primero el comportamiento y las reglas de negocio documentadas; retirar o marcar la asunción correspondiente como resuelta.
- No implementar una asunción como regla obligatoria sin confirmación del negocio, salvo que se acuerde explícitamente como decisión provisional.
