import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldServer } from '../server/WorldServer.js';
import { HORDE, UNITS } from '../src/game/data.js';
import { BARBARIAN_GARRISONS } from '../src/game/world.js';
import { makeWorld } from './world.js';

// Los arqueros de los bárbaros eran los del jugador: ahora son arqueros bárbaros (con las mismas
// fuerzas), y los campamentos grandes y las ciudadelas llevan berserkers. Los de un mundo de antes se
// ponen al día solos al cargarlo.

test('el arquero bárbaro pega y aguanta como el arquero, y forma en la retaguardia', () => {
  const a = UNITS.arquero;
  const b = UNITS.arquero_barbaro;
  assert.equal(b.atk, a.atk);
  assert.equal(b.hp, a.hp);
  assert.equal(b.cls, 'distancia');
  assert.ok(b.npc);
});

test('los campamentos de un mundo de antes cambian sus arqueros por arqueros bárbaros', async () => {
  const { world } = await makeWorld();
  const camp = [...world.islands.values()].find((i) => i.type === 'barbaros' && i.garrison.arquero_barbaro);
  assert.ok(camp, 'hay campamentos con arqueros bárbaros');
  // Como estaba antes: con arqueros del jugador en la plantilla y en la guarnición que queda
  camp.garrison = { barbaro: camp.garrison.barbaro, arquero: camp.garrison.arquero_barbaro };
  world.islandStates.get(camp.id).garrison = { barbaro: 5, arquero: 3 };
  const data = { meta: world.meta, users: [], players: {}, islands: [...world.islands.values()], islandStates: Object.fromEntries(world.islandStates), chat: [] };
  const again = new WorldServer({ load: async () => structuredClone(data), save: async () => {}, createUser: async () => 1 });
  await again.load();
  const isl = again.islands.get(camp.id);
  assert.equal(isl.garrison.arquero, undefined);
  assert.ok(isl.garrison.arquero_barbaro > 0);
  assert.deepEqual(again.islandStates.get(camp.id).garrison, { barbaro: 5, arquero_barbaro: 3 });
});

test('los campamentos grandes, las ciudadelas y la horda llevan berserkers, también los de antes', async () => {
  assert.equal(UNITS.berserker.cls, 'espada');
  assert.ok(UNITS.berserker.atk > UNITS.espartano.atk && UNITS.berserker.hp < UNITS.espartano.hp, 'mucho ataque y poca armadura');
  const { world } = await makeWorld();
  const big = [...world.islands.values()].find((i) => i.type === 'barbaros' && i.tier === 3);
  // Como era antes: sin berserkers
  big.garrison = { barbaro: 40, arquero: 22 };
  const data = { meta: world.meta, users: [], players: {}, islands: [...world.islands.values()], islandStates: Object.fromEntries(world.islandStates), chat: [] };
  const again = new WorldServer({ load: async () => structuredClone(data), save: async () => {}, createUser: async () => 1 });
  await again.load();
  assert.deepEqual(again.islands.get(big.id).garrison, BARBARIAN_GARRISONS.barbaros[3]);
  assert.ok(BARBARIAN_GARRISONS.ciudadela[5].berserker > 0);
  assert.ok(HORDE.garrison.berserker > 0);
});
