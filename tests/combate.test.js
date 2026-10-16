import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO } from '../src/game/data.js';
import { assault, siegeOf } from '../src/game/combat.js';
import { navalDefense, playerCombat, wallBonus } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Combate contra ciudades: las catapultas y el almirante.

/** Ejecuta `fn` con el azar fijo, para comparar dos combates. */
function fixedRandom(fn) {
  const old = Math.random;
  Math.random = () => 0.5;
  try {
    return fn();
  } finally {
    Math.random = old;
  }
}

test('las catapultas rebajan la muralla de una ciudad como en las islas neutrales', async () => {
  const { players } = await makeWorld();
  const [, B] = players;
  Object.assign(B.state.buildings, { muralla: 10, torre: 0, faro: 0 });
  B.state.units = { hoplita: 60 };
  const units = { mercante: 60, catapulta: 10, hoplita: 60 };
  assert.ok(Math.abs(siegeOf(units) - 0.6) < 1e-9);
  const res = fixedRandom(() => B.receiveAttack({ attackerName: 'Prueba', units, atkMul: 1, hpMul: 1 }, B.now()));
  const expected = (wallHp) => {
    const wall = wallBonus(10, 0);
    const mine = playerCombat(B.state);
    return fixedRandom(() =>
      assault({ units, atkMul: 1, hpMul: 1 }, { units: { hoplita: 60 }, atkMul: mine.atkMul, hpMul: mine.hpMul, navalHpMul: navalDefense(0), wallHp, extraAtk: wall.towers }, { needLanding: true, rand: Math.random }),
    );
  };
  assert.deepEqual(res.result.def.lost, expected(wallBonus(10).hp - 0.6).def.lost, 'combate con la muralla rebajada');
  assert.notDeepEqual(expected(wallBonus(10).hp).def.lost, res.result.def.lost, 'sin rebajar habría sido otro');
});

test('en el nivel máximo el almirante no acumula más experiencia', async () => {
  const { players } = await makeWorld();
  const [, B] = players;
  const top = HERO.xpFor(HERO.maxLevel);
  B.state.hero = { name: 'Temístocles', level: HERO.maxLevel, xp: top - 10, points: 0, skills: { ataque: 0, defensa: 0, botin: 0, velocidad: 0 }, woundedUntil: 0, mission: null };
  B.state.units = { hoplita: 200, trirreme: 20 };
  B.receiveAttack({ attackerName: 'Prueba', units: { trirreme: 5, mercante: 10, hoplita: 20 }, atkMul: 1, hpMul: 1 }, B.now());
  assert.equal(B.state.hero.level, HERO.maxLevel);
  assert.equal(B.state.hero.xp, top, 'se queda en lo que pide el último nivel');
});
