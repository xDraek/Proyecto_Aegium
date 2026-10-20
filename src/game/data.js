import { fmtEs } from './num.js';

// Datos del juego: recursos, edificios, unidades, investigaciones e islas.
// Los requisitos (`requires`) mezclan edificios e investigaciones: los ids no se repiten.

export const RESOURCES = {
  madera: { name: 'Madera', icon: '🪵', color: '#c8935f', value: 1 },
  piedra: { name: 'Piedra', icon: '🪨', color: '#a9b1bb', value: 1.2 },
  comida: { name: 'Comida', icon: '🥖', color: '#9ccc65', value: 0.9 },
  // Por dentro sigue siendo «hierro» (partidas guardadas), pero en la Edad del Bronce es bronce.
  // Su icono es una imagen (un lingote); en los textos sin formato se usa `emoji`.
  hierro: { name: 'Bronce', icon: '<img class="res-img" src="/ui/bronce.png" alt="🥉" draggable="false" />', emoji: '🥉', color: '#c7843f', value: 1.6 },
  cristal: { name: 'Cristal', icon: '💎', color: '#7fd4ff', value: 2 },
  oro: { name: 'Oro', icon: '🪙', color: '#f2c94c', value: 2.5 },
};

// `icon` va en HTML; `emoji`, en los textos sin formato (avisos, informes, desplegables)
for (const r of Object.values(RESOURCES)) r.emoji ??= r.icon;

export const RESOURCE_KEYS = Object.keys(RESOURCES);

// Lo que la isla produce por sí sola, sin edificios (por hora).
export const BASE_PRODUCTION = { madera: 60, piedra: 40, comida: 40, hierro: 0, cristal: 0, oro: 0 };

export const STARTING_RESOURCES = { madera: 500, piedra: 400, comida: 300, hierro: 0, cristal: 0, oro: 0 };

// ── Edificios ────────────────────────────────────────────────────────────────

export const BUILDINGS = {
  ayuntamiento: {
    name: 'Ayuntamiento',
    icon: '🏛️',
    description: 'El corazón de tu imperio. Cada nivel acelera las obras un 10 % y desbloquea nuevos edificios. Para subir los demás edificios por encima del nivel 5 hace falta tenerlo a cierto nivel (3 más cada 5 niveles). Desde el nivel 3 tu isla llama la atención de los piratas.',
    baseCost: { madera: 200, piedra: 150, comida: 120 },
    costFactor: 1.8,
    baseTime: 90,
    startLevel: 1,
  },
  aserradero: {
    name: 'Aserradero',
    icon: '🪓',
    description: 'Tala los bosques de la isla y produce madera.',
    produces: 'madera',
    baseProduction: 60,
    baseCost: { madera: 60, piedra: 15 },
    costFactor: 1.5,
    baseTime: 30,
    startLevel: 1,
  },
  cantera: {
    name: 'Cantera',
    icon: '⛏️',
    description: 'Extrae bloques de piedra de la montaña.',
    produces: 'piedra',
    baseProduction: 45,
    baseCost: { madera: 50, piedra: 25 },
    costFactor: 1.5,
    baseTime: 35,
    startLevel: 1,
  },
  granja: {
    name: 'Granja',
    icon: '🌾',
    description: 'Campos de trigo y graneros. Produce la comida que necesitan tus tropas.',
    produces: 'comida',
    baseProduction: 37.5,
    baseCost: { madera: 70, piedra: 20 },
    costFactor: 1.5,
    baseTime: 35,
  },
  mina: {
    name: 'Mina de cristal',
    icon: '💎',
    description: 'Excava las vetas de cristal que hay bajo la isla.',
    produces: 'cristal',
    baseProduction: 25,
    baseCost: { madera: 120, piedra: 80 },
    costFactor: 1.6,
    baseTime: 60,
    requires: { ayuntamiento: 2 },
  },
  fundicion: {
    name: 'Fundición',
    icon: '🔥',
    description: 'Funde el cobre y el estaño de la montaña y forja lingotes de bronce para armas y barcos.',
    produces: 'hierro',
    baseProduction: 25,
    baseCost: { madera: 140, piedra: 110 },
    costFactor: 1.6,
    baseTime: 65,
    requires: { ayuntamiento: 2, cantera: 2 },
  },
  mercado: {
    name: 'Mercado',
    icon: '⚖️',
    description: 'Los comerciantes pagan impuestos en oro y te dejan cambiar unos recursos por otros.',
    produces: 'oro',
    // El oro escasea: el mercado da la mitad que antes
    baseProduction: 7.5,
    baseCost: { madera: 150, piedra: 100, cristal: 40 },
    costFactor: 1.6,
    baseTime: 75,
    requires: { ayuntamiento: 3 },
  },
  almacen: {
    name: 'Almacén',
    icon: '📦',
    description: 'Amplía la capacidad máxima de todos los recursos y esconde una parte de cada uno, que los piratas no pueden robar.',
    baseCost: { madera: 100, piedra: 60 },
    costFactor: 1.7,
    baseTime: 45,
  },
  academia: {
    name: 'Academia',
    icon: '📚',
    description: 'Los sabios investigan nuevas técnicas. Cada nivel acelera las investigaciones un 10 % y desbloquea otras nuevas.',
    baseCost: { madera: 160, piedra: 140, comida: 80 },
    costFactor: 1.75,
    baseTime: 80,
    requires: { ayuntamiento: 2 },
  },
  templo: {
    name: 'Templo',
    icon: '🛕',
    description: 'Los sacerdotes ganan el favor de los dioses, que puedes gastar en poderes divinos. Cada nivel da más favor por hora y permite acumular más (hasta el nivel 10).',
    baseCost: { madera: 250, piedra: 350, cristal: 60, comida: 150 },
    costFactor: 1.7,
    baseTime: 110,
    maxLevel: 10,
    requires: { ayuntamiento: 3, academia: 1 },
  },
  cuartel: {
    name: 'Cuartel',
    icon: '🛡️',
    description: 'Entrena tropas de tierra. Cada nivel entrena un 10 % más rápido y desbloquea nuevas unidades.',
    baseCost: { madera: 150, piedra: 100, comida: 120 },
    costFactor: 1.65,
    baseTime: 70,
    requires: { ayuntamiento: 2 },
  },
  puerto: {
    name: 'Puerto',
    icon: '⚓',
    description: 'Muelles y gradas donde se botan los barcos. Cada nivel permite tener una flota más en el mar a la vez y hace tus flotas un 2 % más rápidas. Los barcos de guerra piden además el astillero, que es quien los construye más rápido.',
    baseCost: { madera: 200, piedra: 80, comida: 80 },
    costFactor: 1.7,
    baseTime: 90,
    requires: { ayuntamiento: 2 },
  },
  muralla: {
    name: 'Muralla',
    icon: '🏰',
    description: 'Rodea la ciudad. Cada nivel da un 10 % más de vida a los defensores y sus torres disparan a los asaltantes.',
    baseCost: { madera: 60, piedra: 250 },
    costFactor: 1.75,
    baseTime: 100,
    requires: { ayuntamiento: 3, cuartel: 1 },
  },
  taberna: {
    name: 'Taberna',
    icon: '🍺',
    description: 'Vino, pan y canciones. Las tropas bien atendidas comen menos: cada nivel reduce un 4 % la comida que consumen (hasta un 40 %). Y atrae mercenarios: al principio solo milicianos, y mejores a medida que sube.',
    baseCost: { madera: 180, piedra: 90, comida: 120 },
    costFactor: 1.6,
    baseTime: 70,
    requires: { ayuntamiento: 3 },
  },
  forja: {
    name: 'Forja',
    icon: '⚒️',
    description: 'Los herreros afilan lanzas, espadas y espolones. Cada nivel da un 3 % más de ataque a tus tropas y barcos.',
    baseCost: { madera: 160, piedra: 140, hierro: 80 },
    costFactor: 1.65,
    baseTime: 90,
    requires: { ayuntamiento: 4, fundicion: 2, cuartel: 2 },
  },
  torre: {
    name: 'Torre de vigía',
    icon: '👁️',
    description: 'Vigila el horizonte: distingue qué tropas trae una flota enemiga desde 40 leguas, y 30 más por nivel (antes solo se sabe que viene). Cada nivel da también un 2,5 % más de probabilidad de descubrir espías y saboteadores (hasta un 50 %, en el nivel 20) y sus arqueros añaden 8 de daño por asalto cuando defiendes la isla.',
    baseCost: { madera: 120, piedra: 220 },
    costFactor: 1.65,
    baseTime: 80,
    requires: { ayuntamiento: 4, muralla: 2 },
  },
  faro: {
    name: 'Faro',
    icon: '🗼',
    description: 'Su luz guía a tus barcos: cada nivel hace las flotas un 4 % más rápidas y da a tus barcos un 4 % más de vida cuando defienden la ciudad.',
    baseCost: { madera: 150, piedra: 260, cristal: 40 },
    costFactor: 1.6,
    baseTime: 85,
    requires: { ayuntamiento: 5, puerto: 3 },
  },
  astillero: {
    name: 'Astillero',
    icon: '🛠️',
    description: 'Gradas y carpinteros de ribera. Cada nivel construye los barcos un 8 % más rápido y desbloquea barcos de guerra nuevos: sin astillero solo se botan botes y mercantes.',
    baseCost: { madera: 260, piedra: 120, hierro: 40, comida: 100 },
    costFactor: 1.65,
    baseTime: 90,
    requires: { ayuntamiento: 4, puerto: 2 },
  },
  coloso: {
    name: 'Coloso',
    icon: '🗽',
    description: 'Una maravilla que vigila el mar y nunca deja de crecer. Cada nivel aumenta un 5 % toda la producción; al nivel 10, ya terminado, se adorna de oro y enciende su antorcha.',
    baseCost: { madera: 5000, piedra: 8000, hierro: 2000, cristal: 3000, oro: 2000, comida: 3000 },
    costFactor: 1.45,
    baseTime: 3600,
    requires: { ayuntamiento: 8, arquitectura: 8 },
  },
};

export const BUILDING_KEYS = Object.keys(BUILDINGS);

// ── Unidades ─────────────────────────────────────────────────────────────────
// atk: daño por asalto · hp: vida · upkeep: comida por hora · size: plazas en barco
// pay: oro por hora (la paga; si no hay oro, desertan). La milicia no cobra: solo come
// Barcos: speed (multiplicador), cargo (botín que cargan), capacity (plazas para tropas)

export const UNITS = {
  lancero: {
    name: 'Milicia con lanza',
    // Su icono es una imagen (lanza y escudo); en los textos va 🪖, que se cambia por ella al pintarlos
    icon: '<img class="res-img unit-img" src="/ui/lancero.png" alt="🪖" draggable="false" />',
    emoji: '🪖',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Ciudadanos armados con lanza: baratos y duros, la base de cualquier defensa. No cobran paga en oro, pero comen más.',
    cost: { madera: 40, comida: 30 },
    time: 40,
    atk: 5,
    hp: 18,
    upkeep: 2,
    size: 1,
    requires: { cuartel: 1 },
  },
  hondero: {
    name: 'Hondero miliciano',
    icon: '🪨',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Pastores de la milicia con honda: baratos, rápidos de entrenar y certeros. Se entrenan con piedra y no cobran paga en oro, pero comen más.',
    cost: { piedra: 30, comida: 25 },
    time: 35,
    atk: 7,
    hp: 8,
    upkeep: 2,
    size: 1,
    requires: { cuartel: 1 },
  },
  arquero: {
    name: 'Arquero',
    icon: '🏹',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Mucho daño a distancia, pero poca vida.',
    cost: { madera: 60, comida: 30 },
    time: 50,
    atk: 11,
    hp: 9,
    upkeep: 1,
    pay: 0.5,
    size: 1,
    requires: { cuartel: 2 },
  },
  espadachin: {
    name: 'Espadachín',
    icon: '⚔️',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Soldado de élite con espada y escudo de bronce.',
    cost: { madera: 30, hierro: 45, comida: 40 },
    time: 75,
    atk: 15,
    hp: 24,
    upkeep: 2,
    pay: 0.6,
    size: 1,
    requires: { cuartel: 3, herreria: 1 },
  },
  hoplita: {
    name: 'Hoplita',
    icon: '🛡️',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Infantería pesada con escudo de bronce. Aguanta como un muro: ideal para defender.',
    cost: { madera: 30, hierro: 60, comida: 40 },
    time: 90,
    atk: 10,
    hp: 42,
    upkeep: 2,
    pay: 0.7,
    size: 1,
    requires: { cuartel: 4, armaduras: 1 },
  },
  caballero: {
    name: 'Caballero',
    icon: '🐎',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Caballería pesada. Ocupa dos plazas en los barcos.',
    cost: { hierro: 90, comida: 80, oro: 25 },
    time: 140,
    atk: 28,
    hp: 38,
    upkeep: 3,
    pay: 1.2,
    size: 2,
    requires: { cuartel: 5, equitacion: 2 },
  },
  catapulta: {
    name: 'Catapulta',
    icon: '☄️',
    kind: 'tierra',
    building: 'cuartel',
    description: 'Derriba fortificaciones: cada catapulta resta un 6 % a la defensa de las murallas enemigas.',
    cost: { madera: 220, piedra: 120, hierro: 80 },
    time: 200,
    atk: 40,
    hp: 25,
    upkeep: 3,
    pay: 1.4,
    size: 3,
    siege: 0.06,
    requires: { cuartel: 6, asedio: 1 },
  },
  // ── Tropas de élite: cobran una paga en oro además de comer ──
  espartano: {
    name: 'Espartano',
    icon: '🗡️',
    kind: 'tierra',
    building: 'cuartel',
    elite: true,
    description: 'Hoplita de élite criado para la guerra desde niño: casi imposible de derribar. Cobra su paga en oro.',
    cost: { hierro: 140, comida: 70, oro: 60 },
    time: 160,
    atk: 27,
    hp: 86,
    upkeep: 2,
    pay: 2.5,
    size: 1,
    requires: { cuartel: 7, armaduras: 2, tactica: 1 },
  },
  sagitario: {
    name: 'Arquero cretense',
    icon: '🎯',
    kind: 'tierra',
    building: 'cuartel',
    elite: true,
    description: 'Los mejores arqueros del mundo, de alquiler en Creta: disparan lejos y no fallan. Cobran su paga en oro.',
    cost: { madera: 120, cristal: 40, oro: 50 },
    time: 130,
    atk: 37,
    hp: 30,
    upkeep: 2,
    pay: 2.2,
    size: 1,
    requires: { cuartel: 7, tactica: 2 },
  },
  catafracto: {
    name: 'Catafracto',
    icon: '🏇',
    kind: 'tierra',
    building: 'cuartel',
    elite: true,
    description: 'Jinete y caballo cubiertos de escamas de bronce: embiste como un ariete. Ocupa dos plazas en los barcos y cobra en oro.',
    cost: { hierro: 220, comida: 150, oro: 120 },
    time: 260,
    atk: 59,
    hp: 98,
    upkeep: 4,
    pay: 5,
    size: 2,
    requires: { cuartel: 9, equitacion: 2, tactica: 3 },
  },
  elefante: {
    name: 'Elefante de guerra',
    icon: '🐘',
    kind: 'tierra',
    building: 'cuartel',
    elite: true,
    description: 'Una torre viva con arqueros encima que aplasta todo lo que encuentra. Come muchísimo, cobra en oro y ocupa cuatro plazas en los barcos.',
    cost: { comida: 600, hierro: 150, oro: 300 },
    time: 480,
    atk: 92,
    hp: 270,
    upkeep: 10,
    pay: 10,
    size: 4,
    requires: { cuartel: 10, academia: 7, elefantes: 1, tactica: 2 },
  },
  bote: {
    name: 'Bote explorador',
    icon: '🛶',
    kind: 'barco',
    building: 'puerto',
    description: 'Rápido y discreto. Descubre islas desconocidas sin entrar en combate.',
    cost: { madera: 80, comida: 20 },
    time: 40,
    atk: 0,
    hp: 6,
    upkeep: 1,
    pay: 0.1,
    speed: 2.2,
    cargo: 0,
    capacity: 0,
    explorer: true,
    requires: { puerto: 1 },
  },
  mercante: {
    name: 'Barco mercante',
    icon: '⛵',
    kind: 'barco',
    building: 'puerto',
    description: 'Transporta 12 soldados y mucho botín. No combate: solo se pierde si cae todo tu ejército.',
    cost: { madera: 160, piedra: 40 },
    time: 90,
    atk: 0,
    hp: 30,
    upkeep: 1,
    pay: 0.3,
    speed: 1,
    cargo: 500,
    capacity: 12,
    requires: { puerto: 1 },
  },
  trirreme: {
    name: 'Trirreme',
    icon: '🚣',
    kind: 'barco',
    building: 'puerto',
    description: 'Barco de guerra rápido con espolón.',
    cost: { madera: 240, hierro: 70, oro: 15 },
    time: 150,
    atk: 18,
    hp: 45,
    upkeep: 2,
    pay: 1,
    speed: 1.35,
    cargo: 120,
    capacity: 4,
    requires: { puerto: 3, astillero: 1, navegacion: 2 },
  },
  brulote: {
    name: 'Brulote',
    icon: '🔥',
    kind: 'barco',
    building: 'puerto',
    description: 'Barco cargado de brea que se lanza en llamas contra el enemigo. Mucho daño y poca vida.',
    cost: { madera: 300, comida: 60, cristal: 30 },
    time: 140,
    atk: 42,
    hp: 24,
    upkeep: 2,
    pay: 1,
    speed: 1.25,
    cargo: 0,
    capacity: 0,
    requires: { puerto: 4, astillero: 2 },
  },
  galeon: {
    name: 'Quinquerreme',
    icon: '🚢',
    kind: 'barco',
    building: 'puerto',
    description: 'Fortaleza flotante de cinco filas de remeros: torres con arqueros, catapulta en cubierta, bodega enorme y sitio para 15 soldados.',
    cost: { madera: 600, hierro: 250, cristal: 80, oro: 60 },
    time: 360,
    atk: 48,
    hp: 130,
    upkeep: 4,
    pay: 2.5,
    speed: 1.15,
    cargo: 400,
    capacity: 15,
    requires: { puerto: 6, astillero: 4, navegacion: 6 },
  },

  dromon: {
    name: 'Dromón',
    icon: '⚓',
    kind: 'barco',
    building: 'puerto',
    description: 'El mayor barco de guerra del archipiélago: dos velas, cien remos, sifón de fuego y sitio para 20 soldados.',
    cost: { madera: 800, hierro: 350, cristal: 120, oro: 90 },
    time: 480,
    atk: 72,
    hp: 190,
    upkeep: 5,
    pay: 3.5,
    speed: 1.05,
    cargo: 600,
    capacity: 20,
    requires: { puerto: 8, astillero: 7, navegacion: 8 },
  },
  liburna: {
    name: 'Liburna',
    icon: '⛴️',
    kind: 'barco',
    building: 'puerto',
    elite: true,
    description: 'Birreme ligera de los marinos ilirios: la más rápida de las de guerra, caza barcos y lleva un destacamento. Su tripulación cobra en oro.',
    cost: { madera: 500, hierro: 180, oro: 150 },
    time: 300,
    atk: 60,
    hp: 120,
    upkeep: 3,
    pay: 4,
    speed: 1.8,
    cargo: 300,
    capacity: 6,
    requires: { puerto: 7, astillero: 5, navegacion: 6, tactica: 2 },
  },

  // Unidades que solo usan los enemigos
  barbaro: { name: 'Bárbaro', icon: '🪓', kind: 'tierra', npc: true, atk: 7, hp: 15 },
  pirata: { name: 'Pirata', icon: '🏴‍☠️', kind: 'tierra', npc: true, atk: 11, hp: 17 },
  corsario: { name: 'Barco corsario', icon: '⛵', kind: 'barco', npc: true, atk: 20, hp: 50, capacity: 12 },
  kraken: { name: 'Kraken', icon: '🐙', kind: 'barco', npc: true, atk: 260, hp: 2600 },
  // Los hijos de Tifón (gestas): su número y sus multiplicadores dependen de quién les plante cara
  sierpe: { name: 'Sierpe marina', icon: '🐍', kind: 'barco', npc: true, atk: 14, hp: 300 },
  gigante: { name: 'Gigante', icon: '🗿', kind: 'tierra', npc: true, atk: 12, hp: 400 },
  cabeza: { name: 'Cabeza de Tifón', icon: '🐲', kind: 'tierra', npc: true, atk: 100, hp: 1000 },
  // La Armada del Gran Rey y la Hidra de Lerna (gestas)
  fenicia: { name: 'Trirreme fenicia', icon: '⛵', kind: 'barco', npc: true, atk: 30, hp: 80 },
  inmortal: { name: 'Inmortal', icon: '🛡️', kind: 'tierra', npc: true, atk: 14, hp: 40 },
  arquero_persa: { name: 'Arquero persa', icon: '🏹', kind: 'tierra', npc: true, atk: 12, hp: 14 },
  hidra: { name: 'Cabeza de la Hidra', icon: '🐉', kind: 'tierra', npc: true, atk: 100, hp: 1000 },
};
// `icon` puede ser HTML (una imagen); `emoji` es lo que va en los textos sin formato
for (const u of Object.values(UNITS)) u.emoji ??= u.icon;

export const UNIT_KEYS = Object.keys(UNITS);
export const PLAYER_UNITS = UNIT_KEYS.filter((id) => !UNITS[id].npc);
export const LAND_UNITS = PLAYER_UNITS.filter((id) => UNITS[id].kind === 'tierra');
export const SHIP_UNITS = PLAYER_UNITS.filter((id) => UNITS[id].kind === 'barco');

// ── Investigaciones ──────────────────────────────────────────────────────────

export const RESEARCH = {
  silvicultura: {
    name: 'Silvicultura',
    icon: '🌲',
    description: 'Técnicas de tala y replantado.',
    effect: (n) => `+${n * 5} % de madera`,
    baseCost: { madera: 180, piedra: 120, cristal: 60 },
    long: true,
    maxLevel: 20,
    baseTime: 120,
    requires: { academia: 1 },
  },
  mineria: {
    name: 'Ingeniería minera',
    icon: '⛏️',
    description: 'Galerías más profundas y mejores herramientas.',
    effect: (n) => `+${n * 5} % de piedra y bronce`,
    baseCost: { madera: 150, piedra: 150, cristal: 60 },
    long: true,
    maxLevel: 20,
    baseTime: 130,
    requires: { academia: 1 },
  },
  agricultura: {
    name: 'Irrigación',
    icon: '💧',
    description: 'Acequias y molinos para regar los campos.',
    effect: (n) => `+${n * 5} % de comida`,
    baseCost: { madera: 160, piedra: 80, cristal: 50 },
    long: true,
    maxLevel: 20,
    baseTime: 110,
    requires: { academia: 1 },
  },
  cristalografia: {
    name: 'Cristalografía',
    icon: '🔬',
    description: 'Los sabios aprenden a tallar el cristal sin romperlo.',
    effect: (n) => `+${n * 5} % de cristal`,
    baseCost: { madera: 200, cristal: 200 },
    long: true,
    maxLevel: 20,
    baseTime: 160,
    requires: { academia: 2, mineria: 1 },
  },
  arquitectura: {
    name: 'Arquitectura',
    icon: '📐',
    description: 'Planos, grúas y andamios mejores.',
    effect: (n) => `Obras un ${n * 4} % más rápidas`,
    baseCost: { madera: 300, piedra: 300, cristal: 120, oro: 40 },
    long: true,
    maxLevel: 20,
    baseTime: 200,
    requires: { academia: 2 },
  },
  logistica: {
    name: 'Logística',
    icon: '🧺',
    description: 'Estanterías, toneles y un buen inventario.',
    effect: (n) => `+${n * 10} % de capacidad del almacén`,
    baseCost: { madera: 250, piedra: 250, cristal: 100, oro: 40 },
    long: true,
    maxLevel: 20,
    baseTime: 180,
    requires: { academia: 2, almacen: 2 },
  },
  comercio: {
    name: 'Comercio',
    icon: '📜',
    description: 'Contratos, letras de cambio y rutas comerciales.',
    effect: (n) => `+${fmtEs(n * 2.5, 1)} % de oro y mejores cambios en el mercado`,
    baseCost: { madera: 300, cristal: 250, oro: 50 },
    long: true,
    maxLevel: 20,
    baseTime: 240,
    requires: { academia: 3, mercado: 1 },
  },
  herreria: {
    name: 'Herrería',
    icon: '⚒️',
    description: 'Armas de bronce bien forjado. El nivel 1 permite entrenar espadachines.',
    effect: (n) => `+${n * 5} % de ataque`,
    baseCost: { madera: 150, hierro: 200, cristal: 120, oro: 30 },
    lateCost: true,
    baseTime: 200,
    requires: { academia: 2, fundicion: 1 },
  },
  armaduras: {
    name: 'Armaduras',
    icon: '🦺',
    description: 'Cotas de malla y escudos reforzados.',
    effect: (n) => `+${n * 5} % de vida de tus tropas`,
    baseCost: { piedra: 150, hierro: 250, cristal: 150, oro: 50 },
    lateCost: true,
    baseTime: 220,
    requires: { academia: 3, herreria: 1 },
  },
  equitacion: {
    name: 'Equitación',
    icon: '🐎',
    description: 'Cría y doma de animales de guerra. Nivel 2: caballeros y catafractos. Nivel 4: permite investigar la Doma de elefantes.',
    effect: (n) => (n >= 4 ? 'Caballería, y se puede investigar la Doma de elefantes' : n >= 2 ? 'Caballería (caballeros y catafractos)' : 'Cuadras y potros: aún sin caballería'),
    baseCost: { hierro: 300, cristal: 250, oro: 120 },
    baseTime: 400,
    maxLevel: 4,
    requires: { academia: 4, herreria: 2 },
  },
  asedio: {
    name: 'Ingeniería de asedio',
    icon: '☄️',
    description: 'Contrapesos, poleas y proyectiles de piedra. Permite construir catapultas.',
    effect: () => 'Desbloquea la catapulta',
    baseCost: { madera: 800, hierro: 500, cristal: 350, oro: 150 },
    baseTime: 600,
    maxLevel: 1,
    requires: { academia: 5, herreria: 3 },
  },
  navegacion: {
    name: 'Navegación',
    icon: '🧭',
    description: 'Brújulas y velas latinas. Nivel 2: trirremes. Nivel 4: expediciones al Mar de las Brumas. Nivel 6: quinquerremes y liburnas. Nivel 8: dromones.',
    effect: (n) => `Flotas un ${n * 5} % más rápidas`,
    baseCost: { madera: 300, cristal: 180, oro: 30 },
    long: true,
    maxLevel: 20,
    baseTime: 220,
    requires: { academia: 2, puerto: 2 },
  },
  cartografia: {
    name: 'Cartografía',
    icon: '🗺️',
    description: 'Mapas de las islas y sus fondeaderos. Cada nivel te deja fundar una colonia más.',
    effect: (n) => `${n} ${n === 1 ? 'colonia' : 'colonias'} como máximo`,
    baseCost: { madera: 500, cristal: 450, oro: 150 },
    baseTime: 360,
    maxLevel: 4,
    requires: { academia: 3, navegacion: 2 },
  },
  cartas: {
    name: 'Cartas náuticas',
    icon: '🧭',
    description: 'Las rutas, corrientes y fondeaderos de todo el archipiélago. Sin ellas, tus flotas de guerra solo llegan a las ciudades a menos de 300 leguas.',
    effect: () => 'Atacas, invades y bloqueas a cualquier jugador del archipiélago',
    baseCost: { madera: 800, cristal: 600, oro: 300 },
    baseTime: 600,
    maxLevel: 1,
    requires: { academia: 5, navegacion: 4, cartografia: 1 },
  },
  tactica: {
    name: 'Táctica militar',
    icon: '📜',
    description: 'Formaciones, disciplina y oficiales de carrera. Necesaria para las tropas de élite: espartanos (1), arqueros cretenses y liburnas (2) y catafractos (3).',
    effect: (n) => `+${n * 3} % de ataque y vida de tus tropas`,
    baseCost: { hierro: 250, cristal: 450, oro: 200 },
    baseTime: 420,
    maxLevel: 5,
    requires: { academia: 5, herreria: 2 },
  },
  elefantes: {
    name: 'Doma de elefantes',
    icon: '🐘',
    description: 'Elefantes traídos de África y la India, y cornacas que saben guiarlos en la batalla. Hace falta para entrenar elefantes de guerra.',
    effect: () => 'Desbloquea el elefante de guerra',
    baseCost: { comida: 2200, cristal: 800, oro: 950 },
    baseTime: 1100,
    maxLevel: 1,
    requires: { academia: 7, equitacion: 4, tactica: 2 },
  },
};

export const RESEARCH_KEYS = Object.keys(RESEARCH);

/**
 * Sin Cartas náuticas, los ataques, invasiones y bloqueos contra otros jugadores solo llegan a
 * las ciudades a menos de estas leguas de la tuya.
 */
export const PVP_RANGE = 300;

/**
 * Ciudades lejanas que has señalado con las Cartas náuticas para atacarlas o espiarlas (en tu mapa
 * ya se ve todo el archipiélago): se recuerdan las últimas WATCH_MAX.
 */
export const WATCH_MAX = 8;

/** Alrededor de cada ciudad lejana que traes a tu mapa también se ven las islas hasta esta distancia. */
export const WATCH_RADIUS = 250;

/**
 * Expediciones al Mar de las Brumas: solo una a la vez, y la flota pasa `stayHours` horas
 * explorando la niebla antes de volver. Lo que encuentran tiene que caber en la bodega.
 */
export const EXPEDITION = { stayHours: 2 };

/** Comprar oro en el mercado sale peor: el cambio se multiplica por esto (como mucho, un 30 %). */
export const MARKET_GOLD = 0.5;
export const RESEARCH_COST_FACTOR = 1.9;

/**
 * Investigaciones largas (`long: true`, 20 niveles con la mitad de efecto por nivel que antes):
 * el coste crece `early` por nivel hasta el 10 y `late` después, y el tiempo, `time` por nivel.
 * Las de `lateCost` (Herrería y Armaduras, 10 niveles) encarecen mucho sus últimos niveles.
 */
export const RESEARCH_LONG = { early: 1.38, late: 1.6, time: 1.3 };
export const RESEARCH_LATE = { from: 7, step: 0.75 };

/**
 * Costes de las obras: la madera y la piedra de `baseCost` cuestan `woodStone` (un poco menos), y
 * desde el nivel `fromLevel` cada obra pide además bronce y cristal: esta parte de lo que pide de
 * madera y piedra juntas. Así la mina y la fundición siguen sirviendo. (El Coloso ya los pide.)
 */
export const BUILD_COST = { woodStone: 0.85, fromLevel: 7, hierro: 0.12, cristal: 0.08 };

/**
 * Lo que acelera cada nivel (a partir del segundo) del edificio donde se entrena: el cuartel, las
 * tropas. Los barcos solo los acelera el astillero (+8 % por nivel).
 */
export const TRAIN_SPEED = { cuartel: 0.1 };
/** Lo que el puerto hace más rápidas tus flotas por cada nivel. */
export const PORT_SAIL_SPEED = 0.02;

/**
 * El ayuntamiento manda: para subir cualquier otro edificio por encima del nivel `free` hace falta
 * el ayuntamiento a `need` niveles más por cada `every` niveles (del 6 al 10, el 3; del 11 al 15, el 6…).
 */
export const TOWN_HALL_GATE = { free: 5, every: 5, need: 3 };

/** El almacén esconde lo más alto de: 100 + 250 por nivel, o este porcentaje de lo que cabe. */
export const PROTECTED_SHARE = 0.08;
/** Todas las investigaciones cuestan esto más que su `baseCost` (en todos los niveles). */
export const RESEARCH_COST_MULT = 1.25;
/** …salvo el oro, que escasea: de oro piden un 35 % menos de lo que saldría. */
export const RESEARCH_GOLD_MULT = 0.65;

// ── Archipiélago ─────────────────────────────────────────────────────────────
// Las islas se generan por sectores en game/world.js.

export const ISLAND_TYPES = {
  barbaros: { name: 'Campamento bárbaro', icon: '🪓' },
  piratas: { name: 'Fortaleza pirata', icon: '☠️' },
  ruinas: { name: 'Ruinas antiguas', icon: '🏺' },
  libre: { name: 'Isla deshabitada', icon: '🌴' },
  kraken: { name: 'Guarida del Kraken', icon: '🐙' },
  brumas: { name: 'Mar abierto', icon: '🌫️' },
  jugador: { name: 'Ciudad', icon: '🏰' },
  ciudadela: { name: 'Ciudad bárbara', icon: '🏯' },
  continente: { name: 'Continente', icon: '🗺️' },
};

/** Recursos que viajan en el mercante para fundar una colonia (se multiplican por colonia). */
export const COLONY_COST = { madera: 1500, piedra: 1000, comida: 800, oro: 300 };

/** Ampliar una colonia: cada nivel produce un 60 % más de lo que daba al fundarla. */
export const COLONY = {
  maxLevel: 10,
  yieldPerLevel: 0.6,
  upgradeCost: { madera: 700, piedra: 550, comida: 300, oro: 180 },
  costFactor: 1.6,
  upgradeMinutes: 20,
  timeFactor: 1.45,
};

/**
 * Espionaje. Cada bote espía corre un riesgo `base` de que lo vean, más lo que vigila la torre de
 * vigía del espiado (`guardPerLevel` por nivel, como mucho `guardMax`). Mandar más botes saca más
 * información (SPY_TIERS) pero también es más fácil que los vean: cada bote de más cuenta como
 * `extraBoat` botes a la hora de que los descubran.
 */
export const SPY = { base: 0.05, guardPerLevel: 0.025, guardMax: 0.5, extraBoat: 0.5 };

/** Lo que averiguan los espías según cuántos botes llegan (cada nivel incluye los anteriores). */
export const SPY_TIERS = [
  { boats: 1, text: 'Recursos, muralla y ayuntamiento' },
  { boats: 2, text: 'Los barcos que tiene en el puerto' },
  { boats: 3, text: 'Sus tropas de tierra' },
  { boats: 4, text: 'Sus defensas: torre de vigía, faro y lo que esconde el almacén' },
  { boats: 5, text: 'Los refuerzos de sus aliados y sus mejoras militares' },
];

/** Qué parte de lo pagado se recupera al cancelar una obra o una investigación… */
export const CANCEL_REFUND = 0.7;

/** …y al disolver tropas que aún se están reclutando. */
export const TRAIN_CANCEL_REFUND = 0.6;

/** Al dar de baja tropas o barcos se recupera esta parte de lo que costaron, solo de estos recursos. */
export const DISMISS_REFUND = { share: 0.2, resources: ['madera', 'comida', 'hierro'] };

/** Cuántos aliados pueden unirse a un mismo ataque conjunto. */
export const JOINT_MAX = 4;

export const MISSION_TYPES = {
  explorar: { name: 'Explorar', icon: '🔭' },
  atacar: { name: 'Atacar', icon: '⚔️' },
  colonizar: { name: 'Colonizar', icon: '🚩' },
  conquistar: { name: 'Conquistar', icon: '🏴' },
  sabotaje: { name: 'Sabotaje', icon: '🔥' },
  expedicion: { name: 'Expedición', icon: '🧭' },
  transporte: { name: 'Transporte', icon: '📦' },
  apoyo: { name: 'Apoyo', icon: '🛡️' },
  bloquear: { name: 'Bloquear puerto', icon: '⛓️' },
  invadir: { name: 'Invadir', icon: '🦅' },
  tributo: { name: 'Tributo', icon: '💰' },
  guarnicion: { name: 'Guarnición', icon: '🏕️' },
};

/**
 * Bloquear un puerto: tus barcos de guerra vencen a su flota y se quedan frente a la ciudad.
 * Mientras dure, de allí no zarpa nadie, no entran transportes ni mercaderes y sus colonias no
 * pueden mandarle nada. `hours`: lo más que aguanta la flota en el mar.
 */
export const BLOCKADE = { hours: 8 };

/**
 * Invadir una ciudad: si tus tropas desembarcan y acaban con su ejército, se quedan ocupándola.
 * Mientras tanto controlas su puerto (como un bloqueo), te llevas `tribute` de todo lo que produce
 * y puedes lanzar ataques desde allí. Cada `plunderHours` puedes saquear su almacén (hasta
 * `plunderShare` de lo que no esconde) y mandarlo a casa con el tributo. Como mucho `max`
 * ocupaciones a la vez y `hours` horas cada una.
 */
export const OCCUPATION = { hours: 24, tribute: 0.2, plunderHours: 4, plunderShare: 0.5, max: 3 };
/**
 * Protección contra el acoso. Tras librarse de un bloqueo o una ocupación, la ciudad queda
 * `shieldHours` horas a salvo de nuevos bloqueos e invasiones (la pierde si ella misma bloquea o
 * invade). Y nadie puede lanzar más de `attacksPerDay` ataques, invasiones o bloqueos contra el
 * mismo jugador en 24 horas, salvo entre alianzas en guerra.
 */
/**
 * Protección entre jugadores. Novato: hasta `newbiePoints` puntos y como mucho `newbieDays` días
 * desde que fundó la ciudad, nadie le ataca (ni él a nadie). Débil: no se puede atacar a quien
 * tenga menos de `weakRatio` de tus puntos, salvo en guerra o si te atacó él en las últimas
 * `revengeHours` horas.
 */
export const PROTECTION = { shieldHours: 12, attacksPerDay: 5, newbiePoints: 1000, newbieDays: 5, weakRatio: 0.2, revengeHours: 48 };
/** Misiones contra otro jugador que cuentan para el límite de ataques. */
export const HOSTILE_MISSIONS = ['atacar', 'invadir', 'bloquear'];
/** Misiones que se pueden lanzar desde una base: una ciudad ocupada o una colonia con guarnición. */
export const OUTPOST_MISSIONS = ['atacar', 'explorar', 'sabotaje', 'bloquear', 'invadir'];

/**
 * Saquear la colonia de otro jugador: si tus tropas desembarcan y vencen a su guarnición, te llevas
 * `lootHours` horas de lo que produce (lo que quepa en las bodegas) y la colonia deja de producir
 * `stopHours` horas. Mientras no produce no se la puede volver a saquear. La colonia sigue siendo suya.
 */
export const COLONY_RAID = { lootHours: 6, stopHours: 12 };

// ── Templo ───────────────────────────────────────────────────────────────────
// duration: horas de juego que dura el efecto (0 = instantáneo). cooldown: horas desde que se
// invoca hasta que se puede volver a invocar (así no se acumulan). `templo`: el nivel del templo que
// hace falta para invocarlo (se van desbloqueando).

export const POWERS = {
  cosecha: {
    name: 'Cosecha abundante',
    icon: '🌾',
    description: '+25 % de toda la producción durante 2 horas.',
    templo: 1,
    cost: 110,
    duration: 2,
    cooldown: 8,
  },
  inspiracion: {
    name: 'Inspiración',
    icon: '🦉',
    description: 'La obra y la investigación en curso terminan un 30 % antes.',
    templo: 2,
    cost: 90,
    duration: 0,
    cooldown: 6,
  },
  viento: {
    name: 'Viento favorable',
    icon: '🌬️',
    description: 'Tus flotas en el mar se ahorran la mitad de lo que les queda de trayecto.',
    templo: 4,
    cost: 130,
    duration: 0,
    cooldown: 6,
  },
  egida: {
    name: 'Égida',
    icon: '🛡️',
    description: '+50 % de vida para los defensores de tu isla durante 3 horas.',
    templo: 6,
    cost: 140,
    duration: 3,
    cooldown: 10,
  },
  rayo: {
    name: 'Ira de los dioses',
    icon: '⚡',
    description: 'Un rayo hunde el 40 % de la flota pirata que se acerca.',
    templo: 8,
    cost: 220,
    duration: 0,
    cooldown: 8,
  },
};

export const POWER_KEYS = Object.keys(POWERS);

// ── Misiones (objetivos con recompensa) ──────────────────────────────────────
// goal(game) → [actual, objetivo]. Se muestran en orden, unas pocas a la vez.

const lvl = (id, n) => (g) => [Math.min(g.level(id), n), n];
const res = (id, n) => (g) => [Math.min(g.researchLevel(id), n), n];
const stat = (key, n) => (g) => [Math.min(g.stats[key] ?? 0, n), n];

export const QUESTS = [
  { id: 'q-aserradero', title: 'Más madera', text: 'Mejora el aserradero a nivel 2.', goal: lvl('aserradero', 2), reward: { madera: 150, piedra: 100 } },
  { id: 'q-granja', title: 'Pan para todos', text: 'Construye la granja.', goal: lvl('granja', 1), reward: { comida: 250, madera: 100 } },
  { id: 'q-cantera', title: 'Cimientos', text: 'Mejora la cantera a nivel 2.', goal: lvl('cantera', 2), reward: { piedra: 200 } },
  { id: 'q-almacen', title: 'Un lugar para todo', text: 'Construye el almacén.', goal: lvl('almacen', 1), reward: { madera: 200, piedra: 150 } },
  { id: 'q-ayto2', title: 'Villa en crecimiento', text: 'Mejora el ayuntamiento a nivel 2.', goal: lvl('ayuntamiento', 2), reward: { madera: 300, piedra: 300, comida: 200 } },
  { id: 'q-academia', title: 'Amor al saber', text: 'Construye la academia.', goal: lvl('academia', 1), reward: { madera: 250, piedra: 250 } },
  { id: 'q-silvi', title: 'Primeros sabios', text: 'Investiga Silvicultura.', goal: res('silvicultura', 1), reward: { madera: 400 } },
  { id: 'q-cuartel', title: 'Hombres de armas', text: 'Construye el cuartel.', goal: lvl('cuartel', 1), reward: { comida: 300, madera: 200 } },
  { id: 'q-lanceros', title: 'La primera guardia', text: 'Ten 10 milicianos con lanza en tu ejército.', goal: (g) => [Math.min(g.armyCount('lancero'), 10), 10], reward: { comida: 300, madera: 300 } },
  { id: 'q-puerto', title: 'Rumbo al mar', text: 'Construye el puerto.', goal: lvl('puerto', 1), reward: { madera: 400, piedra: 200 } },
  { id: 'q-explora', title: 'Tierra a la vista', text: 'Explora una isla del archipiélago.', goal: (g) => [Math.min(g.exploredCount(), 1), 1], reward: { madera: 300, comida: 300 } },
  { id: 'q-fundicion', title: 'Edad del bronce', text: 'Construye la fundición.', goal: lvl('fundicion', 1), reward: { piedra: 400, comida: 200 } },
  { id: 'q-ayto3', title: 'Ciudad', text: 'Mejora el ayuntamiento a nivel 3. ¡Cuidado con los piratas!', goal: lvl('ayuntamiento', 3), reward: { madera: 600, piedra: 600, hierro: 200 } },
  { id: 'q-muralla', title: 'Puertas cerradas', text: 'Construye la muralla.', goal: lvl('muralla', 1), reward: { piedra: 600 } },
  { id: 'q-saqueo', title: 'Botín bárbaro', text: 'Gana un ataque contra una isla enemiga.', goal: stat('victories', 1), reward: { hierro: 300, oro: 100 } },
  { id: 'q-mercado', title: 'Comerciantes', text: 'Construye el mercado.', goal: lvl('mercado', 1), reward: { oro: 200, cristal: 150 } },
  { id: 'q-defensa', title: 'Ni un paso atrás', text: 'Rechaza un asalto pirata.', goal: stat('raidsRepelled', 1), reward: { oro: 300, hierro: 300 } },
  { id: 'q-templo', title: 'Favor divino', text: 'Construye el templo.', goal: lvl('templo', 1), reward: { cristal: 300, oro: 150 } },
  { id: 'q-poder', title: 'Los dioses escuchan', text: 'Invoca un poder divino.', goal: stat('powers', 1), reward: { favor: 30 } },
  { id: 'q-tesoro', title: 'Cazatesoros', text: 'Encuentra el tesoro de unas ruinas.', goal: stat('treasures', 1), reward: { oro: 300 } },
  { id: 'q-cartografia', title: 'Cartas náuticas', text: 'Investiga Cartografía.', goal: res('cartografia', 1), reward: { madera: 800, comida: 800 } },
  { id: 'q-colonia', title: 'Nuevo mundo', text: 'Funda tu primera colonia.', goal: (g) => [Math.min(g.colonies().length, 1), 1], reward: { oro: 500, cristal: 400 } },
  { id: 'q-expedicion', title: 'Más allá de la niebla', text: 'Vuelve de una expedición al Mar de las Brumas.', goal: stat('expeditions', 1), reward: { hierro: 600, oro: 300 } },
  { id: 'q-ejercito', title: 'Gran ejército', text: 'Ten 100 tropas de tierra.', goal: (g) => [Math.min(g.landArmy(), 100), 100], reward: { comida: 2000, hierro: 800 } },
  { id: 'q-saqueos', title: 'Terror de los mares', text: 'Gana 10 ataques.', goal: stat('victories', 10), reward: { oro: 1500, cristal: 1000 } },
  { id: 'q-ayto8', title: 'Capital del archipiélago', text: 'Mejora el ayuntamiento a nivel 8.', goal: lvl('ayuntamiento', 8), reward: { madera: 5000, piedra: 5000, oro: 1000 } },
  { id: 'q-taberna', title: 'Una ronda para todos', text: 'Construye la taberna.', goal: lvl('taberna', 1), reward: { comida: 600, oro: 150 } },
  { id: 'q-astillero', title: 'Carpinteros de ribera', text: 'Construye el astillero.', goal: lvl('astillero', 1), reward: { madera: 800, hierro: 200 } },
  { id: 'q-faro', title: 'Una luz en la noche', text: 'Construye el faro.', goal: lvl('faro', 1), reward: { piedra: 800, cristal: 200 } },
  { id: 'q-conquista', title: 'Señor del continente', text: 'Conquista una ciudad bárbara de un continente.', goal: stat('conquests', 1), reward: { oro: 3000, hierro: 2000 } },
  { id: 'q-maravilla', title: 'Obra de todos', text: 'Aporta 2.000 recursos a la maravilla de un continente.', goal: stat('donated', 2000), reward: { cristal: 1500, oro: 800 } },
  // Solo hay un Kraken para todos: basta con vencer en una de sus fosas (o haberlo derrotado ya)
  { id: 'q-kraken', title: 'Señor de la fosa', text: 'Gana un ataque contra una fosa del Kraken.', goal: (g) => [Math.min(1, (g.stats.lairs ?? 0) + (g.stats.kraken ?? 0)), 1], reward: { oro: 5000, cristal: 5000 } },
  { id: 'q-coloso1', title: 'Primera piedra', text: 'Empieza el Coloso (nivel 1).', goal: lvl('coloso', 1), reward: { oro: 2000, hierro: 2000 } },
  { id: 'q-coloso', title: 'Coloso de oro', text: 'Lleva el Coloso a nivel 10.', goal: lvl('coloso', 10), reward: { oro: 20000 } },
];

// ── Visitantes que llegan a la isla de vez en cuando ─────────────────────────

// ── Recompensa diaria ────────────────────────────────────────────────────────
// Un regalo por día seguido que entras (el séptimo es el mejor). Se multiplica
// por el nivel del ayuntamiento para que siga valiendo la pena.

export const DAILY_REWARDS = [
  { madera: 200, piedra: 150 },
  { comida: 300, madera: 150 },
  { piedra: 250, hierro: 80 },
  { cristal: 120, comida: 200 },
  { hierro: 150, oro: 60 },
  { cristal: 200, oro: 100 },
  { oro: 250, cristal: 250, favor: 20 },
];

// ── Logros ───────────────────────────────────────────────────────────────────
// Se ganan solos al cumplirse y se enseñan en el perfil del jugador.

// ── Invasiones bárbaras ──────────────────────────────────────────────────────
// De vez en cuando una horda desembarca en un continente con colonias. Si nadie
// la derrota antes de `warnHours`, saquea las colonias de ese continente.

export const HORDE = {
  warnHours: 12,
  firstHours: [12, 36],
  gapHours: [48, 96],
  ravageHours: 24,
  garrison: { barbaro: 140, arquero: 60 },
  perColonist: 0.6,
  reward: { oro: 2500, cristal: 1500, hierro: 1500 },
};

// ── Mercenarios (taberna) ────────────────────────────────────────────────────
// Tropas de alquiler durante un día. Al subir la taberna llegan compañías mejores
// (`taberna`: el nivel que hace falta): al principio solo milicianos, al final
// tropas de élite. Cada una trae `base` soldados y `per` más por cada nivel de
// taberna por encima del suyo, y se puede contratar una vez al día.

export const MERCENARIES = {
  lanceros: { name: 'Milicia de lanceros', icon: '🪖', unit: 'lancero', taberna: 1, base: 15, per: 5, price: { oro: 5, comida: 4 } },
  honderos: { name: 'Banda de honderos milicianos', icon: '🪨', unit: 'hondero', taberna: 1, base: 15, per: 5, price: { oro: 6, comida: 4 } },
  arqueros: { name: 'Arqueros de fortuna', icon: '🏹', unit: 'arquero', taberna: 3, base: 12, per: 4, price: { oro: 9, madera: 6 } },
  hoplitas: { name: 'Compañía de hoplitas', icon: '🛡️', unit: 'hoplita', taberna: 5, base: 12, per: 2.5, price: { oro: 20, hierro: 6 } },
  jinetes: { name: 'Jinetes de Tesalia', icon: '🐎', unit: 'caballero', taberna: 7, base: 8, per: 1.2, price: { oro: 45, comida: 20 } },
  espartanos: { name: 'Espartanos desterrados', icon: '🗡️', unit: 'espartano', taberna: 9, base: 5, per: 1, price: { oro: 70, hierro: 25 } },
  cretenses: { name: 'Arqueros de Creta', icon: '🎯', unit: 'sagitario', taberna: 9, base: 5, per: 1, price: { oro: 60, madera: 25 } },
  catafractos: { name: 'Catafractos de Partia', icon: '🏇', unit: 'catafracto', taberna: 12, base: 4, per: 0.8, price: { oro: 140, hierro: 40 } },
};
export const MERCENARY_HOURS = 24;

// ── Estandarte ───────────────────────────────────────────────────────────────
// Cada jugador elige el color de sus banderas y un emblema que le identifica.

export const BANNER_COLORS = ['#d94f4f', '#4f8fd9', '#e3b23c', '#6bbf59', '#8a5ab8', '#d9734f', '#3fb6b6', '#c94f8a', '#f4efe6', '#2b2620'];
export const BANNER_EMBLEMS = ['🦅', '🐂', '🦁', '🐬', '🔱', '⚓', '🌞', '🌙', '⭐', '🗡️', '🐍', '🦉'];

// ── Reliquias ────────────────────────────────────────────────────────────────
// Tres grupos: las básicas (muy poca ventaja) aparecen a veces en ruinas,
// conquistas, hordas y expediciones; las épicas, solo al vencer al Kraken; y las
// legendarias, solo en las gestas, donde los juramentados se las disputan. Se
// equipan hasta RELIC_SLOTS a la vez; las que sobran se venden por oro.

export const RELICS = {
  espada: { name: 'Espada de Jasón', icon: '🗡️', rarity: 'basica', stat: 'ataque', value: 0.02, text: '+2 % de ataque de tus tropas' },
  escudo: { name: 'Escudo de Aquiles', icon: '🛡️', rarity: 'basica', stat: 'defensa', value: 0.03, text: '+3 % de vida de tus tropas' },
  tridente: { name: 'Tridente de bronce', icon: '🔱', rarity: 'basica', stat: 'velocidad', value: 0.03, text: 'Flotas un 3 % más rápidas' },
  ancla: { name: 'Ancla de Poseidón', icon: '⚓', rarity: 'basica', stat: 'botin', value: 0.05, text: '+5 % de carga en tus barcos' },
  cuerno: { name: 'Cuerno de la abundancia', icon: '📯', rarity: 'basica', stat: 'comida', value: 0.04, text: '+4 % de comida' },
  lira: { name: 'Lira de Orfeo', icon: '🎶', rarity: 'basica', stat: 'favor', value: 0.05, text: '+5 % de favor de los dioses' },
  // Del Kraken
  hoz: { name: 'Hoz de Cronos', icon: '🌙', rarity: 'epica', stat: 'produccion', value: 0.03, text: '+3 % de toda la producción' },
  yelmo: { name: 'Yelmo de Hades', icon: '⛑️', rarity: 'epica', stat: 'sigilo', value: 0.3, text: 'Tus espías se dejan ver un 30 % menos' },
  colmillo: { name: 'Colmillo del Kraken', icon: '🦷', rarity: 'epica', stat: 'ataque', value: 0.05, text: '+5 % de ataque de tus tropas' },
  perla: { name: 'Perla del abismo', icon: '🦪', rarity: 'epica', stat: 'oro', value: 0.08, text: '+8 % de oro' },
  ojo: { name: 'Ojo del Kraken', icon: '👁️', rarity: 'epica', stat: 'velocidad', value: 0.06, text: 'Flotas un 6 % más rápidas' },
  // De las gestas: primero las de su tema (`source`, no salen en ningún otro sitio) y luego las demás
  mascara: { name: 'Máscara del Minotauro', icon: '🐂', rarity: 'legendaria', stat: 'ataque', value: 0.12, text: '+12 % de ataque de tus tropas' },
  vellocino: { name: 'Vellocino de oro', icon: '🐏', rarity: 'legendaria', stat: 'oro', value: 0.3, text: '+30 % de oro' },
  rayozeus: { name: 'Rayo de Zeus', icon: '⚡', rarity: 'legendaria', stat: 'ataque', value: 0.1, text: '+10 % de ataque de tus tropas', source: 'tifon' },
  escama: { name: 'Escama de Tifón', icon: '🐉', rarity: 'legendaria', stat: 'defensa', value: 0.12, text: '+12 % de vida de tus tropas', source: 'tifon' },
  tiara: { name: 'Tiara del Gran Rey', icon: '👑', rarity: 'legendaria', stat: 'botin', value: 0.3, text: '+30 % de botín', source: 'armada' },
  remo: { name: 'Remo de Temístocles', icon: '🚣', rarity: 'legendaria', stat: 'velocidad', value: 0.15, text: '+15 % de velocidad de tus flotas', source: 'armada' },
  nemea: { name: 'Piel del león de Nemea', icon: '🦁', rarity: 'legendaria', stat: 'defensa', value: 0.15, text: '+15 % de vida de tus tropas', source: 'hidra' },
};
export const RELIC_SLOTS = 3;
export const RELIC_RARITY = {
  basica: { name: 'Básica', color: '#9fb3c8', sell: 600 },
  epica: { name: 'Épica', color: '#b07ad9', sell: 2500 },
  legendaria: { name: 'Legendaria', color: '#f2c94c', sell: 10000 },
};
/** Probabilidad de una reliquia básica en ruinas, conquistas, hordas y expediciones. */
export const BASIC_RELIC_CHANCE = 0.2;

// ── El Kraken ────────────────────────────────────────────────────────────────
// Solo hay uno en todos los mares. Cuando cae, tarda `regenHours` en recuperarse
// (nadie lo sabe) y despierta en un momento cualquiera de las `windowHours`
// siguientes, en una de las fosas que no estén arrasadas. Se avisa en el chat con
// unas coordenadas aproximadas (a `hintCells` casillas como mucho).
export const KRAKEN_RULES = { regenHours: 36, windowHours: 2, relicChance: 0.55, hintCells: 2 };

// ── Encargos diarios ─────────────────────────────────────────────────────────
// Cada día tocan tres, elegidos entre los que puedes hacer. Las cifras crecen
// con el ayuntamiento; cuenta lo que hagas desde que empieza el día.

export const DAILY_TASKS = {
  obras: { icon: '🔨', text: (n) => `Invierte ${fmtEs(n)} recursos en obras o investigaciones`, stat: 'spent', need: (t) => 400 * t },
  mejoras: { icon: '🏗️', text: (n) => `Termina ${n} ${n === 1 ? 'mejora' : 'mejoras'} de edificios`, stat: 'upgrades', need: (t) => (t < 4 ? 2 : 3) },
  sabios: { icon: '📚', text: () => 'Termina una investigación', stat: 'researched', need: () => 1, requires: { academia: 1 } },
  tropas: { icon: '🛡️', text: (n) => `Entrena ${n} unidades`, stat: 'trained', need: (t) => 5 + 3 * t, requires: { cuartel: 1 } },
  saqueo: { icon: '💰', text: (n) => `Saquea ${fmtEs(n)} recursos`, stat: 'loot', need: (t) => 250 * t, requires: { puerto: 1 } },
  combate: { icon: '⚔️', text: (n) => `Abate a ${n} enemigos`, stat: 'kills', need: (t) => 8 + 4 * t, requires: { puerto: 1, cuartel: 1 } },
  explorar: { icon: '🔭', text: (n) => `Explora o espía ${n} ${n === 1 ? 'isla' : 'islas'}`, stat: 'explorations', need: (t) => 1 + Math.floor(t / 3), requires: { puerto: 1 } },
  mercado: { icon: '⚖️', text: (n) => `Haz ${n} cambios en el mercado`, stat: 'exchanges', need: () => 2, requires: { mercado: 1 } },
  favor: { icon: '🙏', text: () => 'Invoca un poder divino', stat: 'powers', need: () => 1, requires: { templo: 1 } },
  transporte: { icon: '📦', text: () => 'Manda un transporte a otro jugador', stat: 'transports', need: () => 1, requires: { puerto: 1 } },
};
export const DAILY_TASK_REWARD = { madera: 250, piedra: 250, comida: 200, oro: 60 };
export const DAILY_TASK_BONUS = { cristal: 300, oro: 200, favor: 15 };

// ── Competición semanal ──────────────────────────────────────────────────────
// Cada semana se premia a los tres mejores de cada categoría por lo que han
// hecho esa semana (no por lo acumulado).

export const CONTEST_DAYS = 7;
export const CONTEST_CATEGORIES = {
  saqueo: { name: 'Saqueo', icon: '💰', stat: 'loot', unit: 'recursos saqueados' },
  militar: { name: 'Militar', icon: '⚔️', stat: 'kills', unit: 'enemigos abatidos' },
  constructor: { name: 'Constructor', icon: '🏗️', stat: 'spent', unit: 'recursos invertidos' },
};
export const CONTEST_PRIZES = [
  { oro: 4000, cristal: 2500, hierro: 2500 },
  { oro: 2400, cristal: 1500, hierro: 1500 },
  { oro: 1400, cristal: 900, hierro: 900 },
];

export const ACHIEVEMENTS = [
  // Para quien llega al archipiélago en su primer mes (la fecha la marca el servidor)
  { id: 'fundador', icon: '🌅', name: 'Fundador', text: 'Llegó al archipiélago en su primer mes', check: (g) => !!g.state.founder },
  { id: 'saqueador', icon: '⚔️', name: 'Saqueador', text: 'Gana 10 ataques', check: (g) => g.stats.victories >= 10 },
  { id: 'campeon', icon: '🏅', name: 'Campeón de la semana', text: 'Gana una categoría de la competición semanal', check: (g) => (g.stats.contestWins ?? 0) >= 1 },
  { id: 'conquistador', icon: '👑', name: 'Conquistador', text: 'Gana 50 ataques', check: (g) => g.stats.victories >= 50 },
  { id: 'azote', icon: '🗡️', name: 'Azote de reyes', text: 'Saquea 5 ciudades de otros jugadores', check: (g) => g.stats.pvpWins >= 5 },
  { id: 'muralla', icon: '🏰', name: 'Inexpugnable', text: 'Rechaza 5 asaltos', check: (g) => g.stats.raidsRepelled >= 5 },
  { id: 'explorador', icon: '🔭', name: 'Explorador', text: 'Explora 10 islas', check: (g) => g.exploredCount() >= 10 },
  { id: 'navegante', icon: '🧭', name: 'Lobo de mar', text: 'Completa 10 expediciones', check: (g) => g.stats.expeditions >= 10 },
  { id: 'colono', icon: '🚩', name: 'Fundador', text: 'Ten 3 colonias', check: (g) => g.colonies().length >= 3 },
  { id: 'tesoros', icon: '🏺', name: 'Cazatesoros', text: 'Encuentra 2 tesoros', check: (g) => g.stats.treasures >= 2 },
  { id: 'mercader', icon: '⚖️', name: 'Mercader', text: 'Cierra 10 tratos en el mercado', check: (g) => (g.stats.trades ?? 0) >= 10 },
  { id: 'generoso', icon: '📦', name: 'Buen vecino', text: 'Entrega 10 transportes', check: (g) => (g.stats.transports ?? 0) >= 10 },
  { id: 'devoto', icon: '🛕', name: 'Devoto', text: 'Invoca 20 poderes divinos', check: (g) => g.stats.powers >= 20 },
  { id: 'constante', icon: '📅', name: 'Constante', text: 'Entra 7 días seguidos', check: (g) => (g.state.daily?.best ?? 0) >= 7 },
  { id: 'imperio', icon: '🏛️', name: 'Imperio', text: 'Llega a 10.000 puntos', check: (g) => g.score() >= 10000 },
  { id: 'kraken', icon: '🐙', name: 'Matador del Kraken', text: 'Derrota al Kraken', check: (g) => g.stats.kraken >= 1 },
  { id: 'leyenda', icon: '🗽', name: 'Coloso de oro', text: 'Lleva el Coloso a nivel 10', check: (g) => g.level('coloso') >= 10 },
  { id: 'titanes', icon: '🌋', name: 'Matador de titanes', text: 'Vence en una gesta', check: (g) => (g.stats.feats ?? 0) >= 1 },
  { id: 'liga', icon: '🏛️', name: 'Héroe de la Liga', text: 'Vence en 5 gestas', check: (g) => (g.stats.feats ?? 0) >= 5 },
  { id: 'azotegesta', icon: '⚡', name: 'Azote de Tifón', text: 'Sé quien más gloria gana en una gesta', check: (g) => (g.stats.featTop ?? 0) >= 1 },
  { id: 'corazon', icon: '🦁', name: 'Corazón de león', text: 'Sé quien más se esfuerza en una gesta', check: (g) => (g.stats.featHeart ?? 0) >= 1 },
  { id: 'navarco', icon: '⚓', name: 'Navarco', text: 'Sostén más que nadie un fondeadero contra la Armada del Gran Rey', check: (g) => (g.stats.featNavarch ?? 0) >= 1 },
  { id: 'heracles', icon: '🏺', name: 'Heracles', text: 'Vence a la Hidra de Lerna', check: (g) => (g.stats.featHydra ?? 0) >= 1 },
];

// ── Almirante (héroe) ────────────────────────────────────────────────────────
// Acompaña a una flota o se queda defendiendo la isla. Gana experiencia en
// cada combate y, con cada nivel, un punto para una de sus cuatro habilidades.

export const HERO = {
  cost: { oro: 600, comida: 400 },
  requires: { ayuntamiento: 3 },
  maxLevel: 30,
  /** Experiencia total para llegar a `level`. */
  xpFor: (level) => Math.round(80 * (level - 1) ** 1.6),
  woundHours: 2,
};

export const HERO_SKILLS = {
  ataque: { name: 'Ataque', icon: '⚔️', text: (n) => `+${n * 3} % de ataque de la flota que acompaña`, per: 0.03 },
  defensa: { name: 'Defensa', icon: '🛡️', text: (n) => `+${n * 3} % de vida de los defensores mientras esté en casa`, per: 0.03 },
  botin: { name: 'Botín', icon: '💰', text: (n) => `+${n * 5} % de carga de la flota que acompaña`, per: 0.05 },
  velocidad: { name: 'Navegación', icon: '💨', text: (n) => `Su flota navega un ${n * 4} % más rápido`, per: 0.04 },
};

// ── Diplomacia entre alianzas ───────────────────────────────────────────────
// Un pacto de no agresión impide atacarse; en guerra los barcos cargan más botín.

export const DIPLOMACY = {
  warLoot: 0.2,
};

// ── Eventos del archipiélago ────────────────────────────────────────────────
// Cada `WORLD_EVENT_HOURS` horas puede empezar una temporada para todos los
// jugadores. El calendario sale de una semilla, así que el servidor y el
// navegador saben siempre cuál toca sin decirse nada.

export const WORLD_EVENT_HOURS = 6;
export const WORLD_EVENT_CHANCE = 0.7;

export const WORLD_EVENTS = {
  oro: { name: 'Fiebre del oro', icon: '💰', text: '+40 % de oro en todas las islas.', prod: { oro: 0.4 } },
  cosecha: { name: 'Año de buenas cosechas', icon: '🌾', text: '+40 % de comida en todas las islas.', prod: { comida: 0.4 } },
  tala: { name: 'Temporada de tala', icon: '🪵', text: '+35 % de madera en todas las islas.', prod: { madera: 0.35 } },
  vetas: { name: 'Vetas nuevas', icon: '⛏️', text: '+30 % de piedra y de bronce.', prod: { piedra: 0.3, hierro: 0.3 } },
  estrellas: { name: 'Lluvia de estrellas', icon: '💎', text: '+40 % de cristal en todas las islas.', prod: { cristal: 0.4 } },
  festival: { name: 'Festival de Poseidón', icon: '🔱', text: 'Los templos dan el doble de favor.', favor: 2 },
  feria: { name: 'Gran feria del archipiélago', icon: '⚖️', text: 'El mercado cambia un 15 % mejor.', trade: 0.15 },
  bonanza: { name: 'Vientos de bonanza', icon: '⛵', text: '+15 % de todos los recursos.', prod: { madera: 0.15, piedra: 0.15, comida: 0.15, hierro: 0.15, cristal: 0.15, oro: 0.15 } },
};

// ── Maravillas de los continentes ───────────────────────────────────────────
// Cada continente tiene una. La construyen entre todos los que tienen colonia
// allí, y todos ellos reciben su efecto en todo su imperio.

export const WONDERS = {
  poseidon: { name: 'Templo de Poseidón', icon: '🔱', stat: 'velocidad', per: 0.05, text: (l) => `Flotas un ${l * 5} % más rápidas` },
  hefesto: { name: 'Forja de Hefesto', icon: '⚒️', stat: 'ataque', per: 0.04, text: (l) => `+${l * 4} % de ataque de tus tropas` },
  demeter: { name: 'Jardines de Deméter', icon: '🌾', stat: 'comida', per: 0.08, text: (l) => `+${l * 8} % de comida` },
  atenea: { name: 'Biblioteca de Atenea', icon: '🦉', stat: 'investigacion', per: 0.08, text: (l) => `Investigaciones un ${l * 8} % más rápidas` },
};
export const WONDER_KEYS = Object.keys(WONDERS);
/** Recursos aportados (en total) para llegar a cada nivel. */
export const WONDER_LEVELS = [6000, 18000, 45000, 100000, 200000];
export const WONDER_RESOURCES = ['madera', 'piedra', 'cristal'];

// ── Modo vacaciones ─────────────────────────────────────────────────────────
// Tu isla descansa: no produce, no come, no llegan piratas ni visitantes y
// nadie te puede atacar ni espiar. Dura al menos `minHours`.

// ── Trabajadores ─────────────────────────────────────────────────────────────
// En los edificios que producen (salvo el mercado) se elige qué parte de los
// trabajadores produce; los demás comercian y pagan impuestos en oro: la mitad
// de lo que valdría lo que dejan de producir.
export const WORK = { step: 10, taxShare: 0.5 };

export const VACATION = {
  minHours: 48,
  cooldownHours: 24,
};

export const VISITORS = {
  mercader: { name: 'Mercader ambulante', icon: '🧳' },
  mercenarios: { name: 'Mercenarios', icon: '🗡️' },
  peregrinos: { name: 'Peregrinos', icon: '🕯️' },
  naufragio: { name: 'Restos de un naufragio', icon: '🛟' },
};

// ── Gestas de la Liga ────────────────────────────────────────────────────────
// Eventos cooperativos puntuales (src/game/feats.js y WorldServer.#updateFeats).
// Cada `periodDays` días aparece un enemigo mítico junto a un continente; los
// imperios cercanos son convocados y pueden jurar combatirlo. Durante la lucha se
// le ataca en oleadas fijas cada `waveHours` horas: las flotas que esperan allí
// combaten juntas, y solo hacen daño si son varias (la coraza, `coop`).
// Las horas son de juego (se dividen por la velocidad del universo).

export const FEATS = {
  periodDays: 12,
  offsetHours: 48, // el ciclo empieza desplazado entre 0 y esto
  omenHours: 24, // presagios: convocatoria y juramento
  hours: 48, // lucha
  waveHours: 3,
  pledgeCloseHours: 12, // ya en la lucha, hasta cuándo se puede jurar
  perjuryHours: 24, // si a esta hora de la lucha no has combatido, eres perjuro
  truceAfterHours: 6, // la tregua entre juramentados dura lo que la lucha y esto más
  radius: 900, // leguas desde tu capital al continente para ser convocado
  radiusMax: 1300, // segunda pasada si no hay bastantes
  minConvoked: 4,
  maxConvoked: 16,
  minPledges: 3,
  minEffective: 2.5, // «imperios efectivos» del juramento para que el enemigo emerja
  minPoints: 300,
  minDays: 5, // días de juego (fotos de la historia) para que te convoquen
  seenHours: 48, // visto hace como mucho esto
  // Coraza: daño que hace la oleada según los imperios efectivos que combaten (se interpola)
  coop: [
    [1.5, 0],
    [2, 0.4],
    [3, 0.75],
    [4, 1],
  ],
  regrow: 0.05, // lo que recupera el enemigo de la fase en una oleada sin combate
  tierStep: 0.15, // dificultad por nivel del sitio
  rewardStep: 0.1, // premio por nivel del sitio
  tiers: [-2, 6],
  reward: {
    hours: [3, 5, 7], // botín personal en horas de tu producción: bronce, plata, oro
    effort: [0.25, 0.6, 1], // esfuerzo (fuerza traída / tu fuerza al jurar) para cada tramo
    minGlory: 0.005, // parte mínima de la gloria para cobrar
    pot: 3, // bote común: horas de la producción de todos los juramentados
    potCap: 0.4, // como mucho esta parte del bote para uno
    riskCap: 3, // el botín personal no pasa de esto por lo que arriesgaste
    wounded: [0.25, 0.1], // bajas que vuelven heridas: al ganar y al perder
    duelWounded: 0.25, // bajas de la disputa por la reliquia que vuelven heridas
    blessing: 0.1, // +10 % de producción (plata y oro)
    blessingHours: 24,
    half: 0.4, // victoria a medias si al enemigo le queda esto o menos de vida
    heartMinGlory: 0.015, // para «Corazón de león» hace falta esta parte de la gloria
    topBonus: 1.25, // botín del que más gloria gana
    phasePot: [0.1, 0.15], // parte del bote que se gana al vencer cada fase (si al final se pierde)
    offer: [1, 2], // horas de tu producción ofrendadas en la fragua para Bronce y Plata (Oro solo combatiendo)
  },
  perjury: { ash: 0.1, hours: 24, days: 14 },
  // La fragua de Hefesto: el papel económico. Se ofrendan recursos y el enemigo se debilita
  forge: {
    hours: 2, // meta: horas de la producción de todos los juramentados (con el tope «el resto»)
    capShare: 0.45, // nadie llena más que esto de la meta
    capHours: 3, // ni más de estas horas de su propia producción
    resources: ['madera', 'hierro', 'cristal'],
    step: 0.25, // cada cuarto de la meta…
    atk: 0.025, // …da +2,5 % de ataque a todas las oleadas
    lava: 0.25, // …y quita un 25 % de la lava
    glory: 150, // gloria de toda la fragua (la del combate ronda los 1.000)
  },
};

/** Temas de gesta: el enemigo, sus fases y lo que da. */
export const FEAT_THEMES = {
  tifon: {
    name: 'El despertar de Tifón',
    enemy: 'Tifón',
    icon: '🌋',
    text: 'Tifón, padre de los monstruos, rompe sus cadenas bajo el mar. Ningún imperio puede vencerlo solo.',
    phases: [
      { unit: 'sierpe', name: 'El mar hierve', text: 'Sierpes marinas: solo cuentan los barcos de guerra. Si ganáis el mar, desembarcáis en la misma oleada.', glory: 200 },
      { unit: 'gigante', name: 'Los hijos de Gea', text: 'Gigantes en tierra: tropas de tierra con el apoyo de los barcos.', glory: 300 },
      { unit: 'cabeza', name: 'Las cien cabezas', text: 'Cien cabezas que no se curan. Cuando quedan la mitad, entran en furia.', glory: 500 },
    ],
    // Cuántos hijos echa según el poder jurado (ver featBoss)
    tune: { sierpes: 2.2, gigantes: 2.0, headHp: 6, headAtk: 0.045, heads: 100, furyAt: 50, fury: 1.3, lava: 0.015 },
    relics: ['rayozeus', 'escama'],
    emblem: '⚡', // emblema del estandarte para quien llega al tramo Oro en una victoria
  },
  armada: {
    kind: 'armada',
    name: 'La Armada del Gran Rey',
    enemy: 'Jerjes',
    icon: '👑',
    text: 'La flota persa fondea frente al continente. Cerrad sus fondeaderos y asaltad el campamento mientras pasa hambre.',
    phases: [
      { unit: 'fenicia', name: 'Los fondeaderos', text: 'Una escuadra fenicia guarda cada fondeadero (uno frente a cada asentamiento). Tómalo con la misión Bloquear y solo barcos de guerra; tu flota se queda allí aguantando sus salidas. Otros pueden ir de escolta al mismo fondeadero.', glory: 0 },
      { unit: 'inmortal', name: 'El campamento', text: 'Inmortales y arqueros tras una empalizada. Se asalta con la misión Atacar, con la coraza. Mientras quede algún fondeadero libre se rehace; con el cerco completo no y pasa hambre.', glory: 650 },
    ],
    // Escuadras, salidas, campamento, cerco y hambre (ver featBoss y WorldServer.#waveArmada)
    tune: { squad: 0.6, sortie: 0.25, sortieStep: 0.1, regenWaves: 2, camp: 4, campAtk: 0.04, siegeHp: 0.35, hunger: 0.15, hungerMax: 0.45, wall: 0.5, towers: 0.1, postGlory: 25, takeGlory: 15, satrapyHours: 48, navarch: 1.25 },
    relics: ['tiara', 'remo'],
    emblem: '👑',
  },
  hidra: {
    kind: 'hidra',
    name: 'La Hidra de Lerna',
    enemy: 'la Hidra',
    icon: '🐉',
    text: 'En los pantanos del continente despierta la Hidra: cada cabeza que no se cauteriza vuelve como dos.',
    phases: [{ unit: 'hidra', name: 'Las cabezas de la Hidra', text: 'Solo en tierra. Cada cabeza cortada y no cauterizada con la brea de la fragua vuelve como dos. La última, la inmortal, solo cae cauterizada y con al menos 3 imperios efectivos en la oleada.', glory: 1000 }],
    // Cabezas, vida, daño y brea por cabeza (horas de la producción de todos repartidas entre 9)
    tune: { heads: 9, maxHeads: 27, life: 6, atk: 0.005, brea: 1.5, breaHeads: 12, finalCoop: 0.75 },
    forge: 'brea', // la fragua no da ataque: hace la brea para cauterizar
    relics: ['nemea'],
    emblem: '🏺',
  },
};
