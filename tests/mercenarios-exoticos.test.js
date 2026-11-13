import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MERC_UNITS, MERCENARIES, UNITS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// Los mercenarios extranjeros: tropas de los pueblos vecinos de los griegos que solo se contratan
// en la taberna (no se entrenan) y se marchan al acabar el contrato.

test('cada pueblo tiene su compañía, su clase y no se entrena en ningún edificio', () => {
  const exotic = Object.values(MERCENARIES).filter((m) => m.exotic);
  assert.equal(exotic.length, MERC_UNITS.length);
  for (const id of MERC_UNITS) {
    const u = UNITS[id];
    assert.ok(u.cls, `${id} tiene clase`);
    assert.equal(u.building, undefined, `${id} no se entrena`);
    assert.ok(u.origin && u.description, `${id} dice de dónde viene`);
    assert.ok(exotic.some((m) => m.unit === id), `${id} tiene compañía`);
  }
});

test('se contratan en la taberna, no en el cuartel, y se van al acabar el contrato', async () => {
  const env = await makeWorld(['Lucio']);
  const [g] = env.players;
  g.state.buildings.taberna = 4;
  assert.equal(g.train('peltasta', 1).ok, false, 'no se entrenan');
  const offers = g.mercenaryOffers().filter((o) => o.exotic && !o.locked).map((o) => o.id);
  assert.deepEqual(offers, ['tracios']);
  // Sin Cartas náuticas no encuentran la taberna
  g.state.research.cartas = 0;
  assert.match(g.hireMercenaries('tracios').reason, /Cartas náuticas/);
  g.state.research.cartas = 1;
  assert.equal(g.hireMercenaries('tracios').ok, true);
  assert.equal(g.state.units.peltasta, 14);
  assert.equal(g.hireMercenaries('hetairos').ok, false, 'los hetairos piden la taberna 14');
  env.advance(25 * 3_600_000);
  assert.equal(g.state.units.peltasta, 0, 'acabado el contrato, se marchan');
});

test('los mercenarios griegos no necesitan las Cartas náuticas', async () => {
  const env = await makeWorld(['Lucio']);
  const [g] = env.players;
  g.state.buildings.taberna = 1;
  g.state.research.cartas = 0;
  assert.equal(g.hireMercenaries('lanceros').ok, true);
});
