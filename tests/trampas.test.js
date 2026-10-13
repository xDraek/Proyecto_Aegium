import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { EXPEDITION, RESOURCES } from '../src/game/data.js';
import { makeWorld, sendAndArrive } from './world.js';

// Arreglos contra trampas: expediciones con un bote, oro barato en el mercado, ofertas que son
// regalos, guerras para saltarse la protección y piratas contra los recién llegados.

test('una expedición con un solo bote no trae botín, y solo hay una a la vez', async () => {
  const env = await makeWorld();
  const [A] = env.players;
  A.state.research.navegacion = 4;
  const brumas = env.world.islandsNear(A.state.home, 2000).find((i) => i.type === 'brumas');
  A.state.units.bote = 2;
  for (let i = 0; i < 40; i++) {
    A.state.units.bote = 2;
    const m = sendAndArrive(env, A, 'expedicion', brumas.id, { bote: 1 });
    // (si la emboscada hundió el bote, ya no queda expedición en el mar)
    if (A.state.missions.length) assert.match(A.planMission('expedicion', brumas.id, { bote: 1 }).reason, /una a la vez/);
    assert.equal(Object.keys(m.cargo ?? {}).length, 0, 'sin bodega no se trae nada');
    if (m.phase === 'vuelta') assert.ok(m.back - m.turn >= EXPEDITION.stayHours * 3_600_000, 'se queda explorando');
    while (A.state.missions.length) env.advance(1_800_000);
    // Barcos regalados: como mucho uno (los que puede tripular)
    assert.ok((A.state.units.mercante ?? 0) + (A.state.units.trirreme ?? 0) <= 1 + i);
  }
});

test('comprar oro en el mercado sale a la mitad (como mucho un 30 %)', async () => {
  const { players } = await makeWorld();
  const [A] = players;
  Object.assign(A.state.buildings, { mercado: 30 });
  A.state.research.comercio = 20;
  const fair = RESOURCES.hierro.value / RESOURCES.oro.value;
  const rate = A.tradeRate('hierro', 'oro');
  assert.ok(rate <= fair * 0.3 * 1.5 + 1e-9);
  assert.ok(A.tradeRate('hierro', 'cristal') / (RESOURCES.hierro.value / RESOURCES.cristal.value) > rate / fair * 1.9);
});

test('la protección de los débiles se mantiene en guerra', async () => {
  const { players } = await makeWorld();
  const [A, B] = players;
  A.state.stats.spent = 5_000_000;
  const view = { type: 'jugador', relation: 'guerra', score: 1000, owner: B.userId };
  assert.equal(A.tooWeak(view), true);
});

test('las ofertas entre jugadores tienen precio libre, pero piden no estar de vacaciones', async () => {
  const { world, players } = await makeWorld();
  const [A] = players;
  world.postOffer(A.userId, { madera: 10_000 }, { cristal: 1 });
  world.postOffer(A.userId, { cristal: 1 }, { madera: 10_000 });
  A.state.vacation = { since: clock.now(), until: clock.now() + 1 };
  assert.throws(() => world.postOffer(A.userId, { madera: 1000 }, { cristal: 400 }), /vacaciones/);
});

test('mientras tengas protección de novato los piratas vienen a media fuerza', async () => {
  const env = await makeWorld();
  const [A, B] = env.players;
  for (const g of [A, B]) {
    g.state.buildings.ayuntamiento = 3;
    g.state.stats.spent = 50_000; // 500 puntos
    g.state.nextRaidAt = clock.now() + 1000;
  }
  A.state.startedAt = clock.now(); // novato
  B.state.startedAt = clock.now() - 10 * 86_400_000; // ya no
  env.advance(2000);
  assert.ok(A.state.raid && B.state.raid);
  assert.ok(A.state.raid.army.pirata < B.state.raid.army.pirata);
});
