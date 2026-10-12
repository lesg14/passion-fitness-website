import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Dumbbell,
  Edit2,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from './api.js';

const RevenueChart = lazy(() => import('./RevenueChart.jsx'));

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCompactCurrency = (value) =>
  value >= 1000000
    ? `$${(value / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
    : formatCurrency(value);

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${value}T12:00:00Z`),
      )
    : 'Sin membresía';

function renderStatusPill(estado) {
  let tone = 'status-inactive';
  if (estado === 'Activo') tone = 'status-active';
  else if (estado === 'Vence hoy') tone = 'status-urgent';
  else if (['Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(estado)) tone = 'status-due';
  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {estado}
    </span>
  );
}

function getAvatarTone(estado) {
  if (estado === 'Activo') return 'mint';
  if (estado === 'Vence hoy') return 'coral';
  if (['Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(estado)) return 'coral';
  return 'lilac';
}

function LoginScreen({ onLogin, connectionError }) {
  const [role, setRole] = useState('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await onLogin(username, password, role);
    } catch (loginError) {
      setFormError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <a className="brand login-brand" href="#inicio">
          <span className="brand-mark">
            <Dumbbell size={19} />
          </span>
          <span className="brand-copy">
            <strong>passion</strong>
            <small>FITNESS CLUB</small>
          </span>
        </a>

        <div className="login-tabs" role="tablist" aria-label="Tipo de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={role === 'staff'}
            className={`login-tab ${role === 'staff' ? 'active' : ''}`}
            onClick={() => setRole('staff')}
          >
            <Users size={14} /> Staff / Recepción
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'admin'}
            className={`login-tab ${role === 'admin' ? 'active' : ''}`}
            onClick={() => setRole('admin')}
          >
            <ShieldCheck size={14} /> Administrador
          </button>
        </div>

        {role === 'admin' ? (
          <>
            <p className="eyebrow">ACCESO DE ADMINISTRADOR</p>
            <h1>
              Control total del club<span>.</span>
            </h1>
            <p className="login-description">
              Modifica planes, edita o elimina miembros, anula pagos y supervisa todas las operaciones.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">ACCESO PARA STAFF</p>
            <h1>
              Bienvenido de vuelta<span>.</span>
            </h1>
            <p className="login-description">
              Acceso operativo para registro diario de miembros, renovaciones y cobro de planes.
            </p>
          </>
        )}

        {(connectionError || formError) && (
          <p className="form-error" role="alert">
            {connectionError || formError}
          </p>
        )}

        <form className="login-form" onSubmit={submit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={busy || Boolean(connectionError)}>
            {busy ? 'Ingresando…' : role === 'admin' ? 'Ingresar como Administrador' : 'Ingresar como Staff'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, caption, tone }) {
  return (
    <article className="metric">
      <div className="metric-topline">
        <span className={`metric-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-caption">{caption}</p>
    </article>
  );
}

function MemberDialog({ plans, onClose, onAdd }) {
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    email: '',
    plan_id: plans[0]?.id || '',
    metodo: 'efectivo',
    acepta_datos: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (field) => (event) =>
    setForm((current) => ({
      ...current,
      [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onAdd({ ...form, plan_id: Number(form.plan_id) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">NUEVA MEMBRESÍA</span>
            <h2 id="dialog-title">Registrar miembro</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit} className="member-form">
          <div className="form-row">
            <label>
              Nombres
              <input autoFocus required maxLength="100" value={form.nombres} onChange={update('nombres')} />
            </label>
            <label>
              Apellidos
              <input required maxLength="100" value={form.apellidos} onChange={update('apellidos')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Tipo de documento
              <select value={form.tipo_documento} onChange={update('tipo_documento')}>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="TI">Tarjeta de identidad</option>
                <option value="PAS">Pasaporte</option>
              </select>
            </label>
            <label>
              Número de documento
              <input required maxLength="20" value={form.numero_documento} onChange={update('numero_documento')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Correo electrónico
              <input type="email" value={form.email} onChange={update('email')} />
            </label>
            <label>
              Teléfono
              <input maxLength="20" value={form.telefono} onChange={update('telefono')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Plan
              <select required value={form.plan_id} onChange={update('plan_id')}>
                <option value="" disabled>
                  Selecciona un plan
                </option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} · {formatCurrency(plan.precio_cop)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Método de pago
              <select value={form.metodo} onChange={update('metodo')}>
                <option value="efectivo">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="transferencia">Transferencia / PSE</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </label>
          </div>
          <label className="consent-field">
            <input type="checkbox" required checked={form.acepta_datos} onChange={update('acepta_datos')} />
            <span>Autorizo el tratamiento de datos personales del miembro (Ley 1581).</span>
          </label>
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={busy || !plans.length}>
              {busy ? 'Guardando…' : 'Registrar y cobrar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RenewPaymentDialog({ member, plans, onClose, onSuccess }) {
  const initialPlan = plans.find((p) => p.id === member.plan_id) || plans[0];
  const [planId, setPlanId] = useState(initialPlan?.id || '');
  const [montoCop, setMontoCop] = useState(initialPlan?.precio_cop || '');
  const [metodo, setMetodo] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePlanChange = (event) => {
    const selectedId = Number(event.target.value);
    setPlanId(selectedId);
    const selected = plans.find((p) => p.id === selectedId);
    if (selected) setMontoCop(selected.precio_cop);
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/payments/', {
        method: 'POST',
        body: {
          member_id: member.id,
          plan_id: Number(planId),
          metodo,
          monto_cop: Number(montoCop),
          referencia,
        },
      });
      onSuccess(`Pago de ${formatCurrency(montoCop)} registrado con éxito para ${member.nombre}.`);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const isVigente = member.estado === 'Activo' || member.estado?.startsWith('Vence');

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="renew-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">RENOVAR / COBRAR</span>
            <h2 id="renew-title">{member.nombre}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        <div className="dialog-info-banner" style={{ marginBottom: 15 }}>
          <div>
            <strong>Estado actual: {member.estado}</strong>
            <span>
              {isVigente
                ? `Vence el ${formatDate(member.fecha_fin)}. La nueva vigencia iniciará el día posterior.`
                : 'Sin membresía vigente. La nueva vigencia iniciará a partir de hoy.'}
            </span>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="member-form">
          <label>
            Plan a renovar
            <select required value={planId} onChange={handlePlanChange}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre} ({plan.duracion_dias} días) · {formatCurrency(plan.precio_cop)}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label>
              Monto a cobrar (COP)
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={montoCop}
                onChange={(event) => setMontoCop(event.target.value)}
              />
            </label>
            <label>
              Método de pago
              <select value={metodo} onChange={(event) => setMetodo(event.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="transferencia">Transferencia / PSE</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </label>
          </div>

          <label>
            Referencia o comprobante (opcional)
            <input
              placeholder="Ej: Nequi #12345 o voucher"
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
            />
          </label>

          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={busy || !plans.length}>
              {busy ? 'Registrando…' : 'Confirmar pago y renovar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditMemberDialog({ member, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nombres: member.nombres || '',
    apellidos: member.apellidos || '',
    tipo_documento: member.tipo_documento || 'CC',
    numero_documento: member.numero_documento || '',
    telefono: member.telefono || '',
    email: member.email || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((curr) => ({ ...curr, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/members/${member.id}/`, {
        method: 'PATCH',
        body: form,
      });
      onSuccess(`Datos de ${form.nombres} actualizados.`);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MODO ADMINISTRADOR</span>
            <h2 id="edit-title">Editar miembro</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="member-form">
          <div className="form-row">
            <label>
              Nombres
              <input required maxLength="100" value={form.nombres} onChange={update('nombres')} />
            </label>
            <label>
              Apellidos
              <input required maxLength="100" value={form.apellidos} onChange={update('apellidos')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Tipo de documento
              <select value={form.tipo_documento} onChange={update('tipo_documento')}>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="TI">Tarjeta de identidad</option>
                <option value="PAS">Pasaporte</option>
              </select>
            </label>
            <label>
              Número de documento
              <input required maxLength="20" value={form.numero_documento} onChange={update('numero_documento')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Teléfono
              <input maxLength="20" value={form.telefono} onChange={update('telefono')} />
            </label>
            <label>
              Correo electrónico
              <input type="email" value={form.email} onChange={update('email')} />
            </label>
          </div>

          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteMemberConfirmDialog({ member, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/members/${member.id}/`, { method: 'DELETE' });
      onSuccess(`Miembro ${member.nombre} eliminado.`);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow" style={{ color: '#b73824' }}>
              ZONA DE PELIGRO
            </span>
            <h2 id="delete-title">Eliminar miembro</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        <div className="dialog-info-banner warning" style={{ marginBottom: 18 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>¿Confirmas eliminar a {member.nombre}?</strong>
            <span>Esta acción es irreversible y eliminará su historial de membresías y pagos asociados.</span>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button"
            style={{ background: '#b73824', color: '#fff' }}
            type="button"
            onClick={confirmDelete}
            disabled={busy}
          >
            {busy ? 'Eliminando…' : 'Sí, eliminar miembro'}
          </button>
        </div>
      </section>
    </div>
  );
}

function PlansManagementDialog({ onClose, onPlansChanged }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [newPlan, setNewPlan] = useState({ nombre: '', precio_cop: '', duracion_dias: 30 });
  const [editPrice, setEditPrice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadAllPlans() {
    try {
      const data = await apiRequest('/plans/?all=true');
      setPlans(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllPlans();
  }, []);

  async function handleCreatePlan(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/plans/', {
        method: 'POST',
        body: {
          nombre: newPlan.nombre,
          precio_cop: Number(newPlan.precio_cop),
          duracion_dias: Number(newPlan.duracion_dias),
          activo: true,
        },
      });
      setNewPlan({ nombre: '', precio_cop: '', duracion_dias: 30 });
      setShowNewForm(false);
      await loadAllPlans();
      onPlansChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(plan) {
    setError('');
    try {
      await apiRequest(`/plans/${plan.id}/`, {
        method: 'PATCH',
        body: { activo: !plan.activo },
      });
      await loadAllPlans();
      onPlansChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSavePrice(planId) {
    setError('');
    try {
      await apiRequest(`/plans/${planId}/`, {
        method: 'PATCH',
        body: { precio_cop: Number(editPrice) },
      });
      setEditingPlanId(null);
      await loadAllPlans();
      onPlansChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog plans-dialog" role="dialog" aria-modal="true" aria-labelledby="plans-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MODO ADMINISTRADOR</span>
            <h2 id="plans-title">Gestión de Planes de Membresía</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#667066' }}>Crea, modifica precios o pausa planes de tu gimnasio.</span>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowNewForm(!showNewForm)}
            style={{ fontSize: 10, minHeight: 30 }}
          >
            <Plus size={14} /> {showNewForm ? 'Ocultar formulario' : 'Nuevo Plan'}
          </button>
        </div>

        {showNewForm && (
          <form
            onSubmit={handleCreatePlan}
            style={{ background: '#f6f8f5', padding: 12, borderRadius: 6, marginBottom: 14 }}
          >
            <div className="form-row">
              <label>
                Nombre del plan
                <input
                  required
                  placeholder="Ej: Trimestral"
                  value={newPlan.nombre}
                  onChange={(e) => setNewPlan({ ...newPlan, nombre: e.target.value })}
                />
              </label>
              <label>
                Precio (COP)
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  placeholder="220000"
                  value={newPlan.precio_cop}
                  onChange={(e) => setNewPlan({ ...newPlan, precio_cop: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <label>
                Duración (días)
                <input
                  type="number"
                  min="1"
                  required
                  value={newPlan.duracion_dias}
                  onChange={(e) => setNewPlan({ ...newPlan, duracion_dias: e.target.value })}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="button button-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
                  {busy ? 'Creando…' : 'Guardar Plan'}
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', padding: 20, color: '#778077', fontSize: 12 }}>Cargando planes…</p>
        ) : (
          <div className="plans-grid">
            {plans.map((plan) => (
              <div key={plan.id} className={`plan-manage-card ${!plan.activo ? 'inactive' : ''}`}>
                <div className="plan-manage-info">
                  <strong>
                    {plan.nombre} {!plan.activo && <small style={{ color: '#b73824' }}>(Pausado)</small>}
                  </strong>
                  {editingPlanId === plan.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <input
                        type="number"
                        style={{ width: 110, height: 26, fontSize: 11, padding: '0 6px' }}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                      <button
                        className="button button-primary"
                        type="button"
                        style={{ minHeight: 26, padding: '0 8px' }}
                        onClick={() => handleSavePrice(plan.id)}
                      >
                        OK
                      </button>
                      <button
                        className="button button-quiet"
                        type="button"
                        style={{ minHeight: 26, padding: '0 6px' }}
                        onClick={() => setEditingPlanId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span>
                      {formatCurrency(plan.precio_cop)} · {plan.duracion_dias} días
                    </span>
                  )}
                </div>
                <div className="plan-manage-actions">
                  <button
                    className="action-btn"
                    type="button"
                    onClick={() => {
                      setEditingPlanId(plan.id);
                      setEditPrice(plan.precio_cop);
                    }}
                    title="Editar precio"
                  >
                    <Edit2 size={12} /> Precio
                  </button>
                  <button
                    className="action-btn"
                    type="button"
                    onClick={() => toggleActive(plan)}
                    style={{ color: plan.activo ? '#b73824' : '#367559' }}
                  >
                    {plan.activo ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dialog-actions" style={{ marginTop: 15 }}>
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [period, setPeriod] = useState(6);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dashboard, setDashboard] = useState(null);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [dataError, setDataError] = useState('');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const [selectedMemberForRenewal, setSelectedMemberForRenewal] = useState(null);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null);
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 4000);
  };

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        await apiRequest('/auth/csrf/');
        const session = await apiRequest('/auth/session/');
        if (active) setUser(session);
      } catch (error) {
        if (active && error.status !== 401) setConnectionError(error.message || 'No se pudo conectar con Django.');
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    async function loadData() {
      setDataError('');
      try {
        const [summary, memberList, activePlans] = await Promise.all([
          apiRequest(`/dashboard/?months=${period}`),
          apiRequest('/members/'),
          apiRequest('/plans/'),
        ]);
        if (active) {
          setDashboard(summary);
          setMembers(memberList);
          setPlans(activePlans);
        }
      } catch (error) {
        if (active && error.status === 401) setUser(null);
        else if (active) setDataError(error.message);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [user, period, refreshKey]);

  async function handleLogin(username, password, role) {
    setConnectionError('');
    await apiRequest('/auth/login/', { method: 'POST', body: { username, password, role } });
    const session = await apiRequest('/auth/session/');
    setUser(session);
  }

  async function handleLogout() {
    await apiRequest('/auth/logout/', { method: 'POST' });
    setUser(null);
    setDashboard(null);
    setMembers([]);
  }

  async function createMember(data) {
    const member = await apiRequest('/members/', { method: 'POST', body: data });
    setMembers((current) => [member, ...current]);
    setShowAddMemberDialog(false);
    setRefreshKey((current) => current + 1);
    showToast(`¡Miembro ${member.nombre} registrado con éxito!`);
  }

  // Filtrado de miembros por búsqueda de texto y por estado
  const { visibleMembers, counts } = useMemo(() => {
    let act = 0;
    let porVenc = 0;
    let venc = 0;

    const term = query.toLocaleLowerCase('es').trim();

    members.forEach((m) => {
      if (m.estado === 'Activo') act++;
      else if (['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(m.estado)) porVenc++;
      else venc++;
    });

    const filtered = members.filter((member) => {
      const matchText =
        !term ||
        `${member.nombre} ${member.email} ${member.plan} ${member.numero_documento}`
          .toLocaleLowerCase('es')
          .includes(term);

      if (!matchText) return false;

      if (statusFilter === 'activos') return member.estado === 'Activo';
      if (statusFilter === 'por_vencer')
        return ['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(member.estado);
      if (statusFilter === 'vencidos') return member.estado === 'Vencido' || member.estado === 'Sin membresía';
      return true;
    });

    return {
      visibleMembers: filtered,
      counts: {
        todos: members.length,
        activos: act,
        por_vencer: porVenc,
        vencidos: venc,
      },
    };
  }, [members, query, statusFilter]);

  if (authLoading) return <main className="loading-screen">Conectando con Passion Fitness…</main>;
  if (!user) return <LoginScreen onLogin={handleLogin} connectionError={connectionError} />;

  const metrics = dashboard?.metrics;
  const today = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date());

  const isAdmin = user.role === 'admin';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#resumen" aria-label="Passion Fitness, inicio">
          <span className="brand-mark">
            <Dumbbell size={19} />
          </span>
          <span className="brand-copy">
            <strong>passion</strong>
            <small>FITNESS CLUB</small>
          </span>
        </a>
        <div className="sidebar-label">GESTIÓN</div>
        <nav className="primary-nav" aria-label="Navegación principal">
          <a className="nav-link selected" href="#resumen">
            <LayoutDashboard size={18} />
            <span>Resumen</span>
            <i className="nav-indicator" />
          </a>
          <a className="nav-link" href="#miembros">
            <Users size={18} />
            <span>Miembros</span>
            <small className="nav-count">{metrics?.miembros ?? '—'}</small>
          </a>
          <a className="nav-link" href="#ingresos">
            <CreditCard size={18} />
            <span>Ingresos</span>
          </a>
          {isAdmin && (
            <button
              className="nav-link"
              type="button"
              style={{ width: '100%', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setShowPlansDialog(true)}
            >
              <SlidersHorizontal size={18} />
              <span>Gestionar Planes</span>
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-label">CLUB</div>
          <a className="nav-link" href="/admin/">
            <Settings2 size={18} />
            <span>Django Admin</span>
          </a>
          <a className="nav-link" href="mailto:soporte@passionfitness.co">
            <CircleHelp size={18} />
            <span>Centro de ayuda</span>
          </a>
          <button className="club-card" type="button" onClick={handleLogout}>
            <span className="club-avatar">{user.username.slice(0, 2).toUpperCase()}</span>
            <span className="club-info">
              <strong>{user.username}</strong>
              <small>
                {isAdmin ? 'Administrador' : 'Staff'} · Cerrar sesión
              </small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content" id="resumen">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Passion Fitness</span>
            <i>/</i>
            <strong>Resumen</strong>
          </div>
          <div className="topbar-actions">
            <span className={`role-pill ${isAdmin ? 'admin' : 'staff'}`}>
              {isAdmin ? 'ADMINISTRADOR' : 'STAFF'}
            </span>
            <span className="today">
              <CalendarDays size={15} /> {today}
            </span>
            <span className="user-avatar" aria-label={`Sesión de ${user.username}`}>
              {user.username.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div>
              <p className="eyebrow">PANEL DEL CLUB · {isAdmin ? 'MODO TOTAL' : 'MODO OPERATIVO'}</p>
              <h1>
                Tu club, en movimiento<span>.</span>
              </h1>
              <p className="page-subtitle">
                {isAdmin
                  ? 'Tienes permisos para modificar planes, miembros, pagos y auditoría.'
                  : 'Control operativo de miembros y cobro de planes.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && (
                <button className="button button-quiet" type="button" onClick={() => setShowPlansDialog(true)}>
                  <SlidersHorizontal size={16} /> Planes
                </button>
              )}
              <button className="button button-primary" type="button" onClick={() => setShowAddMemberDialog(true)}>
                <Plus size={17} /> Añadir miembro
              </button>
            </div>
          </section>

          {dataError && (
            <div className="api-notice" role="alert">
              {dataError}
              <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
                Reintentar
              </button>
            </div>
          )}

          <section className="metrics-grid" aria-label="Indicadores del club">
            <Metric
              icon={Users}
              label="Miembros registrados"
              value={metrics?.miembros ?? '—'}
              caption="Total en el sistema"
              tone="green"
            />
            <Metric
              icon={CalendarDays}
              label="Por vencer (≤3 días)"
              value={metrics?.por_vencer ?? '—'}
              caption="Vence hoy, mañana o en ≤3d"
              tone="orange"
            />
            <Metric
              icon={CreditCard}
              label="Ingresos del mes"
              value={metrics ? formatCompactCurrency(metrics.ingresos_mes) : '—'}
              caption="Pagos no anulados · COP"
              tone="blue"
            />
            <Metric
              icon={Activity}
              label="Miembros activos"
              value={metrics?.activos ?? '—'}
              caption={`${metrics?.vencidos ?? '—'} sin membresía vigente`}
              tone="pink"
            />
          </section>

          <section className="overview-grid" id="ingresos">
            <article className="panel revenue-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">RENDIMIENTO</p>
                  <h2>Ingresos del club</h2>
                </div>
                <label className="select-wrap">
                  <span className="sr-only">Periodo del gráfico</span>
                  <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
                    <option value={3}>Últimos 3 meses</option>
                    <option value={6}>Últimos 6 meses</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              <div className="chart-summary">
                <strong>{formatCurrency(metrics?.ingresos_mes)}</strong>
                <span className="chart-summary-caption">este mes</span>
              </div>
              <div className="chart-wrap">
                <Suspense fallback={null}>
                  <RevenueChart data={dashboard?.revenue || []} />
                </Suspense>
              </div>
            </article>

            <article className="panel pulse-panel" id="planes">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">MEMBRESÍAS REGISTRADAS</p>
                  <h2>Planes populares</h2>
                </div>
              </div>
              {dashboard?.plans?.length ? (
                <div className="plan-list">
                  {dashboard.plans.map((plan) => {
                    const max = Math.max(...dashboard.plans.map((item) => item.memberships), 1);
                    return (
                      <div className="plan-item" key={plan.name}>
                        <div className="plan-item-heading">
                          <span>{plan.name}</span>
                          <strong>{plan.memberships}</strong>
                        </div>
                        <div className="plan-track">
                          <i style={{ width: `${Math.max((plan.memberships / max) * 100, 3)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-plans">Todavía no hay membresías registradas.</p>
              )}
            </article>
          </section>

          <section className="panel members-panel" id="miembros">
            <div className="panel-heading members-heading">
              <div>
                <p className="eyebrow">SEGUIMIENTO</p>
                <h2>Miembros</h2>
              </div>
              <div className="member-tools">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nombre, documento..."
                    aria-label="Buscar miembro"
                  />
                </label>
                {query && (
                  <button className="button button-quiet" type="button" onClick={() => setQuery('')}>
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Filtros rápidos por estado */}
            <div className="filter-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filtro de estado de membresía">
                <button
                  type="button"
                  className={`filter-tab ${statusFilter === 'todos' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('todos')}
                >
                  Todos <span className="filter-count">{counts.todos}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab ${statusFilter === 'activos' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('activos')}
                >
                  Activos <span className="filter-count">{counts.activos}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab ${statusFilter === 'por_vencer' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('por_vencer')}
                >
                  Por vencer (≤3d) <span className="filter-count">{counts.por_vencer}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab ${statusFilter === 'vencidos' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('vencidos')}
                >
                  Vencidos <span className="filter-count">{counts.vencidos}</span>
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MIEMBRO</th>
                    <th>PLAN</th>
                    <th>VENCIMIENTO</th>
                    <th>ESTADO</th>
                    <th style={{ textAlign: 'right', paddingRight: 15 }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="member-cell">
                          <span className={`member-avatar ${getAvatarTone(member.estado)}`}>
                            {member.iniciales}
                          </span>
                          <span>
                            <strong>{member.nombre}</strong>
                            <small>
                              {member.tipo_documento} {member.numero_documento} {member.telefono ? `· ${member.telefono}` : ''}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td className="plan-cell">{member.plan || '—'}</td>
                      <td className="date-cell">{formatDate(member.fecha_fin)}</td>
                      <td>{renderStatusPill(member.estado)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="member-actions">
                          <button
                            className="action-btn action-renew"
                            type="button"
                            onClick={() => setSelectedMemberForRenewal(member)}
                            title="Registrar pago o renovar membresía"
                          >
                            <CreditCard size={13} /> Renovar
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                className="action-btn"
                                type="button"
                                onClick={() => setSelectedMemberForEdit(member)}
                                title="Editar datos del miembro"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                className="action-btn action-delete"
                                type="button"
                                onClick={() => setSelectedMemberForDelete(member)}
                                title="Eliminar miembro"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleMembers.length === 0 && (
                    <tr>
                      <td className="empty-state" colSpan="5">
                        {query
                          ? `No encontramos miembros con “${query}”.`
                          : `No hay miembros en la categoría seleccionada.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Mostrando {visibleMembers.length} de {members.length} miembros
              </span>
              <span>Datos sincronizados con Django</span>
            </div>
          </section>

          <footer className="page-footer">
            <span>
              PASSION FITNESS <i /> PANEL DE CONTROL
            </span>
            <span>Hecho para moverse.</span>
          </footer>
        </div>
      </main>

      {/* Modales */}
      {showAddMemberDialog && (
        <MemberDialog plans={plans} onClose={() => setShowAddMemberDialog(false)} onAdd={createMember} />
      )}

      {selectedMemberForRenewal && (
        <RenewPaymentDialog
          member={selectedMemberForRenewal}
          plans={plans}
          onClose={() => setSelectedMemberForRenewal(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {selectedMemberForEdit && (
        <EditMemberDialog
          member={selectedMemberForEdit}
          onClose={() => setSelectedMemberForEdit(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {selectedMemberForDelete && (
        <DeleteMemberConfirmDialog
          member={selectedMemberForDelete}
          onClose={() => setSelectedMemberForDelete(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {showPlansDialog && (
        <PlansManagementDialog
          onClose={() => setShowPlansDialog(false)}
          onPlansChanged={() => {
            showToast('Planes actualizados.');
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Toast de notificación de éxito */}
      {toastMessage && (
        <div className="toast-success" role="status">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
