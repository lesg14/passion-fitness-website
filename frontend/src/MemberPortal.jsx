import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Flame, LogOut, X } from 'lucide-react';
import { apiRequest } from './api.js';

const monthFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function getCalendarCells(days) {
  if (!days.length) return [];
  const firstDay = new Date(`${days[0].fecha}T12:00:00Z`);
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  return [...Array(mondayOffset).fill(null), ...days];
}

function shiftMonth(month, amount) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

export default function MemberPortal({ user, onLogout }) {
  const [portal, setPortal] = useState(null);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    let active = true;
    const url = selectedMonth
      ? `/member/portal/?month=${encodeURIComponent(selectedMonth)}`
      : '/member/portal/';
    apiRequest(url)
      .then((data) => { if (active) setPortal(data); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [selectedMonth]);

  const cells = useMemo(() => getCalendarCells(portal?.attendance.days || []), [portal]);

  async function logout() {
    await apiRequest('/auth/logout/', { method: 'POST' });
    onLogout();
  }

  if (error) {
    return <main className="loading-screen"><p className="form-error">{error}</p></main>;
  }
  if (!portal) return <main className="loading-screen">Cargando tu información…</main>;

  const memberName = `${portal.member.nombre} ${portal.member.apellidos}`.trim();
  const membership = portal.membership;
  const attendance = portal.attendance;
  const currentMonth = portal.today.slice(0, 7);
  const canGoNext = portal.month < currentMonth;

  return (
    <div className="member-portal">
      <header className="member-portal-header">
        <div>
          <p className="eyebrow">PASSION FITNESS · PORTAL DE MIEMBROS</p>
          <h1>¡Bienvenido/a, {portal.member.nombre}<span>!</span></h1>
          <p className="page-subtitle">Aquí puedes consultar tu asistencia y tus pagos.</p>
        </div>
        <button className="button button-quiet" type="button" onClick={logout}>
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      <main className="member-portal-content">
        {['vencida', 'vence_hoy', 'vence_1_dia', 'vence_2_dias', 'vence_3_dias'].includes(membership.estado) && (
          <div className={`member-expired-alert ${membership.estado === 'vencida' || membership.estado === 'vence_hoy' ? 'urgent' : ''}`} role="alert">
            <div>
              <strong>{membership.estado === 'vencida' ? 'Tu plan está vencido' : 'Tu plan está próximo a vencer'}</strong>
              <p>{membership.mensaje}</p>
            </div>
            <span>Acércate a recepción para renovarlo.</span>
          </div>
        )}
        <section className="member-portal-metrics">
          <article className="member-portal-card">
            <Clock3 size={19} />
            <span>Días restantes</span>
            <strong>{membership.dias_restantes ?? '—'}</strong>
            <small>{membership.plan || 'Sin membresía vigente'}</small>
          </article>
          <article className="member-portal-card">
            <CalendarCheck size={19} />
            <span>Asistencia de {monthFormatter.format(new Date(`${portal.month}-01T12:00:00Z`))}</span>
            <strong>{attendance.percentage}%</strong>
            <small>{attendance.attended} de {attendance.expected} días operativos</small>
          </article>
          <article className={`member-portal-card ${attendance.streak_active ? 'streak-active' : ''}`}>
            <Flame size={19} />
            <span>Racha</span>
            <strong>{attendance.streak} días</strong>
            <small>{attendance.streak_active ? '¡Racha activa!' : 'Llega a 3 días seguidos para activarla'}</small>
          </article>
        </section>

        <section className="member-portal-grid">
          <article className="member-portal-panel">
            <div className="member-portal-panel-heading">
              <div><p className="eyebrow">ASISTENCIA MENSUAL</p><h2>{monthFormatter.format(new Date(`${portal.month}-01T12:00:00Z`))}</h2></div>
              <div className="member-calendar-navigation">
                <button
                  className="button button-quiet member-calendar-current"
                  type="button"
                  onClick={() => setSelectedMonth(currentMonth)}
                  disabled={portal.month === currentMonth}
                >
                  Mes actual
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSelectedMonth(shiftMonth(portal.month, -1))}
                  aria-label="Ver mes anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSelectedMonth(shiftMonth(portal.month, 1))}
                  disabled={!canGoNext}
                  aria-label="Ver mes siguiente"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
              <div className="member-calendar-legend"><span><Check size={13} /> Asistió</span><span><X size={13} /> Faltó</span></div>
            </div>
            <p className="member-calendar-note">Los domingos el gimnasio permanece cerrado. Los lunes festivos cuentan como días operativos.</p>
            <div className="member-calendar-weekdays">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="member-calendar">
              {cells.map((day, index) => {
                if (!day) return <span className="member-calendar-empty" key={`empty-${index}`} />;
                const label = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.fecha}T12:00:00Z`));
                return (
                  <span className={`member-calendar-day ${day.estado}`} key={day.fecha} title={day.estado}>
                    <b>{label}</b>
                    {day.estado === 'asistio' && <Check size={14} aria-label="Asistió" />}
                    {day.estado === 'falto' && <X size={14} aria-label="Faltó" />}
                    {day.estado === 'cerrado' && <small>Cerrado</small>}
                  </span>
                );
              })}
            </div>
          </article>

          <article className="member-portal-panel member-payments-panel">
            <div className="member-portal-panel-heading"><div><p className="eyebrow">HISTÓRICO</p><h2>Mis pagos</h2></div></div>
            <div className="member-payments-table-wrap">
              <table className="member-payments-table">
                <thead><tr><th>FECHA</th><th>VALOR</th><th>MÉTODO</th><th>REFERENCIA</th></tr></thead>
                <tbody>
                  {portal.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td data-label="Fecha">{payment.fecha}</td>
                      <td data-label="Valor">{currencyFormatter.format(payment.monto_cop)}</td>
                      <td data-label="Método">{payment.metodo}</td>
                      <td data-label="Referencia">{payment.referencia || '—'}</td>
                    </tr>
                  ))}
                  {!portal.payments.length && <tr><td className="empty-state" colSpan={4}>No hay pagos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="member-readonly-note">Este histórico es únicamente de lectura.</p>
          </article>
        </section>
      </main>
      <footer className="member-portal-footer">{memberName} · Información personal protegida</footer>
    </div>
  );
}
