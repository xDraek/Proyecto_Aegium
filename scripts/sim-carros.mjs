// Simula los carros y los aldeanos de la avenida del puerto (World.#updateWalkers) sin navegador,
// para buscar atascos: un carro (o alguien) que se queda parado sin estar dando la vuelta.
//   node scripts/sim-carros.mjs [minutos] [aldeanos] [semilla] [segundos parado que cuentan como atasco]
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { rng } from '../src/scene/util.js';

const src = readFileSync(new URL('../src/scene/World.js', import.meta.url), 'utf8');
const num = (name) => Number(src.match(new RegExp(`const ${name} = ([\\d.]+);`))[1]);
const consts = { GATE_ANGLE: num('GATE_ANGLE'), ROAD_R: num('ROAD_R'), AVENUE_IN: num('AVENUE_IN'), CART_TURN_R: num('CART_TURN_R'), STUCK_SECONDS: num('STUCK_SECONDS'), PAVE_Y: num('PAVE_Y'), TAU: Math.PI * 2 };
// El cuerpo de #updateWalkers, tal cual
const start = src.indexOf('  #updateWalkers(dt, t) {');
let depth = 0;
let i = src.indexOf('{', start);
const open = i;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}' && --depth === 0) break;
}
const body = src.slice(open + 1, i);
const update = new Function('THREE', ...Object.keys(consts), 'dt', 't', body);

const minutes = Number(process.argv[2] ?? 30);
const n = Number(process.argv[3] ?? 56);
const seed = Number(process.argv[4] ?? 1234);
const LIMIT = Number(process.argv[5] ?? 30);
const COAST = 37.13;
const world = {
  coast: () => COAST,
  carts: [],
  villagers: [],
};
for (let k = 0; k < 4; k++) {
  const c = new THREE.Object3D();
  c.visible = true;
  c.userData.walk = { avenue: true, cart: true, s: consts.AVENUE_IN + 1.5 + k * 5.5, dir: k % 2 ? -1 : 1, speed: 0.7 + k * 0.04 };
  world.carts.push(c);
}
const rand = rng(seed);
for (let k = 0; k < n; k++) {
  const v = new THREE.Object3D();
  const avenue = k % 3 === 0;
  v.userData.walk = avenue
    ? { avenue, side: rand() < 0.5 ? 1 : -1, s: consts.AVENUE_IN + 2.5 + rand() * (COAST - consts.AVENUE_IN - 8), dir: rand() < 0.5 ? 1 : -1, speed: 0.5 + rand() * 0.4 }
    : { avenue, a: rand() * consts.TAU, dir: rand() < 0.5 ? 1 : -1, speed: 0.45 + rand() * 0.45 };
  world.villagers.push(v);
}

const dt = 1 / 30;
const steps = Math.round((minutes * 60) / dt);
const all = [...world.carts, ...world.villagers];
const last = all.map((o) => ({ p: o.position.clone(), since: 0, reported: false }));
let stuck = 0;
for (let s = 0; s < steps; s++) {
  const t = s * dt;
  update.call(world, THREE, ...Object.values(consts), dt, t);
  all.forEach((o, k) => {
    const L = last[k];
    const w = o.userData.walk;
    if (o.position.distanceTo(L.p) > 0.02 || w.turn > 0) {
      L.p.copy(o.position);
      L.since = 0;
      L.reported = false;
      return;
    }
    L.since += dt;
    if (L.since > LIMIT && !L.reported) {
      L.reported = true;
      stuck++;
      const who = w.cart ? `carro ${k}` : `aldeano ${k - 4}${w.avenue ? ' (avenida)' : ' (ronda)'}`;
      console.log(`${(t / 60).toFixed(1)} min: ${who} parado ${LIMIT} s · s=${w.s?.toFixed(2) ?? '-'} a=${w.a?.toFixed(2) ?? '-'} dir=${w.dir} lane=${w.lane?.toFixed(2)} pending=${!!w.pending} claim=${!!w.claim}`);
    }
  });
}
console.log(`${minutes} min simulados con ${n} aldeanos: ${stuck} atascos de más de ${LIMIT} s`);
