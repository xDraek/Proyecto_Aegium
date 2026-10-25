// Los últimos errores de la página, para adjuntarlos cuando un jugador avisa de un fallo
// (ver «Reportar un fallo» en ⚙).

const MAX = 5;
const errors = [];

function remember(text) {
  errors.push(`${new Date().toLocaleTimeString('es-ES')} ${String(text).slice(0, 200)}`);
  if (errors.length > MAX) errors.shift();
}

window.addEventListener('error', (e) => remember(`${e.message} (${String(e.filename ?? '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => remember(e.reason?.message ?? e.reason));

export const recentErrors = () => errors.slice();
