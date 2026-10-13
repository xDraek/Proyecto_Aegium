import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { makeWorld, sendAndArrive } from './world.js';

// Las islas neutrales: lo que tienen solo se sabe espiando, y quien acaba con toda su guarnición
// las deja reconstruyéndose (sin nada que atacar) hasta que se rearman.

/** Un campamento bárbaro cercano que A ya conoce. */
function camp(env, A) {
  const isl = env.world.islandsNear(A.state.home, 400).find((i) => i.type === 'barbaros');
  A.state.known[isl.id] = { explored: true };
  return isl;
}

test('arrasar un campamento lo deja reconstruyéndose: no se puede atacar hasta que se rearma', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  const isl = camp(env, A);
  B.state.known[isl.id] = { explored: true };
  A.state.units.hoplita = 300;
  A.state.units.mercante = 30;
  sendAndArrive(env, A, 'atacar', isl.id, { hoplita: 300, mercante: 30 });
  const until = env.world.islandState(isl.id).stockAt;
  assert.ok(until > clock.now(), 'se queda reconstruyéndose');
  assert.equal(B.island(isl.id).rebuildUntil, until);
  Object.assign(B.state.units, { hoplita: 50, mercante: 5 });
  const fleet = { hoplita: 50, mercante: 5 };
  assert.match(B.planMission('atacar', isl.id, fleet).reason, /reconstruyendo/);
  env.until(until);
  assert.equal(B.island(isl.id).rebuildUntil, null);
  assert.ok(!B.planMission('atacar', isl.id, fleet).reason);
});

test('una flota que llega mientras se reconstruyen vuelve sin combatir', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  const isl = camp(env, A);
  B.state.known[isl.id] = { explored: true };
  Object.assign(B.state.units, { hoplita: 40, mercante: 4 });
  assert.ok(B.sendMission('atacar', isl.id, { hoplita: 40, mercante: 4 }).ok);
  const mB = B.state.missions.at(-1);
  // A llega antes y la arrasa
  A.state.units.hoplita = 300;
  A.state.units.mercante = 30;
  const res = A.sendMission('atacar', isl.id, { hoplita: 300, mercante: 30 });
  assert.ok(res.ok);
  const mA = A.state.missions.at(-1);
  if (mA.arrive >= mB.arrive) return; // (si B llegara antes no hay nada que probar)
  env.until(mB.arrive);
  assert.equal(mB.units.hoplita, 40, 'no ha combatido');
  assert.match(B.state.reports.at(-1).title, /arrasada/);
});

test('el estado que recibe el navegador no lleva la guarnición ni el botín de las islas neutrales', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  const isl = camp(env, A);
  const snap = env.world.snapshot(A.userId);
  const st = snap.world.states[isl.id];
  assert.ok(st, 'la isla está en el estado');
  assert.equal(st.garrison, undefined);
  assert.equal(st.stock, undefined);
  assert.ok(Number.isFinite(st.stockAt));
});
