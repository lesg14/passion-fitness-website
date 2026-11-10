# Passion Fitness — Reglas de Negocio Implementadas

Documento de referencia para agentes de IA. Define el modelo de datos, roles, permisos y operaciones críticas del sistema de control de membresías y pagos del gimnasio.

## Entidades de Negocio

### Miembro (`Member`)

Persona registrada en el gimnasio.

**Atributos:**
- `nombres`, `apellidos`: Nombre completo (máx. 100 caracteres cada uno).
- `tipo_documento`: CC (Cédula de ciudadanía), CE (Cédula de extranjería), TI (Tarjeta de identidad), PAS (Pasaporte).
- `numero_documento`: Identificación única por tipo (máx. 20 caracteres). Restricción: combinación `(tipo_documento, numero_documento)` es única en la base de datos.
- `telefono`: Contacto (máx. 20 caracteres, opcional).
- `email`: Correo electrónico (opcional).
- `fecha_nacimiento`: Fecha de nacimiento (opcional).
- `fecha_registro`: Fecha de alta en el sistema (predeterminada: hoy, zona horaria de Colombia).
- `archivado`: Booleano (predeterminado: `false`). Marca lógica; miembros archivados permanecen en la base de datos pero se excluyen de operaciones activas.
- `acepta_datos_en`: Timestamp de consentimiento Habeas Data (Ley 1581 de 2012, obligatorio al registrar).
- `user`: Relación opcional con `django.contrib.auth.models.User`. Reservada para portal futuro del cliente.

**Restricciones de negocio:**
- El documento (tipo + número) debe ser único; impide duplicados.
- Al registrar un miembro, se requiere consentimiento explícito para el tratamiento de datos personales.
- Un miembro archivado no aparece en búsquedas ni listas operativas salvo si el administrador solicita explícitamente incluirlos (`include_archived=true`).
- El historial de pagos y membresías de un miembro archivado permanece disponible para auditoría e informes.

---

### Plan (`Plan`)

Oferta de membresía disponible.

**Atributos:**
- `nombre`: Nombre descriptivo (máx. 100 caracteres, único).
- `precio_cop`: Precio en pesos colombianos (entero positivo).
- `duracion_dias`: Duración de la membresía en días (entero positivo).
- `activo`: Booleano (predeterminado: `true`). Si es falso, el plan no se ofrece a nuevos miembros, pero las membresías existentes permanecen vigentes.

**Restricciones de negocio:**
- El nombre del plan debe ser único.
- Un plan desactivado no se muestra en listas para recepción; solo administradores ven planes inactivos.
- La duración debe ser ≥ 1 día.
- El precio debe ser ≥ 1 COP.
- Un plan con membresías activas no se puede eliminar físicamente; se desactiva lógicamente (`activo = false`).

---

### Membresía (`Membership`)

Período de validez de una membresía para un miembro en un plan.

**Atributos:**
- `member`: Referencia al miembro (no se puede eliminar si hay membresías).
- `plan`: Referencia al plan (no se puede eliminar si hay membresías).
- `fecha_inicio`: Fecha de inicio de vigencia.
- `fecha_fin`: Fecha de fin de vigencia.
- `congelada`: Indica si ya se aplicó la congelación de cinco días a esta membresía.

**Restricciones de negocio:**
- Toda membresía está vinculada a un pago; se crean juntas en una transacción atómica.
- `fecha_fin ≥ fecha_inicio` siempre.
- Una membresía se considera vigente si: `fecha_inicio <= hoy <= fecha_fin` (zona horaria: `America/Bogota`).
- La API crea una membresía con un pago y permite modificar sus fechas únicamente mediante las operaciones de congelación y corrección de inicio.
- El administrador puede congelar una membresía vigente una sola vez; la congelación añade cinco días calendario a `fecha_fin`.
- Recepción o administración pueden corregir `fecha_inicio`; `fecha_fin` se desplaza la misma cantidad de días, conservando la duración y la congelación ya aplicada.
- Estas operaciones no crean pagos ni modifican otras membresías; podrían producir solapamientos con renovaciones existentes.
- El sistema permite múltiples membresías simultáneas para un miembro (aunque operativamente se usa la más reciente).

---

### Pago (`Payment`)

Registro de transacción financiera y su asociación con una membresía.

**Atributos:**
- `member`: Referencia al miembro (no se puede eliminar si hay pagos).
- `membership`: Referencia a la membresía creada por este pago (no se puede eliminar).
- `monto_cop`: Monto pagado en pesos colombianos (entero positivo).
- `metodo`: Método de pago: `efectivo`, `nequi`, `daviplata`, `transferencia`, `tarjeta`.
- `fecha`: Fecha del pago (predeterminada: hoy, zona horaria de Colombia).
- `referencia`: Número de referencia o comprobante (máx. 100 caracteres, opcional).
- `registrado_por`: Usuario que registró el pago (staff o administrador; puede ser `NULL` si lo registra el sistema).
- `anulado`: Booleano (predeterminado: `false`). Marca lógica para indicar que el pago fue anulado.

**Restricciones de negocio:**
- No se pueden eliminar pagos; se anulan con `anulado = true`.
- Un pago anulado se excluye de reportes de ingresos y métricas.
- La anulación no revierte automáticamente la membresía; son operaciones independientes.
- El monto pagado puede diferir del precio del plan (descuentos, retrasos, etc.).
- Cada pago crea exactamente una membresía en la misma transacción.

---

## Estados de Membresía (Cálculo Dinámico)

El sistema evalúa el estado de un miembro en tiempo real según la zona horaria de Colombia (`America/Bogota`):

| Estado | Condición |
|--------|-----------|
| **Archivado** | `member.archivado == true` |
| **Sin membresía** | No hay historial de membresías. |
| **Próxima** | Membresía más reciente con `fecha_inicio > hoy`. |
| **Activo** | Membresía vigente con `dias_restantes > 3` (más de 3 días). |
| **Vence en 3 días** | Membresía vigente con `dias_restantes == 3`. |
| **Vence en 2 días** | Membresía vigente con `dias_restantes == 2`. |
| **Vence mañana** | Membresía vigente con `dias_restantes == 1`. |
| **Vence hoy** | Membresía vigente con `dias_restantes == 0`. |
| **Vencido** | Membresía más reciente con `fecha_fin < hoy`. |

**Cálculo:**
- `dias_restantes = (fecha_fin - hoy).days`
- Se evalúa con respecto a la membresía más reciente (última por `fecha_fin` descendente).

---

## Roles y Permisos

### Recepción (`is_staff`, no `is_superuser`)

Operaciones permitidas:
- Registrar nuevos miembros (crear `Member` + `Payment` + `Membership`).
- Actualizar datos de contacto de miembros activos (nombres, apellidos, teléfono, email).
- Registrar pagos y renovar membresías.
- Corregir la fecha de inicio de una membresía de un miembro no archivado, sin crear un pago.
- Consultar dashboard y estadísticas.
- Listar planes activos.
- Buscar y filtrar miembros (solo activos, no archivados).
- Consultar historial de pagos (búsqueda por nombre, documento, plan o referencia).
- Ver historial de membresías de un miembro.

Operaciones **prohibidas:**
- Crear, editar o desactivar planes.
- Editar documentos de identidad de miembros.
- Archivar o restaurar miembros.
- Anular pagos.
- Congelar membresías.
- Ver miembros archivados.
- Acceder a controles administrativos.

---

### Administrador (`is_superuser`, implica `is_staff`)

Operaciones permitidas:
- **Todas las de Recepción** +
- Crear, editar y desactivar planes.
- Editar documento de identidad de un miembro.
- Archivar (`archivado = true`) o restaurar (`archivado = false`) miembros.
- Anular pagos (`Payment.anulado = true`).
- Congelar una membresía vigente una sola vez, añadiendo cinco días.
- Incluir miembros archivados en búsquedas y directorio (`include_archived=true`).
- Eliminar un plan (si no tiene membresías activas); si tiene, se desactiva lógicamente.

---

## Operaciones Críticas

### Congelar o corregir una membresía

- `POST /api/memberships/<id>/freeze/`: administrador; solo para una membresía vigente y no congelada. Añade cinco días a la fecha final y registra `congelada = true`.
- `PATCH /api/memberships/<id>/start-date/`: recepción o administrador; recibe `{"fecha_inicio": "AAAA-MM-DD"}` y desplaza la fecha final por la misma diferencia. Recepción no puede modificar membresías de miembros archivados.
- Ninguna operación crea ni altera pagos, importes o ingresos. Las demás membresías no se desplazan automáticamente; verificar posibles solapamientos.

### Registrar Miembro con Primera Membresía

**Rol:** Recepción o Administrador  
**Endpoint:** `POST /api/members/`  
**Parámetros:**
```json
{
  "nombres": "Juan",
  "apellidos": "Pérez",
  "tipo_documento": "CC",
  "numero_documento": "1234567890",
  "telefono": "3001234567",
  "email": "juan@example.com",
  "acepta_datos": true,
  "plan_id": 1,
  "metodo": "efectivo",
  "fecha_inicio": "2025-01-15"  // Opcional; si no se especifica, inicia hoy
}
```

**Flujo atómico:**
1. Valida que no exista un miembro con el mismo `(tipo_documento, numero_documento)`.
2. Valida que `acepta_datos == true`.
3. Valida que el plan sea activo.
4. Crea el `Member` con `acepta_datos_en = timezone.now()`.
5. Llama `registrar_pago()` para crear `Membership` y `Payment` en una transacción.
6. Si `fecha_inicio` no se especifica:
   - Si hay una membresía anterior vigente, la nueva inicia el día después de su vencimiento.
   - Si no, inicia hoy.

**Salida:** `Member` con su `Payment` y `Membership` creados.

---

### Registrar Pago y Renovar Membresía

**Rol:** Recepción o Administrador  
**Endpoint:** `POST /api/payments/`  
**Parámetros:**
```json
{
  "member_id": 5,
  "plan_id": 2,
  "metodo": "nequi",
  "monto_cop": 45000,  // Opcional; si no se especifica, usa plan.precio_cop
  "referencia": "REF-2025-001",
  "fecha_inicio": "2025-02-01"  // Opcional; usa lógica de encadenamiento
}
```

**Flujo atómico (`registrar_pago`):**
1. Determina `fecha_inicio`:
   - Si se proporciona, la usa.
   - Si no, busca la membresía más reciente del miembro.
   - Si existe y su `fecha_fin >= hoy`, la nueva membresía inicia en `fecha_fin + 1 día`.
   - Si no existe o ambas están en el pasado, inicia hoy.
2. Calcula `fecha_fin = fecha_inicio + (plan.duracion_dias - 1)`.
3. Crea `Membership(member, plan, fecha_inicio, fecha_fin)`.
4. Crea `Payment(member, membership, monto_cop, metodo, fecha, referencia, usuario)`.

**Restricción:** Ambas operaciones (crear membresía y pago) ocurren en una transacción; si una falla, ambas se revierten.

**Salida:** `Payment` con su `Membership`.

---

### Actualizar Datos de Miembro

**Rol:** Recepción (datos de contacto) o Administrador (incluido documento)  
**Endpoint:** `PATCH /api/members/<id>/`  
**Parámetros:** Cualquier combinación de `nombres`, `apellidos`, `telefono`, `email` (Recepción); además, `tipo_documento`, `numero_documento`, `archivado` (Administrador).

**Restricciones:**
- No se pueden cambiar `tipo_documento` o `numero_documento` si ya existen con los mismos valores en otro miembro.
- Recepción no puede cambiar el documento ni archivar.
- Cambiar a `archivado = false` restaura un miembro.

---

### Anular Pago

**Rol:** Administrador únicamente  
**Endpoint:** `POST /api/payments/<id>/void/`

**Efecto:**
- Marca `Payment.anulado = true`.
- La membresía no se modifica; permanece vigente con sus fechas originales.
- El pago se excluye de reportes de ingresos.
- El historial permanece para auditoría.

**Restricción:** La anulación es irreversible en la API; requiere acceso directo a la base de datos para revertir.

---

### Consultar Dashboard y Estadísticas

**Rol:** Recepción o Administrador  
**Endpoint:** `GET /api/dashboard/?months=6`

**Retorna:**
- Métricas: total de miembros (activos, próximos, vencidos, por vencer), ingresos del mes actual.
- Gráfico de ingresos: últimos N meses (1–12, predeterminado 6).
- Distribución de planes: membresías activas por plan.

**Cálculo:**
- **Total:** Miembros no archivados.
- **Activos:** Membresía vigente con `dias_restantes > 0`.
- **Próximos:** Membresía con `fecha_inicio > hoy`.
- **Vencidos:** Sin membresía vigente y fecha más reciente en el pasado.
- **Por vencer:** Membresía vigente con 1–3 días restantes.
- **Ingresos mes:** Suma de `Payment.monto_cop` (no anulados) registrados en el mes actual.
- **Ingresos históricos:** Suma mensual de pagos no anulados.

**Restricción:** Los pagos anulados se excluyen de todos los cálculos.

---

### Listar Planes

**Rol:** Recepción o Administrador  
**Endpoint:** `GET /api/plans/`

**Comportamiento:**
- **Recepción:** Solo planes con `activo = true`, ordenados por `duracion_dias`, luego `nombre`.
- **Administrador:** Todos los planes (incluso inactivos), con parámetro `?all=true` explícito.

---

### Listar y Buscar Miembros

**Rol:** Recepción o Administrador  
**Endpoint:** `GET /api/members/?search=ana&include_archived=true`

**Parámetros:**
- `search`: Búsqueda en `nombres`, `apellidos`, `email`, `numero_documento` (case-insensitive, subcadena).
- `include_archived`: Si es `true`, incluye archivados (solo Administrador).

**Comportamiento:**
- **Recepción:** Solo miembros con `archivado = false`.
- **Administrador:** Todos, a menos que `include_archived` no esté presente.

**Salida:** Lista de miembros con estado calculado, plan vigente, fechas de membresía e iniciales.

---

### Autenticación

**Endpoint:** `POST /api/auth/login/`  
**Parámetros:**
```json
{
  "username": "juan_staff",  // O email
  "password": "securepass",
  "role": "staff"  // O "admin"
}
```

**Restricciones:**
- El usuario debe existir y estar activo (`is_active = true`).
- El usuario debe tener `is_staff = true` o `is_superuser = true`.
- Si solicita `role: admin`, debe tener `is_superuser = true`.
- Las credenciales incorrectas devuelven error 400.
- La falta de permisos para el rol devuelve error 403.

**Salida:** Token CSRF, rol confirmado, datos del usuario.

---

## Validaciones Comunes

### Documento Único
Antes de crear o actualizar un miembro, se valida que no exista otra persona con el mismo `(tipo_documento, numero_documento)`. Esto es una restricción de base de datos (`UniqueConstraint`).

### Consentimiento de Datos
Al registrar un nuevo miembro, se requiere `acepta_datos = true`. Se registra el timestamp en `acepta_datos_en` para cumplimiento legal.

### Plan Activo
Recepción puede crear pagos solo con planes activos. Administrador ve todos los planes, pero nuevas membresías usan planes activos.

### Zona Horaria
Todas las fechas se calculan en `America/Bogota` (Colombia). Esto afecta:
- Evaluación del estado de membresía (`hoy`).
- Predeterminado de `fecha_registro` y `fecha` de pago.
- Cálculo de `dias_restantes` para alertas.

### Transacciones Atómicas
Las operaciones `registrar_pago()` y registro de miembro (`create()`) ocurren dentro de `@transaction.atomic`, garantizando que no queden pagos sin membresía o viceversa.

---

## Auditoría y Trazabilidad

- **`Payment.registrado_por`**: Identifica al usuario staff o administrador que registró el pago. Nunca se borra, solo se anula.
- **`Payment.anulado`**: Marca lógica para excluir pagos inválidos sin perder el historial.
- **Historial de cambios**: Los pagos anulados y las membresías permanecen en la base de datos; el administrador puede consultar el historial completo.

---

## Restricciones de Integridad Referencial

- **Member → User**: Opcional (`null=True`). Si se elimina el usuario, `Member.user` se establece en `NULL`.
- **Membership → Member**: Obligatorio (`PROTECT`). No se puede eliminar un miembro si tiene membresías.
- **Membership → Plan**: Obligatorio (`PROTECT`). No se puede eliminar un plan si tiene membresías.
- **Payment → Member**: Obligatorio (`PROTECT`). No se puede eliminar un miembro si tiene pagos.
- **Payment → Membership**: Obligatorio (`PROTECT`). No se puede eliminar una membresía si tiene pagos asociados.
- **Payment → User**: Opcional (`null=True`). Si se elimina el usuario, `Payment.registrado_por` se establece en `NULL`.

---

## Protección CSRF y Autenticación

- Todos los endpoints requieren sesión autenticada, salvo `/api/auth/csrf/`, `/api/auth/login/` y la obtención del token CSRF.
- Las operaciones `POST`, `PATCH`, `DELETE` están protegidas por CSRF.
- El frontend obtiene el token CSRF en la sesión de login y lo incluye en cada solicitud.
- En desarrollo local, la sesión se comparte entre Vite (puerto 5173) y Django (puerto 8000); en producción, un proxy inverso expone ambos en el mismo origen.

---

## Resumen de Restricciones Clave

| Concepto | Regla |
|----------|-------|
| Documento único | `(tipo_documento, numero_documento)` no se puede repetir. |
| Membresía vigente | `fecha_inicio <= hoy <= fecha_fin`. |
| Pago anulado | Se excluye de ingresos, no se elimina. |
| Miembro archivado | No aparece operativamente; historial disponible. |
| Plan desactivado | No se ofrece a nuevos; membresías existentes permanecen. |
| Transacción atómica | Pago + Membresía crean juntos o no crean. |
| Zona horaria | Todas las fechas en `America/Bogota`. |
| Encadenamiento de membresías | Nuevas inician el día después del vencimiento anterior. |

---

## Referencias

- [ADR-0006: Integridad y trazabilidad de pagos](docs/adr/0006-integridad-y-trazabilidad-de-pagos.md)
- [Modelos Django](backend/apps/)
- [API REST](backend/apps/dashboard/api.py)
- [README principal](README.md)
