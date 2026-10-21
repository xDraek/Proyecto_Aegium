import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO } from '../src/game/data.js';
import { newState, upgradeState } from '../src/game/Game.js';

// El almirante solo llega al nivel 10. Los que estaban más arriba bajan al 10 y recuperan sus
// 10 puntos de habilidad para repartirlos de nuevo.

const withHero = (hero) => ({ ...newState({ now: 0, home: 'h-1', name: 'Prueba' }), seq: 7, hero });

test('el almirante llega como mucho al nivel 10', () => {
  assert.equal(HERO.maxLevel, 10);
});

test('un almirante por encima del 10 baja al 10 con los puntos para repartir y un aviso', () => {
  const s = upgradeState(withHero({ name: 'Temístocles', level: 17, xp: 9999, points: 2, skills: { ataque: 8, defensa: 4, botin: 2, velocidad: 1 }, woundedUntil: 0, mission: null }));
  assert.equal(s.hero.level, 10);
  assert.equal(s.hero.xp, HERO.xpFor(10));
  assert.equal(s.hero.points, 10);
  assert.deepEqual(s.hero.skills, { ataque: 0, defensa: 0, botin: 0, velocidad: 0 });
  assert.equal(s.hero.name, 'Temístocles');
  const note = s.notes.at(-1);
  assert.match(note.text, /nivel 10/);
  assert.equal(note.id, 7);
  assert.equal(s.seq, 8);
  // Cargarla otra vez no cambia nada
  const again = upgradeState(s);
  assert.deepEqual(again.hero, s.hero);
  assert.equal(again.notes.length, s.notes.length);
});

test('un almirante de nivel 10 o menos se queda como estaba', () => {
  const hero = { name: 'Cimón', level: 6, xp: 1200, points: 1, skills: { ataque: 3, defensa: 1, botin: 1, velocidad: 0 }, woundedUntil: 0, mission: null };
  const s = upgradeState(withHero(hero));
  assert.deepEqual(s.hero, hero);
  assert.equal(s.seq, 7);
});
