import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiRequest } from './api.js';

const emptyForm = { username: '', first_name: '', last_name: '', email: '', current_password: '', password: '', confirm: '' };

export default function StaffManagement({ showToast, onProfileChanged }) {
  const [staff, setStaff] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [mode, setMode] = useState('');
  const [target, setTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStaff() {
    setLoading(true);
    setError('');
    try {
      setStaff(await apiRequest('/staff/'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    setProfileLoading(true);
    setProfileError('');
    try {
      setProfile(await apiRequest('/auth/admin-profile/'));
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => { loadStaff(); loadProfile(); }, []);

  function openForm(nextMode, person = null, username = '') {
    setMode(nextMode);
    setTarget(person);
    setForm({ ...emptyForm, ...(person || {}), username: person?.username || username, current_password: '', password: '', confirm: '' });
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    if (['create', 'password', 'profile-password'].includes(mode) && form.password !== form.confirm) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }
    const isProfile = mode === 'profile' || mode === 'profile-password';
    const body = mode === 'password' || mode === 'profile-password'
      ? { password: form.password, ...(mode === 'profile-password' ? { current_password: form.current_password } : {}) }
      : { username: form.username.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), ...(mode === 'create' ? { password: form.password } : {}) };
    setBusy(true);
    try {
      const updated = await apiRequest(isProfile ? '/auth/admin-profile/' : mode === 'create' ? '/staff/' : `/staff/${target.id}/`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body,
      });
      setForm(null);
      showToast(mode === 'password' || mode === 'profile-password' ? 'Contraseña actualizada.' : mode === 'create' ? 'Recepcionista creado.' : 'Datos actualizados.');
      if (isProfile) {
        setProfile(updated);
        onProfileChanged(updated);
      } else {
        await loadStaff();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(person) {
    if (!window.confirm(`${person.is_active ? 'Desactivar' : 'Activar'} el acceso de ${person.username}?`)) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/staff/${person.id}/`, { method: 'PATCH', body: { is_active: !person.is_active } });
      showToast(`Acceso de ${person.username} ${person.is_active ? 'desactivado' : 'activado'}.`);
      await loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const suggested = ['recepcion1', 'recepcion2'].filter(
    (name) => !staff.some((person) => person.username.toLowerCase() === name),
  );

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Personal<span>.</span></h1>
          <p className="page-subtitle">Edita tu cuenta y gestiona el acceso del personal de recepción.</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => openForm('create')}><Plus size={17} /> Crear recepcionista</button>
      </section>
      <section className="panel members-panel staff-profile" aria-label="Mi cuenta de administrador">
        <div className="panel-heading members-heading">
          <h2>Mi cuenta de administrador</h2>
        </div>
        {profileLoading ? <p>Cargando cuenta…</p> : profileError ? (
          <div className="form-error" role="alert">{profileError} <button type="button" className="action-btn" onClick={loadProfile}>Reintentar</button></div>
        ) : profile && (
          <div className="staff-profile-details">
            <div><strong>{`${profile.first_name} ${profile.last_name}`.trim() || 'Nombre sin registrar'}</strong><span>Usuario: {profile.username} · Correo: {profile.email || 'Sin registrar'}</span></div>
            <div className="staff-actions">
              <button className="action-btn" type="button" onClick={() => openForm('profile', profile)}>Editar mi cuenta</button>
              <button className="action-btn" type="button" onClick={() => openForm('profile-password', profile)}>Cambiar mi contraseña</button>
            </div>
          </div>
        )}
      </section>
      {error && <div className="api-notice" role="alert">{error}<button type="button" onClick={loadStaff}>Reintentar</button></div>}
      {!loading && !error && suggested.length > 0 && (
        <div className="staff-initial">
          <p>Para crear las cuentas iniciales, selecciona cada usuario y asigna una contraseña individual:</p>
          <div>{suggested.map((name) => <button key={name} type="button" className="button button-quiet" onClick={() => openForm('create', null, name)}>{name}</button>)}</div>
        </div>
      )}
      <section className="panel members-panel" aria-label="Recepcionistas">
        <div className="panel-heading members-heading"><h2>Recepcionistas</h2></div>
        {loading ? <p>Cargando personal…</p> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>USUARIO</th><th>NOMBRE</th><th>CORREO</th><th>ACCESO</th><th>ACCIONES</th></tr></thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <td>{person.username}</td>
                    <td>{`${person.first_name} ${person.last_name}`.trim() || '—'}</td>
                    <td>{person.email || '—'}</td>
                    <td><span className={`status-pill ${person.is_active ? 'status-active' : 'status-inactive'}`}>{person.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td><div className="staff-actions">
                      <button className="action-btn" type="button" disabled={busy} onClick={() => openForm('edit', person)}>Editar</button>
                      <button className="action-btn" type="button" disabled={busy} onClick={() => openForm('password', person)}>Contraseña</button>
                      <button className="action-btn" type="button" disabled={busy} onClick={() => toggleActive(person)}>{person.is_active ? 'Desactivar' : 'Activar'}</button>
                    </div></td>
                  </tr>
                ))}
                {!staff.length && !error && <tr><td className="empty-state" colSpan={5}>Aún no hay recepcionistas registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="staff-dialog-title">
            <div className="dialog-heading"><h2 id="staff-dialog-title">{mode === 'create' ? 'Crear recepcionista' : mode === 'edit' ? 'Editar recepcionista' : mode === 'profile' ? 'Editar mi cuenta' : mode === 'profile-password' ? 'Cambiar mi contraseña' : `Contraseña de ${target.username}`}</h2></div>
            <form className="member-form" onSubmit={submit}>
              {mode !== 'password' && mode !== 'profile-password' && <>
                <label>Usuario<input required maxLength={150} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
                <label>Nombres<input maxLength={150} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
                <label>Apellidos<input maxLength={150} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
                <label>Correo electrónico (opcional)<input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              </>}
              {mode === 'profile-password' && (
                <label>Contraseña actual<input type="password" required autoComplete="current-password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></label>
              )}
              {['create', 'password', 'profile-password'].includes(mode) && <>
                <label>Contraseña<input type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
                <label>Confirmar contraseña<input type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
                <p className="staff-password-note">Usa al menos 8 caracteres; evita contraseñas comunes, totalmente numéricas o parecidas a los datos del usuario.</p>
              </>}
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="dialog-actions">
                <button className="button button-quiet" type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button>
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
