import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// Los tratos del mercado viajan en barco: quien publica aparta los mercantes que llevarán su parte;
// al aceptar, zarpan los de los dos hacia la ciudad del otro. La carga llega al atracar y los
// barcos no vuelven a estar libres hasta que regresan a casa.

test('publicar una oferta aparta los mercantes que la llevarán, y retirarla los devuelve', async () => {
  const { world, players } = await makeWorld();
  const [A] = players;
  A.state.units.mercante = 1;
  assert.throws(() => world.postOffer(A.userId, { madera: 1200 }, { cristal: 300 }), /3 barcos mercantes libres/);
  assert.equal(A.state.units.mercante, 1);

  A.state.units.mercante = 4;
  world.postOffer(A.userId, { madera: 1200 }, { cristal: 300 });
  assert.equal(A.state.units.mercante, 1);
  assert.equal(world.meta.offers.at(-1).ships, 3);

  world.cancelOffer(A.userId, world.meta.offers.at(-1).id);
  assert.equal(A.state.units.mercante, 4);
});

test('al aceptar, los mercaderes de los dos zarpan y la carga solo llega al atracar', async () => {
  const env = await makeWorld();
  const { world } = env;
  const [A, B] = env.players;
  A.state.units.mercante = 2;
  B.state.units.mercante = 0;
  world.postOffer(A.userId, { madera: 800 }, { cristal: 300 });
  const offer = world.meta.offers.at(-1);

  // Sin mercantes no se puede pagar
  assert.throws(() => world.acceptOffer(B.userId, offer.id), /1 barco mercante libre/);
  assert.equal(world.meta.offers.length, 1);

  B.state.units.mercante = 3;
  const before = { aMadera: A.state.resources.madera, aCristal: A.state.resources.cristal, bMadera: B.state.resources.madera, bCristal: B.state.resources.cristal };
  world.acceptOffer(B.userId, offer.id);
  assert.equal(world.meta.offers.length, 0);

  // Los barcos han zarpado: el comprador paga ya, pero nadie recibe nada todavía
  const toB = A.state.missions.find((m) => m.type === 'comercio');
  const toA = B.state.missions.find((m) => m.type === 'comercio');
  assert.deepEqual(toB.units, { mercante: 2 });
  assert.deepEqual(toA.units, { mercante: 1 });
  assert.equal(toB.target, B.state.home);
  assert.equal(toA.target, A.state.home);
  assert.equal(A.state.units.mercante, 0);
  assert.equal(B.state.units.mercante, 2);
  assert.ok(B.state.resources.cristal <= before.bCristal - 300 + 1);
  assert.ok(B.state.resources.madera < before.bMadera + 800);
  assert.ok(A.state.resources.cristal < before.aCristal + 300);

  // No se pueden hacer volver a mitad de camino (no se deshace un trato), ni ocupan una flota
  assert.equal(B.recall(toA.id).ok, false);
  assert.equal(B.fleetsAtSea(), 0);

  // Al llegar cada uno recibe lo suyo y los barcos dan la vuelta
  env.until(Math.max(toA.arrive, toB.arrive));
  assert.ok(A.state.resources.cristal >= before.aCristal + 300);
  assert.ok(B.state.resources.madera >= before.bMadera + 800);
  assert.equal(toA.phase, 'vuelta');
  assert.equal(B.state.units.mercante, 2);

  // Y vuelven a estar libres cuando regresan
  env.until(Math.max(toA.back, toB.back));
  assert.equal(A.state.units.mercante, 2);
  assert.equal(B.state.units.mercante, 3);
  assert.equal(A.state.missions.filter((m) => m.type === 'comercio').length, 0);
});

test('con el puerto bloqueado o la ciudad ocupada no se comercia en el mercado', async () => {
  const env = await makeWorld();
  const { world } = env;
  const [A, B] = env.players;
  for (const g of [A, B]) g.state.units.mercante = 10;
  world.postOffer(A.userId, { madera: 500 }, { cristal: 100 });
  const offer = world.meta.offers.at(-1);

  // Bloqueado: ni publica, ni acepta, ni cambia con los mercaderes del mercado
  B.state.blockade = { by: 999, mission: 1, name: 'Corsarios' };
  assert.throws(() => world.postOffer(B.userId, { madera: 500 }, { cristal: 100 }), /bloqueado/);
  assert.throws(() => world.acceptOffer(B.userId, offer.id), /bloqueado/);
  assert.equal(B.trade('madera', 'oro', 100).ok, false);
  B.state.blockade = null;

  // Ocupada la ciudad de quien vende: su oferta sale marcada y nadie la puede aceptar
  A.state.occupied = { by: 999, mission: 1, name: 'Invasores' };
  assert.equal(world.listOffers(B.userId).find((o) => o.id === offer.id).closed, true);
  assert.throws(() => world.acceptOffer(B.userId, offer.id), /ocupada/);
  assert.throws(() => world.postOffer(A.userId, { piedra: 500 }, { cristal: 100 }), /ocupada/);

  // Libre otra vez, el trato sale
  A.state.occupied = null;
  assert.equal(world.listOffers(B.userId).find((o) => o.id === offer.id).closed, false);
  world.acceptOffer(B.userId, offer.id);
  assert.equal(world.meta.offers.length, 0);
});
