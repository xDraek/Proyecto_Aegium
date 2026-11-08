// Llamadas al servidor. La sesión es un token que se guarda en el navegador.

const TOKEN_KEY = 'aegium.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // sin almacenamiento: la sesión dura lo que la pestaña
  }
}

/**
 * Las versiones de la lista de islas y de su estado que ya tiene el navegador: el servidor no repite
 * la lista si no cambia, y del estado solo manda las islas que han cambiado.
 */
export const session = { islandsRev: null, statesRev: null };

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(method, path, body, retried = false) {
  const token = getToken();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(session.islandsRev ? { 'x-islands': session.islandsRev } : {}), ...(session.statesRev ? { 'x-states': session.statesRev } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    // respuesta vacía
  }
  // Una comprobación contra los bots: se responde y se repite lo que se iba a hacer
  if (res.status === 428 && data.challenge && !retried) {
    const { askChoice } = await import('../ui/dialog.js');
    const c = data.challenge;
    const answer = await askChoice(c.question, c.options.map((o) => ({ label: o, value: o })), { title: '¿Sigues ahí?', icon: '🤖' });
    if (answer == null) throw new ApiError('Hace falta la comprobación para seguir.', 428, data);
    const check = await api('POST', '/api/human', { id: c.id, answer });
    if (!check.ok) throw new ApiError('No era ese. Inténtalo otra vez.', 428, data);
    return api(method, path, body, true);
  }
  if (!res.ok) throw new ApiError(data.error ?? `Error ${res.status}`, res.status, data);
  return data;
}
