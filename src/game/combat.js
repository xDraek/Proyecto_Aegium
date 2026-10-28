import { COMBAT, COUNTERS, UNIT_CLASSES, UNITS } from './data.js';

// Combate por asaltos. Cada asalto los dos bandos disparan a la vez. El daño va sobre todo a la
// vanguardia: la retaguardia (los de distancia y las catapultas) solo recibe una parte mientras su
// vanguardia aguante, y lo que sobra al caer una línea pasa a la otra. Cada clase pega más a la que
// vence (las lanzas a la caballería, la caballería a los de distancia…). En el primer asalto los de
// distancia sueltan parte de su disparo antes del choque (lo que matan ya no responde) y la
// caballería carga. Las
// unidades sin ataque (mercantes, botes) no combaten: solo reciben daño cuando ya no queda
// ninguna unidad de combate en su bando.
//
// Un ataque por mar (`assault`) va en dos fases, como en Ikariam: primero luchan
// las flotas y, solo si el atacante se hace con el mar, desembarcan las tropas.

const MAX_ROUNDS = 6;

/**
 * `boost`: lo que se multiplican el ataque y la vida de algún tipo de unidad en concreto (el Kraken).
 * @typedef {{ units: Record<string, number>, atkMul?: number, hpMul?: number, extraAtk?: number, boost?: Record<string, number> }} Side
 * @returns {{ winner: 'att'|'def'|'draw', rounds: number,
 *   att: { start: object, left: object, lost: object }, def: { start: object, left: object, lost: object } }}
 */
export function battle(attacker, defender, rand = Math.random) {
  const att = prepare(attacker);
  const def = prepare(defender);
  let rounds = 0;
  const log = []; // lo que queda de cada bando tras cada asalto (para las repeticiones)
  // El daño fijo del defensor (torres) sigue aunque no le queden tropas, salvo si va con ellas (`extraOnlyAlive`, la lava de Tifón)
  while (rounds < MAX_ROUNDS && count(att.left) > 0 && (count(def.left) > 0 || (def.extraAtk > 0 && !def.extraOnlyAlive))) {
    rounds++;
    if (rounds === 1) {
      // La descarga y la carga: los de distancia de los dos bandos disparan y la caballería embiste…
      const toDef = strike(att, def, rand, 'volley');
      const toAtt = strike(def, att, rand, 'volley');
      hit(def, toDef, rand);
      hit(att, toAtt, rand);
      // …y luego chocan los demás
      const toDef2 = strike(att, def, rand, 'melee');
      const toAtt2 = strike(def, att, rand, 'melee');
      hit(def, toDef2, rand);
      hit(att, toAtt2, rand);
    } else {
      const toDef = strike(att, def, rand, 'all');
      const toAtt = strike(def, att, rand, 'all');
      hit(def, toDef, rand);
      hit(att, toAtt, rand);
    }
    log.push({ att: { ...att.left }, def: { ...def.left } });
  }
  let winner = 'draw';
  if (!hasCombat(att.left)) winner = 'def';
  else if (count(def.left) === 0) winner = 'att';
  return { winner, rounds, att: summary(att), def: summary(def), log, edges: { att: topEdge(att), def: topEdge(def) } };
}

function prepare(side) {
  const start = {};
  for (const [id, n] of Object.entries(side.units)) if (n > 0) start[id] = Math.floor(n);
  return { start, left: { ...start }, atkMul: side.atkMul ?? 1, hpMul: side.hpMul ?? 1, extraAtk: side.extraAtk ?? 0, extraOnlyAlive: !!side.extraOnlyAlive, boost: side.boost ?? {}, edges: {} };
}

/**
 * La ventaja que más ha pesado de un bando: qué tropa suya ha sacado más partido de su clase y
 * contra cuál (con las bajas de más que ha causado por ello), o null.
 */
function topEdge(side) {
  let best = null;
  for (const [key, kills] of Object.entries(side.edges)) {
    if (kills < 1 || (best && kills <= best.kills)) continue;
    const [from, to] = key.split('>');
    best = { from, to, kills: Math.round(kills) };
  }
  return best;
}

function summary(side) {
  const lost = {};
  for (const [id, n] of Object.entries(side.start)) {
    const d = n - (side.left[id] ?? 0);
    if (d > 0) lost[id] = d;
  }
  return { start: side.start, left: side.left, lost };
}

export function count(units) {
  return Object.values(units).reduce((s, n) => s + n, 0);
}

export function hasCombat(units) {
  return Object.entries(units).some(([id, n]) => n > 0 && UNITS[id].atk > 0);
}

/** Poder de ataque por asalto (sin azar), útil para estimaciones. */
export function power(units, atkMul = 1, boost = {}) {
  let p = 0;
  for (const [id, n] of Object.entries(units)) p += n * UNITS[id].atk * atkMul * (boost[id] ?? 1);
  return p;
}

/** Si un tipo de unidad forma en la retaguardia (y si dispara en la descarga). */
const isRear = (id) => !!UNIT_CLASSES[UNITS[id].cls]?.rear;
const isVolley = (id) => !!UNIT_CLASSES[UNITS[id].cls]?.volley;

/** Lo que suma la clase de `a` a su ataque contra la de `t` (0 si ninguna). */
export function counterBonus(a, t) {
  return COUNTERS[UNITS[a]?.cls]?.[UNITS[t]?.cls] ?? 0;
}

const unitHp = (side, id) => UNITS[id].hp * side.hpMul * (side.boost[id] ?? 1);

/** A quién pueden dar: las unidades de combate (o, si no queda ninguna, las demás). */
function targetsOf(side) {
  const alive = Object.entries(side.left).filter(([, n]) => n > 0);
  const fighters = alive.filter(([id]) => UNITS[id].atk > 0);
  return fighters.length ? fighters : alive;
}

/**
 * Qué parte del golpe recibe cada tipo del bando `side`: por su vida, pero la retaguardia solo
 * una parte de lo que le tocaría mientras haya vanguardia (toda la protección si la vanguardia
 * tiene al menos tanta vida como ella; menos cuanto más escasa).
 */
function weightsOf(side) {
  const targets = targetsOf(side);
  const front = targets.filter(([id]) => !isRear(id));
  const rear = targets.filter(([id]) => isRear(id));
  const pool = (list) => list.reduce((s, [id, n]) => s + n * unitHp(side, id), 0);
  const hpF = pool(front);
  const hpR = pool(rear);
  const total = hpF + hpR;
  const w = new Map();
  if (total <= 0) return w;
  let shareR = hpR / total;
  if (hpF > 0 && hpR > 0) shareR *= 1 - COMBAT.rearCover * Math.min(1, hpF / hpR);
  for (const [list, share, hp] of [[front, 1 - shareR, hpF], [rear, shareR, hpR]]) {
    for (const [id, n] of list) if (hp > 0) w.set(id, (share * n * unitHp(side, id)) / hp);
  }
  return w;
}

/**
 * El golpe de `from` contra `to` en esta fase del asalto (`volley`: al empezar, los de distancia y
 * la caballería con parte de su golpe; `melee`: el choque del primer asalto, con el resto, la carga
 * de la caballería y el daño fijo; `all`: todos, los demás asaltos). Cada
 * tipo reparte su ataque según el peso de cada blanco y pega más a los que vence. Devuelve el
 * daño para cada tipo del otro bando (aún sin aplicar).
 */
function strike(from, to, rand, phase) {
  const weights = weightsOf(to);
  const dmg = {};
  if (!weights.size) return dmg;
  const luck = 0.9 + rand() * 0.2;
  for (const [a, n] of Object.entries(from.left)) {
    const u = UNITS[a];
    if (!(n > 0) || !u.atk) continue;
    // (los de distancia y la caballería reparten su golpe del primer asalto: una parte al empezar,
    // con la descarga y la embestida, y el resto con el choque)
    const charging = u.cls === 'caballeria';
    const early = isVolley(a) || charging;
    if (phase === 'volley' && !early) continue;
    let atk = n * u.atk * from.atkMul * (from.boost[a] ?? 1) * luck;
    if (early && phase === 'volley') atk *= COMBAT.volley;
    else if (early && phase === 'melee') atk *= 1 - COMBAT.volley;
    const charge = phase !== 'all' && charging ? 1 + COMBAT.charge : 1;
    for (const [t, w] of weights) {
      const bonus = counterBonus(a, t);
      // (las lanzas frenan la carga: contra ellas no hay embestida)
      dmg[t] = (dmg[t] ?? 0) + atk * w * (1 + bonus) * (UNITS[t].cls === 'lanza' ? 1 : charge);
      // (lo que ha sumado la ventaja, en bajas, para el informe)
      if (bonus > 0) from.edges[`${a}>${t}`] = (from.edges[`${a}>${t}`] ?? 0) + (atk * w * bonus) / unitHp(to, t);
    }
  }
  // El daño fijo (las torres, el apoyo de los barcos): se reparte igual, sin ventajas
  if (phase !== 'volley' && from.extraAtk > 0) for (const [t, w] of weights) dmg[t] = (dmg[t] ?? 0) + from.extraAtk * luck * w;
  return dmg;
}

/** Aplica el daño a cada tipo; lo que sobra al caer uno entero pasa a los que quedan (según su vida). */
function hit(side, dmg, rand) {
  const pool = (id) => (side.left[id] ?? 0) * unitHp(side, id);
  let spill = 0;
  for (const [id, d] of Object.entries(dmg)) {
    if (d > pool(id)) {
      spill += d - pool(id);
      dmg[id] = pool(id);
    }
  }
  if (spill > 0) {
    const room = targetsOf(side).map(([id]) => [id, pool(id) - (dmg[id] ?? 0)]).filter(([, r]) => r > 0);
    const total = room.reduce((s, [, r]) => s + r, 0);
    for (const [id, r] of room) dmg[id] = (dmg[id] ?? 0) + Math.min(r, (spill * r) / total);
  }
  for (const [id, d] of Object.entries(dmg)) {
    const n = side.left[id] ?? 0;
    if (!(n > 0) || !(d > 0)) continue;
    const exact = d / unitHp(side, id);
    let kills = Math.floor(exact);
    if (rand() < exact - kills) kills++;
    side.left[id] = Math.max(0, n - kills);
  }
}

// ── Ataque por mar: batalla naval y desembarco ───────────────────────────────

/** Fracción del ataque de los barcos que quedan a flote que bombardea la costa. */
export const NAVAL_SUPPORT = 0.25;

const isShip = (id) => UNITS[id].kind === 'barco';

/** Separa los barcos de las tropas de tierra. */
export function splitForces(units) {
  const sea = {};
  const land = {};
  for (const [id, n] of Object.entries(units ?? {})) if (n > 0) (isShip(id) ? sea : land)[id] = Math.floor(n);
  return { sea, land };
}

/** Plazas para tropas que ofrecen los barcos. */
export function seatsOf(ships) {
  return Object.entries(ships).reduce((s, [id, n]) => s + n * (UNITS[id].capacity ?? 0), 0);
}

/** Plazas que ocupan las tropas de tierra. */
export function seatsUsed(troops) {
  return Object.entries(troops).reduce((s, [id, n]) => s + n * (UNITS[id].size ?? 1), 0);
}

/** Lo que las catapultas restan a la fortificación enemiga (`UNITS[id].siege` por unidad). */
export function siegeOf(units) {
  return Object.entries(units ?? {}).reduce((s, [id, n]) => s + (UNITS[id]?.siege ?? 0) * Math.max(0, n), 0);
}

/** Tropas que caben en `seats` plazas; las que no, se hunden con los barcos (en proporción). */
export function keepAboard(troops, seats) {
  const used = seatsUsed(troops);
  if (used <= seats) return { aboard: { ...troops }, drowned: {} };
  const k = Math.max(0, seats) / used;
  const aboard = {};
  const drowned = {};
  for (const [id, n] of Object.entries(troops)) {
    aboard[id] = Math.floor(n * k);
    if (n - aboard[id] > 0) drowned[id] = n - aboard[id];
  }
  return { aboard, drowned };
}

function merge(...bags) {
  const out = {};
  for (const b of bags) for (const [id, n] of Object.entries(b ?? {})) if (n > 0) out[id] = (out[id] ?? 0) + n;
  return out;
}

function lossOf(start, left) {
  const lost = {};
  for (const [id, n] of Object.entries(start)) if (n - (left[id] ?? 0) > 0) lost[id] = n - (left[id] ?? 0);
  return lost;
}

/**
 * Ataque por mar en dos fases.
 *
 * 1. Batalla naval: los barcos del atacante contra los del defensor (solo si el defensor tiene
 *    barcos de guerra). Si se hunden barcos y las tropas ya no caben a bordo, las que sobran se
 *    hunden con ellos. Si el defensor sigue teniendo barcos de guerra, no se puede desembarcar.
 * 2. Desembarco: con el mar libre, las tropas de tierra luchan contra las del defensor, con su
 *    muralla y sus torres; los barcos de guerra que quedan apoyan bombardeando la costa.
 *
 * `attacker`: { units, atkMul, hpMul }. `defender`: { units, atkMul, hpMul, navalHpMul, wallHp,
 * extraAtk, boost } (`hpMul` y `boost` valen para las dos fases; la muralla `wallHp` y las torres
 * `extraAtk`, solo en tierra; `navalHpMul`, solo en el mar).
 *
 * Con `needLanding`, el atacante solo gana si desembarca (para saquear una ciudad hacen falta
 * tropas en tierra); sin él, ganar el mar basta si el defensor no tiene a nadie en tierra.
 *
 * Devuelve lo mismo que `battle` (con el resumen de las dos fases juntas, ahogados incluidos en
 * las bajas del atacante) y además `naval`, `land`, `drowned`, `seaWon` y `landed`.
 */
export function assault(attacker, defender, { rand = Math.random, needLanding = false } = {}) {
  const A = splitForces(attacker.units);
  const D = splitForces(defender.units);
  const atkMul = attacker.atkMul ?? 1;
  const hpMul = attacker.hpMul ?? 1;
  const dAtk = defender.atkMul ?? 1;
  const dHp = defender.hpMul ?? 1;

  // 1. En el mar
  let naval = null;
  let seaLeft = { ...A.sea };
  let dSeaLeft = { ...D.sea };
  if (hasCombat(D.sea)) {
    naval = battle(
      { units: A.sea, atkMul, hpMul },
      { units: D.sea, atkMul: dAtk, hpMul: dHp + (defender.navalHpMul ?? 0), boost: defender.boost },
      rand,
    );
    seaLeft = naval.att.left;
    dSeaLeft = naval.def.left;
  }
  const seaWon = !hasCombat(dSeaLeft);
  const { aboard, drowned } = keepAboard(A.land, seatsOf(seaLeft));

  // 2. En tierra
  let land = null;
  let landLeft = aboard;
  let dLandLeft = { ...D.land };
  const landed = seaWon && count(aboard) > 0;
  if (landed && count(D.land) > 0) {
    const support = power(seaLeft, atkMul) * NAVAL_SUPPORT;
    land = battle(
      { units: aboard, atkMul, hpMul, extraAtk: support },
      { units: D.land, atkMul: dAtk, hpMul: dHp + (defender.wallHp ?? 0), extraAtk: defender.extraAtk ?? 0, extraOnlyAlive: defender.extraOnlyAlive, boost: defender.boost },
      rand,
    );
    landLeft = land.att.left;
    dLandLeft = land.def.left;
  }

  let winner;
  if (!seaWon) winner = naval?.winner === 'def' ? 'def' : 'draw';
  else if (landed) winner = land ? land.winner : 'att';
  else winner = count(D.land) > 0 || needLanding ? 'draw' : 'att';

  const aStart = merge(A.sea, A.land);
  const dStart = merge(D.sea, D.land);
  const aLeft = merge(seaLeft, landLeft);
  const dLeft = merge(dSeaLeft, dLandLeft);
  return {
    winner,
    rounds: (naval?.rounds ?? 0) + (land?.rounds ?? 0),
    att: { start: aStart, left: aLeft, lost: lossOf(aStart, aLeft) },
    def: { start: dStart, left: dLeft, lost: lossOf(dStart, dLeft) },
    log: [],
    naval,
    land,
    drowned,
    seaWon,
    landed,
  };
}

// ── Ejércitos de varios jugadores ───────────────────────────────────────────

/**
 * Junta los ejércitos de varios jugadores en uno solo para un combate. Cada uno trae sus unidades
 * con sus propios multiplicadores; el ejército común pondera los multiplicadores por el ataque y
 * la vida que aporta cada uno (no por el número de unidades: mil lanceros de un aliado débil no
 * rebajan el golpe de las tropas buenas del otro). `groups`: [{ units, atkMul, hpMul }].
 */
export function combineGroups(groups) {
  const units = {};
  let atkRaw = 0;
  let hpRaw = 0;
  let atkW = 0;
  let hpW = 0;
  for (const g of groups) {
    for (const [id, n] of Object.entries(g.units ?? {})) {
      if (!(n > 0)) continue;
      units[id] = (units[id] ?? 0) + n;
      atkRaw += n * UNITS[id].atk;
      hpRaw += n * UNITS[id].hp;
      atkW += n * UNITS[id].atk * (g.atkMul ?? 1);
      hpW += n * UNITS[id].hp * (g.hpMul ?? 1);
    }
  }
  return { units, atkMul: atkRaw ? atkW / atkRaw : 1, hpMul: hpRaw ? hpW / hpRaw : 1 };
}

/** Ataque por asalto que aporta un grupo (con sus multiplicadores): sirve para repartir el mérito. */
export function attackOf(group) {
  return power(group.units ?? {}, group.atkMul ?? 1);
}

/**
 * Reparte los supervivientes de un bando formado por varios grupos: cada uno
 * conserva la misma fracción de cada tipo; lo que sobra por redondeo, para el primero que lo tenga.
 */
export function shareSurvivors(groups, left) {
  const start = {};
  for (const g of groups) for (const [id, n] of Object.entries(g)) start[id] = (start[id] ?? 0) + n;
  const out = groups.map(() => ({}));
  for (const [id, total] of Object.entries(start)) {
    const frac = total ? (left[id] ?? 0) / total : 0;
    let given = 0;
    groups.forEach((g, i) => {
      const n = Math.floor((g[id] ?? 0) * frac);
      out[i][id] = n;
      given += n;
    });
    const owner = groups.findIndex((g) => (g[id] ?? 0) > 0);
    if (owner >= 0) out[owner][id] += (left[id] ?? 0) - given;
  }
  return out.map((o) => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0)));
}

/** Reparte una bolsa de recursos según unos pesos. */
export function splitBag(bagIn, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map(() => ({}));
  if (!total) return out;
  for (const [res, n] of Object.entries(bagIn ?? {})) {
    let given = 0;
    weights.forEach((w, i) => {
      const k = Math.floor((n * w) / total);
      if (k) out[i][res] = k;
      given += k;
    });
    const first = weights.findIndex((w) => w > 0);
    if (n - given > 0) out[first][res] = (out[first][res] ?? 0) + n - given;
  }
  return out;
}
