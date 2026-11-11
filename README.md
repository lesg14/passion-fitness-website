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
│   ├── index.html           # Entrada de Vite
│   ├── package.json         # Dependencias y comandos del frontend
│   ├── package-lock.json    # Versiones fijadas de dependencias
│   ├── vite.config.js       # Configuración de Vite y proxy
│   └── src/                 # Interfaz React y recursos
├── docs/
│   └── adr/                 # Decisiones de arquitectura
├── .env.example             # Ejemplo de variables de entorno
├── .gitignore
├── AGENTS.md                # Reglas de negocio para agentes
├── ASUNCIONES.md            # Supuestos y decisiones pendientes
└── README.md
```

React consume la API REST de Django mediante sesiones autenticadas. El acceso al dashboard está limitado a cuentas staff; las solicitudes de escritura usan protección CSRF. En desarrollo, Vite envía `/api` y `/admin` al servidor Django. En producción, configura un proxy inverso para exponer ambos bajo el mismo origen y ajusta `CSRF_TRUSTED_ORIGINS`.

## Roles y permisos

El sistema diferencia dos perfiles de acceso:
- **Staff / Recepción (`is_staff`)**: Registrar nuevos miembros, renovar membresías/pagos, consultar el dashboard y estadísticas, buscar y filtrar miembros.
- **Administrador (`is_superuser`)**: Control total del sistema. Además de las funciones de recepción, puede crear y editar planes (precios y vigencias), pausar/desactivar planes, editar información de miembros, archivar/restaurar miembros y anular pagos erróneos.

En el resumen de recepción se muestran las membresías que vencen hoy o en los próximos tres días, siempre que el miembro no tenga una membresía operativa con vencimiento posterior. Cada aviso permite abrir la renovación directamente. La gráfica de planes populares permanece visible; el indicador y la gráfica de ingresos solo se muestran en el resumen del administrador. Esta separación es visual: la API del dashboard y el historial de pagos conservan sus permisos actuales.

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

### Personal de recepción

Entra como administrador y abre **Personal**. Allí puedes crear recepcionistas, editar sus datos, restablecer su contraseña y activar o desactivar su acceso. Para las dos cuentas iniciales, selecciona `recepcion1` y `recepcion2` y asigna una contraseña diferente a cada una; no se crean automáticamente ni se incluyen contraseñas predeterminadas. Las cuentas acceden desde la pestaña **Staff / Recepción** con los permisos operativos existentes.

En **Personal → Mi cuenta de administrador**, cada administrador puede editar su propio usuario, nombres, apellidos y correo. También puede cambiar su contraseña introduciendo la actual. El cambio mantiene la sesión actual e invalida las demás sesiones; los cambios de nombre se reflejan inmediatamente en el saludo.

La contraseña se valida con las reglas de Django y no se devuelve en las respuestas. Al cambiarla o desactivar la cuenta, sus sesiones dejan de estar autorizadas; desactivar no elimina el historial de pagos. También se pueden administrar los usuarios desde **Autenticación y autorización → Usuarios** en Django Admin: para recepción, activa «Es staff» y no actives «Es superusuario» ni concedas permisos administrativos adicionales. El administrador Django conserva sus capacidades generales de gestión de usuarios.

## PostgreSQL

El desarrollo local usa SQLite por defecto. Para preparar PostgreSQL 18 local:

1. Crea una base y un rol desde `psql` o pgAdmin. En `psql`, conectado como administrador de PostgreSQL:

```sql
CREATE ROLE passion_fitness LOGIN;
\password passion_fitness
CREATE DATABASE passion_fitness OWNER passion_fitness ENCODING 'UTF8';
```

2. Desde la raíz del proyecto, copia `.env.example` a `.env` y configura `DB_ENGINE=postgresql`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Mantén `.env` fuera de Git. Genera una clave con `py -c "import secrets; print(secrets.token_urlsafe(64))"`. Para producción, configura `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, los dominios reales en `DJANGO_ALLOWED_HOSTS` y orígenes HTTPS en `DJANGO_CSRF_TRUSTED_ORIGINS`.
3. Aplica el esquema y verifica la conexión:

```powershell
Push-Location backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py check --database default
```

`migrate` crea las tablas, pero no copia los datos de SQLite ni importa el Excel. No cambies la base de uso diario hasta tener respaldos y reconciliar los registros importados. En producción, configura HTTPS, cookies seguras, `DB_SSLMODE=verify-full` y `DB_SSLROOTCERT` con el certificado raíz de PostgreSQL.

La importación histórica desde Excel aún está pendiente. El archivo debe revisarse primero para definir la relación entre miembros, planes, pagos y periodos, resolver documentos duplicados y cuadrar los totales antes de cargar datos reales.

## API

Todos los endpoints requieren sesión autenticada (`is_staff`). Las operaciones marcadas con `(Admin)` requieren permisos de superusuario (`is_superuser`). React gestiona automáticamente el token CSRF.

| Método | Ruta | Permiso | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/auth/csrf/` | Público | Obtener token CSRF |
| `POST` | `/api/auth/login/` | Público | Iniciar sesión (`username`, `password`, `role`); devuelve el nombre registrado (`first_name`) |
| `GET` | `/api/auth/session/` | Staff/Admin | Consultar sesión, nombre registrado (`first_name`) y rol actual |
| `POST` | `/api/auth/logout/` | Staff/Admin | Cerrar sesión |
| `GET`, `PATCH` | `/api/auth/admin-profile/` | Admin | Consultar o editar la cuenta propia; el cambio de contraseña requiere `current_password` y `password` |
| `GET`, `POST` | `/api/staff/` | Admin | Listar y crear cuentas de recepción |
| `GET`, `PATCH` | `/api/staff/<id>/` | Admin | Consultar o actualizar datos, contraseña y acceso de una cuenta de recepción |
| `GET` | `/api/dashboard/?months=6` | Staff/Admin | Métricas clave, ingresos mensuales y distribución de planes |
| `GET` | `/api/plans/` | Staff/Admin | Listar planes (activos para staff, todos para admin) |
| `POST` | `/api/plans/` | Admin | Crear un nuevo plan de membresía |
| `PATCH` | `/api/plans/<id>/` | Admin | Editar nombre, precio o pausar/activar un plan |
| `DELETE` | `/api/plans/<id>/` | Admin | Eliminar o desactivar lógicamente un plan |
| `GET` | `/api/members/?search=ana` | Staff/Admin | Buscar y listar miembros activos con estado calculado |
| `GET` | `/api/members/?include_archived=true` | Admin | Incluir miembros archivados en el directorio |
| `POST` | `/api/members/` | Staff/Admin | Registrar miembro, consentimiento, pago y primera membresía |
| `PATCH` | `/api/members/<id>/` | Staff/Admin | Actualizar datos del miembro (contacto, nombres, documento y fecha de nacimiento) |
| `DELETE` | `/api/members/<id>/` | Admin | Archivar miembro, conservando pagos y membresías |
| `PATCH` | `/api/members/<id>/` | Admin | Archivar (`archivado: true`) o restaurar (`archivado: false`) un miembro |
| `GET` | `/api/payments/?member_id=<id>` | Staff/Admin | Consultar historial de pagos; `search` acepta nombre, documento, plan o referencia |
| `POST` | `/api/payments/` | Staff/Admin | Registrar pago y renovar membresía a un miembro existente |
| `POST` | `/api/pair-registrations/` | Staff/Admin | Registrar dos personas, pagos y membresías de un plan de pareja |
| `POST` | `/api/payments/<id>/void/` | Admin | Anular el pago, excluirlo de ingresos e inactivar su membresía conservando sus fechas |
| `POST` | `/api/memberships/<id>/freeze/` | Admin | Añadir 5 días a una membresía vigente, una sola vez |
| `PATCH` | `/api/memberships/<id>/start-date/` | Staff/Admin | Corregir `fecha_inicio`, desplazando `fecha_fin` para conservar la duración |

La fecha de nacimiento es opcional y no puede ser posterior a hoy en Colombia; si no se conoce, se conserva como `NULL`. El número de documento debe tener exactamente 10 dígitos; el teléfono es opcional y, si se proporciona, también debe tener exactamente 10 dígitos. Estas validaciones se aplican al registrar o modificar los campos, para todos los tipos de documento. Los datos anteriores no se modifican automáticamente.

El correo electrónico es opcional y, si se proporciona, debe tener un formato válido (por ejemplo, `nombre@ejemplo.com`). El formulario realiza una comprobación inicial y el servidor valida el formato al registrar o editar; estas comprobaciones no verifican que la dirección exista.

El campo `user_id` vincula opcionalmente al miembro con una cuenta de Django para un posible portal de clientes; el registro actual no crea ni vincula esa cuenta.

En **Historial de Pagos**, se puede corregir el inicio de una membresía individual; el administrador también puede congelar una membresía si está vigente, no se ha congelado antes y no tiene pagos anulados. La corrección conserva los cinco días adicionales si ya se aplicaron. Ninguna de estas operaciones crea pagos ni modifica los ingresos u otras membresías; revisa posibles solapamientos con renovaciones existentes.

Los planes marcados como **pareja** requieren dos personas distintas, existentes o nuevas, con una fecha de inicio común. El precio del plan se cobra a cada persona por separado, con un pago y una membresía independiente. Si alguna tiene una membresía vigente o programada, la fecha común debe ser posterior al vencimiento más lejano de ambas. Cada una puede congelarse por separado. Sus pagos no pueden anularse ni corregirse sus fechas de inicio; esta restricción también aplica a las membresías históricas del plan existente llamado «Pareja». Los pagos ya anulados conservan su estado. Cada inscripción vincula a los dos participantes solo para ese período; en renovaciones pueden escoger otro compañero.

Al actualizar una base existente ejecuta `migrate`: la migración marca el plan llamado exactamente «Pareja» y sus membresías históricas. No identifica ni vincula parejas de inscripciones anteriores. Otros planes de pareja deben configurarse como tales antes de registrar membresías; una vez tengan membresías, no puede cambiarse su tipo.

Anular un pago impide que su membresía se considere activa, incluso si el pago se anuló anteriormente. Se conservan el pago, la membresía y sus fechas para auditoría; las renovaciones posteriores existentes no se desplazan. Las nuevas renovaciones automáticas ignoran las membresías con pagos anulados.

Para activar la nueva funcionalidad en una base existente, aplica las migraciones:

```powershell
Push-Location backend
..\.venv\Scripts\python manage.py migrate
```

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
- **Archivado**: Miembro retirado del directorio operativo; el historial financiero permanece disponible.

Los miembros archivados no aparecen en los flujos operativos ni en las métricas. El administrador puede incluirlos en el directorio con `include_archived=true` y restaurarlos.

## Pruebas

```powershell
cd backend
..\.venv\Scripts\python manage.py test
```

El build del frontend se valida con `npm run build` desde `frontend/`.
