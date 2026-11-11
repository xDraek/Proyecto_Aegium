import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSECRATION, GODS } from '../src/game/data.js';
import { playerCombat, powerScale, productionBonus } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Con el templo a nivel 10 se consagra a un dios: su poder, bendecido para siempre; los demás, algo
// más flojos. Tarda como subir el templo un nivel más y cuesta mucho oro, cristal y bronce.

test('cada dios bendice su poder y los demás quedan algo más flojos', () => {
  assert.equal(powerScale({}, 'cosecha'), 1, 'sin consagrar, como siempre');
  for (const [god, g] of Object.entries(GODS)) {
    assert.equal(powerScale({ god }, g.power), CONSECRATION.bless);
    for (const other of Object.values(GODS)) if (other !== g) assert.equal(powerScale({ god }, other.power), CONSECRATION.curse);
  }
  // Deméter: la Cosecha da más; Zeus: la Furia, más ataque
  const t = 1000;
  const harvest = (god) => productionBonus({ god, buildings: {}, research: {}, buffs: { cosecha: t + 1 } }, t);
  assert.ok(harvest('demeter') > harvest(null) && harvest(null) > harvest('zeus'));
  const fury = (god) => playerCombat({ god, buildings: {}, research: {}, buffs: { rayo: t + 1 } }, { t }).atkMul;
  assert.ok(fury('zeus') > fury(null) && fury(null) > fury('demeter'));
});

test('se consagra con el templo 10, pagando; tarda y al acabar queda su dios', async () => {
  const env = await makeWorld(['Lucio']);
  const [g] = env.players;
  g.state.buildings.templo = 9;
  assert.equal(g.consecrate('poseidon').ok, false, 'hace falta el templo 10');
  g.state.buildings.templo = 10;
  assert.equal(g.consecrate('hermes').ok, false, 'ese dios no está');
  Object.assign(g.state.resources, { oro: 1e6, cristal: 1e6, hierro: 1e6 });
  const oro = g.state.resources.oro;
  assert.equal(g.consecrate('poseidon').ok, true);
  assert.ok(g.state.resources.oro <= oro - CONSECRATION.cost.oro);
  assert.equal(g.consecrate('zeus').ok, false, 'una consagración cada vez');
  env.until(g.state.consecration.end);
  assert.equal(g.state.god, 'poseidon');
  assert.equal(g.state.consecration, null);
  // El Viento favorable, más largo con Poseidón
  g.state.favor = 250;
  const t0 = g.now();
  assert.equal(g.castPower('viento').ok, true);
  const hours = (g.state.buffs.viento - t0) / 3_600_000;
  assert.ok(Math.abs(hours - 1.5 * CONSECRATION.bless) < 0.01, `${hours} h`);
  // Se puede cambiar de dios, volviendo a pagar
  assert.equal(g.consecrate('poseidon').ok, false, 'ya es suyo');
  assert.equal(g.consecrate('atenea').ok, true);
});

test('cambiar de dios cuesta el doble, y la consagración tarda cuatro veces un nivel de templo', async () => {
  const { consecrationCost, consecrationSeconds, buildSeconds } = await import('../src/game/rules.js');
  const s = { buildings: { templo: 10, ayuntamiento: 10 }, research: {} };
  assert.deepEqual(consecrationCost(s), CONSECRATION.cost);
  assert.equal(consecrationCost({ ...s, god: 'zeus' }).oro, CONSECRATION.cost.oro * CONSECRATION.change);
  assert.equal(consecrationSeconds(s), Math.round(buildSeconds(s, 'templo', 11) * CONSECRATION.time));
});
