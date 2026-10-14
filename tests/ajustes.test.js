import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { CANCEL_REFUND, PVP_RANGE, RESOURCES, UNITS } from '../src/game/data.js';
import { newState, upgradeState } from '../src/game/Game.js';
import { costFor, payPerHour, protectedAmount, worldEventAt } from '../src/game/rules.js';
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
  // (la Gran feria, si coincide, mejora el cambio)
  const feria = worldEventAt(A.now()).event?.trade ?? 0;
  assert.ok(rate <= fair * (0.6 + feria) + 1e-9, 'como mucho se recupera el 60 % del valor');
  assert.ok(A.tradeRate('madera', 'piedra') * A.tradeRate('piedra', 'madera') < (0.6 + feria) ** 2 + 1e-9);
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
  B.state.buildings.almacen = 2;
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

test('las tropas y los barcos cobran paga en oro (la élite, más), salvo la milicia', () => {
  const s = newState({ home: 'x', name: 'Prueba' });
  for (const id of ['arquero', 'hoplita', 'mercante', 'trirreme', 'dromon']) assert.ok(UNITS[id].pay > 0, `${id} cobra`);
  for (const id of ['lancero', 'hondero']) assert.ok(!UNITS[id].pay && UNITS[id].upkeep > 1, `${id} solo come`);
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

test('Equitación por niveles: caballería con el 2; los elefantes piden además la Doma de elefantes', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  Object.assign(A.state.buildings, { cuartel: 10, academia: 7 });
  Object.assign(A.state.research, { equitacion: 1, tactica: 3 });
  assert.equal(A.train('caballero', 1).ok, false);
  A.state.research.equitacion = 2;
  assert.equal(A.train('caballero', 1).ok, true);
  A.state.research.equitacion = 4;
  A.state.resources.comida = 100_000;
  assert.equal(A.train('elefante', 1).ok, false, 'sin la doma, no');
  A.state.research.elefantes = 1;
  assert.equal(A.train('elefante', 1).ok, true);
});

test('la Doma de elefantes pide Equitación 4 y quien llegó a Equitación 4 sin ella la conserva', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  Object.assign(A.state.buildings, { academia: 10 });
  Object.assign(A.state.research, { equitacion: 3, tactica: 2, elefantes: 0 });
  assert.equal(A.research('elefantes').ok, false);
  A.state.research.equitacion = 4;
  assert.equal(A.research('elefantes').ok, true);

  const base = newState({ home: 'x', name: 'Prueba' });
  const { elefantes, ...sinDoma } = base.research;
  assert.equal(elefantes, 0);
  assert.equal(upgradeState({ ...base, research: { ...sinDoma, equitacion: 4 } }).research.elefantes, 1, 'conserva los elefantes');
  assert.equal(upgradeState({ ...base, research: { ...sinDoma, equitacion: 2 } }).research.elefantes, 0);
  const viejo = { ...sinDoma, equitacion: 1 };
  delete viejo.cartas;
  assert.equal(upgradeState({ ...base, research: viejo }).research.equitacion, 2, 'quien ya tenía caballería la conserva');
});

test('con Cartas náuticas se puede traer a tu mapa y atacar una ciudad lejana', async () => {
  const names = Array.from({ length: 14 }, (_, i) => `Jugador${i}`);
  const env = await makeWorld(names);
  const [A, ...rest] = env.players;
  const far = rest.reduce((a, b) => (A.distanceTo(b.state.home) > A.distanceTo(a.state.home) ? b : a));
  const id = far.state.home;
  assert.ok(A.distanceTo(id) > 700, `la más lejana está a ${Math.round(A.distanceTo(id))} leguas`);
  assert.ok(!env.world.snapshot(A.userId).world.islands.some((i) => i.id === id), 'no está en su mapa');
  // Sin las cartas no se puede traer
  A.state.research.cartas = 0;
  assert.match(A.watchCity(id).reason, /Cartas náuticas/);
  // Con ellas, sí: aparece en su mapa y se puede atacar
  A.state.research.cartas = 1;
  assert.equal(A.watchCity(id).ok, true);
  const seen = new Set(env.world.snapshot(A.userId).world.islands.map((i) => i.id));
  assert.ok(seen.has(id), 'ya está en su mapa');
  // Y también lo que tiene alrededor (sus campamentos, sus vecinos…)
  const around = env.world.islandsNear(id, 200).filter((i) => i.id !== id);
  assert.ok(around.length > 0 && around.every((i) => seen.has(i.id)), 'se ve lo que tiene alrededor');
  Object.assign(A.state.units, { trirreme: 5, hoplita: 20 });
  assert.equal(A.planMission('atacar', id, { trirreme: 5, hoplita: 20 }).ok, true);
  assert.equal(A.watchCity(A.state.home).ok, false, 'la tuya no');
});

test('ninguna colonia da oro: las de antes pasan a dar cristal', async () => {
  const { withoutGold } = await import('../src/game/world.js');
  const env = await makeWorld();
  for (const isl of env.world.islands.values()) assert.notEqual(isl.specialty, 'oro', `${isl.name} no da oro`);
  const old = withoutGold({ id: 'x', specialty: 'oro', yield: 70 });
  assert.equal(old.specialty, 'cristal');
  assert.equal(old.yield, 90);
  const base = newState({ home: 'x', name: 'Prueba' });
  const st = upgradeState({ ...base, colonies: [{ id: 'c', name: 'C', specialty: 'oro', yield: 91 }, { id: 'd', name: 'D', specialty: 'madera', yield: 150 }] });
  assert.deepEqual(st.colonies.map((c) => c.specialty), ['cristal', 'madera']);
});

test('las investigaciones largas llegan a 20 con la mitad de efecto, y las partidas de antes duplican su nivel', async () => {
  const { researchCost, researchMax } = await import('../src/game/rules.js');
  for (const id of ['silvicultura', 'navegacion', 'comercio', 'logistica']) assert.equal(researchMax(id), 20, id);
  for (const id of ['herreria', 'armaduras']) assert.equal(researchMax(id), 10, id);
  // Los últimos niveles de Herrería cuestan bastante más que antes
  assert.ok(researchCost('herreria', 10).hierro > 2 * Math.floor(200 * 1.9 ** 9 * 1.25), 'más del doble que el nivel 10 de antes');
  const base = newState({ home: 'x', name: 'Prueba' });
  const old = upgradeState({ ...base, version: 6, research: { ...base.research, silvicultura: 10, navegacion: 3, herreria: 4 }, researchQueue: { id: 'mineria', level: 5, cost: {}, end: 1 } });
  assert.equal(old.research.silvicultura, 20);
  assert.equal(old.research.navegacion, 6);
  assert.equal(old.research.herreria, 4, 'Herrería no cambia');
  assert.equal(old.researchQueue.level, 10);
  // Una partida ya migrada no se vuelve a tocar
  assert.equal(upgradeState(old).research.silvicultura, 20);
});
