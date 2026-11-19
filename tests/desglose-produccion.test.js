import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESOURCE_KEYS } from '../src/game/data.js';
import { newState } from '../src/game/Game.js';
import { economy, productionBreakdown } from '../src/game/rules.js';

// El menú de cada recurso de la barra de arriba: el desglose suma lo mismo que la producción.

function city() {
  const now = Date.now();
  const s = newState({ now, home: 'x', name: 'Lucio' });
  Object.assign(s.buildings, { aserradero: 6, cantera: 4, granja: 5, mina: 3, fundicion: 2, mercado: 3, coloso: 2 });
  Object.assign(s.research, { silvicultura: 3, comercio: 2 });
  s.colonies = [
    { id: 'c1', name: 'Isla verde', specialty: 'madera', yield: 40, level: 2 },
    { id: 'c2', name: 'Peñasco', specialty: 'madera', yield: 30, level: 1, raidedUntil: now + 3_600_000 },
  ];
  s.relics = [{ id: 'cuerno', equipped: true }, { id: 'hoz', equipped: true }];
  s.work = { aserradero: 80 };
  s.units.hoplita = 40;
  return { s, now };
}

test('el desglose de cada recurso suma lo que produce la ciudad', () => {
  const { s, now } = city();
  const eco = economy(s, now);
  for (const res of RESOURCE_KEYS) {
    const b = productionBreakdown(s, res, now);
    const added = b.add.reduce((a, r) => a + r.value, 0);
    assert.ok(Math.abs(added - b.subtotal) < 1e-6);
    assert.ok(Math.abs(b.subtotal + b.bonus - eco.gross[res]) < 1e-6, res);
    const spent = b.sub.reduce((a, r) => a + r.value, 0);
    assert.ok(Math.abs(b.gross - spent - b.net) < 1e-6, `${res}: neto = bruto − gastos`);
    assert.ok(Math.abs(b.net - eco.net[res]) < 1e-6, res);
  }
});

test('salen la tecnología con su nivel, cada colonia (también la saqueada) y lo que multiplica', () => {
  const { s, now } = city();
  const madera = productionBreakdown(s, 'madera', now);
  assert.ok(madera.add.some((r) => /Silvicultura · nivel 3/.test(r.label) && r.value > 0));
  assert.ok(madera.add.some((r) => /Aserradero · nivel 6/.test(r.label) && /80 %/.test(r.note)));
  const green = madera.add.find((r) => /Isla verde/.test(r.label));
  assert.ok(green.value > 0);
  const raided = madera.add.find((r) => /Peñasco/.test(r.label));
  assert.equal(raided.value, 0);
  assert.match(raided.note, /saqueada/);
  assert.ok(madera.mult.some((m) => /Coloso/.test(m.label) && Math.abs(m.pct - 0.1) < 1e-9));
  assert.ok(madera.mult.some((m) => /Hoz de Cronos/.test(m.label)));
  // El cuerno solo da comida; la comida de las tropas va en gastos
  assert.ok(!madera.mult.some((m) => /Cuerno/.test(m.label)));
  const comida = productionBreakdown(s, 'comida', now);
  assert.ok(comida.mult.some((m) => /Cuerno/.test(m.label)));
  assert.ok(comida.sub.some((x) => /tropas/.test(x.label) && x.value > 0));
});
