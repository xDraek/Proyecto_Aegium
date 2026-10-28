import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { KRAKEN_RULES } from '../src/game/data.js';
import { coordsOf } from '../src/game/world.js';
import { makeWorld } from './world.js';

// Cuando el Kraken despierta, el aviso del chat sale marcado (resaltado y con la zona) y, mientras
// sigue despierto, todos lo saben (sale su icono arriba, sin tiempo ni zona).

process.env.ADMINS = 'Lucio';

test('el despertar del Kraken se marca en el chat y queda a la vista mientras dura', async () => {
  const { world, players } = await makeWorld();
  const [A, B] = players;
  assert.equal(world.snapshot(B.userId).kraken, false);

  world.adminEvent(A.userId, 'kraken');
  const msg = world.chat.findLast((m) => m.system && m.kraken);
  assert.ok(msg, 'el aviso lleva la marca del Kraken');
  assert.match(msg.text, /El Kraken ha despertado/);
  assert.ok(msg.text.includes(`[${msg.kraken.near[0]}:${msg.kraken.near[1]}]`), 'la zona del botón es la del aviso');

  // La zona es aproximada: cerca de su fosa, pero no tiene por qué ser la suya
  const lair = world.islands.get(world.meta.kraken.lair);
  const [cx, cy] = coordsOf(lair.x, lair.z);
  const [nx, ny] = msg.kraken.near;
  assert.ok(Math.abs(nx - cx) <= KRAKEN_RULES.hintCells && Math.abs(ny - cy) <= KRAKEN_RULES.hintCells);
  assert.equal(world.snapshot(B.userId).kraken, true);

  // Al caer (o sumergirse) se va de la vista
  world.krakenSlain(lair.id, 'Lucio', clock.now());
  assert.equal(world.snapshot(B.userId).kraken, false);
});

test('los avisos importantes salen marcados para resaltarlos, cada clase con la suya', async () => {
  const env = await makeWorld();
  const { world } = env;
  const [A] = env.players;
  world.adminEvent(A.userId, 'kraken');
  assert.equal(world.chat.findLast((m) => /El Kraken ha despertado/.test(m.text)).highlight, 'kraken');
  world.adminEvent(A.userId, 'temporada', 'estrellas 2');
  env.advance(1000);
  assert.equal(world.chat.findLast((m) => /Comienza Lluvia de estrellas/.test(m.text)).highlight, 'temporada');
  // Los de siempre (una ciudad nueva, una alianza…) no
  assert.equal(world.chat.find((m) => /funda la ciudad/.test(m.text)).highlight, undefined);
});

test('los avisos de las gestas llevan el enlace al mapa de su continente', async () => {
  const { world, players } = await makeWorld();
  const [A] = players;
  const res = world.adminStartFeat(A.userId, { site: 'hidra', omenMinutes: 1 });
  const msg = world.chat.findLast((m) => m.highlight === 'gesta');
  assert.ok(msg, 'el aviso de la gesta sale resaltado');
  const cont = world.islands.get(res.site);
  assert.deepEqual(msg.zones, [{ at: coordsOf(cont.x, cont.z) }]);
});
