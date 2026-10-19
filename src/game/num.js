// Números a la española: coma decimal y punto de millares. Intl en español no agrupa los números de
// cuatro cifras (da «5757»), así que se les pone el punto a mano: «5.757». Lo usan el juego, el
// servidor y el navegador.

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** «5757» → «5.757» (solo hace falta en los de cuatro cifras: los demás ya vienen agrupados). */
function group(s) {
  return s.replace(/^(-?\d)(\d{3})(?=$|,)/, '$1.$2');
}

/** Un número con punto de millares y, como mucho, `decimals` decimales (0, 1 o 2). */
export function fmtEs(n, decimals = 0) {
  return group((decimals >= 2 ? nf2 : decimals === 1 ? nf1 : nf0).format(n));
}
