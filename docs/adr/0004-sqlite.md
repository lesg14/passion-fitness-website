# ADR-0004: SQLite como base de datos configurada

- Estado: Aceptada para la configuración actual (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

La configuración de Django usa `django.db.backends.sqlite3` y guarda la base de datos en `backend/db.sqlite3`. El repositorio incluye ese archivo y no configura otro motor.

## Decisión

Usar SQLite como base de datos de la aplicación en la configuración actual.

## Motivos

La configuración existente y los comandos de desarrollo respaldan esta elección. No consta si se consideró apropiada para producción ni el motivo original.

## Consecuencias

- El entorno puede usar la base de datos integrada de Django sin un servidor de base de datos adicional.
- La configuración, copia de seguridad, concurrencia y operación en producción deben reevaluarse conforme a la carga y al despliegue reales.
- Migrar a otro motor requerirá configurar credenciales y conexión, y validar migraciones y datos.
