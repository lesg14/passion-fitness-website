import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiRequest } from './api.js';
import PasswordInput from './PasswordInput.jsx';

export default function DoorAccountManagement({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    setError('');
    try {
      setAccounts(await apiRequest('/door-accounts/'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAccounts(); }, []);

  function openForm(mode, account = null) {
    setForm({ mode, account, username: account?.username || '', password: '', confirm: '' });
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (form.mode !== 'edit' && form.password !== form.confirm) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const creating = form.mode === 'create';
      const body = form.mode === 'password' ? { password: form.password } : {
        username: form.username.trim(),
        ...(creating ? { password: form.password } : {}),
      };
      await apiRequest(creating ? '/door-accounts/' : `/door-accounts/${form.account.id}/`, {
        method: creating ? 'POST' : 'PATCH', body,
      });
      setForm(null);
      showToast(creating ? 'Cuenta de puerta creada.' : form.mode === 'password' ? 'Contraseña actualizada.' : 'Cuenta de puerta actualizada.');
      await loadAccounts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(account) {
    if (!window.confirm(`${account.is_active ? 'Desactivar' : 'Activar'} el acceso de ${account.username}?`)) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/door-accounts/${account.id}/`, { method: 'PATCH', body: { is_active: !account.is_active } });
      showToast(`Acceso de ${account.username} ${account.is_active ? 'desactivado' : 'activado'}.`);
      await loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel members-panel door-accounts" aria-label="Cuentas de puerta">
      <div className="panel-heading members-heading">
        <div><h2>Cuentas de puerta</h2><p className="staff-password-note">Acceso exclusivo al registro de entradas del kiosco.</p></div>
        <button className="button button-quiet" type="button" onClick={() => openForm('create')}><Plus size={16} /> Crear cuenta de puerta</button>
      </div>
      {error && <div className="api-notice" role="alert">{error}<button type="button" onClick={loadAccounts}>Reintentar</button></div>}
      {loading ? <p>Cargando cuentas…</p> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>USUARIO</th><th>ACCESO</th><th>ACCIONES</th></tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.username}</td>
                  <td><span className={`status-pill ${account.is_active ? 'status-active' : 'status-inactive'}`}>{account.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td><div className="staff-actions">
                    <button className="action-btn" type="button" disabled={busy} onClick={() => openForm('edit', account)}>Editar</button>
                    <button className="action-btn" type="button" disabled={busy} onClick={() => openForm('password', account)}>Contraseña</button>
                    <button className="action-btn" type="button" disabled={busy} onClick={() => toggleActive(account)}>{account.is_active ? 'Desactivar' : 'Activar'}</button>
                  </div></td>
                </tr>
              ))}
              {!accounts.length && !error && <tr><td className="empty-state" colSpan={3}>Aún no hay cuentas de puerta.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {form && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="door-account-title">
            <div className="dialog-heading"><h2 id="door-account-title">{form.mode === 'create' ? 'Crear cuenta de puerta' : form.mode === 'edit' ? 'Editar cuenta de puerta' : `Contraseña de ${form.account.username}`}</h2></div>
            <form className="member-form" onSubmit={submit}>
              {form.mode !== 'password' && <label>Usuario<input required maxLength={150} autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>}
              {form.mode !== 'edit' && <>
                <PasswordInput label="Nueva contraseña" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <PasswordInput label="Confirmar contraseña" autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
                <p className="staff-password-note">Usa al menos 8 caracteres; evita contraseñas comunes, totalmente numéricas o parecidas al usuario.</p>
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
    </section>
  );
}
