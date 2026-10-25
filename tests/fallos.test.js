import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// «Reportar un fallo»: el aviso se guarda y les llega por correo a los moderadores, de parte de
// quien lo manda y con los datos del navegador.

test('un aviso de fallo se guarda y llega al correo de los moderadores', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal', 'Pericles']);
  const [mod, player, other] = players;
  W.admins.add('lucio');
  const id = W.reportBug(player.userId, 'El botón de reclutar no hace nada en el móvil.', { vista: 'isla · cuartel', errores: ['TypeError: x is undefined'] });
  assert.equal(W.meta.bugs[0].id, id);
  assert.equal(W.meta.bugs[0].user, 'Anibal');
  const mail = mod.state.mail[0];
  assert.equal(mail.from, 'Anibal', 'el moderador puede contestarle');
  assert.match(mail.subject, /Fallo #\d+/);
  assert.match(mail.text, /vista: isla · cuartel/);
  assert.match(mail.text, /TypeError/);
  assert.equal(other.state.mail?.length ?? 0, 0, 'a los demás jugadores no les llega');
  assert.throws(() => W.reportBug(player.userId, 'nada'), /Cuéntanos un poco más/);
});
