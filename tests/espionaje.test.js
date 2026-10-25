import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPY, SPY_TIERS } from '../src/game/data.js';
import { spyGuard, spyRisk, spyTier } from '../src/game/rules.js';
import { makeWorld, sendAndArrive } from './world.js';

// Espionaje: no hace falta para atacar; la torre de vigía da como mucho un 50 % contra los espías;
// más botes sacan más información pero es más fácil que los vean.

test('se puede atacar la ciudad de otro jugador sin haberla espiado', async () => {
  const { players } = await makeWorld();
  const [A, B] = players;
  delete A.state.known[B.state.home];
  Object.assign(A.state.units, { trirreme: 5, hoplita: 20 });
  assert.equal(A.island(B.state.home).explored, true);
  assert.equal(A.planMission('atacar', B.state.home, { trirreme: 5, hoplita: 20 }).ok, true);
});

test('la torre de vigía da como mucho un 50 % contra los espías, poco a poco', () => {
  assert.equal(spyGuard(0), 0);
  assert.ok(Math.abs(spyGuard(1) - 0.025) < 1e-9);
  assert.ok(Math.abs(spyGuard(20) - 0.5) < 1e-9);
  assert.equal(spyGuard(40), SPY.guardMax);
  for (let n = 1; n < 25; n++) assert.ok(spyGuard(n) >= spyGuard(n - 1));
  // Un bote solo nunca pasa del 55 % (5 % de base más la torre)
  assert.ok(spyRisk(60, 1) <= 0.55 + 1e-9);
});

test('más botes, más riesgo y más información', () => {
  for (const torre of [0, 5, 20]) {
    for (let n = 2; n <= 6; n++) assert.ok(spyRisk(torre, n) > spyRisk(torre, n - 1), `torre ${torre}, ${n} botes`);
  }
  assert.ok(spyRisk(10, 3, 0.5) < spyRisk(10, 3), 'el sigilo lo reduce');
  assert.equal(spyTier(1), 1);
  assert.equal(spyTier(3), 3);
  assert.equal(spyTier(99), SPY_TIERS.length);
});

async function spyWith(boats, rand) {
  const env = await makeWorld();
  const [A, B] = env.players;
  Object.assign(B.state.units, { hoplita: 30, trirreme: 4 });
  B.state.buildings.torre = 6;
  A.state.units.bote = boats;
  const real = Math.random;
  Math.random = () => rand;
  let m;
  try {
    m = sendAndArrive(env, A, 'explorar', B.state.home, { bote: boats });
  } finally {
    Math.random = real;
  }
  // El informe llega cuando vuelven los botes (si los han hundido, se sabe ya)
  if (m.back) env.until(m.back);
  return { A, B, rep: A.state.reports.find((r) => r.kind === 'exploracion') };
}

test('el informe de los espías llega cuando vuelven a casa, no al llegar', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  A.state.units.bote = 2;
  const real = Math.random;
  Math.random = () => 0.99;
  let m;
  try {
    m = sendAndArrive(env, A, 'explorar', B.state.home, { bote: 2 });
  } finally {
    Math.random = real;
  }
  assert.equal(m.phase, 'vuelta');
  assert.equal(A.state.reports.some((r) => r.title?.startsWith('Espionaje')), false, 'aún no hay informe');
  assert.equal(A.state.known[B.state.home]?.intel, undefined, 'ni se sabe nada de la ciudad');
  env.until(m.back);
  const rep = A.state.reports.find((r) => r.title?.startsWith('Espionaje'));
  assert.ok(rep, 'al volver llega el informe');
  assert.equal(rep.intel.level, 2);
  assert.equal(A.state.known[B.state.home].intel.level, 2);
  assert.equal(A.state.units.bote, 2, 'y los botes están en casa');
});

test('con un bote solo se ven los recursos; con cinco, todo', async () => {
  const one = await spyWith(1, 0.99);
  assert.equal(one.rep.intel.level, 1);
  assert.ok(one.rep.intel.stock.madera >= 0);
  assert.equal(one.rep.intel.ships, null);
  assert.equal(one.rep.intel.troops, null);
  assert.deepEqual(one.rep.intel.garrison, {});

  const five = await spyWith(5, 0.99);
  const intel = five.rep.intel;
  assert.equal(intel.level, 5);
  assert.equal(intel.ships.trirreme, 4);
  assert.equal(intel.troops.hoplita, 30);
  assert.equal(intel.defenses.torre, 6);
  assert.ok(Array.isArray(intel.support));
  assert.ok(intel.upgrades);
  assert.equal(intel.garrison.hoplita, 30);
});

test('si los descubren, se pierden todos los botes y no se averigua nada', async () => {
  const { A, rep } = await spyWith(4, 0);
  assert.equal(rep.outcome, 'derrota');
  assert.equal(rep.lostUnits.bote, 4);
  assert.equal(rep.intel, undefined);
  assert.equal(A.state.units.bote, 0);
});
