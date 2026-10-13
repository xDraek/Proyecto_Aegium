// Copia el mundo entero (cuentas, partidas, islas, alianzas, chat…) de un sitio a otro, para
// sacar una copia de seguridad o mudar el juego de servidor. Cada sitio es una base de datos
// Postgres o un archivo JSON (el mismo formato que server/data/world.json):
//
//   node server/copia.mjs <origen> <destino>
//
// Un sitio es la ruta de un .json, una URL postgres://… o env:NOMBRE para leer la URL de esa
// variable de entorno (así la contraseña no queda en el historial de la terminal). Ejemplos:
//
//   $env:ORIGEN = "postgres://…"; node server/copia.mjs env:ORIGEN server/data/copia.json
//   node server/copia.mjs server/data/copia.json env:DATABASE_URL
//
// Las cuentas conservan su número, así que las sesiones siguen valiendo si el servidor nuevo usa
// el mismo AUTH_SECRET. Para no pisar nada, el destino tiene que estar vacío.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PgStore } from './store.js';

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('Uso: node server/copia.mjs <origen> <destino>   (cada uno: archivo.json, postgres://… o env:VARIABLE)');
  process.exit(1);
}

/** La URL de Postgres de un sitio, o null si es un archivo. */
function pgUrl(where) {
  if (where.startsWith('env:')) {
    const url = process.env[where.slice(4)];
    if (!url) throw new Error(`La variable de entorno ${where.slice(4)} está vacía.`);
    return url;
  }
  return /^postgres(ql)?:\/\//.test(where) ? where : null;
}

/** Nombre del sitio para los mensajes (sin la contraseña). */
const label = (where) => (pgUrl(where) ? `Postgres en ${new URL(pgUrl(where)).host}` : where);

async function read(where) {
  const url = pgUrl(where);
  if (!url) return { meta: {}, users: [], players: {}, islands: [], islandStates: {}, chat: [], ...JSON.parse(await readFile(where, 'utf8')) };
  const store = new PgStore(url);
  await store.init();
  try {
    // (el servidor solo carga los 200 últimos mensajes del chat; la copia, igual)
    return await store.load();
  } finally {
    await store.pool.end();
  }
}

async function write(where, data) {
  const url = pgUrl(where);
  const nextUserId = Math.max(0, ...data.users.map((u) => u.id)) + 1;
  if (!url) {
    try {
      await access(where);
      throw new Error(`${where} ya existe: elige otro nombre para no pisarlo.`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    await mkdir(dirname(where), { recursive: true });
    await writeFile(where, JSON.stringify({ ...data, meta: { ...data.meta, nextUserId } }));
    return;
  }
  const store = new PgStore(url);
  await store.init();
  const client = await store.pool.connect();
  try {
    const { rows } = await client.query('select (select count(*) from users) + (select count(*) from players) + (select count(*) from islands) + (select count(*) from meta) as n');
    if (Number(rows[0].n) > 0) throw new Error('La base de datos de destino no está vacía: no la piso.');
    await client.query('begin');
    for (const u of data.users) {
      await client.query('insert into users (id, username, username_lc, pass, created, email) values ($1, $2, $3, $4, $5, $6)', [
        u.id,
        u.username,
        u.username.toLowerCase(),
        u.pass,
        u.created,
        u.email ?? null,
      ]);
    }
    // Que las cuentas nuevas sigan numerándose después de las copiadas
    await client.query(`select setval(pg_get_serial_sequence('users', 'id'), $1, false)`, [nextUserId]);
    for (const [key, value] of Object.entries(data.meta)) {
      if (key === 'nextUserId') continue;
      await client.query('insert into meta (key, value) values ($1, $2)', [key, JSON.stringify(value)]);
    }
    for (const [uid, state] of Object.entries(data.players)) {
      await client.query('insert into players (user_id, state, updated) values ($1, $2, $3)', [Number(uid), JSON.stringify(state), Date.now()]);
    }
    for (const isl of data.islands) {
      const st = data.islandStates[isl.id];
      await client.query('insert into islands (id, data, state) values ($1, $2, $3)', [isl.id, JSON.stringify(isl), st ? JSON.stringify(st) : null]);
    }
    for (const msg of data.chat) await client.query('insert into chat (msg) values ($1)', [JSON.stringify(msg)]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
    await store.pool.end();
  }
}

try {
  console.log(`Leyendo ${label(from)}…`);
  const data = await read(from);
  console.log(`  ${data.users.length} cuentas, ${Object.keys(data.players).length} partidas, ${data.islands.length} islas, ${data.chat.length} mensajes`);
  console.log(`Escribiendo ${label(to)}…`);
  await write(to, data);
  console.log('Copia hecha.');
} catch (err) {
  console.error(`No se ha podido copiar: ${err.message}`);
  process.exit(1);
}
