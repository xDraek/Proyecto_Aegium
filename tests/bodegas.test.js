import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MERCHANT_HOLD, RESEARCH, UNITS } from '../src/game/data.js';
import { merchantCargo, tradeShips } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Bodegas ampliadas: +100 de carga por mercante y nivel, de 500 a 1.000.

test('cada nivel suma 100 de carga a los mercantes, hasta 1.000', () => {
  assert.equal(UNITS.mercante.cargo, 500);
  assert.equal(RESEARCH.bodegas.maxLevel, 5);
  assert.equal(merchantCargo({ research: {} }), 500);
  assert.equal(merchantCargo({ research: { bodegas: 2 } }), 700);
  assert.equal(merchantCargo({ research: { bodegas: 5 } }), 1000);
  assert.equal(merchantCargo({ research: { bodegas: 9 } }), UNITS.mercante.cargo + MERCHANT_HOLD.per * MERCHANT_HOLD.levels);
  // En el mercado hacen falta menos barcos
  assert.equal(tradeShips({ madera: 2000 }, { research: {} }), 4);
  assert.equal(tradeShips({ madera: 2000 }, { research: { bodegas: 5 } }), 2);
});

test('las flotas cargan más con las bodegas', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  Object.assign(A.state.units, { mercante: 2 });
  const before = A.planMission('transporte', B.state.home, { mercante: 2 });
  A.state.research.bodegas = 3;
  const after = A.planMission('transporte', B.state.home, { mercante: 2 });
  assert.equal(after.cargo - before.cargo, 2 * 300);
});

test('refugios: 50 plazas en el nivel 1 y 20 más por nivel; si sobran, salen', async () => {
  const { shelterRoom } = await import('../src/game/rules.js');
  assert.equal(shelterRoom({ research: {} }), 0);
  assert.equal(shelterRoom({ research: { refugio: 1 } }), 50);
  assert.equal(shelterRoom({ research: { refugio: 5 } }), 130);
  const env = await makeWorld();
  const [A] = env.players;
  A.state.research.refugio = 1;
  A.state.units.lancero = 10;
  A.state.sheltered = { lancero: 200 };
  A.shelter();
  assert.equal(A.state.sheltered.lancero, 50);
  assert.equal(A.state.units.lancero, 160);
  assert.equal(UNITS.kleptes.cargo, 1000);
});
