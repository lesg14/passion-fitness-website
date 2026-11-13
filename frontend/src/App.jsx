import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from './api.js';
import brandLogo from './passion-fitness-logo.png';
import StaffManagement from './StaffManagement.jsx';
import { matchesMemberSearch } from './memberSearch.js';

const RevenueChart = lazy(() => import('./RevenueChart.jsx'));
const PlansChart = lazy(() => import('./PlansChart.jsx'));

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

function addDaysToDate(dateString, days) {
  if (!dateString || !days) return '';
  const [y, m, d] = dateString.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + (Number(days) - 1));
  return date.toISOString().split('T')[0];
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getBogotaTodayString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getTomorrowOrNextDayString(dateString) {
  if (!dateString) return getTodayString();
  const [y, m, d] = dateString.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return getTodayString();
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split('T')[0];
}

function renderStatusPill(estado) {
  let tone = 'status-inactive';
  if (estado === 'Activo') tone = 'status-active';
  else if (estado === 'Próxima') tone = 'status-upcoming';
  else if (estado === 'Archivado') tone = 'status-archived';
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
  if (estado === 'Próxima') return 'blue';
  if (estado === 'Archivado') return 'gray';
  if (estado === 'Vence hoy') return 'coral';
  if (['Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(estado)) return 'coral';
  return 'lilac';
}

function MemberCombobox({ members, value, onChange, placeholder = 'Escribe un nombre o documento…', emptyLabel = 'Ver pagos de todos los miembros', label = 'Buscar miembro' }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const selected = members.find((member) => String(member.id) === String(value)) || null;

  const options = useMemo(() => {
    const found = members.filter((member) => matchesMemberSearch(member, text));
    return found.slice(0, 50);
  }, [members, text]);

  function choose(id) {
    onChange(id === null ? '' : String(id));
    setText('');
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (options[active]) choose(options[active].id);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setText('');
    }
  }

  return (
    <div className="member-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setText(''); } }}>
      <input
        className={`history-select-input ${selected ? 'has-selection' : ''}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={selected ? `${selected.nombre} (${selected.numero_documento})` : placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="member-combobox-list" id={listId} role="listbox">
          {emptyLabel && (
            <li role="option" aria-selected={!value} tabIndex={-1} className="member-combobox-option member-combobox-all" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)}>
              {emptyLabel}
            </li>
          )}
          {options.map((member, index) => (
            <li
              key={member.id}
              role="option"
              aria-selected={String(member.id) === String(value)}
              tabIndex={-1}
              className={`member-combobox-option ${index === active ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(member.id)}
            >
              <strong>{member.nombre}</strong>
              <small>{member.numero_documento} · {member.plan || 'Sin plan'}{member.archivado ? ' · Archivado' : ''}</small>
            </li>
          ))}
          {options.length === 0 && <li className="member-combobox-empty">Sin coincidencias</li>}
        </ul>
      )}
    </div>
  );
}

function BrandLogo({ className }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`brand-wordmark ${className}`}>PASSION FITNESS</span>;
  return <img className={className} src={brandLogo} alt="Passion Fitness" onError={() => setFailed(true)} />;
}

function LoginScreen({ onLogin, connectionError }) {
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
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
      <aside className="login-hero">
        <BrandLogo className="login-logo" />
        <div className="login-hero-content">
          <p className="login-hero-eyebrow">PASSION FITNESS · CLUB MANAGEMENT</p>
          <p className="login-hero-title">Entrena con <span>propósito.</span></p>
          <p className="login-hero-description">Todo lo que necesitas para llevar tu club al siguiente nivel.</p>
        </div>
        <div className="login-hero-footer">
          <span>© {new Date().getFullYear()} Passion Fitness</span>
          <span className="login-developer">Desarrollado por <strong>LS Solutions</strong></span>
        </div>
      </aside>
      <section className="login-panel">
        <p className="login-kicker">{role === 'admin' ? 'PANEL ADMINISTRATIVO' : 'PANEL DE RECEPCIÓN'}</p>
        <h1>Bienvenido de vuelta</h1>
        <p className="login-description">Ingresa tus datos para acceder a tu Gimnasio.</p>

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

        {(connectionError || formError) && (
          <p className="form-error" role="alert">
            {connectionError || formError}
          </p>
        )}

        <form className="login-form" onSubmit={submit}>
          <label>
            Usuario o correo electrónico
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ingresa tu usuario o correo"
            />
          </label>
          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <span className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="login-password-toggle"
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </div>
          <div className="login-recovery">
            <button type="button" className="login-recovery-link" aria-expanded={showRecovery} aria-controls="login-recovery-help" onClick={() => setShowRecovery((open) => !open)}>
              ¿Olvidaste tu contraseña?
            </button>
            {showRecovery && (
              <p id="login-recovery-help">
                Si eres de recepción, solicita al administrador que restablezca tu contraseña. Si eres administrador, contacta a <a href="mailto:soporte@passionfitness.co">soporte</a>.
              </p>
            )}
          </div>
          <button className="login-submit" type="submit" disabled={busy || Boolean(connectionError)}>
            {busy ? 'Ingresando…' : 'Ingresar al panel'} <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </form>
        <p className="login-support">¿Necesitas ayuda? <a href="mailto:soporte@passionfitness.co">Contacta a soporte</a></p>
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

function ValidatedMemberInput({ errorMessage, onChange, ...props }) {
  const [touched, setTouched] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  function checkValidity(event) {
    setInvalid(!event.currentTarget.validity.valid);
  }

  return (
    <>
      <input
        {...props}
        aria-invalid={touched && invalid}
        aria-describedby={touched && invalid ? errorId : undefined}
        onChange={(event) => {
          if (touched) checkValidity(event);
          onChange(event);
        }}
        onBlur={(event) => {
          setTouched(true);
          checkValidity(event);
        }}
        onInvalid={(event) => {
          setTouched(true);
          checkValidity(event);
        }}
      />
      {touched && invalid && <span id={errorId} className="field-error" role="alert">{errorMessage}</span>}
    </>
  );
}

function PairRegistrationDialog({ plans, members, initialMember, initialNew, initialPlanId, onClose, onSuccess }) {
  const pairPlans = plans.filter((plan) => plan.es_pareja && plan.activo);
  const blankMember = { nombres: '', apellidos: '', tipo_documento: 'CC', numero_documento: '', telefono: '', email: '', fecha_nacimiento: '', acepta_datos: false };
  const [participants, setParticipants] = useState([
    { member: initialMember || null, nuevo: initialNew || null, query: '', metodo: 'efectivo' },
    { member: null, nuevo: null, query: '', metodo: 'efectivo' },
  ]);
  const [planId, setPlanId] = useState(initialPlanId || pairPlans[0]?.id || '');
  const [start, setStart] = useState(getBogotaTodayString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = pairPlans.find((item) => item.id === Number(planId));
  const minimum = participants.reduce((date, item) => {
    const end = item.member?.fecha_fin;
    const tomorrow = end && end >= getBogotaTodayString() ? getTomorrowOrNextDayString(end) : '';
    return tomorrow > date ? tomorrow : date;
  }, '');
  function updateParticipant(index, values) {
    setParticipants((current) => current.map((item, i) => i === index ? { ...item, ...values } : item));
  }
  useEffect(() => {
    setStart((current) => current < minimum ? minimum : current);
  }, [minimum]);

  async function submit(event) {
    event.preventDefault();
    if (participants.some((item) => !item.member && !item.nuevo)) {
      setError('Selecciona o registra a las dos personas.');
      return;
    }
    if (participants[0].member && participants[0].member.id === participants[1].member?.id) {
      setError('Selecciona dos personas diferentes.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/pair-registrations/', {
        method: 'POST',
        body: {
          plan_id: Number(planId),
          fecha_inicio: start,
          participantes: participants.map((item) => ({
            ...(item.member ? { member_id: item.member.id } : {
              nuevo_miembro: { ...item.nuevo, fecha_nacimiento: item.nuevo.fecha_nacimiento || null },
            }),
            metodo: item.metodo,
          })),
        },
      });
      onSuccess('Plan de pareja registrado: dos pagos y membresías independientes.');
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="pair-title">
        <div className="dialog-heading">
          <div><span className="eyebrow">DOS PERSONAS · DOS PAGOS</span><h2 id="pair-title">Registrar plan de pareja</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={19} /></button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="member-form" onSubmit={submit}>
          <label>Plan de pareja
            <select required value={planId} onChange={(event) => setPlanId(event.target.value)}>
              {pairPlans.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {formatCurrency(item.precio_cop)} por persona</option>)}
            </select>
          </label>
          {participants.map((item, index) => {
            const matches = members.filter((member) => !member.archivado && item.query.trim() &&
              `${member.nombre} ${member.numero_documento}`.toLocaleLowerCase('es').includes(item.query.trim().toLocaleLowerCase('es')));
            return (
              <fieldset key={index}>
                <legend>Persona {index + 1}</legend>
                {item.member ? (
                  <p>{item.member.nombre} · {item.member.numero_documento} <button type="button" className="button button-quiet" onClick={() => updateParticipant(index, { member: null, query: '' })}>Cambiar</button></p>
                ) : item.nuevo ? (
                  <>
                    <button type="button" className="button button-quiet" onClick={() => updateParticipant(index, { nuevo: null, query: '' })}>Buscar miembro existente</button>
                    <div className="form-row">
                      <label>Nombres<input required maxLength={100} value={item.nuevo.nombres} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, nombres: e.target.value } })} /></label>
                      <label>Apellidos<input required maxLength={100} value={item.nuevo.apellidos} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, apellidos: e.target.value } })} /></label>
                    </div>
                    <div className="form-row">
                      <label>Tipo de documento<select value={item.nuevo.tipo_documento} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, tipo_documento: e.target.value } })}><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option><option value="PAS">Pasaporte</option></select></label>
                      <label>Número de documento<ValidatedMemberInput required inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} errorMessage="Ingresa de 1 a 10 dígitos." value={item.nuevo.numero_documento} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, numero_documento: e.target.value } })} /></label>
                    </div>
                    <div className="form-row">
                      <label>Teléfono (opcional)<ValidatedMemberInput inputMode="numeric" pattern="[0-9]{10}" maxLength={10} errorMessage="Ingresa exactamente 10 dígitos." value={item.nuevo.telefono} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, telefono: e.target.value } })} /></label>
                      <label>Correo (opcional)<ValidatedMemberInput type="email" errorMessage="Ingresa un correo válido." value={item.nuevo.email} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, email: e.target.value } })} /></label>
                    </div>
                    <label>Fecha de nacimiento (opcional)<input type="date" max={getBogotaTodayString()} value={item.nuevo.fecha_nacimiento} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, fecha_nacimiento: e.target.value } })} /></label>
                    <label className="consent-field"><input type="checkbox" required checked={item.nuevo.acepta_datos} onChange={(e) => updateParticipant(index, { nuevo: { ...item.nuevo, acepta_datos: e.target.checked } })} /><span>El miembro autoriza el tratamiento de sus datos personales.</span></label>
                  </>
                ) : (
                  <>
                    <label>Buscar por nombre o documento<input value={item.query} onChange={(e) => updateParticipant(index, { query: e.target.value })} /></label>
                    {matches.slice(0, 10).map((member) => <button key={member.id} type="button" className="button button-quiet" onClick={() => updateParticipant(index, { member, query: '' })}>{member.nombre} · {member.numero_documento}</button>)}
                    {item.query.trim() && !matches.length && <p>No se encontraron miembros.</p>}
                    <button type="button" className="button button-quiet" onClick={() => updateParticipant(index, { nuevo: { ...blankMember }, query: '' })}>Crear persona nueva</button>
                  </>
                )}
                <label>Método de pago
                  <select value={item.metodo} onChange={(e) => updateParticipant(index, { metodo: e.target.value })}>
                    <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="daviplata">Daviplata</option><option value="transferencia">Transferencia / PSE</option><option value="tarjeta">Tarjeta</option>
                  </select>
                </label>
              </fieldset>
            );
          })}
          <label>Fecha de inicio común<input type="date" required min={minimum} value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <p>{minimum ? `Inicio mínimo: ${formatDate(minimum)}. ` : ''}Final: {formatDate(plan ? addDaysToDate(start, plan.duracion_dias) : '')}. Total: {formatCurrency((plan?.precio_cop || 0) * 2)}.</p>
          <p>Los pagos no se pueden anular ni corregir sus fechas de inicio. Cada persona puede congelar su membresía independientemente.</p>
          <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy || !plan}>{busy ? 'Guardando…' : 'Registrar pareja'}</button></div>
        </form>
      </section>
    </div>
  );
}

function MemberDialog({ plans, members, onClose, onAdd, onPairSuccess }) {
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    fecha_inicio: getTodayString(),
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

  const selectedPlan = plans.find((p) => p.id === Number(form.plan_id)) || plans[0];
  const calculatedEndDate = form.fecha_inicio && selectedPlan
    ? addDaysToDate(form.fecha_inicio, selectedPlan.duracion_dias)
    : '';
  if (selectedPlan?.es_pareja) {
    return <PairRegistrationDialog plans={plans} members={members} initialNew={{
      nombres: form.nombres, apellidos: form.apellidos, tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento, telefono: form.telefono, email: form.email,
      fecha_nacimiento: form.fecha_nacimiento, acepta_datos: form.acepta_datos,
    }} initialPlanId={selectedPlan.id} onClose={onClose} onSuccess={onPairSuccess} />;
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.acepta_datos) {
      setError('Debes autorizar el tratamiento de datos personales del miembro (Ley 1581 de 2012).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onAdd({
        ...form,
        fecha_nacimiento: form.fecha_nacimiento || null,
        plan_id: Number(form.plan_id),
        fecha_inicio: form.fecha_inicio,
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">NUEVO REGISTRO</span>
            <h2 id="dialog-title">Añadir miembro</h2>
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

        <form className="member-form" onSubmit={submit}>
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
              <ValidatedMemberInput required inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} title="Ingresa de 1 a 10 dígitos numéricos." errorMessage="Ingresa de 1 a 10 dígitos, sin letras ni símbolos." value={form.numero_documento} onChange={update('numero_documento')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Teléfono (opcional)
              <ValidatedMemberInput inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Ingresa exactamente 10 dígitos numéricos." errorMessage="Ingresa exactamente 10 dígitos, sin letras ni símbolos, o deja el teléfono vacío." value={form.telefono} onChange={update('telefono')} />
            </label>
            <label>
              Correo electrónico (opcional)
              <ValidatedMemberInput type="email" errorMessage="Ingresa un correo válido, por ejemplo nombre@ejemplo.com." value={form.email} onChange={update('email')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Fecha de nacimiento (opcional)
              <input type="date" max={getBogotaTodayString()} value={form.fecha_nacimiento} onChange={update('fecha_nacimiento')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Plan inicial
              <select value={form.plan_id} onChange={update('plan_id')} required>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} ({plan.duracion_dias} días) · {formatCurrency(plan.precio_cop)}
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

          <div className="form-row">
            <label>
              Fecha inicial
              <input
                type="date"
                required
                value={form.fecha_inicio}
                onChange={update('fecha_inicio')}
              />
            </label>
            <label>
              Fecha final (calculada según el plan)
              <input
                type="text"
                readOnly
                disabled
                value={
                  calculatedEndDate
                    ? `${formatDate(calculatedEndDate)} (${selectedPlan?.duracion_dias || 0} días)`
                    : 'Selecciona plan y fecha'
                }
                style={{ background: '#f5f7f4', color: '#27342a', fontWeight: 600, cursor: 'not-allowed' }}
              />
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

function NewPaymentDialog({ members, plans, onClose, onSuccess }) {
  const [memberId, setMemberId] = useState('');
  const [continueToPayment, setContinueToPayment] = useState(false);
  const activeMembers = members.filter((member) => !member.archivado);
  const member = activeMembers.find((item) => String(item.id) === memberId);

  if (continueToPayment && member) {
    return <RenewPaymentDialog member={member} plans={plans} members={members} onClose={onClose} onSuccess={onSuccess} />;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog new-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="new-payment-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">PAGOS Y MEMBRESÍAS</span>
            <h2 id="new-payment-title">Registrar nuevo pago</h2>
            <p className="new-payment-description">Busca al miembro para registrar su pago o renovar su membresía.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>
        <form className="member-form" onSubmit={(event) => { event.preventDefault(); if (member) setContinueToPayment(true); }}>
          <div className="payment-member-search">
            <span>Selecciona un miembro</span>
            <MemberCombobox members={activeMembers} value={memberId} onChange={setMemberId} emptyLabel={null} label="Selecciona un miembro" />
          </div>
          {!activeMembers.length && <p>No hay miembros disponibles para registrar un pago.</p>}
          {!plans.length && <p>No hay planes activos disponibles para registrar un pago.</p>}
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={!member || !plans.length}>Continuar</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RenewPaymentDialog({ member, plans, members, onClose, onSuccess }) {
  const initialPlan = plans.find((p) => p.id === member.plan_id) || plans[0];
  const [planId, setPlanId] = useState(initialPlan?.id || '');
  const [montoCop, setMontoCop] = useState(initialPlan?.precio_cop || '');
  const [metodo, setMetodo] = useState('efectivo');
  const [referencia, setReferencia] = useState('');

  const todayStr = getTodayString();
  const defaultStartDate = useMemo(() => {
    if (member?.fecha_fin && member.fecha_fin >= todayStr) {
      return getTomorrowOrNextDayString(member.fecha_fin);
    }
    return todayStr;
  }, [member?.fecha_fin, todayStr]);

  const [fechaInicio, setFechaInicio] = useState(defaultStartDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = plans.find((p) => p.id === Number(planId)) || initialPlan;

  const calculatedEndDate = fechaInicio && selectedPlan
    ? addDaysToDate(fechaInicio, selectedPlan.duracion_dias)
    : '';

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
          fecha_inicio: fechaInicio,
        },
      });
      onSuccess(`Pago de ${formatCurrency(montoCop)} (${selectedPlan?.nombre}) registrado con éxito para ${member.nombre}.`);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const isVigente = member.estado === 'Activo' || member.estado?.startsWith('Vence');

  if (selectedPlan?.es_pareja) {
    return <PairRegistrationDialog plans={plans} members={members} initialMember={member} initialPlanId={selectedPlan.id} onClose={onClose} onSuccess={onSuccess} />;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog renew-dialog" role="dialog" aria-modal="true" aria-labelledby="renew-title">
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
              {member.plan ? `Plan registrado: ${member.plan}. ` : ''}
              {isVigente
                ? `Vence el ${formatDate(member.fecha_fin)}. La fecha de inicio sugerida es el día posterior, o puedes personalizarla.`
                : 'Sin membresía vigente. La fecha inicial sugerida es hoy.'}
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
              Fecha inicial
              <input
                type="date"
                required
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>
            <label>
              Fecha final (calculada según el plan)
              <input
                type="text"
                readOnly
                disabled
                value={
                  calculatedEndDate
                    ? `${formatDate(calculatedEndDate)} (${selectedPlan?.duracion_dias || 0} días)`
                    : 'Selecciona plan y fecha'
                }
                style={{ background: '#f5f7f4', color: '#27342a', fontWeight: 600, cursor: 'not-allowed' }}
              />
            </label>
          </div>

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
              placeholder="Ej: Nequi M192837 o Banco"
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
            />
          </label>

          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Procesando…' : 'Confirmar renovación'}
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
    fecha_nacimiento: member.fecha_nacimiento || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => setForm((c) => ({ ...c, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/members/${member.id}/`, {
        method: 'PATCH',
        body: { ...form, fecha_nacimiento: form.fecha_nacimiento || null },
      });
      onSuccess(`Datos de ${form.nombres} ${form.apellidos} actualizados con éxito.`);
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
              <ValidatedMemberInput required inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} title="Ingresa de 1 a 10 dígitos numéricos." errorMessage="Ingresa de 1 a 10 dígitos, sin letras ni símbolos." value={form.numero_documento} onChange={update('numero_documento')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Teléfono (opcional)
              <ValidatedMemberInput inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Ingresa exactamente 10 dígitos numéricos." errorMessage="Ingresa exactamente 10 dígitos, sin letras ni símbolos, o deja el teléfono vacío." value={form.telefono} onChange={update('telefono')} />
            </label>
            <label>
              Correo electrónico (opcional)
              <ValidatedMemberInput type="email" errorMessage="Ingresa un correo válido, por ejemplo nombre@ejemplo.com." value={form.email} onChange={update('email')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Fecha de nacimiento (opcional)
              <input type="date" max={getBogotaTodayString()} value={form.fecha_nacimiento} onChange={update('fecha_nacimiento')} />
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
      onSuccess(`Miembro ${member.nombre} archivado. Su historial se conservó.`);
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
            <h2 id="delete-title">Archivar miembro</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        <div className="dialog-info-banner warning" style={{ marginBottom: 18 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>¿Confirmas archivar a {member.nombre}?</strong>
            <span>Se ocultará del directorio operativo. Sus pagos y membresías se conservarán y un administrador podrá restaurarlo.</span>
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
            {busy ? 'Archivando…' : 'Sí, archivar miembro'}
          </button>
        </div>
      </section>
    </div>
  );
}

function EditPlanDialog({ plan, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nombre: plan.nombre,
    precio_cop: plan.precio_cop,
    duracion_dias: plan.duracion_dias,
    activo: plan.activo,
    es_pareja: plan.es_pareja,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest(`/plans/${plan.id}/`, {
        method: 'PATCH',
        body: {
          nombre: form.nombre.trim(),
          precio_cop: Number(form.precio_cop),
          duracion_dias: Number(form.duracion_dias),
          activo: Boolean(form.activo),
          es_pareja: Boolean(form.es_pareja),
        },
      });
      onSuccess(`Plan "${updated.nombre}" actualizado con éxito.`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-plan-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MODO ADMINISTRADOR</span>
            <h2 id="edit-plan-title">Editar Plan de Membresía</h2>
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
          <label>
            Nombre del plan
            <input
              required
              maxLength="100"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Precio (COP)
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={form.precio_cop}
                onChange={(e) => setForm({ ...form, precio_cop: e.target.value })}
              />
            </label>
            <label>
              Duración (días)
              <input
                type="number"
                min="1"
                required
                value={form.duracion_dias}
                onChange={(e) => setForm({ ...form, duracion_dias: e.target.value })}
              />
            </label>
          </div>
          <label className="consent-field" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={form.es_pareja} disabled={plan.total_memberships > 0}
              onChange={(e) => setForm({ ...form, es_pareja: e.target.checked })} />
            <span>Plan para dos personas (precio por persona)</span>
          </label>
          <label className="consent-field" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            <span>Plan activo (disponible para venta y renovación en recepción)</span>
          </label>

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

function DeletePlanConfirmDialog({ plan, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      const resp = await apiRequest(`/plans/${plan.id}/`, { method: 'DELETE' });
      const detail = resp?.detail || `Plan "${plan.nombre}" eliminado o inactivado correctamente.`;
      onSuccess(detail);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow" style={{ color: '#b73824' }}>
              ELIMINACIÓN DE PLAN
            </span>
            <h2 id="delete-plan-title">Eliminar plan</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        <div className="dialog-info-banner warning" style={{ marginBottom: 18 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>¿Confirmas eliminar el plan "{plan.nombre}"?</strong>
            <span>
              Si el plan cuenta con membresías históricas asociadas, se pausará e inactivará automáticamente para
              preservar los reportes contables.
            </span>
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
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </button>
        </div>
      </section>
    </div>
  );
}

function MembersManagementView({
  members,
  plans,
  isAdmin,
  onBackToDashboard,
  onNavigateToHistory,
  showToast,
  onRefreshData,
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedMemberForRenewal, setSelectedMemberForRenewal] = useState(null);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null);
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState(null);
  const [actionError, setActionError] = useState('');

  const { filteredMembers, counts } = useMemo(() => {
    let act = 0;
    let porVenc = 0;
    let prox = 0;
    let venc = 0;
    let archivados = 0;
    members.forEach((m) => {
      if (m.archivado) archivados++;
      else if (m.estado === 'Activo') act++;
      else if (['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(m.estado)) porVenc++;
      else if (m.estado === 'Próxima') prox++;
      else if (m.estado === 'Vencido' || m.estado === 'Sin membresía') venc++;
    });

    const filtered = members.filter((member) => {
      if (!matchesMemberSearch(member, query, [member.plan, member.telefono])) return false;

      if (statusFilter === 'archivados') return member.archivado;
      if (member.archivado) return statusFilter === 'todos';
      if (statusFilter === 'activos') return member.estado === 'Activo';
      if (statusFilter === 'por_vencer')
        return ['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(member.estado);
      if (statusFilter === 'proximos') return member.estado === 'Próxima';
      if (statusFilter === 'vencidos') return member.estado === 'Vencido' || member.estado === 'Sin membresía';
      return true;
    });

    return {
      filteredMembers: filtered,
      counts: {
        todos: members.length,
        activos: act,
        por_vencer: porVenc,
        proximos: prox,
        vencidos: venc,
        archivados,
      },
    };
  }, [members, query, statusFilter]);

  async function handleCreateMember(data) {
    const member = await apiRequest('/members/', { method: 'POST', body: data });
    setShowAddMemberDialog(false);
    showToast(`¡Miembro ${member.nombre} registrado con éxito!`);
    onRefreshData();
  }

  async function restoreMember(member) {
    setActionError('');
    try {
      await apiRequest(`/members/${member.id}/`, { method: 'PATCH', body: { archivado: false } });
      showToast(`Miembro ${member.nombre} restaurado.`);
      onRefreshData();
    } catch (error) {
      setActionError(error.message);
    }
  }

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN DEL CLUB</p>
          <h1>
            Gestión de Miembros<span>.</span>
          </h1>
          <p className="page-subtitle">
            Directorio completo de deportistas, registro de altas, edición de datos, estados de membresía y renovaciones.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button button-quiet" type="button" onClick={onBackToDashboard}>
            <ArrowLeft size={16} /> Volver al Resumen
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowAddMemberDialog(true)}
          >
            <Plus size={16} /> Nuevo Miembro
          </button>
        </div>
      </section>

      {/* 5 Tarjetas informativas */}
      <section className="members-metrics-grid" aria-label="Estadísticas de miembros">
        <Metric
          icon={Users}
          label="Total de miembros"
          value={counts.todos}
          caption="Deportistas registrados"
          tone="blue"
        />
        <Metric
          icon={Check}
          label="Membresías activas"
          value={counts.activos}
          caption="Acceso vigente al gimnasio"
          tone="green"
        />
        <Metric
          icon={CalendarDays}
          label="Por vencer (≤3 días)"
          value={counts.por_vencer}
          caption="Vence hoy o en ≤3 días"
          tone="orange"
        />
        <Metric
          icon={Activity}
          label="Próximas a iniciar"
          value={counts.proximos}
          caption="Membresías agendadas"
          tone="blue"
        />
        <Metric
          icon={AlertTriangle}
          label="Vencidos"
          value={counts.vencidos}
          caption="Membresías finalizadas"
          tone="pink"
        />
        {isAdmin && (
          <Metric
            icon={Archive}
            label="Archivados"
            value={counts.archivados}
            caption="Historial conservado"
            tone="blue"
          />
        )}
      </section>

      {actionError && <div className="api-notice" role="alert">{actionError}</div>}

      {/* Tabla CRUD de Miembros */}
      <section className="panel members-panel" style={{ padding: '22px 24px' }}>
        <div className="panel-heading" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">DIRECTORIO DEPORTISTAS</p>
            <h2>Listado y administración de miembros</h2>
          </div>
          <div className="member-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, documento, correo..."
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

        {/* Barra de filtros de estado */}
        <div className="filter-toolbar" style={{ marginBottom: 14 }}>
          <div className="filter-tabs" role="tablist" aria-label="Filtro de miembros">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'todos'}
              className={`filter-tab ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              Todos <span className="filter-count">{counts.todos}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'activos'}
              className={`filter-tab ${statusFilter === 'activos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('activos')}
            >
              Activos <span className="filter-count">{counts.activos}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'por_vencer'}
              className={`filter-tab ${statusFilter === 'por_vencer' ? 'active' : ''}`}
              onClick={() => setStatusFilter('por_vencer')}
            >
              Por vencer (≤3d) <span className="filter-count">{counts.por_vencer}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'proximos'}
              className={`filter-tab ${statusFilter === 'proximos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('proximos')}
            >
              Próximas <span className="filter-count">{counts.proximos}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'vencidos'}
              className={`filter-tab ${statusFilter === 'vencidos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencidos')}
            >
              Vencidos <span className="filter-count">{counts.vencidos}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'archivados'}
                className={`filter-tab ${statusFilter === 'archivados' ? 'active' : ''}`}
                onClick={() => setStatusFilter('archivados')}
              >
                Archivados <span className="filter-count">{counts.archivados}</span>
              </button>
            )}
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>MIEMBRO</th>
                <th>DOCUMENTO</th>
                <th>PLAN ACTUAL</th>
                <th>VENCIMIENTO</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right', paddingRight: 14 }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length ? (
                filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-cell">
                        <span className={`member-avatar ${getAvatarTone(member.estado)}`}>
                          {member.iniciales}
                        </span>
                        <span>
                          <strong>{member.nombre}</strong>
                          <small>
                            {member.telefono ? member.telefono : ''}
                            {member.telefono && member.email ? ' · ' : ''}
                            {member.email ? member.email : (!member.telefono ? 'Sin contacto' : '')}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: '#334035', fontWeight: 600 }}>
                        {member.tipo_documento} {member.numero_documento}
                      </span>
                    </td>
                    <td className="plan-cell">
                      <strong style={{ color: '#27342a' }}>{member.plan || 'Sin plan'}</strong>
                    </td>
                    <td className="date-cell">
                      {formatDate(member.fecha_fin)}
                    </td>
                    <td>{renderStatusPill(member.estado)}</td>
                    <td>
                      <div className="member-actions">
                        <button
                          className="action-btn action-renew"
                          type="button"
                          onClick={() => setSelectedMemberForRenewal(member)}
                          title="Renovar membresía o cobrar"
                          disabled={member.archivado || member.estado === 'Archivado'}
                        >
                          <CreditCard size={12} /> Renovar / Cobrar
                        </button>
                        <button
                          className="action-btn"
                          type="button"
                          onClick={() => onNavigateToHistory(member.id)}
                          title="Ver historial de pagos del miembro"
                        >
                          <Receipt size={12} /> Historial
                        </button>
                        <button
                          className="action-btn"
                          type="button"
                          onClick={() => setSelectedMemberForEdit(member)}
                          title="Editar datos del miembro"
                        >
                          <Edit2 size={12} /> Editar
                        </button>
                        {isAdmin && !member.archivado && (
                          <button
                            className="action-btn action-delete"
                            type="button"
                            onClick={() => setSelectedMemberForDelete(member)}
                            title="Archivar miembro y conservar historial"
                          >
                            <Archive size={12} />
                          </button>
                        )}
                        {isAdmin && member.archivado && (
                          <button
                            className="action-btn"
                            type="button"
                            onClick={() => restoreMember(member)}
                            title="Restaurar miembro"
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {query || statusFilter !== 'todos'
                      ? 'No hay miembros que coincidan con los filtros aplicados.'
                      : 'Todavía no hay miembros registrados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Diálogos modales de la vista de gestión de miembros */}
      {showAddMemberDialog && (
        <MemberDialog
          plans={plans}
          members={members}
          onClose={() => setShowAddMemberDialog(false)}
          onAdd={handleCreateMember}
          onPairSuccess={(msg) => { showToast(msg); onRefreshData(); }}
        />
      )}

      {selectedMemberForRenewal && (
        <RenewPaymentDialog
          member={selectedMemberForRenewal}
          plans={plans}
          members={members}
          onClose={() => setSelectedMemberForRenewal(null)}
          onSuccess={(msg) => {
            showToast(msg);
            onRefreshData();
          }}
        />
      )}

      {selectedMemberForEdit && (
        <EditMemberDialog
          member={selectedMemberForEdit}
          onClose={() => setSelectedMemberForEdit(null)}
          onSuccess={(msg) => {
            showToast(msg);
            onRefreshData();
          }}
        />
      )}

      {selectedMemberForDelete && (
        <DeleteMemberConfirmDialog
          member={selectedMemberForDelete}
          onClose={() => setSelectedMemberForDelete(null)}
          onSuccess={(msg) => {
            showToast(msg);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
}

function PlansManagementView({ onBackToDashboard, showToast, onPlanListChanged }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterState, setFilterState] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ nombre: '', precio_cop: '', duracion_dias: 30, activo: true, es_pareja: false });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState(null);
  const [selectedPlanForDelete, setSelectedPlanForDelete] = useState(null);

  async function loadPlans() {
    try {
      const data = await apiRequest('/plans/?all=true');
      setPlans(data);
      if (onPlanListChanged) onPlanListChanged(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function handleCreatePlan(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const created = await apiRequest('/plans/', {
        method: 'POST',
        body: {
          nombre: newPlan.nombre.trim(),
          precio_cop: Number(newPlan.precio_cop),
          duracion_dias: Number(newPlan.duracion_dias),
          activo: Boolean(newPlan.activo),
          es_pareja: Boolean(newPlan.es_pareja),
        },
      });
      showToast(`¡Plan "${created.nombre}" creado exitosamente!`);
      setNewPlan({ nombre: '', precio_cop: '', duracion_dias: 30, activo: true, es_pareja: false });
      setShowCreateForm(false);
      await loadPlans();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(plan) {
    setError('');
    try {
      const updated = await apiRequest(`/plans/${plan.id}/`, {
        method: 'PATCH',
        body: { activo: !plan.activo },
      });
      showToast(`Plan "${plan.nombre}" marcado como ${updated.activo ? 'Activo' : 'Inactivo'}.`);
      await loadPlans();
    } catch (err) {
      setError(err.message);
    }
  }

  const activePlansCount = useMemo(() => plans.filter((p) => p.activo).length, [plans]);
  const inactivePlansCount = useMemo(() => plans.filter((p) => !p.activo).length, [plans]);
  const totalPlansCount = plans.length;

  const filteredPlans = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return plans.filter((p) => {
      if (term && !p.nombre.toLowerCase().includes(term)) return false;
      if (filterState === 'activos') return p.activo;
      if (filterState === 'inactivos') return !p.activo;
      return true;
    });
  }, [plans, filterState, searchQuery]);

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN DEL CLUB</p>
          <h1>
            Gestión de Planes de Membresía<span>.</span>
          </h1>
          <p className="page-subtitle">
            Crea, actualiza tarifas en COP, modifica vigencias y controla los planes disponibles para venta y recepción.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button button-quiet" type="button" onClick={onBackToDashboard}>
            <ArrowLeft size={16} /> Volver al Resumen
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setCreateError('');
            }}
          >
            <Plus size={16} /> {showCreateForm ? 'Ocultar formulario' : 'Nuevo Plan'}
          </button>
        </div>
      </section>

      {/* 3 Tarjetas informativas en una sola fila horizontal */}
      <section className="plans-metrics-grid" aria-label="Estadísticas de planes">
        <Metric
          icon={SlidersHorizontal}
          label="Cantidad total de planes"
          value={totalPlansCount}
          caption="Planes registrados en el club"
          tone="blue"
        />
        <Metric
          icon={Check}
          label="Cantidad de planes activos"
          value={activePlansCount}
          caption="Disponibles para venta y renovación"
          tone="green"
        />
        <Metric
          icon={AlertTriangle}
          label="Cantidad de planes inactivos"
          value={inactivePlansCount}
          caption="Pausados o fuera de oferta"
          tone="pink"
        />
      </section>

      {/* Formulario de creación de plan */}
      {showCreateForm && (
        <article className="plan-form-card">
          <div className="plan-form-header">
            <h3>Crear nuevo plan de membresía</h3>
            <button className="icon-button" type="button" onClick={() => setShowCreateForm(false)} aria-label="Cerrar formulario">
              <X size={16} />
            </button>
          </div>

          {createError && (
            <p className="form-error" role="alert" style={{ marginBottom: 14 }}>
              {createError}
            </p>
          )}

          <form onSubmit={handleCreatePlan} className="member-form">
            <div className="form-row">
              <label>
                Nombre del plan
                <input
                  required
                  placeholder="Ej: Trimestral, Semestral, Tiquetera..."
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
                  placeholder="Ej: 220000"
                  value={newPlan.precio_cop}
                  onChange={(e) => setNewPlan({ ...newPlan, precio_cop: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Duración (días)
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ej: 90"
                  value={newPlan.duracion_dias}
                  onChange={(e) => setNewPlan({ ...newPlan, duracion_dias: e.target.value })}
                />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="consent-field" style={{ marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={newPlan.activo}
                    onChange={(e) => setNewPlan({ ...newPlan, activo: e.target.checked })}
                  />
                  <span>Activo de inmediato para venta y recepción</span>
                </label>
              </div>
            </div>

            <label className="consent-field">
              <input type="checkbox" checked={newPlan.es_pareja} onChange={(e) => setNewPlan({ ...newPlan, es_pareja: e.target.checked })} />
              <span>Plan para dos personas (precio por persona)</span>
            </label>
            <div className="dialog-actions" style={{ marginTop: 6 }}>
              <button className="button button-quiet" type="button" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </button>
              <button className="button button-primary" type="submit" disabled={creating}>
                {creating ? 'Guardando…' : 'Guardar Plan'}
              </button>
            </div>
          </form>
        </article>
      )}

      {error && (
        <div className="api-notice" role="alert" style={{ marginBottom: 18 }}>
          {error}
          <button type="button" onClick={loadPlans}>
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla CRUD de Planes */}
      <section className="panel plans-crud-panel">
        <div className="panel-heading" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">CATÁLOGO</p>
            <h2>Listado y edición de planes</h2>
          </div>
          <div className="member-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar plan..."
                aria-label="Buscar plan"
              />
            </label>
            {searchQuery && (
              <button className="button button-quiet" type="button" onClick={() => setSearchQuery('')}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Barra de filtros de estado */}
        <div className="filter-toolbar" style={{ marginBottom: 14 }}>
          <div className="filter-tabs" role="tablist" aria-label="Filtro de planes">
            <button
              type="button"
              role="tab"
              aria-selected={filterState === 'todos'}
              className={`filter-tab ${filterState === 'todos' ? 'active' : ''}`}
              onClick={() => setFilterState('todos')}
            >
              Todos <span className="filter-count">{totalPlansCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterState === 'activos'}
              className={`filter-tab ${filterState === 'activos' ? 'active' : ''}`}
              onClick={() => setFilterState('activos')}
            >
              Activos <span className="filter-count">{activePlansCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterState === 'inactivos'}
              className={`filter-tab ${filterState === 'inactivos' ? 'active' : ''}`}
              onClick={() => setFilterState('inactivos')}
            >
              Inactivos <span className="filter-count">{inactivePlansCount}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '30px 0', color: '#778077', fontSize: 12 }}>
            Cargando planes de membresía…
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PLAN</th>
                  <th>DURACIÓN</th>
                  <th>PRECIO (COP)</th>
                  <th>MEMBRESÍAS VENDIDAS</th>
                  <th>ESTADO</th>
                  <th style={{ textAlign: 'right', paddingRight: 14 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.length ? (
                  filteredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              background: plan.activo ? '#fff1c2' : '#f0f0ed',
                              color: plan.activo ? '#8a6a00' : '#889186',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            <SlidersHorizontal size={15} />
                          </span>
                          <div>
                            <strong style={{ color: '#27342a', fontSize: 12 }}>{plan.nombre}</strong>
                            {!plan.activo && (
                              <span style={{ display: 'block', fontSize: 10, color: '#aa744b' }}>
                                Fuera de oferta en recepción
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="date-cell">
                        <strong>{plan.duracion_dias} días</strong>
                        {plan.duracion_dias === 30 && <small style={{ color: '#889186' }}> (1 mes)</small>}
                        {plan.duracion_dias === 90 && <small style={{ color: '#889186' }}> (3 meses)</small>}
                        {plan.duracion_dias === 180 && <small style={{ color: '#889186' }}> (6 meses)</small>}
                        {plan.duracion_dias === 365 && <small style={{ color: '#889186' }}> (1 año)</small>}
                      </td>
                      <td className="plan-cell">
                        <strong style={{ color: '#29372d', fontSize: 12 }}>{formatCurrency(plan.precio_cop)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#556054', fontWeight: 600 }}>
                          {plan.total_memberships ?? 0} registradas
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${plan.activo ? 'active' : 'inactive'}`}>
                          <i />
                          {plan.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="member-actions">
                          <button
                            className="action-btn"
                            type="button"
                            onClick={() => setSelectedPlanForEdit(plan)}
                            title="Editar plan completo"
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          <button
                            className="action-btn"
                            type="button"
                            onClick={() => handleToggleActive(plan)}
                            style={{ color: plan.activo ? '#aa744b' : '#151515' }}
                            title={plan.activo ? 'Pausar plan' : 'Activar plan'}
                          >
                            {plan.activo ? 'Pausar' : 'Activar'}
                          </button>
                          <button
                            className="action-btn action-delete"
                            type="button"
                            onClick={() => setSelectedPlanForDelete(plan)}
                            title="Eliminar plan"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No se encontraron planes con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diálogos modales para edición y eliminación de planes */}
      {selectedPlanForEdit && (
        <EditPlanDialog
          plan={selectedPlanForEdit}
          onClose={() => setSelectedPlanForEdit(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadPlans();
          }}
        />
      )}

      {selectedPlanForDelete && (
        <DeletePlanConfirmDialog
          plan={selectedPlanForDelete}
          onClose={() => setSelectedPlanForDelete(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadPlans();
          }}
        />
      )}
    </div>
  );
}

function VoidPaymentConfirmDialog({ payment, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmVoid() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/payments/${payment.id}/void/`, { method: 'POST' });
      onSuccess(`Pago #${payment.id} de ${formatCurrency(payment.monto_cop)} anulado correctamente.`);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="void-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow" style={{ color: '#b73824' }}>
              ANULACIÓN DE PAGO
            </span>
            <h2 id="void-title">Anular pago #{payment.id}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        <div className="dialog-info-banner warning" style={{ marginBottom: 18 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>¿Confirmas anular el pago de {formatCurrency(payment.monto_cop)}?</strong>
            <span>
              Miembro: {payment.member_nombre}. El pago se conservará para auditoría y se excluirá de los ingresos.
              Su membresía quedará inactiva; las renovaciones posteriores conservarán sus fechas.
            </span>
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
            onClick={confirmVoid}
            disabled={busy}
          >
            {busy ? 'Anulando…' : 'Sí, anular pago'}
          </button>
        </div>
      </section>
    </div>
  );
}

function MembershipChangeDialog({ payment, action, onClose, onSuccess }) {
  const [startDate, setStartDate] = useState(payment.fecha_inicio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isFreeze = action === 'freeze';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/memberships/${payment.membership_id}/${isFreeze ? 'freeze' : 'start-date'}/`, {
        method: isFreeze ? 'POST' : 'PATCH',
        ...(isFreeze ? {} : { body: { fecha_inicio: startDate } }),
      });
      onSuccess(isFreeze ? 'Membresía congelada: se añadieron 5 días.' : 'Fecha de inicio corregida.');
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="membership-change-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MEMBRESÍA · {payment.member_nombre}</span>
            <h2 id="membership-change-title">{isFreeze ? 'Congelar membresía' : 'Corregir fecha de inicio'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>
        <p>
          {isFreeze
            ? `Se añadirán 5 días a la fecha final (${formatDate(payment.fecha_fin)}). Solo puede hacerse una vez.`
            : 'La fecha final se desplazará para conservar la duración, incluidos los días de congelación.'}
          {' '}No se creará ningún pago ni se modificarán otras membresías.
        </p>
        <form onSubmit={submit}>
          {!isFreeze && (
            <div className="form-row">
              <label>
                Nueva fecha de inicio
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              </label>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : isFreeze ? 'Confirmar congelación' : 'Guardar corrección'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PaymentHistoryView({
  members,
  initialMemberId,
  isAdmin,
  onBackToDashboard,
  onOpenRenew,
  onRefreshData,
  showToast,
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId ? String(initialMemberId) : '');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState(null);
  const [membershipChange, setMembershipChange] = useState(null);

  async function loadPayments(memberId) {
    setLoading(true);
    setError('');
    try {
      const url = memberId ? `/payments/?member_id=${memberId}` : '/payments/';
      const data = await apiRequest(url);
      setPayments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments(selectedMemberId);
  }, [selectedMemberId]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === Number(selectedMemberId)) || null,
    [members, selectedMemberId]
  );

  const filteredPayments = useMemo(() => {
    const term = query.toLowerCase().trim();
    return payments.filter((p) => {
      if (term) {
        const match =
          (p.member_nombre || '').toLowerCase().includes(term) ||
          (p.member_numero_documento || '').toLowerCase().includes(term) ||
          (p.plan_nombre || '').toLowerCase().includes(term) ||
          (p.referencia || '').toLowerCase().includes(term) ||
          (p.metodo_display || '').toLowerCase().includes(term);
        if (!match) return false;
      }
      if (statusFilter === 'pagados') return !p.anulado;
      if (statusFilter === 'anulados') return p.anulado;
      return true;
    });
  }, [payments, query, statusFilter]);

  const stats = useMemo(() => {
    const valid = payments.filter((p) => !p.anulado);
    const totalAbonado = valid.reduce((acc, curr) => acc + (curr.monto_cop || 0), 0);
    const countAnulados = payments.filter((p) => p.anulado).length;
    const latestPayment = valid[0] || null;
    return {
      total: totalAbonado,
      count: valid.length,
      anulados: countAnulados,
      latest: latestPayment,
    };
  }, [payments]);

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <p className="eyebrow">CONTABILIDAD Y AUDITORÍA</p>
          <h1>
            Historial de Pagos<span>.</span>
          </h1>
          <p className="page-subtitle">
            {selectedMember
              ? `Historial de pagos y vigencias de ${selectedMember.nombre}.`
              : 'Registro y auditoría de todas las transacciones de membresías del club.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button button-quiet" type="button" onClick={onBackToDashboard}>
            <ArrowLeft size={16} /> Volver al Resumen
          </button>
          {selectedMember && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => onOpenRenew(selectedMember)}
            >
              <CreditCard size={16} /> Cobrar / Renovar
            </button>
          )}
        </div>
      </section>

      {/* Selector interactivo de Miembro con búsqueda por Nombre o Cédula */}
      <section className="history-selector-banner">
        <div className="history-selector-left">
          <label style={{ fontSize: 11, fontWeight: 700, color: '#314235', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} /> Miembro seleccionado:
          </label>
          <MemberCombobox members={members} value={selectedMemberId} onChange={setSelectedMemberId} />
        </div>
        {selectedMemberId && (
          <button
            className="button button-quiet"
            type="button"
            onClick={() => setSelectedMemberId('')}
          >
            Ver todos los miembros
          </button>
        )}
      </section>

      {/* Tarjeta resumen del miembro seleccionado */}
      {selectedMember && (
        <section className="history-member-summary-card">
          <div className="history-member-info">
            <span className={`member-avatar ${getAvatarTone(selectedMember.estado)}`} style={{ width: 44, height: 44, fontSize: 13 }}>
              {selectedMember.iniciales}
            </span>
            <div className="history-member-details">
              <strong>{selectedMember.nombre}</strong>
              <span>
                {selectedMember.tipo_documento} {selectedMember.numero_documento}
                {selectedMember.telefono ? ` · Tel: ${selectedMember.telefono}` : ''}
                {selectedMember.email ? ` · ${selectedMember.email}` : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: 10, color: '#738377', fontWeight: 600 }}>Plan actual</span>
              <strong style={{ fontSize: 13, color: '#243428' }}>{selectedMember.plan || 'Sin plan'}</strong>
            </div>
            {renderStatusPill(selectedMember.estado)}
          </div>
        </section>
      )}

      {/* Tarjetas informativas de la vista de pagos */}
      <section className="plans-metrics-grid" aria-label="Estadísticas de pagos">
        <Metric
          icon={CreditCard}
          label={selectedMember ? 'Total abonado por el miembro' : 'Total recaudado en registros'}
          value={formatCompactCurrency(stats.total)}
          caption={selectedMember ? 'Pagos no anulados en historial' : 'Ingresos de transacciones válidas'}
          tone="green"
        />
        <Metric
          icon={Check}
          label="Pagos válidos registrados"
          value={stats.count}
          caption={stats.latest ? `Último: ${formatDate(stats.latest.fecha)}` : 'Sin pagos registrados'}
          tone="blue"
        />
        <Metric
          icon={AlertTriangle}
          label="Pagos anulados"
          value={stats.anulados}
          caption="Transacciones anuladas por auditoría"
          tone={stats.anulados > 0 ? 'pink' : 'green'}
        />
      </section>

      {error && (
        <div className="api-notice" role="alert" style={{ marginBottom: 18 }}>
          {error}
          <button type="button" onClick={() => loadPayments(selectedMemberId)}>
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla de Historial de Pagos */}
      <section className="panel plans-crud-panel">
        <div className="panel-heading" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">AUDITORÍA DE CAJA</p>
            <h2>
              {selectedMember
                ? `Recibos de ${selectedMember.nombre}`
                : 'Historial completo de pagos del club'}
            </h2>
          </div>
          <div className="member-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por plan, método, ref..."
                aria-label="Buscar en pagos"
              />
            </label>
            {query && (
              <button className="button button-quiet" type="button" onClick={() => setQuery('')}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Filtros de estado de pagos */}
        <div className="filter-toolbar" style={{ marginBottom: 14 }}>
          <div className="filter-tabs" role="tablist" aria-label="Filtro de pagos">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'todos'}
              className={`filter-tab ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              Todos <span className="filter-count">{payments.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'pagados'}
              className={`filter-tab ${statusFilter === 'pagados' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pagados')}
            >
              Válidos <span className="filter-count">{stats.count}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'anulados'}
              className={`filter-tab ${statusFilter === 'anulados' ? 'active' : ''}`}
              onClick={() => setStatusFilter('anulados')}
            >
              Anulados <span className="filter-count">{stats.anulados}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '30px 0', color: '#778077', fontSize: 12 }}>
            Cargando historial de pagos…
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FECHA</th>
                  {!selectedMember && <th>MIEMBRO</th>}
                  <th>PLAN / COBERTURA</th>
                  <th>MÉTODO</th>
                  <th>MONTO (COP)</th>
                  <th>REFERENCIA</th>
                  <th>REGISTRADO POR</th>
                  <th>ESTADO</th>
                  <th style={{ textAlign: 'right', paddingRight: 14 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} style={{ opacity: payment.anulado ? 0.65 : 1 }}>
                      <td>
                        <strong style={{ fontSize: 11, color: '#233226' }}>
                          {formatDate(payment.fecha)}
                        </strong>
                        <small style={{ display: 'block', color: '#889186', fontSize: 10 }}>
                          ID #{payment.id}
                        </small>
                      </td>
                      {!selectedMember && (
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedMemberId(String(payment.member_id))}
                            style={{
                              border: 0,
                              background: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                            title="Filtrar por este miembro"
                          >
                            <strong style={{ color: '#151515', fontSize: 11, display: 'block' }}>
                              {payment.member_nombre}
                            </strong>
                            <small style={{ color: '#778077', fontSize: 10 }}>
                              {payment.member_tipo_documento} {payment.member_numero_documento}
                            </small>
                          </button>
                        </td>
                      )}
                      <td>
                        <strong style={{ color: '#202a22', fontSize: 11 }}>
                          {payment.plan_nombre}
                        </strong>
                        <small style={{ display: 'block', color: '#68776b', fontSize: 10 }}>
                          {formatDate(payment.fecha_inicio)} al {formatDate(payment.fecha_fin)}
                        </small>
                        {payment.congelada && <small style={{ display: 'block' }}>Congelada (+5 días)</small>}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, textTransform: 'capitalize', color: '#445247' }}>
                          {payment.metodo_display || payment.metodo}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: payment.anulado ? '#889186' : '#29372d', fontSize: 12 }}>
                          {formatCurrency(payment.monto_cop)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#677268' }}>
                          {payment.referencia || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#677268' }}>
                          {payment.registrado_por_nombre}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${payment.anulado ? 'voided' : 'paid'}`}>
                          <i />
                          {payment.anulado ? 'Anulado' : 'Pagado'}
                        </span>
                      </td>
                      <td>
                          <div className="member-actions">
                            {!payment.es_pareja && (isAdmin || !payment.member_archivado) && (
                              <button className="action-btn" type="button"
                                onClick={() => setMembershipChange({ payment, action: 'start-date' })}>
                                Corregir inicio
                              </button>
                            )}
                            {isAdmin && !payment.anulado && payment.membresia_vigente && !payment.congelada && (
                              <button className="action-btn" type="button"
                                onClick={() => setMembershipChange({ payment, action: 'freeze' })}>
                                Congelar
                              </button>
                            )}
                            {isAdmin && !payment.anulado && !payment.es_pareja ? (
                              <button
                                className="action-btn action-delete"
                                type="button"
                                onClick={() => setSelectedPaymentForVoid(payment)}
                                title="Anular pago por error o devolución"
                              >
                                Anular
                              </button>
                            ) : isAdmin && payment.anulado ? (
                              <span style={{ fontSize: 10, color: '#b73824', fontStyle: 'italic' }}>
                                Anulado
                              </span>
                            ) : null}
                          </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={selectedMember ? 8 : 9} className="empty-state">
                      No se encontraron pagos con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal para anular pago */}
      {selectedPaymentForVoid && (
        <VoidPaymentConfirmDialog
          payment={selectedPaymentForVoid}
          onClose={() => setSelectedPaymentForVoid(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadPayments(selectedMemberId);
            onRefreshData();
          }}
        />
      )}
      {membershipChange && (
        <MembershipChangeDialog
          payment={membershipChange.payment}
          action={membershipChange.action}
          onClose={() => setMembershipChange(null)}
          onSuccess={(message) => {
            showToast(message);
            loadPayments(selectedMemberId);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuCollapsed, setDesktopMenuCollapsed] = useState(false);
  const [historyMemberId, setHistoryMemberId] = useState(null);
  const [period, setPeriod] = useState(6);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dashboard, setDashboard] = useState(null);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [dataError, setDataError] = useState('');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showNewPaymentDialog, setShowNewPaymentDialog] = useState(false);
  const [selectedMemberForRenewal, setSelectedMemberForRenewal] = useState(null);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null);
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 4500);
  };

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        await apiRequest('/auth/csrf/');
        const session = await apiRequest('/auth/session/');
        if (active && session.role !== 'door') setUser(session);
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
          apiRequest(user.is_superuser ? '/members/?include_archived=true' : '/members/'),
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
    setActiveTab('dashboard');
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
    let prox = 0;
    let venc = 0;
    let archivados = 0;

    members.forEach((m) => {
      if (m.archivado) archivados++;
      else if (m.estado === 'Activo') act++;
      else if (['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(m.estado)) porVenc++;
      else if (m.estado === 'Próxima') prox++;
      else if (m.estado === 'Vencido' || m.estado === 'Sin membresía') venc++;
    });

    const filtered = members.filter((member) => {
      if (!matchesMemberSearch(member, query, [member.plan])) return false;
      if (member.archivado) return false;

      if (statusFilter === 'activos') return member.estado === 'Activo';
      if (statusFilter === 'por_vencer')
        return ['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(member.estado);
      if (statusFilter === 'proximos') return member.estado === 'Próxima';
      if (statusFilter === 'vencidos') return member.estado === 'Vencido' || member.estado === 'Sin membresía';
      return true;
    });

    return {
      visibleMembers: filtered,
      counts: {
        todos: members.filter((member) => !member.archivado).length,
        activos: act,
        por_vencer: porVenc,
        proximos: prox,
        vencidos: venc,
        archivados,
      },
    };
  }, [members, query, statusFilter]);

  const expiringMembers = useMemo(() => (
    members
      .filter((member) => !member.archivado && ['Vence hoy', 'Vence mañana', 'Vence en 2 días', 'Vence en 3 días'].includes(member.estado))
      .sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin) || a.nombre.localeCompare(b.nombre, 'es'))
  ), [members]);

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
    <div className={`app-shell ${desktopMenuCollapsed ? 'desktop-menu-collapsed' : ''}`}>
      {mobileMenuOpen && (
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside id="main-sidebar" className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href="#resumen"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
            setMobileMenuOpen(false);
          }}
          aria-label="Passion Fitness, inicio"
        >
          <BrandLogo className="brand-logo" />
        </a>

        <div className="sidebar-label">GESTIÓN</div>
        <nav className="primary-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`nav-link ${activeTab === 'dashboard' ? 'selected' : ''}`}
            aria-label="Resumen"
            title="Resumen"
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
          >
            <LayoutDashboard size={18} />
            <span>Resumen</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'members' ? 'selected' : ''}`}
            aria-label="Miembros"
            title="Miembros"
            onClick={() => {
              setActiveTab('members');
              setMobileMenuOpen(false);
            }}
          >
            <Users size={18} />
            <span>Miembros</span>
            <small className="nav-count">{metrics?.miembros ?? '—'}</small>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'history' ? 'selected' : ''}`}
            aria-label="Historial de Pagos"
            title="Historial de Pagos"
            onClick={() => {
              setHistoryMemberId(null);
              setActiveTab('history');
              setMobileMenuOpen(false);
            }}
          >
            <Receipt size={18} />
            <span>Historial de Pagos</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'plans' ? 'selected' : ''}`}
              aria-label="Gestionar Planes"
              title="Gestionar Planes"
              onClick={() => {
                setActiveTab('plans');
                setMobileMenuOpen(false);
              }}
            >
              <SlidersHorizontal size={18} />
              <span>Gestionar Planes</span>
            </button>
          )}
          {isAdmin && (
            <button type="button" className={`nav-link ${activeTab === 'staff' ? 'selected' : ''}`} aria-label="Personal" title="Personal" onClick={() => {
              setActiveTab('staff');
              setMobileMenuOpen(false);
            }}>
              <ShieldCheck size={18} />
              <span>Personal</span>
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">CLUB</div>
          <a className="nav-link" href="mailto:soporte@passionfitness.co" aria-label="Soporte" title="Soporte">
            <CircleHelp size={18} />
            <span>Soporte</span>
          </a>
          <div className="user-profile-widget">
            <div className="user-profile-details">
              <span className="user-profile-avatar">{user.username.slice(0, 2).toUpperCase()}</span>
              <div className="user-profile-info">
                <strong>{user.username}</strong>
                <small>{isAdmin ? 'Administrador' : 'Staff'}</small>
              </div>
            </div>
            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Área principal de contenido */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
            aria-controls="main-sidebar"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <Menu size={19} />
          </button>
          <button
            className="desktop-menu-toggle"
            type="button"
            aria-label={desktopMenuCollapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!desktopMenuCollapsed}
            aria-controls="main-sidebar"
            onClick={() => setDesktopMenuCollapsed((collapsed) => !collapsed)}
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>Passion Fitness</span>
            <i>/</i>
            <strong>
              {activeTab === 'plans'
                ? 'Planes de Membresía'
                : activeTab === 'staff'
                ? 'Personal'
                : activeTab === 'members'
                ? 'Gestión de Miembros'
                : activeTab === 'history'
                ? 'Historial de Pagos'
                : 'Resumen'}
            </strong>
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

        {activeTab === 'staff' && isAdmin ? (
          <StaffManagement showToast={showToast} onProfileChanged={(profile) => setUser((current) => ({ ...current, username: profile.username, first_name: profile.first_name }))} />
        ) : activeTab === 'plans' ? (
          <PlansManagementView
            onBackToDashboard={() => setActiveTab('dashboard')}
            showToast={showToast}
            onPlanListChanged={(updatedPlans) => setPlans(updatedPlans.filter((p) => p.activo))}
          />
        ) : activeTab === 'members' ? (
          <MembersManagementView
            members={members}
            plans={plans}
            isAdmin={isAdmin}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onNavigateToHistory={(memberId) => {
              setHistoryMemberId(memberId);
              setActiveTab('history');
            }}
            showToast={showToast}
            onRefreshData={() => setRefreshKey((c) => c + 1)}
          />
        ) : activeTab === 'history' ? (
          <PaymentHistoryView
            members={members}
            initialMemberId={historyMemberId}
            isAdmin={isAdmin}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onOpenRenew={(member) => setSelectedMemberForRenewal(member)}
            onRefreshData={() => setRefreshKey((current) => current + 1)}
            showToast={showToast}
          />
        ) : (
          <div className="page-wrap">
            <section className="page-heading">
              <div>
                <p className="eyebrow">PANEL PRINCIPAL · {isAdmin ? 'MODO TOTAL' : 'MODO OPERATIVO'}</p>
                <h1>
                  ¡Te damos la bienvenida, {user.first_name || user.user?.first_name || user.username}<span>!</span>
                </h1>
                <p className="page-subtitle">
                  {isAdmin
                    ? 'Tienes permisos para modificar planes, miembros, pagos y auditoría.'
                    : 'Control operativo de miembros y cobro de planes.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && (
                  <button className="button button-quiet" type="button" onClick={() => setActiveTab('plans')}>
                    <SlidersHorizontal size={16} /> Gestionar Planes
                  </button>
                )}
                <button className="button button-quiet" type="button" onClick={() => setShowNewPaymentDialog(true)}>
                  <CreditCard size={16} /> Registrar pago
                </button>
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

            <section className={`metrics-grid${isAdmin ? '' : ' metrics-grid-reception'}`} aria-label="Indicadores del club">
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
              {isAdmin && (
                <Metric
                  icon={CreditCard}
                  label="Ingresos del mes"
                  value={metrics ? formatCompactCurrency(metrics.ingresos_mes) : '—'}
                  caption="Pagos no anulados · COP"
                  tone="blue"
                />
              )}
              <Metric
                icon={Activity}
                label="Miembros activos"
                value={metrics?.activos ?? '—'}
                caption={`${metrics?.vencidos ?? 0} vencidos${(metrics?.proximos || 0) > 0 ? ` · ${metrics.proximos} próximas` : ''}`}
                tone="pink"
              />
            </section>

            <section className="overview-grid">
              {isAdmin ? (
              <article className="panel revenue-panel" id="ingresos">
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
              ) : (
                <article className="panel expiring-panel" aria-labelledby="expiring-title">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">SEGUIMIENTO</p>
                      <h2 id="expiring-title">Membresías por vencer</h2>
                    </div>
                    <CalendarDays size={19} aria-hidden="true" />
                  </div>
                  <p className="expiring-description">Miembros que vencen hoy o en los próximos 3 días y no tienen otra membresía operativa con vencimiento posterior.</p>
                  {dataError ? (
                    <p className="expiring-empty">No se pudieron cargar los vencimientos. Usa la opción de reintentar.</p>
                  ) : !dashboard ? (
                    <p className="expiring-empty">Cargando vencimientos…</p>
                  ) : expiringMembers.length ? (
                    <ul className="expiring-list">
                      {expiringMembers.map((member) => (
                        <li className="expiring-item" key={member.id}>
                          <div>
                            <strong>{member.nombre}</strong>
                            <span>{member.tipo_documento} {member.numero_documento} · {member.estado} ({formatDate(member.fecha_fin)})</span>
                          </div>
                          <button
                            className="action-btn action-renew"
                            type="button"
                            aria-label={`Renovar membresía de ${member.nombre}, documento ${member.numero_documento}`}
                            onClick={() => setSelectedMemberForRenewal(member)}
                          >
                            Renovar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="expiring-empty">No hay membresías por vencer en los próximos 3 días.</p>
                  )}
                </article>
              )}

              <article className="panel pulse-panel" id="planes">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">MEMBRESÍAS REGISTRADAS</p>
                    <h2>Planes populares</h2>
                  </div>
                </div>
                {dashboard?.plans?.length ? (
                  <Suspense fallback={null}>
                    <PlansChart data={dashboard.plans} />
                  </Suspense>
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
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => setActiveTab('members')}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Ver gestión completa <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>

              {/* Filtros rápidos por estado */}
              <div className="filter-toolbar">
                <div className="filter-tabs" role="tablist" aria-label="Filtro de estado de membresía">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === 'todos'}
                    className={`filter-tab ${statusFilter === 'todos' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('todos')}
                  >
                    Todos <span className="filter-count">{counts.todos}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === 'activos'}
                    className={`filter-tab ${statusFilter === 'activos' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('activos')}
                  >
                    Activos <span className="filter-count">{counts.activos}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === 'por_vencer'}
                    className={`filter-tab ${statusFilter === 'por_vencer' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('por_vencer')}
                  >
                    Por vencer (≤3d) <span className="filter-count">{counts.por_vencer}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === 'proximos'}
                    className={`filter-tab ${statusFilter === 'proximos' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('proximos')}
                  >
                    Próximas <span className="filter-count">{counts.proximos}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === 'vencidos'}
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
                      <th style={{ textAlign: 'right', paddingRight: 14 }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMembers.length ? (
                      visibleMembers.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <div className="member-cell">
                              <span className={`member-avatar ${getAvatarTone(member.estado)}`}>
                                {member.iniciales}
                              </span>
                              <span>
                                <strong>{member.nombre}</strong>
                                <small>
                                  {member.numero_documento}
                                  {member.telefono ? ` · ${member.telefono}` : ''}
                                  {member.email ? ` · ${member.email}` : ''}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td className="plan-cell">{member.plan}</td>
                          <td className="date-cell">{formatDate(member.fecha_fin)}</td>
                          <td>{renderStatusPill(member.estado)}</td>
                          <td>
                            <div className="member-actions">
                              <button
                                className="action-btn action-renew"
                                type="button"
                                onClick={() => setSelectedMemberForRenewal(member)}
                                title="Renovar membresía o cobrar"
                              >
                                <CreditCard size={12} /> Renovar / Cobrar
                              </button>
                              <button
                                className="action-btn"
                                type="button"
                                onClick={() => {
                                  setHistoryMemberId(member.id);
                                  setActiveTab('history');
                                }}
                                title="Ver historial de pagos del miembro"
                              >
                                <Receipt size={12} /> Historial
                              </button>
                              {isAdmin && !member.archivado && (
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
                                    title="Archivar miembro y conservar historial"
                                  >
                                    <Archive size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          {query || statusFilter !== 'todos'
                            ? 'No hay miembros que coincidan con los filtros aplicados.'
                            : 'Todavía no hay miembros registrados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Diálogos modales globales */}
      {showNewPaymentDialog && (
        <NewPaymentDialog
          members={members}
          plans={plans}
          onClose={() => setShowNewPaymentDialog(false)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((current) => current + 1);
          }}
        />
      )}
      {showAddMemberDialog && (
        <MemberDialog
          plans={plans}
          members={members}
          onClose={() => setShowAddMemberDialog(false)}
          onAdd={createMember}
          onPairSuccess={(msg) => { showToast(msg); setRefreshKey((current) => current + 1); }}
        />
      )}

      {selectedMemberForRenewal && (
        <RenewPaymentDialog
          member={selectedMemberForRenewal}
          plans={plans}
          members={members}
          onClose={() => setSelectedMemberForRenewal(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((c) => c + 1);
          }}
        />
      )}

      {selectedMemberForEdit && (
        <EditMemberDialog
          member={selectedMemberForEdit}
          onClose={() => setSelectedMemberForEdit(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((c) => c + 1);
          }}
        />
      )}

      {selectedMemberForDelete && (
        <DeleteMemberConfirmDialog
          member={selectedMemberForDelete}
          onClose={() => setSelectedMemberForDelete(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setRefreshKey((c) => c + 1);
          }}
        />
      )}

      {/* Toast flotante */}
      {toastMessage && (
        <div className="toast-success" role="status">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
