import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { UNITS, WRECK } from '../src/game/data.js';
import { makeWorld, sendAndArrive } from './world.js';

// Los pecios: cada batalla en el mar deja frente a la isla parte de lo que valían los barcos hundidos
// (de los dos bandos), unas horas. Los recogen los Kleptes de quien llegue antes, sean de quien sean.

const total = (bag) => Object.values(bag ?? {}).reduce((a, b) => a + b, 0);

test('una batalla en el mar deja un pecio con parte de lo que costaban los barcos hundidos', async () => {
  const { world: W, players } = await makeWorld();
  const [, B] = players;
  B.state.units = { trirreme: 10 };
  const res = B.receiveAttack({ attackerName: 'Prueba', units: { galeon: 30 }, atkMul: 1, hpMul: 1 }, B.now());
  const sunk = res.result.def.lost.trirreme ?? 0;
  assert.ok(sunk > 0);
  const wreck = W.wreckAt(B.state.home);
  assert.ok(wreck, 'hay pecio frente a su ciudad');
  const lostGaleon = res.result.att.lost.galeon ?? 0;
  const expected = (UNITS.trirreme.cost.madera * sunk + (UNITS.galeon.cost.madera ?? 0) * lostGaleon) * WRECK.share;
  assert.ok(Math.abs(wreck.res.madera - Math.floor(expected)) <= 1);
  assert.ok(wreck.until > clock.now());
});

test('cualquiera lo recoge con Kleptes; solo Kleptes, y se acaba', async () => {
  const env = await makeWorld();
  const { world: W, players } = env;
  const [A, B, C] = players;
  W.addWreck(B.state.home, { madera: 3000, hierro: 1000 }, clock.now());
  // Solo con Kleptes
  Object.assign(C.state.units, { kleptes: 2, mercante: 1 });
  assert.match(C.planMission('recoger', B.state.home, { kleptes: 2, mercante: 1 }).reason, /solo Kleptes/);
  assert.match(C.planMission('atacar', A.state.home, { kleptes: 2 }).reason ?? '', /.+/);
  // C (un tercero) carga lo que cabe: 2 × 1500
  const before = C.state.resources.madera;
  const m = sendAndArrive(env, C, 'recoger', B.state.home, { kleptes: 2 });
  assert.equal(total(m.cargo), 2 * UNITS.kleptes.cargo);
  assert.equal(total(W.wreckAt(B.state.home).res), 4000 - 2 * UNITS.kleptes.cargo, 'queda el resto');
  env.until(m.back);
  assert.ok(C.state.resources.madera > before, 'llega a casa');
  // Al acabarse el plazo, se hunde del todo
  env.advance(WRECK.hours * 3_600_000);
  assert.equal(W.wreckAt(B.state.home), null);
  assert.match(C.planMission('recoger', B.state.home, { kleptes: 2 }).reason, /ningún pecio/);
});
