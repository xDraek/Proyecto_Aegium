import assert from 'node:assert/strict';
import { test } from 'node:test';
import { neutralScale } from '../src/game/rules.js';
import { CAMP_LOOT } from '../src/game/world.js';
import { islandVary } from '../src/game/Game.js';
import { makeWorld, sendAndArrive } from './world.js';

// Las islas neutrales crecen con la ciudad de quien las mira (o las ataca): sus guerreros y su
// botín se multiplican según sus puntos (todo lo invertido, no solo las minas). Lo compartido es lo
// que les queda.

const PRODUCERS = ['aserradero', 'cantera', 'granja', 'mina', 'fundicion', 'mercado'];
/** Una ciudad grande: unos 5.000 puntos. */
const BIG = 500_000;

/** El campamento bárbaro más pequeño cerca de A, que todos conocen. */
function camp(env) {
  const [A] = env.players;
  const isl = env.world.islandsNear(A.state.home, 400).find((i) => i.type === 'barbaros' && i.tier === 1);
  for (const g of env.players) g.state.known[isl.id] = { explored: true };
  return isl;
}

const total = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);
/** Los guerreros de un campamento, con la variación propia de esa isla. */
const warriors = (isl, k = 1) => Math.floor(8 * k * islandVary(isl.id, 'barbaro') + 1e-6);
/** El botín lleno de la isla, con su variación, por `k`. */
const fullLoot = (isl, k = 1) => Object.entries(isl.loot.mix).reduce((a, [res, f]) => a + CAMP_LOOT[1].max * f * k * islandVary(isl.id, res), 0);

test('una ciudad que empieza los ve como siempre; una grande, mucho más grandes', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  A.state.stats.spent = 0;
  B.state.stats.spent = BIG;
  assert.equal(neutralScale(A.state), 1);
  const k = neutralScale(B.state);
  assert.ok(k > 4 && k < 8, `escala con 5.000 puntos: ${k}`);

  const isl = camp(env);
  assert.deepEqual(A.island(isl.id).garrison, { barbaro: warriors(isl) });
  assert.equal(B.island(isl.id).garrison.barbaro, warriors(isl, k));
  assert.ok(Math.abs(total(B.island(isl.id).stock) - k * total(A.island(isl.id).stock)) < 3 * k + 3, 'y su botín, igual');
});

test('lo que queda se comparte: si uno grande la arrasa, vuelve con la mitad del botín para todos', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  A.state.stats.spent = 0;
  B.state.stats.spent = BIG;
  const k = neutralScale(B.state);
  const isl = camp(env);
  const before = total(B.island(isl.id).stock);

  Object.assign(B.state.units, { espadachin: 400, mercante: 40 });
  sendAndArrive(env, B, 'atacar', isl.id, { espadachin: 400, mercante: 40 });
  const report = B.state.reports.at(-1);
  assert.equal(report.outcome, 'victoria');
  assert.ok(total(report.loot) > CAMP_LOOT[1].max * 0.5, `se lleva un botín a su medida: ${total(report.loot)} (había ${before})`);

  const rt = env.world.islandState(isl.id);
  assert.ok(B.island(isl.id).rebuildUntil, 'queda arrasada');
  env.until(rt.stockAt);
  // Vuelve con la mitad de su botín: la mitad del de A para A y la mitad del de B para B
  assert.ok(Math.abs(total(A.island(isl.id).stock) - fullLoot(isl) / 2) < 4);
  assert.ok(Math.abs(total(B.island(isl.id).stock) - fullLoot(isl, k) / 2) < 4);
});

test('las flotas que zarparon antes del cambio luchan contra el campamento de antes', async () => {
  const env = await makeWorld();
  const [, B] = env.players;
  B.state.stats.spent = BIG;
  const isl = camp(env);
  Object.assign(B.state.units, { lancero: 1, mercante: 1 });
  assert.ok(B.sendMission('atacar', isl.id, { lancero: 1, mercante: 1 }).ok);
  const m = B.state.missions.at(-1);
  assert.equal(m.scaled, true);
  delete m.scaled;
  env.until(m.arrive);
  const enemy = B.state.reports.at(-1).battle.def;
  assert.equal(count(enemy.start), warriors(isl));
});

test('dos islas del mismo tipo no son calcadas, pero cada una es siempre igual', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  const camps = env.world.islandsNear(A.state.home, 2000).filter((i) => i.type === 'barbaros' && i.tier === 1);
  assert.ok(camps.length >= 2);
  const sizes = new Set(camps.map((i) => islandVary(i.id, 'barbaro')));
  assert.ok(sizes.size > 1, 'varían de una a otra');
  for (const i of camps) {
    const v = islandVary(i.id, 'barbaro');
    assert.ok(v >= 0.85 && v <= 1.15);
    assert.equal(v, islandVary(i.id, 'barbaro'));
  }
});

test('subir las minas no los hace más duros: solo cuentan los puntos, se gasten donde se gasten', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  const k = neutralScale(A.state);
  for (const id of PRODUCERS) A.state.buildings[id] = 15;
  assert.equal(neutralScale(A.state), k, 'las minas no cuentan aparte');
  A.state.stats.spent *= 4;
  assert.ok(neutralScale(A.state) > k, 'con más puntos, sí');
});

function count(units) {
  return Object.values(units).reduce((a, b) => a + b, 0);
}
