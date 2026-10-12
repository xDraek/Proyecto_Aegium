import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { watchRange } from '../src/game/rules.js';
import { lastMission, makeWorld } from './world.js';

// La torre de vigía: se sabe quién te ataca y cuándo llega, pero qué tropas trae solo cuando la
// flota está a su alcance; cuanto más nivel, antes se ve.

/** Lucio manda una flota contra Aníbal; devuelve lo que ve Aníbal y la flota. */
async function attack(watch) {
  const env = await makeWorld();
  const [A, B] = env.players;
  B.state.buildings.torre = watch;
  Object.assign(A.state.units, { trirreme: 10, mercante: 4, hoplita: 40 });
  const res = A.sendMission('atacar', B.state.home, { trirreme: 10, mercante: 4, hoplita: 40 });
  assert.ok(res.ok, res.reason);
  const m = lastMission(A);
  const seen = (t) => env.world.incoming(B.state.home, watch, t)[0];
  return { env, A, B, m, seen };
}

test('al zarpar se sabe que vienen, pero no qué traen', async () => {
  const { seen, m } = await attack(0);
  const f = seen(clock.now());
  assert.equal(f.from, 'Lucio');
  assert.equal(f.arrive, m.arrive);
  assert.equal(f.units, null);
  assert.equal(f.size, null);
  assert.ok(f.revealAt > clock.now() && f.revealAt <= m.arrive);
});

test('cuando la flota entra en el alcance de la torre se ven sus tropas', async () => {
  const { seen, m } = await attack(0);
  const f = seen(clock.now());
  assert.equal(seen(f.revealAt - 1).units, null);
  const later = seen(f.revealAt);
  assert.deepEqual(later.units, m.units);
  assert.equal(later.size, 54);
});

test('con más nivel de torre se ven antes', async () => {
  const low = (await attack(1)).seen(clock.now());
  const high = (await attack(8)).seen(clock.now());
  assert.ok(high.revealAt < low.revealAt, 'la torre alta las ve antes');
  assert.ok(watchRange(8) > watchRange(1));
});

test('el estado que recibe el defensor no lleva las tropas antes de verlas', async () => {
  const { env, B } = await attack(0);
  const snap = env.world.snapshot(B.userId);
  assert.equal(snap.incoming.length, 1);
  assert.equal(snap.incoming[0].units, null);
  assert.ok(!JSON.stringify(snap).includes('"hoplita":40'));
});
