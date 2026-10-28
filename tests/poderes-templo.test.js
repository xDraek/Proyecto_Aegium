import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { POWERS } from '../src/game/data.js';
import { playerCombat } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Inspiración también acelera el reclutamiento (tropas y barcos); Viento favorable dura hora y media
// y vale para las flotas que ya navegan y para las que zarpan mientras está activo. La Furia de Zeus
// da +25 % de ataque al atacar: en las batallas de mientras dura y a las flotas que zarpan con ella.

const HOUR = 3_600_000;

function withTemple(g) {
  g.state.buildings.templo = 10;
  g.state.favor = 1000;
}

test('Inspiración adelanta un 30 % el reclutamiento en curso, también el de barcos', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  withTemple(A);
  A.state.units = { ...A.state.units };
  assert.deepEqual(A.train('lancero', 10), { ok: true });
  assert.deepEqual(A.train('mercante', 2), { ok: true });
  env.advance(1000);
  const ends = ['cuartel', 'puerto'].map((b) => A.training(b).at(-1).end);
  const now = clock.now();
  assert.ok(A.castPower('inspiracion').ok);
  ['cuartel', 'puerto'].forEach((b, i) => {
    const end = A.training(b).at(-1).end;
    assert.ok(Math.abs(end - (now + (ends[i] - now) * 0.7)) < 50, `${b}: termina un 30 % antes`);
  });
  // Y sigue saliendo todo, antes de lo previsto
  env.until(A.training('cuartel').at(-1).end);
  assert.equal(A.training('cuartel').length, 0);
});

test('Inspiración se puede invocar con solo un reclutamiento en marcha', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  withTemple(A);
  A.state.queue = null;
  A.state.researchQueue = null;
  assert.equal(A.castPower('inspiracion').ok, false);
  assert.ok(A.train('lancero', 5).ok);
  assert.ok(A.castPower('inspiracion').ok);
});

test('Viento favorable dura hora y media y acelera las flotas que zarpan mientras dura', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  withTemple(A);
  A.state.units.trirreme = 10;
  const plain = A.planMission('transporte', B.state.home, { trirreme: 1 }, { madera: 10 }).seconds;

  // Sin flotas en el mar también se puede invocar: vale para las que zarpen
  assert.ok(A.castPower('viento').ok);
  assert.ok(Math.abs(A.buffUntil('viento') - clock.now() - POWERS.viento.duration * HOUR) < 50);
  const fast = A.planMission('transporte', B.state.home, { trirreme: 1 }, { madera: 10 }).seconds;
  assert.ok(Math.abs(fast - plain / 2) <= 1, `${fast} ≈ ${plain} / 2`);

  // Pasada la hora y media, vuelven a ir a su paso
  env.advance(POWERS.viento.duration * HOUR + 1000);
  assert.equal(A.buffUntil('viento'), 0);
  assert.equal(A.planMission('transporte', B.state.home, { trirreme: 1 }, { madera: 10 }).seconds, plain);
});

test('Viento favorable sigue ahorrando media travesía a las flotas que ya navegan', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  withTemple(A);
  A.state.units.trirreme = 10;
  assert.ok(A.sendMission('transporte', B.state.home, { trirreme: 1 }, { madera: 10 }).ok);
  const m = A.state.missions.at(-1);
  const left = m.arrive - clock.now();
  assert.ok(A.castPower('viento').ok);
  assert.ok(Math.abs(m.arrive - clock.now() - left / 2) < 50);
});

test('la Furia de Zeus suma un 25 % de ataque solo al atacar y solo mientras dura', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  withTemple(A);
  const base = playerCombat(A.state).atkMul;
  assert.ok(A.castPower('rayo').ok);
  const now = clock.now();
  // Atacando ahora, sí; defendiendo (sin `attack`), no
  assert.ok(Math.abs(playerCombat(A.state, { t: now }).atkMul - (base + 0.25)) < 1e-9);
  assert.equal(playerCombat(A.state).atkMul, base);
  assert.equal(playerCombat(A.state, { t: now }).hpMul, playerCombat(A.state).hpMul);

  // Una flota que zarpa mientras dura la lleva consigo aunque llegue después
  A.state.units.trirreme = 10;
  assert.ok(A.sendMission('transporte', B.state.home, { trirreme: 1 }, { madera: 10 }).ok);
  const m = A.state.missions.at(-1);
  assert.equal(m.fury, true);
  const later = now + POWERS.rayo.duration * HOUR + 60_000;
  assert.ok(Math.abs(playerCombat(A.state, { mission: m, t: later }).atkMul - (base + 0.25)) < 1e-9);
  // Una que no zarpó con ella, pasado el tiempo, ya no
  assert.equal(playerCombat(A.state, { mission: {}, t: later }).atkMul, base);
});
