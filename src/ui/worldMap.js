import { ISLAND_TYPES, MISSION_TYPES, PVP_RANGE, UNITS } from '../game/data.js';
import { travelSeconds } from '../game/rules.js';
import { clock, universe } from '../config.js';
import { COORD_CELL, coordsCenter, coordsOf, distance, fmtCoords, wrapDelta, wrapVectors } from '../game/world.js';
import { escapeHtml, fmtNum, fmtTime, unitList } from './format.js';

// Mapa de todo el archipiélago: las ciudades de todos los jugadores y las
// islas de cada sector, en un lienzo que se arrastra y se acerca con la rueda.

const REL = {
  yo: { color: '#f2c94c', name: 'Tu ciudad' },
  aliado: { color: '#8fd18a', name: 'Tu alianza' },
  pacto: { color: '#6fb6ff', name: 'Pacto' },
  guerra: { color: '#ff6b5b', name: 'En guerra' },
  otro: { color: '#efe6d2', name: 'Otros imperios' },
};

const ISLAND_COLOR = {
  barbaros: '#b8834f',
  piratas: '#8a8f96',
  ruinas: '#d6c08a',
  libre: '#6dbb63',
  kraken: '#a46ad1',
  brumas: '#b9cbd6',
  ciudadela: '#d0663e',
};

// Las capas que se pueden ocultar desde la leyenda (se recuerdan en este navegador)
const LAYERS_KEY = 'aegium.wmHidden';
const LAYERS = [
  ['aliado', REL.aliado.name],
  ['pacto', REL.pacto.name],
  ['guerra', REL.guerra.name],
  ['otro', REL.otro.name],
  ['islas', '🏝️ Islas'],
  ['flotas', '⛵ Flotas'],
  ['nombres', '🏷️ Nombres'],
];

/** Un número entre 0 y 1 que siempre sale igual para la misma semilla. */
function noise(seed, i) {
  let h = Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** El contorno de una isla: un borrón redondeado, siempre el mismo para la misma posición. */
function blob(ctx, x, y, r, seed, n = 8) {
  const turn = noise(seed, 99) * Math.PI;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + turn;
    const k = 0.74 + 0.4 * noise(seed, i);
    pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]);
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  ctx.beginPath();
  ctx.moveTo(...mid(pts[n - 1], pts[0]));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], ...mid(pts[i], pts[(i + 1) % n]));
  ctx.closePath();
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Las misiones que van a por alguien: su ruta se pinta en rojo
const HOSTILE = new Set(['atacar', 'invadir', 'bloquear', 'sabotaje', 'conquistar']);

const head = (icon, title, sub) => `
  <div class="panel-head"><span class="panel-icon">${icon}</span><div><h3>${title}</h3><div class="panel-lvl">${sub}</div></div>
  <button class="icon-btn" data-action="close-modal" title="Cerrar">✕</button></div>`;

/** «· ⛓️ bloqueada por X» o «· 🦅 ocupada por X» (texto plano). */
function portText(c) {
  if (!c.port) return '';
  return c.port.kind === 'invadir' ? ` · 🦅 ocupada por ${c.port.name}` : ` · ⛓️ bloqueada por ${c.port.name}`;
}

/** «🌋 Tifón en X · lucha · 3/5 juramentos» (texto plano). */
function featText(f) {
  return `${f.icon} ${f.enemy} en ${f.name} · ${f.stage === 'presagio' ? 'presagios' : 'en lucha'} · ${f.pledged}/${f.convoked} han jurado${f.me ? ' · estás convocado' : ''}`;
}

export class WorldMap {
  constructor(hud) {
    this.hud = hud;
    this.game = hud.game;
    this.data = null;
    this.selected = null;
  }

  /** `focus`: el id de una ciudad o gesta, o { coords: [x, y] } para ir a esa casilla. */
  async open(focus = null) {
    this.hud.showModal('worldmap', `<div class="modal-card wide"><p class="muted">Desplegando las cartas náuticas…</p></div>`);
    let data;
    try {
      data = await this.game.fetchMap();
    } catch (err) {
      if (this.hud.modalKind === 'worldmap') this.hud.showModal('worldmap', `<div class="modal-card wide"><p class="muted">${escapeHtml(err.message)}</p></div>`);
      return;
    }
    if (this.hud.modalKind !== 'worldmap') return;
    this.data = data;
    this.#mount(focus);
  }

  #relation(uid, aid) {
    if (uid === this.game.userId) return 'yo';
    return (aid != null && this.data.relations[aid]) || 'otro';
  }

  #mount(focus) {
    const focusId = typeof focus === 'string' ? focus : null;
    const { cities, islands } = this.data;
    this.byUid = new Map(cities.map((c) => [c.uid, c]));
    this.home = this.byUid.get(this.game.userId) ?? cities[0] ?? { x: 0, z: 0 };
    const wars = cities.filter((c) => this.#relation(c.uid, c.aid) === 'guerra').length;
    try {
      this.hidden = new Set(JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '[]'));
    } catch {
      this.hidden = new Set();
    }
    const chips = LAYERS.map(([key, name]) => {
      const dot = REL[key] ? `<i style="background:${REL[key].color}"></i>` : '';
      return `<button type="button" class="wm-chip" data-layer="${key}" aria-pressed="${!this.hidden.has(key)}">${dot}${name}</button>`;
    }).join('');
    // Con Cartas náuticas tus flotas llegan a cualquier ciudad: no hay círculo que marque el límite
    this.charts = this.game.researchLevel('cartas') >= 1;
    const reach = this.charts
      ? '<span class="wm-charts">🧭 Tienes las <b>Cartas náuticas</b>: tus flotas llegan a cualquier ciudad</span>'
      : `<span><i class="ring"></i>Hasta donde llegan tus flotas de guerra (${PVP_RANGE} leguas; más lejos, con Cartas náuticas)</span>`;
    const names = cities.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.city)}</option>`).join('');
    this.hud.showModal(
      'worldmap',
      `<div class="modal-card wide worldmap">
        ${head('🌍', 'Mapa del mundo', `${fmtNum(cities.length)} imperios · ${fmtNum(islands.length)} islas${wars ? ` · ⚔️ ${wars} ciudades enemigas` : ''}`)}
        <div class="wm-tools">
          <form class="inline-form wm-search"><input name="q" list="wm-names" placeholder="Buscar jugador o ciudad…" autocomplete="off" /><datalist id="wm-names">${names}</datalist><button class="ghost small">Buscar</button></form>
          <form class="inline-form wm-coords" title="Ir a unas coordenadas">[<input name="x" type="number" inputmode="numeric" placeholder="x" aria-label="Coordenada x" />:<input name="y" type="number" inputmode="numeric" placeholder="y" aria-label="Coordenada y" />]<button class="ghost small">Ir</button></form>
          <button class="ghost small" data-wm="home" title="Volver a tu ciudad">⚜ Mi ciudad</button>
          <button class="ghost small" data-wm="in" title="Acercar">＋</button>
          <button class="ghost small" data-wm="out" title="Alejar">－</button>
        </div>
        <div class="wm-wrap"><canvas></canvas><div class="wm-tip" hidden></div><div class="wm-pos"></div></div>
        <div class="wm-layers" title="Pulsa para mostrar u ocultar"><span class="wm-chip me"><i style="background:${REL.yo.color}"></i>${REL.yo.name}</span>${chips}</div>
        <details class="wm-legend"><summary>Leyenda</summary><div>
          <span><i style="background:#5f9a4a"></i>Continente</span>${this.data.feats?.length ? '<span>🌋 Gesta en marcha</span>' : ''}<span><i style="background:${ISLAND_COLOR.ciudadela}"></i>Ciudad bárbara</span><span><i style="background:${ISLAND_COLOR.kraken}"></i>Guarida del Kraken</span><span><i style="background:${ISLAND_COLOR.ruinas}"></i>Ruinas</span>
          <span><i class="line"></i>Tus flotas en el mar</span><span><i class="line enemy"></i>Flotas enemigas hacia ti</span>
          ${reach}<span>🏖️ De vacaciones</span><span>💤 Inactivo</span><span>⛓️ Puerto bloqueado</span><span>🦅 Ocupada</span><span><i class="ring novice"></i>Protección de novato</span>
        </div></details>
        <div class="wm-info"><p class="muted small">Arrastra para girar el globo, usa la rueda para acercarte y pulsa una ciudad para ver quién vive en ella.</p></div>
      </div>`,
    );
    const root = this.hud.modal.querySelector('.worldmap');
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tip = root.querySelector('.wm-tip');
    this.info = root.querySelector('.wm-info');
    this.pos = root.querySelector('.wm-pos');
    this.cx = this.home.x;
    this.cz = this.home.z;
    this.scale = 0;
    this.selected = null;
    this.mark = null;
    this.pos.textContent = fmtCoords(coordsOf(this.home.x, this.home.z));

    root.querySelector('.wm-search').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#search(new FormData(e.target).get('q'));
    });
    root.querySelector('.wm-coords').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const form = new FormData(e.target);
      const [x, y] = [form.get('x'), form.get('y')].map((v) => Math.round(Number(v)));
      if (String(form.get('x')).trim() === '' || String(form.get('y')).trim() === '' || !Number.isFinite(x) || !Number.isFinite(y)) return this.hud.toast('Escribe las dos coordenadas, por ejemplo 47 y 52.', 'error');
      this.#goCoords([x, y]);
    });
    root.querySelector('.wm-tools').addEventListener('click', (e) => {
      const b = e.target.closest('[data-wm]');
      if (!b) return;
      if (b.dataset.wm === 'home') this.#focus(this.home, true);
      // Si aún está acercándose, cuenta desde adonde iba (para que dos clics seguidos acerquen el doble)
      else this.#flyTo(this.cx, this.cz, this.#clampScale((this.flying?.scale ?? this.scale) * (b.dataset.wm === 'in' ? 1.6 : 1 / 1.6)));
    });
    root.querySelector('.wm-layers').addEventListener('click', (e) => {
      const b = e.target.closest('[data-layer]');
      if (!b) return;
      const key = b.dataset.layer;
      if (this.hidden.has(key)) this.hidden.delete(key);
      else this.hidden.add(key);
      b.setAttribute('aria-pressed', String(!this.hidden.has(key)));
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify([...this.hidden]));
      } catch {
        // Sin almacenamiento: vale para esta vez
      }
      if (this.selected && !this.#shown(this.selected)) this.#select(null);
      this.#draw();
    });
    this.#bindPointer();
    const ro = new ResizeObserver(() => {
      if (!this.canvas.isConnected) return ro.disconnect();
      this.#resize();
    });
    ro.observe(this.canvas.parentElement);
    this.#resize();
    const target = focusId && (cities.find((c) => c.id === focusId) ?? this.data.feats?.find((f) => f.site === focusId));
    if (target) this.#focus(target, true);
    else if (focus?.coords) this.#goCoords(focus.coords);
    this.#pulse();
  }

  /** Mientras está abierto, las gestas laten y las flotas avanzan. */
  #pulse() {
    if (!this.canvas?.isConnected || this.hud.modalKind !== 'worldmap') return;
    if (!this.flying && (this.data.feats?.length || this.#fleets().length)) this.#draw();
    setTimeout(() => requestAnimationFrame(() => this.#pulse()), 150);
  }

  /** Lleva la vista poco a poco hasta (x, z) con la escala `scale`. */
  #flyTo(x, z, scale = this.scale) {
    // (por el camino corto: el mundo da la vuelta)
    const d = wrapDelta(x - this.cx, z - this.cz);
    x = this.cx + d.dx;
    z = this.cz + d.dz;
    const from = { cx: this.cx, cz: this.cz, scale: this.scale };
    const t0 = performance.now();
    const fly = (this.flying = { scale });
    const step = (t) => {
      if (this.flying !== fly || !this.canvas?.isConnected) return;
      const k = Math.min(1, (t - t0) / 450);
      const e = 1 - (1 - k) ** 3;
      this.scale = from.scale * (scale / from.scale) ** e;
      this.cx = from.cx + (x - from.cx) * e;
      this.cz = from.cz + (z - from.cz) * e;
      this.#draw();
      if (k < 1) requestAnimationFrame(step);
      else this.flying = null;
    };
    requestAnimationFrame(step);
  }

  /** Si lo seleccionado sigue a la vista con las capas de ahora. */
  #shown(hit) {
    if (hit.kind === 'city') return hit.item.uid === this.game.userId || !this.hidden.has(this.#relation(hit.item.uid, hit.item.aid));
    if (hit.kind === 'island') return !this.hidden.has('islas');
    if (hit.kind === 'fleet') return !this.hidden.has('flotas');
    return true;
  }

  /**
   * Tus flotas en el mar y las enemigas que vienen hacia ti, con dónde están ahora:
   * `a` es de donde salen, `b` adonde van y `at` por dónde van.
   */
  #fleets(now = clock.now()) {
    if (this.hidden?.has('flotas')) return [];
    const where = (id) => {
      const i = this.game.world.island(id) ?? this.data.cities.find((c) => c.id === id);
      return i ? [i.x, i.z] : null;
    };
    const home = [this.home.x, this.home.z];
    // (cruzando la costura si es más corto: el mapa da la vuelta)
    const lerp = (a, b, k) => {
      const d = wrapDelta(b[0] - a[0], b[1] - a[1]);
      return [a[0] + d.dx * k, a[1] + d.dz * k];
    };
    const out = [];
    for (const m of this.game.missions ?? []) {
      const a = m.from ? where(m.from) : home;
      const b = where(m.target);
      if (!a || !b) continue;
      let k = 1;
      let until = null;
      if (m.phase === 'vuelta') {
        const t0 = m.turn ?? m.arrive;
        k = 1 - clamp01((now - t0) / Math.max(1, m.back - t0));
        until = m.back;
      } else if (m.phase !== 'estacionada') {
        k = clamp01((now - m.depart) / Math.max(1, m.arrive - m.depart));
        until = m.arrive;
      }
      out.push({ m, a, b, at: lerp(a, b, k), until, mine: true, back: m.phase === 'vuelta', parked: m.phase === 'estacionada' });
    }
    const colonies = (this.game.state.colonies ?? []).map((c) => this.game.world.island(c.id)).filter(Boolean);
    for (const m of this.game.incoming ?? []) {
      if (m.x == null) continue;
      const target = m.colony ? colonies.find((i) => i.name === m.colony) : null;
      const b = target ? [target.x, target.z] : home;
      const a = [m.x, m.z];
      out.push({ m, a, b, at: lerp(a, b, clamp01((now - m.depart) / Math.max(1, m.arrive - m.depart))), until: m.arrive, mine: false });
    }
    return out;
  }

  /** Dónde se pinta el barco de una flota (las que están quietas, junto a la ciudad). */
  #fleetSpot(f) {
    const [x, y] = this.#spot(...f.at);
    return f.parked ? [x - 14, y + 14] : [x, y];
  }

  #fleetText(f) {
    const { m } = f;
    const icon = MISSION_TYPES[m.type]?.icon ?? '⛵';
    const name = MISSION_TYPES[m.type]?.name ?? m.type;
    const left = f.until ? ` · ${f.back ? 'vuelve' : 'llega'} en ${fmtTime(Math.max(0, (f.until - clock.now()) / 1000))}` : '';
    if (!f.mine) return `⚠️ ${icon} ${name} de ${m.from}${m.colony ? ` contra ${m.colony}` : ''}${left}`;
    const dest = m.targetName ?? '';
    if (f.parked) return `${icon} ${name} en ${dest}`;
    if (f.back) return `⚓ Vuelve de ${dest}${left}`;
    return `${icon} ${name} · ${dest}${left}`;
  }

  #resize() {
    const wrap = this.canvas.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = wrap.clientWidth;
    this.h = wrap.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.scale) this.scale = Math.min(this.w, this.h) / 1500;
    this.scale = this.#clampScale(this.scale);
    this.#draw();
  }

  // ── Coordenadas ─────────────────────────────────────────────────────────────

  // El mapa del mundo es una bola: lo que miras, en el centro y a su tamaño; hacia el borde se curva
  // y encoge como en un globo, y lo que queda en la cara de atrás no se ve. Como el mundo da la vuelta,
  // cada cosa se pinta en su copia más cercana a lo que miras, y así nunca se ve dos veces.
  // (es una proyección para verlo: en el centro las distancias son las de verdad)

  /** El radio de la bola, en leguas: lo más lejos que puede estar algo es la otra cara (π radios). */
  get #globeR() {
    const R = universe.wrap ?? 0;
    if (!(R > 0)) return 3000;
    const [a, b] = wrapVectors(R);
    const len = (v) => Math.hypot(v.x, v.z);
    const far = Math.max(len(a), len(b), Math.hypot(a.x - b.x, a.z - b.z)) / Math.sqrt(3);
    return far / Math.PI;
  }

  /** Radio de la bola en la pantalla. */
  get #globePx() {
    return this.#globeR * this.scale;
  }

  /**
   * Proyecta una distancia desde el centro de la vista (en leguas) a la pantalla. Devuelve
   * [x, y] con `k`: lo de frente que está (1 en el centro, 0 en el borde), o [NaN, NaN] si queda detrás.
   */
  #project(dx, dz) {
    const R = this.#globeR;
    const dist = Math.hypot(dx, dz);
    const th = dist / R;
    if (th >= Math.PI / 2) return Object.assign([NaN, NaN], { k: 0 });
    const s = dist > 1e-6 ? (R * this.scale * Math.sin(th)) / dist : this.scale;
    return Object.assign([this.w / 2 + dx * s, this.h / 2 + dz * s], { k: Math.cos(th) });
  }

  /** Dónde se pinta en pantalla algo del mundo (en su copia más cercana a lo que miras). */
  #spot(x, z) {
    const d = wrapDelta(x - this.cx, z - this.cz);
    return this.#project(d.dx, d.dz);
  }

  /** El punto del mundo bajo (px, py), o null si es el espacio de fuera de la bola. */
  #toWorld(px, py) {
    const G = this.#globePx;
    const vx = (px - this.w / 2) / G;
    const vy = (py - this.h / 2) / G;
    const rho = Math.hypot(vx, vy);
    if (rho >= 1) return null;
    if (rho < 1e-9) return [this.cx, this.cz];
    const dist = Math.asin(rho) * this.#globeR;
    return [this.cx + (vx / rho) * dist, this.cz + (vy / rho) * dist];
  }

  /** De la bola entera (un poco más pequeña que la ventana) a muy de cerca. */
  #clampScale(s) {
    const min = (0.46 * Math.min(this.w || 600, this.h || 600)) / this.#globeR;
    return Math.min(1.2, Math.max(min, s));
  }

  #zoomAt(factor, px = this.w / 2, py = this.h / 2) {
    const at = this.#toWorld(px, py);
    const old = this.scale;
    this.scale = this.#clampScale(this.scale * factor);
    // Que el punto bajo el ratón se acerque al centro lo justo para seguir más o menos en su sitio
    if (at) {
      const k = 1 - old / this.scale;
      this.cx += (at[0] - this.cx) * k;
      this.cz += (at[1] - this.cz) * k;
    }
    this.#draw();
  }

  #focus(target, select = false) {
    if (select && target.uid != null) this.#select({ kind: 'city', item: target });
    else if (select && target.site) this.#select({ kind: 'feat', item: target });
    this.#flyTo(target.x, target.z, Math.max(this.scale, this.#clampScale(this.w / 1400)));
  }

  /** Centra el mapa en la casilla [x, y] y la marca. */
  #goCoords([x, y]) {
    this.mark = [x, y];
    const c = coordsCenter(x, y);
    const form = this.hud.modal.querySelector('.wm-coords');
    if (form) [form.x.value, form.y.value] = [x, y];
    this.pos.textContent = fmtCoords([x, y]);
    this.#flyTo(c.x, c.z, Math.max(this.scale, this.#clampScale(this.w / 900)));
  }

  #search(q) {
    q = String(q ?? '').trim().toLowerCase();
    if (!q) return;
    const list = this.data.cities;
    const hit =
      list.find((c) => c.name.toLowerCase() === q || c.city.toLowerCase() === q) ??
      list.find((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || (c.tag && c.tag.toLowerCase() === q.replace(/[[\]]/g, '')));
    if (hit) this.#focus(hit, true);
    else this.hud.toast('No hay ninguna ciudad con ese nombre.', 'error');
  }

  // ── Ratón y dedos ───────────────────────────────────────────────────────────

  #bindPointer() {
    const c = this.canvas;
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    c.addEventListener('pointerdown', (e) => {
      this.flying = null;
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale };
        drag = null;
      } else {
        drag = { x: e.offsetX, y: e.offsetY, cx: this.cx, cz: this.cz, moved: false };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.#zoomAt((pinch.scale * (d / pinch.d)) / this.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (drag) {
        const dx = e.offsetX - drag.x;
        const dy = e.offsetY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) {
          // (girar la bola: un radio de pantalla es un radio de bola)
          this.cx = drag.cx - dx / this.scale;
          this.cz = drag.cz - dy / this.scale;
          this.tip.hidden = true;
          this.#draw();
          return;
        }
      }
      this.#hover(e.offsetX, e.offsetY);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.moved && e.type === 'pointerup') {
        const hit = this.#hit(e.offsetX, e.offsetY);
        this.#select(hit);
        this.#draw();
      }
      drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => (this.tip.hidden = true));
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.flying = null;
        this.#zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.offsetX, e.offsetY);
      },
      { passive: false },
    );
  }

  /** Lo que hay bajo el puntero: una flota (se pinta encima), una ciudad, una gesta o una isla. */
  #hit(px, py) {
    for (const f of this.#fleets()) {
      const [x, y] = this.#fleetSpot(f);
      if (Math.hypot(x - px, y - py) < 11) return { kind: 'fleet', item: f };
    }
    let best = null;
    let bestD = 14;
    for (const city of this.data.cities) {
      if (!this.#shown({ kind: 'city', item: city })) continue;
      const [x, y] = this.#spot(city.x, city.z);
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        best = { kind: 'city', item: city };
        bestD = d;
      }
    }
    if (best) return best;
    for (const feat of this.data.feats ?? []) {
      const [x, y] = this.#spot(feat.x, feat.z);
      const d = Math.hypot(x - px, y - py);
      if (d < Math.max(14, feat.size * this.scale * 1.4)) return { kind: 'feat', item: feat };
    }
    if (this.hidden.has('islas')) return null;
    bestD = Math.max(8, 24 * this.scale);
    for (const isl of this.data.islands) {
      if (isl[2] === 'continente') continue;
      const [x, y] = this.#spot(isl[0], isl[1]);
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        best = { kind: 'island', item: isl };
        bestD = d;
      }
    }
    return best;
  }

  #hover(px, py) {
    const here = this.#toWorld(px, py);
    if (here) this.pos.textContent = fmtCoords(coordsOf(...here));
    const hit = this.#hit(px, py);
    this.canvas.style.cursor = hit ? 'pointer' : 'grab';
    if (!hit) {
      this.tip.hidden = true;
      return;
    }
    let text;
    if (hit.kind === 'city') {
      const c = hit.item;
      text = `${c.emblem ?? '🏰'} ${c.tag ? `[${c.tag}] ` : ''}${c.name} · ${c.city} · ${fmtNum(c.points)} pts${c.vacation ? ' · 🏖️' : c.inactive ? ' · 💤' : ''}${portText(c)}`;
    } else if (hit.kind === 'feat') {
      text = featText(hit.item);
    } else if (hit.kind === 'fleet') {
      text = this.#fleetText(hit.item);
    } else {
      const [, , type, colonist] = hit.item;
      const t = ISLAND_TYPES[type];
      const owner = colonist ? this.byUid.get(colonist) : null;
      text = owner ? `🚩 Colonia de ${owner.name}` : `${t?.icon ?? ''} ${t?.name ?? type}`;
    }
    const at = hit.kind === 'island' ? hit.item : [hit.item.x, hit.item.z];
    this.tip.textContent = hit.kind === 'fleet' ? text : `${text} · ${fmtCoords(coordsOf(at[0], at[1]))}`;
    this.tip.hidden = false;
    this.tip.style.left = `${Math.min(px + 14, this.w - this.tip.offsetWidth - 6)}px`;
    this.tip.style.top = `${py + 14}px`;
  }

  // ── Ficha de lo seleccionado ────────────────────────────────────────────────

  #select(hit) {
    this.selected = hit;
    if (!hit) {
      this.info.innerHTML = '<p class="muted small">Pulsa una ciudad para ver quién vive en ella.</p>';
      return;
    }
    if (hit.kind === 'fleet') {
      const { m } = hit.item;
      const units = m.units ? unitList(m.units) : 'Aún no se sabe qué trae: lo verá tu torre de vigía cuando se acerque';
      this.info.innerHTML = `<div class="wm-card"><div><b>${escapeHtml(this.#fleetText(hit.item))}</b><div class="small">${units}</div></div></div>`;
      return;
    }
    const pos = hit.kind === 'city' || hit.kind === 'feat' ? hit.item : { x: hit.item[0], z: hit.item[1] };
    const dist = Math.round(distance(pos, this.home));
    const trip = fmtTime(travelSeconds(this.game.state, dist, UNITS.trirreme.speed));
    const far = `<span class="muted small">${fmtCoords(coordsOf(pos.x, pos.z))} · a ${fmtNum(dist)} leguas · ⛵ ${trip} en trirreme</span>`;
    if (hit.kind === 'city') {
      const c = hit.item;
      const rel = this.#relation(c.uid, c.aid);
      const me = rel === 'yo';
      const visible = !!this.game.world.island(c.id);
      // Lejos de tu mapa: con Cartas náuticas (o si es de tu alianza) se trae a él para ir
      const reach = me || visible || this.game.researchLevel('cartas') >= 1 || rel === 'aliado';
      const go = visible
        ? `<button class="primary small" data-action="goto" data-island="${escapeHtml(c.id)}">${me ? '⚜ Ir a casa' : '⚓ Ir'}</button>`
        : reach
          ? `<button class="primary small" data-action="watch-city" data-island="${escapeHtml(c.id)}">⚓ Ir</button>`
          : `<span class="muted small">Sin Cartas náuticas tus barcos solo llegan a ${PVP_RANGE} leguas</span>`;
      this.info.innerHTML = `<div class="wm-card">
        <div><b>${c.emblem ?? '🏰'} ${escapeHtml(c.city)}</b> <span class="rel-chip" style="--rel:${REL[rel].color}">${REL[rel].name}</span>
          <div class="small">${me ? 'Tu capital' : `de <b>${escapeHtml(c.name)}</b>`}${c.tag ? ` <span class="tag">[${escapeHtml(c.tag)}]</span>` : ''} · ${fmtNum(c.points)} puntos${c.protected ? ' · 🛡️ novato' : ''}${c.vacation ? ' · 🏖️ de vacaciones' : c.inactive ? ' · 💤 inactivo' : ''}${escapeHtml(portText(c))}</div>
          ${me ? '' : far}</div>
        <div class="row-actions">
          ${me ? '' : `<button class="ghost small" data-action="profile" data-name="${escapeHtml(c.name)}">👤 Perfil</button><button class="ghost small" data-action="mail-to" data-name="${escapeHtml(c.name)}">✉️</button>`}
          ${go}
        </div></div>`;
    } else if (hit.kind === 'feat') {
      const f = hit.item;
      const visible = !!this.game.world.island(f.site);
      this.info.innerHTML = `<div class="wm-card">
        <div><b>${f.icon} ${escapeHtml(f.enemy)} en ${escapeHtml(f.name)}</b>
          <div class="small">${f.stage === 'presagio' ? 'Presagios: emerge pronto' : 'En plena lucha'} · ${f.pledged} de ${f.convoked} convocados han jurado${f.me ? ' · <b>estás convocado</b>' : ''}</div>
          ${far}</div>
        <div class="row-actions">${visible ? `<button class="primary small" data-action="goto" data-island="${escapeHtml(f.site)}">⚓ Ver la gesta</button>` : '<span class="muted small">Solo para los imperios convocados a ella</span>'}</div>
      </div>`;
    } else {
      const [, , type, colonist] = hit.item;
      const t = ISLAND_TYPES[type];
      const owner = colonist ? this.byUid.get(colonist) : null;
      this.info.innerHTML = `<div class="wm-card"><div><b>${t?.icon ?? ''} ${owner ? `Colonia de ${escapeHtml(owner.name)}` : (t?.name ?? type)}</b><div>${far}</div></div></div>`;
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────

  #draw() {
    if (!this.canvas?.isConnected || !this.w) return;
    const { ctx, w, h, scale } = this;
    const G = this.#globePx;
    const [gx, gy] = [w / 2, h / 2];
    // El espacio de alrededor, con unas estrellas que no se mueven
    ctx.fillStyle = '#070d16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 7919) % 1000) / 1000;
      const sy = ((i * 104729) % 997) / 997;
      ctx.globalAlpha = 0.15 + ((i * 31) % 10) / 20;
      ctx.fillRect(sx * w, sy * h, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
    // La atmósfera: un halo azul alrededor de la bola
    const halo = ctx.createRadialGradient(gx, gy, G * 0.96, gx, gy, G * 1.12);
    halo.addColorStop(0, 'rgba(120, 190, 255, 0.45)');
    halo.addColorStop(1, 'rgba(120, 190, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(gx, gy, G * 1.12, 0, Math.PI * 2);
    ctx.fill();
    // El mar de la bola, más claro hacia donde le da el sol (arriba a la izquierda)
    ctx.save();
    ctx.beginPath();
    ctx.arc(gx, gy, G, 0, Math.PI * 2);
    ctx.clip();
    const sea = ctx.createRadialGradient(gx - G * 0.35, gy - G * 0.4, G * 0.05, gx, gy, G);
    sea.addColorStop(0, '#2a77a3');
    sea.addColorStop(0.65, '#175079');
    sea.addColorStop(1, '#0b2c46');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, w, h);

    // Cuadrícula de coordenadas: casillas de COORD_CELL leguas (de cinco en cinco, o más, al alejarse),
    // curvada con la bola
    const cellPx = COORD_CELL * scale;
    const cells = cellPx >= 28 ? 1 : cellPx >= 6 ? 5 : cellPx >= 2.5 ? 10 : 20;
    const step = cells * COORD_CELL;
    const reach = this.#globeR * (Math.PI / 2) * 0.999;
    // (hasta donde se ve: el horizonte de la bola, o el borde de la ventana si está muy cerca)
    const corners = [[0, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => this.#toWorld(px, py));
    const span = corners.every(Boolean) ? Math.max(...corners.map(([x, z]) => Math.max(Math.abs(x - this.cx), Math.abs(z - this.cz)))) * 1.05 : reach;
    const lim = Math.min(span, reach);
    const [cx0, cy0] = coordsOf(this.cx - lim, this.cz - lim);
    const [cx1, cy1] = coordsOf(this.cx + lim, this.cz + lim);
    const line = (pts) => {
      let pen = false;
      for (const [x, z] of pts) {
        const dx = x - this.cx;
        const dz = z - this.cz;
        if (Math.hypot(dx, dz) >= reach) {
          pen = false;
          continue;
        }
        const [sx, sy] = this.#project(dx, dz);
        if (pen) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
        pen = true;
      }
    };
    const samples = 48;
    const labelsX = [];
    const labelsY = [];
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.floor(cx0 / cells) * cells; k <= cx1 + 1; k += cells) {
      const x = coordsCenter(k, 0).x - COORD_CELL / 2;
      line(Array.from({ length: samples + 1 }, (_, i) => [x, this.cz - lim + (2 * lim * i) / samples]));
      labelsX.push([k, x]);
    }
    for (let k = Math.floor(cy0 / cells) * cells; k <= cy1 + 1; k += cells) {
      const z = coordsCenter(0, k).z - COORD_CELL / 2;
      line(Array.from({ length: samples + 1 }, (_, i) => [this.cx - lim + (2 * lim * i) / samples, z]));
      labelsY.push([k, z]);
    }
    ctx.stroke();
    // Los números de las casillas, de cerca: arriba y a la izquierda (donde las líneas cortan la ventana)
    if (corners.every(Boolean)) {
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'left';
      const top = this.#toWorld(w / 2, 8);
      const left = this.#toWorld(8, h / 2);
      for (const [k, x] of labelsX) {
        const [sx] = this.#project(x - this.cx, top[1] - this.cz);
        if (sx > 18 && sx < w - 10) ctx.fillText(k, sx + 3, 11);
      }
      for (const [k, z] of labelsY) {
        const [, sy] = this.#project(left[0] - this.cx, z - this.cz);
        if (sy > 18 && sy < h - 40) ctx.fillText(k, 3, sy + 11);
      }
    }

    // La casilla buscada
    if (this.mark) {
      const c = coordsCenter(...this.mark);
      const d = wrapDelta(c.x - this.cx, c.z - this.cz);
      const half = COORD_CELL / 2;
      const pts = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([ox, oz]) => this.#project(d.dx + ox, d.dz + oz));
      if (pts.every((p) => Number.isFinite(p[0]))) {
        ctx.strokeStyle = 'rgba(242,201,76,0.9)';
        ctx.fillStyle = 'rgba(242,201,76,0.12)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Hasta donde llegan tus flotas de guerra (sin Cartas náuticas), curvado con la bola
    if (!this.charts) {
      const d = wrapDelta(this.home.x - this.cx, this.home.z - this.cz);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(242,201,76,0.45)';
      ctx.beginPath();
      line(Array.from({ length: 65 }, (_, i) => [this.cx + d.dx + PVP_RANGE * Math.cos((i / 64) * Math.PI * 2), this.cz + d.dz + PVP_RANGE * Math.sin((i / 64) * Math.PI * 2)]));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // En el móvil (donde cuesta más ubicarse), tu casilla de la cuadrícula resaltada con un halo dorado
    if (matchMedia('(pointer: coarse)').matches || w < 700) {
      const cell = coordsOf(this.home.x, this.home.z);
      const c = coordsCenter(...cell);
      const d = wrapDelta(c.x - this.cx, c.z - this.cz);
      // (de lejos la casilla es diminuta: como poco, un cuadrado de 18 px alrededor)
      const half = Math.max(COORD_CELL / 2, 9 / Math.max(scale, 1e-6));
      const pts = [];
      for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        for (let t = 0; t < 8; t++) pts.push([this.cx + d.dx + half * (ax + ((bx - ax) * t) / 8), this.cz + d.dz + half * (az + ((bz - az) * t) / 8)]);
      }
      pts.push(pts[0]);
      ctx.save();
      ctx.beginPath();
      line(pts);
      ctx.fillStyle = 'rgba(242, 201, 76, 0.12)';
      ctx.fill();
      ctx.shadowColor = 'rgba(242, 201, 76, 0.95)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      // (y sus coordenadas, debajo)
      const below = this.#project(d.dx, d.dz + half);
      if (Number.isFinite(below[1]) && below.k > 0.3) {
        const text = fmtCoords(cell);
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(8,20,30,0.85)';
        ctx.strokeText(text, below[0], below[1] + 14);
        ctx.fillStyle = '#f2c94c';
        ctx.fillText(text, below[0], below[1] + 14);
      }
    }

    const inView = (x, y, m = 40) => x > -m && y > -m && x < w + m && y < h + m;
    // Hacia el borde de la bola, las cosas encogen y se desvanecen
    const shrink = (k) => 0.4 + 0.6 * k;
    const fade = (k) => Math.min(1, k * 3.5);

    // Continentes (debajo de todo)
    for (const [x, z, type, , size] of this.data.islands) {
      if (type !== 'continente') continue;
      const p = this.#spot(x, z);
      const [sx, sy] = p;
      const cr = Math.max(4, size * scale) * shrink(p.k);
      if (!inView(sx, sy, cr + 20)) continue;
      ctx.globalAlpha = fade(p.k);
      const seed = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
      ctx.fillStyle = 'rgba(120, 200, 215, 0.12)';
      blob(ctx, sx, sy, cr * 1.4, seed, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 212, 154, 0.9)';
      blob(ctx, sx, sy, cr * 1.12, seed, 12);
      ctx.fill();
      ctx.fillStyle = '#5f9a4a';
      blob(ctx, sx, sy, cr * 0.95, seed, 12);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Gestas en marcha: anillos de lava que laten sobre su continente
    const beat = (Math.sin(performance.now() / 400) + 1) / 2;
    for (const f of this.data.feats ?? []) {
      const [sx, sy] = this.#spot(f.x, f.z);
      const fr = Math.max(8, f.size * scale);
      if (!inView(sx, sy, fr * 2 + 20)) continue;
      ctx.strokeStyle = f.stage === 'lucha' ? `rgba(255, 110, 40, ${0.55 + 0.4 * beat})` : `rgba(255, 190, 90, ${0.4 + 0.3 * beat})`;
      ctx.lineWidth = 3;
      ctx.setLineDash(f.stage === 'lucha' ? [] : [5, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, fr * (1.25 + 0.15 * beat), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Islas de los sectores: de cerca, con su costa, sus bajíos y su icono
    const r0 = Math.max(1.6, 24 * scale);
    const r = r0;
    const shapes = r >= 4;
    const icons = r >= 10;
    const islands = this.hidden.has('islas') ? [] : this.data.islands.filter(([x, z, type]) => type !== 'continente' && inView(...this.#spot(x, z)));
    if (shapes) {
      ctx.fillStyle = 'rgba(120, 200, 215, 0.12)';
      for (const [x, z, type] of islands) {
        if (type === 'brumas') continue;
        const p = this.#spot(x, z);
        ctx.beginPath();
        ctx.arc(p[0], p[1], r * 1.9 * shrink(p.k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const [x, z, type, colonist] of islands) {
      const p = this.#spot(x, z);
      const [sx, sy] = p;
      const r = r0 * shrink(p.k);
      ctx.globalAlpha = fade(p.k);
      if (type === 'brumas') {
        const mist = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.8);
        mist.addColorStop(0, 'rgba(205, 220, 230, 0.5)');
        mist.addColorStop(1, 'rgba(205, 220, 230, 0)');
        ctx.fillStyle = mist;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const color = ISLAND_COLOR[type] ?? '#888';
      if (shapes) {
        const seed = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
        ctx.fillStyle = '#e4d29c';
        blob(ctx, sx, sy, r * 1.15, seed);
        ctx.fill();
        ctx.fillStyle = color;
        blob(ctx, sx, sy, r * 0.92, seed);
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade(p.k);
      }
      if (colonist) {
        const owner = this.byUid.get(colonist);
        ctx.strokeStyle = REL[owner ? this.#relation(owner.uid, owner.aid) : 'otro'].color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r * (shapes ? 1.3 : 1) + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (icons) {
        ctx.font = `${Math.round(Math.min(22, r * 0.85))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(colonist ? '🚩' : (ISLAND_TYPES[type]?.icon ?? ''), sx, sy + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
    ctx.globalAlpha = 1;

    // Las rutas de las flotas: lo ya navegado, tenue; lo que falta, con rayas que avanzan
    const fleets = this.#fleets();
    const now = performance.now();
    ctx.lineWidth = 2;
    for (const f of fleets) {
      if (f.parked) continue;
      const color = f.mine ? (HOSTILE.has(f.m.type) ? '#ff9a8a' : f.m.type === 'tributo' ? '#ffd27a' : '#ffffff') : '#ff5a4a';
      // (la ruta, por el camino corto y curvada con la bola, alrededor de donde va el barco)
      const from = this.cx + wrapDelta(f.at[0] - this.cx, f.at[1] - this.cz).dx;
      const fromZ = this.cz + wrapDelta(f.at[0] - this.cx, f.at[1] - this.cz).dz;
      const toward = (p) => {
        const d = wrapDelta(p[0] - f.at[0], p[1] - f.at[1]);
        return [from + d.dx, fromZ + d.dz];
      };
      const seg = (p0, p1) => Array.from({ length: 25 }, (_, i) => [p0[0] + ((p1[0] - p0[0]) * i) / 24, p0[1] + ((p1[1] - p0[1]) * i) / 24]);
      const a = toward(f.a);
      const b = toward(f.b);
      const end = f.back ? a : b;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      line(seg(a, b));
      ctx.stroke();
      ctx.globalAlpha = f.mine ? 0.8 : 0.95;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -now / 50;
      ctx.beginPath();
      line(seg([from, fromZ], end));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;

    // Ciudades
    const cr0 = Math.max(3.5, 28 * scale);
    const labels = scale > 0.09;
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const c of this.data.cities) {
      const p = this.#spot(c.x, c.z);
      const [sx, sy] = p;
      if (!inView(sx, sy, 80)) continue;
      const rel = this.#relation(c.uid, c.aid);
      if (rel !== 'yo' && this.hidden.has(rel)) continue;
      const color = REL[rel].color;
      const selected = this.selected?.kind === 'city' && this.selected.item === c;
      const cr = cr0 * shrink(p.k);
      ctx.globalAlpha = (c.inactive || c.vacation ? 0.5 : 1) * fade(p.k);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = rel === 'otro' ? 0 : 10;
      ctx.beginPath();
      ctx.arc(sx, sy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // De cerca, el emblema de su estandarte
      if (cr >= 10) {
        ctx.font = `${Math.round(cr * 1.05)}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(c.emblem ?? '🏰', sx, sy + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
      }
      ctx.globalAlpha = 1;
      if (c.protected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, cr + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (selected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, cr + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Bloqueada u ocupada: su icono junto a la ciudad
      if (c.port) {
        const bx = sx + cr + 8;
        const by = sy - cr + 1;
        ctx.fillStyle = 'rgba(12, 18, 26, 0.9)';
        ctx.strokeStyle = c.port.kind === 'invadir' ? '#c98ae6' : '#9cc4ea';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = '11px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.port.kind === 'invadir' ? '🦅' : '⛓️', bx, by + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
      }
      if (((labels && !this.hidden.has('nombres')) || selected || rel === 'yo') && p.k > 0.25) {
        ctx.globalAlpha = fade(p.k);
        const text = `${c.tag ? `[${c.tag}] ` : ''}${c.name}${c.vacation ? ' 🏖️' : c.inactive ? ' 💤' : ''}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(8,20,30,0.85)';
        ctx.strokeText(text, sx, sy - cr - 6);
        ctx.fillStyle = rel === 'otro' ? '#f3ead8' : color;
        ctx.fillText(text, sx, sy - cr - 6);
      }
      ctx.globalAlpha = 1;
    }

    // El icono de cada gesta, encima de todo (junto al borde de su anillo)
    for (const f of this.data.feats ?? []) {
      const [sx, sy] = this.#spot(f.x, f.z);
      const fr = Math.max(8, f.size * scale);
      if (!inView(sx, sy, fr * 2 + 20)) continue;
      const by = sy - fr * 1.3;
      ctx.fillStyle = 'rgba(12, 18, 26, 0.9)';
      ctx.strokeStyle = f.stage === 'lucha' ? '#ff6e28' : '#ffbe5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, by, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.icon, sx, by + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // Los barcos, encima de todo: los enemigos que vienen hacia ti laten
    for (const f of fleets) {
      const [x, y] = this.#fleetSpot(f);
      if (!inView(x, y)) continue;
      const color = f.mine ? (HOSTILE.has(f.m.type) ? '#ff9a8a' : f.m.type === 'tributo' ? '#ffd27a' : '#e8eef4') : '#ff5a4a';
      const selected = this.selected?.kind === 'fleet' && this.selected.item.m.id === f.m.id;
      ctx.fillStyle = 'rgba(12, 18, 26, 0.92)';
      ctx.strokeStyle = selected ? '#fff' : color;
      ctx.lineWidth = selected ? 2.5 : 2;
      ctx.beginPath();
      ctx.arc(x, y, f.mine ? 9 : 9 + 2 * beat, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.back ? '⚓' : (MISSION_TYPES[f.m.type]?.icon ?? '⛵'), x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // La sombra de la bola: más oscura hacia el borde y hacia el lado contrario al sol
    const shade = ctx.createRadialGradient(gx - G * 0.3, gy - G * 0.35, G * 0.2, gx, gy, G);
    shade.addColorStop(0, 'rgba(255, 245, 220, 0.06)');
    shade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 8, 20, 0.55)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // El borde de la bola
    if (G < Math.hypot(w, h) / 2) {
      ctx.strokeStyle = 'rgba(170, 215, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx, gy, G, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rosa de los vientos
    ctx.save();
    ctx.translate(w - 30, 48);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = 'rgba(242, 201, 76, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === 0 ? '#f2c94c' : 'rgba(239, 230, 210, 0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillStyle = '#f2c94c';
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -20);
    ctx.restore();

    // Escala
    const bar = step * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(12, h - 18, bar, 3);
    ctx.textAlign = 'left';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(`${fmtNum(step)} leguas`, 12, h - 24);
  }
}
