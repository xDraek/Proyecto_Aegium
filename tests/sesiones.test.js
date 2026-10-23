import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readToken, signToken } from '../server/auth.js';
import { makeWorld } from './world.js';

// Cambiar la contraseña cierra todas las sesiones abiertas: los tokens firmados antes dejan de valer.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const valid = (W, token) => {
  const t = readToken(token, W.secret, { withTime: true });
  return !!t && !W.sessionClosed(t.uid, t.iat);
};

test('al cambiar la contraseña, las sesiones de antes dejan de valer y la nueva sí', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal']);
  const [A, B] = players;
  const old = signToken(A.userId, W.secret);
  const other = signToken(B.userId, W.secret);
  assert.equal(valid(W, old), true);
  await wait(5);
  await W.changePassword(A.userId, 'secreto1', 'nueva-clave-123');
  assert.equal(valid(W, old), false, 'la sesión robada ya no vale');
  assert.equal(valid(W, signToken(A.userId, W.secret)), true, 'la nueva sí');
  assert.equal(valid(W, other), true, 'las de los demás jugadores no se tocan');
});

test('los tokens de antes (sin fecha de firma) siguen valiendo mientras no se cambie la contraseña', async () => {
  const { world: W, players } = await makeWorld(['Lucio']);
  const [A] = players;
  const legacy = signToken(A.userId, W.secret);
  assert.equal(readToken(legacy, W.secret), A.userId, 'readToken sigue devolviendo el id');
  assert.equal(W.sessionClosed(A.userId, 0), false);
  W.endSessions(A.userId);
  assert.equal(W.sessionClosed(A.userId, 0), true);
});
