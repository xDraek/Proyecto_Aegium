import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOT_CHECK } from '../src/game/data.js';
import { makeWorld } from './world.js';

// Contra los bots: quien juega casi todas las horas del día, con un ritmo demasiado regular o con
// demasiadas acciones por minuto tiene que pasar de vez en cuando una comprobación sencilla.

const MIN = 60_000;

test('un jugador normal no da señales', async () => {
  const { world: W, players } = await makeWorld(['Lucio']);
  const id = players[0].userId;
  let t = 1_000_000_000;
  // Unas cuantas acciones con pausas irregulares, en un par de horas
  for (const gap of [3, 40, 7, 90, 12, 5, 200, 30, 8, 60]) {
    t += gap * 1000;
    assert.equal(W.botAction(id, t), false);
  }
  assert.equal(W.botSuspect(id, t), null);
});

test('jugar casi todas las horas del día pide la comprobación; al acertar, se puede seguir', async () => {
  const { world: W, players } = await makeWorld(['Lucio']);
  const id = players[0].userId;
  let t = 2_000_000_000;
  let asked = false;
  for (let h = 0; h < BOT_CHECK.hours + 1; h++) {
    t += 60 * MIN;
    asked = W.botAction(id, t + Math.random() * 1000);
  }
  assert.ok(asked, 'pide la comprobación');
  assert.match(W.botSuspect(id, t).join(), /de las últimas 24 h/);
  const c = W.botChallenge(id);
  assert.equal(c.options.length, 4);
  // Fallar no deja seguir
  const wrong = c.options.find((o) => !c.question.includes(o));
  assert.equal(W.botAnswer(id, c.id, wrong === undefined ? 'x' : 'nada', t), false);
  // Acertar, sí, unas horas
  const c2 = W.botChallenge(id);
  const right = W.bots.get(id).challenge.answer;
  assert.equal(W.botAnswer(id, c2.id, right, t), true);
  assert.equal(W.botAction(id, t + 1000), false);
});

test('un ritmo demasiado regular también cuenta, y los moderadores lo ven', async () => {
  const { world: W, players } = await makeWorld(['Lucio', 'Anibal']);
  const id = players[0].userId;
  let t = 3_000_000_000;
  for (let i = 0; i < BOT_CHECK.sample + 2; i++) {
    t += 5000; // una acción cada 5 s exactos
    W.botAction(id, t);
  }
  assert.match(W.botSuspect(id, t).join(), /ritmo muy regular/);
  // Los moderadores lo ven en las estadísticas
  W.admins.add('anibal');
  const bots = W.adminStats(players[1].userId).bots;
  assert.equal(bots.length, 1);
  assert.equal(bots[0].name, 'Lucio');
});
