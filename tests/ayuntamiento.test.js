import assert from 'node:assert/strict';
import { test } from 'node:test';
import { universe } from '../src/config.js';
import { UNITS } from '../src/game/data.js';
import { missingRequirements, townHallFor, unitSeconds, upgradeRequires } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// El ayuntamiento marca hasta dónde se suben los demás edificios, y la taberna, qué mercenarios vienen.

test('para pasar del nivel 5 hace falta el ayuntamiento: 3 más cada 5 niveles', () => {
  assert.equal(townHallFor('aserradero', 5), 0);
  assert.equal(townHallFor('aserradero', 6), 3);
  assert.equal(townHallFor('aserradero', 10), 3);
  assert.equal(townHallFor('aserradero', 11), 6);
  assert.equal(townHallFor('aserradero', 16), 9);
  assert.equal(townHallFor('aserradero', 21), 12);
  assert.equal(townHallFor('ayuntamiento', 20), 0, 'el ayuntamiento no se pide a sí mismo');
  // Se queda con lo que pida más: su requisito propio o el del nivel
  assert.equal(upgradeRequires('mercado', 2).ayuntamiento, 3);
  assert.equal(upgradeRequires('mercado', 12).ayuntamiento, 6);
  assert.equal(upgradeRequires('faro', 1).ayuntamiento, 5);
});

test('sin ayuntamiento no se sube un edificio por encima del 5 ni se construyen los que lo piden', async () => {
  const { players } = await makeWorld(['Lucio']);
  const [g] = players;
  Object.assign(g.state.buildings, { ayuntamiento: 2, aserradero: 5, cuartel: 1 });
  const next = g.nextUpgrade('aserradero');
  assert.deepEqual(next.missing, [{ id: 'ayuntamiento', level: 3, kind: 'building' }]);
  assert.equal(g.upgrade('aserradero').ok, false);
  assert.equal(g.upgrade('muralla').ok, false, 'la muralla pide ayuntamiento 3');
  g.state.buildings.ayuntamiento = 3;
  assert.equal(g.upgrade('aserradero').ok, true);
});

test('la taberna atrae mercenarios mejores al subir: al principio solo milicianos', async () => {
  const { players } = await makeWorld(['Lucio']);
  const [g] = players;
  g.state.buildings.taberna = 1;
  const open = (game) => game.mercenaryOffers().filter((o) => !o.locked).map((o) => o.unit);
  assert.deepEqual(open(g), ['lancero', 'hondero']);
  assert.equal(g.hireMercenaries('hoplitas').ok, false, 'los hoplitas no vienen a una taberna de nivel 1');
  g.state.buildings.taberna = 5;
  assert.deepEqual(open(g), ['lancero', 'hondero', 'arquero', 'hoplita']);
  const before = g.state.units.hoplita;
  assert.equal(g.hireMercenaries('hoplitas').ok, true);
  assert.equal(g.state.units.hoplita - before, 12);
  g.state.buildings.taberna = 12;
  assert.ok(open(g).includes('catafracto'), 'con la taberna alta llega la élite');
  // Cuantos más niveles por encima del suyo, más soldados trae cada compañía
  const lanceros = g.mercenaryOffers().find((o) => o.id === 'lanceros');
  assert.equal(lanceros.count, 15 + 5 * 11);
});

test('los barcos de guerra piden su nivel de astillero y el puerto acelera un 5 % por nivel', async () => {
  const { players } = await makeWorld(['Lucio']);
  const [g] = players;
  Object.assign(g.state.buildings, { ayuntamiento: 4, puerto: 10, astillero: 0 });
  g.state.research.navegacion = 8;
  assert.equal(g.train('mercante', 1).ok, true, 'los mercantes no piden astillero');
  assert.equal(g.train('trirreme', 1).ok, false, 'sin astillero no hay barcos de guerra');
  g.state.buildings.astillero = 1;
  assert.equal(g.train('trirreme', 1).ok, true);
  assert.equal(g.train('brulote', 1).ok, false, 'el brulote pide astillero 2');
  assert.deepEqual(missingRequirements(g.state, UNITS.dromon.requires), [{ id: 'astillero', level: 7, kind: 'building' }]);
  // Puerto 10 y sin astillero: +45 %
  g.state.buildings.astillero = 0;
  assert.equal(unitSeconds(g.state, 'mercante'), Math.max(1, Math.round(UNITS.mercante.time / 1.45 / universe.speed)));
});
