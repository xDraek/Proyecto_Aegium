// Ajustes compartidos por el navegador y el servidor.

/**
 * Velocidad del universo (producción, obras, viajes…). La decide el servidor
 * (variable GAME_SPEED) y el navegador la recibe al conectarse. `eventOverride`:
 * una temporada del archipiélago puesta a mano por los moderadores ({ id, start, end }).
 */
export const universe = { speed: 1, eventSeed: 0, eventOverride: null };

/** Reloj del juego. En el navegador se corrige con la hora del servidor. */
export const clock = {
  offset: 0,
  now: () => Date.now() + clock.offset,
};
