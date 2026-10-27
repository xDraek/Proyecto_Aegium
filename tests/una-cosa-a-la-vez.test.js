import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESEARCH_KEYS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// Un edificio hace una cosa a la vez: la academia no se mejora mientras investiga (ni investiga
// en obras), y lo mismo el cuartel y el puerto con sus tropas y sus barcos.

const firstResearch = (game) => RESEARCH_KEYS.find((id) => !game.nextResearch(id).missing.length && !game.nextResearch(id).maxed);

test('la academia no se mejora mientras investiga, ni investiga mientras está en obras', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  A.state.buildings.academia = 3;
  B.state.buildings.academia = 3;

  assert.equal(A.research(firstResearch(A)).ok, true);
  const up = A.upgrade('academia');
  assert.equal(up.ok, false);
  assert.match(up.reason, /investigando/);
  // Otro edificio sí se puede mejorar mientras tanto
  assert.equal(A.upgrade('aserradero').ok, true);
  env.until(A.state.researchQueue.end);
  assert.equal(A.state.researchQueue, null);

  assert.equal(B.upgrade('academia').ok, true);
  const res = B.research(firstResearch(B));
  assert.equal(res.ok, false);
  assert.match(res.reason, /en obras/);
  env.until(B.state.queue.end);
  assert.equal(B.research(firstResearch(B)).ok, true);
});

test('el cuartel y el puerto no se mejoran mientras entrenan, ni entrenan en obras', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  // (con el cuartel y el puerto bajos, para que se puedan mejorar sin más requisitos)
  A.state.buildings.cuartel = 2;
  A.state.buildings.puerto = 3;
  B.state.buildings.puerto = 3;

  assert.equal(A.train('lancero', 5).ok, true);
  assert.match(A.upgrade('cuartel').reason, /entrenando/);
  // El puerto no tiene nada que ver con las tropas de tierra
  assert.equal(A.upgrade('puerto').ok, true);
  assert.match(A.train('mercante', 1).reason, /en obras/);
  // Al cancelar las tandas, el cuartel queda libre
  assert.equal(A.cancelTraining('cuartel', 0).ok, true);
  env.until(A.state.queue.end);
  assert.equal(A.upgrade('cuartel').ok, true);
  assert.match(A.train('lancero', 1).reason, /en obras/);

  assert.equal(B.train('mercante', 1).ok, true);
  assert.match(B.upgrade('puerto').reason, /botando barcos/);
  env.until(B.training('puerto').at(-1).end);
  assert.equal(B.upgrade('puerto').ok, true);
});
