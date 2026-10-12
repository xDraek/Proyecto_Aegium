import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { CANCEL_REFUND, PVP_RANGE, RESOURCES, UNITS } from '../src/game/data.js';
import { newState, upgradeState } from '../src/game/Game.js';
import { costFor, payPerHour, protectedAmount } from '../src/game/rules.js';
import { makeWorld, sendAndArrive } from './world.js';

// Ajustes de equilibrio: cancelar con penalización, impuestos del mercado, abandonar colonias,
// Cartas náuticas, piratas que desembarcan, saqueo completo, paga de todas las tropas, tiempo
// de espera de las bendiciones y Equitación por niveles.


test('cancelar una obra devuelve solo una parte de lo pagado', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  const cost = costFor('aserradero', A.level('aserradero') + 1);
  const before = { ...A.state.resources };
  assert.equal(A.upgrade('aserradero').ok, true);
  assert.equal(A.cancel().ok, true);
  // (con lo poco que se produce mientras tanto)
  for (const [r, n] of Object.entries(cost)) assert.ok(Math.abs(A.state.resources[r] - (before[r] - n + Math.floor(n * CANCEL_REFUND))) < 1, r);
});

test('cancelar un reclutamiento devuelve solo una parte de lo pagado', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  const before = A.state.resources.madera;
  assert.equal(A.train('lancero', 10).ok, true);
  assert.equal(A.cancelTraining('cuartel', 0).ok, true);
  const paid = UNITS.lancero.cost.madera * 10;
  assert.ok(Math.abs(A.state.resources.madera - (before - paid + Math.floor(paid * CANCEL_REFUND))) < 1);
});

test('el mercado cobra impuestos altos: no compensa cambiar y deshacer', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  A.state.buildings.mercado = 20;
  A.state.research.comercio = 10;
  const rate = A.tradeRate('madera', 'piedra');
  const fair = RESOURCES.madera.value / RESOURCES.piedra.value;
  assert.ok(rate <= fair * 0.6 + 1e-9, 'como mucho se recupera el 60 % del valor');
  assert.ok(A.tradeRate('madera', 'piedra') * A.tradeRate('piedra', 'madera') < 0.4);
});

test('una colonia se puede abandonar y la isla queda libre', async () => {
  const { world, players } = await makeWorld();
  const [A] = players;
  const isl = world.islandsNear(A.state.home, 600).find((i) => i.type === 'libre');
  assert.ok(world.colonize(isl.id, A.userId));
  A.state.colonies.push({ id: isl.id, name: isl.name, specialty: isl.specialty, yield: isl.yield });
  assert.equal(A.abandonColony(isl.id).ok, true);
  assert.equal(A.state.colonies.length, 0);
  assert.equal(world.islandState(isl.id).colonizedBy, null);
  assert.equal(A.abandonColony(isl.id).ok, false, 'ya no es tuya');
});

test('sin Cartas náuticas solo se ataca a las ciudades cercanas', async () => {
  const { world, players } = await makeWorld();
  const [A, B] = players;
  A.state.research.cartas = 0;
  Object.assign(A.state.units, { trirreme: 5, hoplita: 20 });
  const dist = A.distanceTo(B.state.home);
  assert.ok(dist > PVP_RANGE, `los jugadores de la prueba están a ${Math.round(dist)} leguas`);
  assert.match(A.planMission('atacar', B.state.home, { trirreme: 5, hoplita: 20 }).reason, /Cartas náuticas/);
  assert.match(A.planMission('invadir', B.state.home, { trirreme: 5, hoplita: 20 }).reason, /Cartas náuticas/);
  // Con ellas, se llega a cualquier ciudad
  A.state.research.cartas = 1;
  assert.equal(A.planMission('atacar', B.state.home, { trirreme: 5, hoplita: 20 }).ok, true);
  // Las islas neutrales no dependen de las cartas
  A.state.research.cartas = 0;
  const camp = world.islandsNear(A.state.home, 600).find((i) => i.type === 'barbaros');
  A.state.known[camp.id] = { explored: true };
  assert.equal(A.planMission('atacar', camp.id, { trirreme: 5, hoplita: 20 }).ok, true);
});

test('los piratas traen barcos para todos sus piratas, más cuantos más puntos tienes, y desembarcan', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  const weak = A.raidTier();
  A.state.stats.spent = 5_000_000; // 50.000 puntos
  assert.ok(A.raidTier() > weak, 'más puntos, asaltos más fuertes');
  A.state.buildings.ayuntamiento = 3;
  for (const k of Object.keys(A.state.units)) A.state.units[k] = 0;
  A.state.nextRaidAt = clock.now() + 1000;
  env.advance(2000);
  const raid = A.state.raid;
  assert.ok(raid, 'aparecen los piratas');
  assert.ok(raid.army.corsario * 12 >= raid.army.pirata, 'caben todos en sus barcos');
  env.until(raid.arrival);
  const rep = A.state.reports.find((r) => r.kind === 'defensa');
  assert.equal(rep.outcome, 'derrota');
  assert.equal(rep.battle.landed, true, 'desembarcan');
  assert.ok(Object.keys(rep.loot ?? {}).length > 0, 'y saquean');
});

test('al saquear una ciudad se lleva todo lo que no protege el almacén, si cabe en los barcos', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  for (const k of Object.keys(B.state.units)) B.state.units[k] = 0;
  B.state.resources = { madera: 3000, piedra: 3000, comida: 3000, hierro: 3000, cristal: 3000, oro: 3000 };
  const safe = protectedAmount(B.state);
  Object.assign(A.state.units, { galeon: 60, hoplita: 100, mercante: 10 });
  sendAndArrive(env, A, 'atacar', B.state.home, { galeon: 60, hoplita: 100, mercante: 10 });
  const rep = A.state.reports.find((r) => r.kind === 'ataque');
  assert.equal(rep.outcome, 'victoria');
  // Solo le queda lo protegido por el almacén (lo demás, también lo producido mientras llegaban, se lo llevan)
  for (const r of Object.keys(RESOURCES)) {
    assert.ok(rep.loot[r] >= 3000 - safe, `se llevan todo lo que había de ${r}`);
    assert.ok(Math.abs(B.state.resources[r] - safe) < 1, `a B le queda lo protegido de ${r}`);
  }
});

test('todas las tropas y los barcos cobran paga en oro (la élite, más)', () => {
  const s = newState({ home: 'x', name: 'Prueba' });
  for (const id of ['lancero', 'hoplita', 'mercante', 'trirreme', 'dromon']) assert.ok(UNITS[id].pay > 0, `${id} cobra`);
  assert.ok(UNITS.espartano.pay > UNITS.hoplita.pay);
  s.units.trirreme = 100;
  assert.ok(payPerHour(s) > 0, 'una flota sola también cuesta oro');
});

test('una bendición no se puede volver a invocar hasta que pasa su tiempo de espera', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.buildings.templo = 5;
  A.state.favor = 1000;
  assert.equal(A.castPower('cosecha').ok, true);
  const until = A.state.buffs.cosecha;
  const again = A.castPower('cosecha');
  assert.equal(again.ok, false);
  assert.match(again.reason, /aún no se puede volver a invocar/);
  assert.equal(A.state.buffs.cosecha, until, 'no se acumula');
  env.until(A.powerReady('cosecha'));
  assert.equal(A.castPower('cosecha').ok, true);
});

test('Equitación por niveles: caballería con el 2 y elefantes con el 4', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  Object.assign(A.state.buildings, { cuartel: 10, academia: 7 });
  Object.assign(A.state.research, { equitacion: 1, tactica: 3 });
  assert.equal(A.train('caballero', 1).ok, false);
  A.state.research.equitacion = 2;
  assert.equal(A.train('caballero', 1).ok, true);
  assert.equal(A.train('elefante', 1).ok, false);
  A.state.research.equitacion = 4;
  A.state.resources.comida = 100_000;
  assert.equal(A.train('elefante', 1).ok, true);
});

test('una partida guardada con la vieja Doma de elefantes pasa a Equitación 4', () => {
  const base = newState({ home: 'x', name: 'Prueba' });
  const doma = upgradeState({ ...base, research: { ...base.research, equitacion: 1, elefantes: 1 } });
  assert.equal(doma.research.equitacion, 4);
  assert.ok(!('elefantes' in doma.research));
  const caballeria = upgradeState({ ...base, research: { ...base.research, equitacion: 1, elefantes: 0 } });
  assert.equal(caballeria.research.equitacion, 2, 'quien ya tenía caballería la conserva');
  const queued = upgradeState({ ...base, research: { ...base.research, elefantes: 0 }, researchQueue: { id: 'elefantes', cost: { oro: 600 } } });
  assert.equal(queued.researchQueue, null);
  assert.equal(queued.resources.oro, base.resources.oro + 600, 'se devuelve lo pagado');
});

