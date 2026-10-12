# ADR-0008: React/Vite como frontend del dashboard

- Estado: Aceptada
- Fecha de registro: 2026-10-11

## Contexto

`frontend/` contiene una aplicación React/Vite con punto de entrada propio. La versión anterior del dashboard se renderizaba en plantillas Django y cargaba CSS/JavaScript desde `frontend/static`.

## Decisión

Usar React/Vite como la única interfaz del dashboard y retirar la presentación anterior basada en plantillas y recursos estáticos de Django. Django conserva la lógica de negocio y la administración; no sirve el dashboard desde `/`.

## Motivos

La aplicación React es la única interfaz del dashboard. Django conserva el dominio, la API y la administración; mantener dos implementaciones de la interfaz creaba rutas de presentación paralelas.

## Consecuencias

- React/Vite es la fuente de la interfaz y se inicia desde `frontend/`.
- Las plantillas y recursos específicos del dashboard Django fueron retirados; Django Admin mantiene sus propias plantillas y archivos estáticos.
- La API de Django persiste las operaciones de miembros y pagos; la interfaz usa sesiones staff y CSRF.
- Django deja de servir la página del dashboard en la ruta raíz.
