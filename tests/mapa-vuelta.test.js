import assert from 'node:assert/strict';
import { test } from 'node:test';
import { universe } from '../src/config.js';
import { SECTOR_SPACING, distance, hexRing, nearestImage, sectorCenter, wrapRingFor } from '../src/game/world.js';
import { makeWorld } from './world.js';

// El mapa da la vuelta por los bordes: es un mosaico de hexágonos de sectores que se repite. Nadie
// queda en una esquina, lejos de todo.

test('los anillos de la espiral y el tamaño del mosaico (un anillo de mar más que el último ocupado)', () => {
  assert.equal(hexRing(0), 0);
  assert.equal(hexRing(1), 1);
  assert.equal(hexRing(6), 1);
  assert.equal(hexRing(7), 2);
  assert.equal(hexRing(18), 2);
  assert.equal(hexRing(19), 3);
  assert.equal(wrapRingFor(0), 0);
  assert.equal(wrapRingFor(1), 1);
  assert.equal(wrapRingFor(7), 2);
  assert.equal(wrapRingFor(8), 3);
});

test('en el mosaico, cada sector tiene seis vecinos, también los del borde', () => {
  const before = universe.wrap;
  universe.wrap = 2;
  const cells = Array.from({ length: 19 }, (_, i) => sectorCenter(i));
  for (let i = 0; i < cells.length; i++) {
    const near = cells.filter((c, j) => j !== i && Math.abs(distance(cells[i], c) - SECTOR_SPACING) < 1).length;
    assert.equal(near, 6, `el sector ${i} tiene ${near} vecinos`);
    for (let j = 0; j < i; j++) assert.ok(distance(cells[i], cells[j]) > SECTOR_SPACING * 0.99, 'ninguno encima de otro');
  }
  // Dos sectores en lados opuestos del borde quedan cerca cruzando la costura
  const a = sectorCenter(7);
  const far = cells.reduce((best, c) => (Math.hypot(c.x - a.x, c.z - a.z) > Math.hypot(best.x - a.x, best.z - a.z) ? c : best), a);
  assert.ok(Math.hypot(far.x - a.x, far.z - a.z) > 3.5 * SECTOR_SPACING, 'en el mapa plano, lejos');
  assert.ok(distance(a, far) <= 2 * SECTOR_SPACING + 1, 'dando la vuelta, a dos sectores como mucho');
  const img = nearestImage(far, a);
  assert.ok(Math.abs(Math.hypot(img.x - a.x, img.z - a.z) - distance(a, far)) < 1e-6);
  universe.wrap = before;
});

test('el servidor fija el mosaico al cargar y al abrir sectores, y el estado lo cuenta', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal']);
  assert.equal(universe.wrap, wrapRingFor(W.meta.sectors));
  assert.equal(W.snapshot(players[0].userId).wrap, universe.wrap);
});
