import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { KRAKEN_RULES } from '../src/game/data.js';
import { featHours } from '../src/game/feats.js';
import { garrisonAt } from '../src/game/Game.js';
import { coordsCenter, coordsOf, fmtCoords } from '../src/game/world.js';
import { makeWorld, sendAndArrive } from './world.js';

// El Kraken: uno solo para todos los mares, que despierta cuando nadie sabe en una de las fosas.

const lairsOf = (W) => [...W.islands.values()].filter((i) => i.type === 'kraken');
const BIG = { dromon: 80, hoplita: 900, espadachin: 400 };

test('las coordenadas del mapa: casillas de 50 leguas con [50:50] en el centro', () => {
  assert.deepEqual(coordsOf(0, 0), [50, 50]);
  assert.deepEqual(coordsOf(260, -120), [55, 48]);
  const c = coordsCenter(55, 48);
  assert.deepEqual(coordsOf(c.x, c.z), [55, 48]);
  assert.equal(fmtCoords([55, 48]), '[55:48]');
});

test('solo hay un Kraken: despierta en una fosa a una hora que no se sabe y se avisa con coordenadas aproximadas', async () => {
  const env = await makeWorld();
  const W = env.world;
  const lairs = lairsOf(W);
  assert.ok(lairs.length >= 1);
  for (const isl of lairs) assert.equal(isl.garrison.kraken, undefined, 'las fosas ya no tienen Kraken propio');
  const k = W.meta.kraken;
  assert.equal(k.lair, null);
  assert.ok(k.wakeAt <= clock.now() + featHours(KRAKEN_RULES.windowHours), 'el primero despierta pronto');
  // El navegador no sabe cuándo
  assert.equal(JSON.stringify(W.snapshot(env.players[0].userId)).includes('wakeAt'), false);

  env.until(k.wakeAt);
  const lair = W.meta.kraken.lair;
  assert.ok(lair, 'ha despertado');
  assert.equal(lairs.filter((i) => W.islandStates.get(i.id).kraken).length, 1, 'en una sola fosa');
  const isl = W.islands.get(lair);
  const rt = W.islandStates.get(lair);
  assert.equal(garrisonAt(isl, rt, clock.now()).kraken, 1);
  // El aviso da unas coordenadas cerca de la fosa, sin decir cuál es
  const msg = W.chat.findLast((m) => m.system && m.text.includes('Kraken ha despertado'));
  const [, x, y] = msg.text.match(/\[(\d+):(\d+)\]/).map(Number);
  const [cx, cy] = coordsOf(isl.x, isl.z);
  assert.ok(Math.abs(x - cx) <= KRAKEN_RULES.hintCells && Math.abs(y - cy) <= KRAKEN_RULES.hintCells);
  assert.equal(msg.text.includes(isl.name), false);
  // Ni el navegador sabe en qué fosa está (hay que explorarla)
  assert.equal(W.snapshot(env.players[0].userId).world.states[lair].kraken, undefined);
  const [A] = env.players;
  A.state.units.bote = 1;
  sendAndArrive(env, A, 'explorar', lair, { bote: 1 });
  assert.ok(A.state.reports.some((r) => r.kind === 'exploracion' && r.text.includes('¡El Kraken está aquí!')));
});

test('quien derrota al Kraken lo duerme: vuelve tras su recuperación, en un momento cualquiera de la ventana', async () => {
  const env = await makeWorld();
  const W = env.world;
  env.until(W.meta.kraken.wakeAt);
  const lair = W.meta.kraken.lair;
  const [A] = env.players;
  Object.assign(A.state.units, BIG);
  A.state.known[lair] = { explored: true };
  const m = sendAndArrive(env, A, 'atacar', lair, BIG);
  const t = m.arrive;
  assert.equal(A.state.stats.kraken, 1, 'cuenta como derrotado');
  assert.equal(A.state.stats.lairs, 1, 'y como victoria en la fosa');
  assert.equal(W.islandStates.get(lair).kraken, false);
  const k = W.meta.kraken;
  assert.equal(k.lair, null);
  assert.ok(k.wakeAt >= t + featHours(KRAKEN_RULES.regenHours) - 1000);
  assert.ok(k.wakeAt <= t + featHours(KRAKEN_RULES.regenHours + KRAKEN_RULES.windowHours) + 1000);
  assert.ok(W.chat.some((c) => c.system && c.text.includes(`${A.state.name} ha derrotado al Kraken`)));
  // Mientras duerme no está en ninguna fosa
  env.advance(featHours(KRAKEN_RULES.regenHours) / 2);
  assert.equal(lairsOf(W).filter((i) => W.islandStates.get(i.id).kraken).length, 0);
  env.until(k.wakeAt);
  assert.ok(W.meta.kraken.lair, 'vuelve a despertar');
});

test('el Kraken no despierta en una fosa arrasada: espera a que haya alguna en pie', async () => {
  const env = await makeWorld();
  const W = env.world;
  const far = clock.now() + featHours(100);
  for (const isl of lairsOf(W)) W.islandStates.get(isl.id).stockAt = far;
  env.until(W.meta.kraken.wakeAt);
  assert.equal(W.meta.kraken.lair, null);
  assert.ok(W.meta.kraken.wakeAt > clock.now());
  for (const isl of lairsOf(W)) W.islandStates.get(isl.id).stockAt = clock.now();
  env.until(W.meta.kraken.wakeAt);
  assert.ok(W.meta.kraken.lair);
});
