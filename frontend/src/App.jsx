import { lazy, Suspense, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, CircleHelp, CreditCard, Dumbbell, LayoutDashboard, Plus, Search, Settings2, Users, X } from 'lucide-react';

const RevenueChart = lazy(() => import('./RevenueChart.jsx'));

const revenueByMonth = [
  { month: 'Abr', revenue: 18400000 }, { month: 'May', revenue: 21600000 },
  { month: 'Jun', revenue: 19800000 }, { month: 'Jul', revenue: 26400000 },
  { month: 'Ago', revenue: 24100000 }, { month: 'Sep', revenue: 31200000 },
];

const initialMembers = [
  { name: 'Valentina Rojas', email: 'valentina.rojas@email.com', plan: 'Premium mensual', end: '12 oct, 2026', status: 'Activo', initials: 'VR', color: 'coral' },
  { name: 'Mateo Cárdenas', email: 'mateo.cardenas@email.com', plan: 'Entrenamiento personal', end: '14 oct, 2026', status: 'Activo', initials: 'MC', color: 'mint' },
  { name: 'Isabella Torres', email: 'isabella.torres@email.com', plan: 'Plan trimestral', end: '16 oct, 2026', status: 'Por vencer', initials: 'IT', color: 'lilac' },
  { name: 'Samuel Herrera', email: 'samuel.herrera@email.com', plan: 'Premium mensual', end: '18 oct, 2026', status: 'Activo', initials: 'SH', color: 'yellow' },
];

const formatCurrency = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value);

function Metric({ icon: Icon, label, value, change, direction, tone }) {
  return <article className="metric">
    <div className="metric-topline"><span className={`metric-icon ${tone}`}><Icon size={18} /></span>
      <span className={`metric-change ${direction}`}>{direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span>
    </div>
    <p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-caption">vs. mes anterior</p>
  </article>;
}

function MemberDialog({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('Premium mensual');
  function submit(event) {
    event.preventDefault();
    onAdd({ name: name.trim(), email: email.trim(), plan });
  }
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-heading"><div><span className="eyebrow">NUEVA MEMBRESÍA</span><h2 id="dialog-title">Añadir miembro</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
      </div>
      <form onSubmit={submit} className="member-form">
        <label>Nombre completo<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Camila Pérez" /></label>
        <label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" /></label>
        <label>Plan<select value={plan} onChange={(event) => setPlan(event.target.value)}><option>Premium mensual</option><option>Plan trimestral</option><option>Entrenamiento personal</option></select></label>
        <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit"><Plus size={16} /> Crear miembro</button></div>
      </form>
    </section>
  </div>;
}

export default function App() {
  const [period, setPeriod] = useState(6);
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState(initialMembers);
  const [showDialog, setShowDialog] = useState(false);
  const visibleMembers = useMemo(() => {
    const term = query.toLocaleLowerCase('es');
    return members.filter((member) => `${member.name} ${member.email} ${member.plan}`.toLocaleLowerCase('es').includes(term));
  }, [members, query]);
  function addMember(member) {
    const initials = member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('es');
    setMembers((current) => [{ ...member, end: '12 nov, 2026', status: 'Activo', initials, color: 'mint' }, ...current]);
    setShowDialog(false);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#resumen" aria-label="Passion Fitness, inicio"><span className="brand-mark"><Dumbbell size={19} /></span><span className="brand-copy"><strong>passion</strong><small>FITNESS CLUB</small></span></a>
      <div className="sidebar-label">GESTIÓN</div>
      <nav className="primary-nav" aria-label="Navegación principal">
        <a className="nav-link selected" href="#resumen"><LayoutDashboard size={18} /><span>Resumen</span><i className="nav-indicator" /></a>
        <a className="nav-link" href="#miembros"><Users size={18} /><span>Miembros</span><small className="nav-count">248</small></a>
        <a className="nav-link" href="#ingresos"><CreditCard size={18} /><span>Ingresos</span></a>
        <a className="nav-link" href="#actividad"><Activity size={18} /><span>Actividad</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-label">CLUB</div>
        <a className="nav-link" href="/admin/"><Settings2 size={18} /><span>Administración</span></a>
        <a className="nav-link" href="mailto:soporte@passionfitness.co"><CircleHelp size={18} /><span>Centro de ayuda</span></a>
        <div className="club-card"><span className="club-avatar">PF</span><span className="club-info"><strong>Passion Fitness</strong><small>Sede principal</small></span><ChevronDown size={15} /></div>
      </div>
    </aside>

    <main className="main-content" id="resumen">
      <header className="topbar"><div className="breadcrumb"><span>Passion Fitness</span><i>/</i><strong>Resumen</strong></div>
        <div className="topbar-actions"><span className="today"><CalendarDays size={15} /> Domingo, 11 de octubre</span><button className="icon-button notification-button" type="button" aria-label="Notificaciones"><Bell size={18} /><i /></button><span className="user-avatar" aria-label="Perfil de Andrea M.">AM</span></div>
      </header>
      <div className="page-wrap">
        <section className="page-heading"><div><p className="eyebrow">DOMINGO, 11 OCTUBRE 2026</p><h1>Tu club, en movimiento<span>.</span></h1><p className="page-subtitle">Así va Passion Fitness este mes.</p></div>
          <button className="button button-primary" type="button" onClick={() => setShowDialog(true)}><Plus size={17} /> Añadir miembro</button>
        </section>
        <section className="metrics-grid" aria-label="Indicadores del club">
          <Metric icon={Users} label="Miembros activos" value="248" change="8,2%" direction="up" tone="green" />
          <Metric icon={CalendarDays} label="Por vencer en 7 días" value="18" change="3 miembros" direction="down" tone="orange" />
          <Metric icon={CreditCard} label="Ingresos del mes" value="$31,2 M" change="12,4%" direction="up" tone="blue" />
          <Metric icon={Activity} label="Asistencia promedio" value="76%" change="4,1%" direction="up" tone="pink" />
        </section>
        <section className="overview-grid" id="ingresos">
          <article className="panel revenue-panel"><div className="panel-heading"><div><p className="eyebrow">RENDIMIENTO</p><h2>Ingresos del club</h2></div>
            <label className="select-wrap"><span className="sr-only">Periodo del gráfico</span><select value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option></select><ChevronDown size={14} /></label>
          </div>
            <div className="chart-summary"><strong>$31.200.000</strong><span className="metric-change up"><ArrowUpRight size={14} />12,4%</span><span className="chart-summary-caption">este mes</span></div>
            <div className="chart-wrap"><Suspense fallback={null}><RevenueChart data={revenueByMonth.slice(-period)} /></Suspense></div>
          </article>
          <article className="panel pulse-panel"><div className="panel-heading"><div><p className="eyebrow">EN TIEMPO REAL</p><h2>Estado del club</h2></div><span className="live-indicator"><i /> ACTIVO</span></div>
            <div className="pulse-content"><div className="attendance-ring"><div><strong>76<span>%</span></strong><small>ocupación</small></div></div><p className="pulse-note">Buen ritmo esta semana. La asistencia está <strong>por encima del promedio</strong> de los últimos 30 días.</p></div>
            <div className="pulse-divider" /><div className="pulse-stat"><span>Hora con más asistencia</span><strong>6:00 <small>p. m.</small></strong></div><div className="pulse-stat"><span>Miembros hoy</span><strong>132 <small>/ 248</small></strong></div>
            <div className="activity-strip" aria-label="Asistencia durante la semana">{[38, 55, 46, 74, 61, 91, 70].map((height, index) => <span key={index} className={index === 5 ? 'today-bar' : ''} style={{ height: `${height}%` }} />)}</div>
            <div className="week-labels"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
          </article>
        </section>
        <section className="panel members-panel" id="miembros"><div className="panel-heading members-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2>Membresías por vencer</h2></div>
          <div className="member-tools"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar miembro" aria-label="Buscar miembro" /></label><button className="button button-quiet" type="button" onClick={() => setQuery('')}>Ver todos <ChevronDown size={15} /></button></div>
        </div>
          <div className="table-scroll"><table><thead><tr><th>MIEMBRO</th><th>PLAN</th><th>VENCIMIENTO</th><th>ESTADO</th><th aria-label="Acciones" /></tr></thead><tbody>
            {visibleMembers.map((member) => <tr key={`${member.email}-${member.name}`}>
              <td><div className="member-cell"><span className={`member-avatar ${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.email}</small></span></div></td><td className="plan-cell">{member.plan}</td><td className="date-cell">{member.end}</td><td><span className={`status-pill ${member.status === 'Activo' ? 'status-active' : 'status-due'}`}><i />{member.status}</span></td><td><button className="row-action" aria-label={`Ver ${member.name}`} type="button">···</button></td>
            </tr>)}
            {visibleMembers.length === 0 && <tr><td className="empty-state" colSpan="5">No encontramos miembros con “{query}”.</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Mostrando {visibleMembers.length} de {members.length} miembros</span><a href="#miembros">Ver membresías <ArrowUpRight size={14} /></a></div>
        </section>
        <footer className="page-footer"><span>PASSION FITNESS <i /> PANEL DE CONTROL</span><span>Hecho para moverse.</span></footer>
      </div>
    </main>
    {showDialog && <MemberDialog onClose={() => setShowDialog(false)} onAdd={addMember} />}
  </div>;
}