import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock } from '../src/config.js';
import { MACEDONIAN_RAID, macedonianArmy } from '../src/game/world.js';
import { makeWorld } from './world.js';

// Las ciudades macedonias (las de los jugadores que no vuelven) salen de vez en cuando a por un
// jugador cercano, con un ejército a la medida de la víctima.

async function withMacedonia() {
  const env = await makeWorld();
  const { world: W, players } = env;
  const [A, B, C] = players;
  const home = B.state.home;
  assert.ok(W.abandonCity(B.userId));
  return { env, W, A, C, home };
}

test('el ejército macedonio crece con el nivel de la víctima, con falange y hetairos', () => {
  const small = macedonianArmy(1);
  const big = macedonianArmy(8);
  const total = (a) => Object.values(a).reduce((x, y) => x + y, 0);
  assert.ok(total(big) > 10 * total(small) * 0.8, `${total(small)} → ${total(big)}`);
  assert.ok(big.falangita > 0 && big.hetairo > 0);
});

test('cuando le toca, una ciudad macedonia ataca a un jugador de cerca; si ganan, saquean', async () => {
  const { env, W, A, C, home } = await withMacedonia();
  const rt = W.islandState(home);
  const now = clock.now();
  W.macedonianRaids(now);
  assert.ok(rt.nextRaid > now, 'la primera vez solo se apunta cuándo saldrá');
  rt.nextRaid = now - 1;
  const hit = W.macedonianRaids(now);
  assert.equal(hit.length, 1);
  const target = [A, C].find((g) => g.userId === hit[0]);
  const m = target.state.macedon;
  assert.ok(m && m.army.galeon > 0, 'vienen en quinquerremes');
  assert.ok(m.arrival - now >= MACEDONIAN_RAID.warnMin * 60_000, 'se les ve venir');
  // Una ciudad sin defensas: saquean
  target.state.units = Object.fromEntries(Object.keys(target.state.units).map((id) => [id, 0]));
  target.state.buildings.muralla = 0;
  const before = target.state.resources.oro;
  env.until(m.arrival);
  assert.equal(target.state.macedon, null);
  const report = target.state.reports.find((r) => r.kind === 'defensa' && /macedonios/.test(r.title));
  assert.ok(report, 'llega el informe');
  assert.equal(report.outcome, 'derrota');
  assert.ok(target.state.resources.oro < before, 'se llevan parte de lo que no está a salvo');
});

test('una buena defensa los rechaza y deja un premio; de vacaciones o con otro ataque, no salen a por ti', async () => {
  const { env, W, A, C, home } = await withMacedonia();
  C.state.vacation = { since: clock.now(), until: clock.now() + 3_600_000 };
  const rt = W.islandState(home);
  rt.nextRaid = clock.now() - 1;
  const hit = W.macedonianRaids(clock.now());
  assert.deepEqual(hit, [A.userId], 'C está de vacaciones');
  Object.assign(A.state.units, { espartano: 3000, sagitario: 2000, galeon: 400 });
  env.until(A.state.macedon.arrival);
  const report = A.state.reports.find((r) => r.kind === 'defensa' && /macedonios/i.test(r.title));
  assert.equal(report.outcome, 'victoria');
  // (la paga de tanto espartano se come el oro: el premio, en el informe)
  assert.ok(report.reward?.oro > 0, 'premio por rechazarlos');
  // Con un ataque en camino no sale otro contra el mismo
  rt.nextRaid = clock.now() - 1;
  A.state.macedon = { spawn: 0, arrival: clock.now() + 3_600_000, army: {}, tier: 1, from: home, fromName: 'X' };
  assert.deepEqual(W.macedonianRaids(clock.now()), []);
});

test('van primero a por quien los ha atacado; arrasada, tarda 3 días en rearmarse y no sale', async () => {
  const { env, W, A, C, home } = await withMacedonia();
  const { MACEDONIAN_CITY } = await import('../src/game/world.js');
  assert.equal(MACEDONIAN_CITY.regenHours, 72);
  // C ataca la ciudad macedonia (y pierde)
  Object.assign(C.state.units, { lancero: 5, mercante: 1 });
  const { sendAndArrive } = await import('./world.js');
  sendAndArrive(env, C, 'atacar', home, { lancero: 5, mercante: 1 });
  assert.ok(W.islandState(home).grudge?.[C.userId], 'se acuerdan de C');
  // Las veces que salgan, van a por C (no a por A, aunque esté igual de cerca)
  const rt = W.islandState(home);
  rt.nextRaid = clock.now() - 1;
  assert.deepEqual(W.macedonianRaids(clock.now()), [C.userId]);
  // Ya se han vengado: la siguiente vez, al azar
  assert.equal(rt.grudge[C.userId], undefined);
  // Arrasada (en reconstrucción), no sale
  rt.stockAt = clock.now() + 72 * 3_600_000;
  rt.nextRaid = clock.now() - 1;
  C.state.macedon = null;
  assert.deepEqual(W.macedonianRaids(clock.now()), []);
});
