# ADR-0002: Aplicaciones organizadas por dominio

- Estado: Aceptada (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

Django registra las aplicaciones `members`, `plans`, `billing` y `dashboard`. Los modelos de miembros, planes, membresías y pagos viven en módulos separados.

## Decisión

Organizar las capacidades del servidor en aplicaciones Django por responsabilidad de negocio: miembros, planes, facturación y dashboard.

## Motivos

La separación coincide con los modelos y responsabilidades observados. El repositorio no documenta los motivos originales.

## Consecuencias

- Cada capacidad tiene un lugar identificable para modelos, administración y lógica relacionada.
- Las relaciones entre dominios se expresan mediante claves foráneas y referencias entre aplicaciones Django.
- La estructura no implica independencia de despliegue ni una arquitectura de microservicios.
