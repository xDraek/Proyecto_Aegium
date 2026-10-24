// Wipe: el mundo empieza de cero pero las cuentas se quedan (nombre, contraseña y correo).
// Se borran las partidas, las islas, el chat, las alianzas y los foros; se conservan los amigos,
// las sanciones y quién es Fundador. Cada jugador funda su ciudad nueva al volver a entrar.
//
// Con el servidor PARADO (si no, al guardar volvería a escribir el mundo viejo):
//
//   node server/wipe.mjs            → solo cuenta lo que se borraría
//   node server/wipe.mjs --borrar   → lo borra de verdad (sin vuelta atrás: haz antes una copia)
//
// Usa DATABASE_URL si existe y si no DATA_FILE (o server/data/world.json), como el servidor.

import { join } from 'node:path';
import { openStore, WIPE_KEEP } from './store.js';

const ROOT = join(import.meta.dirname, '..');
const store = await openStore({ databaseUrl: process.env.DATABASE_URL, file: process.env.DATA_FILE || join(ROOT, 'server', 'data', 'world.json') });
const data = await store.load();
const gone = Object.keys(data.meta).filter((k) => !WIPE_KEEP.includes(k));
console.log(`Almacén: ${store.kind}`);
console.log(`Cuentas que se quedan: ${data.users.length}`);
console.log(`Se borran: ${Object.keys(data.players).length} partidas, ${data.islands.length} islas, el chat y de meta: ${gone.join(', ') || 'nada'}`);
if (process.argv.includes('--borrar')) {
  await store.wipe();
  console.log('Hecho: el mundo está vacío. Al arrancar el servidor se genera uno nuevo.');
} else {
  console.log('(no se ha borrado nada: añade --borrar para hacerlo)');
}
await store.pool?.end();
