import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABANDON } from '../src/game/data.js';
import { MACEDONIAN_CITY } from '../src/game/world.js';
import { makeWorld, sendAndArrive } from './world.js';

// Los jugadores que no vuelven: a los 30 días, un aviso por correo; a los 37 (y una semana después
// del aviso), su ciudad pasa a ser macedonia y la cuenta se queda sin ciudad.

const DAY = 86_400_000;

/** Hace que `g` lleve `days` días sin entrar (contando desde `wall`). */
function idle(world, g, days, wall) {
  g.state.lastSeen = wall - days * DAY;
  world.users.get(g.userId).lastSeen = 0;
  world.users.get(g.userId).created = wall - (days + 10) * DAY;
}

test('a los 30 días se le avisa por correo, una sola vez; si vuelve, se olvida', async () => {
  const { world: W, players } = await makeWorld();
  const [, B] = players;
  const wall = Date.now();
  idle(W, B, 20, wall);
  W.checkAbandoned(undefined, wall);
  assert.equal(W.abandonMails.length, 0, 'a los 20 días, nada');
  idle(W, B, ABANDON.warnDays + 1, wall);
  W.checkAbandoned(undefined, wall);
  assert.equal(W.abandonMails.length, 1);
  assert.equal(W.abandonMails[0].email, 'anibal@prueba.es');
  assert.equal(W.abandonMails[0].city, 'Anibalpolis');
  W.checkAbandoned(undefined, wall + 3_600_000);
  assert.equal(W.abandonMails.length, 1, 'no se repite');
  // Vuelve a entrar: el aviso se olvida
  B.state.lastSeen = wall + 2 * 3_600_000;
  W.checkAbandoned(undefined, wall + 3 * 3_600_000);
  assert.equal(B.state.abandonWarn, undefined);
});

test('los que están de vacaciones no cuentan', async () => {
  const { world: W, players } = await makeWorld();
  const [, B] = players;
  const wall = Date.now();
  B.state.vacation = { since: wall - 60 * DAY, until: wall - 58 * DAY };
  idle(W, B, 60, wall);
  W.checkAbandoned(undefined, wall);
  W.checkAbandoned(undefined, wall + 10 * DAY);
  assert.equal(W.abandonMails.length, 0);
  assert.ok(W.games.has(B.userId));
});

test('a los 37 días, y una semana después del aviso, su ciudad pasa a ser macedonia', async () => {
  const env = await makeWorld();
  const { world: W, players } = env;
  const [A, B] = players;
  const wall = Date.now();
  const home = B.state.home;
  // A tenía una flota de camino hacia ella
  Object.assign(A.state.units, { lancero: 20, mercante: 2 });
  assert.ok(A.sendMission('atacar', home, { lancero: 20, mercante: 2 }).ok);
  const m = A.state.missions.at(-1);

  idle(W, B, ABANDON.abandonDays + 5, wall);
  W.checkAbandoned(undefined, wall);
  assert.ok(W.games.has(B.userId), 'primero, solo el aviso (aunque ya lleve más de 37 días)');
  W.checkAbandoned(undefined, wall + ABANDON.graceDays * DAY - 3_600_000);
  assert.ok(W.games.has(B.userId), 'aún no ha pasado una semana desde el aviso');
  W.checkAbandoned(undefined, wall + ABANDON.graceDays * DAY + 3_600_000);

  assert.ok(!W.games.has(B.userId), 'su partida se borra');
  assert.ok(W.deletedPlayers.includes(B.userId));
  const isl = W.islands.get(home);
  assert.equal(isl.type, 'macedonia');
  assert.equal(isl.owner, undefined);
  assert.equal(isl.name, 'Anibalpolis');
  assert.deepEqual(W.islandState(home).garrison, MACEDONIAN_CITY.garrison);
  assert.equal(m.phase, 'vuelta', 'la flota que iba hacia ella da media vuelta');
  // La cuenta sigue, sin ciudad, y sabe por qué
  assert.equal(W.needsCity(B.userId), true);
  assert.match(W.needCityText(B.userId), /Anibalpolis.*macedonios/);
  // Funda otra ciudad (con otra isla: la macedonia sigue ahí)
  await W.foundCity(B.userId, 'Nueva Cartago');
  const g = W.games.get(B.userId);
  assert.notEqual(g.state.home, home);
  assert.equal(W.islands.get(home).type, 'macedonia');
  assert.equal(W.islands.get(g.state.home).name, 'Nueva Cartago');
  assert.equal(W.meta.abandoned[B.userId], undefined);

  // Y la ciudad macedonia se ataca como cualquier isla neutral: a A le sale a su medida
  const view = A.island(home);
  assert.equal(view.explored, true);
  assert.equal(view.typeName, 'Ciudad macedonia');
  Object.assign(A.state.units, { caballero: 400, galeon: 60, mercante: 40 });
  env.until(m.back);
  const sent = sendAndArrive(env, A, 'atacar', home, { caballero: 400, galeon: 60, mercante: 40 });
  const report = A.state.reports.find((r) => r.island === home && r.battle);
  assert.ok(report, 'hay batalla');
  assert.ok(sent);
});

test('la ciudad abandonada se guarda: al reiniciar el servidor sigue siendo macedonia y la cuenta, sin ciudad', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { WorldServer } = await import('../server/WorldServer.js');
  const { FileStore } = await import('../server/store.js');
  const dir = await mkdtemp(join(tmpdir(), 'aegium-abandono-'));
  const open = async () => {
    const store = new FileStore(join(dir, 'world.json'));
    await store.init();
    const world = new WorldServer(store);
    await world.load();
    return world;
  };
  try {
    const W = await open();
    const a = await W.register('Lucio', 'secreto1', 'Lucipolis', { email: 'lucio@prueba.es' });
    const home = W.games.get(a).state.home;
    assert.ok(W.abandonCity(a));
    await W.persist(true);
    const W2 = await open();
    assert.equal(W2.games.has(a), false);
    assert.equal(W2.needsCity(a), true);
    assert.equal(W2.islands.get(home).type, 'macedonia');
    assert.ok(Object.keys(W2.islandState(home).garrison).length > 0);
    await W2.foundCity(a, 'Otra Roma');
    assert.notEqual(W2.games.get(a).state.home, home);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
