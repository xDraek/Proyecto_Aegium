import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WorldServer } from '../server/WorldServer.js';
import { FileStore } from '../server/store.js';
import { fixPlaceName, placeName } from '../src/game/world.js';
import { makeWorld } from './world.js';

// Los nombres de las islas: el adjetivo concuerda con el sustantivo y ninguno se repite en el
// archipiélago (salvo el Mar de las Brumas, que es uno solo).

test('el adjetivo concuerda con el sustantivo', () => {
  assert.equal(placeName('Isla', 'Rojo'), 'Isla Roja');
  assert.equal(placeName('Cayo', 'Serena'), 'Cayo Sereno');
  assert.equal(placeName('Tierras', 'Doradas'), 'Tierras Doradas');
  assert.equal(placeName('Montes', 'Negra'), 'Montes Negros');
  assert.equal(placeName('Llano', 'Salvajes'), 'Llano Salvaje');
  assert.equal(placeName('Isla', 'de la Sirena'), 'Isla de la Sirena');
  for (const [wrong, right] of [['Islote Negra', 'Islote Negro'], ['Arrecife Dorada', 'Arrecife Dorado'], ['Vega Doradas', 'Vega Dorada'], ['Costa Salvajes', 'Costa Salvaje'], ['Cayo Perdida', 'Cayo Perdido'], ['Bastión Negra', 'Bastión Negro']]) {
    assert.equal(fixPlaceName(wrong), right);
  }
  for (const ok of ['Empalizada Negra', 'Isla Ceniza', 'Fosa del Kraken', 'Mar de las Brumas', 'Lucipolis']) assert.equal(fixPlaceName(ok), ok);
});

test('en un archipiélago grande ningún nombre se repite y todos concuerdan', async () => {
  const names = Array.from({ length: 40 }, (_, i) => `Jugador${i}`);
  const env = await makeWorld(names);
  const seen = new Map();
  for (const isl of env.world.islands.values()) {
    if (isl.type === 'brumas') continue;
    assert.equal(fixPlaceName(isl.name), isl.name, `concuerda: ${isl.name}`);
    assert.ok(!seen.has(isl.name), `${isl.name} repetido (${seen.get(isl.name)} y ${isl.id})`);
    seen.set(isl.name, isl.id);
  }
  const lairs = [...env.world.islands.values()].filter((i) => i.type === 'kraken');
  assert.ok(lairs.length >= 5);
  assert.equal(lairs[0].name, 'Fosa del Kraken');
});

test('los nombres de antes se corrigen al arrancar, y las colonias con ellos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aegium-nombres-'));
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
    const a = await old.register('Lucio', 'secreto1', 'Lucipolis', { email: 'lucio@prueba.es' });
    await old.register('Anibal', 'secreto1', 'Cartago', { email: 'anibal@prueba.es' });
    const isl = (sector, type) => [...old.islands.values()].find((i) => i.sector === sector && i.type === type);
    // Como en los mundos de antes: sin concordar y repetidos
    const wrong = isl(0, 'libre');
    wrong.name = 'Islote Negra';
    const twin = isl(1, 'libre');
    twin.name = 'Islote Negro';
    old.games.get(a).state.colonies.push({ id: twin.id, name: twin.name, specialty: twin.specialty, yield: twin.yield });
    for (const sector of [0, 1]) isl(sector, 'barbaros').name = 'Cayo del Faro';
    old.newIslands.push(...old.islands.values());
    await old.persist(true);

    const W = await open();
    const get = (id) => W.islands.get(id).name;
    assert.equal(get(wrong.id), 'Islote Negro', 'se corrige y se queda con su nombre (es del sector más antiguo)');
    assert.notEqual(get(twin.id), 'Islote Negro', 'la del sector más nuevo cambia de nombre');
    assert.equal(W.games.get(a).state.colonies[0].name, get(twin.id), 'y su colonia con ella');
    const names = [...W.islands.values()].filter((i) => i.type !== 'brumas').map((i) => i.name);
    assert.equal(new Set(names).size, names.length, 'ninguno repetido');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
