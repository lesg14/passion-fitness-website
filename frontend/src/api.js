const apiBase = import.meta.env.VITE_API_BASE_URL || '';
let csrfToken = '';

function getCookie(name) {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function setCsrfToken(token) {
  if (token) csrfToken = token;
}

export async function fetchCsrfToken() {
  const response = await fetch(`${apiBase}/api/auth/csrf/`, { credentials: 'same-origin' });
  const data = await response.json();
  if (data?.csrfToken) {
    csrfToken = data.csrfToken;
  }
  return csrfToken || getCookie('csrftoken') || '';
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...options.headers };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Tomamos siempre el token más reciente de la cookie o de memoria
    let token = getCookie('csrftoken') || csrfToken;
    if (!token) {
      token = await fetchCsrfToken();
    }
    headers['X-CSRFToken'] = token;
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

  if (data && data.csrfToken) {
    csrfToken = data.csrfToken;
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      Object.entries(data || {})
        .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
        .join(' ');

    // Si falló por CSRF (por ejemplo cookie desfasada tras rotación de login), refrescamos y reintentamos 1 vez
    if (
      response.status === 403 &&
      typeof detail === 'string' &&
      detail.toLowerCase().includes('csrf') &&
      !options._retried
    ) {
      await fetchCsrfToken();
      return apiRequest(path, { ...options, _retried: true });
    }

    const error = new Error(detail || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return data;
}
