import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WorldServer } from '../server/WorldServer.js';
import { FileStore } from '../server/store.js';

// Las fosas del Kraken ya no las guardan corsarios, sino tritones y sus hipocampos: en los mundos
// de antes, los que quedaban (y lo que cada uno vio con sus botes) pasan a ser tritones e hipocampos.

async function open(file) {
  const store = new FileStore(file);
  await store.init();
  const world = new WorldServer(store);
  await world.load();
  return world;
}

test('los corsarios de las fosas de antes pasan a ser tritones e hipocampos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegium-fosa-'));
  try {
    const file = join(dir, 'world.json');
    const old = await open(file);
    const id = await old.register('Lucio', 'secreto1', 'Lucipolis', { email: 'lucio@prueba.es' });
    const lair = [...old.islands.values()].find((i) => i.type === 'kraken');
    assert.ok(lair, 'hay una fosa');
    assert.deepEqual(Object.keys(lair.garrison).sort(), ['hipocampo', 'triton']);
    // Una fosa guardada como antes, con corsarios, y lo que Lucio vio en ella
    Object.assign(lair, { garrison: { pirata: 130, corsario: 26 } });
    old.islandStates.get(lair.id).garrison = { pirata: 40, corsario: 9 };
    old.games.get(id).state.known[lair.id] = { explored: true, intel: { t: 1, garrison: { pirata: 41, corsario: 9 }, stock: {} } };
    await old.persist(true);

    const W = await open(file);
    assert.deepEqual(W.islands.get(lair.id).garrison, { triton: 130, hipocampo: 26 });
    assert.deepEqual(W.islandStates.get(lair.id).garrison, { triton: 40, hipocampo: 9 });
    assert.deepEqual(W.games.get(id).state.known[lair.id].intel.garrison, { triton: 41, hipocampo: 9 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
