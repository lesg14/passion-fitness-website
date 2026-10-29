# ADR-0010: PostgreSQL para operación

- Estado: Aceptada
- Fecha: 2026-10-29

## Contexto

El gimnasio necesita una base compartida para operación diaria. SQLite sigue siendo útil para desarrollo local; la aplicación ya utiliza los modelos y migraciones de Django.

## Decisión

Mantener SQLite como opción local predeterminada y configurar PostgreSQL mediante variables de entorno (`DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` y `DB_SSLMODE`). Las credenciales y secretos no se almacenan en Git.

## Consecuencias

- Psycopg 3 y `python-dotenv` permiten la conexión configurada por entorno.
- Las migraciones crean el esquema en PostgreSQL, pero no copian datos de SQLite ni del Excel.
- Antes de operar con datos reales se deben probar conexión, respaldos, restauración y reconciliación de la importación histórica.
- La instancia de producción requiere TLS y un `DB_SSLMODE` que verifique el certificado del servidor.