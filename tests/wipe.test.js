import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WorldServer } from '../server/WorldServer.js';
import { FileStore } from '../server/store.js';

// Wipe: el mundo empieza de cero pero las cuentas (y los amigos) se quedan; cada jugador funda su
// ciudad nueva con el nombre que elija al volver a entrar.

async function open(file) {
  const store = new FileStore(file);
  await store.init();
  const world = new WorldServer(store);
  await world.load();
  return { store, world };
}

test('tras el wipe las cuentas siguen, sin ciudad, y cada una funda la suya', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegium-wipe-'));
  try {
    const file = join(dir, 'world.json');
    const { world: old, store } = await open(file);
    const a = await old.register('Lucio', 'secreto1', 'Lucipolis', { email: 'lucio@prueba.es' });
    const b = await old.register('Anibal', 'secreto1', 'Cartago', { email: 'anibal@prueba.es' });
    old.addFriend(a, 'Anibal');
    old.answerFriend(b, 'Lucio', true);
    old.games.get(a).state.buildings.ayuntamiento = 2;
    old.createAlliance(a, 'Liga de Delos', 'DEL');
    const secret = old.secret;
    await old.persist(true);
    await store.wipe();

    const { world: W } = await open(file);
    assert.equal(W.secret, secret, 'las sesiones siguen valiendo');
    assert.equal(W.games.size, 0);
    assert.equal(W.login('lucio', 'secreto1'), a, 'se entra con la misma contraseña');
    assert.equal(W.login('anibal@prueba.es', 'secreto1'), b, 'y con el correo');
    assert.equal(W.needsCity(a), true);
    assert.deepEqual(Object.keys(W.meta.alliances), [], 'las alianzas se disuelven');
    assert.deepEqual(W.meta.friends[a], [b], 'los amigos se quedan');

    await W.foundCity(a, 'Nueva Roma');
    assert.equal(W.needsCity(a), false);
    const g = W.games.get(a);
    assert.equal(W.islands.get(g.state.home).name, 'Nueva Roma');
    assert.equal(g.state.buildings.ayuntamiento, 1, 'la partida es nueva');
    assert.equal(g.state.founder, true, 'quien era Fundador lo sigue siendo');
    await assert.rejects(W.foundCity(a, 'Otra'), /Ya tienes una ciudad/);
    await assert.rejects(W.foundCity(b, 'nueva roma'), /Ya hay una ciudad con ese nombre/);
    assert.equal(W.friendList(a).friends.length, 0, 'el amigo sin ciudad aún no sale');
    await W.foundCity(b, '');
    assert.equal(W.islands.get(W.games.get(b).state.home).name, 'Anibal', 'sin nombre, la ciudad se llama como el jugador');
    assert.equal(W.friendList(a).friends[0].name, 'Anibal');
    assert.notEqual(W.games.get(a).state.home, W.games.get(b).state.home);
    const c = await W.register('Pericles', 'secreto1', 'Atenas', { email: 'pericles@prueba.es' });
    assert.ok(c !== a && c !== b, 'las cuentas nuevas no repiten número');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
