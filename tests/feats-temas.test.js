import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { count } from '../src/game/combat.js';
import { FEAT_THEMES } from '../src/game/data.js';
import { featBoss, featHours, forgeRoom } from '../src/game/feats.js';
import { makeWorld } from './world.js';

// Las otras gestas: la Armada del Gran Rey (fondeaderos, cerco y campamento) y la Hidra de Lerna
// (cabezas que vuelven como dos si no se cauterizan con la brea de la fragua).

const NAMES = ['Lucio', 'Anibal', 'Pericles', 'Temis', 'Ciro'];
const ARMY = { dromon: 60, hoplita: 300, espadachin: 150 };
// Ejércitos de sobra (y barcos para llevarlos)
const BIG = { dromon: 300, hoplita: 1500, espadachin: 600 };
const ASSAULT = { dromon: 120, hoplita: 1500, espadachin: 600 };

/** Un mundo con `n` jugadores armados y una gesta del tema `theme` en el continente que mejor les pilla. */
async function themeWorld(theme, n = 4, army = ARMY) {
  const env = await makeWorld(NAMES.slice(0, n));
  const W = env.world;
  // Ejércitos enormes: con oro de sobra para su paga mientras dura la gesta
  for (const g of env.players) {
    Object.assign(g.state.units, army);
    g.state.resources.oro = 5_000_000;
  }
  const homes = env.players.map((g) => W.islands.get(g.state.home));
  const far = (c) => Math.max(...homes.map((h) => Math.hypot(c.x - h.x, c.z - h.z)));
  const site = [...W.islands.values()].filter((i) => i.type === 'continente').sort((a, b) => far(a) - far(b))[0].id;
  assert.ok(W.startFeat(site, { theme, players: env.players.map((g) => g.userId) }, clock.now()));
  const f = W.islandStates.get(site).feat;
  const posts = [...W.islands.values()].filter((i) => i.land === site).length;
  return { env, W, site, f, players: env.players, posts };
}

const fleet = (g, site, type) => g.state.missions.find((m) => m.target === site && m.type === type && m.phase !== 'vuelta');
const arriveAll = (env, games) => env.until(Math.max(...games.flatMap((g) => g.state.missions.map((m) => m.arrive))));

// ── La Armada del Gran Rey ───────────────────────────────────────────────────

test('la Armada: una escuadra por fondeadero, medida por el K-ésimo mejor marino, y el campamento', () => {
  const P = { AM: 4000, HM: 10000, AL: 9000, HL: 30000 };
  const boss = featBoss('armada', P, 0, { posts: 4, mariners: [{ AM: 3000, HM: 8000 }, { AM: 500, HM: 1000 }, { AM: 500, HM: 1000 }, { AM: 100, HM: 300 }] });
  assert.equal(boss.posts.length, 4);
  // El cuarto mejor marino manda: una ballena no infla las escuadras
  assert.equal(boss.posts[0].squad, Math.max(1, Math.round((FEAT_THEMES.armada.tune.squad * Math.sqrt(100 * 300)) / 49)));
  assert.ok(boss.inmortal > 0 && boss.arquero_persa > 0);
  assert.equal(boss.inmortal / boss.arquero_persa, 3 / 2);
});

test('la Armada: tomar un fondeadero exige barcos de guerra, uno por jugador, y la flota se queda', async () => {
  const { env, site, f, players, posts } = await themeWorld('armada');
  const [A, B] = players;
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  assert.match(A.planMission('bloquear', site, { dromon: 10, hoplita: 10 }, null, { post: 0 }).reason, /barcos de guerra/);
  assert.match(A.planMission('bloquear', site, { dromon: 10 }, null, {}).reason, /fondeadero/);
  assert.match(A.planMission('bloquear', site, { dromon: 10 }, null, { post: posts }).reason, /fondeadero/);
  assert.equal(A.sendMission('bloquear', site, { dromon: 30 }, null, { post: 0 }).ok, true);
  assert.match(A.planMission('bloquear', site, { dromon: 10 }, null, { post: 1 }).reason, /solo puedes sostener uno/);
  // B va de escolta al mismo fondeadero
  assert.equal(B.sendMission('bloquear', site, { dromon: 30 }, null, { post: 0 }).ok, true);
  arriveAll(env, [A, B]);
  env.until(f.start);
  env.until(f.nextWave);
  assert.equal(f.boss.posts[0].holder, A.userId, 'lo toma el primero');
  for (const g of [A, B]) {
    const m = fleet(g, site, 'bloquear');
    assert.ok(m && m.phase === 'estacionada', 'la flota del fondeadero se queda');
    assert.ok(f.brought[g.userId] > 0, 'combatió');
  }
  // Retirarla funciona (no es un bloqueo de puerto)
  A.recall(fleet(A, site, 'bloquear').id);
  assert.equal(A.state.missions.find((m) => m.target === site && m.type === 'bloquear').phase, 'vuelta');
});

// Para la Armada: casi toda la marina a los fondeaderos y mercantes para llevar las tropas del asalto
const NAVY = { dromon: 300, mercante: 100, hoplita: 1500, espadachin: 600 };
const POST = { dromon: 250 };
const CAMP = { dromon: 50, mercante: 100, hoplita: 1500, espadachin: 600 };

/** Todos juran, cada uno toma un fondeadero (los que haya) y, si `assault`, asaltan el campamento. */
function siege(env, site, players, posts, assault = true) {
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const [i, g] of players.entries()) if (i < posts) assert.equal(g.sendMission('bloquear', site, POST, null, { post: i }).ok, true);
  if (assault) for (const g of players) assert.equal(g.sendMission('atacar', site, CAMP).ok, true);
  arriveAll(env, players);
}

test('la Armada: con el cerco completo el campamento pasa hambre y no se rehace', async () => {
  const { env, site, f, players, posts } = await themeWorld('armada', 4, NAVY);
  assert.ok(posts <= players.length);
  siege(env, site, players, posts, false);
  env.until(f.start);
  env.until(f.nextWave);
  assert.equal(f.boss.posts.filter((p) => p.holder != null).length, posts, 'todos los fondeaderos tomados');
  assert.ok(f.boss.hunger > 0, 'cerco completo: hambre');
  for (const g of players.slice(0, posts)) assert.equal(fleet(g, site, 'bloquear')?.phase, 'estacionada');
  // Sin cerco (se retira uno), el campamento recupera parte de lo que pierde en un asalto
  players[0].recall(fleet(players[0], site, 'bloquear').id);
  f.boss.inmortal = Math.round(f.boss.full.inmortal / 2);
  for (const g of players) assert.equal(g.sendMission('atacar', site, CAMP).ok, true);
  arriveAll(env, players);
  const before = f.boss.inmortal;
  env.until(f.nextWave);
  assert.equal(f.boss.posts[0].holder, null, 'el fondeadero abandonado vuelve a estar libre');
  assert.ok(f.waves.at(-1).killed > 0, 'el asalto mata persas');
  assert.ok(f.boss.inmortal < before);
});

test('la Armada: con el cerco completo y un buen asalto el campamento cae; el Navarco gana su reliquia', async () => {
  const { env, site, f, players, posts } = await themeWorld('armada', 4, NAVY);
  // Primero solo el cerco, una oleada para tomar los fondeaderos: si el campamento cayera en la misma
  // oleada en que se toman, nadie habría aguantado ninguna y no habría Navarco
  siege(env, site, players, posts, false);
  env.until(f.start);
  env.until(f.nextWave);
  for (let i = 0; i < 10 && f.stage !== 'fin'; i++) {
    env.until(f.nextWave);
    if (f.stage === 'fin') break;
    for (const g of players) {
      const m = g.state.missions.find((x) => x.target === site && x.type === 'atacar');
      if (m?.phase === 'vuelta') env.until(m.back);
    }
    for (const g of players) if (!fleet(g, site, 'atacar')) g.sendMission('atacar', site, { dromon: Math.min(50, g.state.units.dromon), mercante: g.state.units.mercante, hoplita: g.state.units.hoplita, espadachin: g.state.units.espadachin });
    arriveAll(env, players);
  }
  assert.equal(f.result, 'victoria');
  assert.equal(players.filter((g) => g.state.stats.featNavarch === 1).length, 1, 'un Navarco');
  const nav = players.find((g) => g.state.stats.featNavarch === 1);
  assert.ok(nav.state.relics.length >= 1);
  // Las flotas de los fondeaderos vuelven a casa al acabar
  for (const g of players) assert.ok(!g.state.missions.some((m) => m.target === site && m.phase === 'estacionada'));
  // Los tres de más gloria tienen estatua
  assert.equal(players.filter((g) => g.state.statue?.until > clock.now()).length, 3);
});

test('si gana la Armada, el continente queda como satrapía: ni maravilla ni colonias', async () => {
  const { env, site, f, players, W } = await themeWorld('armada', 4);
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of players) assert.equal(g.sendMission('atacar', site, { dromon: 5, hoplita: 50 }).ok, true);
  env.until(f.end);
  assert.equal(f.result, 'derrota');
  const rt = W.islandStates.get(site);
  assert.ok(rt.satrapyUntil > clock.now());
  const [A] = players;
  const land = [...W.islands.values()].find((i) => i.land === site && i.type === 'libre');
  if (land) {
    A.state.known[land.id] = { explored: true };
    A.state.units.mercante = 1;
    assert.match(A.planMission('colonizar', land.id, { mercante: 1 }).reason, /satrapía/);
  }
  env.until(rt.satrapyUntil + 1000);
  assert.ok(!(rt.satrapyUntil > clock.now()));
});

// ── La Hidra de Lerna ────────────────────────────────────────────────────────

test('la Hidra: sin brea, cada cabeza cortada vuelve como dos', async () => {
  const { env, site, f, players } = await themeWorld('hidra', 4);
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of players) assert.equal(g.sendMission('atacar', site, { dromon: 25, hoplita: 300, espadachin: 150 }).ok, true);
  arriveAll(env, players);
  env.until(f.start);
  assert.equal(f.boss.hidra, FEAT_THEMES.hidra.tune.heads);
  env.until(f.nextWave);
  const cut = f.boss.cut;
  assert.ok(cut > 0, 'cortan cabezas');
  assert.equal(f.boss.hidra, Math.min(FEAT_THEMES.hidra.tune.maxHeads, FEAT_THEMES.hidra.tune.heads + cut), 'vuelven dobles');
});

test('la Hidra: con la brea llena las cabezas cortadas no vuelven y la Hidra cae', async () => {
  const { env, site, f, players } = await themeWorld('hidra', 4, BIG);
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of players) {
    g.state.resources.cristal = 1e7;
    g.featForge(site, { cristal: 1e7 });
  }
  assert.ok(f.forge.total >= f.forge.goal * 0.99, 'brea llena');
  for (const g of players) assert.equal(g.sendMission('atacar', site, ASSAULT).ok, true);
  arriveAll(env, players);
  env.until(f.start);
  env.until(f.nextWave);
  assert.ok(f.boss.hidra < FEAT_THEMES.hidra.tune.heads || f.result === 'victoria');
  assert.ok(f.forge.used > 0, 'se gasta brea');
  for (let i = 0; i < 6 && f.stage !== 'fin'; i++) {
    for (const g of players) {
      const m = g.state.missions.find((x) => x.target === site && x.type === 'atacar');
      if (m?.phase === 'vuelta') env.until(m.back);
    }
    for (const g of players) if (!fleet(g, site, 'atacar')) g.sendMission('atacar', site, { dromon: Math.min(120, g.state.units.dromon), hoplita: g.state.units.hoplita, espadachin: g.state.units.espadachin });
    arriveAll(env, players);
    env.until(f.nextWave);
  }
  assert.equal(f.result, 'victoria');
  for (const g of players) assert.equal(g.state.stats.featHydra, 1);
});

test('la Hidra: la cabeza inmortal no cae con menos de 3 imperios efectivos', async () => {
  const { env, site, f, players } = await themeWorld('hidra', 4, BIG);
  const [A, B, C, D] = players;
  for (const g of players) assert.equal(g.pledgeFeat(site).ok, true);
  for (const g of players) {
    g.state.resources.cristal = 1e7;
    g.featForge(site, { cristal: 1e7 });
  }
  // Solo dos imperios en la oleada: coraza ×0,4
  for (const g of [A, B]) assert.equal(g.sendMission('atacar', site, ASSAULT).ok, true);
  arriveAll(env, [A, B]);
  env.until(f.start);
  f.boss.hidra = 1;
  const used = f.forge.used ?? 0;
  env.until(f.nextWave);
  assert.equal(f.forge.used ?? 0, used, 'la inmortal que resiste no gasta brea');
  assert.equal(f.waves.at(-1).players, 2);
  assert.equal(f.boss.hidra, 1, 'la inmortal resiste');
  assert.notEqual(f.result, 'victoria');
  assert.ok([C, D].every((g) => count(g.state.units) > 0));
  assert.ok(featHours(1) > 0);
});

test('la brea gastada deja sitio para volver a llenar la fragua', () => {
  // Llena, sin gastar: no cabe nada más
  assert.equal(forgeRoom({ goal: 1000, total: 1000, used: 0, by: { 1: 300 } }, 2, 1e6), 0);
  // Gastada en parte: cabe lo gastado (con los topes de cada uno)
  assert.equal(forgeRoom({ goal: 1000, total: 1000, used: 600, by: { 1: 300 } }, 2, 1e6), 450);
  assert.equal(forgeRoom({ goal: 1000, total: 1000, used: 300, by: { 1: 300 } }, 2, 1e6), 300);
  // La meta alcanza para algo más de las nueve cabezas
  const boss = featBoss('hidra', { AM: 0, HM: 0, AL: 9000, HL: 30000 }, 0, { prods: [1000, 1000, 1000, 1000] });
  assert.equal(boss.brea, Math.round((FEAT_THEMES.hidra.tune.brea * 4000) / FEAT_THEMES.hidra.tune.breaHeads));
});
