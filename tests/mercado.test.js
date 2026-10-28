import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// Las ofertas del mercado se anuncian en el chat general, con un enlace a ellas, pero sin llenarlo.

test('una oferta nueva se anuncia en el chat general, como mucho una por jugador cada rato', async () => {
  const { world, players } = await makeWorld();
  const [A, B] = players;
  Object.assign(A.state.resources, { madera: 50_000, piedra: 50_000 });
  Object.assign(B.state.resources, { madera: 50_000 });
  for (const g of [A, B]) g.state.units.mercante = 10;
  const notices = () => world.chat.filter((m) => m.system && m.offer);

  world.postOffer(A.userId, { madera: 1000 }, { cristal: 400 });
  assert.equal(notices().length, 1);
  const [n] = notices();
  assert.equal(n.channel, 'global');
  assert.equal(n.offer, world.meta.offers.at(-1).id);
  assert.match(n.text, /Lucio ofrece 1\.000 🪵 por 400 💎/);

  // Otra suya enseguida: está en el mercado, pero no se vuelve a anunciar
  world.postOffer(A.userId, { piedra: 500 }, { oro: 100 });
  assert.equal(world.meta.offers.length, 2);
  assert.equal(notices().length, 1);

  // La de otro jugador sí
  world.postOffer(B.userId, { madera: 300 }, { piedra: 300 });
  assert.equal(notices().length, 2);
});
