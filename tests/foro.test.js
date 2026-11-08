import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD, BOARD_SECTIONS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// El foro de la comunidad: lo lee cualquiera (también sin cuenta), escriben los jugadores, en los
// anuncios solo los moderadores, y los moderadores fijan, cierran, mueven y borran.

test('las secciones del foro', () => {
  assert.deepEqual(Object.keys(BOARD_SECTIONS), ['anuncios', 'sugerencias', 'errores', 'estrategia', 'comercio', 'general']);
  assert.ok(BOARD_SECTIONS.anuncios.modOnly);
});

test('un jugador abre un tema, otro responde y se lee sin cuenta', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal']);
  const [A, B] = players;
  const th = W.boardPost(A.userId, { section: 'estrategia', title: 'Cómo saquear bien', text: 'Lleva hoplitas.' });
  assert.equal(th.section, 'estrategia');
  W.boardPost(B.userId, { threadId: th.id, text: 'Y catapultas.' });
  // Sin cuenta: se ve todo, nada por leer
  const list = W.boardList(null, 'estrategia');
  assert.equal(list.sections.estrategia.threads, 1);
  assert.equal(list.threads[0].count, 2);
  assert.equal(list.threads[0].unread, false);
  assert.equal(list.me, null);
  const view = W.boardThread(null, th.id);
  assert.deepEqual(view.posts.map((p) => p.author), ['Lucio', 'Anibal']);
  assert.equal(view.canReply, false);
  // A tiene un mensaje sin leer (la respuesta de B) hasta que abre el tema
  assert.equal(W.snapshot(A.userId).boardUnread, 1);
  W.boardThread(A.userId, th.id);
  assert.equal(W.snapshot(A.userId).boardUnread, 0);
  assert.equal(W.snapshot(B.userId).boardUnread, 0, 'lo último es suyo');
});

test('en los anuncios solo escriben los moderadores, y los temas cerrados no admiten respuestas', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal']);
  const [A, B] = players;
  assert.throws(() => W.boardPost(B.userId, { section: 'anuncios', title: 'Hola a todos', text: 'Soy el jefe.' }), /moderadores/);
  W.admins.add('lucio');
  const th = W.boardPost(A.userId, { section: 'anuncios', title: 'Novedades', text: 'Llega el foro.' });
  assert.throws(() => W.boardPost(B.userId, { threadId: th.id, text: '¡Bien!' }), /moderadores/);
  assert.ok(W.chat.some((m) => m.board === th.id), 'se avisa en el chat');
  const t2 = W.boardPost(B.userId, { section: 'general', title: 'Charla', text: 'Qué tal.' });
  assert.equal(W.boardModerate(A.userId, 'lock', { id: t2.id }).thread.locked, true);
  assert.throws(() => W.boardPost(B.userId, { threadId: t2.id, text: 'Otra cosa' }), /cerrado/);
  // Solo los moderadores moderan
  assert.throws(() => W.boardModerate(B.userId, 'pin', { id: t2.id }), /moderadores/);
  assert.equal(W.boardModerate(A.userId, 'move', { id: t2.id, section: 'sugerencias' }).thread.section, 'sugerencias');
  assert.equal(W.boardModerate(A.userId, 'pin', { id: t2.id }).thread.pinned, true);
  assert.deepEqual(W.boardModerate(A.userId, 'delete', { id: t2.id }), { deleted: true });
  assert.equal(W.boardList(null).sections.sugerencias.threads, 0);
});

test('cada uno borra sus mensajes, se denuncian los ajenos y quien está silenciado no escribe', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal', 'Pericles']);
  const [A, B, C] = players;
  const th = W.boardPost(A.userId, { section: 'general', title: 'Saludos', text: 'Hola.' });
  const withReply = W.boardPost(B.userId, { threadId: th.id, text: 'Un insulto.' });
  const reply = withReply.posts[1];
  assert.throws(() => W.boardModerate(C.userId, 'delete-post', { id: th.id, postId: reply.id }), /propios/);
  // El primer mensaje de un tema con respuestas no lo borra su autor
  assert.throws(() => W.boardModerate(A.userId, 'delete-post', { id: th.id, postId: withReply.posts[0].id }), /moderadores/);
  // Denuncia: una vez por jugador; el moderador la ve y recibe el aviso
  W.admins.add('pericles');
  W.boardReport(A.userId, th.id, reply.id);
  assert.throws(() => W.boardReport(A.userId, th.id, reply.id), /Ya has denunciado/);
  assert.throws(() => W.boardReport(B.userId, th.id, reply.id), /propios/);
  assert.match(C.state.notes.at(-1).text, /denuncia/);
  assert.equal(W.boardThread(C.userId, th.id).posts[1].reports, 1);
  assert.equal(W.boardThread(A.userId, th.id).posts[1].reports, undefined, 'los demás no ven las denuncias');
  // B borra su mensaje
  const after = W.boardModerate(B.userId, 'delete-post', { id: th.id, postId: reply.id }).thread;
  assert.equal(after.posts.length, 1);
  // Silenciado: ni chat ni foro
  W.mute(C.userId, 'Anibal', 30);
  assert.throws(() => W.boardPost(B.userId, { threadId: th.id, text: 'Otra vez' }), /silenciado/);
  // Un tema con un solo mensaje lo borra su autor
  assert.deepEqual(W.boardModerate(A.userId, 'delete-post', { id: th.id, postId: after.posts[0].id }), { deleted: true });
});

test('si una sección se llena, se va el tema más viejo sin fijar', async () => {
  const { world: W, players } = await makeWorld(['Lucio']);
  const [A] = players;
  W.admins.add('lucio');
  const first = W.boardPost(A.userId, { section: 'general', title: 'El primero', text: 'Fijado.' });
  W.boardModerate(A.userId, 'pin', { id: first.id });
  const second = W.boardPost(A.userId, { section: 'general', title: 'El segundo', text: 'Viejo.' });
  for (let i = 0; i < BOARD.threads - 1; i++) W.boardPost(A.userId, { section: 'general', title: `Tema ${i}`, text: '…' });
  const ids = W.boardList(null, 'general').threads.map((t) => t.id);
  assert.equal(ids.length, BOARD.threads);
  assert.ok(ids.includes(first.id), 'el fijado se queda');
  assert.ok(!ids.includes(second.id), 'el más viejo sin fijar se va');
});
