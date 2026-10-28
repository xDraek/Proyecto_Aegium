import { clock } from '../config.js';
import { FAVOR_ICON, FOUNDER_ICON, RELICS, RESOURCES, SPY_TIERS, UNITS } from '../game/data.js';
import { fmtEs } from '../game/num.js';

const nf1 = { format: (n) => fmtEs(n, 1) };

export function fmtNum(n) {
  return fmtEs(Math.floor(n));
}

/** Cifra corta para sitios estrechos: 9.870, 48,7k, 1,2M. */
export function fmtShort(n) {
  const a = Math.abs(n);
  if (a < 10_000) return fmtNum(n);
  if (a < 1_000_000) return `${nf1.format(Math.floor(n / 100) / 10)}k`;
  return `${nf1.format(Math.floor(n / 100_000) / 10)}M`;
}

/**
 * Lo que tienes de un recurso en la barra de arriba: entero hasta el millón y, de ahí en adelante,
 * en millones con hasta dos decimales (1,25M, 50M), para que quepa siempre (la cifra exacta, al pasar el ratón).
 */
export function fmtAmount(n) {
  if (Math.abs(n) < 1_000_000) return fmtNum(n);
  return `${fmtEs(Math.floor(n / 10_000) / 100, 2)}M`;
}

/** Cifra muy corta (para la producción por hora en el móvil): 982, 3,5k, 12k, 1,2M. */
export function fmtTiny(n) {
  const a = Math.abs(n);
  if (a < 1000) return fmtNum(n);
  if (a < 10_000) return `${nf1.format(Math.floor(n / 100) / 10)}k`;
  if (a < 1_000_000) return `${fmtNum(Math.floor(n / 1000))}k`;
  return `${nf1.format(Math.floor(n / 100_000) / 10)}M`;
}

export function fmtDec(n) {
  return nf1.format(n);
}

/** Lo que se gana o gasta por hora: con un decimal si es poco, y nunca «0» si algo hay (0,04 → 0,1). */
export function fmtRate(n) {
  const a = Math.abs(n);
  if (!a || a >= 10) return fmtNum(a);
  return nf1.format(Math.max(0.1, Math.ceil(a * 10) / 10));
}

export function fmtTime(seconds) {
  if (!Number.isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.ceil(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function fmtAgo(ms) {
  const s = Math.max(0, (clock.now() - ms) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

/** Elementos <li> de una lista de costes, marcando lo que falta. */
export function costItems(cost, have, mult = 1) {
  return Object.entries(cost)
    .map(([res, n]) => {
      const need = n * mult;
      const ok = have[res] >= need;
      return `<li class="${ok ? 'ok' : 'missing'}" title="${RESOURCES[res].name}">${RESOURCES[res].icon} ${fmtNum(need)}</li>`;
    })
    .join('');
}

/** Lista de costes que se refresca sola (ver Hud#refreshLive). */
export function costList(cost, have, countInput = '') {
  const attrs = `data-cost='${JSON.stringify(cost)}'${countInput ? ` data-count="${countInput}"` : ''}`;
  return `<ul class="costs" ${attrs}>${costItems(cost, have)}</ul>`;
}

/** Recursos en línea: "🪵 100 🪨 50". */
export function bag(b) {
  const parts = Object.entries(b ?? {})
    .filter(([, n]) => n > 0)
    .map(([res, n]) => `<span class="bag-item" title="${RESOURCES[res].name}">${RESOURCES[res].icon} ${fmtNum(n)}</span>`);
  return parts.join(' ') || '<span class="muted">nada</span>';
}

const IMAGE_ICONS = [...Object.values(UNITS), ...Object.values(RELICS)].filter((u) => u.img);

/** Los iconos que son imágenes, en un texto ya escapado: el emoji de cada tropa o reliquia con `img` (🪖, 👝, ⛑️…), por su imagen. */
export function glyphs(html) {
  let s = String(html);
  for (const u of IMAGE_ICONS) s = s.replaceAll(u.emoji, u.icon);
  return s;
}

/** Unidades en línea: "🪖 12 · 🏹 8". */
export function unitList(units) {
  const parts = Object.entries(units ?? {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `<span class="bag-item" title="${UNITS[id].name}">${UNITS[id].icon} ${fmtNum(n)}</span>`);
  return parts.join(' ') || '<span class="muted">ninguna</span>';
}

/**
 * Lo que vieron los espías en una ciudad, y lo que se les quedó sin ver por mandar pocos botes.
 * Los informes de exploración de islas (y los de espionaje de antes) no tienen `level`: solo
 * guarnición y botín.
 */
export function intelRows(intel) {
  const row = (label, value) => `<div class="info-row"><span>${label}</span><span>${value}</span></div>`;
  if (intel.level == null) {
    const out = [row('Guarnición vista', unitList(intel.garrison))];
    if (Object.keys(intel.stock ?? {}).length) out.push(row('Botín acumulado', bag(intel.stock)));
    if (intel.wall != null) out.push(row('🏰 Muralla', `Nivel ${intel.wall}`));
    return out.join('');
  }
  const unseen = (level) => `<span class="muted small">sin ver: hacen falta ${SPY_TIERS[level - 1].boats} botes</span>`;
  const out = [row('Recursos', bag(intel.stock)), row('🏰 Muralla · 🏛️ Ayuntamiento', `Nv ${intel.wall ?? 0} · Nv ${intel.town ?? 1}`)];
  out.push(row(`${UNITS.trirreme.icon} Barcos en el puerto`, intel.ships ? unitList(intel.ships) : unseen(2)));
  out.push(row('⚔️ Tropas de tierra', intel.troops ? unitList(intel.troops) : unseen(3)));
  const d = intel.defenses;
  out.push(
    d
      ? row('👁️ Torre de vigía · 🪔 Faro', `Nv ${d.torre} · Nv ${d.faro}`) + row('🔒 A salvo en el almacén', `${fmtNum(d.safe)} de cada recurso`)
      : row('Defensas', unseen(4)),
  );
  if (intel.support) {
    out.push(row('🛡️ Refuerzos aliados', intel.support.length ? intel.support.map((s) => `${escapeHtml(s.from)}: ${unitList(s.units)}`).join('<br />') : '<span class="muted">ninguno</span>'));
  } else {
    out.push(row('🛡️ Refuerzos aliados', unseen(5)));
  }
  const u = intel.upgrades;
  out.push(row('⚒️ Mejoras militares', u ? `Forja ${u.forja} · Herrería ${u.herreria} · Armaduras ${u.armaduras}` : unseen(5)));
  return out.join('');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Los emojis de los recursos y del favor, por sus imágenes (🔩 es el del bronce de cuando era hierro)
const RES_ICONS = new Map([...Object.values(RESOURCES).map((r) => [r.emoji, r.icon]), ['🔩', RESOURCES.hierro.icon], ['🙏', FAVOR_ICON], ['🌅', FOUNDER_ICON]]);
const RES_EMOJI = new RegExp([...RES_ICONS.keys()].join('|'), 'gu');

/** En un HTML: los emojis de los recursos y del favor (🪵, 🥖, 🪙, 🙏…) por sus imágenes. */
export function resIcons(html) {
  return String(html).replace(RES_EMOJI, (e) => RES_ICONS.get(e));
}

/**
 * Texto del juego (informes, avisos, mensajes del sistema) escapado y con las imágenes de los
 * recursos y del favor en lugar de sus emojis: los textos los guardan así porque viajan como texto.
 */
export function richText(s) {
  return linkCoords(glyphs(resIcons(escapeHtml(s))));
}

/** Las coordenadas «[47:52]» de un texto ya escapado, como enlaces al mapa del mundo. */
export function linkCoords(html) {
  return html.replace(/\[(-?\d{1,3}):(-?\d{1,3})\]/g, (m, x, y) => `<button class="link coords" data-coords="${x}:${y}" title="Ver en el mapa del mundo">${m}</button>`);
}
