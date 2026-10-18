import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { ClientWorld } from '../src/net/ClientWorld.js';
import { makeWorld, sendAndArrive } from './world.js';

// El estado de las islas va entero la primera vez y luego solo lo que cambia: así cada foto pesa
// poco aunque el mundo sea enorme.

/** Una conexión en vivo de mentira que guarda lo que le llega. */
const fakeSocket = () => ({ readyState: 1, got: [], send(data) { this.got.push(JSON.parse(data).data); } });

test('tras la primera foto, solo van las islas que han cambiado', async () => {
  const env = await makeWorld();
  const W = env.world;
  const [A] = env.players;
  const rev = W.islandsRev();
  const first = W.snapshot(A.userId, rev);
  assert.equal(first.world.full, true);
  const all = Object.keys(first.world.states).length;
  assert.ok(all > 20);
  // Sin cambios: nada
  const none = W.snapshot(A.userId, rev, first.world.statesRev);
  assert.equal(none.world.full, false);
  assert.deepEqual(Object.keys(none.world.states), []);
  // Alguien saquea unas ruinas: solo va esa isla
  const ruin = [...W.islands.values()].find((i) => i.type === 'ruinas');
  A.state.units.bote = 1;
  sendAndArrive(env, A, 'explorar', ruin.id, { bote: 1 });
  const delta = W.snapshot(A.userId, rev, none.world.statesRev);
  assert.equal(delta.world.full, false);
  assert.ok(delta.world.states[ruin.id]?.looted, 'va la isla que ha cambiado');
  assert.ok(Object.keys(delta.world.states).length < all / 4, 'y no todas');
  // Los jugadores del mapa van siempre
  assert.ok(delta.world.players[A.userId]);
});

test('va entero si el navegador no tiene versión, es de otro arranque o cambia la lista de islas', async () => {
  const env = await makeWorld();
  const W = env.world;
  const [A] = env.players;
  const rev = W.islandsRev();
  const s = W.snapshot(A.userId, rev).world.statesRev;
  assert.equal(W.snapshot(A.userId, rev, null).world.full, true);
  assert.equal(W.snapshot(A.userId, rev, `otro.${s.split('.')[1]}`).world.full, true);
  assert.equal(W.snapshot(A.userId, rev, 'basura').world.full, true);
  // Llega un jugador nuevo (y su sector): la lista de islas cambia y el estado va entero
  await W.register('Nuevo', 'secreto1', 'Nuevapolis', { email: 'nuevo@prueba.es' });
  const after = W.snapshot(A.userId, rev, s);
  assert.equal(after.world.full, true);
  assert.ok(after.world.islands, 'con la lista nueva');
});

test('las gestas van siempre, porque cada uno ve la suya', async () => {
  const env = await makeWorld(['Lucio', 'Anibal', 'Pericles', 'Temis']);
  const W = env.world;
  const [A] = env.players;
  const site = [...W.islands.values()].find((i) => i.type === 'continente').id;
  assert.ok(W.startFeat(site, { players: env.players.map((g) => g.userId) }, clock.now()));
  const rev = W.islandsRev();
  const s = W.snapshot(A.userId, rev).world.statesRev;
  const delta = W.snapshot(A.userId, rev, s);
  assert.ok(delta.world.states[site]?.feat, 'la gesta va aunque no haya cambiado');
});

test('por la conexión en vivo llega entero la primera vez y luego solo lo que cambia', async () => {
  const env = await makeWorld();
  const W = env.world;
  const [A] = env.players;
  const ws = fakeSocket();
  W.addSocket(A.userId, ws);
  W.pendingPush.add(A.userId);
  W.flushPush();
  assert.equal(ws.got[0].world.full, true);
  assert.ok(ws.got[0].world.islands, 'la primera vez, con la lista de islas');
  W.touch([...W.islands.keys()][3]);
  W.pendingPush.add(A.userId);
  W.flushPush();
  assert.equal(ws.got[1].world.full, false);
  assert.equal(ws.got[1].world.islands, null);
  assert.equal(Object.keys(ws.got[1].world.states).length, 1);
  // Pasado un rato va entero otra vez, por si acaso
  ws.statesFullAt -= 61_000;
  W.pendingPush.add(A.userId);
  W.flushPush();
  assert.equal(ws.got[2].world.full, true);
});

test('el navegador junta lo que cambia con lo que ya tenía', () => {
  const cw = new ClientWorld();
  cw.apply({ islands: [{ id: 'a' }, { id: 'b' }], rev: 'r', states: { a: { x: 1 }, b: { x: 2 } }, statesRev: 'k.1', full: true, players: {} });
  cw.apply({ islands: null, rev: 'r', states: { b: { x: 3 } }, statesRev: 'k.2', full: false, players: {} });
  assert.deepEqual(cw.states, { a: { x: 1 }, b: { x: 3 } });
  cw.apply({ islands: null, rev: 'r', states: { a: { x: 9 } }, statesRev: 'k.3', full: true, players: {} });
  assert.deepEqual(cw.states, { a: { x: 9 } }, 'entero: se reemplaza');
});
