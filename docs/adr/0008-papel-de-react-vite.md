# ADR-0008: React/Vite como frontend del dashboard

- Estado: Aceptada
- Fecha de registro: 2026-10-11

## Contexto

`frontend/` contiene una aplicación React/Vite con punto de entrada propio. La versión anterior del dashboard se renderizaba en plantillas Django y cargaba CSS/JavaScript desde `frontend/static`. React contiene actualmente datos locales de demostración y no está conectado al backend mediante una API.

## Decisión

Usar React/Vite como la única interfaz del dashboard y retirar la presentación anterior basada en plantillas y recursos estáticos de Django. Django conserva la lógica de negocio y la administración; no sirve el dashboard desde `/`.

## Motivos

La aplicación React ya tiene estructura, componentes y configuración Vite. Mantener dos implementaciones de la interfaz creaba rutas de presentación paralelas. La integración API queda como trabajo futuro y no forma parte de esta decisión.

## Consecuencias

- React/Vite es la fuente de la interfaz y se inicia desde `frontend/`.
- Las plantillas y recursos específicos del dashboard Django fueron retirados; Django Admin mantiene sus propias plantillas y archivos estáticos.
- Los datos y acciones React aún no persisten en Django; se necesita diseñar e implementar la API antes de usar datos reales.
- Django deja de servir la página del dashboard en la ruta raíz.
