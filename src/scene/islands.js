import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, amphora, box, colonnade, column, createShip, createSoldier, cyl, cypress, dome, figure, gableRoof, greekKey, hipRoof, makeFire, mat, mediterraneanTree, mesh, palmTree, smokeColumn, stylobate, WINDOW_GLOW } from './models.js';
import { wonderLevel, wonderOf } from '../game/rules.js';
import { FEAT_THEMES } from '../game/data.js';
import { Batch, bakeStatic, cloudGeometry, cloudMaterial, hashString, mountainGeometry, paintByNormal, plateauGeometry, polar, rng } from './util.js';
import { coastFactor, coastMax, islandCoast, shapeGeometry } from './coast.js';

// Islas del archipiélago. La base (relieve, playa, árboles) no cambia; lo que hay
// encima depende de lo que sepas de ella (niebla, campamento, colonia…).

export const ISLAND_TOP = 0.3;
const WATER_Y = -0.7;
// Lo que hay encima de cada isla se construye a menor tamaño y luego se escala
const FEATURE_SCALE = 1.4;
const SEA = (WATER_Y - ISLAND_TOP) / FEATURE_SCALE; // nivel del mar en coordenadas del grupo

const PALETTES = {
  default: { grass: '#86ab4e', cliff: '#a17f55', rock: '#8c8070' },
  piratas: { grass: '#5d8f3e', cliff: '#6e5a44', rock: '#5f5a52' },
  ruinas: { grass: '#9bb05a', cliff: '#9a8160', rock: '#857b6b' },
  kraken: { grass: '#4b5a4a', cliff: '#3f3a40', rock: '#2f2c33' },
};

/**
 * Radio medio de una isla del mapa (la forma real la da su costa, coast.js). `grow` es lo que
 * la escena la deja crecer según el sitio que hay hasta sus vecinas.
 */
export function islandRadius(isl) {
  // Las ciudades de los jugadores son tan grandes como tu propia isla
  return isl.size * (isl.type === 'jugador' ? 3.25 : 2.4) * (isl.grow ?? 1);
}

/** Radio de la línea de costa (donde la arena corta el agua), para la espuma. */
export function shoreRadius(isl) {
  // (la fosa, con su golfo, se pone su propia espuma: la del agua solo sabe de costas redondeadas)
  if (isl.type === 'brumas' || isl.type === 'kraken' || isl.land) return 0;
  const R = islandRadius(isl);
  if (isl.type === 'jugador') return R + 2.7;
  if (isl.type === 'continente') return R * 1.08;
  return R * 1.19;
}

/** Lo que ocupa una isla en el mar como mucho (playa y salientes incluidos), para no pisar a otras. */
export function islandExtent(isl) {
  if (isl.type === 'brumas' || isl.land) return 0;
  const R = islandRadius(isl);
  const f = coastMax(islandCoast(isl));
  if (isl.type === 'jugador') return (R + 4.6) * f;
  if (isl.type === 'continente') return R * 1.12 * f;
  return R * 1.34 * f;
}

export function createIslandBase(isl) {
  const R = islandRadius(isl);
  const seed = hashString(isl.id);
  const rand = rng(seed);
  if (isl.type === 'brumas') return bakeStatic(seaStacks(R, rand));
  if (isl.land) return siteBase(isl, R, rand);
  if (isl.type === 'continente') return bakeStatic(continentBase(isl, R, rand, seed));
  if (isl.type === 'kraken') return bakeStatic(gulfBase(isl, R, rand, seed));
  const pal = PALETTES[isl.type] ?? PALETTES.default;
  const g = new THREE.Group();
  // Costa irregular: salientes, bahías y cabos (la misma forma que la espuma del agua)
  const h = islandCoast(isl);
  const at = (deg) => coastFactor(h, THREE.MathUtils.degToRad(deg));
  const city = isl.type === 'jugador';

  const geo = shapeGeometry(plateauGeometry(R, city ? R - 1.6 : R * 0.86, 1.9, 56, seed % 1000, ISLAND_TOP), h);
  paintByNormal(geo, (ny, cy) => (ny > 0.7 ? pal.grass : cy > -0.6 ? pal.cliff : pal.rock));
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  land.receiveShadow = true;
  g.add(land);

  const sandGeo = shapeGeometry(new THREE.CylinderGeometry(city ? R + 2.5 : R * 1.16, city ? R + 4.2 : R * 1.32, 1.3, 56).toNonIndexed(), h);
  const sand = new THREE.Mesh(sandGeo, mat(isl.type === 'kraken' ? '#6b6470' : '#e8d49a'));
  sand.position.y = -0.45 - 0.65;
  g.add(sand);

  // Uno o dos montes en un lado de la isla
  const hills = [];
  if (isl.type !== 'ruinas') {
    const a = rand() * 360;
    hills.push({ p: polar(R * 0.62 * at(a), a, ISLAND_TOP - 0.05), r: R * 0.42 });
    g.userData.hillAngle = a;
    const b = a + 40 + rand() * 30;
    if (R > 15 && isl.type !== 'kraken') hills.push({ p: polar(R * 0.66 * at(b), b, ISLAND_TOP - 0.05), r: R * 0.26 });
    hills.forEach((h, i) => {
      const hill = new THREE.Mesh(
        mountainGeometry(i ? R * 0.24 : R * 0.38, R * (isl.type === 'kraken' ? 0.75 : i ? 0.32 : 0.5), (seed + i * 31) % 97, {
          snow: isl.type === 'kraken' ? '#2a2630' : '#e9ecef',
          grass: pal.grass,
          rock: pal.rock,
        }),
        new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
      );
      hill.position.copy(h.p);
      hill.castShadow = hill.receiveShadow = true;
      g.add(hill);
    });
  }

  // Árboles, arbustos y rocas por el borde (el centro queda libre para lo que haya encima)
  const decor = new Batch();
  const onHill = (p) => hills.some((h) => p.distanceTo(h.p) < h.r);
  const trees = isl.type === 'kraken' ? 0 : Math.round(R * 2.4);
  const leafColors = isl.type === 'libre' && isl.specialty === 'madera' ? ['#2f7a43', '#3f8a3a'] : ['#3f8a3a', '#4f9a3a', '#2f7a43', '#5a9e3c'];
  // Un punto al azar dentro de la isla, entre dos fracciones del radio en esa dirección
  const inland = (k0, k1, y = ISLAND_TOP) => {
    const deg = rand() * 360;
    return polar(R * (k0 + rand() * (k1 - k0)) * at(deg), deg, y);
  };
  for (let i = 0; i < trees; i++) {
    const p = inland(0.5, 0.9);
    if (onHill(p)) continue;
    const t = isl.type === 'ruinas' || rand() < 0.2 ? tree(leafColors[i % leafColors.length], true) : mediterraneanTree(rand());
    t.position.copy(p);
    t.scale.setScalar(0.8 + rand() * 0.6);
    t.rotation.y = rand() * Math.PI;
    decor.add(t);
  }
  for (let i = 0; i < Math.round(R * 1.2); i++) {
    const p = inland(0.35, 0.9);
    if (onHill(p)) continue;
    const big = rand() < 0.3;
    const m = mesh(new THREE.DodecahedronGeometry(big ? 0.45 : 0.32), big ? (isl.type === 'kraken' ? '#2f2c33' : '#8c8780') : i % 2 ? '#4f9a3a' : '#3f8a3a');
    m.position.copy(p).setY(ISLAND_TOP + 0.15);
    m.scale.set(1 + rand() * 0.6, 0.7 + rand() * 0.4, 1 + rand() * 0.6);
    decor.add(m);
  }
  // Palmeras y peñas en la playa
  if (isl.type !== 'kraken') {
    for (let i = 0; i < Math.round(R * 0.7); i++) {
      const t = tree('#4f9a3a', true);
      t.position.copy(city ? inland((R + 0.6) / R, (R + 2) / R, -0.45) : inland(1.02, 1.12, -0.45));
      t.scale.setScalar(0.9 + rand() * 0.5);
      t.rotation.y = rand() * Math.PI;
      decor.add(t);
    }
  }
  for (let i = 0; i < 5; i++) {
    const rock = mesh(new THREE.DodecahedronGeometry(0.6 + rand() * 0.8), isl.type === 'kraken' ? '#2f2c33' : '#7c7466');
    rock.position.copy(city ? inland((R + 4.4) / R, (R + 5.5) / R, -0.8) : inland(1.25, 1.45, -0.8));
    rock.scale.y = 0.6;
    decor.add(rock);
  }
  g.add(decor.build());
  return bakeStatic(g);
}

/** Un asentamiento dentro de un continente: solo un claro de tierra (el relieve es del continente). */
function siteBase(isl, R) {
  const g = new THREE.Group();
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(R * 0.72, 18), mat(isl.type === 'ciudadela' ? '#a48a62' : '#8fb85a'));
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = ISLAND_TOP + 0.03;
  clearing.receiveShadow = true;
  g.add(clearing);
  return g;
}

/**
 * La isla vista de lejos: su meseta (hierba arriba, acantilado en el borde), la arena y su monte,
 * en una sola malla de pocos triángulos. De cerca se cambia por la de verdad (`createIslandBase`).
 * Los asentamientos no tienen: van sobre su continente; el Mar de las Brumas ya es ligero.
 */
export function islandProxy(isl) {
  if (isl.land || isl.type === 'brumas') return null;
  const R = islandRadius(isl);
  if (isl.type === 'kraken') return gulfBase(isl, R, rng(hashString(isl.id)), hashString(isl.id), true);
  const h = islandCoast(isl);
  const cont = isl.type === 'continente';
  const city = isl.type === 'jugador';
  const pal = PALETTES[isl.type] ?? PALETTES.default;
  const b = new Batch();
  const land = shapeGeometry(new THREE.CylinderGeometry(R * 0.97, R, 2.2, 28, 1).toNonIndexed(), h);
  paintByNormal(land, (ny) => (ny > 0.7 ? (cont ? '#86ab4e' : pal.grass) : pal.cliff));
  const top = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ vertexColors: true }));
  top.position.y = ISLAND_TOP - 1.1;
  b.add(top);
  const sandR = cont ? [R * 1.1, R * 1.1] : city ? [R + 2.5, R + 4.2] : [R * 1.16, R * 1.32];
  const sand = mesh(shapeGeometry(new THREE.CylinderGeometry(sandR[0], sandR[1], 1.3, 28, 1).toNonIndexed(), h), isl.type === 'kraken' ? '#6b6470' : '#e8d49a');
  sand.position.y = -1.1;
  b.add(sand);
  // Bosquecillos y, en los continentes, sus montes (de lejos no se distingue dónde está cada árbol)
  const rand = rng(hashString(isl.id) ^ 0x5bd1e995);
  const inside = (k0, k1) => {
    const deg = rand() * 360;
    return polar(R * (k0 + rand() * (k1 - k0)) * coastFactor(h, THREE.MathUtils.degToRad(deg)), deg, ISLAND_TOP);
  };
  if (isl.type !== 'kraken') {
    const greens = ['#3f8a3a', '#4f9a3a', '#2f7a43'];
    for (let i = 0; i < Math.round(R * (cont ? 0.9 : 0.7)); i++) {
      const s = 0.9 + rand() * 0.8;
      const tree = mesh(new THREE.ConeGeometry(0.8 * s, 2.4 * s, 5), greens[i % 3]);
      tree.position.copy(inside(cont ? 0.1 : 0.5, 0.92)).setY(ISLAND_TOP + 1.2 * s);
      b.add(tree);
    }
  }
  if (cont) {
    for (let i = 0; i < 4; i++) {
      const size = R * (0.1 + rand() * 0.06);
      const peak = mesh(new THREE.ConeGeometry(size, size * 1.6, 6), i % 2 ? '#8c8780' : '#7d9a4e');
      peak.position.copy(inside(0.3, 0.75)).setY(ISLAND_TOP - 0.05 + size * 0.8);
      b.add(peak);
    }
  }
  // El monte grande, donde lo pone la isla de verdad (el primer número de su semilla)
  if (!cont && isl.type !== 'ruinas') {
    const a = rng(hashString(isl.id))() * 360;
    const at = coastFactor(h, THREE.MathUtils.degToRad(a));
    const hill = mesh(new THREE.ConeGeometry(R * 0.36, R * (isl.type === 'kraken' ? 0.75 : 0.5), 7), pal.rock);
    hill.position.copy(polar(R * 0.62 * at, a, ISLAND_TOP - 0.05 + R * (isl.type === 'kraken' ? 0.375 : 0.25)));
    b.add(hill);
  }
  const g = b.build({ shadows: false });
  g.traverse((o) => o.isMesh && (o.receiveShadow = true));
  return g;
}

/** Un continente: costa irregular, montes, bosques, un lago y caminos entre sus asentamientos. */
function continentBase(isl, R, rand, seed) {
  const g = new THREE.Group();
  // Contorno: la serie de Fourier que mejor se ajusta a su silueta (la misma que usa el agua)
  const h = islandCoast(isl);
  const radiusAt = (deg) => R * coastFactor(h, THREE.MathUtils.degToRad(deg));
  const outline = (k) => {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const deg = (i / 72) * 360;
      const r = radiusAt(deg) * k;
      const a = THREE.MathUtils.degToRad(deg);
      pts.push(new THREE.Vector2(Math.sin(a) * r, -Math.cos(a) * r));
    }
    return new THREE.Shape(pts);
  };
  const slab = (k, depth, top, color, bevel) => {
    let geo = new THREE.ExtrudeGeometry(outline(k), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel * 0.4, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, top - depth - bevel * 0.4, 0);
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (typeof color === 'function') paintByNormal(geo, color);
    const m = new THREE.Mesh(geo, typeof color === 'function' ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }) : mat(color));
    m.receiveShadow = true;
    return m;
  };
  g.add(slab(1.0, 2.0, ISLAND_TOP, (ny, cy) => (ny > 0.7 ? '#86ab4e' : cy > -0.6 ? '#a17f55' : '#8c8070'), 0.8));
  g.add(slab(1.1, 1.3, -0.45, '#e8d49a', 0));

  const sites = (isl.sites ?? []).map(([x, z]) => new THREE.Vector3(x, ISLAND_TOP, z));
  const inside = (p, k = 0.85) => {
    const deg = THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z));
    return p.length() < radiusAt(deg) * k;
  };
  const busy = [...sites.map((p) => ({ p, r: 9 }))];
  const freeAt = (p, k) => inside(p, k) && busy.every((b) => b.p.distanceTo(p) > b.r);

  // Caminos de tierra desde cada asentamiento hasta un cruce central con un pozo
  const decor = new Batch();
  for (const s of sites) {
    const len = s.length() - 4;
    const road = box(1.2, 0.05, len, '#c9b48a', 0, 0, 0);
    road.position.copy(s.clone().setLength(len / 2 + 1.2)).setY(ISLAND_TOP);
    road.rotation.y = Math.atan2(s.x, s.z);
    decor.add(road);
    busy.push({ p: s.clone().multiplyScalar(0.5), r: 2.2 });
  }
  const well = new THREE.Group();
  well.add(cyl(2.0, 2.0, 0.06, 14, '#c9b48a'), cyl(0.5, 0.55, 0.5, 10, C.stone), box(0.08, 1.0, 0.08, C.woodDark, -0.45, 0, 0), box(0.08, 1.0, 0.08, C.woodDark, 0.45, 0, 0));
  well.add(gableRoof(1.1, 0.4, 0.8, C.roofRed, 0, 1.0, 0));
  // El pozo, junto a la plaza de la maravilla (que va en el centro)
  well.position.set(7.5, ISLAND_TOP, 5);
  decor.add(well);
  busy.push({ p: new THREE.Vector3(0, ISLAND_TOP, 0), r: 9 }, { p: well.position.clone(), r: 2.5 });

  // Un lago con juncos
  for (let tries = 0; tries < 40; tries++) {
    const p = polar(R * (0.25 + rand() * 0.4), rand() * 360, ISLAND_TOP);
    if (!freeAt(p, 0.7)) continue;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(3 + rand() * 2, 12), mat('#4a9fc8', { roughness: 0.3 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.copy(p).setY(ISLAND_TOP + 0.04);
    g.add(lake);
    for (let k = 0; k < 8; k++) {
      const reed = cyl(0.03, 0.03, 0.6, 4, '#5a7a3a');
      reed.position.copy(p).add(polar(3.6 + rand(), rand() * 360, 0));
      decor.add(reed);
    }
    busy.push({ p, r: 6 });
    break;
  }

  // Montes
  const mountains = 3 + Math.floor(rand() * 3);
  for (let i = 0, made = 0; i < 60 && made < mountains; i++) {
    const p = polar(R * (0.3 + rand() * 0.5), rand() * 360, ISLAND_TOP - 0.05);
    const size = 3 + rand() * 4;
    if (!freeAt(p, 0.75) || busy.some((b) => b.p.distanceTo(p) < b.r + size)) continue;
    const hill = new THREE.Mesh(
      mountainGeometry(size, size * (1.2 + rand() * 0.8), (seed + i * 17) % 97, { snow: '#eef1f4', grass: '#86ab4e', rock: '#8c8780' }),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    );
    hill.position.copy(p);
    hill.castShadow = hill.receiveShadow = true;
    g.add(hill);
    busy.push({ p, r: size + 0.5 });
    made++;
  }

  // Bosques y prados
  const leafColors = ['#3f8a3a', '#4f9a3a', '#2f7a43', '#5a9e3c'];
  const clusters = Array.from({ length: 5 }, () => polar(R * (0.3 + rand() * 0.5), rand() * 360, ISLAND_TOP));
  for (let i = 0, made = 0; i < 3200 && made < R * 9; i++) {
    const p = i % 2 ? clusters[i % 5].clone().add(polar(rand() * 8, rand() * 360)) : polar(R * rand() * 0.95, rand() * 360, ISLAND_TOP);
    if (!freeAt(p, 0.9)) continue;
    const t = rand() < 0.1 ? tree(leafColors[made % 4], true) : mediterraneanTree(rand());
    t.position.copy(p).setY(ISLAND_TOP);
    t.scale.setScalar(0.9 + rand() * 0.7);
    t.rotation.y = rand() * Math.PI;
    decor.add(t);
    made++;
  }
  for (let i = 0; i < 40; i++) {
    const p = polar(R * rand() * 0.9, rand() * 360, ISLAND_TOP);
    if (!freeAt(p, 0.9)) continue;
    const m = mesh(new THREE.DodecahedronGeometry(0.4 + rand() * 0.4), i % 3 ? '#4f9a3a' : '#8c8780');
    m.position.copy(p).setY(ISLAND_TOP + 0.15);
    m.scale.y = 0.6;
    decor.add(m);
  }
  // Palmeras en la playa
  for (let i = 0; i < Math.round(R * 0.8); i++) {
    const deg = rand() * 360;
    const t = tree('#4f9a3a', true);
    t.position.copy(polar(radiusAt(deg) * (1.03 + rand() * 0.04), deg, -0.45));
    t.scale.setScalar(0.9 + rand() * 0.5);
    decor.add(t);
  }
  g.add(decor.build());
  return g;
}

/** Mar abierto: solo farallones de roca y un pecio encallado. */
function seaStacks(R, rand) {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const h = 3 + rand() * 6;
    const rock = mesh(new THREE.ConeGeometry(1 + rand() * 1.4, h, 6), i % 2 ? '#5f5a52' : '#77706a');
    rock.position.copy(polar(R * (0.4 + rand() * 1.4), rand() * 360, h / 2 - 1.4));
    rock.rotation.z = (rand() - 0.5) * 0.3;
    g.add(rock);
  }
  const wreck = createShip('mercante');
  wreck.scale.setScalar(2.6);
  wreck.position.set(R * 0.6, -1.0, -R * 0.4);
  wreck.rotation.set(0.25, 1.2, 0.5);
  g.add(wreck);
  return g;
}

function tree(color, palm) {
  const t = new THREE.Group();
  if (palm) return palmTree();
  t.add(cyl(0.1, 0.15, 0.6, 6, C.woodDark));
  const leaves = mesh(new THREE.ConeGeometry(0.75, 1.5, 7), color);
  leaves.position.y = 1.25;
  t.add(leaves);
  return t;
}

/** Estado visual de la isla según lo que sabe el jugador. */
export function islandLook(view) {
  if (view.type === 'brumas') return 'brumas';
  if (view.type === 'continente') return `maravilla-${view.wonder?.level ?? 0}${view.horde ? '-h' : ''}${featLook(view.feat)}`;
  if (view.type === 'jugador') return `ciudad-${view.townLevel >= 6 ? 3 : view.townLevel >= 3 ? 2 : 1}${view.statue ? `-e${view.statue}` : ''}`;
  if (view.type === 'ciudadela' && view.colonizedBy != null) return view.colonized ? 'ciudadela-propia' : 'ciudadela-otro';
  if (view.colonized) return 'colonia';
  if (view.colonizedBy != null) return 'colonia-otro';
  if (!view.explored) return 'niebla';
  if (view.type === 'ruinas') return view.looted ? 'ruinas-saqueadas' : 'ruinas';
  // La fosa, con el Kraken si tu último bote lo vio en ella
  if (view.type === 'kraken') return view.intel?.garrison?.kraken && !view.intel.rebuildUntil ? 'kraken-vivo' : 'kraken';
  return view.type;
}

/**
 * Cómo se ve una gesta en su continente: «-gT…» Tifón («p» en presagios, «0», «1», «2» según la
 * fase y «2f» con las cabezas en furia), «-gA…» la Armada (fondeaderos tomados) y «-gH…» la Hidra
 * (cabezas vivas). Nada si no hay gesta en marcha.
 */
function featLook(feat) {
  if (!feat || (feat.stage !== 'presagio' && feat.stage !== 'lucha')) return '';
  const kind = FEAT_THEMES[feat.theme]?.kind ?? 'tifon';
  if (kind === 'armada') return `-gA${feat.boss ? feat.boss.posts.filter((p) => p.holder != null).length : 'p'}`;
  if (kind === 'hidra') return `-gH${feat.boss ? Math.min(12, feat.boss.hidra) : 'p'}`;
  if (feat.stage === 'presagio' || !feat.boss) return '-gTp';
  const phase = Math.min(feat.boss.phase, feat.phases.length - 1);
  const unit = feat.phases[phase]?.unit;
  const fury = unit === 'cabeza' && (feat.boss.cabeza ?? 0) <= (FEAT_THEMES[feat.theme]?.tune.furyAt ?? 0);
  return `-gT${phase}${fury ? 'f' : ''}`;
}

export function createIslandFeature(isl, fullLook) {
  const look = fullLook.split('|')[0];
  const R = islandRadius(isl) / FEATURE_SCALE;
  const rand = rng(hashString(isl.id) ^ 0x9e3779b9);
  const g = new THREE.Group();
  g.position.y = ISLAND_TOP;
  g.scale.setScalar(FEATURE_SCALE);
  const builders = {
    niebla: () => mist(g, R, rand),
    barbaros: () => camp(g, R, rand),
    ciudadela: () => citadel(g, R, rand),
    'ciudadela-propia': () => citadel(g, R, rand, isl.bannerColor ?? C.cloth[0]),
    'ciudadela-otro': () => citadel(g, R, rand, ownerColor(isl)),
    piratas: () => fort(g, R),
    ruinas: () => ruins(g, R, rand, true),
    'ruinas-saqueadas': () => ruins(g, R, rand, false),
    libre: () => specialty(g, isl, R, rand),
    colonia: () => colony(g, isl, R, rand, isl.bannerColor ?? C.cloth[0]),
    'colonia-otro': () => colony(g, isl, R, rand, ownerColor(isl)),
    kraken: () => lair(g, isl, R, rand, false),
    'kraken-vivo': () => lair(g, isl, R, rand, true),
    brumas: () => fogBank(g, R, rand),
  };
  if (look.startsWith('ciudad-')) {
    // Una ciudad (con la estatua de una gesta ganada, si la tiene)
    const [, size, extra] = look.split('-');
    city(g, isl, R, rand, Number(size));
    if (extra?.startsWith('e')) featStatue(g, R, extra.slice(1));
  } else if (look.startsWith('maravilla-')) {
    const parts = look.slice(10).split('-');
    wonderModel(g, wonderOf(isl), Number(parts[0]));
    if (parts.includes('h')) hordeCamp(g, R, rand);
    const feat = parts.find((x) => x.startsWith('g'));
    if (feat?.[1] === 'T') typhonRise(g, isl, R, rand, feat.slice(2));
    else if (feat?.[1] === 'A') persianCamp(g, isl, R, rand, feat.slice(2));
    else if (feat?.[1] === 'H') hydraSwamp(g, isl, R, rand, feat.slice(2));
  }
  else builders[look]?.();
  return bakeStatic(g);
}

function mist(g, R, rand) {
  // Unos cúmulos bajos que tapan la isla; giran despacio todos juntos
  const material = cloudMaterial(0.9);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const puffs = 4 + Math.floor(rand() * 3);
    const geo = cloudGeometry(rand, { puffs, width: R * 0.95, depth: R * 0.45, size: R * 0.27 });
    const p = polar(i ? R * (0.3 + rand() * 0.3) : 0, (i / 5) * 360 + rand() * 30, 1.2 + rand() * 1.6);
    geo.rotateY(rand() * Math.PI).translate(p.x, p.y, p.z);
    parts.push(geo);
  }
  const cloud = new THREE.Mesh(mergeGeometries(parts), material);
  for (const geo of parts) geo.dispose();
  cloud.userData.spin = { axis: 'y', speed: 0.08 };
  g.add(cloud);
}

function fogBank(g, R, rand) {
  const material = cloudMaterial(0.8);
  for (let ring = 0; ring < 2; ring++) {
    // Cada anillo de bancos de niebla, en una sola malla que gira entera
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const geo = cloudGeometry(rand, { puffs: 4, width: 9, depth: 3, size: 2.4 });
      const p = polar(R * (1.2 + ring * 1.3 + rand() * 0.8), (i / 9) * 360 + rand() * 20, SEA + 0.6 + rand() * 1.2);
      geo.scale(1, 0.6, 1).rotateY(rand() * Math.PI).translate(p.x, p.y, p.z);
      parts.push(geo);
    }
    const bank = new THREE.Mesh(mergeGeometries(parts), material);
    for (const geo of parts) geo.dispose();
    bank.userData.spin = { axis: 'y', speed: ring ? -0.05 : 0.08 };
    g.add(bank);
  }
}

function camp(g, R, rand) {
  // Empalizada con una abertura
  const r = R * 0.42;
  for (let a = 0; a < 360; a += 12) {
    if (a > 160 && a < 200) continue;
    const stake = cyl(0.12, 0.12, 1.1 + rand() * 0.3, 5, C.woodDark);
    stake.position.add(polar(r, a));
    g.add(stake);
  }
  const hides = ['#a0784e', '#8b6a44', '#b89466'];
  for (let i = 0; i < 4; i++) {
    const tent = mesh(new THREE.ConeGeometry(0.9, 1.4, 5), hides[i % 3]);
    tent.position.copy(polar(r * 0.55, i * 90 + 30, 0.7));
    g.add(tent);
  }
  // Hoguera
  g.add(cyl(0.35, 0.4, 0.12, 8, C.stoneDark));
  const fire = makeFire(0, 0.1, 0, 0.69);
  g.add(fire);
  // Tótem con calavera
  g.add(cyl(0.12, 0.14, 2.0, 6, C.wood, r * 0.3, 0, -r * 0.5));
  const skull = mesh(new THREE.SphereGeometry(0.22, 8, 6), '#efe8d8');
  skull.position.set(r * 0.3, 2.15, -r * 0.5);
  g.add(skull);
  for (let i = 0; i < 3; i++) {
    const b = createSoldier('barbaro');
    b.scale.setScalar(1.8);
    b.position.copy(polar(r * 0.35, 200 + i * 50));
    b.rotation.y = rand() * Math.PI * 2;
    g.add(b);
  }
}

function fort(g, R) {
  const s = R * 0.36;
  // Muros
  for (const [x, z, w, d] of [[0, -s, 2 * s, 0.5], [0, s, 2 * s, 0.5], [-s, 0, 0.5, 2 * s], [s, 0, 0.5, 2 * s]]) {
    g.add(box(w, 1.4, d, C.stoneDark, x, 0, z));
  }
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    g.add(cyl(0.6, 0.7, 2.2, 7, C.stone, x, 0, z));
    const top = mesh(new THREE.ConeGeometry(0.75, 0.8, 7), '#3a2a20');
    top.position.set(x, 2.6, z);
    g.add(top);
  }
  // Torre del homenaje y bandera negra
  g.add(box(1.8, 2.8, 1.8, C.stone, 0, 0, 0));
  g.add(cyl(0.05, 0.05, 2.0, 5, C.dark, 0, 2.8, 0));
  const flag = box(1.0, 0.65, 0.03, '#111111', 0, 0, 0);
  flag.geometry.translate(0.5, 0, 0);
  flag.position.set(0, 4.4, 0);
  flag.userData.wave = true;
  g.add(flag);
  const skull = box(0.28, 0.28, 0.04, '#f4efe6', 0.5, 4.4, 0.02);
  g.add(skull);
  // Cañones
  for (const a of [0, 90, 180, 270]) {
    const c = box(0.26, 0.26, 0.9, C.dark);
    c.position.copy(polar(s + 0.4, a, 1.25));
    c.rotation.y = THREE.MathUtils.degToRad(a);
    g.add(c);
  }
  // Barco corsario fondeado
  const ship = createShip('corsario');
  ship.scale.setScalar(2.2);
  ship.position.copy(polar(R * 1.35, 140, SEA));
  ship.rotation.y = Math.PI * 0.3;
  ship.userData.bob = { amp: 0.1, speed: 1.2, base: SEA };
  g.add(ship);
}

function ruins(g, R, rand, treasure) {
  const r = R * 0.3;
  for (let i = 0; i < 7; i++) {
    const a = i * (360 / 7);
    const h = 0.6 + rand() * 2.2;
    const col = cyl(0.25, 0.28, h, 8, '#e3dccb');
    col.position.add(polar(r, a));
    g.add(col);
    if (rand() < 0.4) {
      const top = box(0.75, 0.2, 0.75, '#d6cdb7', 0, 0, 0);
      top.position.copy(polar(r, a, h));
      g.add(top);
    }
  }
  // Arco
  g.add(box(0.5, 2.4, 0.5, '#d6cdb7', -0.9, 0, -r - 1.2), box(0.5, 2.4, 0.5, '#d6cdb7', 0.9, 0, -r - 1.2));
  g.add(box(2.4, 0.45, 0.6, '#cfc5ad', 0, 2.4, -r - 1.2));
  // Columna caída y bloques
  const fallen = cyl(0.25, 0.28, 2.2, 8, '#e3dccb');
  fallen.rotation.z = Math.PI / 2;
  fallen.position.set(r + 1.4, 0.25, 0.6);
  g.add(fallen);
  for (let i = 0; i < 6; i++) {
    const b = box(0.4 + rand() * 0.4, 0.3, 0.4 + rand() * 0.4, '#cfc5ad', 0, 0, 0);
    b.position.copy(polar(r + 1 + rand() * 1.5, rand() * 360, 0.15));
    b.rotation.y = rand() * Math.PI;
    g.add(b);
  }
  if (treasure) {
    g.add(box(0.7, 0.45, 0.5, C.woodDark, 0, 0, 0));
    const gold = mesh(new THREE.ConeGeometry(0.32, 0.35, 8), C.gold, { metalness: 0.6, roughness: 0.3, emissive: '#b8860b', emissiveIntensity: 0.5 });
    gold.position.y = 0.6;
    g.add(gold);
  }
}

function specialty(g, isl, R, rand) {
  const spots = (n, fn) => {
    for (let i = 0; i < n; i++) {
      const p = polar(R * (0.05 + rand() * 0.35), rand() * 360);
      fn(p, i);
    }
  };
  if (isl.specialty === 'madera') {
    spots(10, (p, i) => {
      const t = tree(i % 2 ? '#2f7a43' : '#3f8a3a', false);
      t.position.copy(p);
      t.scale.setScalar(1.1 + rand() * 0.5);
      g.add(t);
    });
  } else if (isl.specialty === 'piedra' || isl.specialty === 'hierro') {
    const color = isl.specialty === 'hierro' ? '#9a5a3a' : C.stone;
    spots(9, (p) => {
      const rock = mesh(new THREE.DodecahedronGeometry(0.6 + rand() * 0.6), color);
      rock.position.copy(p).setY(0.3);
      rock.scale.y = 0.7;
      g.add(rock);
    });
  } else if (isl.specialty === 'comida') {
    spots(6, (p, i) => {
      const patch = box(1.6, 0.25, 1.2, i % 2 ? '#e3c25a' : '#cfb24a', p.x, 0, p.z);
      patch.rotation.y = rand() * Math.PI;
      g.add(patch);
    });
  } else if (isl.specialty === 'cristal') {
    spots(7, (p) => {
      const c = mesh(new THREE.OctahedronGeometry(0.45), C.crystal, { emissive: '#2aa8d8', emissiveIntensity: 0.7, roughness: 0.25 });
      c.scale.set(1, 2.2, 1);
      c.position.copy(p).setY(0.9);
      c.userData.spin = { axis: 'y', speed: 0.5 };
      g.add(c);
    });
  } else if (isl.specialty === 'oro') {
    spots(6, (p) => {
      const n = mesh(new THREE.DodecahedronGeometry(0.35 + rand() * 0.3), C.gold, { metalness: 0.7, roughness: 0.3, emissive: '#8a6a00', emissiveIntensity: 0.4 });
      n.position.copy(p).setY(0.25);
      g.add(n);
    });
  }
}

const OWNER_COLORS = ['#4f8fd9', '#6bbf59', '#e3b23c', '#8a5ab8', '#d9734f', '#3fb6b6', '#c94f8a', '#7a7f87'];

/** Color de bandera de un jugador (siempre el mismo para cada uno). */
export function ownerColor(isl) {
  if (isl.bannerColor) return isl.bannerColor;
  const id = isl.owner ?? isl.colonizedBy ?? 0;
  return OWNER_COLORS[Math.abs(Number(id) || hashString(String(id))) % OWNER_COLORS.length];
}

/** Ciudad de otro jugador: casas, ayuntamiento y muralla según su tamaño. */
// Tejas de terracota en varios tonos y paredes encaladas u ocres
const TILES = [C.roofRed, '#b85a36', '#cf7046', C.roofRed];
const WALLS = ['#f6f1e7', '#f2e8d2', '#f3dcb0', '#ece0cf'];

function city(g, isl, R, rand, size) {
  const batch = new Batch();
  // Calles en cruz hasta la muralla
  for (const a of [0, 90, 180, 270]) {
    const road = box(0.9, 0.04, R * 0.62, '#c9b48a', 0, 0, 0);
    road.position.copy(polar(R * 0.31 + 1, a + 20));
    road.rotation.y = THREE.MathUtils.degToRad(a + 20);
    batch.add(road);
  }
  const houses = 10 + size * 8;
  for (let i = 0; i < houses; i++) {
    const h = new THREE.Group();
    const w = 1.0 + rand() * 0.5;
    const tall = size >= 2 && rand() < 0.35;
    const hh = (0.8 + rand() * 0.4) * (tall ? 1.7 : 1);
    h.add(box(w, hh, 0.9, WALLS[i % WALLS.length]));
    h.add(hipRoof(w + 0.18, 1.08, 0.38, TILES[i % TILES.length], 0, hh, 0));
    const ring = i % 4;
    h.position.copy(polar(R * (0.2 + ring * 0.1 + rand() * 0.04), (i / houses) * 360 * 3 + rand() * 10));
    h.rotation.y = rand() * Math.PI;
    batch.add(h);
  }
  // Campos fuera de la muralla
  for (let i = 0; i < 6 + size * 2; i++) {
    const f = box(1.8, 0.12, 1.3, i % 2 ? '#e3c25a' : '#9fc04a', 0, 0, 0);
    f.position.copy(polar(R * (0.72 + rand() * 0.08), i * (360 / (6 + size * 2)) + rand() * 10));
    f.rotation.y = rand() * Math.PI;
    batch.add(f);
  }
  // Templo en las ciudades grandes
  if (size >= 2) {
    const temple = new THREE.Group();
    temple.add(box(2.2, 0.25, 1.6, C.wall));
    for (let i = 0; i < 4; i++) for (const z of [-0.6, 0.6]) temple.add(cyl(0.09, 0.1, 1.0, 6, C.white, -0.8 + i * 0.53, 0.25, z));
    temple.add(gableRoof(1.8, 0.5, 2.4, C.roofRed, 0, 1.25, 0));
    temple.position.copy(polar(R * 0.3, 300));
    temple.rotation.y = Math.PI / 2;
    batch.add(temple);
  }
  g.add(batch.build());
  // Palacio de gobierno en el centro: escalinata, columnas, terracota y cúpula azul
  const y0 = stylobate(g, 3.2, 3.2, 2);
  g.add(box(2.1, 1.4, 2.1, C.wall, 0, y0, 0));
  colonnade(g, { from: -1.3, to: 1.3, at: 1.35, n: 4, y: y0, h: 1.4, r: 0.1 });
  g.add(box(2.95, 0.16, 2.95, C.marbleDark, 0, y0 + 1.4, 0));
  g.add(hipRoof(3.05, 3.05, 0.5, C.roofRed, 0, y0 + 1.56, 0));
  g.add(dome(0.7, C.roofBlue, 0, y0 + 1.8, 0, 0.3));
  g.add(cyl(0.05, 0.05, 1.4, 6, C.dark, 0, y0 + 2.9, 0));
  const flag = box(1.0, 0.6, 0.03, ownerColor(isl), 0, 0, 0);
  flag.geometry.translate(0.5, 0, 0);
  flag.position.y = y0 + 4.0;
  flag.userData.wave = true;
  g.add(flag);
  // Muralla con torres en las ciudades grandes
  if (size >= 2) {
    const r = R * 0.62;
    const wall = new Batch();
    const h = 0.9 + size * 0.2;
    for (let a = 0; a < 360; a += 8) {
      if (a > 150 && a < 190) continue;
      const seg = box(r * 0.15, h, 0.4, C.stone, 0, 0, 0);
      seg.position.copy(polar(r, a));
      seg.rotation.y = (a * Math.PI) / 180;
      wall.add(seg);
    }
    for (let a = 30; a < 360; a += 60) {
      if (a > 140 && a < 200) continue;
      const tower = cyl(0.55, 0.65, h + 0.9, 8, C.stone, 0, 0, 0);
      tower.position.copy(polar(r, a));
      wall.add(tower);
      const roof = mesh(new THREE.ConeGeometry(0.75, 0.5, 8), C.roofRed);
      roof.position.copy(polar(r, a, h + 1.15));
      wall.add(roof);
    }
    g.add(wall.build());
  }
  const ship = createShip(size >= 3 ? 'galeon' : 'mercante');
  ship.scale.setScalar(2);
  ship.position.copy(polar(R * 1.3, 170, SEA));
  ship.rotation.y = Math.PI / 2;
  ship.userData.bob = { amp: 0.08, speed: 1.1, base: SEA };
  g.add(ship);
}

function colony(g, isl, R, rand, flagColor) {
  specialty(g, isl, R, rand);
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Group();
    h.add(box(1.3, 0.9, 1.0, WALLS[i]));
    h.add(hipRoof(1.48, 1.18, 0.4, TILES[i], 0, 0.9, 0));
    h.position.copy(polar(R * 0.45, 200 + i * 40));
    h.rotation.y = rand() * Math.PI;
    g.add(h);
  }
  g.add(cyl(0.06, 0.06, 3.2, 6, C.dark));
  const flag = box(1.1, 0.7, 0.03, flagColor, 0, 0, 0);
  flag.geometry.translate(0.55, 0, 0);
  flag.position.y = 2.8;
  flag.userData.wave = true;
  g.add(flag);
  g.add(box(0.5, 0.5, 0.04, C.gold, 0.55, 2.8, 0.03));
  const ship = createShip('mercante');
  ship.scale.setScalar(2);
  ship.position.copy(polar(R * 1.3, 20, SEA));
  ship.rotation.y = Math.PI / 2;
  ship.userData.bob = { amp: 0.08, speed: 1.1, base: SEA };
  g.add(ship);
}

/** Ciudad bárbara del continente: empalizada doble, torres de madera, chozas y un gran salón. */
function citadel(g, R, rand, owner = null) {
  const batch = new Batch();
  for (const [r, h] of [[R * 0.62, 1.5], [R * 0.4, 1.1]]) {
    for (let a = 0; a < 360; a += 7) {
      if (a > 165 && a < 195) continue;
      const stake = cyl(0.14, 0.14, h + rand() * 0.3, 5, C.woodDark, 0, 0, 0);
      stake.position.copy(polar(r, a));
      batch.add(stake);
    }
  }
  for (const a of [140, 220, 60, 300]) {
    const tower = new THREE.Group();
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) tower.add(box(0.12, 2.4, 0.12, C.woodDark, x, 0, z));
    tower.add(box(1.2, 0.12, 1.2, C.wood, 0, 2.4, 0));
    const roof = mesh(new THREE.ConeGeometry(0.95, 0.8, 4), '#8b6a44');
    roof.position.y = 2.95;
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    tower.position.copy(polar(R * 0.62, a));
    batch.add(tower);
  }
  // Gran salón con cuernos en el tejado
  const hall = new THREE.Group();
  hall.add(box(3.2, 1.4, 1.8, C.wood));
  const roof = gableRoof(2.2, 1.1, 3.6, '#6e5a3a', 0, 1.4, 0);
  roof.rotation.y = Math.PI / 2;
  hall.add(roof);
  for (const x of [-1.7, 1.7]) {
    const horn = mesh(new THREE.ConeGeometry(0.12, 0.7, 5), '#efe8d8');
    horn.position.set(x, 2.6, 0);
    horn.rotation.z = x > 0 ? -0.6 : 0.6;
    hall.add(horn);
  }
  batch.add(hall);
  const hides = ['#a0784e', '#8b6a44', '#b89466'];
  for (let i = 0; i < 9; i++) {
    const hut = new THREE.Group();
    hut.add(cyl(0.7, 0.8, 0.7, 7, hides[i % 3]));
    const top = mesh(new THREE.ConeGeometry(0.9, 0.9, 7), '#6e5a3a');
    top.position.y = 1.15;
    hut.add(top);
    hut.position.copy(polar(R * (0.48 + (i % 2) * 0.06), i * 40 + rand() * 10));
    batch.add(hut);
  }
  g.add(batch.build());
  // Hogueras y guerreros
  for (const a of [0, 120, 240]) {
    const p = polar(R * 0.25, a);
    g.add(makeFire(p.x, 0, p.z, 0.69));
  }
  for (let i = 0; i < 5; i++) {
    const b = createSoldier(owner ? (i % 2 ? 'lancero' : 'hoplita') : i % 2 ? 'barbaro' : 'arquero');
    b.scale.setScalar(1.8);
    b.position.copy(polar(R * 0.3, 160 + i * 18));
    b.rotation.y = rand() * Math.PI * 2;
    g.add(b);
  }
  // Estandarte
  g.add(cyl(0.05, 0.05, 3.4, 6, C.dark, 1.9, 0, 0));
  const flag = box(1.0, 0.7, 0.03, owner ?? '#7a2f22', 0, 0, 0);
  flag.geometry.translate(0.5, 0, 0);
  flag.position.set(1.9, 3.0, 0);
  flag.userData.wave = true;
  g.add(flag);
}

/** La maravilla de un continente: crece con cada nivel. */
function wonderModel(g, type, level) {
  g.add(cyl(4.4, 4.6, 0.08, 24, '#d8cdb5'));
  const steps = Math.min(3, 1 + level);
  for (let i = 0; i < steps; i++) g.add(box(5.4 - i * 0.9, 0.28, 5.4 - i * 0.9, i % 2 ? C.wallDark : C.wall, 0, 0.08 + i * 0.28, 0));
  const top = 0.08 + steps * 0.28;
  if (level === 0) {
    // Solo los cimientos, con andamios y bloques esperando
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) g.add(box(0.1, 1.6, 0.1, C.woodLight, x, top, z));
    g.add(box(3.4, 0.08, 0.1, C.woodLight, 0, top + 1.4, -1.6), box(3.4, 0.08, 0.1, C.woodLight, 0, top + 1.4, 1.6));
    for (let i = 0; i < 6; i++) g.add(box(0.5, 0.35, 0.5, C.stone, -2.6 + (i % 3) * 0.6, 0.08, 2.9 + Math.floor(i / 3) * 0.6));
    return;
  }
  const gold = level >= 5 ? C.gold : null;
  const h = 1.0 + level * 0.3;
  if (type === 'poseidon') {
    // Templo de columnas con un estanque y el tridente dorado
    const n = 6 + level * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.add(cyl(0.13, 0.15, h, 8, C.white, Math.sin(a) * 1.8, top, Math.cos(a) * 1.8));
    }
    g.add(cyl(2.15, 2.15, 0.25, 16, C.wallDark, 0, top + h, 0));
    const roof = mesh(new THREE.ConeGeometry(2.3, 1.0 + level * 0.1, 16), gold ?? C.roofBlue);
    roof.position.y = top + h + 0.25 + (1.0 + level * 0.1) / 2;
    g.add(roof);
    const pool = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 16), '#4a9fc8');
    pool.position.y = top + 0.03;
    g.add(pool);
    if (level >= 3) {
      g.add(cyl(0.05, 0.05, 1.6, 6, C.gold, 0, top, 0, { metalness: 0.6, roughness: 0.3 }));
      for (const x of [-0.25, 0, 0.25]) g.add(box(0.06, 0.4, 0.06, C.gold, x, top + 1.5, 0, { metalness: 0.6, roughness: 0.3 }));
      g.add(box(0.6, 0.06, 0.06, C.gold, 0, top + 1.5, 0, { metalness: 0.6, roughness: 0.3 }));
    }
  } else if (type === 'hefesto') {
    // Gran forja con chimeneas humeantes y un yunque de bronce
    g.add(box(3.2, h + 0.4, 2.6, C.stoneDark, 0, top, -0.2));
    g.add(box(1.0, 0.8, 0.05, '#ff8a2a', 0, top + 0.1, 1.11, { emissive: '#ff5a00', emissiveIntensity: 1.6 }));
    const chimneys = Math.min(3, 1 + Math.floor(level / 2));
    for (let i = 0; i < chimneys; i++) {
      const x = -1.0 + i * 1.0;
      g.add(box(0.5, h + 1.8, 0.5, C.stone, x, top, -1.0));
      g.add(smokeColumn(x, top + h + 2.0, -1.0, i * 1.3));
    }
    g.add(box(0.8, 0.5, 0.5, '#8a6a3a', 0, top, 2.0, { metalness: 0.5, roughness: 0.45 }));
    g.add(box(1.2, 0.2, 0.5, gold ?? '#a5762e', 0, top + 0.5, 2.0, { metalness: 0.5, roughness: 0.45 }));
  } else if (type === 'demeter') {
    // Jardines en terrazas con árboles y una fuente
    for (let i = 0; i < Math.min(4, level + 1); i++) {
      const s = 3.6 - i * 0.8;
      g.add(box(s, 0.35, s, '#5f9a4a', 0, top + i * 0.35, 0));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i;
        const tree = mesh(new THREE.DodecahedronGeometry(0.28), k % 2 ? '#3f8a3a' : '#e86a8a');
        tree.position.set(Math.sin(a) * (s / 2 - 0.25), top + i * 0.35 + 0.55, Math.cos(a) * (s / 2 - 0.25));
        g.add(tree);
      }
    }
    const t = top + Math.min(4, level + 1) * 0.35;
    g.add(cyl(0.45, 0.55, 0.3, 12, C.white, 0, t, 0));
    g.add(cyl(0.08, 0.1, 0.8, 6, C.white, 0, t + 0.3, 0));
    g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), gold ?? '#e3c25a'));
    g.children.at(-1).position.set(0, t + 1.2, 0);
  } else {
    // Biblioteca con columnata, cúpula y la lechuza de Atenea
    g.add(box(3.2, h, 2.2, C.wall, 0, top, -0.2));
    for (let i = 0; i < 6; i++) g.add(cyl(0.12, 0.14, h, 8, C.white, -1.4 + i * 0.56, top, 1.15));
    g.add(box(3.4, 0.2, 2.8, C.wallDark, 0, top + h, 0.05));
    const dome = mesh(new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold ?? C.roofBlue);
    dome.position.y = top + h + 0.2;
    g.add(dome);
    if (level >= 3) {
      const owl = mesh(new THREE.SphereGeometry(0.22, 8, 6), C.gold, { metalness: 0.6, roughness: 0.3 });
      owl.position.set(0, top + h + 1.45, 0);
      g.add(owl);
      for (const x of [-0.1, 0.1]) g.add(box(0.06, 0.12, 0.06, C.gold, x, top + h + 1.6, 0));
    }
  }
  // Estandartes en las esquinas de la plaza, uno por nivel
  for (let i = 0; i < level; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    g.add(cyl(0.04, 0.04, 2.2, 5, C.dark, Math.sin(a) * 3.8, 0, Math.cos(a) * 3.8));
    const flag = box(0.5, 0.7, 0.02, C.cloth[i % 4], 0, 0, 0);
    flag.position.set(Math.sin(a) * 3.8 + 0.25, 1.5, Math.cos(a) * 3.8);
    g.add(flag);
  }
}

/** El campamento de una horda bárbara en la costa: tiendas, hogueras, estandartes rojos y sus barcos. */
function hordeCamp(g, R, rand) {
  const a = 200 + rand() * 40;
  const at = (r, da, y = 0) => polar(R * r, a + da, y);
  const hides = ['#7a2f22', '#a0784e', '#5a3a2a'];
  for (let i = 0; i < 9; i++) {
    const tent = mesh(new THREE.ConeGeometry(0.9 + rand() * 0.3, 1.5, 6), hides[i % 3]);
    tent.position.copy(at(0.82 + (i % 3) * 0.05, (i - 4) * 4, 0.75));
    g.add(tent);
  }
  for (let i = 0; i < 3; i++) {
    const p = at(0.86, (i - 1) * 9);
    g.add(cyl(0.35, 0.4, 0.12, 8, C.stoneDark, p.x, 0, p.z));
    const fire = makeFire(p.x, 0.075, p.z, 0.862);
    g.add(fire);
  }
  for (let i = 0; i < 4; i++) {
    const p = at(0.78, (i - 1.5) * 8);
    g.add(cyl(0.05, 0.05, 3.2, 5, C.dark, p.x, 0, p.z));
    const flag = box(0.9, 0.6, 0.03, '#a8231a', 0, 0, 0);
    flag.geometry.translate(0.45, 0, 0);
    flag.position.set(p.x, 2.9, p.z);
    flag.userData.wave = true;
    g.add(flag);
  }
  for (let i = 0; i < 6; i++) {
    const b = createSoldier(i % 2 ? 'barbaro' : 'arquero');
    b.scale.setScalar(1.8);
    b.position.copy(at(0.74, (i - 2.5) * 5));
    b.rotation.y = rand() * Math.PI * 2;
    g.add(b);
  }
  // Sus barcos varados en la orilla
  for (let i = 0; i < 2; i++) {
    const ship = createShip('corsario');
    ship.scale.setScalar(2.4);
    ship.position.copy(at(1.08, (i - 0.5) * 14, SEA));
    ship.rotation.y = THREE.MathUtils.degToRad(a + 90);
    ship.userData.bob = { amp: 0.08, speed: 1.1, base: SEA };
    g.add(ship);
  }
}

// ── La fosa del Kraken ──────────────────────────────────────────────────────
// Una isla en forma de media luna que abraza un golfo de aguas negras y hondas: la guarida del
// Kraken. En el fondo del golfo, las ruinas de una ciudad que se tragó el mar, medio sepultadas por
// el agua, donde viven los tritones y sus hipocampos.

const RUIN = ['#c9c4b6', '#b8b2a2', '#d6d0c0'];
const ALGAE = '#5f7f5a';
const PATINA = '#5f8f7a';
const KRAKEN_SKIN = ['#7a3b5a', '#8a4868'];
const SUCKER = '#e6c7cf';
const GULF_LAND = { grass: '#7a8f55', cliff: '#8a7a66', rock: '#6e665c', sand: '#cbbd98' };
const FOAM = { transparent: true, opacity: 0.45, depthWrite: false };

/**
 * El golfo de una fosa, en unidades de la isla: hacia dónde se abre (`deg`), su centro y su radio,
 * y lo abierta que es la bocana en la costa (`mouth`) y por dentro (`neck`), en grados.
 */
function gulfOf(isl, R) {
  const deg = rng(hashString(isl.id) ^ 0x2545f491)() * 360;
  return { deg, center: polar(R * 0.16, deg), r: R * 0.5, mouth: 25, neck: 36 };
}

/** Grados entre dos direcciones (de 0 a 180). */
const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/** Contorno de la isla con su golfo: `k` agranda la costa de fuera y `kb`, la orilla del golfo. */
function gulfOutline(isl, R, gulf, k = 1, kb = 1) {
  const h = islandCoast(isl);
  const flat = (v) => new THREE.Vector2(v.x, -v.z);
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const deg = gulf.deg + gulf.mouth + (i / 64) * (360 - 2 * gulf.mouth);
    pts.push(flat(polar(R * k * coastFactor(h, THREE.MathUtils.degToRad(deg)), deg)));
  }
  // La orilla del golfo, por dentro, de un lado de la bocana al otro
  for (let i = 0; i <= 40; i++) {
    const deg = gulf.deg - gulf.neck - (i / 40) * (360 - 2 * gulf.neck);
    pts.push(flat(gulf.center.clone().add(polar(gulf.r * kb, deg))));
  }
  return new THREE.Shape(pts);
}

/** Una losa de tierra con la forma dada, con su cara de arriba en `top` (y un talud si lleva `bevel`). */
function landSlab(shape, depth, top, color, bevel) {
  let geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel * 0.4, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, top - depth - bevel * 0.4, 0);
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (typeof color === 'function') paintByNormal(geo, color);
  const m = new THREE.Mesh(geo, typeof color === 'function' ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }) : mat(color));
  m.receiveShadow = true;
  return m;
}

/** Espuma a ras de agua entre dos líneas de puntos (de dentro y de fuera). */
function foamStrip(inner, outer) {
  const pos = [];
  for (let i = 1; i < inner.length; i++) {
    const [a, b, c, d] = [inner[i - 1], outer[i - 1], outer[i], inner[i]];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat('#ffffff', { ...FOAM, side: THREE.DoubleSide }));
  m.userData.solo = true;
  return m;
}

/**
 * La isla de una fosa: la media luna de tierra (matorral, montes al fondo y algún árbol), su playa,
 * la espuma de las dos orillas y las aguas hondas del golfo, más oscuras hacia el centro. `far`: solo
 * la tierra y el golfo (la isla vista de lejos).
 */
function gulfBase(isl, R, rand, seed, far = false) {
  const g = new THREE.Group();
  const gulf = gulfOf(isl, R);
  const h = islandCoast(isl);
  const coastAt = (deg) => R * coastFactor(h, THREE.MathUtils.degToRad(deg));
  g.add(landSlab(gulfOutline(isl, R, gulf), 2, ISLAND_TOP, (ny, cy) => (ny > 0.7 ? GULF_LAND.grass : cy > -0.6 ? GULF_LAND.cliff : GULF_LAND.rock), 0.8));
  g.add(landSlab(gulfOutline(isl, R, gulf, 1.12, 0.84), 1.3, -0.45, GULF_LAND.sand, 0));
  for (const [k, color, opacity] of [[0.84, '#123447', 0.5], [0.5, '#06141f', 0.55]]) {
    const deep = new THREE.Mesh(new THREE.CircleGeometry(gulf.r * k, 40), mat(color, { transparent: true, opacity, depthWrite: false }));
    deep.rotation.x = -Math.PI / 2;
    deep.position.copy(gulf.center).setY(WATER_Y + 0.06 + (1 - k) * 0.02);
    g.add(deep);
  }
  if (far) return g;

  // La espuma: por fuera de la isla y por la orilla del golfo
  const y = WATER_Y + 0.05;
  const outer = [], outer2 = [], bay = [], bay2 = [];
  for (let i = 0; i <= 64; i++) {
    const deg = gulf.deg + gulf.mouth + (i / 64) * (360 - 2 * gulf.mouth);
    outer.push(polar(coastAt(deg) * 1.12, deg, y));
    outer2.push(polar(coastAt(deg) * 1.18, deg, y));
  }
  for (let i = 0; i <= 40; i++) {
    const deg = gulf.deg - gulf.neck - (i / 40) * (360 - 2 * gulf.neck);
    bay.push(gulf.center.clone().add(polar(gulf.r * 0.84, deg, y)));
    bay2.push(gulf.center.clone().add(polar(gulf.r * 0.78, deg, y)));
  }
  g.add(foamStrip(outer, outer2), foamStrip(bay, bay2));

  // Montes al fondo de la media luna, lejos del golfo
  const back = gulf.deg + 180;
  const hills = [];
  for (const [da, k, s] of [[0, 0.7, 0.24], [-55, 0.72, 0.17], [58, 0.72, 0.15]]) {
    const deg = back + da;
    const p = polar(coastAt(deg) * k, deg, ISLAND_TOP - 0.05);
    const hill = new THREE.Mesh(
      mountainGeometry(R * s, R * s * 1.4, (seed + da + 97) % 97, { snow: '#9a948a', grass: GULF_LAND.grass, rock: GULF_LAND.rock }),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    );
    hill.position.copy(p);
    hill.castShadow = hill.receiveShadow = true;
    g.add(hill);
    hills.push({ p, r: R * s });
  }
  // Matorral, cipreses y rocas por la tierra firme (ni en el golfo, ni en la bocana, ni en los montes)
  const onLand = (p) => {
    const deg = THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z));
    return apart(deg, gulf.deg) > gulf.mouth + 14 && p.length() < coastAt(deg) * 0.84 && p.distanceTo(gulf.center) > gulf.r * 1.2 && hills.every((h) => p.distanceTo(h.p) > h.r * 0.9);
  };
  const decor = new Batch();
  for (let i = 0, made = 0; i < 400 && made < R * 1.6; i++) {
    const p = polar(R * (0.2 + rand() * 0.7), rand() * 360, ISLAND_TOP);
    if (!onLand(p)) continue;
    const t = rand() < 0.35 ? cypress('#3f5e3a') : mediterraneanTree(rand());
    t.position.copy(p);
    t.scale.setScalar(0.8 + rand() * 0.5);
    t.rotation.y = rand() * Math.PI;
    decor.add(t);
    made++;
  }
  for (let i = 0, made = 0; i < 200 && made < R; i++) {
    const p = polar(R * (0.2 + rand() * 0.7), rand() * 360, ISLAND_TOP);
    if (!onLand(p)) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.45), i % 3 ? '#8a8378' : '#6f8450');
    rock.position.copy(p).setY(ISLAND_TOP + 0.12);
    rock.scale.y = 0.6;
    decor.add(rock);
    made++;
  }
  // Rocas en la costa de fuera, batidas por las olas
  for (let i = 0; i < 9; i++) {
    const deg = rand() * 360;
    if (apart(deg, gulf.deg) < gulf.mouth + 6) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(0.6 + rand() * 0.8), GULF_LAND.rock);
    rock.position.copy(polar(coastAt(deg) * (1.16 + rand() * 0.1), deg, WATER_Y - 0.1));
    rock.scale.y = 0.6;
    decor.add(rock);
  }
  g.add(decor.build());
  return g;
}

/**
 * Lo que hay en la fosa: al fondo del golfo, las ruinas medio hundidas donde viven los tritones; sus
 * hipocampos nadando por el golfo; un pecio encallado en la bocana; y, con `alive` (tu último bote
 * vio al Kraken aquí), el Kraken saliendo de las aguas hondas del centro, mirando al mar.
 */
function lair(g, isl, R, rand, alive) {
  const gulf = gulfOf(isl, islandRadius(isl));
  const c = gulf.center.clone().divideScalar(FEATURE_SCALE);
  const rb = gulf.r / FEATURE_SCALE;
  const back = gulf.deg + 180;
  const toSea = THREE.MathUtils.degToRad(gulf.deg);
  const at = (deg, k, y = 0) => c.clone().add(polar(rb * k, deg, y));
  const BEACH = (-0.45 - ISLAND_TOP) / FEATURE_SCALE;

  sunkenRuins(g, at, back, rand, BEACH);

  // Los tritones: en la escalinata, entre las columnas de la playa y en el agua, mirando al golfo
  const guards = [[back - 8, 0.98, 0.0], [back + 9, 0.86, -0.25], [back - 38, 0.82, BEACH], [back + 30, 0.84, BEACH], [back + 62, 0.86, BEACH], [back - 20, 0.6, SEA - 0.25], [back + 46, 0.58, SEA - 0.25]];
  for (const [deg, k, y] of guards) {
    const t = createSoldier('triton');
    t.scale.setScalar(1.9);
    t.position.copy(at(deg, k, y));
    t.rotation.y = toSea + (rand() - 0.5) * 0.9;
    g.add(t);
  }
  // Sus hipocampos, nadando por el golfo
  for (let i = 0; i < 3; i++) {
    const deg = back + (i - 1) * 75 + (rand() - 0.5) * 20;
    const hc = createShip('hipocampo');
    hc.scale.setScalar(1.6);
    hc.position.copy(at(deg, 0.62, SEA));
    hc.rotation.y = THREE.MathUtils.degToRad(deg) + (i % 2 ? Math.PI / 2 : -Math.PI / 2);
    hc.userData.bob = { amp: 0.1, speed: 1.2 + i * 0.25, base: SEA };
    g.add(hc);
  }
  // Un barco que no salió del golfo, encallado en la bocana
  const side = gulf.deg + gulf.mouth * 0.45;
  const w = wreck(rand, 0);
  w.position.copy(polar((islandRadius(isl) / FEATURE_SCALE) * 0.92, side, SEA - 0.25));
  w.rotation.set(0, THREE.MathUtils.degToRad(side) + 0.6, 0.35);
  g.add(w);

  if (alive) {
    // (más pequeño que en mar abierto: cabe en el golfo, hundido hasta medio cuerpo)
    kraken(g, c.clone().setY(SEA - 0.6), toSea, rand, 0.62);
    return;
  }
  // Sin el Kraken, el centro del golfo apenas se riza
  for (const [r, speed] of [[1.1, 0.25], [2.1, -0.18]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 4, 36, Math.PI * 1.4), mat('#5f8fa8', { transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(c).setY(SEA + 0.05);
    ring.userData.spin = { axis: 'z', speed };
    g.add(ring);
  }
}

/**
 * Las ruinas del fondo del golfo, medio sepultadas por el agua: una columnata en arco (la fila de
 * delante, con el agua por la cintura y verde de algas), una escalinata que baja al mar, un arco en
 * la playa, la estatua de Poseidón hundida hasta el pecho, el frontón caído, sillares y tambores de
 * columna en el agua y muros derrumbados en la orilla. `at(deg, k, y)`: un punto del golfo.
 */
function sunkenRuins(g, at, back, rand, BEACH) {
  const stone = () => RUIN[Math.floor(rand() * RUIN.length)];
  const rad = THREE.MathUtils.degToRad;
  // La columnata: una fila en la playa y otra dentro del agua
  for (const [k, base, wet] of [[0.92, BEACH - 0.1, false], [0.68, SEA - 0.9, true]]) {
    const tops = [];
    for (let i = 0; i < 7; i++) {
      const deg = back + (i - 3) * 17;
      const p = at(deg, k, base);
      const whole = rand() < 0.6;
      const h = whole ? 3 : 1 + rand() * 1.2;
      const col = column(p.x, p.y, p.z, h, 0.2, stone());
      const lean = !whole || rand() < 0.75 ? 0 : (rand() < 0.5 ? -1 : 1) * (0.1 + rand() * 0.1);
      col.rotation.set(lean * 0.6, 0, lean);
      g.add(col);
      if (wet) g.add(cyl(0.26, 0.28, 0.45, 10, ALGAE, p.x, SEA - 0.25, p.z));
      tops.push(whole && !lean ? new THREE.Vector3(p.x, p.y + h, p.z) : null);
    }
    // Lo que queda del arquitrabe, entre las columnas que siguen en pie
    for (let i = 1; i < tops.length; i++) {
      const [a, b] = [tops[i - 1], tops[i]];
      if (!a || !b) continue;
      const beam = box(a.distanceTo(b) + 0.5, 0.35, 0.5, RUIN[0], 0, 0, 0);
      beam.position.copy(a).lerp(b, 0.5);
      beam.rotation.y = Math.atan2(b.z - a.z, b.x - a.x) * -1;
      g.add(beam);
    }
  }
  // La escalinata, de la orilla al agua
  for (let i = 0; i < 7; i++) {
    const top = -0.05 - i * ((-SEA + 0.4) / 6);
    const step = box(3.4 - i * 0.05, 0.6, 0.62, i % 2 ? RUIN[1] : RUIN[0], 0, 0, 0);
    step.position.copy(at(back, 1.1 - i * 0.075)).setY(top - 0.6);
    step.rotation.y = rad(back);
    g.add(step);
  }
  // Un arco en la playa, con un pilar partido
  const arch = new THREE.Group();
  arch.position.copy(at(back + 72, 0.98, BEACH - 0.1));
  arch.rotation.y = rad(back + 72);
  arch.add(box(0.6, 3, 0.6, RUIN[0], -1.1, 0, 0), box(0.6, 1.5, 0.6, RUIN[1], 1.1, 0, 0));
  const lintel = box(3, 0.5, 0.65, RUIN[2], 0, 0, 0);
  lintel.position.set(-0.3, 2.75, 0);
  lintel.rotation.z = -0.35;
  arch.add(lintel);
  g.add(arch);
  // Poseidón, de bronce verde, hundido hasta el pecho y algo torcido, con el tridente en alto
  const god = new THREE.Group();
  const s = 4.4;
  const fig = figure({ color: PATINA, skin: PATINA, hair: '#4a7a66', beard: true, long: true, drape: '#557f6c', arms: ['arriba', 'abajo'] });
  fig.traverse((o) => o.isMesh && (o.material = mat(o.material.color.getStyle(), { metalness: 0.45, roughness: 0.5 })));
  fig.scale.setScalar(s);
  god.add(fig);
  const hand = new THREE.Vector3(0.21 * s, 0.61 * s, 0);
  god.add(cyl(0.05, 0.05, 3.2, 6, '#4f7a66', hand.x, hand.y - 1.6, 0.05));
  god.add(box(0.7, 0.08, 0.08, '#c9a24a', hand.x, hand.y + 1.5, 0.05));
  for (const dx of [-0.3, 0, 0.3]) {
    const prong = mesh(new THREE.ConeGeometry(0.07, dx ? 0.55 : 0.7, 4), '#c9a24a', { metalness: 0.5, roughness: 0.35 });
    prong.position.set(hand.x + dx, hand.y + 1.85 + (dx ? 0 : 0.07), 0.05);
    god.add(prong);
  }
  god.position.copy(at(back + 28, 0.4, SEA - 1.5));
  god.rotation.set(0.08, rad(back + 180), 0.12);
  g.add(god);
  // El frontón caído, medio en el agua
  const pediment = gableRoof(3, 0.8, 0.45, RUIN[1], 0, 0, 0);
  pediment.position.copy(at(back - 42, 0.5, SEA - 0.35));
  pediment.rotation.set(0.35, rad(back - 42), 0.25);
  g.add(pediment);
  // Sillares y tambores de columna asomando del agua
  for (let i = 0; i < 16; i++) {
    const deg = back + (rand() - 0.5) * 150;
    const p = at(deg, 0.4 + rand() * 0.45, SEA - 0.3);
    if (rand() < 0.4) {
      const drum = cyl(0.2, 0.2, 0.7, 10, stone(), 0, 0, 0);
      drum.rotation.set(Math.PI / 2, rand() * Math.PI, 0);
      drum.position.copy(p).setY(SEA - 0.05);
      g.add(drum);
    } else {
      const block = box(0.6 + rand() * 0.6, 0.5, 0.5 + rand() * 0.5, stone(), 0, 0, 0);
      block.position.copy(p);
      block.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
      g.add(block);
    }
  }
  // Muros derrumbados en la orilla, por detrás de la columnata
  for (let i = 0; i < 7; i++) {
    const deg = back + (i - 3) * 24 + (rand() - 0.5) * 8;
    const len = 1.4 + rand() * 1.8;
    const wall = box(len, 0.4 + rand() * 1, 0.45, stone(), 0, 0, 0);
    wall.position.copy(at(deg, 1.22 + rand() * 0.12, -0.02));
    wall.rotation.y = rad(deg);
    g.add(wall);
  }
}

/** Lo que queda de un barco: la quilla, las cuadernas al aire, unas tablas y el mástil tronchado. */
function wreck(rand, k) {
  const w = new THREE.Group();
  const wood = ['#3b2a1e', '#4a3424', '#2f2218'][k % 3];
  w.add(box(0.3, 0.3, 4.6, wood, 0, -0.45, 0));
  for (let i = 0; i < 8; i++) {
    const z = -1.9 + i * 0.55;
    const arc = Math.PI * (rand() < 0.3 ? 0.55 : 1);
    const rib = mesh(new THREE.TorusGeometry(1.05 - Math.abs(z) * 0.12, 0.07, 4, 10, arc), wood);
    rib.rotation.z = Math.PI;
    rib.position.set(0, 0.65, z);
    w.add(rib);
  }
  // Las tablas que aún tapan un costado y la borda
  for (let i = 0; i < 5; i++) w.add(box(0.08, 0.22, 3.6 - i * 0.45, wood, -0.95 + i * 0.03, -0.3 + i * 0.22, 0));
  w.add(box(0.1, 0.1, 3.2, '#2a1e16', 0.98, 0.6, 0.1));
  // El mástil partido, con un jirón de vela
  const mast = cyl(0.09, 0.11, 2.4, 6, '#5a4430', 0, 0, 0);
  mast.position.set(0.1, 0.9, 0.4);
  mast.rotation.set(0.5, 0, 0.7);
  w.add(mast);
  const rag = box(0.9, 0.7, 0.03, ['#8a7a60', '#5a4a3a', '#3a3430'][k % 3], 0, 0, 0);
  rag.position.set(0.9, 1.3, 0.75);
  rag.rotation.set(0.5, 0.3, 0.7);
  w.add(rag);
  return w;
}

/** Un alga larga que se mece con la corriente. */

function kraken(g, at, facing, rand, size = 1) {
  const k = new THREE.Group();
  k.position.copy(at);
  k.rotation.y = facing;
  k.scale.setScalar(size);
  // La base, ancha, a ras de agua, y el manto encima
  const base = mesh(new THREE.SphereGeometry(2.3, 16, 10), KRAKEN_SKIN[1]);
  base.scale.set(1, 0.5, 1);
  base.position.y = 0.3;
  k.add(base);
  const mantle = new THREE.Group();
  mantle.position.set(0, 1.4, -0.4);
  mantle.rotation.x = -0.3;
  const dome = mesh(new THREE.SphereGeometry(2, 18, 12), KRAKEN_SKIN[0]);
  dome.scale.set(1, 1.6, 1.05);
  dome.position.y = 2;
  mantle.add(dome);
  // Las manchas oscuras del manto
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2, h = 0.6 + rand() * 2.6;
    const r = 2 * Math.sqrt(Math.max(0.05, 1 - ((h - 2) / 3.2) ** 2));
    const spot = mesh(new THREE.SphereGeometry(0.18 + rand() * 0.16, 6, 4), '#5a2a42');
    spot.position.set(Math.sin(a) * r, h, Math.cos(a) * r * 1.05);
    spot.scale.set(1, 0.6, 1);
    mantle.add(spot);
  }
  k.add(mantle);
  // Las cejas, los ojos (con su pupila rasgada) y el pico, en la parte de delante
  for (const sx of [-1, 1]) {
    const brow = mesh(new THREE.SphereGeometry(0.6, 10, 7), KRAKEN_SKIN[1]);
    brow.position.set(sx * 1.1, 2.4, 1.45);
    brow.scale.set(1.1, 0.5, 0.8);
    k.add(brow);
    const eye = mesh(new THREE.SphereGeometry(0.55, 14, 10), '#ffd23a', { emissive: '#ffb000', emissiveIntensity: 2 });
    eye.position.set(sx * 1.1, 1.9, 1.7);
    eye.scale.z = 0.55;
    k.add(eye, box(0.11, 0.75, 0.06, '#0a0608', sx * 1.1, 1.53, 2.01));
  }
  const beak = mesh(new THREE.ConeGeometry(0.28, 0.7, 6), '#2a1a20');
  beak.position.set(0, 1.05, 2.15);
  beak.rotation.x = 2.2;
  k.add(beak);
  g.add(k);
  // Sus tentáculos, que salen de la base y se abren hacia fuera (por los lados y por detrás: la cara, despejada)
  const front = THREE.MathUtils.radToDeg(facing);
  for (let i = 0; i < 8; i++) {
    const deg = front + 50 + i * (260 / 7) + (rand() - 0.5) * 12;
    const t = tentacle(rand, (1.45 + rand() * 0.45) * size);
    t.position.copy(at).add(polar((2 + rand() * 0.4) * size, deg)).setY(SEA - 0.5);
    t.rotation.y = THREE.MathUtils.degToRad(deg) - Math.PI / 2;
    g.add(t);
  }
}

/** Un tentáculo del Kraken: se estrecha hacia la punta, con ventosas por dentro, y se retuerce. */
function tentacle(rand, size = 1) {
  const root = new THREE.Group();
  let parent = root;
  const segments = 9;
  const curl = 0.16 + rand() * 0.14;
  for (let i = 0; i < segments; i++) {
    const r = (0.62 * (1 - i / segments) + 0.07) * size;
    const len = 0.95 * size;
    const seg = new THREE.Group();
    seg.add(cyl(r * 0.82, r, len, 8, KRAKEN_SKIN[i % 2]));
    const joint = mesh(new THREE.SphereGeometry(r * 0.9, 8, 6), KRAKEN_SKIN[i % 2]);
    seg.add(joint);
    // Las ventosas, en la cara de dentro
    for (const y of [0.3, 0.65]) {
      const s = mesh(new THREE.SphereGeometry(r * 0.32, 6, 4), SUCKER);
      s.position.set(r * 0.85, y * len, 0);
      s.scale.x = 0.5;
      seg.add(s);
    }
    seg.position.y = i === 0 ? 0 : len * 0.92;
    // (ya curvado desde el principio: en los retratos no se anima)
    seg.userData.wiggle = { base: -curl, amp: 0.14, speed: 0.8 + rand() * 0.4, phase: i * 0.55 + rand() * 3 };
    seg.rotation.z = -curl;
    parent.add(seg);
    parent = seg;
  }
  return root;
}


// ── Gestas: Tifón ────────────────────────────────────────────────────────────

const BASALT_DARK = '#2a2422';
const LAVA = { emissive: '#ff4500', emissiveIntensity: 2.2 };
const SERPENT = '#2f6b5a';
const SERPENT_BELLY = '#c9b36a';

/** La estatua dorada de una gesta ganada, sobre su pedestal, en una plaza de la ciudad. */
function featStatue(g, R, theme) {
  const s = featStatueModel(theme);
  s.position.copy(polar(R * 0.22, 135));
  s.scale.setScalar(0.95);
  g.add(s);
}

/**
 * Funde las piezas de una figura en dos mallas con sombreado suave: piedra (mármol, madera) y metal
 * (el oro, que brilla). Lo que se enciende se queda aparte; el resto de la escena no las toca.
 */
function fuseSmooth(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = { stone: [], metal: [] };
  const done = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.solo) return;
    const m = o.material;
    if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) m.color.toArray(colors, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groups[m.metalness > 0.2 ? 'metal' : 'stone'].push(geo);
    done.push(o);
  });
  for (const o of done) {
    o.geometry.dispose();
    o.parent.remove(o);
  }
  const materials = {
    stone: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    metal: () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.32 }),
  };
  for (const [kind, pieces] of Object.entries(groups)) {
    if (!pieces.length) continue;
    const one = new THREE.Mesh(mergeGeometries(pieces), materials[kind]());
    one.castShadow = one.receiveShadow = true;
    one.userData.solo = true;
    root.add(one);
    for (const p of pieces) p.dispose();
  }
}

/** Cilindro de `a` a `b` (radios r1 en a y r2 en b): un miembro de la estatua. */
function limb(g, a, b, r1, r2, color, extra, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = mesh(new THREE.CylinderGeometry(r2, r1, d.length(), seg), color, extra);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.add(m);
  return m;
}

/** Esfera escalada (músculos, hombros, manos). */
function blob(g, r, color, x, y, z, sx = 1, sy = 1, sz = 1, extra) {
  const m = mesh(new THREE.SphereGeometry(r, 10, 8), color, extra);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  g.add(m);
  return m;
}

/** Brasero de bronce sobre un pilar con paneles azules y su greca; arde siempre. */
function statueBrazier(g, x, z, y = 0) {
  g.add(box(0.28, 0.06, 0.28, '#e3d6b8', x, y, z));
  g.add(box(0.22, 0.5, 0.22, '#efe5cf', x, y + 0.06, z));
  for (const [dx, dz, rot] of [[0, 0.112, 0], [0, -0.112, 0], [0.112, 0, Math.PI / 2], [-0.112, 0, Math.PI / 2]]) {
    const panel = box(0.16, 0.3, 0.01, '#2a56a8', 0, 0, 0);
    panel.position.set(x + dx, y + 0.14, z + dz);
    panel.rotation.y = rot;
    g.add(panel);
    const trim = box(0.17, 0.025, 0.012, C.gold, 0, 0, 0, { metalness: 0.5, roughness: 0.4 });
    trim.position.set(x + dx, y + 0.44, z + dz);
    trim.rotation.y = rot;
    g.add(trim);
  }
  g.add(box(0.27, 0.05, 0.27, '#e3d6b8', x, y + 0.56, z));
  g.add(cyl(0.05, 0.07, 0.07, 8, '#a8843a', x, y + 0.61, z, { metalness: 0.55, roughness: 0.4 }));
  g.add(cyl(0.17, 0.08, 0.1, 12, '#b8913e', x, y + 0.68, z, { metalness: 0.55, roughness: 0.4 }));
  g.add(cyl(0.14, 0.14, 0.02, 12, C.dark, x, y + 0.77, z, WINDOW_GLOW));
  const fire = makeFire(x, y + 0.78, z, 0.322);
  g.add(fire);
}

/**
 * La estatua de una gesta ganada: un hoplita de mármol con casco de penacho, capa al viento, lanza
 * en alto y el gran escudo redondo de oro (con la gema del tema en el centro: el rayo de Zeus, la
 * tiara del Gran Rey o la cabeza de la Hidra), sobre un pedestal con columnas, greca y estandarte
 * azul, en una plataforma escalonada con braseros encendidos, arbustos y cipreses. Mira hacia +Z.
 */
export function featStatueModel(theme) {
  const s = new THREE.Group();
  const M = '#ece1c8';
  const M2 = '#dccdab';
  const GOLD = { metalness: 0.55, roughness: 0.35 };
  const mark = { tifon: '#ffd34a', armada: '#7a3fa0', hidra: '#2f6b5a' }[theme] ?? C.gold;

  // Plataforma de tres gradas
  for (let i = 0; i < 3; i++) s.add(box(2.0 - i * 0.22, 0.12, 2.0 - i * 0.22, i % 2 ? '#e3d6b8' : '#ebe0c6', 0, i * 0.12, 0));
  const top = 0.36;
  // Pedestal con columnas en las esquinas, greca y cornisa
  const pw = 1.05;
  const pd = 0.85;
  const ph = 0.72;
  s.add(box(pw + 0.12, 0.08, pd + 0.12, M2, 0, top, 0));
  s.add(box(pw, ph, pd, M, 0, top + 0.08, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) s.add(column(x * (pw / 2), top + 0.08, z * (pd / 2), ph - 0.12, 0.06, '#f4efe4'));
  greekKey(s, pw + 0.08, pd + 0.08, top + 0.08 + ph - 0.16, 0.14);
  s.add(box(pw + 0.16, 0.07, pd + 0.16, M2, 0, top + 0.08 + ph - 0.02, 0));
  // Delante: estandarte azul con su greca, y un medallón de oro con la gema del tema
  const front = pd / 2 + 0.012;
  s.add(box(0.3, 0.46, 0.015, '#2a56a8', -0.24, top + 0.12, front));
  s.add(box(0.3, 0.03, 0.02, C.gold, -0.24, top + 0.12, front, GOLD), box(0.3, 0.03, 0.02, C.gold, -0.24, top + 0.56, front, GOLD));
  s.add(cyl(0.012, 0.012, 0.36, 5, C.gold, -0.24, top + 0.6 - 0.18, front + 0.02, GOLD).rotateZ(Math.PI / 2));
  const medal = cyl(0.12, 0.12, 0.03, 16, C.gold, 0.24, top + 0.32, front, GOLD);
  medal.rotation.x = Math.PI / 2;
  medal.position.y = top + 0.4;
  s.add(medal);
  const medalGem = mesh(new THREE.OctahedronGeometry(0.06, 0), mark, { emissive: mark, emissiveIntensity: 0.8 });
  medalGem.position.set(0.24, top + 0.4, front + 0.03);
  s.add(medalGem);
  // La roca sobre la que pisa
  const rockY = top + 0.08 + ph + 0.05;
  s.add(box(0.78, 0.12, 0.6, M2, 0, rockY, 0));
  const ledge = box(0.32, 0.16, 0.3, M2, 0.22, rockY + 0.1, 0.12);
  ledge.rotation.set(0.08, 0.4, -0.1);
  s.add(ledge);

  // ── El hoplita (unos 2 de alto; los pies en y = 0 del grupo). La lanza va a su derecha (-X,
  // a la izquierda de quien lo mira de frente) y el escudo a su izquierda (+X) ──
  const h = new THREE.Group();
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const SM = { flatShading: false };
  const GS = { ...GOLD, flatShading: false };
  const S = -1;
  // Piernas: la derecha atrás, la izquierda adelantada y en alto sobre la roca
  const legs = [
    { hip: v(S * 0.1, 1.0, -0.01), knee: v(S * 0.17, 0.55, -0.05), foot: v(S * 0.21, 0.06, -0.12) },
    { hip: v(0.1, 1.0, 0.02), knee: v(0.19, 0.64, 0.17), foot: v(0.21, 0.2, 0.13) },
  ];
  for (const { hip, knee, foot } of legs) {
    limb(h, hip, knee, 0.115, 0.08, M, SM, 10);
    limb(h, knee, foot, 0.082, 0.056, M2, SM, 10);
    blob(h, 0.072, M, knee.x, knee.y, knee.z + 0.01, 1, 1, 1, SM);
    // Greba con filete de oro y sandalia
    const k = mesh(new THREE.TorusGeometry(0.07, 0.013, 5, 14), C.gold, GS);
    k.position.copy(knee).lerp(foot, 0.1);
    k.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(foot, knee).normalize());
    h.add(k);
    h.add(box(0.1, 0.06, 0.22, M2, foot.x, foot.y - 0.06, foot.z + 0.05));
  }
  // Falda de tiras (pteruges) y cinturón de oro con su hebilla
  h.add(cyl(0.17, 0.23, 0.28, 16, M, 0, 0.8, 0, SM));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const strip = box(0.075, 0.27, 0.02, k % 2 ? M2 : M, 0, -0.27, 0);
    strip.position.set(Math.sin(a) * 0.19, 1.06, Math.cos(a) * 0.19);
    strip.rotation.set(-0.24, a, 0, 'YXZ');
    h.add(strip);
  }
  h.add(cyl(0.185, 0.185, 0.06, 16, C.gold, 0, 1.05, 0, GS));
  const buckle = cyl(0.045, 0.045, 0.03, 12, C.gold, 0, 0, 0, GS);
  buckle.rotation.x = Math.PI / 2;
  buckle.position.set(0, 1.08, 0.18);
  h.add(buckle);
  // Torso musculoso: tronco en uve, pectorales, abdominales y hombros
  blob(h, 0.22, M, 0, 1.33, 0, 1.18, 1.22, 0.68, SM);
  limb(h, v(0, 1.05, 0), v(0, 1.25, 0), 0.165, 0.2, M, SM, 14).scale.z = 0.72;
  for (const sx of [-1, 1]) {
    blob(h, 0.1, M, sx * 0.09, 1.42, 0.07, 1.2, 0.62, 0.42, SM);
    blob(h, 0.105, M, sx * 0.27, 1.5, 0, 1, 1, 1, SM);
  }
  for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) blob(h, 0.04, M, sx * 0.047, 1.15 + r * 0.075, 0.115, 1.1, 0.85, 0.55, SM);
  // Tahalí de oro cruzado al pecho
  const strap = box(0.045, 0.62, 0.02, C.gold, 0, 0, 0, GOLD);
  strap.position.set(0, 1.32, 0.155);
  strap.rotation.z = -0.75;
  h.add(strap);
  // Cuello y cabeza con nariz, cejas y barbilla
  limb(h, v(0, 1.53, 0), v(0, 1.65, 0.01), 0.075, 0.06, M, SM, 10);
  blob(h, 0.11, M, 0, 1.74, 0.01, 0.9, 1.1, 1, SM);
  h.add(box(0.03, 0.06, 0.04, M2, 0, 1.71, 0.11));
  blob(h, 0.05, M, 0, 1.64, 0.06, 1, 0.8, 0.8, SM);
  // Casco: calota, filete de oro, carrilleras y el penacho alto de delante atrás
  const cap = mesh(new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M2, SM);
  cap.position.set(0, 1.77, 0);
  cap.scale.y = 1.15;
  h.add(cap);
  h.add(cyl(0.128, 0.13, 0.035, 14, C.gold, 0, 1.755, 0, GS));
  for (const sx of [-1, 1]) {
    const cheek = box(0.03, 0.12, 0.09, M2, sx * 0.1, 1.64, 0.04);
    cheek.rotation.z = sx * -0.12;
    h.add(cheek);
  }
  h.add(box(0.05, 0.06, 0.14, C.gold, 0, 1.89, 0, GOLD));
  const crest = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.11, 20, 1, false, 0, Math.PI), M, SM);
  crest.rotation.z = Math.PI / 2;
  crest.position.set(0, 1.9, -0.03);
  h.add(crest);
  // Brazo derecho en alto con la lanza
  const shR = v(S * 0.3, 1.5, 0);
  const elR = v(S * 0.46, 1.36, 0.06);
  const haR = v(S * 0.48, 1.74, 0.1);
  limb(h, shR, elR, 0.075, 0.06, M, SM, 10);
  limb(h, elR, haR, 0.058, 0.046, M, SM, 10);
  blob(h, 0.066, M, haR.x, haR.y, haR.z, 1, 1.25, 1, SM);
  h.add(cyl(0.068, 0.068, 0.05, 12, C.gold, S * 0.37, 1.39, 0.03, GS));
  h.add(cyl(0.024, 0.024, 2.0, 6, '#7a5a32', haR.x, 0.0, haR.z, { metalness: 0.3, roughness: 0.6 }));
  h.add(cyl(0.042, 0.032, 0.12, 8, C.gold, haR.x, 2.02, haR.z, GOLD));
  const tip = mesh(new THREE.ConeGeometry(0.065, 0.32, 4), C.gold, GOLD);
  tip.position.set(haR.x, 2.3, haR.z);
  h.add(tip);
  // Brazo izquierdo abajo, embrazando el escudo
  const shL = v(0.3, 1.5, 0);
  const elL = v(0.42, 1.24, 0.08);
  const haL = v(0.42, 1.06, 0.22);
  limb(h, shL, elL, 0.075, 0.06, M, SM, 10);
  limb(h, elL, haL, 0.058, 0.046, M, SM, 10);
  h.add(cyl(0.068, 0.068, 0.05, 12, C.gold, 0.37, 1.39, 0.03, GS));
  // Escudo redondo de oro (aspis), vuelto hacia delante y algo hacia fuera
  const shield = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 28), '#c9a24a', GS);
  disc.rotation.x = Math.PI / 2;
  shield.add(disc);
  const rim = mesh(new THREE.TorusGeometry(0.44, 0.032, 6, 32), '#e8c25a', GS);
  rim.position.z = 0.02;
  shield.add(rim);
  const inner = mesh(new THREE.TorusGeometry(0.21, 0.013, 5, 24), '#e8c25a', GS);
  inner.position.z = 0.03;
  shield.add(inner);
  // Rayos de sol alrededor de la gema del tema
  for (let k = 0; k < 12; k++) {
    const ray = box(0.035, 0.15, 0.015, '#e8c25a', 0, 0, 0, GOLD);
    ray.geometry.translate(0, 0.12, 0);
    ray.rotation.z = (k / 12) * Math.PI * 2;
    ray.position.z = 0.03;
    shield.add(ray);
  }
  const gem = mesh(new THREE.OctahedronGeometry(0.09, 0), mark, { emissive: mark, emissiveIntensity: 0.8 });
  gem.position.z = 0.06;
  shield.add(gem);
  shield.position.set(0.55, 1.02, 0.26);
  shield.scale.setScalar(0.9);
  shield.rotation.y = 0.5;
  h.add(shield);
  // Capa: sobre los hombros, broche de oro, y cae ondeando por detrás hacia el lado de la lanza
  for (const sx of [-1, 1]) blob(h, 0.12, M2, sx * 0.24, 1.55, -0.03, 1.1, 0.6, 1, SM);
  const brooch = cyl(0.05, 0.05, 0.03, 12, C.gold, 0, 0, 0, GS);
  brooch.rotation.x = Math.PI / 2;
  brooch.position.set(S * 0.2, 1.55, 0.1);
  h.add(brooch);
  const capeGeo = new THREE.PlaneGeometry(0.6, 1.5, 10, 16);
  const cp = capeGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const t = (0.75 - cp.getY(i)) / 1.5;
    cp.setX(i, x * (1 + t * 0.7) + S * t * t * 0.4);
    cp.setZ(i, -t * 0.38 + Math.sin(x * 12 + t * 5) * 0.05 * (0.3 + t));
  }
  capeGeo.computeVertexNormals();
  const cape = mesh(capeGeo, M2, { side: THREE.DoubleSide, flatShading: false });
  cape.position.set(0, 1.55 - 0.75, -0.17);
  h.add(cape);

  h.position.y = rockY + 0.06;
  h.scale.setScalar(1.1);
  fuseSmooth(h);
  s.add(h);

  // Braseros, arbustos y cipreses alrededor
  for (const [x, z] of [[-0.82, 0.82], [0.82, 0.82], [-0.82, -0.82]]) statueBrazier(s, x, z, 0.12);
  for (const [x, z, r] of [[-0.62, 0.45, 0.11], [0.62, 0.45, 0.11], [0.62, -0.5, 0.1], [-0.6, -0.48, 0.1], [0, -0.55, 0.12]]) {
    const b = mesh(new THREE.SphereGeometry(r, 7, 5), '#5f8a3a');
    b.position.set(x, top + r * 0.6, z);
    s.add(b);
    const b2 = mesh(new THREE.SphereGeometry(r * 0.7, 7, 5), '#7a9c45');
    b2.position.set(x + r * 0.6, top + r * 0.5, z + r * 0.3);
    s.add(b2);
  }
  for (const [x, z, k] of [[0.82, -0.86, 0.55], [0.6, -0.95, 0.42], [-0.98, -0.5, 0.4]]) {
    const t = cypress('#2f5e34');
    t.scale.setScalar(k);
    t.position.set(x, 0.06, z);
    s.add(t);
  }
  return s;
}

/** Hacia dónde sale el volcán: en el mayor hueco entre los asentamientos del continente. */
function volcanoAngle(siteAngles, rand) {
  const a = [...siteAngles].map((x) => ((x % 360) + 360) % 360).sort((x, y) => x - y);
  if (!a.length) return rand() * 360;
  let best = 0;
  let at = a[0] + 180;
  for (let i = 0; i < a.length; i++) {
    const next = i + 1 < a.length ? a[i + 1] : a[0] + 360;
    if (next - a[i] > best) {
      best = next - a[i];
      at = (a[i] + next) / 2;
    }
  }
  return at;
}

/**
 * Tifón despierta junto al continente (`code`): «p» presagios (el volcán humea y se agrieta),
 * «0» sierpes en el mar, «1» gigantes en la orilla, «2» las cien cabezas («2f», en furia).
 * Lo estático se funde con el resto; la lava, el humo y lo que se mueve queda aparte.
 */
/** Dónde va lo de una gesta: hacia el mayor hueco entre asentamientos, junto a la costa. */
function featSpot(isl, R, rand) {
  const deg = volcanoAngle(isl.siteAngles ?? [], rand);
  const f = coastFactor(islandCoast(isl), THREE.MathUtils.degToRad(deg));
  return { deg, coastR: R * 1.08 * f };
}

function typhonRise(g, isl, R, rand, code) {
  const { deg, coastR } = featSpot(isl, R, rand);
  const vr = R * 0.17;
  const c = polar(coastR - vr * 1.05, deg);
  const top = R * 0.3;
  const out = (r, da = 0, y = 0) => polar(r, deg + da, y);

  // La base del volcán (algo más estrecha que su sitio en la costa)
  const vb = vr * 0.75;
  // El volcán: una montaña de basalto irregular, con venas de lava en la piedra
  const mountain = new THREE.Mesh(volcanoGeometry(vb, top, rand() * 100), volcanicSkin(code === 'p' ? 0.6 : code.endsWith('f') ? 1.4 : 0.9, { flat: true, scale: FEATURE_SCALE }));
  mountain.position.set(c.x, 0, c.z);
  mountain.castShadow = mountain.receiveShadow = true;
  mountain.userData.solo = true;
  g.add(mountain);
  for (let i = 0; i < 3; i++) {
    // Hombros de la montaña
    const p = polar(vb * (0.85 + rand() * 0.25), i * 120 + rand() * 50, 0);
    const shoulder = new THREE.Mesh(volcanoGeometry(vb * 0.5, top * (0.35 + rand() * 0.15), rand() * 100), volcanicSkin(0.5, { flat: true, scale: FEATURE_SCALE }));
    shoulder.position.set(c.x + p.x, 0, c.z + p.z);
    shoulder.userData.solo = true;
    g.add(shoulder);
  }
  for (let i = 0; i < 10; i++) {
    const p = polar(vb * (1.05 + rand() * 0.6), rand() * 360, 0);
    const rock = mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.45, 0), BASALT_DARK);
    rock.position.set(c.x + p.x, 0.2, c.z + p.z);
    g.add(rock);
  }
  // Cráter con lava que late y el borde al rojo
  g.add(cyl(vb * 0.24, vb * 0.32, top * 0.08, 9, BASALT_DARK, c.x, top * 0.9 - 0.3, c.z));
  const rim = mesh(new THREE.TorusGeometry(vb * 0.27, vb * 0.035, 6, 18), '#ff6a1a', { ...LAVA, emissiveIntensity: 1.4 });
  rim.rotation.x = Math.PI / 2;
  rim.position.set(c.x, top * 0.97 - 0.3, c.z);
  g.add(rim);
  const pool = cyl(vb * 0.2, vb * 0.2, 0.15, 9, '#ff6a1a', c.x, top * 0.97 - 0.3, c.z, LAVA);
  pool.userData.flicker = true;
  g.add(pool);
  // Ríos de lava por las laderas (una sola pieza)
  const rivers = [];
  const n = code === 'p' ? 2 : 6;
  for (let i = 0; i < n; i++) {
    const a = THREE.MathUtils.degToRad(rand() * 360);
    const len = Math.hypot(top, vb) * (0.6 + rand() * 0.35);
    const geo = new THREE.BoxGeometry(0.45 + rand() * 0.45, 0.45, len);
    // Algo levantada sobre la ladera para que asome
    geo.translate(0, 0.18, len / 2);
    geo.rotateX(Math.atan2(top, vb));
    geo.rotateY(a);
    geo.translate(c.x, top * 0.9 - 0.3, c.z);
    rivers.push(geo);
  }
  const lava = new THREE.Mesh(mergeGeometries(rivers), mat('#ff5a1a', { ...LAVA, emissiveIntensity: code.endsWith('f') ? 3 : 1.6 }));
  for (const geo of rivers) geo.dispose();
  g.add(lava);
  // Nubes de ceniza al pie del volcán
  for (let i = 0; i < (code === 'p' ? 4 : 8); i++) {
    const p = polar(vb * (0.9 + rand() * 0.5), rand() * 360, 0);
    const puff = mesh(new THREE.DodecahedronGeometry(vb * (0.16 + rand() * 0.14), 1), i % 2 ? '#5a4a42' : '#7a6658');
    puff.position.set(c.x + p.x, top * (0.15 + rand() * 0.35), c.z + p.z);
    puff.scale.y = 0.7;
    g.add(puff);
  }
  // Humo
  for (let i = 0; i < (code === 'p' ? 2 : 3); i++) {
    const smoke = smokeColumn(c.x + (i - 1) * vr * 0.12, top * 0.95 - 0.3, c.z, i * 1.7);
    smoke.scale.setScalar(2.2 + i * 0.4);
    g.add(smoke);
  }
  if (code === 'p') return;

  // Tifón sale del cráter: más serpientes en la fase de las cien cabezas, y en furia arde más
  const fury = code.endsWith('f');
  // (las venas de su piel, del mismo tamaño que las del volcán: su escala respecto a la isla)
  const giant = typhonGiant(rand, { snakes: code.startsWith('2') ? 9 : 5, fury, rockScale: vr * 0.26 * FEATURE_SCALE });
  giant.position.set(c.x, top * 0.82 - 0.3, c.z);
  giant.rotation.y = THREE.MathUtils.degToRad(deg);
  giant.scale.setScalar(vr * 0.26);
  // Respira: sube y baja despacio y se balancea un poco
  giant.userData.bob = { amp: vr * 0.05, speed: 0.7, base: giant.position.y };
  g.add(giant);
  // Rocas encendidas que el volcán escupe y flotan alrededor
  for (let i = 0; i < 5; i++) {
    const p = polar(vr * (0.8 + rand() * 0.6), rand() * 360, 0);
    const y = top * (1 + rand() * 0.9);
    const rock = mesh(new THREE.DodecahedronGeometry(0.22 + rand() * 0.25, 0), BASALT_DARK);
    rock.position.set(c.x + p.x, y, c.z + p.z);
    rock.userData.bob = { amp: 0.6, speed: 0.6 + rand() * 0.6, base: y };
    g.add(rock);
  }

  if (code === '0') {
    // El mar hierve: sierpes que asoman entre las olas frente al volcán
    for (let i = 0; i < 5; i++) {
      const s = serpent(rand);
      const p = out(coastR + R * (0.12 + rand() * 0.22), (i - 2) * 9 + rand() * 4);
      s.position.set(p.x, SEA - 0.15, p.z);
      s.rotation.y = rand() * Math.PI * 2;
      s.userData.bob = { amp: 0.25, speed: 0.8 + rand() * 0.5, base: SEA - 0.15 };
      g.add(s);
    }
    return;
  }
  if (code === '1') {
    // Los hijos de Gea: gigantes de piedra en la orilla, con rocas en las manos
    for (let i = 0; i < 4; i++) {
      const giant = figure({ skin: '#b5a690', hair: '#4a4038', color: '#7d6f5e', beard: true, arms: i % 2 ? ['arriba', 'abajo'] : ['adelante', 'arriba'] });
      const p = polar(vr * (1.25 + rand() * 0.35), (i - 1.5) * 38 + deg + 180, 0);
      giant.position.set(c.x + p.x, 0, c.z + p.z);
      giant.rotation.y = THREE.MathUtils.degToRad(deg + 180 + (rand() - 0.5) * 60);
      giant.scale.setScalar(9 + rand() * 2);
      g.add(giant);
      const boulder = mesh(new THREE.DodecahedronGeometry(0.5 + rand() * 0.4, 0), '#6e6458');
      const q = polar(vr * 1.1, (i - 1.5) * 38 + deg + 200, 0.4);
      boulder.position.set(c.x + q.x, 0.4, c.z + q.z);
      g.add(boulder);
    }
    return;
  }
  // Las cien cabezas: las serpientes que brotan de Tifón (arriba). En furia, además, chispas
  if (code.endsWith('f')) {
    // Furia: chispas de lava que saltan del cráter
    const sparks = new THREE.Group();
    sparks.position.set(c.x, top - 0.3, c.z);
    sparks.scale.setScalar(8);
    for (let k = 0; k < 10; k++) {
      const s = mesh(new THREE.TetrahedronGeometry(0.06, 0), '#ffb03a', { emissive: '#ff7a00', emissiveIntensity: 2.5 });
      const a = (k / 10) * Math.PI * 2;
      s.userData.dir = [Math.cos(a), Math.sin(a)];
      sparks.add(s);
    }
    sparks.userData.sparks = { speed: 2.4 };
    g.add(sparks);
  }
}

/** Una sierpe marina: tres jorobas que asoman del agua y la cabeza con ojos que brillan. */
function serpent(rand) {
  const s = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const hump = mesh(new THREE.TorusGeometry(0.7 - k * 0.12, 0.22 - k * 0.03, 6, 10, Math.PI), k % 2 ? SERPENT : '#3a7d68');
    hump.position.set(0, 0, -k * 1.5);
    hump.rotation.y = Math.PI / 2;
    s.add(hump);
  }
  const head = mesh(new THREE.ConeGeometry(0.32, 1.1, 6), SERPENT);
  head.rotation.x = Math.PI / 2.6;
  head.position.set(0, 0.9, 1.0);
  s.add(head);
  const jaw = mesh(new THREE.ConeGeometry(0.22, 0.7, 6), SERPENT_BELLY);
  jaw.rotation.x = Math.PI / 2.2;
  jaw.position.set(0, 0.7, 1.15);
  s.add(jaw);
  for (const x of [-0.14, 0.14]) {
    const eye = mesh(new THREE.SphereGeometry(0.07, 6, 4), '#ffe14a', { emissive: '#ffcc00', emissiveIntensity: 2 });
    eye.position.set(x, 1.05, 1.2);
    s.add(eye);
  }
  s.scale.setScalar(1.4 + rand() * 0.5);
  return s;
}

/** Un cuello de Tifón: segmentos encadenados que se mecen y una cabeza de dragón. */
function typhonNeck(rand, fury, colors = [SERPENT, '#3a7d68', SERPENT_BELLY]) {
  const [scale, scale2, belly] = colors;
  const root = new THREE.Group();
  let parent = root;
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const r = 0.6 * (1 - i / segments) + 0.22;
    const seg = new THREE.Group();
    seg.add(cyl(r * 0.85, r, 1.4, 7, i % 2 ? scale : scale2));
    seg.position.y = i === 0 ? 0 : 1.3;
    seg.userData.wiggle = { base: i === 0 ? -0.35 : -0.12, amp: fury ? 0.22 : 0.14, speed: (fury ? 1.6 : 0.9) + rand() * 0.4, phase: i * 0.6 + rand() * 3 };
    parent.add(seg);
    parent = seg;
  }
  const head = new THREE.Group();
  head.position.y = 1.4;
  const skull = mesh(new THREE.ConeGeometry(0.45, 1.3, 6), scale);
  skull.rotation.x = Math.PI / 2;
  skull.position.z = 0.4;
  head.add(skull);
  const jaw = mesh(new THREE.ConeGeometry(0.3, 0.9, 6), belly);
  jaw.rotation.x = Math.PI / 2.2;
  jaw.position.set(0, -0.25, 0.45);
  head.add(jaw);
  for (const x of [-0.18, 0.18]) {
    const eye = mesh(new THREE.SphereGeometry(0.09, 6, 4), fury ? '#ff5a1a' : '#ffe14a', { emissive: fury ? '#ff2a00' : '#ffcc00', emissiveIntensity: 2.2 });
    eye.position.set(x, 0.18, 0.55);
    head.add(eye);
  }
  for (const x of [-0.22, 0.22]) {
    const horn = mesh(new THREE.ConeGeometry(0.08, 0.5, 5), '#d8cdb5');
    horn.position.set(x, 0.35, -0.1);
    horn.rotation.x = -0.6;
    head.add(horn);
  }
  parent.add(head);
  return root;
}

/**
 * Piel de roca volcánica para Tifón y su volcán: suave, con el grano de la piedra y una red de
 * venas finas de lava que brillan (ruido calculado en la GPU a partir de la posición). `veins`:
 * cuánto brillan (en furia, más). Usa los colores por vértice de la malla.
 */
const volcanicSkins = new Map();
function volcanicSkin(veins, { flat = false, scale = 1 } = {}) {
  const key = `${veins}-${flat}-${scale.toFixed(3)}`;
  if (volcanicSkins.has(key)) return volcanicSkins.get(key);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.04, flatShading: flat });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uVeins = { value: veins };
    shader.uniforms.uRockScale = { value: scale };
    // En coordenadas de la propia pieza (escaladas a leguas): las venas se mueven con ella
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nuniform float uRockScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPos = transformed * uRockScale;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uVeins;
        varying vec3 vRockPos;
        float rHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float rNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(rHash(i), rHash(i + vec3(1, 0, 0)), f.x), mix(rHash(i + vec3(0, 1, 0)), rHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(rHash(i + vec3(0, 0, 1)), rHash(i + vec3(1, 0, 1)), f.x), mix(rHash(i + vec3(0, 1, 1)), rHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rGrain = rNoise(vRockPos * 3.1) * 0.6 + rNoise(vRockPos * 11.0) * 0.4;
        diffuseColor.rgb *= 0.78 + 0.42 * rGrain;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // Venas: donde el ruido cruza por la mitad sale una línea fina; dos escalas, y se apagan
          // en lo que mira hacia arriba (la ceniza las tapa)
          float a = 1.0 - abs(rNoise(vRockPos * 0.55) * 2.0 - 1.0);
          float b = 1.0 - abs(rNoise(vRockPos * 1.6 + 7.3) * 2.0 - 1.0);
          float vein = max(smoothstep(0.955, 0.99, a), smoothstep(0.972, 0.994, b) * 0.55);
          totalEmissiveRadiance += vec3(1.0, 0.33, 0.05) * vein * uVeins;
        }`,
      );
  };
  m.customProgramCacheKey = () => `aegium-volcanic-${flat}`;
  volcanicSkins.set(key, m);
  return m;
}

/**
 * Funde las piezas de `root` (todas, salvo lo que brilla) en dos mallas suaves: la piel de roca con
 * venas y lo demás (pelo, dientes, garras) sin ellas. Cada pieza conserva sus normales: se ven
 * redondas, no a caras. Llevan `solo` para que bakeStatic no las vuelva a fundir a caras planas.
 */
function fuseVolcanic(root, veins, plainColors, scale = 1) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = { skin: [], plain: [] };
  const done = [];
  // Las piezas que se mueven (un brazo, la cabeza) se funden aparte, dentro de sí mismas
  const moving = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.wiggle || p.userData.bob || p.userData.swing) return p;
    return null;
  };
  const parts = new Set();
  root.traverse((o) => {
    const m = o !== root && moving(o);
    if (m && moving(m.parent) === null) parts.add(m);
  });
  root.traverse((o) => {
    if (!o.isMesh || o.userData.solo || moving(o)) return;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0)) return;
    const hex = `#${m.color.getHexString()}`;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) m.color.toArray(colors, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groups[plainColors.has(hex) ? 'plain' : 'skin'].push(geo);
    done.push(o);
  });
  for (const o of done) {
    o.geometry.dispose();
    o.parent.remove(o);
  }
  for (const [kind, pieces] of Object.entries(groups)) {
    if (!pieces.length) continue;
    const material = kind === 'skin' ? volcanicSkin(veins, { scale }) : volcanicSkin(0, { scale });
    const one = new THREE.Mesh(mergeGeometries(pieces), material);
    one.castShadow = one.receiveShadow = true;
    one.userData.solo = true;
    root.add(one);
    for (const p of pieces) p.dispose();
  }
  for (const p of parts) fuseVolcanic(p, veins, plainColors, scale);
}

/**
 * El volcán: una montaña de basalto con las laderas irregulares, hombros, el cráter hundido y las
 * venas de lava en la piedra. De `vr` de radio y `top` de alto, con la base en y = -0.3.
 */
function volcanoGeometry(vr, top, seed) {
  const prof = [
    [vr * 1.3, -0.3], [vr * 1.15, top * 0.12], [vr * 0.92, top * 0.32], [vr * 0.68, top * 0.55],
    [vr * 0.48, top * 0.76], [vr * 0.34, top * 0.93], [vr * 0.3, top * 0.98], [vr * 0.24, top * 0.9], [0.01, top * 0.82],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 22).toNonIndexed();
  const pos = geo.attributes.position;
  // Ruido que depende de la posición (no del vértice), para que las costuras no se abran
  const h = (x, y, z) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.05 || y < -0.29) continue;
    const a = Math.atan2(x, z);
    const k = 1 + (h(Math.round(a * 4), Math.round(y * 1.5), 0) - 0.5) * 0.32 + Math.sin(a * 3 + seed) * 0.08;
    pos.setXYZ(i, x * k, y + (h(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3)) - 0.5) * 0.25, z * k);
  }
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Basalto, más oscuro abajo y rojizo junto al cráter
    col.set(y > top * 0.88 ? '#5a2a1a' : y > top * 0.6 ? '#3a2e2a' : '#2e2724');
    col.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Tifón: un gigante de roca volcánica que sale del cráter hasta la cintura. Músculos marcados con
 * grietas de lava que se ramifican, melena y barba salvajes, ojos y fauces de fuego con hileras de
 * dientes, un brazo en alto y el otro extendido con dedos y garras, y serpientes de boca abierta que
 * le brotan de los hombros y la espalda. Mira hacia +Z; el origen es la cintura (lo de abajo queda
 * dentro del volcán). Unas 7 unidades de alto.
 */
function typhonGiant(rand, { snakes = 5, fury = false, rockScale = 1 } = {}) {
  const g = new THREE.Group();
  const SKIN = '#4d3a30';
  const SKIN_DARK = '#35281f';
  const SKIN_LIGHT = '#644a3b';
  const HAIR = '#2a1d17';
  const glow = { emissive: '#ff4a00', emissiveIntensity: fury ? 2.8 : 1.9 };
  const crack = mat('#ff7a1f', glow);
  const up = new THREE.Vector3(0, 1, 0);
  const V = (...a) => new THREE.Vector3(...a);
  // Dónde van las piezas: el cuerpo o, mientras se construye, el brazo que se mueve
  let into = g;
  const put = (geo, color, x, y, z, extra) => {
    const m = mesh(geo, color, extra);
    m.position.set(x, y, z);
    into.add(m);
    return m;
  };
  /**
   * Una pieza que se mueve girando sobre `pivot` (hombro, cuello): lo que se construya dentro
   * se coloca con las coordenadas del cuerpo. `wiggle`: cómo se mueve.
   */
  const joint = (pivot, wiggle, build) => {
    const p = new THREE.Group();
    p.position.set(...pivot);
    p.userData.wiggle = wiggle;
    const inner = new THREE.Group();
    inner.position.set(-pivot[0], -pivot[1], -pivot[2]);
    p.add(inner);
    g.add(p);
    const before = into;
    into = inner;
    build();
    into = before;
    return p;
  };
  /** Bulto de músculo: una esfera achatada en `s`. */
  const blob = (r, color, at, s = [1, 1, 1], rot = [0, 0, 0]) => {
    const m = put(new THREE.SphereGeometry(r, 12, 9), color, ...at);
    m.scale.set(...s);
    m.rotation.set(...rot);
    return m;
  };
  /** Cilindro de `a` a `b` (más grueso en `a`), con su articulación redonda al final. */
  const limb = (a, b, r1, r2, color = SKIN, joint = true) => {
    const from = V(...a);
    const dir = V(...b).sub(from);
    const m = put(new THREE.CylinderGeometry(r2, r1, dir.length(), 10), color, 0, 0, 0);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(up, dir.clone().normalize());
    if (joint) put(new THREE.SphereGeometry(Math.max(r1, r2) * 1.04, 10, 8), color, ...b);
    return m;
  };
  /** Un tramo de grieta de lava entre dos puntos. */
  const seam = (a, b, w) => {
    const dir = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, dir.length() + w, w), crack);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    into.add(m);
  };
  /**
   * Grieta que trepa por una superficie: `surf(x, y)` da el punto de la piel; avanza a saltos
   * desde (x, y) hacia arriba, torciéndose, y a veces echa una rama.
   */
  const crackWalk = (surf, x, y, steps, w = 0.08, branch = 0.3) => {
    let p = surf(x, y);
    for (let i = 0; i < steps; i++) {
      x += (rand() - 0.5) * 0.45;
      y += 0.22 + rand() * 0.18;
      const q = surf(x, y);
      if (!q) break;
      seam(p, q, w);
      if (rand() < branch && steps > 2) crackWalk(surf, x, y, Math.ceil((steps - i) / 2), w * 0.7, 0);
      p = q;
    }
  };
  // Piel del pecho (elipsoide) y del vientre (cilindro), un pelo por fuera
  const chest = (x, y) => {
    const k = 1 - (x / 1.95) ** 2 - ((y - 2.55) / 1.5) ** 2;
    return k > 0.05 ? V(x, y, 1.22 * Math.sqrt(k) + 0.04) : null;
  };
  const belly = (x, y) => (Math.abs(x) < 1.1 && y < 1.95 ? V(x, y, Math.sqrt(1.2 ** 2 - x * x) + 0.04) : chest(x, y));
  /** Mano con cuatro dedos de dos falanges, pulgar y garras curvas, que apunta hacia `dir`. */
  const hand = (at, dir, open = 0.4) => {
    const d = V(...dir).normalize();
    const side = V().crossVectors(d, Math.abs(d.y) > 0.9 ? V(0, 0, 1) : up).normalize();
    const palm = blob(0.42, SKIN, at, [1.15, 0.7, 1]);
    palm.quaternion.setFromUnitVectors(up, d);
    const base = V(...at).addScaledVector(d, 0.3);
    for (let k = 0; k < 5; k++) {
      const thumb = k === 4;
      const off = thumb ? -0.42 : (k - 1.5) * 0.2;
      const root = base.clone().addScaledVector(side, off).addScaledVector(d, thumb ? -0.15 : 0);
      const bend = d.clone().addScaledVector(side, off * 0.6).addScaledVector(V().crossVectors(side, d), open).normalize();
      const mid = root.clone().addScaledVector(bend, thumb ? 0.28 : 0.36);
      limb(root.toArray(), mid.toArray(), 0.1, 0.09, SKIN);
      // La falange de la punta se curva hacia dentro y acaba en garra
      const curl = bend.clone().addScaledVector(V().crossVectors(side, d), -0.7).normalize();
      const tip = mid.clone().addScaledVector(curl, 0.26);
      limb(mid.toArray(), tip.toArray(), 0.09, 0.075, SKIN);
      const nail = put(new THREE.ConeGeometry(0.075, 0.42, 6), '#e2d6b8', 0, 0, 0);
      const nd = curl.clone().addScaledVector(V().crossVectors(side, d), -0.6).normalize();
      nail.position.copy(tip).addScaledVector(nd, 0.18);
      nail.quaternion.setFromUnitVectors(up, nd);
      // Los nudillos arden
      put(new THREE.SphereGeometry(0.06, 6, 4), '#ff7a1f', ...mid.toArray(), glow);
    }
  };

  // ── Tronco ──
  put(new THREE.CylinderGeometry(1.15, 1.35, 1.6, 12), SKIN_DARK, 0, -0.1, 0);
  put(new THREE.CylinderGeometry(1.25, 1.15, 1.4, 12), SKIN, 0, 1.25, 0);
  blob(1.45, SKIN, [0, 2.55, -0.05], [1.35, 1.03, 0.84]);
  for (const sx of [-1, 1]) {
    // Pectorales, dorsales, serratos, trapecios y deltoides
    blob(0.72, SKIN_LIGHT, [sx * 0.66, 2.72, 0.72], [1.15, 0.72, 0.62], [0.1, 0, sx * -0.15]);
    blob(0.8, SKIN_DARK, [sx * 1.2, 2.3, -0.45], [0.8, 1.35, 0.8]);
    for (let k = 0; k < 3; k++) blob(0.2, SKIN, [sx * 1.15, 1.55 + k * 0.32, 0.62], [0.7, 0.85, 0.6], [0, 0, sx * 0.4]);
    blob(0.55, SKIN, [sx * 0.75, 3.45, -0.15], [1.2, 0.7, 0.9]);
    blob(0.78, SKIN_LIGHT, [sx * 1.75, 3.12, 0.02], [1, 0.95, 1]);
  }
  // Abdominales: tres filas y la línea del centro
  for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) blob(0.3, SKIN_LIGHT, [sx * 0.34, 0.72 + k * 0.42, 1.1], [1, 0.8, 0.5]);
  // Grietas de lava por el pecho y el vientre
  crackWalk(belly, 0, 0.2, 9, 0.07, 0.45);
  crackWalk(belly, 0.55, 0.3, 6, 0.05, 0.35);
  crackWalk(belly, -0.6, 0.4, 6, 0.05, 0.35);
  crackWalk(chest, 1.2, 2.1, 4, 0.06, 0.3);
  crackWalk(chest, -1.25, 2.0, 4, 0.06, 0.3);

  // ── Cabeza: cráneo, cejas, pómulos, ojos de fuego y fauces abiertas ──
  put(new THREE.CylinderGeometry(0.52, 0.66, 0.55, 10), SKIN, 0, 3.6, 0.02);
  const head = new THREE.Group();
  head.position.set(0, 4.25, 0.15);
  head.rotation.x = -0.12;
  head.userData.wiggle = { base: 0, amp: 0.1, speed: 0.55, phase: rand() * 6 };
  g.add(head);
  const hput = (geo, color, x, y, z, extra) => {
    const m = mesh(geo, color, extra);
    m.position.set(x, y, z);
    head.add(m);
    return m;
  };
  hput(new THREE.SphereGeometry(0.75, 14, 11), SKIN, 0, 0.1, -0.05).scale.set(0.92, 1, 1);
  hput(new THREE.BoxGeometry(1.05, 0.22, 0.4), SKIN_DARK, 0, 0.3, 0.55).rotation.x = 0.25;
  for (const sx of [-1, 1]) {
    hput(new THREE.SphereGeometry(0.22, 8, 6), SKIN_LIGHT, sx * 0.42, -0.08, 0.5).scale.set(1, 0.8, 0.8);
    hput(new THREE.SphereGeometry(0.13, 8, 6), '#ffd23a', sx * 0.27, 0.15, 0.66, { emissive: fury ? '#ff2a00' : '#ffb000', emissiveIntensity: 3 });
  }
  hput(new THREE.ConeGeometry(0.12, 0.35, 5), SKIN_LIGHT, 0, 0.0, 0.78).rotation.x = Math.PI / 2 + 0.4;
  // Fauces: la mandíbula abierta, el fuego dentro y dos hileras de dientes
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.32, 0.12);
  jaw.rotation.x = 0.45;
  head.add(jaw);
  const jawBone = mesh(new THREE.BoxGeometry(0.72, 0.2, 0.72), SKIN);
  jawBone.position.set(0, -0.12, 0.3);
  jaw.add(jawBone);
  const throat = hput(new THREE.SphereGeometry(0.34, 10, 8), '#ff6a12', 0, -0.35, 0.45, glow);
  throat.scale.set(1, 0.85, 0.7);
  for (let k = 0; k < 7; k++) {
    const x = (k - 3) * 0.085;
    const top = hput(new THREE.ConeGeometry(0.035, 0.16, 4), '#efe6d0', x, -0.24, 0.64 - Math.abs(k - 3) * 0.03);
    top.rotation.x = Math.PI;
    const low = mesh(new THREE.ConeGeometry(0.035, 0.14, 4), '#efe6d0');
    low.position.set(x, 0.03, 0.58 - Math.abs(k - 3) * 0.03);
    jaw.add(low);
  }
  for (const sx of [-1, 1]) {
    const fang = hput(new THREE.ConeGeometry(0.06, 0.32, 5), '#f5ecd6', sx * 0.3, -0.3, 0.55);
    fang.rotation.x = Math.PI;
  }
  // Melena: mechones gruesos de dos tramos, hacia atrás, a los lados y alguno hacia arriba
  for (let k = 0; k < 30; k++) {
    const a = -Math.PI * 0.95 + (k / 29) * Math.PI * 1.9;
    const root = V(Math.sin(a) * 0.62, 0.35 + rand() * 0.35, -0.12 + Math.cos(a) * 0.48);
    const wild = rand() < 0.25;
    const d1 = V(Math.sin(a) * 1.1, wild ? 0.5 : -0.25 - rand() * 0.3, -0.7 + Math.cos(a) * 0.35).normalize();
    const d2 = d1.clone().add(V(0, -0.8, -0.2)).normalize();
    const l1 = 0.9 + rand() * 0.7;
    const l2 = 0.8 + rand() * 0.9;
    const color = k % 4 === 0 ? '#4a3426' : HAIR;
    const s1 = hput(new THREE.CylinderGeometry(0.14, 0.24, l1, 6), color, 0, 0, 0);
    s1.position.copy(root).addScaledVector(d1, l1 / 2);
    s1.quaternion.setFromUnitVectors(up, d1.clone().negate());
    const mid = root.clone().addScaledVector(d1, l1);
    const s2 = hput(new THREE.ConeGeometry(0.15, l2, 6), color, 0, 0, 0);
    s2.position.copy(mid).addScaledVector(d2, l2 / 2);
    s2.quaternion.setFromUnitVectors(up, d2.clone().negate());
  }
  // Barba: mechones largos que caen sobre el pecho
  for (let k = 0; k < 11; k++) {
    const x = (k - 5) * 0.1;
    const len = 1.3 + rand() * 0.7 - Math.abs(k - 5) * 0.12;
    const d = V(x * 0.25, -1, 0.35 + rand() * 0.15).normalize();
    const root = V(x, -0.45, 0.5 - Math.abs(k - 5) * 0.04);
    const b = mesh(new THREE.ConeGeometry(0.13, len, 6), k % 3 ? HAIR : '#3d2b20');
    b.position.copy(root).addScaledVector(d, len / 2);
    b.quaternion.setFromUnitVectors(up, d.clone().negate());
    jaw.add(b);
  }

  // ── Brazos: uno en alto y el otro extendido, con bíceps y antebrazos fuertes ──
  // (el de la derecha, +X, en alto: se agita)
  joint([1.75, 3.1, 0], { base: 0, amp: 0.14, speed: 0.8, phase: rand() * 6 }, () => {
    limb([1.75, 3.1, 0], [2.6, 4.65, 0.4], 0.62, 0.5);
    blob(0.42, SKIN_LIGHT, [2.3, 4.0, 0.62], [0.8, 1.3, 0.7], [0, 0, -0.5]);
    limb([2.6, 4.65, 0.4], [2.5, 6.0, 0.65], 0.52, 0.36);
    hand([2.48, 6.32, 0.72], [0, 1, 0.25], 0.5);
    crackWalk((x, y) => (y < 4.5 ? V(2.15 + (y - 3.3) * 0.45 + x * 0.2, y, 0.62 + x) : null), 0, 3.3, 5, 0.06, 0.3);
    crackWalk((x, y) => (y < 5.9 ? V(2.6 + x * 0.2, y, 0.95 + x * 0.3) : null), 0, 4.8, 4, 0.05, 0.2);
  });
  // (el de la izquierda, −X, extendido hacia fuera: sube y baja)
  joint([-1.75, 3.1, 0], { base: 0, amp: 0.18, speed: 0.6, phase: rand() * 6 }, () => {
    limb([-1.75, 3.1, 0], [-3.2, 2.9, 0.65], 0.62, 0.5);
    blob(0.42, SKIN_LIGHT, [-2.5, 3.25, 0.55], [1.3, 0.8, 0.7]);
    limb([-3.2, 2.9, 0.65], [-4.55, 2.4, 1.15], 0.52, 0.36);
    hand([-4.88, 2.3, 1.28], [-1, -0.05, 0.35], 0.55);
    crackWalk((x, y) => (y < 3.4 ? V(-2.0 - (y - 2.6) * 2.2 + x * 0.3, y, 0.62) : null), 0, 2.7, 4, 0.05, 0.3);
  });

  // Todo el cuerpo, suave y con venas de lava (las grietas grandes y los ojos siguen aparte)
  fuseVolcanic(g, fury ? 1.5 : 0.95, new Set([HAIR, '#4a3426', '#3d2b20', '#e2d6b8', '#efe6d0', '#f5ecd6']), rockScale);

  // ── Serpientes que le brotan de los hombros y la espalda ──
  for (let k = 0; k < snakes; k++) {
    const side = k % 2 ? 1 : -1;
    const i = Math.floor(k / 2);
    const snake = typhonSerpent(rand, fury);
    snake.position.set(side * (0.95 + i * 0.3), 2.2 + (i % 3) * 0.5, -0.6 - (i % 2) * 0.3);
    snake.rotation.set(-0.3 - rand() * 0.35, side * (0.4 + rand() * 0.7), side * -(0.5 + i * 0.13));
    snake.scale.setScalar(0.5 + rand() * 0.15);
    g.add(snake);
  }
  return g;
}

/**
 * Serpiente de Tifón: un cuello de escamas que se estrecha y se mece, y una cabeza de víbora con la
 * boca abierta (fuego dentro), colmillos, lengua bífida y ojos que brillan. Sale hacia +Y.
 */
function typhonSerpent(rand, fury) {
  const root = new THREE.Group();
  const SCALE = '#3b3226';
  const SCALE2 = '#52432f';
  const BELLY = '#c9a34a';
  let parent = root;
  const segments = 7;
  for (let i = 0; i < segments; i++) {
    const r = 0.5 * (1 - i / segments) + 0.2;
    const seg = new THREE.Group();
    seg.add(cyl(r * 0.88, r, 1.25, 9, i % 2 ? SCALE : SCALE2));
    // La tripa clara, por delante
    const belly = cyl(r * 0.5, r * 0.56, 1.2, 7, BELLY, 0, 0, r * 0.55);
    belly.scale.z = 0.6;
    seg.add(belly);
    seg.position.y = i === 0 ? 0 : 1.15;
    // Curvadas en S: primero hacia fuera, luego se alzan y la cabeza se asoma hacia delante
    const bend = [-0.55, -0.4, 0.1, 0.45, 0.5, 0.3, -0.25][i] ?? 0;
    seg.userData.wiggle = { base: bend, amp: fury ? 0.2 : 0.12, speed: (fury ? 1.7 : 1) + rand() * 0.4, phase: i * 0.7 + rand() * 3 };
    parent.add(seg);
    parent = seg;
  }
  const head = new THREE.Group();
  head.position.y = 1.25;
  head.rotation.x = 1.15;
  head.scale.setScalar(1.8);
  const skull = mesh(new THREE.SphereGeometry(0.42, 10, 8), SCALE);
  skull.scale.set(1, 0.6, 1.5);
  skull.position.z = 0.25;
  head.add(skull);
  const snout = mesh(new THREE.ConeGeometry(0.3, 0.6, 8), SCALE2);
  snout.rotation.x = Math.PI / 2;
  snout.scale.set(1, 1, 0.6);
  snout.position.set(0, 0.04, 0.8);
  head.add(snout);
  // Mandíbula abierta hacia abajo, con el fuego dentro
  const jaw = mesh(new THREE.ConeGeometry(0.26, 0.85, 8), BELLY);
  jaw.rotation.x = Math.PI / 2 + 0.55;
  jaw.scale.set(1, 1, 0.45);
  jaw.position.set(0, -0.28, 0.55);
  head.add(jaw);
  const mouth = mesh(new THREE.SphereGeometry(0.14, 8, 6), '#c8361a', { emissive: '#ff3000', emissiveIntensity: 0.9 });
  mouth.scale.set(1, 0.6, 1.3);
  mouth.position.set(0, -0.14, 0.55);
  head.add(mouth);
  for (const x of [-0.12, 0.12]) {
    const fang = mesh(new THREE.ConeGeometry(0.035, 0.24, 5), '#f5ecd6');
    fang.rotation.x = Math.PI - 0.3;
    fang.position.set(x, -0.1, 0.85);
    head.add(fang);
    const eye = mesh(new THREE.SphereGeometry(0.06, 6, 5), fury ? '#ff5a1a' : '#ffe14a', { emissive: fury ? '#ff2a00' : '#ffcc00', emissiveIntensity: 1.6 });
    eye.position.set(x * 2.1, 0.17, 0.5);
    head.add(eye);
    // Lengua bífida
    const fork = mesh(new THREE.BoxGeometry(0.025, 0.025, 0.3), '#d1202a');
    fork.position.set(x * 0.4, -0.25, 1.15);
    fork.rotation.y = x * 2.5;
    head.add(fork);
  }
  const tongue = mesh(new THREE.BoxGeometry(0.035, 0.03, 0.45), '#d1202a');
  tongue.position.set(0, -0.22, 0.9);
  tongue.rotation.x = 0.35;
  head.add(tongue);
  parent.add(head);
  return root;
}

// ── Gestas: la Armada del Gran Rey y la Hidra de Lerna ───────────────────────

const PURPLE = '#6a2c8a';
const PURPLE_DARK = '#4a1d63';
const PERSIAN_GOLD = '#d8b84a';
const RED = '#a3242a';
const CANVAS = '#e8dcc0';
const BRONZE = '#b08a3e';

/**
 * El campamento persa junto a la costa: empalizada de estacas con la entrada hacia el mar, el
 * gran pabellón del Gran Rey (muros púrpura con el disco alado, techo a franjas rojas y doradas,
 * remates de oro y alfombra roja), tiendas rojas, púrpuras y de lona con sus franjas, toldos de
 * mercado con cajas y ánforas, astilleros de lanzas, estandartes con el disco alado, hogueras,
 * palmeras y cipreses; enfrente, las trirremes fenicias que guardan los fondeaderos (`code`:
 * cuántos fondeaderos han tomado los juramentados, o «p» en presagios).
 */
function persianCamp(g, isl, R, rand, code) {
  const { deg, coastR } = featSpot(isl, R, rand);
  const cr = R * 0.22;
  const c = polar(coastR - cr * 1.15, deg);
  // Todo se construye mirando al mar (+Z hacia la costa) y se gira de una vez
  const camp = new THREE.Group();
  camp.position.set(c.x, 0, c.z);
  camp.rotation.y = THREE.MathUtils.degToRad(deg);
  g.add(camp);
  const k = cr / 6.5;
  const s = new THREE.Group();
  s.scale.setScalar(k);
  camp.add(s);
  const P = (x, z) => [x, z];
  const finial = (parent, x, y, z, r = 0.12) => {
    const ball = mesh(new THREE.SphereGeometry(r, 8, 6), PERSIAN_GOLD, { metalness: 0.5, roughness: 0.35 });
    ball.position.set(x, y + r, z);
    const tip = mesh(new THREE.ConeGeometry(r * 0.6, r * 2.6, 6), PERSIAN_GOLD, { metalness: 0.5, roughness: 0.35 });
    tip.position.set(x, y + r * 2.9, z);
    parent.add(ball, tip);
  };
  // El disco alado (faravahar), dorado sobre la tela
  const emblem = (parent, x, y, z, w = 0.9, rotY = 0) => {
    const e = new THREE.Group();
    e.position.set(x, y, z);
    e.rotation.y = rotY;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const f = box(w * 0.42 - i * w * 0.08, w * 0.07, 0.03, PERSIAN_GOLD, 0, 0, 0);
        f.position.set(sx * (w * 0.25 + i * w * 0.02), w * 0.05 - i * w * 0.09, 0);
        f.rotation.z = sx * (0.12 + i * 0.08);
        e.add(f);
      }
    }
    const disc = mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.12, 0.04, 12), PERSIAN_GOLD);
    disc.rotation.x = Math.PI / 2;
    e.add(disc, box(w * 0.08, w * 0.26, 0.03, PERSIAN_GOLD, 0, -w * 0.3, 0));
    parent.add(e);
  };

  // ── La empalizada de estacas afiladas, abierta hacia el mar ──
  const stakes = 40;
  for (let i = 0; i < stakes; i++) {
    const a = (i / stakes) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; // la entrada
    const r = 6.4 + (rand() - 0.5) * 0.25;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const h = 1.5 + rand() * 0.5;
    s.add(cyl(0.17, 0.2, h, 6, C.woodDark, x, 0, z));
    const tip = mesh(new THREE.ConeGeometry(0.17, 0.4, 6), '#5a3b22');
    tip.position.set(x, h + 0.2, z);
    s.add(tip);
  }

  // ── El pabellón del Gran Rey ──
  const pav = new THREE.Group();
  s.add(pav);
  const W = 3.4, H = 2.4;
  pav.add(box(W, H, W, PURPLE, 0, 0, 0));
  // Franjas doradas arriba y abajo, y una cenefa roja con rombos
  pav.add(box(W + 0.06, 0.16, W + 0.06, PERSIAN_GOLD, 0, H - 0.16, 0), box(W + 0.06, 0.12, W + 0.06, PERSIAN_GOLD, 0, 0, 0));
  pav.add(box(W + 0.08, 0.32, W + 0.08, RED, 0, H - 0.5, 0));
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
    const d = box(0.14, 0.14, 0.02, PERSIAN_GOLD, -W / 2 + 0.3 + i * 0.56, H - 0.35, 0);
    d.rotation.z = Math.PI / 4;
    d.position.z = side * (W / 2 + 0.06);
    pav.add(d);
  }
  // El techo a franjas: cono de ocho caras rojo con nervios dorados, y el remate
  const roof = mesh(new THREE.ConeGeometry(2.45, 1.9, 16), RED);
  roof.position.y = H + 0.95;
  pav.add(roof);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
    campRib(pav, new THREE.Vector3(Math.sin(a) * 2.38, H + 0.05, Math.cos(a) * 2.38), new THREE.Vector3(0, H + 1.9, 0), 0.45, PERSIAN_GOLD);
  }
  // Faldón del techo con flecos
  pav.add(cyl(2.5, 2.5, 0.22, 16, PERSIAN_GOLD, 0, H - 0.05, 0));
  finial(pav, 0, H + 1.85, 0, 0.18);
  for (const [x, z] of [P(-W / 2, -W / 2), P(W / 2, -W / 2), P(-W / 2, W / 2), P(W / 2, W / 2)]) {
    pav.add(cyl(0.09, 0.09, H + 0.5, 6, PERSIAN_GOLD, x, 0, z));
    finial(pav, x, H + 0.5, z, 0.12);
  }
  // La entrada con cortinas recogidas, el trono dentro y la alfombra roja
  pav.add(box(1.3, 1.5, 0.05, '#2a1430', 0, 0, W / 2 + 0.01));
  for (const sx of [-1, 1]) pav.add(box(0.35, 1.6, 0.08, PURPLE_DARK, sx * 0.75, 0, W / 2 + 0.04));
  pav.add(box(0.6, 0.7, 0.4, PERSIAN_GOLD, 0, 0, W / 2 - 0.3), box(0.6, 0.6, 0.12, '#a8231a', 0, 0.7, W / 2 - 0.45));
  pav.add(box(1.0, 0.03, 2.4, '#a8231a', 0, 0, W / 2 + 1.25), box(1.06, 0.025, 2.46, PERSIAN_GOLD, 0, 0, W / 2 + 1.25));
  emblem(pav, 0, H - 0.75, W / 2 + 0.07, 1.4);
  emblem(pav, 0, H - 0.75, -W / 2 - 0.07, 1.4, Math.PI);

  // ── Las tiendas ──
  const TENTS = [
    { x: -3.4, z: 2.3, r: 1.0, h: 1.9, color: RED, band: PERSIAN_GOLD },
    { x: 3.3, z: 2.6, r: 1.0, h: 1.9, color: RED, band: PERSIAN_GOLD },
    { x: -3.9, z: -0.6, r: 1.05, h: 1.7, color: PURPLE, band: PERSIAN_GOLD },
    { x: 3.9, z: -0.4, r: 1.1, h: 1.8, color: CANVAS, band: PURPLE },
    { x: -2.6, z: -3.4, r: 1.0, h: 1.9, color: CANVAS, band: PURPLE },
    { x: 2.5, z: -3.5, r: 1.0, h: 2.0, color: RED, band: PERSIAN_GOLD, striped: true },
    { x: 0.2, z: -4.4, r: 0.95, h: 1.7, color: PURPLE, band: PERSIAN_GOLD },
  ];
  for (const t of TENTS) {
    const tent = new THREE.Group();
    tent.position.set(t.x + (rand() - 0.5) * 0.2, 0, t.z + (rand() - 0.5) * 0.2);
    tent.rotation.y = Math.atan2(-t.x, 4 - t.z) + Math.PI;
    tent.add(cyl(t.r, t.r, 0.55, 10, t.color, 0, 0, 0));
    const cone = mesh(new THREE.ConeGeometry(t.r * 1.08, t.h, 10), t.color);
    cone.position.y = 0.55 + t.h / 2;
    tent.add(cone);
    if (t.striped) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        campRib(tent, new THREE.Vector3(Math.sin(a) * t.r * 1.05, 0.58, Math.cos(a) * t.r * 1.05), new THREE.Vector3(0, 0.55 + t.h, 0), 0.35, PERSIAN_GOLD);
      }
    }
    // Cenefa con rombos, puerta y remate
    tent.add(cyl(t.r * 1.09, t.r * 1.09, 0.14, 10, t.band, 0, 0.55, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = box(0.13, 0.13, 0.02, t.band, Math.sin(a) * (t.r + 0.01), 0.32, Math.cos(a) * (t.r + 0.01));
      d.rotation.set(0, a, Math.PI / 4);
      tent.add(d);
    }
    tent.add(box(0.45, 0.7, 0.05, '#2a1a12', 0, 0, t.r + 0.01));
    finial(tent, 0, 0.55 + t.h, 0, 0.09);
    if (t.color === RED) emblem(tent, 0, 0.95, t.r * 0.62 + 0.02, 0.7);
    s.add(tent);
  }

  // ── Toldos de mercado con cajas y ánforas ──
  const stall = (x, z, rot, colors) => {
    const st = new THREE.Group();
    st.position.set(x, 0, z);
    st.rotation.y = rot;
    for (const [px, pz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) st.add(cyl(0.05, 0.05, pz < 0 ? 1.3 : 1.1, 5, C.woodDark, px, 0, pz));
    colors.forEach((col, i) => {
      const cloth = box(1.8 / colors.length, 0.04, 1.2, col, -0.9 + (i + 0.5) * (1.8 / colors.length), 1.2, 0);
      cloth.rotation.x = 0.17;
      st.add(cloth);
    });
    st.add(box(1.5, 0.08, 0.6, C.wood, 0, 0.55, 0));
    for (let i = 0; i < 4; i++) {
      if (i % 2) {
        st.add(cyl(0.11, 0.07, 0.3, 7, '#b9643a', -0.55 + i * 0.36, 0.63, 0));
        const neck = cyl(0.05, 0.05, 0.08, 6, '#b9643a', -0.55 + i * 0.36, 0.93, 0);
        st.add(neck);
      } else st.add(box(0.26, 0.24, 0.26, C.wood, -0.55 + i * 0.36, 0.63, 0));
    }
    st.add(box(0.4, 0.4, 0.4, C.wood, 0.9, 0, 0.75), box(0.32, 0.3, 0.32, C.woodDark, 1.25, 0, 0.6));
    s.add(st);
  };
  stall(-2.2, 4.4, 0.35, [CANVAS, PURPLE, PERSIAN_GOLD]);
  stall(2.4, 4.3, -0.3, [CANVAS, RED]);
  stall(4.6, 1.6, -1.2, [PURPLE, CANVAS]);

  // ── Astilleros con lanzas y un escudo ──
  const rack = (x, z, rot) => {
    const r = new THREE.Group();
    r.position.set(x, 0, z);
    r.rotation.y = rot;
    for (const px of [-0.55, 0.55]) r.add(cyl(0.05, 0.05, 1.3, 5, C.woodDark, px, 0, 0));
    r.add(box(1.2, 0.07, 0.08, C.woodDark, 0, 1.05, 0), box(1.2, 0.07, 0.08, C.woodDark, 0, 0.35, 0));
    for (let i = 0; i < 5; i++) {
      const x0 = -0.44 + i * 0.22;
      r.add(cyl(0.025, 0.025, 1.6, 4, C.wood, x0, 0, 0.05));
      const tip = mesh(new THREE.ConeGeometry(0.05, 0.22, 4), '#c9ced6');
      tip.position.set(x0, 1.71, 0.05);
      r.add(tip);
    }
    const shield = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), BRONZE);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0.75, 0.4, 0.15);
    r.add(shield);
    s.add(r);
  };
  rack(-1.2, 2.6, 0.2);
  rack(1.3, 2.7, -0.2);
  rack(-4.6, 2.0, 1.1);

  // ── Estandartes con el disco alado ──
  const banner = (x, z, color, rot) => {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.rotation.y = rot;
    b.add(cyl(0.05, 0.05, 3.2, 5, C.dark, 0, 0, 0), box(0.9, 0.06, 0.06, PERSIAN_GOLD, 0, 2.9, 0));
    finial(b, 0, 3.2, 0, 0.1);
    b.add(box(0.8, 1.3, 0.04, color, 0, 1.6, 0.04), box(0.84, 0.08, 0.05, PERSIAN_GOLD, 0, 1.6, 0.045));
    emblem(b, 0, 2.3, 0.08, 0.6);
    s.add(b);
  };
  banner(-1.4, 5.6, PURPLE, 0);
  banner(1.4, 5.6, RED, 0);
  banner(-5.3, -2.2, RED, -2.0);
  banner(5.2, -2.6, PURPLE, 2.0);
  banner(-1.6, -5.4, RED, Math.PI);
  banner(1.9, -5.3, PURPLE, Math.PI);

  // ── Hogueras, cajas sueltas, palmeras y cipreses ──
  for (const [x, z] of [P(-1.6, -1.9), P(2.0, 0.9)]) s.add(makeFire(x, 0.075, z, 0.862));
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2, r = 4.8 + rand() * 1;
    s.add(box(0.35, 0.3, 0.35, i % 2 ? C.wood : C.woodDark, Math.sin(a) * r, 0, Math.cos(a) * r));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.3, r = 7.4 + rand() * 1.2;
    const tree = i % 2 ? palmTree(rand) : cypress('#2f5e34');
    tree.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    tree.scale.setScalar(1.4);
    s.add(tree);
  }

  // ── Las trirremes fenicias que siguen libres frente a la costa ──
  const held = code === 'p' ? 0 : Number(code) || 0;
  const ships = Math.max(1, 4 - held);
  for (let i = 0; i < ships; i++) {
    const p = polar(coastR + R * 0.18, deg + (i - (ships - 1) / 2) * 11, 0);
    const ship = createShip('trirreme');
    ship.position.set(p.x, SEA, p.z);
    ship.rotation.y = THREE.MathUtils.degToRad(deg + 90);
    ship.scale.setScalar(2.3);
    ship.userData.bob = { amp: 0.08, speed: 0.9 + i * 0.17, base: SEA };
    g.add(ship);
  }
}

/** Una tira plana de tela de `a` a `b` (los nervios dorados de los techos de las tiendas). */
function campRib(parent, a, b, w, color) {
  const d = new THREE.Vector3().subVectors(b, a);
  const strip = box(w, d.length(), 0.04, color, 0, 0, 0);
  strip.position.copy(a).addScaledVector(d, 0.5);
  // Su eje largo a lo largo de la tela y la cara mirando hacia fuera del cono
  const y = d.clone().normalize();
  const z = new THREE.Vector3(a.x, 0, a.z).normalize();
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  strip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  strip.position.addScaledVector(z, 0.03);
  parent.add(strip);
}


/**
 * La Hidra en su pantano, junto a la costa: agua negra y juncos, y la bestia sobre cuatro patas
 * con garras, la cola larga erizada de púas y tantos cuellos como cabezas le quedan (como mucho
 * doce a la vista), en abanico, con crestas doradas y bocas abiertas. «p» en presagios: medio
 * hundida, con tres cabezas asomando.
 */
function hydraSwamp(g, isl, R, rand, code) {
  const { deg, coastR } = featSpot(isl, R, rand);
  const sr = R * 0.2;
  const c = polar(coastR - sr * 1.1, deg);
  const swamp = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr * 1.05, 0.12, 18), mat('#2c3b25', { transparent: true, opacity: 0.92, roughness: 0.3 }));
  swamp.position.set(c.x, 0.06, c.z);
  g.add(swamp);
  // Juncos alrededor
  for (let i = 0; i < 28; i++) {
    const p = polar(sr * (0.85 + rand() * 0.3), rand() * 360, 0);
    const reed = mesh(new THREE.ConeGeometry(0.08, 1.2 + rand() * 0.8, 4), i % 2 ? '#6b7a3a' : '#556b2f');
    reed.position.set(c.x + p.x, 0.6, c.z + p.z);
    g.add(reed);
  }
  const omen = code === 'p';
  const heads = omen ? 3 : Math.max(1, Math.min(12, Number(code) || 1));
  const beast = hydraBeast(rand, heads, omen);
  beast.scale.setScalar(sr / 3.1);
  beast.position.set(c.x, omen ? -sr * 0.45 : 0.05, c.z);
  // Mirando hacia el centro del continente, con las cabezas sobre la isla
  beast.rotation.y = Math.atan2(-c.x, -c.z);
  g.add(beast);
}

const HYDRA = { scale: '#3f5f2e', dark: '#2c4521', belly: '#d9c894', gold: '#c9962e', gold2: '#e2b04a', mouth: '#7a1717', tongue: '#d4566a', teeth: '#f2ead8', claw: '#2a2420' };

/** Una pieza redonda de `a` a `b` (que se estrecha de `r` a `r2`). */
function hydraRod(parent, a, b, r, color, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = mesh(new THREE.CylinderGeometry(r2, r, d.length(), 8), color);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
}

/** Una púa en `at`, apuntando hacia `dir`. */
function hydraSpike(parent, at, dir, len, r = len * 0.22, color = HYDRA.gold) {
  const s = mesh(new THREE.ConeGeometry(r, len, 5), color);
  const d = dir.clone().normalize();
  s.position.copy(at).addScaledVector(d, len * 0.45);
  s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  parent.add(s);
}

/**
 * La Hidra (unas 6 unidades de largo, mirando a +Z): el cuerpo con el vientre claro, las cuatro
 * patas con garras, la cola enroscada y los cuellos en abanico, cada uno con su cabeza.
 */
function hydraBeast(rand, heads, omen) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // El cuerpo y el vientre de escamas claras
  const body = mesh(new THREE.SphereGeometry(1, 14, 10), HYDRA.scale);
  body.scale.set(1.25, 0.95, 1.85);
  body.position.y = 1.5;
  g.add(body);
  const belly = mesh(new THREE.SphereGeometry(1, 14, 10), HYDRA.belly);
  belly.scale.set(1.1, 0.72, 1.7);
  belly.position.set(0, 1.18, 0.08);
  g.add(belly);
  // Placas de escamas oscuras por el lomo y la fila de púas doradas
  for (let i = 0; i < 9; i++) {
    const z = -1.45 + i * 0.36;
    const y = 1.5 + 0.95 * Math.sqrt(Math.max(0, 1 - (z / 1.85) ** 2));
    for (const x of [-0.42, 0.42]) {
      const plate = mesh(new THREE.SphereGeometry(0.22, 6, 4), HYDRA.dark);
      plate.scale.set(1, 0.35, 1.2);
      plate.position.set(x, y - 0.08, z);
      g.add(plate);
    }
    hydraSpike(g, V(0, y - 0.05, z), V(0, 1, -0.45), 0.55 + (i % 2) * 0.15);
  }
  // Las patas: muslo, pierna, pie y tres garras negras
  for (const [sx, z] of [[-1, 1.05], [1, 1.05], [-1, -1.05], [1, -1.05]]) {
    const hip = V(sx * 0.95, 1.35, z), knee = V(sx * 1.65, 0.95, z + 0.2), ankle = V(sx * 1.6, 0.18, z + 0.42);
    hydraRod(g, hip, knee, 0.42, HYDRA.scale, 0.32);
    hydraRod(g, knee, ankle, 0.3, HYDRA.scale, 0.22);
    const joint = mesh(new THREE.SphereGeometry(0.32, 8, 6), HYDRA.scale);
    joint.position.copy(knee);
    g.add(joint);
    hydraSpike(g, knee, V(sx, 0.6, -0.5), 0.45);
    const foot = mesh(new THREE.SphereGeometry(0.3, 8, 6), HYDRA.scale);
    foot.scale.set(1, 0.45, 1.3);
    foot.position.set(ankle.x, 0.12, ankle.z + 0.12);
    g.add(foot);
    for (const dx of [-0.16, 0, 0.16]) hydraSpike(g, V(ankle.x + dx, 0.12, ankle.z + 0.42), V(dx * 2, -0.35, 1), 0.32, 0.06, HYDRA.claw);
  }
  // La cola: larga, enroscada hacia un lado y hacia arriba, con púas
  const tail = [V(0, 1.35, -1.6), V(-0.3, 1.05, -2.6), V(-1.1, 0.95, -3.4), V(-2.1, 1.25, -3.6), V(-2.75, 1.85, -3.1), V(-2.85, 2.45, -2.3), V(-2.5, 2.8, -1.7)];
  for (let i = 1; i < tail.length; i++) {
    const r0 = 0.55 * (1 - (i - 1) / tail.length) + 0.06, r1 = 0.55 * (1 - i / tail.length) + 0.06;
    hydraRod(g, tail[i - 1], tail[i], r0, i % 2 ? HYDRA.scale : HYDRA.dark, r1);
    const j = mesh(new THREE.SphereGeometry(r1, 8, 6), HYDRA.scale);
    j.position.copy(tail[i]);
    g.add(j);
    const up = new THREE.Vector3().subVectors(tail[i], tail[i - 1]).cross(V(1, 0, 0)).normalize();
    hydraSpike(g, tail[i - 1].clone().lerp(tail[i], 0.5), up.y < 0 ? up.negate() : up, 0.5 - i * 0.04);
  }
  hydraSpike(g, tail.at(-1), new THREE.Vector3().subVectors(tail.at(-1), tail.at(-2)), 0.45, 0.12);
  // Los cuellos en abanico desde los hombros: el del centro, el más alto
  for (let i = 0; i < heads; i++) {
    const t = heads === 1 ? 0 : (i / (heads - 1)) * 2 - 1;
    const yaw = t * 1.5 + (rand() - 0.5) * 0.12;
    const height = (omen ? 0.6 : 1) * (1 - 0.38 * Math.abs(t)) * (0.85 + rand() * 0.3);
    const neck = hydraNeck(rand, height, heads > 7 ? 0.85 : 1);
    neck.position.set(Math.sin(yaw) * 1.0, 1.95, 0.55 + Math.cos(yaw) * 0.75);
    neck.rotation.y = yaw;
    neck.userData.wiggle = { base: 0, amp: 0.05, speed: 0.6 + rand() * 0.4, phase: rand() * 6 };
    g.add(neck);
  }
  return g;
}

/** Un cuello de la Hidra (en S, hacia +Z y arriba) con la cresta dorada por detrás y su cabeza. */
function hydraNeck(rand, height, thick) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // (cada uno con su propia ondulación, para que no salgan todos iguales)
  const w = () => (rand() - 0.5) * 0.5;
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(w(), 1.7, 0.9), V(w(), 3.3, 1.0), V(w(), 4.6, 2.0), V(0, 5.3, 3.1)].map((p) => p.multiply(V(1, height, 1))));
  const pts = curve.getPoints(9);
  for (let i = 1; i < pts.length; i++) {
    const r0 = (0.38 - (i - 1) * 0.02) * thick, r1 = (0.38 - i * 0.02) * thick;
    hydraRod(g, pts[i - 1], pts[i], r0, HYDRA.scale, r1);
    // La franja clara del vientre por delante
    const front = (p) => p.clone().add(V(0, -0.04, r0 * 0.72));
    hydraRod(g, front(pts[i - 1]), front(pts[i]), r0 * 0.3, HYDRA.belly, r1 * 0.3);
    const j = mesh(new THREE.SphereGeometry(r1, 8, 6), HYDRA.scale);
    j.position.copy(pts[i]);
    g.add(j);
    // La cresta: púas doradas por la nuca
    const tangent = new THREE.Vector3().subVectors(pts[i], pts[i - 1]).normalize();
    const back = new THREE.Vector3().crossVectors(tangent, V(1, 0, 0)).normalize();
    if (back.z > 0) back.negate();
    hydraSpike(g, pts[i].clone().addScaledVector(back, r1 * 0.7), back.add(V(0, 0.25, 0)), 0.42 * thick, 0.1 * thick, i % 2 ? HYDRA.gold : HYDRA.gold2);
  }
  const head = hydraHead(thick * 1.45);
  head.position.copy(pts.at(-1));
  const dir = new THREE.Vector3().subVectors(pts.at(-1), pts.at(-3)).normalize();
  head.rotation.x = -Math.atan2(dir.y, dir.z) * 0.45 + 0.15;
  head.userData.wiggle = { base: 0, amp: 0.12, speed: 0.9 + rand() * 0.5, phase: rand() * 6 };
  g.add(head);
  return g;
}

/** Una cabeza de dragón con la boca abierta: colmillos, lengua bífida, ojos de oro y cresta de púas. */
function hydraHead(k = 1) {
  const h = new THREE.Group();
  h.scale.setScalar(k);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Cráneo y morro (mandíbula de arriba)
  const skull = mesh(new THREE.SphereGeometry(0.36, 10, 8), HYDRA.scale);
  skull.scale.set(1, 0.85, 1.1);
  h.add(skull);
  const snout = mesh(new THREE.ConeGeometry(0.3, 0.95, 6), HYDRA.scale);
  snout.rotation.x = Math.PI / 2 + 0.12;
  snout.position.set(0, 0.04, 0.55);
  h.add(snout);
  // La mandíbula de abajo, abierta, con el vientre claro
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.12, 0.05);
  jaw.rotation.x = 0.55;
  const lower = mesh(new THREE.ConeGeometry(0.24, 0.85, 6), HYDRA.belly);
  lower.rotation.x = Math.PI / 2;
  lower.position.z = 0.42;
  jaw.add(lower);
  for (const x of [-0.09, 0.09]) hydraSpike(jaw, V(x, 0.08, 0.62), V(0, 1, 0.15), 0.16, 0.035, HYDRA.teeth);
  // La lengua bífida, colgando
  hydraRod(jaw, V(0, 0.02, 0.2), V(0, -0.02, 0.85), 0.04, HYDRA.tongue, 0.03);
  for (const x of [-0.06, 0.06]) hydraRod(jaw, V(0, -0.02, 0.85), V(x, -0.12, 1.02), 0.025, HYDRA.tongue, 0.012);
  h.add(jaw);
  // El interior rojo de la boca y los colmillos de arriba
  const mouth = mesh(new THREE.SphereGeometry(0.22, 8, 6), HYDRA.mouth);
  mouth.scale.set(0.9, 0.7, 1.4);
  mouth.position.set(0, -0.12, 0.42);
  h.add(mouth);
  for (const [x, z] of [[-0.14, 0.78], [0.14, 0.78], [-0.18, 0.5], [0.18, 0.5]]) hydraSpike(h, V(x, -0.05, z), V(0, -1, 0.1), 0.2, 0.04, HYDRA.teeth);
  // Los ojos de oro, que brillan, con una púa encima
  for (const x of [-0.2, 0.2]) {
    const eye = mesh(new THREE.SphereGeometry(0.07, 6, 4), '#ffb21a', { emissive: '#ff9a00', emissiveIntensity: 2 });
    eye.position.set(x, 0.14, 0.32);
    h.add(eye);
    hydraSpike(h, V(x * 0.9, 0.2, 0.3), V(x * 2, 0.6, -0.5), 0.22, 0.05);
  }
  // La cresta de púas doradas en abanico hacia atrás
  for (let i = 0; i < 7; i++) {
    const a = -1.1 + (i / 6) * 2.2;
    hydraSpike(h, V(Math.sin(a) * 0.28, 0.12 + Math.cos(a) * 0.12, -0.15), V(Math.sin(a) * 0.9, 0.55 + Math.cos(a) * 0.35, -1), 0.5 + Math.cos(a) * 0.25, 0.08, i % 2 ? HYDRA.gold : HYDRA.gold2);
  }
  return h;
}
