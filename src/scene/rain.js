import * as THREE from 'three';
import { rng } from './util.js';

// Lluvia calculada en la GPU: cada gota es un trazo con su velocidad, su largo y una estela que se
// desvanece, inclinada por el viento. Al acabar de caer vuelve a salir arriba en otro sitio, así que
// no se ve la misma cortina repitiéndose. Sobre el mar, anillos de salpicadura que se abren y se
// apagan. Todo se mueve en el shader: en cada fotograma solo cambian unos pocos uniforms.

const HASH = /* glsl */ `
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  // Dónde cae una gota en su vuelta número «cycle»: cada vuelta, en otro sitio
  vec2 dropAt(vec2 seed, float cycle) {
    return seed + (vec2(hash(cycle * 12.9898 + seed.x * 78.233), hash(cycle * 39.346 + seed.y * 11.135)) - 0.5) * 0.6;
  }
`;

/** Las olas del mar abierto (la misma cuenta que water.js) para que las salpicaduras floten en ellas. */
const SWELL = /* glsl */ `
  float swell(vec2 p, float t) {
    return sin(p.x * 0.21 + t * 1.1) * 0.12 + cos(p.y * 0.17 - t * 0.9) * 0.1 + sin((p.x + p.y) * 0.11 + t * 0.7) * 0.08;
  }
`;

/** Uniforms que comparten las gotas y las salpicaduras (los mismos objetos: se actualizan una vez). */
export function rainUniforms() {
  return {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector2() },
    uSpan: { value: 60 },
    uHeight: { value: 48 },
    uLen: { value: 1.5 },
    uWind: { value: new THREE.Vector2(0.22, 0.06) },
    uActive: { value: 0 },
    uOpacity: { value: 0 },
    uBase: { value: 0 },
    uSplash: { value: 0 },
    uColor: { value: new THREE.Color('#dce9f7') },
  };
}

/**
 * Las gotas: `count` trazos de dos vértices.
 * Atributos: aSeed (x, z en [-1, 1], fase, velocidad), aEnd (0 la punta, 1 la cola), aRank (orden en
 * que se encienden: con lluvia floja solo caen las primeras).
 */
export function createRain(count, uniforms) {
  const rand = rng(977);
  const seed = new Float32Array(count * 8);
  const end = new Float32Array(count * 2);
  const rank = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [rand() * 2 - 1, rand() * 2 - 1, rand(), 0.75 + rand() * 0.6];
    for (let k = 0; k < 2; k++) {
      seed.set(s, (i * 2 + k) * 4);
      end[i * 2 + k] = k;
      rank[i * 2 + k] = rand();
    }
    rank[i * 2 + 1] = rank[i * 2];
  }
  const geo = new THREE.BufferGeometry();
  // La posición la calcula el shader; three.js necesita igualmente el atributo
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...uniforms },
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aEnd;
      attribute float aRank;
      uniform float uTime, uSpan, uHeight, uLen, uActive, uBase;
      uniform vec2 uCenter, uWind;
      varying float vAlpha;
      ${HASH}
      #include <fog_pars_vertex>
      void main() {
        float speed = aSeed.w;
        float t = uTime * 0.85 * speed + aSeed.z;
        float cycle = floor(t);
        float f = fract(t);
        vec2 xz = uCenter + dropAt(aSeed.xy, cycle) * uSpan;
        float y = uBase + (1.0 - f) * uHeight;
        // Al caer se desplaza con el viento; la cola apunta contra la marcha
        xz += uWind * (1.0 - f) * uHeight;
        vec3 p = vec3(xz.x, y, xz.y);
        p += aEnd * vec3(uWind.x, 1.0, uWind.y) * uLen * (0.6 + 0.7 * (speed - 0.75) / 0.6);
        // La punta se ve y la cola se apaga; aparecen suaves arriba
        vAlpha = (1.0 - aEnd) * smoothstep(0.0, 0.12, f) * step(aRank, uActive);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, uOpacity * vAlpha);
        #include <fog_fragment>
      }
    `,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  lines.visible = false;
  return lines;
}

/**
 * Salpicaduras sobre el mar: anillos planos que se abren y se apagan, cada uno en otro sitio en
 * cada vuelta. En tierra quedan por debajo del suelo y no se ven.
 */
export function createSplashes(count, uniforms) {
  const rand = rng(1931);
  const ring = new THREE.RingGeometry(0.84, 1, 24);
  ring.rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry().copy(ring);
  geo.instanceCount = count;
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([rand() * 2 - 1, rand() * 2 - 1, rand(), 0.8 + rand() * 0.5], i * 4);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));

  const material = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...uniforms },
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uSpan, uSplash, uBase;
      uniform vec2 uCenter;
      varying float vAlpha;
      ${HASH}
      ${SWELL}
      #include <fog_pars_vertex>
      void main() {
        float t = uTime * 1.6 * aSeed.w + aSeed.z;
        float cycle = floor(t);
        float f = fract(t);
        // Más cerca de lo que miras (donde se distinguen)
        vec2 xz = uCenter + dropAt(aSeed.xy, cycle) * uSpan * 0.55;
        float size = mix(0.15, 0.42, sqrt(f)) * (0.7 + aSeed.w * 0.4);
        vec3 p = vec3(xz.x, uBase + swell(xz, uTime) + 0.06, xz.y) + position * size;
        vAlpha = (1.0 - f) * (1.0 - f) * step(hash(cycle + aSeed.z * 91.7), uSplash);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, uOpacity * 0.55 * vAlpha);
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
