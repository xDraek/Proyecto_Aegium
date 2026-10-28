import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAILY_TASK_BONUS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// El premio por cumplir todos los encargos solo promete favor si hay templo donde guardarlo (antes
// se prometía y no llegaba), y reclutar 0 tropas no recluta ninguna.

test('el premio de los encargos solo lleva favor con templo', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.buildings.templo = 0;
  assert.equal(A.taskBonus().favor, undefined);
  assert.equal(A.taskBonus().cristal, DAILY_TASK_BONUS.cristal);
  A.state.buildings.templo = 1;
  assert.equal(A.taskBonus().favor, DAILY_TASK_BONUS.favor);
});

test('reclutar 0 tropas no recluta nada ni cobra', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  const before = { ...A.state.resources };
  const res = A.train('lancero', 0);
  assert.equal(res.ok, false);
  assert.match(res.reason, /cuántas/);
  for (const [r, n] of Object.entries(before)) assert.ok(A.state.resources[r] >= n, `no cobra ${r}`);
  assert.equal(A.training('cuartel').length, 0);
});
