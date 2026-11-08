import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFENSE } from '../src/game/data.js';
import { assault } from '../src/game/combat.js';
import { shelterRoom, totalUnits, wallBonus } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Las defensas: la muralla para una parte del ataque de los que desembarcan, la torre de vigía
// refuerza a los honderos y arqueros, los fosos tumban a una parte de los que desembarcan, la cadena
// del puerto frena a los barcos y el refugio esconde tropas que no luchan ni mueren.

const fixed = () => 0.5;
const total = (bag) => Object.values(bag ?? {}).reduce((a, b) => a + b, 0);

test('la muralla para hasta un 40 % del ataque y la torre llega al 80 % para los arqueros', () => {
  assert.equal(wallBonus(5).absorb, 0.1);
  assert.equal(wallBonus(50).absorb, DEFENSE.wallAbsorbMax);
  assert.equal(wallBonus(0, 10).ranged, 0.4);
  assert.equal(wallBonus(0, 40).ranged, DEFENSE.watchMax);
});

test('con la muralla parando su ataque, los defensores pierden menos', () => {
  const att = { units: { mercante: 40, hoplita: 200 }, atkMul: 1, hpMul: 1 };
  const def = { units: { hoplita: 150 }, atkMul: 1, hpMul: 1 };
  const without = assault(att, def, { rand: fixed, needLanding: true });
  const withWall = assault(att, { ...def, absorb: 0.3 }, { rand: fixed, needLanding: true });
  assert.ok(total(withWall.def.lost) < total(without.def.lost));
});

test('los fosos tumban a una parte de los que desembarcan antes de luchar', () => {
  const att = { units: { mercante: 40, hoplita: 200 }, atkMul: 1, hpMul: 1 };
  const r = assault(att, { units: {}, traps: 0.2 }, { rand: fixed, needLanding: true });
  assert.equal(r.trapped, 40);
  assert.equal(r.att.lost.hoplita, 40);
});

test('la cadena del puerto quita ataque a los barcos que atacan', () => {
  const att = { units: { trirreme: 60 }, atkMul: 1, hpMul: 1 };
  const def = { units: { trirreme: 50 }, atkMul: 1, hpMul: 1 };
  const without = assault(att, def, { rand: fixed });
  const withChain = assault(att, { ...def, chain: 0.3 }, { rand: fixed });
  assert.ok(total(withChain.def.lost) < total(without.def.lost));
});

test('las tropas del refugio no defienden ni mueren, pero siguen comiendo', async () => {
  const { players } = await makeWorld();
  const [, B] = players;
  B.state.units = { hoplita: 100, lancero: 50 };
  assert.match(B.shelter().reason, /Refugios/);
  B.state.research.refugio = 1;
  assert.equal(shelterRoom(B.state), DEFENSE.shelter);
  assert.ok(B.shelter().ok);
  const inside = B.state.sheltered;
  const seats = (inside.hoplita ?? 0) * 1 + (inside.lancero ?? 0);
  assert.ok(seats <= DEFENSE.shelter && seats > 0);
  assert.equal(totalUnits(B.state).hoplita, 100, 'siguen contando para la comida');
  const hidden = { ...inside };
  // Un ataque arrasa lo que queda fuera; lo escondido sigue ahí
  B.receiveAttack({ attackerName: 'Prueba', units: { mercante: 100, espadachin: 600 }, atkMul: 1, hpMul: 1 }, B.now());
  assert.deepEqual(B.state.sheltered, hidden);
  assert.ok(B.unshelter().ok);
  assert.equal(total(B.state.sheltered), 0);
  assert.ok(B.state.units.hoplita >= (hidden.hoplita ?? 0));
});

test('una ciudad con fosos y cadena se defiende mejor, y el informe lo cuenta', async () => {
  const { players } = await makeWorld();
  const [, B] = players;
  Object.assign(B.state.research, { fosos: 5, cadena: 5 });
  B.state.units = { hoplita: 60 };
  const res = B.receiveAttack({ attackerName: 'Prueba', units: { mercante: 40, hoplita: 100 }, atkMul: 1, hpMul: 1 }, B.now());
  assert.equal(res.result.trapped, 20);
  assert.match(B.state.reports[0].text, /fosos/);
});
