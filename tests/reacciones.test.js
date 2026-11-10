import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// Me gusta y no me gusta en los mensajes del foro y del foro de la alianza: uno por jugador, se
// cambia o se quita votando otra vez, y los tuyos no se votan.

test('foro: me gusta, no me gusta, cambiar y quitar el voto; los tuyos no', async () => {
  const { world: W, players } = await makeWorld();
  const [A, B, C] = players.map((g) => g.userId);
  const th = W.boardPost(A, { section: 'general', title: 'Hola a todos', text: 'Primer mensaje' });
  const post = th.posts[0].id;
  assert.throws(() => W.boardReact(A, th.id, post, 1), /tus propios mensajes/);
  let t = W.boardReact(B, th.id, post, 1);
  assert.deepEqual([t.posts[0].likes, t.posts[0].dislikes, t.posts[0].myVote], [1, 0, 1]);
  t = W.boardReact(C, th.id, post, -1);
  assert.deepEqual([t.posts[0].likes, t.posts[0].dislikes, t.posts[0].myVote], [1, 1, -1]);
  t = W.boardReact(B, th.id, post, -1);
  assert.deepEqual([t.posts[0].likes, t.posts[0].dislikes], [0, 2], 'B cambia de opinión');
  t = W.boardReact(B, th.id, post, -1);
  assert.deepEqual([t.posts[0].likes, t.posts[0].dislikes, t.posts[0].myVote], [0, 1, 0], 'votar lo mismo lo quita');
  // Quien lo mira sin cuenta ve los votos, sin el suyo; y no se ve quién votó qué
  const guest = W.boardThread(null, th.id);
  assert.equal(guest.posts[0].dislikes, 1);
  assert.equal(guest.posts[0].myVote, 0);
  assert.equal(guest.posts[0].votes, undefined);
});

test('foro de la alianza: también se vota, y no se ve quién votó', async () => {
  const { world: W, players } = await makeWorld();
  const [A, B] = players.map((g) => g.userId);
  W.createAlliance(A, 'Liga de Delos', 'DEL');
  W.setAllianceOpen(A, true);
  W.requestJoin(B, W.allianceOf(A).id, '');
  const th = W.forumPost(A, null, 'Plan', 'El sábado');
  const t = W.forumReact(B, th.id, th.posts[0].id, 1);
  assert.equal(t.posts[0].likes, 1);
  assert.equal(t.posts[0].myVote, 1);
  assert.equal(t.posts[0].votes, undefined);
  assert.equal(W.forumThread(A, th.id).posts[0].myVote, 0);
});
