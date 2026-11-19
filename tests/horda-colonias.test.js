import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLONY, HORDE } from '../src/game/data.js';
import { colonyYield } from '../src/game/rules.js';
import { makeWorld, sendAndArrive } from './world.js';

// La horda que nadie detiene asalta una a una las colonias del continente: la guarnición de cada una
// la defiende; la que cae baja un nivel y no produce en tres días.

/** Lucio y Anibal, cada uno con una colonia en el mismo continente y una horda que ya llega. */
async function hordeWorld() {
  // (con los graneros llenos: la guarnición pasa medio día esperando a la horda)
  const env = await makeWorld(['Lucio', 'Anibal'], { fed: true });
  const W = env.world;
  const [A, B] = env.players;
  // (un continente con al menos dos tierras)
  const lands = [...W.islands.values()].filter((i) => i.land);
  const cont = lands.find((i) => lands.filter((j) => j.land === i.land).length >= 2).land;
  const [la, lb] = lands.filter((i) => i.land === cont);
  for (const [g, isl] of [[A, la], [B, lb]]) {
    assert.ok(W.colonize(isl.id, g.userId));
    g.state.colonies.push({ id: isl.id, name: isl.name, specialty: isl.specialty, yield: isl.yield, level: 3 });
    g.state.known[isl.id] = { explored: true };
  }
  return { env, W, A, B, cont, la, lb };
}

/** Pone la horda en el continente y la deja vencer el plazo. */
function letHordeArrive(env, W, A, cont) {
  W.adminEvent(A.userId, 'horda');
  const h = W.islandStates.get(cont).horde;
  assert.ok(h, 'hay horda');
  W.hordeCheck = 0;
  env.until(h.deadline);
  W.hordeCheck = 0;
  env.advance(20_000);
  return h;
}

test('sin guarnición, la horda arrasa la colonia: baja un nivel y no produce en tres días', async () => {
  process.env.ADMINS = 'Lucio';
  const { env, W, A, B, cont, la, lb } = await hordeWorld();
  const h = letHordeArrive(env, W, A, cont);
  for (const [g, isl] of [[A, la], [B, lb]]) {
    const col = g.colony(isl.id);
    assert.equal(col.level, 3 - HORDE.levelLoss);
    const left = col.raidedUntil - h.deadline;
    assert.ok(left > (HORDE.ravageHours - 1) * 3_600_000, 'tres días sin producir');
    assert.ok(g.state.reports.some((r) => /La horda arrasa tu colonia/.test(r.title)));
  }
  assert.equal(W.islandStates.get(cont).horde ?? null, null, 'la horda se va');
  // Una colonia ya en el nivel 1 no baja de ahí
  const col = A.colony(la.id);
  col.level = 1;
  col.raidedUntil = 0;
  W.islandStates.get(cont).nextHorde = null;
  letHordeArrive(env, W, A, cont);
  assert.equal(A.colony(la.id).level, 1);
});

test('una buena guarnición la rechaza: la colonia se salva y sus bajas cuentan para el botín', async () => {
  process.env.ADMINS = 'Lucio';
  const { env, W, A, B, cont, la, lb } = await hordeWorld();
  Object.assign(A.state.units, { mercante: 300, trirreme: 25, hoplita: 1500, arquero: 1000, caballero: 500 });
  sendAndArrive(env, A, 'guarnicion', la.id, { mercante: 300, trirreme: 25, hoplita: 1500, arquero: 1000, caballero: 500 });
  assert.equal(A.garrisons().length, 1);
  const h = letHordeArrive(env, W, A, cont);
  // La de Anibal, sin guarnición, cae (va primero: la peor guardada)
  assert.equal(B.colony(lb.id).level, 2);
  // La de Lucio resiste
  assert.equal(A.colony(la.id).level, 3);
  assert.ok(!(A.colony(la.id).raidedUntil > h.deadline), 'sigue produciendo');
  // Los barcos amarrados no luchan ni caen
  assert.equal(A.garrisons()[0]?.units.mercante ?? 300, 300);
  assert.ok(A.state.reports.some((r) => /rechaza a la horda|no puede con/.test(r.title)));
  assert.ok((h.damage[A.userId] ?? 0) > 0, 'sus bajas cuentan');
  // Si la guarnición acaba con ella, la horda cae y hay botín
  assert.ok(A.state.reports.some((r) => /botín de la horda/.test(`${r.title} ${r.text}`)) || W.chat.some((m) => /ha sido derrotada/.test(m.text)));
});

test('las colonias producen un 25 % más', () => {
  assert.equal(COLONY.yieldMul, 1.25);
  assert.equal(colonyYield({ yield: 100, level: 1 }), 125);
});
