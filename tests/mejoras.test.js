import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerCombat } from '../src/game/rules.js';

// Menos fuentes y más claras: el ataque, de la Herrería y la Forja; la vida, de las Armaduras y la
// Táctica; la velocidad, de la Navegación y el Faro (el puerto ya no la sube, ver ayuntamiento.test).

const at = (research = {}, buildings = {}) => playerCombat({ research, buildings, relics: [], wonderBonus: {} });

test('la Táctica militar da vida, no ataque', () => {
  const base = at();
  const t = at({ tactica: 3 });
  assert.equal(t.atkMul, base.atkMul);
  assert.ok(Math.abs(t.hpMul - base.hpMul - 0.09) < 1e-9);
});

test('el ataque sale de la Herrería y la Forja', () => {
  const base = at();
  assert.ok(Math.abs(at({ herreria: 2 }).atkMul - base.atkMul - 0.1) < 1e-9);
  assert.ok(Math.abs(at({}, { forja: 2 }).atkMul - base.atkMul - 0.06) < 1e-9);
});
