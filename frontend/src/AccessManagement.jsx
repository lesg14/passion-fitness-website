import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api.js';

function todayInBogota() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default function AccessManagement({ members, MemberCombobox }) {
  const [date, setDate] = useState(todayInBogota);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [memberId, setMemberId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(`/access/today/?fecha=${encodeURIComponent(date)}`)
      .then((data) => { if (active) setEntries(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, refresh]);

  const availableMembers = useMemo(() => members.filter((member) => !member.archivado), [members]);
  const selected = availableMembers.find((member) => String(member.id) === String(memberId));

  async function register(event) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await apiRequest('/access/manual/', { method: 'POST', body: { member_id: selected.id } });
      setResult(response);
      setDate(todayInBogota());
      setRefresh((current) => current + 1);
      if (response.permitido) {
        setMemberId('');
      }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <p className="eyebrow">RECEPCIÓN · CONTROL DE ACCESO</p>
          <h1>Ingresos y bitácora<span>.</span></h1>
          <p className="page-subtitle">Registra ingresos manuales y consulta los intentos de acceso.</p>
        </div>
      </section>
      <section className="panel members-panel access-manual" aria-labelledby="manual-access-title">
        <h2 id="manual-access-title">Registrar ingreso manual</h2>
        <p>Busca un miembro y confirma su ingreso de hoy. Se verificará su membresía vigente; la puerta no se abre desde aquí.</p>
        <form onSubmit={register}>
          <span>Buscar por nombre, documento o correo</span>
          <MemberCombobox members={availableMembers} value={memberId} emptyLabel={null}
            label="Buscar miembro para ingreso manual"
            onChange={(value) => { setMemberId(value); setResult(null); }} />
          {selected && <p>Seleccionado: <strong>{selected.nombre}</strong> · {selected.estado} · {selected.plan || 'Sin plan'}</p>}
          <button className="button button-primary" type="submit" disabled={!selected || busy}>
            {busy ? 'Registrando…' : 'Registrar ingreso'}
          </button>
          {result && (
            <div className={`access-result ${result.error || !result.permitido ? 'access-result-error' : ''}`} role="status">
              {result.error || result.mensaje}
              {result.permitido && (result.asistencia_creada ? ' Asistencia registrada.' : ' Ya tenía asistencia hoy; se registró el reingreso.')}
            </div>
          )}
        </form>
      </section>
      <section className="panel members-panel access-log" aria-labelledby="access-log-title">
        <div className="panel-heading members-heading">
          <div><h2 id="access-log-title">Bitácora de ingresos</h2><p>Entradas permitidas y denegadas. La fecha corresponde a Colombia.</p></div>
          <label>Fecha <input type="date" value={date} max={todayInBogota()} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label>
          <button className="button button-quiet" type="button" onClick={() => { setDate(todayInBogota()); setRefresh((current) => current + 1); }}>Ver hoy</button>
          <button className="button button-quiet" type="button" onClick={() => setRefresh((current) => current + 1)}>Actualizar</button>
        </div>
        {error && <div className="api-notice" role="alert">{error}<button type="button" onClick={() => setRefresh((current) => current + 1)}>Reintentar</button></div>}
        {loading ? <p>Cargando ingresos…</p> : !error && (
          <div className="table-scroll">
            <table>
              <thead><tr><th>HORA</th><th>MIEMBRO</th><th>DOCUMENTO</th><th>RESULTADO</th><th>MOTIVO</th><th>ORIGEN</th><th>RESPONSABLE / DISPOSITIVO</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.hora}</td><td>{entry.nombre}</td><td>{entry.documento || '—'}</td>
                    <td><span className={`status-pill ${entry.resultado === 'permitido' ? 'status-active' : 'status-inactive'}`}>{entry.resultado === 'permitido' ? 'Permitido' : 'Denegado'}</span></td>
                    <td>{entry.motivo || '—'}</td><td>{entry.origen === 'manual' ? 'Manual' : 'Kiosco'}</td><td>{entry.registrado_por || entry.dispositivo || '—'}</td>
                  </tr>
                ))}
                {!entries.length && <tr><td className="empty-state" colSpan={7}>No hay ingresos registrados para esta fecha.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
