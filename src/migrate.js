// El juego se llamaba Imperium y guardaba los ajustes del navegador como «imperium.*».
// Al cargar, pasa los que queden al nombre nuevo («aegium.*») para no perder la sesión ni los ajustes.
// Va lo primero en main.js, antes de que nadie lea nada.

try {
  for (const old of Object.keys(localStorage)) {
    if (!old.startsWith('imperium.')) continue;
    const key = `aegium.${old.slice(9)}`;
    if (localStorage.getItem(key) == null) localStorage.setItem(key, localStorage.getItem(old));
    localStorage.removeItem(old);
  }
} catch {
  // sin localStorage (modo privado estricto) no hay nada que pasar
}
