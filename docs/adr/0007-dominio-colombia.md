# ADR-0007: Dominio localizado para Colombia

- Estado: Aceptada (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

La aplicación configura idioma `es-co`, zona horaria `America/Bogota` y fechas con zona horaria activa. Los modelos representan importes en COP, métodos de pago usados en Colombia, tipos de documento colombianos y la aceptación de tratamiento de datos personales.

## Decisión

Modelar y presentar las operaciones actuales con convenciones colombianas: idioma y zona horaria locales, importes en COP, tipos de documento pertinentes y registro de autorización de datos.

## Motivos

Estas convenciones están reflejadas en configuración, opciones de modelos y nombres de campos. El README también identifica documento colombiano y Habeas Data como parte del dominio. Los fundamentos legales concretos no están documentados aquí.

## Consecuencias

- Las fechas operativas usan la fecha local de Bogotá.
- Los importes de planes y pagos se almacenan como enteros en COP.
- La aplicación conserva un campo para registrar la autorización de tratamiento de datos.
- El registro técnico de autorización no sustituye la revisión de obligaciones legales, retención, seguridad ni derechos de los titulares.
