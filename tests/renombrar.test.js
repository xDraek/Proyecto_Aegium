import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WorldServer } from '../server/WorldServer.js';
import { FileStore } from '../server/store.js';
import { makeWorld } from './world.js';

// Un moderador puede cambiar el nombre de un jugador: el de su cuenta (con el que entra) y el de su
// imperio. Nunca a otro moderador ni a un nombre cogido (ni al de un moderador).

const ADMINS = process.env.ADMINS;

test('un moderador cambia el nombre de un jugador, que entra con el nuevo y recibe una carta', async () => {
  process.env.ADMINS = 'Lucio';
  try {
    const env = await makeWorld();
    const W = env.world;
    const [L, A] = env.players;
    await assert.rejects(() => W.renamePlayer(A.userId, 'Pericles', 'Nuevo'), /moderadores/);

    assert.deepEqual(await W.renamePlayer(L.userId, 'anibal', '3KGT'), { name: '3KGT' });
    assert.equal(W.login('3KGT', 'secreto1'), A.userId);
    assert.equal(W.login('3kgt', 'secreto1'), A.userId, 'sin mirar mayúsculas');
    assert.throws(() => W.login('Anibal', 'secreto1'), /incorrectos/);
    assert.equal(A.state.name, '3KGT');
    assert.equal(W.playerInfo(A.userId).name, '3KGT');
    assert.equal(W.profile('3KGT').name, '3KGT');
    const letter = A.state.mail[0];
    assert.equal(letter.from, 'Lucio');
    assert.match(letter.text, /de Anibal a 3KGT/);

    await assert.rejects(() => W.renamePlayer(L.userId, '3KGT', 'Pericles'), /cogido/);
    await assert.rejects(() => W.renamePlayer(L.userId, '3KGT', 'lucio'), /cogido/);
    await assert.rejects(() => W.renamePlayer(L.userId, '3KGT', 'ab'), /letras o números/);
    await assert.rejects(() => W.renamePlayer(L.userId, 'Lucio', 'Otro'), /otro moderador/);
  } finally {
    if (ADMINS === undefined) delete process.env.ADMINS;
    else process.env.ADMINS = ADMINS;
  }
});

test('el nombre nuevo se guarda: tras reiniciar el servidor se entra con él', async () => {
  process.env.ADMINS = 'Lucio';
  const dir = await mkdtemp(join(tmpdir(), 'aegium-nombre-'));
  try {
    const file = join(dir, 'world.json');
    const open = async () => {
      const store = new FileStore(file);
      await store.init();
      const world = new WorldServer(store);
      await world.load();
      return world;
    };
    const old = await open();
    const admin = await old.register('Lucio', 'secreto1', 'Lucipolis', { email: 'lucio@prueba.es' });
    const id = await old.register('Anibal', 'secreto1', 'Cartago', { email: 'anibal@prueba.es' });
    await old.renamePlayer(admin, 'Anibal', '3KGT');
    await old.persist(true);

    const W = await open();
    assert.equal(W.login('3KGT', 'secreto1'), id);
    assert.equal(W.games.get(id).state.name, '3KGT');
  } finally {
    if (ADMINS === undefined) delete process.env.ADMINS;
    else process.env.ADMINS = ADMINS;
    await rm(dir, { recursive: true, force: true });
  }
});
