# Passion Fitness

Control de membresías y pagos del gimnasio. Django gestiona el backend y React/Vite el frontend.

## Estructura

```
passion-fitness-website/
├── backend/                 # Django: lógica, modelos, API y admin
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/              # settings, urls, wsgi
│   └── apps/
│       ├── members/         # miembros (documento CO, Habeas Data, user opcional)
│       ├── plans/           # planes de membresía (COP)
│       ├── billing/         # membresías y pagos (registrar_pago)
│       └── dashboard/       # estadísticas y API REST
├── frontend/                # Aplicación React/Vite
│   ├── index.html            # Entrada de Vite
│   └── src/                  # Interfaz React
├── .gitignore
└── README.md
```

React consume la API REST de Django mediante sesiones autenticadas. El acceso al dashboard está limitado a cuentas staff; las solicitudes de escritura usan protección CSRF. En desarrollo, Vite envía `/api` y `/admin` al servidor Django. En producción, configura un proxy inverso para exponer ambos bajo el mismo origen y ajusta `CSRF_TRUSTED_ORIGINS`.

## Roles y permisos

El sistema diferencia dos perfiles de acceso:
- **Staff / Recepción (`is_staff`)**: Registrar nuevos miembros, renovar membresías/pagos, consultar el dashboard y estadísticas, buscar y filtrar miembros.
- **Administrador (`is_superuser`)**: Control total del sistema. Además de las funciones de recepción, puede crear y editar planes (precios y vigencias), pausar/desactivar planes, editar información de miembros, eliminar miembros y anular pagos erróneos.

## Decisiones de arquitectura

El registro de decisiones arquitectónicas está en [`docs/adr/`](docs/adr/README.md).

## Puesta en marcha (Windows)

Instala las dependencias y prepara Django desde la raíz:

```powershell
py -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
Push-Location backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py createsuperuser  # Crear cuenta de Administrador
..\.venv\Scripts\python manage.py runserver
```

En otra terminal, inicia el frontend:

```powershell
Push-Location frontend
npm install
npm run dev
```

- Dashboard React: http://localhost:5173/
- Administración Django: http://127.0.0.1:8000/admin/

Mantén ambas terminales abiertas. En la pantalla de login de React puedes elegir la pestaña **Staff / Recepción** o **Administrador** según el perfil del usuario.

## API

Todos los endpoints requieren sesión autenticada (`is_staff`). Las operaciones marcadas con `(Admin)` requieren permisos de superusuario (`is_superuser`). React gestiona automáticamente el token CSRF.

| Método | Ruta | Permiso | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/auth/csrf/` | Público | Obtener token CSRF |
| `POST` | `/api/auth/login/` | Público | Iniciar sesión (`username`, `password`, `role`) |
| `GET` | `/api/auth/session/` | Staff/Admin | Consultar sesión y rol actual |
| `POST` | `/api/auth/logout/` | Staff/Admin | Cerrar sesión |
| `GET` | `/api/dashboard/?months=6` | Staff/Admin | Métricas clave, ingresos mensuales y distribución de planes |
| `GET` | `/api/plans/` | Staff/Admin | Listar planes (activos para staff, todos para admin) |
| `POST` | `/api/plans/` | Admin | Crear un nuevo plan de membresía |
| `PATCH` | `/api/plans/<id>/` | Admin | Editar nombre, precio o pausar/activar un plan |
| `DELETE` | `/api/plans/<id>/` | Admin | Eliminar o desactivar lógicamente un plan |
| `GET` | `/api/members/?search=ana` | Staff/Admin | Buscar y listar miembros con estado calculado |
| `POST` | `/api/members/` | Staff/Admin | Registrar miembro, consentimiento, pago y primera membresía |
| `PATCH` | `/api/members/<id>/` | Staff/Admin | Actualizar datos del miembro (contacto, nombres, documento) |
| `DELETE` | `/api/members/<id>/` | Admin | Eliminar miembro con pagos y membresías asociadas |
| `POST` | `/api/payments/` | Staff/Admin | Registrar pago y renovar membresía a un miembro existente |
| `POST` | `/api/payments/<id>/void/` | Admin | Anular un pago (marca membresía asociada como inactiva) |

### Estados calculados de membresía

El sistema evalúa dinámicamente la vigencia en la zona horaria colombiana (`America/Bogota`):
- **Vence hoy**: La membresía finaliza en la fecha actual.
- **Vence mañana**: Queda 1 día de vigencia.
- **Vence en 2 días**: Quedan 2 días de vigencia.
- **Vence en 3 días**: Quedan 3 días de vigencia.
- **Activo**: Membresía vigente con más de 3 días restantes.
- **Próxima**: Membresía con fecha de inicio en el futuro.
- **Vencido**: La fecha de fin es anterior a hoy.
- **Sin membresía**: Miembro sin historial de membresías activas.

## Pruebas

```powershell
cd backend
..\.venv\Scripts\python manage.py test
```

El build del frontend se valida con `npm run build` desde `frontend/`.
