import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, universe } from '../src/config.js';
import { combineGroups, count } from '../src/game/combat.js';
import { FEATS, RELICS, UNITS } from '../src/game/data.js';
import { capByRest, effectiveEmpires, featAt, featBoss, featCoop, featCycle, featHours, featPeriod, featPower, featRewards, forgeBonus, forgeGoal, forgeRoom, pledgeEmpires, relicDuel } from '../src/game/feats.js';
import { upgradeState } from '../src/game/Game.js';
import { makeWorld } from './world.js';

// Gestas de la Liga: calendario, coraza, juramento, oleadas, premios, perjurio y tregua.

const ARMY = { dromon: 10, hoplita: 150, espadachin: 50 };
const NAMES = ['Lucio', 'Anibal', 'Pericles', 'Temis', 'Ciro', 'Dido'];

/** Un mundo con `n` jugadores armados y una gesta convocada en el continente que mejor les pilla. */
async function featWorld(n = 4, army = ARMY) {
  const env = await makeWorld(NAMES.slice(0, n));
  const W = env.world;
  for (const g of env.players) Object.assign(g.state.units, army);
  const homes = env.players.map((g) => W.islands.get(g.state.home));
  const far = (c) => Math.max(...homes.map((h) => Math.hypot(c.x - h.x, c.z - h.z)));
  const site = [...W.islands.values()].filter((i) => i.type === 'continente').sort((a, b) => far(a) - far(b))[0].id;
  assert.ok(W.startFeat(site, { players: env.players.map((g) => g.userId) }, clock.now()));
  const f = W.islandStates.get(site).feat;
  return { env, W, site, f, players: env.players };
}

/** Todos juran y mandan su flota; avanza hasta que llegan. */
function pledgeAndSend(env, site, games, army = ARMY) {
  for (const g of games) assert.equal(g.pledgeFeat(site).ok, true, `${g.state.name} jura`);
  for (const g of games) {
    const r = g.sendMission('atacar', site, army);
    assert.equal(r.ok, true, r.reason);
  }
  env.until(Math.max(...games.map((g) => g.state.missions.at(-1).arrive)));
}

const fleetAt = (g, site) => g.state.missions.find((m) => m.target === site);

// ── Reglas puras ─────────────────────────────────────────────────────────────

test('la disputa por la reliquia: eliminatorias por gloria, el impar pasa y gana quien queda en pie', () => {
  const p = (uid, n, glory) => ({ uid, units: { hoplita: n }, atkMul: 1, hpMul: 1, glory });
  // Tres: el de más gloria pasa sin luchar y espera en la final
  const r = relicDuel([p(1, 50, 300), p(2, 400, 200), p(3, 20, 100)], () => 0.5);
  assert.deepEqual(r.rounds[0][0], { bye: 1 });
  assert.equal(r.rounds[0][1].a, 2);
  assert.equal(r.rounds[0][1].b, 3);
  assert.equal(r.rounds.length, 2);
  assert.equal(r.winner, 2, 'gana el ejército grande');
  assert.ok(count(r.lost[1]) > 0 && count(r.lost[3]) > 0, 'las bajas son de verdad');
  assert.ok(r.kills[2] > 0);
  assert.ok(count(r.left[2]) < 400, 'el que gana también pierde gente');
  // Uno solo (o nadie con tropas de combate)
  assert.equal(relicDuel([p(7, 10, 0), { uid: 8, units: {}, glory: 999 }]).winner, 7);
  assert.equal(relicDuel([{ uid: 8, units: {}, glory: 1 }]).winner, null);
});


test('el calendario de las gestas sale de la semilla y es el mismo para todos', () => {
  const a = featCycle(7);
  const b = featCycle(7);
  assert.deepEqual(a, b);
  assert.ok(a.omen >= 7 * featPeriod() && a.omen < 8 * featPeriod());
  assert.equal(a.start - a.omen, Math.round(featHours(FEATS.omenHours)));
  assert.equal(a.end - a.start, Math.round(featHours(FEATS.hours)));
  // featAt da la gesta en curso o la siguiente, nunca una ya acabada
  for (const t of [a.omen - 1, a.omen, a.start + 5, a.end - 1, a.end, a.end + featPeriod() / 2]) {
    const c = featAt(t);
    assert.ok(t < c.end, 'no ha acabado');
  }
  assert.equal(featAt(a.start + 5).k, 7);
  // Con otra semilla cambia
  const seed = universe.eventSeed;
  universe.eventSeed = seed + 12345;
  try {
    assert.notEqual(featCycle(7).omen, a.omen);
  } finally {
    universe.eventSeed = seed;
  }
});

test('imperios efectivos y coraza: cuentan muchos a la vez, no uno enorme', () => {
  assert.equal(effectiveEmpires([10, 10, 10, 10]), 4);
  assert.ok(effectiveEmpires([1000, 10, 10, 10]) < 1.1);
  assert.equal(featCoop(1), 0);
  assert.equal(featCoop(FEATS.coop[0][0]), 0);
  assert.equal(featCoop(4), 1);
  assert.equal(featCoop(10), 1);
  const mid = featCoop(2.5);
  assert.ok(mid > FEATS.coop[1][1] && mid < FEATS.coop[2][1], 'entre los puntos de la tabla');
  // Con el tope «el resto», una ballena con una cuenta pequeña y otra casi vacía no llega a 2,5
  assert.ok(pledgeEmpires([{ f: 1000 }, { f: 20 }, { f: 1 }]) < FEATS.minEffective);
  assert.ok(pledgeEmpires([{ f: 100 }, { f: 100 }, { f: 100 }]) >= FEATS.minEffective);
  // Con dos pequeñas iguales sí emerge, pero a la medida de ellas (la ballena cuenta como las dos juntas)
  assert.ok(pledgeEmpires([{ f: 1000 }, { f: 20 }, { f: 20 }]) >= FEATS.minEffective);
  assert.equal(capByRest([{ f: 1000 }, { f: 20 }, { f: 20 }]).f, 80);
});

test('el enemigo crece con el poder jurado, con el nivel del sitio y sin dejarse arrastrar por una ballena', () => {
  const P = { AM: 3000, HM: 8000, AL: 9000, HL: 30000 };
  const b1 = featBoss('tifon', P);
  const b2 = featBoss('tifon', { AM: 6000, HM: 16000, AL: 18000, HL: 60000 });
  assert.ok(Math.abs(b2.sierpe / b1.sierpe - 2) < 0.1);
  assert.ok(Math.abs(b2.gigante / b1.gigante - 2) < 0.1);
  assert.ok(b2.headHp > b1.headHp);
  const hard = featBoss('tifon', P, 2);
  assert.ok(hard.gigante > b1.gigante && hard.sierpe > b1.sierpe, 'nivel +2 es más duro');
  // Mínimos aunque nadie traiga nada
  const tiny = featBoss('tifon', { AM: 0, HM: 0, AL: 0, HL: 0 });
  assert.ok(tiny.sierpe >= 3 && tiny.gigante >= 10 && tiny.cabeza === 100);
  // Nadie pesa más que todos los demás juntos
  const capped = capByRest([{ AM: 10000, HM: 0, AL: 0, HL: 0, f: 10000 }, { AM: 100, HM: 0, AL: 0, HL: 0, f: 100 }, { AM: 100, HM: 0, AL: 0, HL: 0, f: 100 }]);
  assert.equal(capped.AM, 200 + 100 + 100);
});

test('juntar ejércitos pondera las mejoras por el ataque y la vida que aporta cada uno', () => {
  const army = combineGroups([
    { units: { dromon: 10 }, atkMul: 1.5, hpMul: 1 },
    { units: { lancero: 10 }, atkMul: 1, hpMul: 2 },
  ]);
  assert.deepEqual(army.units, { dromon: 10, lancero: 10 });
  const atk = (10 * 72 * 1.5 + 10 * 5) / (10 * 72 + 10 * 5);
  const hp = (10 * 190 + 10 * 18 * 2) / (10 * 190 + 10 * 18);
  assert.ok(Math.abs(army.atkMul - atk) < 1e-9);
  assert.ok(Math.abs(army.hpMul - hp) < 1e-9);
  assert.deepEqual(combineGroups([]), { units: {}, atkMul: 1, hpMul: 1 });
});

test('los premios van por tramos, con techo por lo arriesgado y por cabeza en el bote', () => {
  const p = (glory, brought, risk = 1e9) => ({ prod: 1000, f: 100, brought, glory, risk });
  const r = featRewards({ 1: p(500, 100), 2: p(300, 60), 3: p(150, 25), 4: p(50, 10), 5: p(0, 0) }, { result: 'victoria' });
  assert.equal(r[1].band, 2);
  assert.equal(r[2].band, 1);
  assert.equal(r[3].band, 0);
  assert.equal(r[4].band, -1, 'con menos del 25 % de su fuerza no llega a ningún tramo');
  assert.equal(r[5].value, 0);
  assert.ok(r[1].top && !r[1].heart);
  assert.equal(r[1].personal, FEATS.reward.hours[2] * 1000 * FEATS.reward.topBonus);
  assert.equal(r[2].personal, FEATS.reward.hours[1] * 1000);
  assert.ok(r[2].blessing > 0 && r[3].blessing === 0, 'la bendición es de Plata para arriba');
  // Nadie pasa del techo del bote
  const pot = FEATS.reward.pot * 5000;
  for (const id of [1, 2, 3]) assert.ok(r[id].pot <= FEATS.reward.potCap * pot + 1e-6);
  // Lo que arriesgaste pone tope al botín personal
  const poor = featRewards({ 1: p(500, 100, 100), 2: p(500, 100), 3: p(500, 100) }, { result: 'victoria' });
  assert.equal(poor[1].personal, FEATS.reward.riskCap * 100 * (poor[1].top ? 1 : 1));
  // A medias, la mitad; en derrota, nada personal
  const half = featRewards({ 1: p(500, 100), 2: p(300, 60), 3: p(150, 25) }, { result: 'media' });
  const full = featRewards({ 1: p(500, 100), 2: p(300, 60), 3: p(150, 25) }, { result: 'victoria' });
  assert.ok(Math.abs(half[2].personal - full[2].personal / 2) < 1e-6);
  const lost = featRewards({ 1: p(500, 100), 2: p(300, 60), 3: p(150, 25) }, { result: 'derrota', phasesWon: 0 });
  for (const id of [1, 2, 3]) assert.equal(lost[id].value, 0);
});

test('el poder de un jugador cuenta sus barcos de guerra y su tierra, sin mercantes ni mercenarios', async () => {
  const env = await makeWorld(['Lucio']);
  const [A] = env.players;
  Object.assign(A.state.units, { dromon: 2, hoplita: 10, mercante: 5 });
  const P = featPower(A.state);
  assert.ok(P.AM > 0 && P.AL > 0);
  const base = featPower({ ...A.state, units: { ...A.state.units, mercante: 0 } });
  assert.equal(P.f, base.f, 'los mercantes no combaten');
});

// ── Juramento y emergencia ───────────────────────────────────────────────────

test('solo jura quien está convocado, una vez, con ejército y sin perjurio', async () => {
  const { site, players, W } = await featWorld(4);
  const [A, B, C, D] = players;
  assert.equal(A.pledgeFeat(site).ok, true);
  assert.match(A.pledgeFeat(site).reason, /Ya has jurado/);
  // Sin ejército
  for (const u of Object.keys(B.state.units)) B.state.units[u] = 0;
  assert.match(B.pledgeFeat(site).reason, /ejército/);
  // Perjuro reciente
  C.state.perjuryUntil = clock.now() + 3_600_000;
  assert.match(C.pledgeFeat(site).reason, /Rompiste tu juramento/);
  // De vacaciones
  D.state.vacation = { since: clock.now() };
  assert.match(D.pledgeFeat(site).reason, /vacaciones/);
  // Uno que no está convocado
  const env2 = await makeWorld(['Ciro']);
  const outsider = env2.players[0];
  outsider.world = W;
  outsider.userId = 999;
  Object.assign(outsider.state.units, ARMY);
  assert.match(outsider.pledgeFeat(site).reason, /convocado/);
  // Para atacar el continente hay que haber jurado; y solo atacar
  assert.match(B.planMission('atacar', site, { dromon: 1 }).reason, /Jura primero|No tienes/);
  assert.match(A.planMission('explorar', site, { dromon: 1 }).reason, /solo se puede atacar/);
  assert.equal(A.planMission('atacar', site, ARMY).ok, true);
});

test('con solo dos juramentos el enemigo vuelve a dormirse y las flotas regresan', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B] = players;
  pledgeAndSend(env, site, [A, B]);
  assert.equal(fleetAt(A, site).phase, 'estacionada');
  env.until(f.start);
  assert.equal(f.stage, 'fin');
  assert.equal(f.result, 'dormido');
  assert.equal(fleetAt(A, site).phase, 'vuelta');
  // Nadie es perjuro por esto
  assert.ok(!(A.state.perjuryUntil > clock.now()));
});

test('una ballena con dos imperios pequeños no despierta al enemigo', async () => {
  const { env, site, f, players } = await featWorld(3);
  const [A, B, C] = players;
  Object.assign(A.state.units, { dromon: 200, hoplita: 3000 });
  Object.assign(B.state.units, { dromon: 1, hoplita: 5, espadachin: 0 });
  Object.assign(C.state.units, { dromon: 0, hoplita: 1, espadachin: 0 });
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  env.until(f.start);
  assert.equal(f.result, 'dormido');
});

// ── Oleadas ──────────────────────────────────────────────────────────────────

test('un imperio solo no atraviesa la coraza: el enemigo se rehace y su flota sigue esperando', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B, C, D] = players;
  for (const g of [A, B, C, D]) assert.equal(g.pledgeFeat(site).ok, true);
  assert.equal(A.sendMission('atacar', site, ARMY).ok, true);
  env.until(f.start);
  assert.equal(f.stage, 'lucha');
  const full = f.boss.sierpe;
  f.boss.sierpe = full - 5;
  env.until(f.nextWave);
  const w = f.waves.at(-1);
  assert.equal(w.players, 1);
  assert.equal(w.coop, 0);
  assert.equal(w.killed, 0);
  assert.ok(f.boss.sierpe > full - 5, 'se rehace');
  assert.equal(fleetAt(A, site).phase, 'estacionada');
  assert.deepEqual(fleetAt(A, site).units, ARMY, 'sin bajas');
});

test('las flotas que esperan combaten juntas, ganan gloria y vuelven a casa con su informe', async () => {
  const { env, site, f, players } = await featWorld(4);
  pledgeAndSend(env, site, players);
  env.until(f.start);
  const tw = f.nextWave;
  env.until(tw);
  const w = f.waves.at(-1);
  assert.equal(w.players, 4);
  assert.equal(w.coop, 1);
  assert.ok(w.killed > 0);
  assert.ok(f.boss.phase >= 1, 'cae el mar');
  for (const g of players) {
    assert.ok(f.glory[g.userId] > 0, `${g.state.name} gana gloria`);
    assert.ok(f.brought[g.userId] > 0);
    const m = fleetAt(g, site);
    assert.ok(!m || m.phase === 'vuelta', 'vuelve a casa');
    assert.ok(g.state.reports.some((r) => r.kind === 'gesta' && r.battle && r.t === tw));
  }
});

test('una flota que llega después de la oleada no combate en ella', async () => {
  const { env, site, f, players } = await featWorld(5);
  const [A, B, C, D, E] = players;
  pledgeAndSend(env, site, [A, B, C, D]);
  assert.equal(E.pledgeFeat(site).ok, true);
  env.until(f.start);
  assert.equal(E.sendMission('atacar', site, ARMY).ok, true);
  const late = fleetAt(E, site);
  // Llega justo después de la oleada
  late.arrive = f.nextWave + 1000;
  env.until(f.nextWave);
  assert.equal(f.waves.at(-1).players, 4);
  assert.ok(!(f.brought[E.userId] > 0));
  env.until(late.arrive);
  assert.equal(late.phase, 'estacionada', 'espera a la siguiente');
});

test('con ejércitos de sobra, el enemigo cae y todos cobran (una sola vez)', async () => {
  const big = { dromon: 45, hoplita: 600, espadachin: 300 };
  const { env, site, f, players } = await featWorld(4, big);
  const before = players.map((g) => ({ ...g.state.resources }));
  pledgeAndSend(env, site, players, big);
  env.until(f.start);
  // Varias oleadas: tras cada una vuelven y se vuelven a mandar
  for (let i = 0; i < 8 && f.stage !== 'fin'; i++) {
    env.until(f.nextWave);
    if (f.stage === 'fin') break;
    for (const g of players) {
      const m = fleetAt(g, site);
      if (m?.phase === 'vuelta') env.until(m.back);
    }
    for (const g of players) {
      const units = Object.fromEntries(Object.keys(big).map((u) => [u, g.state.units[u]]));
      g.sendMission('atacar', site, units);
    }
    env.until(Math.max(...players.map((g) => g.state.missions.at(-1)?.arrive ?? 0)));
  }
  assert.equal(f.stage, 'fin');
  assert.equal(f.result, 'victoria');
  const tops = players.filter((g) => g.state.stats.featTop === 1);
  assert.equal(tops.length, 1, 'un solo Azote');
  for (const [i, g] of players.entries()) {
    assert.equal(g.state.stats.feats, 1);
    assert.ok(g.state.resources.cristal > before[i].cristal, 'cobra su parte');
    assert.ok(g.state.buffs.olimpo > clock.now(), 'bendición del Olimpo');
    assert.equal(g.state.reports.filter((r) => r.kind === 'gesta' && r.loot).length, 1, 'un solo premio');
  }
  // La reliquia legendaria (de las de Tifón) es para uno solo: el que gana la disputa
  const owners = players.filter((g) => (g.state.relics ?? []).some((r) => RELICS[r.id].rarity === 'legendaria'));
  assert.equal(owners.length, 1, 'una sola legendaria');
  assert.ok(['rayozeus', 'escama'].includes(owners[0].state.relics[0].id), 'de las de la gesta');
  assert.ok(players.every((g) => g.state.reports.find((r) => r.kind === 'gesta' && r.loot).text.includes('Disputa por la reliquia')), 'todos saben quién se la queda');
  // De la disputa vuelve herida una parte de los caídos
  const duelText = players.map((g) => g.state.reports.find((r) => r.kind === 'gesta' && r.loot).text);
  for (const text of duelText) {
    const m = text.match(/pierdes (\d+) tropas de tierra, pero (\d+) vuelven heridas/);
    if (m) assert.ok(Number(m[2]) >= Math.floor(Number(m[1]) * FEATS.reward.duelWounded) - 3 && Number(m[2]) <= Number(m[1]) * FEATS.reward.duelWounded);
  }
  assert.ok(duelText.some((t) => t.includes('vuelven heridas')), 'hubo disputa con heridos');
  for (const g of players) assert.ok(Object.keys(g.state.reports.find((r) => r.kind === 'gesta' && r.loot).loot).length > 0, 'con botín');
  // El sitio sube de nivel si cae pronto
  assert.equal(env.world.islandStates.get(site).featTier, 1);
  // Pasa otra vuelta del bucle: no se vuelve a pagar
  env.advance(3_600_000);
  for (const g of players) assert.equal(g.state.stats.feats, 1);
});

test('en la derrota vuelven los heridos, los perjuros reciben ceniza y el sitio baja', async () => {
  const { env, site, f, players, W } = await featWorld(4);
  const [A, B, C, D] = players;
  // D jura y no trae nada: perjuro
  for (const g of [A, B, C, D]) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of [A, B, C]) assert.equal(g.sendMission('atacar', site, { dromon: 1, hoplita: 20 }).ok, true);
  env.until(f.start);
  // Un enemigo imposible
  f.boss.sierpe = f.boss.full.sierpe = 5000;
  env.until(f.nextWave);
  assert.ok(f.fallen[A.userId], 'hubo caídos');
  const hoplitas = A.state.units.hoplita;
  // A las horas del juramento, quien no ha combatido es perjuro
  env.until(f.start + featHours(FEATS.perjuryHours));
  assert.ok(D.state.buffs.ceniza > clock.now(), 'ceniza para el perjuro');
  assert.ok(D.state.perjuryUntil > clock.now() + featHours(24));
  assert.ok(f.perjurers.includes(D.userId));
  assert.ok(!f.pledged[D.userId]);
  assert.ok(!(A.state.buffs.ceniza > 0), 'quien combatió no es perjuro');
  env.until(f.end);
  assert.equal(f.result, 'derrota');
  assert.ok(A.state.units.hoplita >= hoplitas, 'vuelven heridos');
  assert.equal(W.islandStates.get(site).featTier, -1);
  assert.equal(A.state.stats.feats, 0);
});

test('quien jura con la lucha empezada hace más fuerte al enemigo', async () => {
  const { env, site, f, players } = await featWorld(6);
  const [A, B, C, D, E, F] = players;
  for (const g of [A, B, C, D]) assert.equal(g.pledgeFeat(site).ok, true);
  env.until(f.start);
  assert.equal(f.stage, 'lucha');
  const before = { ...f.boss.full };
  assert.equal(E.pledgeFeat(site).ok, true);
  assert.ok(f.boss.full.gigante > before.gigante);
  assert.ok(f.boss.full.sierpe >= before.sierpe);
  // Pasado el plazo ya no se puede jurar
  env.until(f.start + featHours(FEATS.pledgeCloseHours));
  assert.match(F.pledgeFeat(site).reason, /cerrado/);
});

test('si se acaba el tiempo con el enemigo casi muerto, es una victoria a medias', async () => {
  const { env, site, f, players } = await featWorld(4);
  pledgeAndSend(env, site, players);
  env.until(f.start);
  env.until(f.nextWave);
  // Justo antes del final le quedan pocas cabezas
  env.until(f.end - 60_000);
  Object.assign(f.boss, { sierpe: 0, gigante: 0, phase: 2, cabeza: 10 });
  env.until(f.end);
  assert.equal(f.result, 'media');
  for (const g of players) assert.equal(g.state.stats.feats, 1, 'cuenta como gesta ganada');
});

test('el calendario convoca a los imperios activos cercanos al llegar los presagios', async () => {
  const env = await makeWorld(NAMES.slice(0, 4));
  const W = env.world;
  for (const g of env.players) {
    g.state.history = Array.from({ length: FEATS.minDays }, (_, i) => ({ t: i, score: 1000, army: 10 }));
    g.state.lastSeen = Date.now();
  }
  const cyc = featAt(clock.now() + featPeriod());
  env.until(cyc.omen);
  const sites = [...W.islandStates.entries()].filter(([, rt]) => rt.feat?.k === cyc.k);
  assert.equal(sites.length, 1, 'una gesta para los cuatro');
  const f = sites[0][1].feat;
  assert.equal(f.stage, 'presagio');
  assert.equal(f.start, cyc.start);
  for (const g of env.players) {
    assert.ok(f.convoked.includes(g.userId));
    assert.equal(g.state.feat.site, sites[0][0]);
    assert.ok(g.featInfo(), 'lo ve en su panel');
  }
  // No se vuelve a convocar en la misma vuelta del calendario
  env.advance(60_000);
  assert.equal([...W.islandStates.values()].filter((rt) => rt.feat?.k === cyc.k).length, 1);
});

test('se convoca a todos, aunque vivan muy lejos de cualquier continente', async () => {
  const env = await makeWorld(NAMES.slice(0, 5));
  const W = env.world;
  for (const g of env.players) {
    g.state.history = Array.from({ length: FEATS.minDays }, (_, i) => ({ t: i, score: 1000, army: 10 }));
    g.state.lastSeen = Date.now();
  }
  // Uno, al otro lado del mundo
  const far = env.players[4];
  Object.assign(W.islands.get(far.state.home), { x: 50_000, z: -50_000 });
  const cyc = featAt(clock.now() + featPeriod());
  env.until(cyc.omen);
  const feats = [...W.islandStates.values()].filter((rt) => rt.feat?.k === cyc.k).map((rt) => rt.feat);
  assert.equal(feats.length, 1);
  for (const g of env.players) assert.ok(feats[0].convoked.includes(g.userId), 'convocado');
  assert.ok(far.featInfo(), 'el lejano lo ve en su panel');
});

test('sin Cartas náuticas solo se convoca a las gestas a tu alcance', async () => {
  const env = await makeWorld(NAMES.slice(0, 5));
  const W = env.world;
  for (const g of env.players) {
    g.state.history = Array.from({ length: FEATS.minDays }, (_, i) => ({ t: i, score: 1000, army: 10 }));
    g.state.lastSeen = Date.now();
  }
  // El lejano, sin Cartas náuticas
  const far = env.players[4];
  Object.assign(W.islands.get(far.state.home), { x: 50_000, z: -50_000 });
  far.state.research.cartas = 0;
  const cyc = featAt(clock.now() + featPeriod());
  env.until(cyc.omen);
  const [site, rt] = [...W.islandStates.entries()].find(([, r]) => r.feat?.k === cyc.k);
  assert.equal(rt.feat.convoked.includes(far.userId), false, 'no lo convocan');
  assert.match(far.state.notes.at(-1).text, /Cartas náuticas/);
  for (const g of env.players.slice(0, 4)) assert.ok(rt.feat.convoked.includes(g.userId));
  // Y aunque lo estuviera, sin Cartas no la puede jurar ni su flota llega
  rt.feat.convoked.push(far.userId);
  far.state.units.hoplita = 20;
  const pledge = far.pledgeFeat(site);
  assert.equal(pledge.ok, false);
  assert.match(pledge.reason, /Cartas náuticas/);
  assert.equal(rt.feat.pledged?.[far.userId], undefined);
  rt.feat.pledged = { ...rt.feat.pledged, [far.userId]: { name: far.state.name } };
  far.state.units.dromon = 5;
  assert.match(far.planMission('atacar', site, { dromon: 5 }).reason, /Cartas náuticas/);
});

test('un jugador inactivo o sin recorrido no es convocado', async () => {
  const env = await makeWorld(NAMES.slice(0, 4));
  const W = env.world;
  for (const g of env.players) g.state.lastSeen = Date.now();
  // Sin días de juego suficientes nadie es candidato: no hay gesta
  const cyc = featAt(clock.now() + featPeriod());
  env.until(cyc.omen);
  assert.equal([...W.islandStates.values()].filter((rt) => rt.feat?.k === cyc.k).length, 0);
});

test('un moderador puede lanzar una gesta en el continente libre más cercano', async () => {
  const env = await makeWorld(NAMES.slice(0, 4));
  const W = env.world;
  const [A, B] = env.players;
  assert.throws(() => W.adminStartFeat(A.userId, {}), /moderadores/);
  W.admins.add('lucio');
  const res = W.adminStartFeat(A.userId, { omenMinutes: 5 });
  const f = W.islandStates.get(res.site).feat;
  assert.equal(f.stage, 'presagio');
  assert.equal(f.start - f.omen, (5 * 60_000) / universe.speed);
  assert.ok(f.convoked.includes(B.userId));
  assert.equal(B.featInfo().site, res.site);
  // No se lanza otra en el mismo continente mientras dure
  assert.throws(() => W.adminStartFeat(A.userId, { site: res.site }), /libre/);
});

// ── Tregua y estado ──────────────────────────────────────────────────────────

test('los que juran la misma gesta tienen tregua desde que emerge hasta unas horas después', async () => {
  const { env, site, f, players, W } = await featWorld(4);
  const [A, B, C] = players;
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  // Mandan algo para no ser perjuros (y perder la tregua)
  for (const g of [A, B, C]) assert.equal(g.sendMission('atacar', site, { dromon: 1, hoplita: 10 }).ok, true);
  // Antes de que emerja no hay tregua
  assert.equal(W.truce(A.userId, B.userId, clock.now()), false);
  env.until(f.start);
  assert.equal(W.truce(A.userId, B.userId, clock.now()), true);
  assert.match(A.planMission('atacar', B.state.home, { dromon: 5 }).reason, /[Tt]regua/);
  // Con quien no juró, sí se puede
  const D = players[3];
  assert.equal(W.truce(A.userId, D.userId, clock.now()), false);
  // El estado del navegador trae con quién hay tregua
  assert.deepEqual(W.snapshot(A.userId).truce.sort(), [B.userId, C.userId].sort());
  // En guerra no hay tregua
  const rel = W.relation.bind(W);
  W.relation = (a, b) => ((a === A.userId && b === B.userId) || (a === B.userId && b === A.userId) ? 'guerra' : rel(a, b));
  assert.equal(W.truce(A.userId, B.userId, clock.now()), false);
  W.relation = rel;
  // Acaba unas horas después del final
  env.until(f.end);
  assert.equal(W.truce(A.userId, B.userId, clock.now()), true);
  env.until(f.truceUntil);
  assert.equal(W.truce(A.userId, B.userId, clock.now()), false);
});

test('el estado de los demás no enseña el poder ni la producción de cada juramentado', async () => {
  const { site, players, W } = await featWorld(4);
  const [A, B] = players;
  for (const g of [A, B]) assert.equal(g.pledgeFeat(site).ok, true);
  const seen = W.snapshot(A.userId).world.states[site].feat;
  assert.ok(seen, 'A ve la gesta aunque el continente quede lejos');
  assert.deepEqual(Object.keys(seen.pledged[B.userId]), ['name']);
  assert.ok(seen.pledged[A.userId].f > 0, 'su propia fuerza sí');
  assert.equal(seen.risk, undefined);
  // El original no se toca
  assert.ok(W.islandStates.get(site).feat.pledged[B.userId].P);
});

test('mientras hay una gesta en un continente no llegan hordas', async () => {
  const { env, site, f, W, players } = await featWorld(4);
  const rt = W.islandStates.get(site);
  rt.nextHorde = clock.now() + 1000;
  // Hace falta un colono para que el continente cuente
  const land = [...W.islands.values()].find((i) => i.land === site);
  players[0].state.colonies.push({ id: land.id, name: land.name, specialty: 'madera', yield: 1 });
  W.hordeCheck = 0;
  env.advance(5000);
  assert.equal(rt.horde ?? null, null);
  assert.ok(rt.nextHorde >= f.end, 'la próxima espera a que acabe');
});

test('una partida guardada antigua recibe los campos de las gestas', () => {
  const old = { version: 5, lastUpdate: 1000, home: 'x', name: 'Vieja', stats: { kills: 3 }, units: {} };
  const s = upgradeState(old);
  assert.equal(s.feat, null);
  assert.equal(s.perjuryUntil, 0);
  assert.equal(s.stats.feats, 0);
  assert.equal(s.stats.kills, 3);
  assert.ok(UNITS.sierpe.npc && UNITS.gigante.npc && UNITS.cabeza.npc);
});

// ── La fragua de Hefesto ─────────────────────────────────────────────────────

test('la fragua: meta con el tope «el resto», topes por jugador y lo que da cada cuarto', () => {
  assert.equal(forgeGoal([100, 100, 100]), FEATS.forge.hours * 300);
  // Una ballena no infla la meta: cuenta como todos los demás juntos
  assert.equal(forgeGoal([10000, 100, 100]), FEATS.forge.hours * 400);
  const forge = { goal: 1000, total: 0, by: {} };
  // El 45 % de la meta…
  assert.equal(forgeRoom(forge, 1, 10000), FEATS.forge.capShare * 1000);
  // …o 3 h de tu producción, lo que sea menos
  assert.equal(forgeRoom(forge, 1, 50), FEATS.forge.capHours * 50);
  assert.equal(forgeRoom({ goal: 1000, total: 990, by: {} }, 1, 10000), 10, 'no se pasa de la meta');
  assert.equal(forgeRoom({ goal: 1000, total: 450, by: { 1: 450 } }, 1, 10000), 0);
  assert.deepEqual(forgeBonus({ goal: 1000, total: 0 }), { quarters: 0, atk: 1, lava: 1 });
  assert.equal(forgeBonus({ goal: 1000, total: 499 }).quarters, 1);
  const full = forgeBonus({ goal: 1000, total: 1000 });
  assert.equal(full.quarters, 4);
  assert.ok(Math.abs(full.atk - (1 + 4 * FEATS.forge.atk)) < 1e-9);
  assert.equal(full.lava, 0);
});

test('ofrendar en la fragua: solo juramentados, solo madera, hierro y cristal, y se cobra solo lo que cabe', async () => {
  const { site, f, players } = await featWorld(4);
  const [A, B, C] = players;
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  const D = players[3];
  assert.match(D.featForge(site, { madera: 100 }).reason, /Jura primero/);
  assert.match(A.featForge(site, { piedra: 100 }).reason, /Elige/);
  assert.ok(f.forge.goal > 0, 'la meta sale de lo jurado');
  // Pide mucho más de lo que cabe: se recorta
  const before = A.state.resources.madera;
  const room = A.featInfo().forge.room;
  assert.ok(room > 0);
  const res = A.featForge(site, { madera: 40000 });
  assert.equal(res.ok, true, res.reason);
  const spent = before - A.state.resources.madera;
  assert.ok(spent > 0 && spent < 40000, 'solo paga lo que cabe');
  assert.ok(f.forge.by[A.userId] <= room + 1);
  assert.ok(f.forge.by[A.userId] <= FEATS.forge.capShare * f.forge.goal + 1);
  assert.ok(f.glory[A.userId] > 0, 'ofrendar da gloria');
  // Ya no cabe más
  assert.match(A.featForge(site, { madera: 10 }).reason, /todo lo que puedes|llena/);
  // El estado público enseña la fragua sin lo de los demás
  const seen = env().world.snapshot(B.userId).world.states[site].feat.forge;
  assert.equal(seen.by[A.userId], undefined);
  assert.equal(seen.total, f.forge.total);
  function env() {
    return { world: A.world };
  }
});

test('quien ofrenda no es perjuro, y las ofrendas llegan como mucho a Plata', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B, C, D] = players;
  for (const g of [A, B, C, D]) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of [A, B, C]) assert.equal(g.sendMission('atacar', site, ARMY).ok, true);
  // D no combate, pero ofrenda todo lo que puede
  D.state.resources.hierro = 1e7;
  assert.equal(D.featForge(site, { hierro: 1e7 }).ok, true);
  env.until(f.start + featHours(FEATS.perjuryHours));
  assert.ok(!f.perjurers.includes(D.userId), 'ofrendar libra del perjurio');
  assert.ok(f.pledged[D.userId]);
  // En el reparto, las ofrendas solas no llegan a Oro
  const r = featRewards(
    { 1: { prod: 100, f: 100, brought: 0, glory: 50, risk: 1e9, offered: 100 * 10 }, 2: { prod: 100, f: 100, brought: 100, glory: 500, risk: 1e9 }, 3: { prod: 100, f: 100, brought: 100, glory: 450, risk: 1e9 } },
    { result: 'victoria' },
  );
  assert.equal(r[1].band, 1, 'Plata como mucho');
  const bronze = featRewards({ 1: { prod: 100, f: 100, brought: 0, glory: 50, risk: 1e9, offered: 100 * FEATS.reward.offer[0] }, 2: { prod: 100, f: 100, brought: 100, glory: 500, risk: 1e9 } }, { result: 'victoria' });
  assert.equal(bronze[1].band, 0);
});

test('la fragua llena da más ataque en las oleadas y quita la lava de las cabezas', async () => {
  const { env, site, f, players } = await featWorld(4);
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  // Llena la fragua entre todos
  for (const g of players) {
    g.state.resources.hierro = 1e7;
    g.featForge(site, { hierro: 1e7 });
  }
  assert.equal(forgeBonus(f.forge).quarters, 4);
  for (const g of players) assert.equal(g.sendMission('atacar', site, ARMY).ok, true);
  env.until(f.start);
  // Directos a las cabezas con furia: sin lava no hay daño extra
  Object.assign(f.boss, { sierpe: 0, gigante: 0, phase: 2, cabeza: 40 });
  f.boss.lava = 1e9;
  env.until(f.nextWave);
  const w = f.waves.at(-1);
  assert.equal(w.players, 4);
  // Con una lava enorme y sin fragua habrían caído todos; con la fragua llena no hay lava
  for (const g of players) {
    const m = fleetAt(g, site);
    assert.ok(m && m.phase === 'vuelta' && Object.values(m.units).reduce((a, b) => a + b, 0) > 0, 'vuelven supervivientes');
  }
});

// ── Chat, mapa, salón y estandarte ───────────────────────────────────────────

test('el chat de la gesta solo lo leen y escriben los convocados', async () => {
  const env = await makeWorld(NAMES.slice(0, 5));
  const W = env.world;
  const [A, B, C, D, E] = env.players;
  for (const g of env.players) Object.assign(g.state.units, ARMY);
  const site = [...W.islands.values()].find((i) => i.type === 'continente').id;
  // E no está convocado
  assert.ok(W.startFeat(site, { players: [A, B, C, D].map((g) => g.userId) }, clock.now()));
  const msg = W.addChat(A.userId, 'Todos a la oleada de las 18', 'gesta');
  assert.equal(msg.channel, `f:${site}`);
  const seenB = W.chatSince(B.userId, 0).find((m) => m.id === msg.id);
  assert.equal(seenB?.channel, 'gesta', 'B lo lee en la pestaña de la gesta');
  assert.equal(W.chatSince(E.userId, 0).find((m) => m.id === msg.id), undefined, 'E no lo ve');
  assert.throws(() => W.addChat(E.userId, 'hola', 'gesta'), /convocado/);
  // Los resúmenes de las oleadas van a ese chat
  const f = W.islandStates.get(site).feat;
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  env.until(f.start);
  env.until(f.nextWave);
  assert.ok(W.chatSince(A.userId, msg.id).some((m) => m.system && m.channel === 'gesta' && /Oleada/.test(m.text)));
  // Acabada la gesta y la tregua, la pestaña se cierra
  env.until(f.end);
  env.until(f.truceUntil);
  assert.throws(() => W.addChat(A.userId, 'adiós', 'gesta'), /convocado/);
});

test('el mapa del mundo y el salón enseñan las gestas en marcha', async () => {
  const { W, site, players, f, env } = await featWorld(4);
  const [A] = players;
  const map = W.worldMap(A.userId);
  const mark = map.feats.find((x) => x.site === site);
  assert.ok(mark, 'la gesta sale en el mapa');
  assert.equal(mark.me, true);
  assert.equal(mark.stage, 'presagio');
  const hall = W.featHallView(A.userId);
  assert.equal(hall.active.length, 1);
  assert.deepEqual(hall.hall, []);
  // Al acabar va al salón
  env.until(f.start);
  assert.equal(f.result, 'dormido');
  assert.equal(W.worldMap(A.userId).feats.length, 0);
  assert.equal(W.featHallView(A.userId).hall.length, 0, 'las que no emergen no van al salón');
  assert.ok(site);
});

test('quien llega a Oro en una victoria gana el emblema del rayo para su estandarte', async () => {
  const env = await makeWorld(['Lucio']);
  const [A] = env.players;
  assert.match(A.setBanner('#d94f4f', '⚡').reason, /no existe/);
  A.receiveFeatReward({ bag: {}, theme: 'tifon', won: true, emblem: '⚡', report: { t: clock.now(), kind: 'gesta', title: 'x', outcome: 'victoria' } }, clock.now());
  assert.deepEqual(A.state.emblems, ['⚡']);
  assert.equal(A.setBanner('#d94f4f', '⚡').ok, true);
  // No se repite
  A.receiveFeatReward({ bag: {}, theme: 'tifon', won: true, emblem: '⚡', report: { t: clock.now(), kind: 'gesta', title: 'x', outcome: 'victoria' } }, clock.now());
  assert.deepEqual(A.state.emblems, ['⚡']);
});

// ── Arreglos de la revisión ──────────────────────────────────────────────────

test('los mercenarios caídos en la gesta no vuelven como heridos', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A] = players;
  // Todos los hoplitas de A son mercenarios
  A.state.mercs = [{ id: 'm1', unit: 'hoplita', count: ARMY.hoplita, until: clock.now() + featHours(24 * 30) }];
  pledgeAndSend(env, site, players);
  env.until(f.start);
  env.until(f.nextWave);
  const lost = ARMY.hoplita - (fleetAt(A, site)?.units.hoplita ?? 0);
  assert.ok(lost > 0, 'cayeron hoplitas');
  assert.equal(f.fallen[A.userId]?.hoplita ?? 0, 0, 'no cuentan como bajas propias');
});

test('quien llevó su flota a oleadas sin combate y la retira no es perjuro', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B, C, D] = players;
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of [B, C, D]) assert.equal(g.sendMission('atacar', site, ARMY).ok, true);
  // A va sola a una oleada (la coraza no cede) y luego se retira
  assert.equal(A.sendMission('atacar', site, ARMY).ok, true);
  for (const g of [B, C, D]) for (const m of g.state.missions) m.arrive = f.start + featHours(20);
  env.until(f.start);
  env.until(f.nextWave);
  assert.equal(f.waves.at(-1).players, 1);
  A.recall(fleetAt(A, site).id);
  env.until(f.start + featHours(FEATS.perjuryHours));
  assert.ok(!f.perjurers.includes(A.userId));
  assert.ok(!(A.state.buffs.ceniza > clock.now()));
});

test('mandar una flota a última hora y retirarla no libra del perjurio', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B, C, D] = players;
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of [A, B, C]) assert.equal(g.sendMission('atacar', site, ARMY).ok, true);
  env.until(f.start);
  // D zarpa justo antes del juicio y su flota aún va de camino
  env.until(f.start + featHours(FEATS.perjuryHours) - 60_000);
  assert.equal(D.sendMission('atacar', site, { dromon: 1 }).ok, true);
  fleetAt(D, site).arrive = f.end - 60_000;
  env.until(f.start + featHours(FEATS.perjuryHours));
  assert.ok(!f.perjurers.includes(D.userId), 'a la hora del juicio iba de camino');
  D.recall(fleetAt(D, site).id);
  env.until(f.end);
  assert.ok(f.perjurers.includes(D.userId), 'al acabar se vuelve a mirar');
  assert.ok(D.state.perjuryUntil > clock.now());
});

test('la lava solo quema mientras quedan cabezas, y las cabezas no rebrotan', async () => {
  const { env, site, f, players } = await featWorld(4);
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  env.until(f.start);
  // Sin flotas: oleada vacía en la fase de las cabezas
  Object.assign(f.boss, { sierpe: 0, gigante: 0, phase: 2, cabeza: 30 });
  env.until(f.nextWave);
  assert.equal(f.boss.cabeza, 30, 'no se curan');
  // Con flotas: 1 cabeza en furia y una lava enorme; al morir la cabeza en el primer asalto se acaba
  for (const g of players) assert.equal(g.sendMission('atacar', site, ARMY).ok, true);
  env.until(Math.max(...players.map((g) => fleetAt(g, site).arrive)));
  f.boss.cabeza = 1;
  f.boss.lava = 1e9;
  env.until(f.nextWave);
  assert.equal(f.result, 'victoria');
  for (const g of players) {
    const m = fleetAt(g, site);
    assert.ok(m && count(m.units) > 0, 'vuelven supervivientes');
  }
});

test('la tregua vale desde que emerge aunque el bucle no haya pasado por la gesta', async () => {
  const { site, f, players, W } = await featWorld(4);
  const [A, B, C] = players;
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  // Sin dar vueltas al bucle: la gesta sigue en presagios en el estado
  assert.equal(f.stage, 'presagio');
  assert.equal(W.truce(A.userId, B.userId, f.start - 1), false);
  assert.equal(W.truce(A.userId, B.userId, f.start + 1), true);
  assert.equal(W.truce(A.userId, B.userId, f.end + featHours(1)), true, 'hasta unas horas después del final');
  assert.equal(W.truce(A.userId, B.userId, f.end + featHours(FEATS.truceAfterHours) + 1), false);
});

test('un aliado que juró la misma gesta que el defensor no se suma al ataque conjunto', async () => {
  const env = await makeWorld(NAMES.slice(0, 5));
  const W = env.world;
  const [A, B, C, D, L] = env.players;
  for (const g of env.players) Object.assign(g.state.units, ARMY, { mercante: 4 });
  const site = [...W.islands.values()].find((i) => i.type === 'continente').id;
  assert.ok(W.startFeat(site, { players: [A, B, C, D].map((g) => g.userId) }, clock.now()));
  const f = W.islandStates.get(site).feat;
  for (const g of [A, B, C]) assert.equal(g.pledgeFeat(site).ok, true);
  // L y B en la misma alianza; L ataca a A y B se une
  W.sameAlliance = (x, y) => [x, y].every((u) => u === L.userId || u === B.userId);
  const rel = W.relation.bind(W);
  W.relation = (x, y) => (W.sameAlliance(x, y) && x !== y ? 'aliado' : rel(x, y));
  env.until(f.start - 60_000);
  assert.equal(L.sendMission('atacar', A.state.home, { dromon: 5, hoplita: 50 }).ok, true);
  const lm = L.state.missions.at(-1);
  lm.arrive = f.start + featHours(1);
  const res = B.sendMission('atacar', A.state.home, { dromon: 5, hoplita: 50 }, null, { join: `${L.userId}-${lm.id}` });
  assert.equal(res.ok, true, res.reason);
  env.until(lm.arrive);
  assert.ok(B.state.reports.some((r) => /tregua sagrada/.test(r.text ?? '')), 'B se da la vuelta');
  assert.ok(!B.state.reports.some((r) => r.kind === 'ataque' && r.battle), 'B no combate');
});

test('nadie está convocado a dos gestas a la vez', async () => {
  const env = await makeWorld(NAMES.slice(0, 4));
  const W = env.world;
  const conts = [...W.islands.values()].filter((i) => i.type === 'continente');
  const ids = env.players.map((g) => g.userId);
  assert.ok(W.startFeat(conts[0].id, { players: ids }, clock.now()));
  assert.ok(W.startFeat(conts[1].id, { players: ids }, clock.now()));
  assert.deepEqual(W.islandStates.get(conts[1].id).feat.convoked, []);
  assert.equal(env.players[0].state.feat.site, conts[0].id);
});

test('una flota que llega cuando la gesta ya ha acabado vuelve con el motivo de la gesta', async () => {
  const { env, site, f, players } = await featWorld(4);
  const [A, B] = players;
  for (const g of [A, B]) assert.equal(g.pledgeFeat(site).ok, true);
  assert.equal(A.sendMission('atacar', site, ARMY).ok, true);
  fleetAt(A, site).arrive = f.start + featHours(1);
  env.until(f.start + 60_000);
  assert.equal(f.result, 'dormido');
  env.until(fleetAt(A, site).arrive);
  assert.ok(A.state.reports.some((r) => r.kind === 'gesta' && /terminado|Nada que hacer/.test(`${r.title} ${r.text}`)));
  assert.ok(!A.state.reports.some((r) => /horda/i.test(`${r.title} ${r.text}`)));
});

test('al jurar una gesta terminan tus ocupaciones y vuelven tus flotas contra otros jugadores', async () => {
  const env = await makeWorld(NAMES.slice(0, 4));
  const W = env.world;
  const [A, B, C] = env.players;
  // A invade la ciudad de B
  Object.assign(A.state.units, { hoplita: 400, trirreme: 40, mercante: 40 });
  B.state.units = Object.fromEntries(Object.keys(B.state.units).map((k) => [k, 0]));
  const inv = A.sendMission('invadir', B.state.home, { hoplita: 300, trirreme: 20, mercante: 30 });
  assert.ok(inv.ok, inv.reason);
  env.until(A.state.missions.at(-1).arrive);
  assert.ok(B.state.occupied, 'B está ocupada');
  // Y manda otra flota contra C
  const atk = A.sendMission('atacar', C.state.home, { hoplita: 50, mercante: 5 });
  assert.ok(atk.ok, atk.reason);
  const toC = A.state.missions.at(-1);
  assert.equal(A.pledgeCosts().stations.length, 1);
  assert.equal(A.pledgeCosts().fleets.length, 1);
  // A jura una gesta
  W.admins.add('lucio');
  const res = W.adminStartFeat(A.userId, { omenMinutes: 60 });
  assert.ok(A.pledgeFeat(res.site).ok);
  assert.equal(B.state.occupied, null, 'la ciudad de B queda libre');
  assert.equal(toC.phase, 'vuelta', 'la flota contra C se da la vuelta');
  assert.equal(A.pledgeCosts().stations.length + A.pledgeCosts().fleets.length, 0);
});
