import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PINNED_REPORTS } from '../src/game/Game.js';
import { makeWorld } from './world.js';

// Anclar y borrar informes.

const fill = (P, n) => {
  P.state.reports = Array.from({ length: n }, (_, i) => ({ id: 1000 + n - i, t: n - i, title: `Informe ${n - i}`, read: true }));
};

test('anclar y borrar un informe', async () => {
  const { players: [A] } = await makeWorld();
  fill(A, 5);
  const id = A.state.reports[2].id;
  assert.equal(A.pinReport(id, true).ok, true);
  assert.equal(A.state.reports.find((r) => r.id === id).pinned, true);
  assert.equal(A.deleteReport(A.state.reports[0].id).ok, true);
  assert.equal(A.state.reports.length, 4);
  assert.equal(A.deleteReport(99999).ok, false);
  // Borrar todos deja solo los anclados
  assert.equal(A.deleteReport('all').ok, true);
  assert.deepEqual(A.state.reports.map((r) => r.id), [id]);
  assert.equal(A.pinReport(id, false).ok, true);
  assert.equal(A.state.reports[0].pinned, undefined);
});

test('los anclados no se borran solos y tienen un tope', async () => {
  const { players: [A] } = await makeWorld();
  fill(A, 40);
  const oldest = A.state.reports.at(-1).id;
  assert.equal(A.pinReport(oldest, true).ok, true);
  // Llegan informes nuevos: el anclado más viejo sigue ahí; se van los más viejos sin anclar
  for (let i = 0; i < 3; i++) A.state.reports.unshift({ id: 5000 + i, t: 100 + i, title: 'x', read: false });
  A.pinReport(A.state.reports[0].id, true);
  A.pinReport(A.state.reports[0].id, false); // al desanclar se recorta la lista
  assert.ok(A.state.reports.some((r) => r.id === oldest));
  assert.equal(A.state.reports.filter((r) => !r.pinned).length, 40);
  // Tope de anclados
  for (const r of A.state.reports.filter((x) => !x.pinned).slice(0, MAX_PINNED_REPORTS - 1)) assert.equal(A.pinReport(r.id, true).ok, true);
  const extra = A.state.reports.find((r) => !r.pinned);
  assert.match(A.pinReport(extra.id, true).reason, /Solo puedes anclar/);
});
