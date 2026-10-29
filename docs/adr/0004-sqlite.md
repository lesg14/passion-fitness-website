# ADR-0004: SQLite para desarrollo local

- Estado: Aceptada para desarrollo; PostgreSQL se usa en despliegues operativos (ver [ADR-0010](0010-postgresql-operacion.md))
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

La configuración local de Django usa `django.db.backends.sqlite3` y guarda la base de datos en `backend/db.sqlite3`. El proyecto permite seleccionar PostgreSQL mediante variables de entorno.

## Decisión

Usar SQLite por defecto para desarrollo y pruebas locales; usar PostgreSQL para el entorno del gimnasio y producción.

## Motivos

SQLite facilita el desarrollo sin un servicio adicional. PostgreSQL ofrece una base compartida y administrable para el uso operativo. La configuración de ambas depende del entorno y no requiere cambiar los modelos.

## Consecuencias

- El entorno local puede usar la base integrada sin instalar PostgreSQL.
- El entorno PostgreSQL requiere el driver Psycopg y credenciales fuera del repositorio.
- Las migraciones Django crean el esquema; no transfieren registros ni importan el Excel. Toda carga debe reconciliarse antes del cambio operativo.
