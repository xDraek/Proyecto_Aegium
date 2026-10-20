import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorld } from './world.js';

// Fundadores y estadísticas para moderadores.

const DAY = 86_400_000;

test('quien se registra en el primer mes es Fundador y puede llevarlo de título', async () => {
  const { world, players } = await makeWorld(['Lucio', 'Anibal']);
  const [A] = players;
  assert.ok(world.meta.founderUntil > Date.now() + 29 * DAY, 'un mes desde que arranca');
  assert.equal(A.state.founder, true);
  assert.ok(A.achievements().includes('fundador'));
  assert.ok(A.state.notes.some((n) => n.text.includes('Eres Fundador')));
  assert.equal(A.setTitle('fundador').ok, true);
  // Pasada la fecha, los nuevos ya no lo son (y los de antes lo siguen siendo)
  world.admins.add('lucio');
  world.setFounderUntil(A.userId, Date.now() - 1000);
  const id = await world.register('Tardio', 'secreto1', 'Tardiopolis', { email: 'tardio@prueba.es' });
  assert.ok(!world.games.get(id).state.founder);
  assert.equal(A.state.founder, true);
  // Si se alarga, lo reciben también
  world.setFounderUntil(A.userId, Date.now() + DAY);
  assert.equal(world.games.get(id).state.founder, true);
  // Solo los moderadores lo cambian
  assert.throws(() => world.setFounderUntil(players[1].userId, Date.now()), /moderadores/);
});

test('estadísticas: activos, altas por día, retención por semana y dónde se quedan', async () => {
  const { world, players } = await makeWorld(['Lucio', 'Anibal', 'Pericles']);
  const [A, B, C] = players;
  world.admins.add('lucio');
  assert.throws(() => world.adminStats(B.userId), /moderadores/);
  // Anibal se registró hace 10 días y volvió el 8; Pericles, hace 10 días y no volvió
  const now = Date.now();
  world.users.get(B.userId).created = now - 10 * DAY;
  B.state.lastSeen = now - 2 * DAY;
  world.users.get(B.userId).lastSeen = 0;
  world.users.get(C.userId).created = now - 10 * DAY;
  C.state.lastSeen = now - 10 * DAY;
  world.users.get(C.userId).lastSeen = 0;
  world.seen(A.userId);
  const s = world.adminStats(A.userId);
  assert.equal(s.accounts, 3);
  assert.equal(s.active.day, 1);
  assert.equal(s.active.week, 2);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily.at(-1).active, 1, 'Lucio ha entrado hoy');
  assert.equal(s.daily.at(-1).signups, 1);
  // La semana en que se registraron Anibal y Pericles: uno de dos sigue tras 1 y 7 días
  const week = s.cohorts.find((c) => c.n === 2);
  assert.deepEqual(week.back[1], { k: 1, of: 2 });
  assert.deepEqual(week.back[7], { k: 1, of: 2 });
  assert.equal(week.back[30], null, 'aún no ha pasado un mes');
  // Pericles lleva días sin entrar: se quedó en la primera misión
  assert.equal(s.gone, 1);
  assert.equal(s.dropoff[0].n, 1);
  assert.ok(s.dropoff[0].title);
});

test('«Azote de reyes» y «Azote de Tifón» son logros distintos', async () => {
  const { ACHIEVEMENTS } = await import('../src/game/data.js');
  const { upgradeState } = await import('../src/game/Game.js');
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'sin ids repetidos');
  const { players } = await makeWorld(['Lucio']);
  const [g] = players;
  g.state.stats.featTop = 1;
  assert.ok(g.achievements().includes('azotegesta'));
  assert.ok(!g.achievements().includes('azote'), 'el de reyes no se gana con una gesta');
  // Quien llevaba «azote» de título por la gesta pasa a llevar el de la gesta
  const old = { ...g.state, title: 'azote', stats: { ...g.state.stats, pvpWins: 0, featTop: 1 } };
  assert.equal(upgradeState(old).title, 'azotegesta');
  assert.equal(upgradeState({ ...old, stats: { ...old.stats, pvpWins: 6 } }).title, 'azote');
});

test('en mantenimiento solo entran los moderadores y la portada lo avisa', async () => {
  const { world, players } = await makeWorld(['Lucio', 'Anibal']);
  const [A, B] = players;
  world.admins.add('lucio');
  assert.equal(world.stats().maintenance, null);
  assert.throws(() => world.setMaintenance(B.userId, true), /moderadores/);
  const closed = [];
  world.addSocket(B.userId, { readyState: 1, send() {}, close: (code) => closed.push(code) });
  world.setMaintenance(A.userId, true);
  assert.match(world.stats().maintenance, /mantenimiento/);
  assert.equal(world.closedFor(B.userId), true);
  assert.equal(world.closedFor(A.userId), false, 'el moderador sigue entrando');
  assert.deepEqual(closed, [4004], 'echa a quien estaba conectado');
  world.setMaintenance(A.userId, true, 'Volvemos el lunes');
  assert.equal(world.stats().maintenance, 'Volvemos el lunes');
  world.setMaintenance(A.userId, false);
  assert.equal(world.closedFor(B.userId), false);
});
