const apiBase = import.meta.env.VITE_API_BASE_URL || '';
let csrfToken = '';

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...options.headers };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) {
      const csrfResponse = await fetch(`${apiBase}/api/auth/csrf/`, { credentials: 'same-origin' });
      const csrfData = await csrfResponse.json();
      if (!csrfResponse.ok) throw new Error(csrfData.detail || 'No se pudo iniciar la sesión segura.');
      csrfToken = csrfData.csrfToken;
    }
    headers['X-CSRFToken'] = csrfToken;
  }

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBase}/api${path}`, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail || Object.entries(data).map(([field, errors]) =>
      `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`,
    ).join(' ');
    const error = new Error(detail || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return data;
}