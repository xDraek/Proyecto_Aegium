import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAILY_TASK_REWARD, QUESTS, REWARD_HOURS, RESOURCES } from '../src/game/data.js';
import { featProd } from '../src/game/feats.js';
import { makeWorld } from './world.js';

// Las recompensas de las misiones y los encargos valen al menos unas horas de tu producción: al
// empezar, las de siempre; con una ciudad grande, la misma mezcla multiplicada.

const value = (bag) => Object.entries(bag).reduce((a, [r, n]) => a + (r === 'favor' ? 0 : n * RESOURCES[r].value), 0);
const PRODUCERS = ['aserradero', 'cantera', 'granja', 'mina', 'fundicion', 'mercado'];

test('una ciudad que empieza cobra lo de siempre; una grande, al menos unas horas de lo que produce', async () => {
  const { players } = await makeWorld(['Lucio', 'Anibal']);
  const [A, B] = players;
  for (const id of PRODUCERS) A.state.buildings[id] = 1;
  for (const id of PRODUCERS) B.state.buildings[id] = 18;
  A.state.quests.claimed = [];
  B.state.quests.claimed = [];
  // Misiones
  const qa = A.activeQuests()[0];
  assert.deepEqual(qa.reward, QUESTS.find((q) => q.id === qa.id).reward, 'al empezar, la de siempre');
  const qb = B.activeQuests()[0];
  const hour = featProd(B.state).value * REWARD_HOURS.quest;
  assert.ok(Math.abs(value(qb.reward) - hour) / hour < 0.02, 'una grande, las horas que tocan de su producción');
  // Encargos: la misma mezcla, más grande
  const ta = A.taskReward();
  const tb = B.taskReward();
  assert.ok(value(tb) >= featProd(B.state).value * REWARD_HOURS.task * 0.98);
  assert.ok(tb.madera / tb.oro - DAILY_TASK_REWARD.madera / DAILY_TASK_REWARD.oro < 0.2, 'misma mezcla');
  assert.ok(value(ta) < value(tb));
  // Y se cobra lo que se enseña
  B.state.quests.claimed = QUESTS.slice(0, QUESTS.findIndex((q) => q.id === qb.id)).map((q) => q.id);
  const before = B.state.resources.madera;
  const shown = B.activeQuests().find((q) => q.id === qb.id);
  if (shown.done) {
    B.claimQuest(shown.id);
    assert.ok(B.state.resources.madera - before >= (shown.reward.madera ?? 0) - 1);
  }
});
