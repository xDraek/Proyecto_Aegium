import { api } from '../net/api.js';
import { escapeHtml, fmtNum } from './format.js';

// Estadísticas del juego, solo para moderadores: altas, jugadores activos, retención por semana de
// alta, en qué misión se quedan los que se van y hasta cuándo se es Fundador.

const DAY_MS = 86_400_000;

const head = (icon, title, sub) => `
  <div class="panel-head"><span class="panel-icon">${icon}</span><div><h3>${title}</h3><div class="panel-lvl">${sub}</div></div>
  <button class="icon-btn" data-action="close-modal" title="Cerrar">✕</button></div>`;

/** «18 oct» (de un número de día desde 1970). */
const dayName = (day) => new Date(day * DAY_MS).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const pct = (x) => (x ? `${Math.round((x.k / x.of) * 100)} %` : '—');

/** Una fila de barras, una por día (las altas o los activos de los últimos 30 días). */
function bars(daily, key, unit) {
  const max = Math.max(1, ...daily.map((d) => d[key]));
  const cols = daily
    .map((d) => {
      const label = `${dayName(d.day)}: ${fmtNum(d[key])} ${unit}`;
      return `<div class="stats-bar" title="${label}" aria-label="${label}"><i style="height:${(d[key] / max) * 100}%"></i></div>`;
    })
    .join('');
  return `<div class="stats-bars">${cols}</div>
    <div class="stats-axis"><span>${dayName(daily[0].day)}</span><span>máx. ${fmtNum(max)}</span><span>hoy</span></div>`;
}

function render(s) {
  const tile = (n, label) => `<div class="stats-tile"><b>${fmtNum(n)}</b><span>${label}</span></div>`;
  const cohorts = s.cohorts
    .filter((c) => c.n > 0)
    .map(
      (c) => `<tr><td>${dayName(c.from)} – ${dayName(c.to)}</td><td>${fmtNum(c.n)}</td>
        <td title="${c.back[1] ? `${c.back[1].k} de ${c.back[1].of}` : 'Aún no ha pasado un día'}">${pct(c.back[1])}</td>
        <td title="${c.back[7] ? `${c.back[7].k} de ${c.back[7].of}` : 'Aún no ha pasado una semana'}">${pct(c.back[7])}</td>
        <td title="${c.back[30] ? `${c.back[30].k} de ${c.back[30].of}` : 'Aún no ha pasado un mes'}">${pct(c.back[30])}</td></tr>`,
    )
    .join('');
  const drop = s.dropoff
    .slice(0, 8)
    .map((d) => `<tr><td>${escapeHtml(d.title)}</td><td>${fmtNum(d.n)}</td><td>${Math.round((d.n / s.gone) * 100)} %</td></tr>`)
    .join('');
  const until = new Date(s.founders.until).toISOString().slice(0, 10);
  return `<div class="modal-card wide game-stats">
    ${head('📊', 'Estadísticas', `${fmtNum(s.accounts)} cuentas · ${fmtNum(s.online)} conectados ahora`)}
    <div class="stats-tiles">
      ${tile(s.active.day, 'activos hoy (24 h)')}
      ${tile(s.active.week, 'activos esta semana')}
      ${tile(s.active.month, 'activos este mes')}
      ${tile(s.vacation, 'de vacaciones')}
    </div>
    <h4>Altas de cada día</h4>
    ${bars(s.daily, 'signups', 'altas')}
    <h4>Jugadores que entraron cada día</h4>
    ${bars(s.daily, 'active', 'jugadores')}
    <p class="muted small">Se apunta desde el 19 de octubre de 2026: los días de antes salen vacíos.</p>
    <h4>Retención por semana de alta</h4>
    ${cohorts
      ? `<table class="stats-table"><thead><tr><th>Se registraron</th><th>Altas</th><th>Siguen tras 1 día</th><th>Tras 7 días</th><th>Tras 30 días</th></tr></thead><tbody>${cohorts}</tbody></table>`
      : '<p class="muted small">Nadie se ha registrado en las últimas 8 semanas.</p>'}
    <p class="muted small">De los que se registraron hace al menos ese tiempo, cuántos volvieron a entrar después. Orientación: un juego que engancha ronda el 35–40 % tras 1 día, el 15–20 % tras 7 y el 5–10 % tras 30. Con pocos jugadores, las cifras bailan mucho.</p>
    <h4>Dónde se quedan los que se van</h4>
    ${drop
      ? `<p class="muted small">${fmtNum(s.gone)} jugadores no entran desde hace más de 3 días. La misión que tenían pendiente:</p>
        <table class="stats-table"><thead><tr><th>Misión</th><th>Jugadores</th><th>Parte</th></tr></thead><tbody>${drop}</tbody></table>`
      : '<p class="muted small">Nadie ha dejado de entrar todavía.</p>'}
    <h4>🌅 Fundadores</h4>
    <p class="small">${fmtNum(s.founders.count)} fundadores. Quien se registre hasta el día indicado (incluido) recibe el título de Fundador; los que ya lo tienen no lo pierden.</p>
    <form class="inline-form stats-founder"><label>Fundadores hasta <input type="date" name="until" value="${until}" required /></label><button class="primary small">Guardar</button></form>
  </div>`;
}

export async function openStats(hud) {
  hud.showModal('stats', '<div class="modal-card wide"><p class="muted">Calculando las estadísticas…</p></div>');
  let stats;
  try {
    stats = await api('GET', '/api/admin/stats');
  } catch (err) {
    if (hud.modalKind === 'stats') hud.showModal('stats', `<div class="modal-card wide"><p class="muted">${escapeHtml(err.message)}</p></div>`);
    return;
  }
  show(hud, stats);
}

function show(hud, stats) {
  if (hud.modalKind !== 'stats') return;
  hud.showModal('stats', render(stats));
  hud.modal.querySelector('.stats-founder')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const value = new FormData(e.target).get('until');
    // Hasta el final de ese día (hora de España, más o menos)
    const until = Date.parse(`${value}T23:59:59`);
    try {
      const next = await api('POST', '/api/admin/founder', { until });
      hud.toast('🌅 Fecha de los fundadores guardada', 'success');
      show(hud, next);
    } catch (err) {
      hud.toast(err.message, 'error');
    }
  });
}
