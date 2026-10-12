# ADR-0001: Monolito Django

- Estado: Aceptada (documentada retrospectivamente)
- Fecha de documentación: 2026-10-11
- Decidida originalmente: No consta

## Contexto

El proyecto centraliza su lógica de negocio, persistencia, rutas, autenticación y administración en un proyecto Django dentro de `backend/`. El README lo describe como un monolito con backend y presentación organizados en carpetas separadas.

## Decisión

Mantener Django como aplicación monolítica del servidor. No se observa una separación en servicios independientes ni una API pública como límite arquitectónico.

## Motivos

La estructura y las rutas existentes respaldan esta decisión. El motivo original no está registrado; la simplicidad operativa es una justificación posible, no un hecho histórico confirmado.

## Consecuencias

- Las capacidades del sistema se despliegan como parte de la aplicación Django.
- Las aplicaciones del dominio comparten configuración, proceso y acceso a la base de datos.
- Una futura extracción a servicios requerirá definir contratos y límites que hoy no están implementados.
