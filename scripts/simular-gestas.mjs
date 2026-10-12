// Calibración de las gestas con el motor de verdad (WorldServer en memoria, como las pruebas).
// Para cada tema y región juran todos, cada uno manda en cada oleada una parte de su ejército
// (y lo repone al volver) y se mide si cae el enemigo, en cuántas oleadas y qué cuesta.
//
//   node scripts/simular-gestas.mjs [tema] [vueltas]
//
// Las regiones son las del diseño: A = 5 medios; B = 1 avanzado + 4 medios + 2 tempranos;
// C = 4 tempranos; D = 2 medios.

import { clock } from '../src/config.js';
import { RESOURCES, UNITS } from '../src/game/data.js';
import { makeWorld } from '../tests/world.js';

const PROFILES = {
  temprano: { units: { lancero: 80, arquero: 60, espadachin: 30, trirreme: 3, mercante: 14 }, buildings: { herreria: 2, armaduras: 1 } },
  medio: { units: { lancero: 200, arquero: 150, espadachin: 150, hoplita: 100, caballero: 30, trirreme: 10, brulote: 6, galeon: 4, mercante: 47 }, buildings: { herreria: 5, armaduras: 3 } },
  avanzado: { units: { espadachin: 400, hoplita: 400, sagitario: 300, espartano: 200, catafracto: 100, elefante: 20, dromon: 30, liburna: 20, galeon: 20, mercante: 80 }, buildings: { herreria: 10, armaduras: 8 } },
};
const REGIONS = {
  A: ['medio', 'medio', 'medio', 'medio', 'medio'],
  B: ['avanzado', 'medio', 'medio', 'medio', 'medio', 'temprano', 'temprano'],
  C: ['temprano', 'temprano', 'temprano', 'temprano'],
  D: ['medio', 'medio'],
};
const NAMES = ['Lucio', 'Anibal', 'Pericles', 'Temis', 'Ciro', 'Dido', 'Safo'];

const value = (u) => Object.entries(u).reduce((s, [id, n]) => s + n * Object.entries(UNITS[id].cost ?? {}).reduce((a, [r, c]) => a + c * RESOURCES[r].value, 0), 0);
const scale = (u, f) => Object.fromEntries(Object.entries(u).map(([id, n]) => [id, Math.floor(n * f)]).filter(([, n]) => n > 0));

/** Parte `f` del ejército de casa, con los mercantes que hagan falta para llevar la tierra. */
function part(home, f, { ships = true } = {}) {
  const out = {};
  for (const [id, n] of Object.entries(home)) {
    const u = UNITS[id];
    if (!(n > 0) || id === 'mercante' || id === 'bote') continue;
    if (u.kind === 'barco' && !ships) continue;
    const k = Math.floor(n * f);
    if (k > 0) out[id] = k;
  }
  const seats = Object.entries(out).reduce((s, [id, n]) => s + (UNITS[id].kind === 'barco' ? n * (UNITS[id].capacity ?? 0) : 0), 0);
  const used = Object.entries(out).reduce((s, [id, n]) => s + (UNITS[id].kind !== 'barco' ? n * (UNITS[id].size ?? 1) : 0), 0);
  if (used > seats) out.mercante = Math.min(home.mercante ?? 0, Math.ceil((used - seats) / UNITS.mercante.capacity));
  return out;
}

async function run(theme, region, { share = Number(process.env.PARTE ?? 0.6), offerHours = 3 } = {}) {
  const env = await makeWorld(NAMES.slice(0, region.length));
  const W = env.world;
  const players = env.players;
  players.forEach((g, i) => {
    Object.assign(g.state.buildings, PROFILES[region[i]].buildings);
    g.state.units = { ...g.state.units, ...PROFILES[region[i]].units };
    g.state.resources = { madera: 1e7, piedra: 1e7, comida: 1e7, hierro: 1e7, cristal: 1e7, oro: 1e7 };
  });
  const start = players.map((g) => ({ ...g.state.units }));
  const startValue = start.map(value);
  const homes = players.map((g) => W.islands.get(g.state.home));
  const far = (c) => Math.max(...homes.map((h) => Math.hypot(c.x - h.x, c.z - h.z)));
  const site = [...W.islands.values()].filter((i) => i.type === 'continente').sort((a, b) => far(a) - far(b))[0].id;
  W.startFeat(site, { theme, players: players.map((g) => g.userId) }, clock.now());
  const f = W.islandStates.get(site).feat;
  for (const g of players) g.pledgeFeat(site);
  // Hidra: cada uno ofrenda brea hasta `offerHours` de su producción, y la repone cuando se gasta
  const brea = () => {
    if (theme !== 'hidra') return;
    for (const g of players) {
      const room = W.featForgeRoom(g.userId, site, clock.now()).room ?? 0;
      const want = Math.min(room, offerHours * f.pledged[g.userId].prod - (f.forge.by[g.userId] ?? 0));
      if (want >= 1) g.featForge(site, { madera: Math.ceil(want / RESOURCES.madera.value) });
    }
  };
  brea();
  // Armada: los K mejores marinos se quedan en un fondeadero con casi toda su flota de guerra
  const posts = W.sitesOn(site).length;
  if (process.env.DEBUG && f.boss == null) console.log('  ', theme, region.join('+'));
  const navy = (g) => Object.entries(g.state.units).reduce((s, [id, n]) => s + (UNITS[id].kind === 'barco' && UNITS[id].atk > 0 ? n * UNITS[id].atk : 0), 0);
  // (FONDEADEROS=n limita cuántos se intentan tomar, para ver qué pasa sin cerco)
  const posters = theme === 'armada' ? [...players].sort((a, b) => navy(b) - navy(a)).slice(0, Math.min(posts, Number(process.env.FONDEADEROS ?? posts))) : [];
  // (y vuelven a él con lo que les quede si lo pierden)
  const toPosts = () =>
    posters.forEach((g, i) => {
      if (g.state.missions.some((m) => m.target === site && m.type === 'bloquear' && m.phase !== 'vuelta')) return;
      const war = Object.fromEntries(Object.entries(g.state.units).filter(([id, n]) => n > 0 && UNITS[id].kind === 'barco' && UNITS[id].atk > 0).map(([id, n]) => [id, Math.floor(n * 0.85)]).filter(([, n]) => n > 0));
      if (Object.keys(war).length) g.sendMission('bloquear', site, war, null, { post: i });
    });
  toPosts();
  let lost = players.map(() => 0);
  const send = () => {
    toPosts();
    brea();
    for (const g of players) {
      if (g.state.missions.some((m) => m.target === site && m.type === 'atacar' && m.phase !== 'vuelta')) continue;
      // La ballena se contiene para no cerrar la coraza (lo que aconseja el panel)
      const mine = share * (region[players.indexOf(g)] === 'avanzado' ? 0.5 : region[players.indexOf(g)] === 'temprano' ? 1.3 : 1);
      const fleet = part(g.state.units, Math.min(1, mine), { ships: !posters.includes(g) });
      if (Object.keys(fleet).length) g.sendMission('atacar', site, fleet);
    }
    env.until(Math.max(...players.flatMap((g) => g.state.missions.filter((m) => m.phase === 'ida').map((m) => m.arrive)), clock.now()));
  };
  send();
  env.until(f.start);
  let waves = 0;
  while (f.stage !== 'fin') {
    env.until(f.nextWave);
    waves++;
    if (process.env.DEBUG) {
      const b = f.boss;
      const w = f.waves.at(-1);
      console.log(`  oleada ${waves}: N ${w?.N} coraza ${w?.coop} abatidos ${w?.killed}`, theme === 'armada' ? `fondeaderos ${b.posts.map((p) => (p.holder != null ? `T${p.held}` : p.squad)).join(',')} campamento ${b.inmortal + b.arquero_persa}/${b.full.inmortal + b.full.arquero_persa} hambre ${b.hunger}` : theme === 'hidra' ? `cabezas ${b.hidra} cortadas ${b.cut} brea ${Math.round((f.forge.total - (f.forge.used ?? 0)) / b.brea)} cabezas` : JSON.stringify({ s: b.sierpe, g: b.gigante, c: b.cabeza }));
    }
    if (f.stage === 'fin') break;
    // Vuelven, reponen lo perdido y vuelven a salir
    for (const g of players) for (const m of g.state.missions.filter((x) => x.phase === 'vuelta')) env.until(m.back);
    players.forEach((g, i) => {
      const now = { ...g.state.units };
      for (const m of g.state.missions) for (const [id, n] of Object.entries(m.units)) now[id] = (now[id] ?? 0) + n;
      const gone = {};
      for (const [id, n] of Object.entries(start[i])) if (n > (now[id] ?? 0)) gone[id] = n - (now[id] ?? 0);
      lost[i] += value(gone);
      if (process.env.DEBUG && value(gone)) console.log(`    ${region[i]}${posters.includes(g) ? ' (fondeadero)' : ''} pierde ${Math.round((value(gone) / startValue[i]) * 100)} %: ${JSON.stringify(gone)}`);
      for (const [id, n] of Object.entries(gone)) g.state.units[id] = (g.state.units[id] ?? 0) + n;
    });
    send();
  }
  lost = lost.map((l, i) => l / startValue[i]);
  return { result: f.result, waves, lost: lost.reduce((a, b) => a + b, 0) / lost.length, players: region.length };
}

const themes = process.argv[2] ? [process.argv[2]] : ['tifon', 'armada', 'hidra'];
const runs = Number(process.argv[3]) || 5;
const offerHours = Number(process.env.OFRENDA ?? 3);
for (const theme of themes) {
  for (const [name, region] of Object.entries(REGIONS)) {
    const out = [];
    for (let i = 0; i < runs; i++) out.push(await run(theme, region, { offerHours }));
    const wins = out.filter((r) => r.result === 'victoria').length;
    const mid = out.filter((r) => r.result === 'media').length;
    const avg = (k) => out.reduce((a, r) => a + r[k], 0) / out.length;
    console.log(`${theme.padEnd(7)} ${name}: victoria ${wins}/${runs}, media ${mid}, oleadas ${avg('waves').toFixed(1)}, pérdidas ${(avg('lost') * 100).toFixed(0)} % del ejército (repuesto)`);
  }
}
