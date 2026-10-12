# Passion Fitness

Control de membresías y pagos del gimnasio. Django gestiona el backend y React/Vite el frontend.

## Estructura

```
passion-fitness-website/
├── backend/                 # Django: lógica, modelos, vistas, admin
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/              # settings, urls, wsgi
│   └── apps/
│       ├── members/         # miembros (documento CO, Habeas Data, user opcional)
│       ├── plans/           # planes de membresía (COP)
│       ├── billing/         # membresías y pagos (registrar_pago)
│       └── dashboard/       # estadísticas
├── frontend/                # Aplicación React/Vite
│   ├── index.html            # Entrada de Vite
│   └── src/                  # Interfaz React
├── .gitignore
└── README.md
```

El dashboard se desarrolla como una aplicación React con Vite. Django mantiene la lógica de negocio y Django Admin; la interfaz React todavía usa datos locales y su integración con el backend mediante API queda pendiente.

## Decisiones de arquitectura

El registro de decisiones arquitectónicas está en [`docs/adr/`](docs/adr/README.md).

## Puesta en marcha (Windows)

```powershell
py -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py createsuperuser
..\.venv\Scripts\python manage.py runserver
```

En otra terminal, inicia el frontend:

```powershell
cd frontend
npm install
npm run dev
```

- Dashboard React: http://127.0.0.1:5173/
- Administración Django: http://127.0.0.1:8000/admin/

## Pruebas

```powershell
cd backend
..\.venv\Scripts\python manage.py test
```
