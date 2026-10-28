// Generación del mundo compartido. El archipiélago crece por sectores: cada
// jugador nuevo recibe un sector con su isla en el centro y una docena de islas
// neutrales alrededor (bárbaros, ruinas, tierras libres, piratas, niebla…).
// Los sectores se colocan en espiral hexagonal, así los vecinos quedan cerca.
// Entre cada tres sectores puede surgir un pequeño continente con ciudades
// bárbaras y tierras que colonizar.

export const SECTOR_SPACING = 430;

// ── Coordenadas ─────────────────────────────────────────────────────────────
// Como en Ikariam: el mapa se divide en casillas de COORD_CELL leguas y cada una
// tiene sus coordenadas [x:y], con [50:50] en el centro del archipiélago (la y
// crece hacia el sur, como en el mapa del mundo).

export const COORD_CELL = 50;
const COORD_ORIGIN = 50;

/** Coordenadas [x, y] de la casilla donde cae el punto (x, z) del mundo. */
export function coordsOf(x, z) {
  return [Math.round(x / COORD_CELL) + COORD_ORIGIN, Math.round(z / COORD_CELL) + COORD_ORIGIN];
}

/** El centro de la casilla [cx, cy], en leguas. */
export function coordsCenter(cx, cy) {
  return { x: (cx - COORD_ORIGIN) * COORD_CELL, z: (cy - COORD_ORIGIN) * COORD_CELL };
}

/** «[47:52]» */
export function fmtCoords([cx, cy]) {
  return `[${cx}:${cy}]`;
}

const SPECIALTY_YIELD = { madera: 150, comida: 160, piedra: 130, hierro: 110, cristal: 90, oro: 70 };

/**
 * Ya no hay tierras que den oro (escasea a propósito). Las que lo daban, en mundos y partidas de
 * antes, pasan a dar cristal con una producción equivalente. Vale para islas y colonias.
 */
export const NO_GOLD = 'cristal';
export function withoutGold(x) {
  if (x?.specialty !== 'oro') return x;
  return { ...x, specialty: NO_GOLD, yield: Math.round((x.yield * SPECIALTY_YIELD[NO_GOLD]) / SPECIALTY_YIELD.oro) };
}

/**
 * El botín de los campamentos bárbaros pequeños (también para ponérselo a los que ya había: se
 * guardan con el mundo). Antes daban 1500 y 3200, y las bajas se comían casi la mitad.
 */
export const CAMP_LOOT = {
  1: { max: 2500, rate: 250, mix: { madera: 0.5, comida: 0.5 } },
  2: { max: 4500, rate: 360, mix: { madera: 0.3, piedra: 0.3, comida: 0.4 } },
};

const TEMPLATE = [
  { type: 'barbaros', tier: 1, dist: 96, size: 6, garrison: { barbaro: 8 }, regenHours: 6, loot: CAMP_LOOT[1] },
  { type: 'ruinas', dist: 102, size: 4.5, treasure: { piedra: 600, cristal: 300, oro: 150 } },
  { type: 'libre', dist: 106, size: 7, specialties: ['madera', 'comida', 'piedra'] },
  {
    type: 'barbaros', tier: 2, dist: 112, size: 5.5, garrison: { barbaro: 18, arquero: 6 }, regenHours: 6, loot: CAMP_LOOT[2],
  },
  { type: 'libre', dist: 124, size: 8, specialties: ['hierro', 'cristal', 'piedra'] },
  {
    type: 'barbaros', tier: 3, dist: 146, size: 7, garrison: { barbaro: 40, arquero: 22 }, regenHours: 8,
    loot: { max: 7000, rate: 450, mix: { madera: 0.25, piedra: 0.25, hierro: 0.25, cristal: 0.25 } },
  },
  { type: 'ruinas', dist: 140, size: 5, treasure: { hierro: 1200, cristal: 800, oro: 500 } },
  { type: 'libre', dist: 156, size: 7.5, specialties: ['cristal', 'hierro'] },
  {
    type: 'piratas', tier: 4, dist: 168, size: 8, garrison: { pirata: 45, corsario: 6 }, wall: 0.2, regenHours: 10,
    loot: { max: 14000, rate: 700, mix: { hierro: 0.3, cristal: 0.3, oro: 0.4 } },
  },
  { type: 'brumas', dist: 184, size: 5 },
];

const PIRATE_LORD = {
  type: 'piratas', tier: 5, dist: 178, size: 9, garrison: { pirata: 90, corsario: 14 }, wall: 0.3, regenHours: 12,
  loot: { max: 24000, rate: 1000, mix: { madera: 0.2, hierro: 0.3, cristal: 0.2, oro: 0.3 } },
};
/**
 * La fosa del Kraken: la guardan los tritones y sus hipocampos. El Kraken (solo hay uno en todos los mares) no
 * forma parte de la guarnición: despierta de vez en cuando en una de las fosas (WorldServer).
 */
export const KRAKEN_LAIR = { garrison: { triton: 130, hipocampo: 26 }, wall: 0.4, regenHours: 36 };
/** Quiénes guardaban antes las fosas y quiénes las guardan ahora (para los mundos de antes). */
export const LAIR_GUARDS = { pirata: 'triton', corsario: 'hipocampo' };
const KRAKEN = {
  type: 'kraken', tier: 7, dist: 190, size: 8, ...KRAKEN_LAIR,
  loot: { max: 60000, rate: 1200, mix: { hierro: 0.2, cristal: 0.3, oro: 0.5 } },
};

const NAME_HEADS = ['Isla', 'Cayo', 'Roca', 'Islote', 'Peñón', 'Atolón', 'Arrecife', 'Bahía', 'Monte', 'Punta', 'Cabo', 'Escollo', 'Isleta', 'Farallón', 'Morro', 'Cala'];
const NAME_TAILS = [
  'de las Gaviotas', 'del Cuervo', 'Esmeralda', 'Brumosa', 'del Ancla', 'Salitre', 'Ceniza', 'Rojo', 'Dorada', 'Tormenta',
  'del Tritón', 'Calavera', 'Herrumbre', 'del Faro', 'de Coral', 'Serena', 'del Viento', 'de Ámbar', 'Negra', 'de los Delfines',
  'del Lobo Marino', 'de la Sirena', 'Perdida', 'del Ocaso', 'de Sal', 'del Albatros', 'Callada', 'de Plata', 'del Náufrago', 'Verde',
  'de la Medusa', 'del Pulpo', 'de las Ostras', 'del Cangrejo', 'de Poniente', 'de Levante', 'Escondida', 'Blanca', 'Alta', 'Solitaria',
  'de la Luna', 'del Sol', 'de las Ánforas', 'del Tridente', 'de los Corales',
];
// Las fosas del Kraken, cada una con su nombre (la primera, como las de antes)
const LAIR_NAMES = [
  'Fosa del Kraken', 'Fosa de Caribdis', 'Fosa de Escila', 'Fosa de Ceto', 'Fosa de Forcis', 'Fosa de Proteo', 'Fosa de Nereo', 'Fosa de Glauco',
  'Fosa de Tetis', 'Fosa de Ponto', 'Fosa del Leviatán', 'Fosa de Anfitrite', 'Fosa de Océano', 'Fosa de Tritón', 'Fosa de Euribia', 'Fosa de Taumante',
];
const MIST_NAME = 'Mar de las Brumas';

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coordenadas axiales del sector `index` en una espiral hexagonal (0 = centro). */
function hexSpiral(index) {
  if (index === 0) return [0, 0];
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  let ring = 1;
  let first = 1;
  while (first + 6 * ring <= index) {
    first += 6 * ring;
    ring++;
  }
  // Se recorre el anillo empezando por la esquina en la dirección 4
  let k = index - first;
  let q = dirs[4][0] * ring;
  let r = dirs[4][1] * ring;
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < ring; step++) {
      if (k === 0) return [q, r];
      q += dirs[side][0];
      r += dirs[side][1];
      k--;
    }
  }
  return [q, r];
}

export function sectorCenter(index) {
  const [q, r] = hexSpiral(index);
  return { x: SECTOR_SPACING * (q + r / 2), z: SECTOR_SPACING * ((r * Math.sqrt(3)) / 2) };
}

/** Radio que ocupa una isla en el mar (con su playa), para no pisar a otras. */
export function footprint(isl) {
  if (isl.type === 'continente') return isl.size * 2.4 * 1.15;
  return isl.size * 2.4 * 1.32;
}

/**
 * Islas neutrales de un sector (descriptores estáticos con posición absoluta).
 * `obstacles`: tierras que ya existen cerca ({x, z, r}), como los continentes.
 */
export function generateSector(index, worldSeed = 1, obstacles = [], taken = new Set()) {
  const rand = rng(worldSeed * 7919 + index * 104729);
  const center = sectorCenter(index);
  const entries = TEMPLATE.map((t) => ({ ...t }));
  if (index % 3 === 1) entries.push({ ...PIRATE_LORD });
  if (index % 4 === 0) entries.push({ ...KRAKEN });

  // Cada isla en un ángulo al azar, con mar de por medio: unas 18 leguas entre islas y 40 alrededor
  // de la ciudad del jugador (antes bastaban 8 y alguna quedaba casi pegada a ella)
  const radius = (size) => size * 2.4 * 1.32 + 9;
  const placed = [{ x: center.x, z: center.z, r: radius(10) + 22 }, ...obstacles.map((o) => ({ ...o, r: o.r + 9 }))];
  const spots = entries.map((t) => {
    let best = null;
    for (let tries = 0; tries < 200; tries++) {
      const a = rand() * Math.PI * 2;
      const d = t.dist + (rand() - 0.5) * 16;
      const p = { x: center.x + Math.sin(a) * d, z: center.z + Math.cos(a) * d, r: radius(t.size) };
      const gap = Math.min(...placed.map((o) => Math.hypot(o.x - p.x, o.z - p.z) - o.r - p.r));
      if (!best || gap > best.gap) best = { ...p, gap };
      if (gap > 0) break;
    }
    placed.push(best);
    return best;
  });

  // (el Mar de las Brumas es el mismo en todos los sectores; lo demás, sin repetir en todo el archipiélago)
  const name = (type) => (type === 'brumas' ? MIST_NAME : freshPlaceName({ type }, taken, rand));

  return entries.map((t, i) => {
    const { specialties, ...rest } = t;
    const isl = {
      ...rest,
      id: `s${index}-${i}`,
      sector: index,
      name: name(t.type),
      x: Math.round(spots[i].x),
      z: Math.round(spots[i].z),
    };
    delete isl.dist;
    if (specialties) {
      isl.specialty = specialties[Math.floor(rand() * specialties.length)];
      isl.yield = SPECIALTY_YIELD[isl.specialty];
    }
    return isl;
  });
}

// ── Continentes ──────────────────────────────────────────────────────────────

const CONTINENT_CHANCE = 0.55;
const LAND_HEADS = ['Tierras', 'Costa', 'Reino', 'Llanuras', 'Marca', 'Montes'];
const LAND_TAILS = ['del Norte', 'de Estaño', 'Salvajes', 'de Ámbar', 'del Jabalí', 'Doradas', 'de Bronce', 'Olvidadas', 'del Trueno', 'de Ceniza'];
const CITY_HEADS = ['Bastión', 'Fortaleza', 'Burgo', 'Empalizada', 'Ciudadela', 'Torreón'];
const CITY_TAILS = ['del Jabalí', 'de Hueso', 'Roja', 'del Lobo', 'Negra', 'de los Cuervos', 'del Oso', 'de las Lanzas'];
const SITE_HEADS = ['Vega', 'Valle', 'Ribera', 'Llano', 'Prado', 'Cañada'];

// ── Nombres ──────────────────────────────────────────────────────────────────
// Un sustantivo y una coletilla: si la coletilla es un adjetivo, concuerda con el sustantivo
// («Cayo Rojo», «Isla Roja», «Tierras Doradas»). Ningún nombre se repite en el archipiélago.

/** Género y número de cada sustantivo de los nombres. */
const NOUNS = {
  Isla: 'fs', Cayo: 'ms', Roca: 'fs', Islote: 'ms', Peñón: 'ms', Atolón: 'ms', Arrecife: 'ms', Bahía: 'fs', Monte: 'ms', Punta: 'fs', Cabo: 'ms',
  Escollo: 'ms', Isleta: 'fs', Farallón: 'ms', Morro: 'ms', Cala: 'fs',
  Tierras: 'fp', Costa: 'fs', Reino: 'ms', Llanuras: 'fp', Marca: 'fs', Montes: 'mp',
  Bastión: 'ms', Fortaleza: 'fs', Burgo: 'ms', Empalizada: 'fs', Ciudadela: 'fs', Torreón: 'ms',
  Vega: 'fs', Valle: 'ms', Ribera: 'fs', Llano: 'ms', Prado: 'ms', Cañada: 'fs',
};
/** Los adjetivos de los nombres, en sus cuatro formas: masculino, femenino y sus plurales. */
const ADJECTIVES = [
  ['Brumoso', 'Brumosa', 'Brumosos', 'Brumosas'],
  ['Rojo', 'Roja', 'Rojos', 'Rojas'],
  ['Dorado', 'Dorada', 'Dorados', 'Doradas'],
  ['Sereno', 'Serena', 'Serenos', 'Serenas'],
  ['Negro', 'Negra', 'Negros', 'Negras'],
  ['Perdido', 'Perdida', 'Perdidos', 'Perdidas'],
  ['Callado', 'Callada', 'Callados', 'Calladas'],
  ['Olvidado', 'Olvidada', 'Olvidados', 'Olvidadas'],
  ['Escondido', 'Escondida', 'Escondidos', 'Escondidas'],
  ['Blanco', 'Blanca', 'Blancos', 'Blancas'],
  ['Alto', 'Alta', 'Altos', 'Altas'],
  ['Solitario', 'Solitaria', 'Solitarios', 'Solitarias'],
  ['Verde', 'Verde', 'Verdes', 'Verdes'],
  ['Salvaje', 'Salvaje', 'Salvajes', 'Salvajes'],
];
const FORM = { ms: 0, fs: 1, mp: 2, fp: 3 };
const NUMERALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** «Isla» y «Rojo» → «Isla Roja»: la coletilla, si es un adjetivo, concuerda con el sustantivo. */
export function placeName(head, tail) {
  const adj = ADJECTIVES.find((forms) => forms.includes(tail));
  return `${head} ${adj && NOUNS[head] ? adj[FORM[NOUNS[head]]] : tail}`;
}

/** Corrige la concordancia de un nombre ya puesto («Islote Negra» → «Islote Negro»). */
export function fixPlaceName(name) {
  const parts = String(name).split(' ');
  if (parts.length !== 2 || !NOUNS[parts[0]]) return name;
  return placeName(parts[0], parts[1]);
}

/**
 * Un nombre que no esté en `taken` (y lo apunta en él): `make()` propone uno al azar; si tras muchos
 * intentos todos están cogidos, se le pone un numeral («Isla Roja II»).
 */
function uniqueName(make, taken) {
  let name = make();
  for (let tries = 0; tries < 60 && taken.has(name); tries++) name = make();
  const base = name;
  for (let k = 0; taken.has(name); k++) name = `${base} ${NUMERALS[k] ?? k + 2}`;
  taken.add(name);
  return name;
}

/** Las listas de las que sale el nombre de cada clase de isla. */
function namesFor(isl) {
  if (isl.type === 'continente') return [LAND_HEADS, LAND_TAILS];
  if (isl.land) return isl.type === 'ciudadela' ? [CITY_HEADS, CITY_TAILS] : [SITE_HEADS, LAND_TAILS];
  return [NAME_HEADS, NAME_TAILS];
}

/** Un nombre para una isla, de los de su clase y que no esté en `taken` (y lo apunta en él). */
export function freshPlaceName(isl, taken, rand = Math.random) {
  if (isl.type === 'kraken') {
    const free = LAIR_NAMES.find((n) => !taken.has(n));
    if (free) {
      taken.add(free);
      return free;
    }
  }
  const [heads, tails] = isl.type === 'kraken' ? [['Fosa'], ['del Kraken']] : namesFor(isl);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return uniqueName(() => placeName(pick(heads), pick(tails)), taken);
}

const CITADELS = [
  { type: 'ciudadela', tier: 4, garrison: { barbaro: 60, arquero: 25 }, wall: 0.25, regenHours: 8, loot: { max: 11000, rate: 600, mix: { madera: 0.25, piedra: 0.2, hierro: 0.3, oro: 0.25 } } },
  { type: 'ciudadela', tier: 5, garrison: { barbaro: 110, arquero: 45 }, wall: 0.35, regenHours: 10, loot: { max: 18000, rate: 900, mix: { piedra: 0.2, hierro: 0.3, cristal: 0.2, oro: 0.3 } } },
];

/** Los seis vértices (entre tres sectores) alrededor del sector `index`. */
export function sectorVertices(index) {
  const c = sectorCenter(index);
  const d = SECTOR_SPACING / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((30 + 60 * k) * Math.PI) / 180;
    const x = Math.round(c.x + Math.cos(a) * d);
    const z = Math.round(c.z + Math.sin(a) * d);
    return { x, z, key: `${x}_${z}` };
  });
}

/**
 * Un pequeño continente en el vértice `v` (o null si no toca o no cabe), con
 * sus asentamientos: ciudades bárbaras y tierras libres. `obstacles`: tierras de alrededor.
 */
export function generateContinent(v, worldSeed = 1, obstacles = [], taken = new Set()) {
  let h = 2166136261;
  for (const ch of v.key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = rng(worldSeed * 31 + (h >>> 0));
  if (rand() > CONTINENT_CHANCE) return null;
  const clearance = (R) => Math.min(Infinity, ...obstacles.map((o) => Math.hypot(o.x - v.x, o.z - v.z) - o.r - R * 1.15));
  let R = 44;
  while (R >= 28 && clearance(R) < 14) R -= 2;
  if (R < 28) return null;

  const id = `c${v.key}`;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const shape = Array.from({ length: 18 }, () => Math.round((0.8 + rand() * 0.3) * 100) / 100);
  const n = R >= 38 ? 4 : 3;
  const turn = rand() * 360;
  const kinds = ['ciudadela', 'libre', 'ciudadela', rand() < 0.5 ? 'ciudadela' : 'libre'].slice(0, n);
  const sites = kinds.map((type, i) => {
    const a = ((turn + (i * 360) / n + (rand() - 0.5) * 30) * Math.PI) / 180;
    const d = R * (0.46 + rand() * 0.08);
    const x = Math.round(v.x + Math.sin(a) * d);
    const z = Math.round(v.z + Math.cos(a) * d);
    const base = { id: `${id}-${i}`, land: id, x, z, size: 4.2 };
    if (type === 'libre') {
      const specialty = pick(['madera', 'piedra', 'hierro', 'cristal', 'comida']);
      return { ...base, type, name: freshPlaceName({ type, land: id }, taken, rand), specialty, yield: Math.round(SPECIALTY_YIELD[specialty] * 1.3) };
    }
    const t = CITADELS[i === 0 || rand() < 0.6 ? 0 : 1];
    return { ...base, ...t, garrison: { ...t.garrison }, loot: { ...t.loot, mix: { ...t.loot.mix } }, name: freshPlaceName({ type: 'ciudadela', land: id }, taken, rand) };
  });
  const land = {
    id,
    type: 'continente',
    name: freshPlaceName({ type: 'continente' }, taken, rand),
    x: v.x,
    z: v.z,
    size: Math.round((R / 2.4) * 10) / 10,
    shape,
    wonder: pick(['poseidon', 'hefesto', 'demeter', 'atenea']),
    // Dónde están los asentamientos (relativo al centro), para trazar caminos y no plantar árboles encima
    sites: sites.map((s) => [s.x - v.x, s.z - v.z]),
  };
  return [land, ...sites];
}

/** Isla de un jugador, en el centro de su sector. */
export function homeIsland(index, userId, cityName) {
  const c = sectorCenter(index);
  return { id: `p-${userId}`, type: 'jugador', sector: index, owner: userId, name: cityName, x: Math.round(c.x), z: Math.round(c.z), size: 10 };
}

/** Estado compartido de una isla neutral (guarnición y botín que se regeneran). */
export function freshIslandState(isl, t) {
  const stock = {};
  for (const [res, k] of Object.entries(isl.loot?.mix ?? {})) stock[res] = isl.loot.max * k * 0.6;
  return { garrison: { ...(isl.garrison ?? {}) }, garrisonAt: t, stock, stockAt: t, looted: false, colonizedBy: null };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
