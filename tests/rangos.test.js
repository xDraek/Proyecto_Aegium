import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// Los rangos de la alianza: el Oikistes (quien la fundó) reparte los demás. El Hegemon gobierna,
// el Strategos lleva la guerra y el Presbeis los pactos; el foro lo administran el Oikistes y los Hegemones.

async function league() {
  const env = await makeWorld(['Lucio', 'Anibal', 'Pericles', 'Dario', 'Ciro']);
  const W = env.world;
  const [A, B, C, D, E] = env.players.map((g) => g.userId);
  W.createAlliance(A, 'Liga de Delos', 'DEL');
  W.setAllianceOpen(A, true);
  const id = W.allianceOf(A).id;
  for (const u of [B, C, D]) W.requestJoin(u, id, '');
  W.createAlliance(E, 'Persas', 'PER');
  const other = W.allianceOf(E).id;
  return { W, A, B, C, D, E, other };
}

test('el Oikistes reparte los rangos; nadie más puede', async () => {
  const { W, A, B, C, D } = await league();
  assert.equal(W.allianceDetail(A).role, 'oikistes');
  W.setRole(A, B, 'strategos');
  W.setRole(A, C, 'presbeis');
  W.setRole(A, D, 'hegemon');
  const roles = Object.fromEntries(W.allianceDetail(A).members.map((m) => [m.name, m.role]));
  assert.deepEqual(roles, { Lucio: 'oikistes', Anibal: 'strategos', Pericles: 'presbeis', Dario: 'hegemon' });
  assert.throws(() => W.setRole(D, B, 'miembro'), /Solo el Oikistes/);
  assert.throws(() => W.setRole(A, B, 'oikistes'), /no existe/);
  // El Hegemon expulsa a quien tiene menos rango, pero no al Oikistes ni a otro Hegemon
  assert.throws(() => W.kickMember(B, C), /Solo el Oikistes y los Hegemones/);
  assert.throws(() => W.kickMember(D, A), /mismo rango o superior/);
  W.kickMember(D, B);
  assert.equal(W.allianceOf(B), null);
});

test('la guerra, el Strategos; los pactos, el Presbeis; la paz, los dos', async () => {
  const { W, A, B, C, other } = await league();
  W.setRole(A, B, 'strategos');
  W.setRole(A, C, 'presbeis');
  assert.throws(() => W.diplomacy(C, other, 'guerra'), /declarar la guerra/);
  assert.throws(() => W.diplomacy(B, other, 'pacto'), /pactos/);
  W.diplomacy(B, other, 'guerra');
  W.diplomacy(C, other, 'paz');
  assert.equal(W.meta.diplomacy[Object.keys(W.meta.diplomacy)[0]].proposal.kind, 'paz');
});

test('el foro lo administran el Oikistes y los Hegemones: fijar, cerrar, renombrar y borrar', async () => {
  const { W, A, B, D } = await league();
  W.setRole(A, D, 'hegemon');
  const th = W.forumPost(B, null, 'Plan de ataque', 'El sábado.');
  W.forumPost(B, th.id, null, 'Llevad catapultas.');
  assert.throws(() => W.forumModerate(B, th.id, 'pin'), /Solo el Oikistes y los Hegemones/);
  assert.equal(W.forumModerate(D, th.id, 'pin').pinned, true);
  assert.equal(W.forumModerate(A, th.id, 'lock').locked, true);
  assert.throws(() => W.forumPost(B, th.id, null, 'Una más'), /cerrado/);
  W.forumPost(A, th.id, null, 'Cerrado, nos vemos allí.');
  assert.equal(W.forumModerate(A, th.id, 'rename', { title: 'Ataque del sábado' }).title, 'Ataque del sábado');
  const post = W.forumThread(A, th.id).posts[1];
  const after = W.forumModerate(A, th.id, 'delete-post', { postId: post.id });
  assert.equal(after.posts.length, 2);
  assert.equal(W.forumThread(B, th.id).canReply, false);
  // Cada uno puede borrar lo suyo
  const mine = W.forumPost(B, null, 'Otro tema', 'Hola');
  assert.equal(W.forumModerate(B, mine.id, 'delete'), null);
});

test('si se va el Oikistes, le sucede el de más rango', async () => {
  const { W, A, B, C } = await league();
  W.setRole(A, C, 'hegemon');
  W.setRole(A, B, 'strategos');
  W.leaveAlliance(A);
  const a = W.allianceOf(B);
  assert.equal(a.founder, C);
  assert.equal(W.allianceDetail(C).role, 'oikistes');
});
