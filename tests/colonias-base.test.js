import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { COLONY_RAID } from '../src/game/data.js';
import { colonyYield } from '../src/game/rules.js';
import { makeWorld, sendAndArrive } from './world.js';

// Las colonias como base: guarnición, ataques desde ellas y saqueos de las colonias de otros.

const ARMY = { mercante: 40, trirreme: 20, hoplita: 400, lancero: 200 };

/** Un mundo con Lucio dueño de una colonia (explorada por los dos) y ejércitos para ambos. */
async function colonyWorld() {
  const env = await makeWorld(['Lucio', 'Anibal']);
  const W = env.world;
  const [A, B] = env.players;
  const home = W.islands.get(A.state.home);
  const isl = [...W.islands.values()].filter((i) => i.type === 'libre' && !i.land).sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
  assert.ok(W.colonize(isl.id, A.userId));
  A.state.colonies.push({ id: isl.id, name: isl.name, specialty: isl.specialty, yield: isl.yield, level: 1 });
  for (const g of [A, B]) {
    Object.assign(g.state.units, ARMY);
    g.state.known[isl.id] = { explored: true };
  }
  return { env, W, A, B, col: isl };
}

test('se despliegan tropas en una colonia y se quedan de guarnición (los refuerzos se suman)', async () => {
  const { env, A, col } = await colonyWorld();
  const atSea = A.fleetsAtSea();
  sendAndArrive(env, A, 'guarnicion', col.id, { mercante: 4, trirreme: 2, hoplita: 50 });
  assert.equal(A.garrisons().length, 1);
  assert.equal(A.garrisons()[0].units.hoplita, 50);
  assert.equal(A.fleetsAtSea(), atSea, 'la guarnición no ocupa una flota en el mar');
  sendAndArrive(env, A, 'guarnicion', col.id, { mercante: 2, hoplita: 20 });
  assert.equal(A.garrisons().length, 1, 'una sola guarnición por colonia');
  assert.equal(A.garrisons()[0].units.hoplita, 70);
  // Solo en tus colonias
  const other = [...env.world.islands.values()].find((i) => i.type === 'libre' && i.id !== col.id && !env.world.islandStates.get(i.id).colonizedBy);
  A.state.known[other.id] = { explored: true };
  assert.equal(A.planMission('guarnicion', other.id, { mercante: 1, hoplita: 1 }).ok, false);
});

test('desde la colonia se zarpa a atacar y la flota vuelve a ella con el botín para la capital', async () => {
  const { env, W, A, col } = await colonyWorld();
  sendAndArrive(env, A, 'guarnicion', col.id, { mercante: 16, trirreme: 10, hoplita: 200 });
  const base = A.garrisons()[0];
  const barb = [...W.islands.values()].find((i) => i.type === 'barbaros');
  A.state.known[barb.id] = { explored: true };
  // Hay que dejar a alguien guardándola
  assert.equal(A.planMission('atacar', barb.id, { ...base.units }, null, { from: base.id }).ok, false);
  const plan = A.planMission('atacar', barb.id, { mercante: 8, trirreme: 5, hoplita: 100 }, null, { from: base.id });
  assert.equal(plan.ok, true, plan.reason);
  assert.equal(plan.base, base, 'zarpa de la colonia');
  const before = A.state.resources.madera;
  const m = sendAndArrive(env, A, 'atacar', barb.id, { mercante: 8, trirreme: 5, hoplita: 100 }, { from: base.id });
  assert.equal(m.from, col.id);
  assert.equal(base.units.hoplita, 100, 'en la colonia se quedan los demás');
  env.until(m.back);
  assert.ok(base.units.hoplita > 100, 'los que vuelven se quedan en la colonia');
  assert.ok(A.state.resources.madera > before, 'el botín llega a la capital');
});

test('una colonia sin guarnición se puede saquear: botín de unas horas y sin producir un tiempo', async () => {
  const { env, W, A, B, col } = await colonyWorld();
  const plan = B.planMission('atacar', col.id, { mercante: 3, trirreme: 5, hoplita: 30 });
  assert.equal(plan.ok, true, plan.reason);
  B.sendMission('atacar', col.id, { mercante: 3, trirreme: 5, hoplita: 30 });
  // A ve venir el ataque contra su colonia
  const inc = W.snapshot(A.userId).incoming;
  assert.equal(inc.length, 1);
  assert.equal(inc[0].colony, col.name);
  env.until(B.state.missions.at(-1).arrive);
  const colony = A.colony(col.id);
  const expected = Math.floor(colonyYield(colony) * COLONY_RAID.lootHours);
  assert.ok(colony.raidedUntil > clock.now(), 'la colonia deja de producir');
  assert.equal(W.islandStates.get(col.id).raidedUntil, colony.raidedUntil);
  const m = B.state.missions.find((x) => x.target === col.id);
  assert.equal(m.cargo[colony.specialty], expected, 'se lleva unas horas de su producción');
  assert.ok(A.state.reports.some((r) => r.kind === 'defensa' && r.title.includes('ha saqueado tu colonia')));
  // Mientras no produce no se la puede volver a saquear
  assert.match(B.planMission('atacar', col.id, { mercante: 3, trirreme: 5, hoplita: 30 }).reason, /ya está saqueada/);
  // La colonia sigue siendo suya
  assert.equal(W.islandStates.get(col.id).colonizedBy, A.userId);
});

test('una buena guarnición rechaza el saqueo', async () => {
  const { env, A, B, col } = await colonyWorld();
  sendAndArrive(env, A, 'guarnicion', col.id, { mercante: 22, trirreme: 20, hoplita: 300 });
  sendAndArrive(env, B, 'atacar', col.id, { mercante: 2, trirreme: 3, hoplita: 20 });
  assert.ok(!(A.colony(col.id).raidedUntil > clock.now()), 'sigue produciendo');
  assert.ok(A.garrisons()[0].units.hoplita > 250);
  assert.ok(A.state.reports.some((r) => r.kind === 'defensa' && r.title.includes('Tu guarnición rechaza')));
  // Un espía ve quién la guarda
  B.state.units.bote = 1;
  sendAndArrive(env, B, 'explorar', col.id, { bote: 1 });
  assert.ok(B.state.known[col.id].intel.garrison.hoplita > 0);
});

test('los aliados no se saquean, y al abandonar la colonia la guarnición vuelve a casa', async () => {
  const { env, W, A, B, col } = await colonyWorld();
  W.meta.alliances[1] = { id: 1, name: 'Liga', tag: 'LIG', founder: A.userId, members: [A.userId, B.userId], description: '', created: Date.now() };
  W.memberOf.set(A.userId, 1);
  W.memberOf.set(B.userId, 1);
  assert.match(B.planMission('atacar', col.id, { mercante: 2, trirreme: 3, hoplita: 20 }).reason, /tu alianza/);
  sendAndArrive(env, A, 'guarnicion', col.id, { mercante: 2, hoplita: 10 });
  const g = A.garrisons()[0];
  assert.equal(A.abandonColony(col.id).ok, true);
  assert.equal(g.phase, 'vuelta', 'la guarnición vuelve a casa');
});
