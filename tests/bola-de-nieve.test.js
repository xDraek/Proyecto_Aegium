import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANTI_BULLY, RESOURCES } from '../src/game/data.js';
import { pvpHonor } from '../src/game/rules.js';
import { makeWorld, sendAndArrive } from './world.js';

// Contra la bola de nieve: quien saquea al mismo jugador varias veces el mismo día se lleva cada vez
// menos; abatir a alguien mucho más pequeño cuenta poco para la clasificación militar; y quien pierde
// casi todo su ejército queda unas horas a salvo de ataques.

const total = (bag) => Object.values(bag ?? {}).reduce((a, b) => a + b, 0);
const RICH = Object.fromEntries(Object.keys(RESOURCES).map((r) => [r, 10_000]));

test('el honor: los pequeños cuentan poco y los grandes, más', () => {
  assert.equal(pvpHonor(1000, 1000), 1);
  assert.equal(pvpHonor(10_000, 100), ANTI_BULLY.honor.min);
  assert.equal(pvpHonor(1000, 5000), ANTI_BULLY.honor.max);
  assert.equal(pvpHonor(1000, 500), 0.5);
});

test('saquear al mismo jugador otra vez el mismo día da cada vez menos botín', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  for (const k of Object.keys(B.state.units)) B.state.units[k] = 0;
  B.state.buildings.almacen = 20;
  const loots = [];
  for (let i = 0; i < 2; i++) {
    B.state.resources = { ...RICH };
    Object.assign(A.state.units, { galeon: 400, hoplita: 200, mercante: 200 });
    sendAndArrive(env, A, 'atacar', B.state.home, { galeon: 400, hoplita: 200, mercante: 200 });
    const rep = A.state.reports.find((r) => r.kind === 'ataque');
    assert.equal(rep.outcome, 'victoria');
    loots.push(total(rep.loot));
    env.until(A.state.missions.at(-1)?.back ?? 0);
  }
  assert.ok(loots[0] > 0);
  const ratio = loots[1] / loots[0];
  assert.ok(Math.abs(ratio - ANTI_BULLY.lootDecay[1]) < 0.05, `la segunda vez, el ${Math.round(ratio * 100)} %`);
  assert.match(A.state.reports.find((r) => r.kind === 'ataque').text, /solo te llevas el 75 %/);
  assert.match(B.state.reports.find((r) => r.kind === 'defensa').text, /solo se lleva el 75 %/);
});

test('quien pierde casi todo su ejército queda unas horas a salvo, hasta que ataca él', async () => {
  const env = await makeWorld();
  const [A, B, C] = env.players;
  for (const k of Object.keys(B.state.units)) B.state.units[k] = 0;
  B.state.units.lancero = 30;
  Object.assign(A.state.units, { galeon: 200, hoplita: 400, mercante: 100 });
  sendAndArrive(env, A, 'atacar', B.state.home, { galeon: 200, hoplita: 400, mercante: 100 });
  assert.ok(B.state.crushUntil > env.world.games.get(B.userId).now(), 'queda a salvo');
  assert.match(B.state.reports.find((r) => r.kind === 'defensa').text, /nadie te puede atacar/);
  // Nadie le puede atacar…
  Object.assign(C.state.units, { galeon: 10, hoplita: 10 });
  assert.match(C.planMission('atacar', B.state.home, { galeon: 10, hoplita: 10 }).reason, /casi todo su ejército/);
  // …hasta que ataca él
  Object.assign(B.state.units, { galeon: 5, hoplita: 5 });
  assert.ok(B.sendMission('atacar', C.state.home, { galeon: 5, hoplita: 5 }).ok);
  assert.equal(B.state.crushUntil, 0);
});
