import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAILY_REWARDS, DAILY_TOWN_BONUS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// El regalo diario: la mitad que al principio y un 10 % más por cada nivel del ayuntamiento.

test('el regalo del séptimo día y lo que crece con el ayuntamiento', async () => {
  assert.deepEqual(DAILY_REWARDS.at(-1), { oro: 125, cristal: 125, favor: 10 });
  assert.equal(DAILY_TOWN_BONUS, 0.1);
  const { players } = await makeWorld(['Lucio']);
  const [A] = players;
  A.state.buildings.ayuntamiento = 1;
  assert.deepEqual(A.dailyStatus().reward, DAILY_REWARDS[0]);
  // Con el ayuntamiento a 6: un 50 % más (el favor no crece)
  A.state.buildings.ayuntamiento = 6;
  A.state.daily = { last: Math.floor(A.now() / 86_400_000) - 1, streak: 6, best: 6 };
  assert.deepEqual(A.dailyStatus().reward, { oro: 188, cristal: 188, favor: 10 });
});
