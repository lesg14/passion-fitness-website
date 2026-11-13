import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from './api.js';
import brandLogo from './passion-fitness-logo.png';

const RESET_MS = 6000;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'entrar'];

function DoorLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kiosk">
      <img className="kiosk-logo" src={brandLogo} alt="Passion Fitness" />
      <form className="kiosk-login" onSubmit={submit}>
        <p>Activar equipo de acceso</p>
        <input aria-label="Usuario" placeholder="Usuario del dispositivo" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        <input aria-label="Contraseña" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <span className="kiosk-login-error" role="alert">{error}</span>}
        <button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Activar'}</button>
      </form>
    </main>
  );
}

export default function AccessKiosk() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [digits, setDigits] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revealLast, setRevealLast] = useState(false);
  const timer = useRef(null);
  const revealTimer = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await apiRequest('/auth/csrf/');
        const current = await apiRequest('/auth/session/');
        if (active && current.role === 'door') setSession(current);
      } catch {
        // Sin sesión: se muestra el acceso del dispositivo
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer.current);
      clearTimeout(revealTimer.current);
    };
  }, []);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(revealTimer.current);
    setRevealLast(false);
    setResult(null);
    setDigits('');
  }, []);

  const showResult = useCallback((value) => {
    clearTimeout(revealTimer.current);
    setRevealLast(false);
    setResult(value);
    setDigits('');
    clearTimeout(timer.current);
    timer.current = setTimeout(reset, RESET_MS);
  }, [reset]);

  const submit = useCallback(async (value) => {
    if (busyRef.current) return;
    if (!/^[0-9]{1,10}$/.test(value)) {
      showResult({ nivel: 'rojo', permitido: false, mensaje: 'El documento debe tener entre 1 y 10 números.' });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      showResult(await apiRequest('/access/check-in/', { method: 'POST', body: { numero_documento: value } }));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setSession(null);
        return;
      }
      const message = error.status === 429
        ? 'Demasiados intentos. Espera un momento o acércate a recepción.'
        : error.status === 400 ? error.message : 'Sin conexión. Acércate a recepción.';
      showResult({ nivel: 'rojo', permitido: false, mensaje: message });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [showResult]);

  const press = useCallback((key) => {
    if (busyRef.current) return;
    if (result) {
      clearTimeout(timer.current);
      setResult(null);
    }
    if (key === 'borrar') {
      clearTimeout(revealTimer.current);
      setRevealLast(false);
      setDigits((current) => current.slice(0, -1));
    } else if (key === 'entrar') {
      if (digits) submit(digits);
    } else if (digits.length < 10) {
      setDigits(digits + key);
      setRevealLast(true);
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealLast(false), 900);
    }
  }, [digits, result, submit]);

  useEffect(() => {
    if (!session) return undefined;
    function onKeyDown(event) {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('borrar');
      else if (event.key === 'Enter') press('entrar');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, press]);

  async function handleLogin(username, password) {
    await apiRequest('/auth/login/', { method: 'POST', body: { username, password, role: 'door' } });
    setSession(await apiRequest('/auth/session/'));
  }

  if (loading) return <main className="kiosk" />;
  if (!session) return <DoorLogin onLogin={handleLogin} />;

  return (
    <main className="kiosk">
      <img className="kiosk-logo" src={brandLogo} alt="Passion Fitness" />
      <h1>¡Bienvenido a Passion Fitness!</h1>
      <p className="kiosk-hint">Digita tu número de cédula para ingresar</p>
      <div className="kiosk-display" aria-live="polite" aria-label="Número de documento">
        <span className="kiosk-digits">
          {`${'*'.repeat(revealLast ? digits.length - 1 : digits.length)}${revealLast ? digits.slice(-1) : ''}`}
        </span>
        <span className="kiosk-caret" aria-hidden="true" />
      </div>
      <div className="kiosk-pad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`kiosk-key ${key === 'entrar' ? 'kiosk-enter' : ''}`}
            disabled={busy || (key === 'entrar' && digits.length === 0)}
            onClick={() => press(key)}
          >
            {key === 'borrar' ? '⌫' : key === 'entrar' ? 'Entrar' : key}
          </button>
        ))}
      </div>
      {result && (
        <div className="kiosk-toast-wrap">
          <button
            type="button"
            className={`kiosk-toast ${result.permitido ? 'kiosk-toast-ok' : 'kiosk-toast-denied'}`}
            role="alert"
            onClick={reset}
          >
            <span className="kiosk-toast-head">
              <span aria-hidden="true">{result.permitido ? '✓' : '✕'}</span>
              {result.permitido ? 'Acceso permitido' : 'Acceso denegado'}
            </span>
            <span className={`kiosk-toast-message kiosk-msg-${result.nivel}`}>{result.mensaje}</span>
            <span className="kiosk-toast-close">Toca para cerrar</span>
          </button>
        </div>
      )}
    </main>
  );
}
