import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSECRATION, GODS, godBless } from '../src/game/data.js';
import { playerCombat, powerScale, productionBonus } from '../src/game/rules.js';
import { makeWorld } from './world.js';

// Con el templo a nivel 10 se consagra a un dios: su poder, bendecido para siempre; los demás, algo
// más flojos. Tarda como subir el templo un nivel más y cuesta mucho oro, cristal y bronce.

test('cada dios bendice su poder y los demás quedan algo más flojos', () => {
  assert.equal(powerScale({}, 'cosecha'), 1, 'sin consagrar, como siempre');
  for (const [god, g] of Object.entries(GODS)) {
    assert.equal(powerScale({ god }, g.power), godBless(god));
    assert.ok(godBless(god) > 1);
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
  // Es una obra: ocupa a los constructores y el templo sale en obras
  assert.equal(g.state.queue?.id, 'templo');
  assert.equal(g.state.queue.god, 'poseidon');
  assert.equal(g.upgrade('granja').ok, false, 'mientras se consagra no se construye nada más');
  env.until(g.state.queue.end);
  assert.equal(g.state.god, 'poseidon');
  assert.equal(g.state.queue, null);
  assert.equal(g.level('templo'), 10, 'consagrar no sube el nivel');
  // El Viento favorable, más largo con Poseidón
  g.state.favor = 250;
  const t0 = g.now();
  assert.equal(g.castPower('viento').ok, true);
  const hours = (g.state.buffs.viento - t0) / 3_600_000;
  assert.ok(Math.abs(hours - 1.5 * godBless('poseidon')) < 0.01, `${hours} h`);
  // Se puede cambiar de dios, volviendo a pagar
  assert.equal(g.consecrate('poseidon').ok, false, 'ya es suyo');
  assert.equal(g.consecrate('atenea').ok, true);
});

test('con otra obra en marcha no se consagra, y cancelar la consagración devuelve lo pagado', async () => {
  const env = await makeWorld(['Lucio']);
  const [g] = env.players;
  g.state.buildings.templo = 10;
  Object.assign(g.state.resources, { madera: 1e6, piedra: 1e6, oro: 1e6, cristal: 1e6, hierro: 1e6, comida: 1e6 });
  g.state.queue = { id: 'granja', level: 2, start: g.now(), end: g.now() + 60_000, cost: {} };
  assert.equal(g.consecrate('zeus').ok, false, 'los constructores están ocupados');
  g.state.queue = null;
  const oro = g.state.resources.oro;
  const spent = g.state.stats.spent;
  assert.equal(g.consecrate('zeus').ok, true);
  assert.ok(g.state.resources.oro < oro);
  assert.equal(g.cancel().ok, true);
  assert.equal(g.state.queue, null);
  assert.equal(g.state.god, null, 'sin consagrar');
  assert.ok(g.state.resources.oro > oro - CONSECRATION.cost.oro, 'devuelve parte de lo pagado');
  assert.equal(g.state.stats.spent, spent, 'sin tocar los puntos');
});

test('cambiar de dios cuesta el doble, y la consagración tarda cuatro veces un nivel de templo', async () => {
  const { consecrationCost, consecrationSeconds, buildSeconds } = await import('../src/game/rules.js');
  const s = { buildings: { templo: 10, ayuntamiento: 10 }, research: {} };
  assert.deepEqual(consecrationCost(s), CONSECRATION.cost);
  assert.equal(consecrationCost({ ...s, god: 'zeus' }).oro, CONSECRATION.cost.oro * CONSECRATION.change);
  assert.equal(consecrationSeconds(s), Math.round(buildSeconds(s, 'templo', 11) * CONSECRATION.time));
});
