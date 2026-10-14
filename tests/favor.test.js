import assert from 'node:assert/strict';
import { test } from 'node:test';
import { favorMax, favorRate } from '../src/game/rules.js';
import { makeWorld } from './world.js';

test('el favor nunca pasa del tope del templo (y el que sobraba de antes vuelve al tope)', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.buildings.templo = 2;
  const max = favorMax(A.state);
  A.state.favor = max - 5;
  env.advance(3_600_000);
  assert.equal(A.state.favor, max, 'con el tiempo llega al tope y se queda');
  // Una cuenta de antes, con favor de más, vuelve al tope
  A.state.favor = max + 150;
  env.advance(60_000);
  assert.equal(A.state.favor, max);
});

test('el templo llega como mucho al nivel 10', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.buildings.templo = 10;
  A.state.buildings.ayuntamiento = 30;
  A.state.resources = { madera: 1e9, piedra: 1e9, comida: 1e9, hierro: 1e9, cristal: 1e9, oro: 1e9 };
  assert.equal(A.upgrade('templo').ok, false);
});

test('de nivel 6 en adelante, cada nivel del templo da la mitad de favor', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  const rate = (templo) => favorRate({ ...A.state, buildings: { ...A.state.buildings, templo } }, 0);
  assert.equal(rate(5) - rate(4), rate(1));
  assert.equal(rate(6) - rate(5), rate(1) / 2);
  assert.equal(rate(10), rate(5) * 1.5);
});

test('los poderes se desbloquean con el nivel del templo', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.buildings.templo = 5;
  A.state.favor = favorMax(A.state);
  A.state.missions = [];
  A.state.units.mercante = 1;
  assert.match(A.castPower('egida').reason, /templo a nivel 6/);
  A.state.buildings.templo = 6;
  assert.equal(A.castPower('egida').ok, true);
});
