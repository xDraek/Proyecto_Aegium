import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UNITS } from '../src/game/data.js';
import { makeWorld } from './world.js';

// Dar de baja tropas y barcos: solo los de casa, sin recuperar nada, y primero los mercenarios.

test('se dan de baja tropas y barcos que están en casa y se recupera el 20 % de madera, comida y bronce', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  Object.assign(A.state.units, { hoplita: 30, trirreme: 4 });
  A.state.resources = { madera: 1000, piedra: 1000, comida: 1000, hierro: 1000, cristal: 1000, oro: 1000 };
  const before = { ...A.state.resources };
  assert.equal(A.dismissUnits('hoplita', 10).ok, true);
  assert.equal(A.state.units.hoplita, 20);
  for (const r of Object.keys(before)) {
    const back = ['madera', 'comida', 'hierro'].includes(r) ? Math.floor((UNITS.hoplita.cost[r] ?? 0) * 10 * 0.2) : 0;
    assert.ok(Math.abs(A.state.resources[r] - before[r] - back) < 2, `${r}: +${back}`);
  }
  assert.equal(A.dismissUnits('trirreme', 4).ok, true);
  assert.equal(A.state.units.trirreme, 0);
  assert.equal(A.dismissUnits('hoplita', 21).ok, false, 'no más de las que hay');
  assert.equal(A.dismissUnits('hoplita', 0).ok, false);
  assert.equal(A.dismissUnits('kraken', 1).ok, false, 'solo unidades de jugador');
});

test('al dar de baja se van antes los mercenarios de esa unidad', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  A.state.units.hoplita = 30;
  A.state.mercs = [{ id: 'm', unit: 'hoplita', count: 10, until: A.now() + 3_600_000 }];
  assert.equal(A.dismissUnits('hoplita', 6).ok, true);
  assert.equal(A.state.mercs[0].count, 4);
  assert.equal(A.dismissUnits('hoplita', 5).ok, true);
  assert.equal(A.state.mercs.length, 0);
  assert.equal(A.state.units.hoplita, 19);
});
