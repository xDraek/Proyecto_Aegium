import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, universe } from '../src/config.js';
import { WORLD_EVENTS } from '../src/game/data.js';
import { worldEventAt } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Los comandos de los moderadores para desencadenar eventos: /temporada, /kraken, /horda,
// /piratas, /visitante, /competicion y /gesta con tema.

process.env.ADMINS = 'Lucio';

async function adminWorld() {
  const env = await makeWorld();
  const [A, B] = env.players;
  return { ...env, W: env.world, A, B };
}

test('solo los moderadores pueden desencadenar eventos', async () => {
  const { W, B } = await adminWorld();
  assert.throws(() => W.adminEvent(B.userId, 'kraken'), /moderadores/);
});

test('/temporada pone una temporada ya, manda sobre el calendario y /temporada off la termina', async () => {
  const { W, A, advance } = await adminWorld();
  const text = W.adminEvent(A.userId, 'temporada', 'estrellas 2');
  assert.match(text, /Lluvia de estrellas/);
  const { start } = W.meta.eventOverride;
  assert.ok(Math.abs(start - clock.now()) < 1000, 'empieza ya');
  const ev = worldEventAt(clock.now());
  assert.equal(ev.id, 'estrellas');
  assert.equal(ev.start, start);
  // Se anuncia y la partida de cada jugador la nota (el estado que reciben la lleva)
  advance(1000);
  assert.ok(W.chat.some((m) => /Comienza Lluvia de estrellas/.test(m.text)));
  assert.deepEqual(W.snapshot(A.userId).eventOverride, universe.eventOverride);
  // Termina sola a las 2 h (de juego)…
  assert.equal(worldEventAt(ev.end).id === 'estrellas' && worldEventAt(ev.end).start === ev.start, false);
  // …o a mano
  assert.match(W.adminEvent(A.userId, 'temporada', 'off'), /terminada/);
  assert.notEqual(worldEventAt(clock.now()).start, ev.start);
  assert.throws(() => W.adminEvent(A.userId, 'temporada', 'off'), /ninguna/);
  assert.throws(() => W.adminEvent(A.userId, 'temporada', 'nieve'), /No hay ninguna temporada/);
  assert.throws(() => W.adminEvent(A.userId, 'temporada', ''), new RegExp(Object.keys(WORLD_EVENTS)[0]));
  universe.eventOverride = null;
});

test('la temporada a mano recorta los tramos del calendario de alrededor', () => {
  const start = 10_000_000, end = start + 3_600_000;
  universe.eventOverride = { id: 'oro', start, end };
  try {
    const before = worldEventAt(start - 1);
    assert.ok(before.end <= start);
    assert.equal(worldEventAt(start).id, 'oro');
    assert.equal(worldEventAt(end - 1).id, 'oro');
    const after = worldEventAt(end);
    assert.ok(after.start >= end);
  } finally {
    universe.eventOverride = null;
  }
});

test('/kraken lo despierta ya, y no dos veces', async () => {
  const { W, A } = await adminWorld();
  W.meta.kraken = { lair: null, wakeAt: clock.now() + 1e12 };
  assert.match(W.adminEvent(A.userId, 'kraken'), /El Kraken despierta/);
  const lair = W.meta.kraken.lair;
  assert.ok(lair != null && W.islandStates.get(lair).kraken);
  assert.throws(() => W.adminEvent(A.userId, 'kraken'), /ya está despierto/);
});

test('/horda llega al continente con colonias más cercano', async () => {
  const { W, A } = await adminWorld();
  assert.throws(() => W.adminEvent(A.userId, 'horda'), /ningún continente/);
  const land = [...W.islands.values()].find((i) => i.land);
  A.state.colonies.push({ id: land.id, name: land.name, specialty: 'madera', yield: 1 });
  assert.match(W.adminEvent(A.userId, 'horda'), /Horda bárbara/);
  assert.ok(W.islandStates.get(land.land).horde);
  assert.throws(() => W.adminEvent(A.userId, 'horda'), /ningún continente/);
});

test('/piratas y /visitante llegan a la isla del jugador dicho', async () => {
  const { W, A, B } = await adminWorld();
  assert.match(W.adminEvent(A.userId, 'piratas', 'Anibal'), /Anibal/);
  assert.ok(B.state.raid);
  assert.throws(() => W.adminEvent(A.userId, 'piratas', 'Anibal'), /Ya hay piratas/);
  // Sin nombre, para el propio moderador; y con el tipo de visitante elegido
  assert.match(W.adminEvent(A.userId, 'visitante', 'mercader'), /Mercader ambulante/);
  assert.equal(A.state.visitor.kind, 'mercader');
  assert.match(W.adminEvent(A.userId, 'visitante', 'mercenarios Anibal'), /Mercenarios/);
  assert.equal(B.state.visitor.kind, 'mercenarios');
  // Los peregrinos y el naufragio no se quedan esperando: dejan lo suyo al momento
  const reports = B.state.reports.length;
  B.state.visitor = null;
  W.adminEvent(A.userId, 'visitante', 'naufragio anibal');
  assert.equal(B.state.reports.length, reports + 1);
  assert.throws(() => W.adminEvent(A.userId, 'piratas', 'Nadie'), /ningún jugador/);
});

test('/competicion la termina ya, reparte premios y empieza otra', async () => {
  const { W, A, B } = await adminWorld();
  W.tick();
  const n = W.meta.contest.n;
  B.state.stats.kills = (B.state.stats.kills ?? 0) + 500;
  assert.match(W.adminEvent(A.userId, 'competicion'), /terminada/);
  assert.equal(W.meta.contest.n, n + 1);
  assert.ok(W.meta.contest.end > clock.now());
  assert.equal(W.meta.hall[0].n, n);
});

test('/gesta acepta el tema', async () => {
  const { W, A } = await adminWorld();
  const res = W.adminStartFeat(A.userId, { site: 'hidra', omenMinutes: 1 });
  const f = W.islandStates.get(res.site).feat;
  assert.equal(f.theme, 'hidra');
  assert.ok(W.chat.some((m) => /Hidra de Lerna/.test(m.text)));
});
