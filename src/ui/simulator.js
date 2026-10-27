import { UNITS, UNIT_KEYS } from '../game/data.js';
import { assault, seatsOf, seatsUsed, siegeOf, splitForces } from '../game/combat.js';
import { unitIcon } from '../scene/portraits.js';
import { fmtDec, fmtNum } from './format.js';

// Simulador de combate, como el de OGame: repite la batalla muchas veces con
// las mismas reglas que el servidor y enseña qué suele pasar. Como los ataques
// de verdad, va en dos fases: primero las flotas y, con el mar libre, el desembarco.

const RUNS = 200;
const ATTACKERS = UNIT_KEYS.filter((id) => !UNITS[id].npc);
const DEFENDERS = UNIT_KEYS;

function inputs(prefix, ids, values) {
  return ids
    .map((id) => {
      const u = UNITS[id];
      return `<label title="${u.name}"><span class="u-cell">${unitIcon(id)} ${u.name}</span><input type="number" min="0" name="${prefix}-${id}" value="${values[id] ?? ''}" placeholder="0" inputmode="numeric" /></label>`;
    })
    .join('');
}

/**
 * `landing`: si hace falta desembarcar para ganar (contra una ciudad); sin él, se deduce del defensor.
 * @param {{ attacker?: object, defender?: object, wall?: number, atkMul?: number, hpMul?: number, defAtkMul?: number, defHpMul?: number, towers?: number, naval?: number, landing?: boolean, title?: string, note?: string }} preset
 */
export function simulatorHtml(preset = {}) {
  return `<div class="modal-card wide">
    <div class="panel-head"><span class="panel-icon">🎲</span><div><h3>Simulador de combate</h3>
      <div class="panel-lvl">${preset.title ?? 'Prueba un ataque antes de mandarlo'}</div></div>
      <button class="icon-btn" data-action="close-modal" title="Cerrar">✕</button></div>
    <form class="sim" data-form="sim"${preset.landing === undefined ? '' : ` data-landing="${preset.landing ? 1 : 0}"`}>
      <fieldset><legend>Atacante</legend>${inputs('a', ATTACKERS, preset.attacker ?? {})}
        <label><span>⚔️ Bono de ataque %</span><input type="number" name="a-atk" value="${Math.round(((preset.atkMul ?? 1) - 1) * 100)}" /></label>
        <label><span>❤️ Bono de vida %</span><input type="number" name="a-hp" value="${Math.round(((preset.hpMul ?? 1) - 1) * 100)}" /></label>
      </fieldset>
      <fieldset><legend>Defensor</legend>${inputs('d', DEFENDERS, preset.defender ?? {})}
        <label><span>⚔️ Bono de ataque %</span><input type="number" name="d-atk" value="${Math.round(((preset.defAtkMul ?? 1) - 1) * 100)}" /></label>
        <label><span>❤️ Bono de vida % (y coraza)</span><input type="number" name="d-hp" value="${Math.round(((preset.defHpMul ?? 1) - 1) * 100)}" /></label>
        <label><span>🏰 Muralla / fortificación % (en tierra; las catapultas la rebajan)</span><input type="number" name="d-wall" value="${Math.round((preset.wall ?? 0) * 100)}" /></label>
        <label><span>🏹 Daño de las torres (en tierra)</span><input type="number" name="d-towers" value="${preset.towers ?? 0}" /></label>
        <label><span>🪔 Faro: vida de sus barcos %</span><input type="number" name="d-naval" value="${Math.round((preset.naval ?? 0) * 100)}" /></label>
      </fieldset>
      ${preset.note ? `<p class="hint small">${preset.note}</p>` : ''}
      <button class="primary">Simular ${RUNS} combates</button>
    </form>
    <div class="sim-result" data-sim-result></div>
  </div>`;
}

/**
 * Porcentajes de unos recuentos que suman siempre 100 (al redondear por separado, 98,5 y 1,5
 * daban 99 % y 2 %): se reparten los puntos que faltan a los que más decimales perdieron.
 * Lo que pasó alguna vez pero no llega al 1 % se enseña como «<1 %», y nunca sale 100 % si hubo de lo otro
 * (va en HTML, así que los signos van escapados).
 */
export function shares(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => '0 %');
  const exact = counts.map((n) => (n / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) out[i]++;
  return out.map((p, i) => {
    if (counts[i] > 0 && p === 0) return '&lt;1 %';
    if (p === 100 && counts[i] < total) return '&gt;99 %';
    return `${p} %`;
  });
}

/** Lee el formulario, simula y pinta el resultado. */
export function runSimulation(form) {
  const data = Object.fromEntries(new FormData(form));
  const pick = (prefix, ids) => {
    const out = {};
    for (const id of ids) {
      const n = Math.floor(Number(data[`${prefix}-${id}`]) || 0);
      if (n > 0) out[id] = n;
    }
    return out;
  };
  const attacker = pick('a', ATTACKERS);
  const defender = pick('d', DEFENDERS);
  const out = form.closest('.modal-card').querySelector('[data-sim-result]');
  if (!Object.keys(attacker).length) {
    out.innerHTML = '<p class="hint warn">Pon alguna tropa en el atacante.</p>';
    return;
  }
  // Como al zarpar: las tropas tienen que caber en los barcos
  const { sea, land } = splitForces(attacker);
  if (seatsUsed(land) > seatsOf(sea)) {
    out.innerHTML = `<p class="hint warn">Faltan plazas en los barcos: ${seatsUsed(land)}/${seatsOf(sea)}. Añade mercantes o barcos de guerra.</p>`;
    return;
  }
  const att = { units: attacker, atkMul: 1 + (Number(data['a-atk']) || 0) / 100, hpMul: 1 + (Number(data['a-hp']) || 0) / 100 };
  const def = {
    units: defender,
    atkMul: Math.max(0.01, 1 + (Number(data['d-atk']) || 0) / 100),
    hpMul: Math.max(0.01, 1 + (Number(data['d-hp']) || 0) / 100),
    // Como en el combate de verdad, cada catapulta resta su parte a la fortificación
    wallHp: Math.max(0, (Number(data['d-wall']) || 0) / 100 - siegeOf(attacker)),
    extraAtk: Number(data['d-towers']) || 0,
    navalHpMul: (Number(data['d-naval']) || 0) / 100,
  };
  // Contra una ciudad hace falta desembarcar para ganar
  const city = form.dataset.landing !== undefined ? form.dataset.landing === '1' : !Object.keys(defender).some((id) => UNITS[id].npc);

  const wins = { att: 0, def: 0, draw: 0 };
  const lostA = {};
  const lostD = {};
  let rounds = 0;
  let seaWins = 0;
  let naval = 0;
  let drowned = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = assault(att, def, { needLanding: city });
    wins[r.winner]++;
    rounds += r.rounds;
    if (r.naval) naval++;
    if (r.seaWon) seaWins++;
    drowned += Object.values(r.drowned).reduce((a, b) => a + b, 0);
    for (const [id, n] of Object.entries(r.att.lost)) lostA[id] = (lostA[id] ?? 0) + n;
    for (const [id, n] of Object.entries(r.def.lost)) lostD[id] = (lostD[id] ?? 0) + n;
  }
  const odds = shares([wins.att, wins.draw, wins.def]);
  const table = (start, lost) =>
    Object.entries(start)
      .map(([id, n]) => {
        const avg = (lost[id] ?? 0) / RUNS;
        const shown = !avg ? '0' : avg < 0.05 ? '−&lt;0,1' : `−${fmtDec(avg)}`;
        return `<tr><td class="u-cell">${unitIcon(id)} ${UNITS[id].name}</td><td>${fmtNum(n)}</td><td class="${avg ? 'bad' : 'muted'}">${shown}</td></tr>`;
      })
      .join('') || '<tr><td colspan="3" class="muted">Nadie</td></tr>';
  out.innerHTML = `
    <div class="sim-odds">
      <div class="win"><b>${odds[0]}</b><span>gana el atacante</span></div>
      <div><b>${odds[1]}</b><span>retirada</span></div>
      <div class="lose"><b>${odds[2]}</b><span>gana el defensor</span></div>
    </div>
    <p class="muted small">${naval ? `⚓ El atacante se hace con el mar en el ${shares([seaWins, naval - seaWins])[0]} de las batallas navales.` : '⚓ No hay batalla naval: el defensor no tiene barcos de guerra.'}${drowned ? ` 🌊 De media se ahogan ${fmtDec(drowned / RUNS)} soldados al hundirse sus barcos.` : ''}</p>
    <p class="muted small">De media, ${fmtDec(rounds / RUNS)} asaltos en total. Bajas medias:</p>
    <div class="battle">
      <div class="side"><h5>Atacante</h5><table><thead><tr><th></th><th>Tropas</th><th>Bajas</th></tr></thead><tbody>${table(attacker, lostA)}</tbody></table></div>
      <div class="side"><h5>Defensor</h5><table><thead><tr><th></th><th>Tropas</th><th>Bajas</th></tr></thead><tbody>${table(defender, lostD)}</tbody></table></div>
    </div>`;
}
