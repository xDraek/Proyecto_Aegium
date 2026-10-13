import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROTECTION } from '../src/game/data.js';
import { makeWorld, sendAndArrive } from './world.js';

// Protección de los jugadores nuevos y de los débiles.

test('la protección de novato dura hasta los 1.000 puntos o los 5 primeros días', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  A.state.stats.spent = 50_000; // 500 puntos
  A.state.startedAt = A.now();
  assert.equal(A.isProtected(), true);
  A.state.stats.spent = 100_000; // 1.000 puntos
  assert.equal(A.isProtected(), false, 'con 1.000 puntos se acaba');
  A.state.stats.spent = 50_000;
  A.state.startedAt = A.now() - (PROTECTION.newbieDays * 24 + 1) * 3_600_000;
  assert.equal(A.isProtected(), false, 'pasados 5 días, también');
});

test('no se puede atacar a quien tiene menos del 20 % de tus puntos, salvo si te atacó él', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  A.state.stats.spent = 2_000_000; // 20.000 puntos
  B.state.stats.spent = 300_000; // 3.000 puntos (15 %)
  Object.assign(A.state.units, { trirreme: 10, hoplita: 30, bote: 1 });
  Object.assign(B.state.units, { trirreme: 10, hoplita: 30 });
  const plan = A.planMission('atacar', B.state.home, { trirreme: 10, hoplita: 30 });
  assert.match(plan.reason, /menos del 20 %/);
  assert.match(A.planMission('sabotaje', B.state.home, { bote: 1 }).reason, /menos del 20 %/);
  // El débil sí puede atacar al fuerte… y entonces el fuerte le puede responder
  assert.equal(B.planMission('atacar', A.state.home, { trirreme: 10, hoplita: 30 }).ok, true);
  sendAndArrive(env, B, 'atacar', A.state.home, { trirreme: 10, hoplita: 30 });
  Object.assign(A.state.units, { trirreme: 10, hoplita: 30 }); // (lo que perdió defendiéndose)
  assert.equal(A.planMission('atacar', B.state.home, { trirreme: 10, hoplita: 20 }).ok, true, 'venganza');
});
