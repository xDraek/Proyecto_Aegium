import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FLEET_COST } from '../src/game/data.js';
import { makeWorld } from './world.js';

// Zarpar cuesta comida de travesía (por barco y por plaza, según la distancia) y se puede elegir la
// marcha: más despacio se tarda más, se gasta menos y la vuelta va igual de despacio.

const ARMY = { trirreme: 20, hoplita: 60 };

test('la travesía pide comida según los barcos, las tropas y la distancia', async () => {
  const { players } = await makeWorld();
  const [A, B] = players;
  Object.assign(A.state.units, ARMY);
  const plan = A.planMission('atacar', B.state.home, ARMY);
  assert.ok(plan.ok, plan.reason);
  const dist = A.distanceTo(B.state.home);
  const expected = Math.ceil((20 * FLEET_COST.ship + plan.used * FLEET_COST.seat) * (dist / FLEET_COST.per));
  assert.equal(plan.food, expected);
  const before = A.state.resources.comida;
  assert.ok(A.sendMission('atacar', B.state.home, ARMY).ok);
  assert.ok(before - A.state.resources.comida >= expected - 1, 'se paga al zarpar');
});

test('a menos velocidad se tarda más y se gasta menos; la vuelta va igual', async () => {
  const { players } = await makeWorld();
  const [A, B] = players;
  Object.assign(A.state.units, ARMY);
  const full = A.planMission('atacar', B.state.home, ARMY);
  const half = A.planMission('atacar', B.state.home, ARMY, null, { pace: 0.5 });
  assert.ok(Math.abs(half.seconds - full.seconds * 2) <= 1);
  assert.ok(half.food <= Math.ceil(full.food / 2));
  // Una marcha que no está en la lista vale como a toda vela
  assert.equal(A.planMission('atacar', B.state.home, ARMY, null, { pace: 0.33 }).seconds, full.seconds);
  assert.ok(A.sendMission('atacar', B.state.home, ARMY, null, { pace: 0.5 }).ok);
  const m = A.state.missions.at(-1);
  assert.ok(Math.abs((m.arrive - m.depart) / 1000 - half.seconds) <= 1);
});

test('sin comida no se zarpa, salvo a explorar con botes', async () => {
  const { players } = await makeWorld();
  const [A, B] = players;
  Object.assign(A.state.units, { ...ARMY, bote: 2 });
  A.state.resources.comida = 0;
  assert.match(A.planMission('atacar', B.state.home, ARMY).reason, /provisiones/);
  const scout = A.planMission('explorar', B.state.home, { bote: 1 });
  assert.equal(scout.food, 0);
  assert.ok(scout.ok, scout.reason);
});
