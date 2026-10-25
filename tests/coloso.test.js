import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// El Coloso llega como mucho al nivel 10: ahí queda terminado y no se puede subir más.

test('el Coloso se queda en el nivel 10', async () => {
  const { players } = await makeWorld(['Lucio']);
  const [g] = players;
  Object.assign(g.state.buildings, { ayuntamiento: 10, coloso: 9 });
  g.state.research.arquitectura = 8;
  assert.equal(g.nextUpgrade('coloso').maxed, false);
  g.state.buildings.coloso = 10;
  assert.equal(g.nextUpgrade('coloso').maxed, true);
  assert.equal(g.upgrade('coloso').ok, false, 'no se puede encargar el nivel 11');
});
