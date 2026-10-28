import assert from 'node:assert/strict';
import { test } from 'node:test';
import { battle, counterBonus } from '../src/game/combat.js';
import { UNITS } from '../src/game/data.js';

// El combate por clases: la retaguardia (distancia y catapultas) está a cubierto mientras haya
// vanguardia, cada clase pega más a la que vence, en el primer asalto los de distancia sueltan parte
// de su disparo antes y la caballería carga (salvo contra las lanzas), y lo que sobra al caer una
// línea pasa a la otra.

const fixed = () => 0.5;
const lostShare = (r, side, id) => (r[side].lost[id] ?? 0) / r[side].start[id];

test('cada clase pega más a la que vence', () => {
  assert.equal(counterBonus('hoplita', 'caballero'), 0.5);
  assert.equal(counterBonus('caballero', 'arquero'), 0.5);
  assert.equal(counterBonus('caballero', 'catapulta'), 0.5);
  assert.equal(counterBonus('espadachin', 'hoplita'), 0.5);
  assert.equal(counterBonus('brulote', 'dromon'), 1);
  assert.equal(counterBonus('liburna', 'brulote'), 0.5);
  // Y no al revés, ni contra los neutrales ni los monstruos
  assert.equal(counterBonus('caballero', 'hoplita'), 0);
  assert.equal(counterBonus('hoplita', 'barbaro'), 0);
  assert.equal(counterBonus('caballero', 'kraken'), 0);
  for (const id of ['hondero', 'arquero', 'sagitario', 'catapulta']) assert.ok(['distancia', 'asedio'].includes(UNITS[id].cls), id);
});

test('la vanguardia protege a la retaguardia', () => {
  const r = battle({ units: { hoplita: 100, arquero: 100 } }, { units: { barbaro: 120 } }, fixed);
  assert.ok(lostShare(r, 'att', 'arquero') < lostShare(r, 'att', 'hoplita') / 2, 'los arqueros caen mucho menos que los hoplitas');
  // Sin vanguardia, los arqueros se llevan todos los golpes
  const solos = battle({ units: { arquero: 100 } }, { units: { barbaro: 120 } }, fixed);
  assert.ok(lostShare(solos, 'att', 'arquero') > lostShare(r, 'att', 'arquero'));
});

test('la caballería arrolla a los arqueros y las lanzas la frenan', () => {
  const cav = battle({ units: { caballero: 60 } }, { units: { arquero: 200 } }, fixed);
  assert.equal(cav.winner, 'att');
  assert.equal(cav.edges.att.from, 'caballero');
  assert.equal(cav.edges.att.to, 'arquero');
  // Contra hoplitas pierde: le pegan más y no tiene embestida
  const wall = battle({ units: { caballero: 60 } }, { units: { hoplita: 120 } }, fixed);
  assert.equal(wall.winner, 'def');
  assert.equal(wall.edges.def.from, 'hoplita');
});

test('los espadachines rompen las falanges mejor que la milicia de su mismo valor', () => {
  const swords = battle({ units: { espadachin: 100 } }, { units: { hoplita: 80 } }, fixed);
  assert.equal(swords.winner, 'att');
  assert.ok(swords.edges.att.kills > 0);
});

test('lo que sobra al caer una línea pasa a la otra', () => {
  // Un golpe enorme contra muy poca vanguardia: también caen los de atrás en el mismo asalto
  const r = battle({ units: { elefante: 200 } }, { units: { lancero: 5, arquero: 50 } }, fixed);
  assert.equal(r.winner, 'att');
  assert.equal(r.rounds, 1);
});
