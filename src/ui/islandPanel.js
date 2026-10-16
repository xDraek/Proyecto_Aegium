import * as THREE from 'three';
import { BLOCKADE, COLONY, FEATS, FEAT_THEMES, ISLAND_TYPES, MISSION_TYPES, OCCUPATION, OUTPOST_MISSIONS, PLAYER_UNITS, PROTECTION, RESOURCES, RESOURCE_KEYS, SPY_TIERS, UNITS, WONDERS, WONDER_LEVELS, WONDER_RESOURCES } from '../game/data.js';
import { colonyUpgrade, colonyYield, navalDefense, playerCombat, spyRisk, wallBonus } from '../game/rules.js';
import { featCoop, forceOf, forgeBonus } from '../game/feats.js';
import { NEWBIE_POINTS, neutralsOf } from '../game/Game.js';
import { createIslandBase, createIslandFeature, islandLook } from '../scene/islands.js';
import { portrait, unitIcon } from '../scene/portraits.js';
import { bag, costList, escapeHtml, fmtAgo, fmtNum, fmtTime, intelRows, unitList } from './format.js';

// Panel de una isla del archipiélago: lo que se sabe de ella y el formulario
// para mandar una flota (explorar, atacar o colonizar).

function playerSection(game, view) {
  const ally = view.alliance && game.alliance && view.alliance.id === game.alliance.id;
  const lines = [
    `<div class="info-row"><span>⚜ Gobernante</span><b>${escapeHtml(view.ownerName)}</b></div>`,
    `<div class="info-row"><span>🤝 Alianza</span><b>${view.alliance ? `${escapeHtml(view.alliance.name)} [${escapeHtml(view.alliance.tag)}]${ally ? ' · aliado' : view.relation === 'pacto' ? ' · 🕊️ pacto' : view.relation === 'guerra' ? ' · ⚔️ en guerra' : ''}` : 'Ninguna'}</b></div>`,
    `<div class="info-row"><span>🏆 Puntos</span><b>${fmtNum(view.score)}</b></div>`,
    `<div class="info-row"><span>🏛️ Ayuntamiento</span><b>Nivel ${view.townLevel}</b></div>`,
  ];
  if (view.vacation) lines.push('<p class="hint ok">🏖️ Está de vacaciones: su isla no se puede atacar ni espiar.</p>');
  else if (view.inactive) lines.push('<p class="hint">💤 Lleva más de una semana sin aparecer por su ciudad.</p>');
  if (view.protected) lines.push(`<p class="hint ok">🛡️ Protección de novato: con menos de ${fmtNum(NEWBIE_POINTS)} puntos y en sus primeros días nadie puede atacar esta ciudad.</p>`);
  else if (!ally && game.tooWeak(view)) lines.push('<p class="hint ok">🛡️ Tiene menos del 20 % de tus puntos: no le puedes atacar, ni siquiera en guerra (salvo si te ataca él).</p>');
  if (view.shield) lines.push(`<p class="hint ok">🛡️ Acaba de librarse de un bloqueo o una ocupación: nadie la puede bloquear ni invadir en <span data-until="${view.shield}"></span>.</p>`);
  // Límite de ataques al mismo jugador (no cuenta entre alianzas en guerra)
  if (!ally && view.relation !== 'pacto') {
    const hits = game.attacksOn(view.owner);
    if (view.relation === 'guerra') lines.push('<p class="muted small">⚔️ En guerra no hay límite de ataques al día.</p>');
    else if (hits) lines.push(`<p class="${hits >= PROTECTION.attacksPerDay ? 'hint warn' : 'muted small'}">⚔️ Le has atacado ${hits} de ${PROTECTION.attacksPerDay} veces permitidas en 24 h.</p>`);
  }
  const port = view.port;
  if (port && port.by !== game.userId) {
    lines.push(
      port.kind === 'invadir'
        ? `<p class="hint warn">🦅 Ocupada por ${escapeHtml(port.name)} · se irán como mucho en <span data-until="${port.until}"></span>. Nadie más la puede atacar mientras tanto.</p>`
        : `<p class="hint warn">⛓️ ${escapeHtml(port.name)} bloquea su puerto · como mucho <span data-until="${port.until}"></span> más.</p>`,
    );
  }
  const intel = view.intel;
  const spy = intel
    ? `<h4>Informe de tus espías <span class="muted small">(${fmtAgo(intel.t)}${intel.level ? `, ${intel.level} ${intel.level === 1 ? 'bote' : 'botes'}` : ''})</span></h4>${intelRows(intel)}`
    : ally
      ? ''
      : '<p class="desc small">No sabes qué defiende la ciudad: puedes atacarla a ciegas o mandar antes botes exploradores a espiarla.</p>';
  const intro = view.port?.by === game.userId
    ? view.port.kind === 'invadir'
      ? 'Una ciudad que ocupan tus tropas.'
      : 'Una ciudad cuyo puerto bloquean tus barcos.'
    : ally
    ? 'Una ciudad aliada: no podéis atacaros, pero puedes mandarle recursos.'
    : view.relation === 'pacto'
      ? 'Vuestras alianzas tienen un pacto de no agresión: no podéis atacaros mientras dure.'
      : view.relation === 'guerra'
        ? '⚔️ Vuestras alianzas están en guerra. Si la saqueas, tus barcos cargan un 20 % más de botín.'
        : 'La ciudad de otro jugador. Si la atacas y ganas, te llevas lo que quepa en tus barcos (salvo lo que esconde su almacén).';
  return `<p class="desc">${intro}</p>
    ${lines.join('')}${stationSection(game, view)}${spy}
    <div class="modal-actions">
      <button class="ghost small" data-action="profile" data-name="${escapeHtml(view.ownerName)}">👤 Perfil</button>
      <button class="ghost small" data-action="mail-to" data-name="${escapeHtml(view.ownerName)}">✉️ Mensaje</button>
    </div>`;
}

/** Tu bloqueo de esta ciudad o tu ocupación: tropas, tributo, saqueo y retirada. */
function stationSection(game, view) {
  const m = game.missions.find((x) => x.target === view.id && x.phase === 'estacionada' && (x.type === 'invadir' || x.type === 'bloquear'));
  if (!m) return '';
  if (m.type === 'bloquear') {
    return `<div class="port-box">
      <h4>⛓️ Bloqueas su puerto</h4>
      <p class="desc small">No zarpa nadie, no entran transportes ni mercaderes y sus colonias no le mandan nada. Puede intentar romperlo con sus barcos, o sus aliados con tropas de apoyo.</p>
      <div class="info-row"><span>Tu flota</span><span>${unitList(m.units)}</span></div>
      <div class="info-row"><span>Aguanta como mucho</span><b class="q-time" data-until="${m.until}"></b></div>
      <button class="ghost wide" data-action="recall" data-mission="${m.id}">⚓ Levantar el bloqueo</button>
    </div>`;
  }
  const owed = game.owed?.[m.id] ?? {};
  const ready = (m.plunderAt ?? 0) <= game.now();
  return `<div class="port-box occupied">
    <h4>🦅 Ocupas esta ciudad</h4>
    <p class="desc small">Te quedas el ${Math.round(OCCUPATION.tribute * 100)} % de lo que produce y controlas su puerto. Cada ${OCCUPATION.plunderHours} h puedes saquear su almacén: barcos requisados llevan a tu capital el tributo y lo saqueado. Para atacar desde aquí, elige «Zarpar desde ${escapeHtml(view.name)}» al mandar una flota a otra isla.</p>
    <div class="info-row"><span>Tropas ocupando</span><span>${unitList(m.units)}</span></div>
    <div class="info-row"><span>Tributo apartado</span><span>${bag(owed) || '<span class="muted">Nada todavía</span>'}</span></div>
    ${Object.keys(m.cargo ?? {}).length ? `<div class="info-row"><span>Botín guardado</span><span>${bag(m.cargo)}</span></div>` : ''}
    <div class="info-row"><span>Se acaba en</span><b class="q-time" data-until="${m.until}"></b></div>
    <button class="primary wide" data-action="plunder" data-mission="${m.id}" data-ready-at="${m.plunderAt ?? 0}" ${ready ? '' : 'disabled'}>💰 Saquear y mandarlo a casa</button>
    ${ready ? '' : `<p class="muted small">Podrás volver a saquear en <span data-until="${m.plunderAt}"></span>.</p>`}
    <button class="ghost wide" data-action="recall" data-mission="${m.id}">⚓ Retirar las tropas (se llevan el tributo)</button>
  </div>`;
}

function colonySection(game, view) {
  const col = view.colony ?? {};
  const r = RESOURCES[col.specialty ?? view.specialty];
  const level = col.level ?? 1;
  const yieldAt = (n) => colonyYield({ yield: col.yield ?? view.yield, level: n });
  let upgrade;
  if (col.upgradeEnd) {
    upgrade = `<p class="hint">🔨 Los colonos amplían la colonia al nivel ${level + 1}: terminan en <span data-until="${col.upgradeEnd}"></span>.</p>`;
  } else if (level >= COLONY.maxLevel) {
    upgrade = '<p class="hint ok">🚩 La colonia ya no puede crecer más.</p>';
  } else {
    const { cost, seconds } = colonyUpgrade(level);
    const busy = game.colonies().some((c) => c.upgradeEnd);
    upgrade = `<h4>Ampliar a nivel ${level + 1}</h4>
      <div class="effect"><span>${r.icon} Producción</span><b class="up">+${fmtNum(yieldAt(level))} → +${fmtNum(yieldAt(level + 1))}/h</b></div>
      ${costList(cost, game.resources)}
      <button class="primary" data-action="colony-upgrade" data-need='${JSON.stringify(cost)}' data-blocked="${busy ? 1 : 0}">🔨 Ampliar · ${fmtTime(seconds)}</button>
      ${busy ? '<p class="muted small">Ya estás ampliando otra colonia: solo hay colonos para una obra a la vez.</p>' : ''}`;
  }
  const raided = col.raidedUntil > game.now() ? `<p class="hint">🔥 Saqueada por la horda: vuelve a producir en <span data-until="${col.raidedUntil}"></span>.</p>` : '';
  return `${raided}<p class="desc">${col.conquered ? 'La ciudad que conquistaste a los bárbaros: tus colonos la gobiernan y mandan su producción a la capital.' : 'Tus colonos trabajan la isla y mandan sus cosechas a la capital.'}</p>
    <div class="info-row"><span>🚩 Nivel</span><b>${level} / ${COLONY.maxLevel}</b></div>
    <div class="effect"><span>${r.icon} Producción de la colonia</span><b class="up">+${fmtNum(yieldAt(level))}/h</b></div>
    ${upgrade}
    <button class="ghost small colony-abandon" data-action="colony-abandon">🏳️ Abandonar la colonia</button>`;
}

/** Un continente: lo que hay en él, para ir a cada sitio. */
function continentSection(game, view) {
  const sites = game.world
    .islands()
    .filter((i) => i.land === view.id)
    .map((i) => game.island(i.id));
  const rows = sites
    .map((s) => {
      const t = ISLAND_TYPES[s.type];
      const what = !s.explored ? '❔ Sin explorar' : s.colonized ? '🚩 Tu colonia' : s.colonizedBy != null ? `🚩 Colonia de ${escapeHtml(s.colonistName)}` : `${t.icon} ${s.typeName}${s.tier ? ` · Nv ${s.tier}` : ''}`;
      return `<li data-select="${escapeHtml(s.id)}"><span><b>${escapeHtml(s.name)}</b><div class="muted small">${what}</div></span><span class="muted small">›</span></li>`;
    })
    .join('');
  return `${featSection(game, view)}${hordeSection(view)}<p class="desc">Un pequeño continente entre los sectores del archipiélago. Tierra adentro hay ciudades bárbaras bien defendidas y valles fértiles donde fundar colonias.</p>
    <ul class="mini-list site-list">${rows}</ul>
    ${wonderSection(game, view)}`;
}

/** Si la gesta del continente está en marcha (presagios o lucha). */
export const featActive = (feat) => !!feat && (feat.stage === 'presagio' || feat.stage === 'lucha');

/** Una gesta de la Liga en el continente: etapa, fases del enemigo, coraza, juramento y gloria. */
function featSection(game, view) {
  const f = view.feat;
  if (!f) return '';
  const pct = (n) => `${Math.round(n * 100)} %`;
  const head = `<h4>${f.icon} ${escapeHtml(f.themeName)}</h4>`;
  const more = '<p class="small"><button class="link" data-action="guide" data-topic="gestas">📖 Cómo funcionan las gestas</button></p>';
  if (f.stage === 'fin') {
    const text = {
      victoria: `¡${f.Enemy} ha caído! Los premios ya están repartidos (míralos en tus informes 📜).`,
      media: `${f.Enemy} huyó malherido: victoria a medias, con la mitad de los premios.`,
      derrota: `${f.Enemy} resistió. Los que combatieron recuperan parte de sus caídos y el continente se vuelve un poco más fácil para la próxima vez.`,
      dormido: `No se juntaron bastantes imperios y ${f.enemy} volvió a dormirse. Nadie perdió nada.`,
    }[f.result];
    const truce = f.truceUntil && f.pledged ? `<div class="info-row"><span>🕊️ Tregua sagrada</span><b class="q-time" data-until="${f.truceUntil}"></b></div>` : '';
    return `<div class="feat-box done">${head}<p class="desc small">${text ?? ''}</p>${truce}${more}</div>`;
  }
  const myFleet = game.state.missions.find((m) => m.target === view.id && m.phase !== 'vuelta');
  const rows = [];
  if (f.stage === 'presagio') rows.push(`<div class="info-row"><span>Emerge en</span><b class="q-time" data-until="${f.start}"></b></div>`);
  else {
    rows.push(`<div class="info-row"><span>Próxima oleada</span><b class="q-time" data-until="${f.nextWave}"></b></div>`);
    rows.push(`<div class="info-row"><span>Termina en</span><b class="q-time" data-until="${f.end}"></b></div>`);
  }
  rows.push(`<div class="info-row"><span>Juramentos</span><b>${f.pledgedCount} de ${f.convokedCount} convocados</b></div>`);
  if (f.tier) rows.push(`<div class="info-row"><span>Nivel del sitio</span><b class="${f.tier > 0 ? 'down' : 'up'}">${f.tier > 0 ? '+' : ''}${f.tier} · enemigo ${f.tier > 0 ? 'más duro' : 'más blando'}, premios ${f.tier > 0 ? 'mayores' : 'menores'}</b></div>`);

  // Las fases del enemigo (cuando ya ha emergido)
  let phases = '';
  if (f.boss && f.kind === 'armada') phases = armadaPhases(game, view, f);
  else if (f.boss && f.kind === 'hidra') phases = hydraPhases(f);
  else if (f.boss) {
    phases = f.phases
      .map((p, i) => {
        const full = f.boss.full?.[p.unit] ?? 0;
        const left = i < f.boss.phase ? 0 : (f.boss[p.unit] ?? full);
        const state = i < f.boss.phase ? 'done' : i === f.boss.phase ? 'now' : 'next';
        const w = full ? Math.round((left / full) * 100) : 0;
        return `<li class="feat-phase ${state}"><div class="info-row"><span>${i + 1}. ${escapeHtml(p.name)}</span><b>${i < f.boss.phase ? '✓' : `${fmtNum(left)} / ${fmtNum(full)}`}</b></div><div class="progress horde-bar"><i style="width:${w}%"></i></div></li>`;
      })
      .join('');
    phases = `<ol class="feat-phases">${phases}</ol>`;
  }
  // La coraza: cuántos imperios esperan ya la próxima oleada
  let armor = '';
  const wt = f.waiting;
  if (f.stage === 'lucha' && wt) {
    armor = wt.fleets
      ? `<p class="hint small ${wt.coop > 0 ? '' : 'warn'}">🛡️ Esperan la oleada ${wt.fleets} ${wt.fleets === 1 ? 'flota' : 'flotas'} de ${wt.players} ${wt.players === 1 ? 'imperio' : 'imperios'}: cuentan como ${String(wt.N).replace('.', ',')} imperios efectivos y su coraza deja pasar el ${pct(wt.coop)} del daño.${wt.coop > 0 ? '' : ` Hacen falta más de ${String(FEATS.coop[0][0]).replace('.', ',')}.`}</p>`
      : `<p class="hint small warn">🛡️ Aún no espera ninguna flota la próxima oleada. Su coraza solo cede si combaten varios imperios a la vez.</p>`;
  }
  // Tu parte ideal: cuánto subiría la coraza con lo que tienes en casa
  if (f.pledged && wt && (f.stage === 'lucha' || f.stage === 'presagio') && !game.state.missions.some((m) => m.target === view.id && m.phase !== 'vuelta')) armor += idealHint(game, wt);
  // Tu juramento y tu flota
  let mine = '';
  if (f.pledged) {
    const fleet = !myFleet
      ? f.stage === 'lucha'
        ? '<p class="hint warn small">Tu flota no está aquí: mándala abajo (misión Atacar) antes de la próxima oleada.</p>'
        : '<p class="hint small">Manda tu flota abajo (misión Atacar): esperará frente a la costa hasta la primera oleada.</p>'
      : myFleet.phase === 'ida'
        ? `<p class="hint ok small">⛵ Tu flota llega en <span class="q-time" data-until="${myFleet.arrive}"></span>${f.stage === 'lucha' && myFleet.arrive > f.nextWave ? ': después de la próxima oleada, así que combatirá en la siguiente' : ' y esperará a la oleada'}.</p>`
        : '<p class="hint ok small">⚓ Tu flota espera frente a la costa: combatirá en la próxima oleada.</p>';
    mine = `<p class="hint ok small">⚔️ Has jurado esta gesta${f.stage === 'lucha' ? ` · tu gloria: ${pct(f.myGlory)} · trajiste el ${pct(f.myEffort)} de tu fuerza` : ''}.</p>${fleet}`;
  } else if (f.convoked && f.pledgeOpen) {
    mine = `<p class="desc small">Estás convocado. Al jurar se anota tu poder (el enemigo crece con el de todos) y te comprometes a combatir (o a ofrendar en la fragua): quien jura y no hace ninguna de las dos en ${FEATS.perjuryHours} h es perjuro. Y dejas tus guerras: terminan tus ocupaciones y bloqueos de otras ciudades y vuelven las flotas que van a por otros jugadores.</p>
      <button class="primary wide" data-action="pledge-feat" data-site="${escapeHtml(view.id)}">${f.icon} Jurar la gesta</button>`;
  } else if (f.convoked) mine = '<p class="muted small">El juramento ya está cerrado.</p>';
  else mine = '<p class="muted small">No estás convocado a esta gesta: solo los imperios cercanos al continente.</p>';
  const forge = f.pledged && f.forge ? forgeSection(game, view, f) : '';
  const estimate = f.pledged && f.stage === 'lucha' ? estimateHint(f) : '';
  const top = f.top.length ? `<h5>Más gloria</h5><ol class="mini-rank contest-list">${f.top.map((x) => `<li class="${x.me ? 'me' : ''}"><span>${escapeHtml(x.name)}</span><b>${pct(x.share)}</b></li>`).join('')}</ol>` : '';
  const intro = f.stage === 'presagio' ? `<p class="desc small">${escapeHtml(f.themeText ?? '')} ${escapeHtml(FEAT_INTRO)}</p>` : '';
  return `<div class="feat-box">${head}${intro}${rows.join('')}${phases}${armor}${mine}${estimate}${forge}${top}${more}</div>`;
}

const num = (x) => String(Math.round(x * 100) / 100).replace('.', ',');

/** Nombre de un fondeadero: el asentamiento del continente al que mira. */
function postName(game, view, i) {
  const sites = game.world.islands().filter((x) => x.land === view.id);
  return sites[i]?.name ? `frente a ${sites[i].name}` : '';
}

/** La Armada: los fondeaderos (quién los sostiene o su escuadra) y el campamento. */
function armadaPhases(game, view, f) {
  const b = f.boss;
  const posts = f.posts
    .map((p) => {
      const what = p.holderName ? `⚓ ${escapeHtml(p.holderName)}${p.mine ? ' (tú)' : ''} · aguanta ${p.held} ${p.held === 1 ? 'salida' : 'salidas'}` : `⛵ libre · escuadra de ${p.squad}`;
      return `<li class="feat-phase ${p.holderName ? 'done' : 'now'}"><div class="info-row"><span>Fondeadero ${p.i + 1} <span class="muted small">${escapeHtml(postName(game, view, p.i))}</span></span><b>${what}</b></div></li>`;
    })
    .join('');
  const camp = (b.inmortal ?? 0) + (b.arquero_persa ?? 0);
  const full = (b.full?.inmortal ?? 0) + (b.full?.arquero_persa ?? 0);
  const free = f.posts.filter((p) => !p.holderName).length;
  const w = full ? Math.round((camp / full) * 100) : 0;
  const siege = free ? `${free} ${free === 1 ? 'fondeadero libre' : 'fondeaderos libres'}: el campamento se rehace y su empalizada aguanta más.` : `Cerco completo: pasa hambre (−${Math.round((b.hunger ?? 0) * 100)} % de vida) y no se rehace.`;
  return `<ol class="feat-phases">${posts}
    <li class="feat-phase now"><div class="info-row"><span>🏕️ El campamento</span><b>${fmtNum(camp)} / ${fmtNum(full)}</b></div><div class="progress horde-bar"><i style="width:${w}%"></i></div></li></ol>
    <p class="muted small">${siege}</p>`;
}

/** La Hidra: cabezas vivas, cortadas y la brea que hay para cauterizarlas. */
function hydraPhases(f) {
  const b = f.boss;
  const T = FEAT_THEMES[f.theme].tune;
  const brea = Math.max(0, (f.forge?.total ?? 0) - (f.forge?.used ?? 0));
  const can = b.brea ? Math.floor(brea / b.brea) : 0;
  const w = Math.min(100, Math.round((b.hidra / T.maxHeads) * 100));
  return `<ol class="feat-phases"><li class="feat-phase now"><div class="info-row"><span>🐉 Cabezas vivas</span><b>${b.hidra} (como mucho ${T.maxHeads})</b></div><div class="progress horde-bar"><i style="width:${w}%"></i></div></li></ol>
    <p class="muted small">Cortadas: ${fmtNum(b.cut ?? 0)} · brea para cauterizar ${can} ${can === 1 ? 'cabeza' : 'cabezas'} (${fmtNum(b.brea)} por cabeza). Las que no se cauterizan vuelven como dos; la última solo cae cauterizada y con al menos ${num(FEATS.coop.find(([, y]) => y >= T.finalCoop)?.[0] ?? 3)} imperios efectivos.</p>`;
}

/** Imperios efectivos de la oleada si a las flotas que ya esperan se suma una de fuerza `x`. */
function predictedN(wt, x) {
  const S = wt?.othersSum ?? 0;
  const Q = wt?.othersSq ?? 0;
  return x > 0 ? (S + x) ** 2 / (Q + x * x) : Q ? (S * S) / Q : 0;
}

/**
 * El simulador ante la fase actual de la gesta: tu flota contra todos los hijos que quedan,
 * con la coraza que habría si se sumara a las que ya esperan y lo que da la fragua.
 */
export function featSimPreset(game, view, attacker) {
  const f = view.feat;
  const theme = f.phases[f.boss.phase] ?? f.phases.at(-1);
  const unit = theme.unit;
  const c = playerCombat(game.state);
  const forge = forgeBonus(f.forge);
  const coop = featCoop(predictedN(f.waiting, forceOf(attacker, c.atkMul, c.hpMul)));
  const head = unit === 'cabeza';
  const T = FEAT_THEMES[f.theme].tune;
  const fury = head && (f.boss.cabeza ?? 0) <= T.furyAt;
  const hp = (head ? f.boss.headHp : 1) / Math.max(0.01, coop);
  return {
    attacker,
    atkMul: c.atkMul * forge.atk,
    hpMul: c.hpMul,
    defender: { [unit]: f.boss[unit] ?? 0 },
    defAtkMul: head ? f.boss.headAtk * (fury ? T.fury : 1) : 1,
    defHpMul: hp,
    towers: fury ? Math.round(f.boss.lava * forge.lava) : 0,
    title: `${f.icon} ${theme.name}: tu flota sola contra lo que queda`,
    note: coop > 0
      ? `Con tu flota y las que ya esperan, la coraza dejaría pasar el ${Math.round(coop * 100)} % del daño (va en la vida del defensor). En la oleada combatís todos juntos: esto es lo que haría tu flota sola.`
      : 'Con las flotas que esperan ahora, la coraza no dejaría pasar nada: hacen falta más imperios en la oleada.',
  };
}

/**
 * El simulador ante una isla, con las mismas cuentas que hará el servidor y lo que sabes de ella.
 * Contra una ciudad: muralla y torres (con la torre de vigía), faro, refuerzos y mejoras según lo
 * que vieron tus espías (lo que no vieron cuenta como nada), y hay que desembarcar para ganar.
 * Contra una isla neutral, su guarnición (la del último bote) y su fortificación; contra una horda, sin muralla.
 */
export function citySimPreset(game, view, attacker, withHero = false) {
  const c = playerCombat(game.state);
  const preset = {
    attacker,
    atkMul: c.atkMul + (withHero ? game.heroBonus('ataque') : 0),
    hpMul: c.hpMul,
    title: `Contra ${view?.name ?? 'la isla'}`,
    landing: view?.type === 'jugador',
  };
  if (view?.type === 'continente') return { ...preset, defender: { ...(view.horde?.garrison ?? {}) } };
  if (view?.type !== 'jugador') return { ...preset, defender: { ...(view?.intel?.garrison ?? {}) }, wall: view?.wall ?? 0 };
  const intel = view.intel;
  const level = intel?.level ?? 0;
  const defender = { ...(intel?.garrison ?? {}) };
  for (const sup of intel?.support ?? []) for (const [id, n] of Object.entries(sup.units ?? {})) defender[id] = (defender[id] ?? 0) + n;
  const d = intel?.defenses;
  const w = wallBonus(intel?.wall ?? 0, d?.torre ?? 0);
  const up = intel?.upgrades;
  const theirs = up ? playerCombat({ buildings: { forja: up.forja ?? 0 }, research: { herreria: up.herreria ?? 0, armaduras: up.armaduras ?? 0 } }) : { atkMul: 1, hpMul: 1 };
  const unseen = SPY_TIERS.filter((tier) => tier.boats > level).map((tier) => tier.text.toLowerCase());
  return {
    ...preset,
    defender,
    defAtkMul: theirs.atkMul,
    defHpMul: theirs.hpMul,
    wall: w.hp,
    towers: w.towers,
    naval: navalDefense(d?.faro ?? 0),
    note: !intel
      ? 'Sin espiar no sabes qué la defiende: aquí cuenta como si no tuviera nada. Manda botes espía para afinar.'
      : unseen.length
        ? `Tus espías no vieron ${unseen.join('; ')}: aquí cuenta como nada. Con más botes sabrías más.`
        : undefined,
  };
}

/** Con las fuerzas que ya esperan, cuánto subiría la coraza si mandas todo lo que tienes en casa, y la fuerza que más la abre. */
function idealHint(game, wt) {
  const c = playerCombat(game.state);
  const x = forceOf(game.units, c.atkMul, c.hpMul);
  if (!(x > 0)) return '';
  const S = wt.othersSum ?? 0;
  const Q = wt.othersSq ?? 0;
  const N = predictedN(wt, x);
  const ideal = S > 0 ? Q / S : 0;
  const yours = `Si mandas todo lo que tienes en casa (fuerza ${fmtNum(x)}), contaríais como ${num(N)} ${Math.abs(N - 1) < 0.005 ? 'imperio efectivo' : 'imperios efectivos'}: la coraza dejaría pasar el ${Math.round(featCoop(N) * 100)} % del daño.`;
  const best = S > 0 && x > ideal * 1.5 ? ` Lo que más la abre es una flota parecida a las demás: una fuerza de unos ${fmtNum(ideal)}.` : '';
  return `<p class="hint small">⚖️ ${yours}${best}</p>`;
}

/** Lo que te llevarías si la gesta acabara ahora en victoria. */
function estimateHint(f) {
  const R = FEATS.reward;
  const offer = f.myProd > 0 ? (f.forge?.mine ?? 0) / f.myProd : 0;
  let band = -1;
  if (f.myGlory >= R.minGlory) {
    for (let b = 0; b < R.effort.length; b++) if (f.myEffort >= R.effort[b]) band = b;
    for (let b = 0; b < R.offer.length; b++) if (offer >= R.offer[b] - 1e-9) band = Math.max(band, b);
  }
  const names = ['🥉 Bronce', '🥈 Plata', '🥇 Oro'];
  if (band < 0) {
    const need = `trae al menos el ${Math.round(R.effort[0] * 100)} % de tu fuerza (sumando oleadas) u ofrenda ${R.offer[0]} h de tu producción en la fragua`;
    return `<p class="hint small warn">🏅 Aún no llegas a ningún tramo de premio: ${need}.</p>`;
  }
  const next = band < R.effort.length - 1 ? ` Para ${names[band + 1]}: el ${Math.round(R.effort[band + 1] * 100)} % de tu fuerza${band + 1 < R.offer.length ? ` u ${R.offer[band + 1]} h ofrendadas` : ''}.` : '';
  return `<p class="hint ok small">🏅 Si cae ahora: tramo ${names[band]}, ${R.hours[band]} h de tu producción, tu parte del bote común${band >= 1 ? ' y la bendición del Olimpo' : ''}.${next}</p>`;
}

/** La fragua de Hefesto: cuánto lleva, qué da y el formulario para ofrendar. */
function forgeSection(game, view, f) {
  const F = FEATS.forge;
  const fg = f.forge;
  if (!fg.goal) return '';
  const brea = FEAT_THEMES[f.theme]?.forge === 'brea';
  // La brea se gasta al cauterizar: lo que cuenta es lo que queda en la fragua
  const inForge = fg.total - (brea ? (fg.used ?? 0) : 0);
  const pct = Math.min(100, Math.round((inForge / fg.goal) * 100));
  const bonus = forgeBonus({ goal: fg.goal, total: fg.total });
  // La lava solo la escupe Tifón
  const lava = f.kind === 'tifon';
  const now = brea
    ? 'Aquí la fragua hace brea: cada cabeza cortada que se cauteriza con ella ya no vuelve como dos.'
    : bonus.quarters
      ? `Ahora: +${num(bonus.atk * 100 - 100)} % de ataque${lava ? ` y ${bonus.lava <= 0 ? 'nada de lava' : `un ${Math.round((1 - bonus.lava) * 100)} % menos de lava`}` : ''}.`
      : 'Aún no da nada: llenad el primer cuarto.';
  const open = f.stage === 'presagio' || f.stage === 'lucha';
  const room = fg.room ?? 0;
  const canGive = open && room >= 1;
  const options = F.resources.map((r) => `${RESOURCES[r].icon} ${fmtNum(room / RESOURCES[r].value)}`).join(' · ');
  const form = canGive
    ? `<p class="muted small">Aún puedes ofrendar hasta ${options} (o una mezcla).</p>
      <div class="payload">${F.resources
        .map((r) => {
          // Como mucho, lo que tienes (y lo que aún cabe en la fragua)
          const max = Math.max(0, Math.floor(Math.min(game.resources[r] ?? 0, room / RESOURCES[r].value)));
          return `<label title="${RESOURCES[r].name}: como mucho ${fmtNum(max)}">${RESOURCES[r].icon}<input type="number" name="fg-${r}" min="0" max="${max}" data-clamp placeholder="${fmtNum(max)}" inputmode="numeric" /></label>`;
        })
        .join('')}</div>
      <button class="primary wide" data-action="feat-forge" data-site="${escapeHtml(view.id)}">🔥 Ofrendar en la fragua</button>`
    : open
      ? `<p class="muted small">${inForge >= fg.goal ? 'La fragua está llena.' : 'Ya has ofrendado todo lo que puedes en esta gesta.'}</p>`
      : '';
  return `<div class="section feat-forge">
    <h5>🔥 ${brea ? 'Brea de la fragua' : 'Fragua de Hefesto'} · ${pct} %</h5>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <p class="muted small">${fmtNum(inForge)} / ${fmtNum(fg.goal)} en valor${brea && fg.used ? ` (ya se han gastado ${fmtNum(fg.used)} cauterizando: se puede volver a llenar)` : ''} · ${fg.givers} ${fg.givers === 1 ? 'imperio ha' : 'imperios han'} ofrendado · tú, ${fmtNum(fg.mine)}. ${brea ? '' : `Cada cuarto da +${num(F.atk * 100)} % de ataque${lava ? ` y quita un ${Math.round(F.lava * 100)} % de la lava` : ''}. `}${now}</p>
    ${form}
  </div>`;
}

const FEAT_INTRO = 'Solo cae si varios imperios combaten juntos, por oleadas cada pocas horas. Si cae, todos los que combatieron se reparten un botín a la medida de lo que producen.';

/** Una horda bárbara en el continente: cuánto le queda, cuándo ataca y quién la está mermando. */
function hordeSection(view) {
  const h = view.horde;
  if (!h) return '';
  const pct = Math.round((h.left / Math.max(1, h.total)) * 100);
  const top = h.top.map((x) => `<li class="${x.me ? 'me' : ''}"><span>${escapeHtml(x.name)}</span><b>${fmtNum(x.kills)}</b></li>`).join('');
  return `<div class="horde-box">
    <h4>🔥 ¡Horda bárbara!</h4>
    <p class="desc small">Si no cae antes de que acabe la cuenta atrás, arrasará las colonias de este continente: no producirán durante un día. Todos los que luchen se reparten el botín según los bárbaros que abatan.</p>
    <div class="info-row"><span>Ataca en</span><b class="q-time" data-until="${h.deadline}"></b></div>
    <div class="info-row"><span>Fuerzas</span><span>${unitList(h.garrison)}</span></div>
    <div class="progress horde-bar"><i style="width:${pct}%"></i></div>
    <p class="muted small">Quedan ${fmtNum(h.left)} de ${fmtNum(h.total)} bárbaros</p>
    ${top ? `<h5>Más bárbaros abatidos</h5><ol class="mini-rank contest-list">${top}</ol>` : ''}
  </div>`;
}

/** La maravilla del continente: su nivel, lo que falta y quién ha aportado. */
function wonderSection(game, view) {
  const w = view.wonder;
  if (!w) return '';
  const def = WONDERS[w.id];
  const prev = WONDER_LEVELS[w.level - 1] ?? 0;
  const pct = w.next ? Math.round(((w.progress - prev) / (w.next - prev)) * 100) : 100;
  const donors = Object.entries(w.donors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, n]) => `<li><span>${escapeHtml(game.world.playerInfo(Number(uid))?.name ?? (Number(uid) === game.userId ? game.username : 'Un colono'))}</span><b>${fmtNum(n)}</b></li>`)
    .join('');
  const form = !w.next
    ? '<p class="hint ok">✨ La maravilla está terminada.</p>'
    : w.member
      ? `<div class="payload">${WONDER_RESOURCES.map((r) => `<label title="${RESOURCES[r].name}">${RESOURCES[r].icon}<input type="number" name="w-${r}" min="0" placeholder="0" inputmode="numeric" /></label>`).join('')}</div>
        <button class="primary wide" data-action="donate">🏛️ Aportar a la maravilla</button>`
      : '<p class="desc small">Funda una colonia en este continente (o conquista una de sus ciudades) para ayudar a levantarla y recibir su efecto.</p>';
  return `<div class="section wonder">
    <h4>${def.icon} ${def.name} · nivel ${w.level}/${WONDER_LEVELS.length}</h4>
    <p class="desc small">La construyen entre todos los que tienen colonia en el continente, y todos ellos reciben su efecto en todo su imperio.</p>
    <div class="effect"><span>Efecto</span><b class="up">${w.level ? def.text(w.level) : 'Ninguno todavía'}${w.next ? ` → ${def.text(w.level + 1)}` : ''}</b></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <p class="muted small">${w.next ? `${fmtNum(w.progress)} / ${fmtNum(w.next)} recursos para el nivel ${w.level + 1}` : `${fmtNum(w.progress)} recursos aportados`}</p>
    ${donors ? `<h5>Quién más ha aportado</h5><ul class="mini-list donors">${donors}</ul>` : ''}
    ${form}
  </div>`;
}

function infoSection(game, view) {
  const t = ISLAND_TYPES[view.type];
  if (view.type === 'continente') return continentSection(game, view);
  if (view.land) {
    const land = game.world.island(view.land);
    const inner = infoSectionFor(game, view, t);
    return `<p class="hint">🗺️ En el continente <b>${escapeHtml(land?.name ?? '')}</b></p>${inner}`;
  }
  return infoSectionFor(game, view, t);
}

function infoSectionFor(game, view, t) {
  if (view.type === 'jugador') return playerSection(game, view);
  if (view.colonizedBy != null && !view.colonized && view.type === 'ciudadela') {
    return `<p class="desc">Ciudad bárbara conquistada por <b>${escapeHtml(view.colonistName)}</b>. Ya no quedan bárbaros: su bandera ondea sobre la empalizada.</p>`;
  }
  if (view.colonizedBy != null && !view.colonized) {
    const r = RESOURCES[view.specialty];
    return `<p class="desc">Colonia de <b>${escapeHtml(view.colonistName)}</b>. Produce ${r.icon} ${r.name.toLowerCase()} para su imperio.</p>`;
  }
  if (view.colonized) return colonySection(game, view);
  if (view.type === 'brumas') {
    return `<p class="desc">Más allá de las islas conocidas, una niebla que nunca se levanta. Las expediciones vuelven con tesoros, barcos perdidos… o no vuelven. Solo una a la vez: pasan unas horas en la niebla y traen lo que cabe en su bodega.</p>
      <p class="desc small">Hace falta Navegación 4. Cuantos más barcos y más bodega lleves, más botín puedes traer, pero también hay piratas y monstruos.</p>`;
  }
  if (!view.explored) {
    return '<p class="desc">Nadie sabe qué hay en esta isla. Envía un bote explorador para descubrirlo: hasta entonces no puedes hacer nada más en ella.</p>';
  }
  if (view.type === 'libre') {
    const r = RESOURCES[view.specialty];
    return `<p class="desc">Tierra fértil y deshabitada. Si fundas aquí una colonia producirá ${r.name.toLowerCase()} para tu imperio.</p>
      <div class="effect"><span>${r.icon} Producción como colonia</span><b class="up">+${fmtNum(colonyYield(view))}/h</b></div>`;
  }
  if (view.type === 'ruinas') {
    return view.looted
      ? '<p class="desc">Las ruinas ya han sido saqueadas. Solo quedan piedras y lagartijas.</p>'
      : `<p class="desc">Entre las columnas caídas brilla algo. Quien desembarque se llevará el tesoro:</p><div class="info-row"><span>Tesoro</span><span>${bag(view.treasure)}</span></div>`;
  }
  // Lo que sabes de ellos es lo que vio tu último bote (o tu último ataque), no lo que tienen ahora
  const intel = view.intel;
  const lines = [];
  if (view.rebuildUntil) {
    lines.push(`<div class="hint">🔨 ${neutralsOf(view)} se están reconstruyendo tras el último saqueo: no se sabe cuántos son ni qué tienen, y no se les puede atacar hasta dentro de <span class="q-time" data-until="${view.rebuildUntil}"></span>.</div>`);
  } else if (intel) {
    lines.push(
      `<h4>Lo último que sabes <span class="muted small">(${fmtAgo(intel.t)})</span></h4>`,
      `<div class="info-row"><span>Guarnición</span><span>${intel.rebuildUntil ? 'reconstruyéndose' : unitList(intel.garrison)}</span></div>`,
      `<div class="info-row"><span>Botín acumulado</span><span>${intel.rebuildUntil ? '—' : bag(intel.stock)}</span></div>`,
    );
    if (view.foughtAt > intel.t) lines.push('<p class="hint">⚔️ Desde tu último informe ha habido combates aquí: envía un bote explorador para saber cómo están.</p>');
    else lines.push('<p class="desc small">Con el tiempo se rearman y juntan más botín: envía un bote explorador para ver cómo están ahora.</p>');
  }
  if (view.wall) lines.push(`<div class="info-row"><span>🏰 Fortificación</span><b>+${Math.round(view.wall * 100)} % de vida</b></div>`);
  const flavor = {
    barbaros: 'Una tribu de bárbaros ha levantado aquí su campamento. Acumulan lo que roban y se rearman con el tiempo.',
    ciudadela: 'Una ciudad bárbara amurallada tierra adentro: muchos guerreros y mucho botín. Lleva catapultas para abrir brecha en su empalizada.',
    piratas: 'Guarida de piratas bien fortificada. Las catapultas ayudan a abrir brecha en sus muros.',
    kraken: 'Aquí duerme el Kraken, rodeado de barcos hundidos y del oro de mil naufragios.',
  }[view.type];
  return `<p class="desc">${flavor}</p>${lines.join('')}
    <p class="desc small">Se rearman por completo en unas ${fmtNum(view.regenHours)} h de juego. Solo te llevas el botín si acabas con toda la guarnición.</p>`;
}

function inboundSection(game, view) {
  const moving = view.inbound.filter((m) => m.phase !== 'estacionada');
  if (!moving.length) return '';
  const rows = moving
    .map((m) => {
      const t = MISSION_TYPES[m.type];
      const until = m.phase === 'ida' ? m.arrive : m.back;
      return `<li><span>${t.icon} ${t.name} · ${m.phase === 'ida' ? 'de ida' : 'volviendo'}</span><span class="q-time" data-until="${until}"></span></li>`;
    })
    .join('');
  return `<h4>Flotas en camino</h4><ul class="mini-list">${rows}</ul>`;
}

/** Ciudades ocupadas desde las que puede zarpar una flota hacia `targetId`. */
function outpostsFor(game, targetId) {
  return game.occupations().filter((m) => m.target !== targetId);
}

/** Tropas disponibles en el origen elegido (`from`: id de la ocupación, o nada para tu capital). */
export function poolFor(game, from) {
  if (from == null) return game.units;
  return game.occupations().find((m) => m.id === from)?.units ?? {};
}

function fleetForm(hud, game, view) {
  const feat = view.type === 'continente' && featActive(view.feat) ? view.feat : null;
  if (view.type === 'continente' && !view.horde && !feat?.pledged) return '';
  if (game.level('puerto') < 1) return '<div class="section"><h4>Enviar flota</h4><p class="desc">Construye un puerto en tu isla para poder zarpar.</p></div>';
  // Origen: tu capital o una ciudad que ocupas
  const outposts = outpostsFor(game, view.id);
  const base = outposts.find((m) => String(m.id) === String(hud.fleetFrom ?? '')) ?? null;
  const pool = base ? base.units : game.units;
  const fromSelect = outposts.length
    ? `<label class="joint-pick">⚓ Zarpar desde <select name="from">
        <option value="">${escapeHtml(game.homeIsland?.name ?? 'tu capital')} (tu capital)</option>
        ${outposts.map((m) => `<option value="${m.id}" ${m === base ? 'selected' : ''}>🦅 ${escapeHtml(m.targetName)} (ocupada)</option>`).join('')}
      </select></label>`
    : '';
  const closed = !base && game.portClosed() ? `<p class="hint warn">${game.state.occupied ? '🦅 Tu ciudad está ocupada' : '⛓️ Tu puerto está bloqueado'}: no puede zarpar ninguna flota desde tu capital.${outposts.length ? ' Puedes zarpar desde una ciudad que ocupes.' : ''}</p>` : '';
  const home = PLAYER_UNITS.filter((id) => pool[id] > 0);
  if (!home.length) {
    const empty = base ? `No te quedan tropas en ${escapeHtml(base.targetName)}.` : 'No tienes tropas ni barcos en casa. Entrénalos en el cuartel y el puerto.';
    return `<div class="section"><h4>Enviar flota</h4>${fromSelect}${closed}<p class="desc">${empty}</p></div>`;
  }

  const rows = home
    .map((id) => {
      const u = UNITS[id];
      return `<div class="fleet-row">
        <span class="fleet-unit u-cell" title="${u.name}">${unitIcon(id)} ${u.name}</span>
        <span class="muted">${fmtNum(pool[id])}</span>
        <input type="number" name="f-${id}" min="0" max="${pool[id]}" placeholder="0" inputmode="numeric" aria-label="${u.name} a enviar" />
        <button class="ghost small" data-action="fleet-all" data-unit="${id}" data-max="${pool[id]}">Todos</button>
      </div>`;
    })
    .join('');

  const types = [];
  if (view.type === 'brumas') types.push('expedicion');
  else if (view.type !== 'continente') types.push('explorar');
  // Sin explorar, lo único que se puede hacer es mandar un bote a mirar
  const known = view.explored;
  const hostile = known && (['barbaros', 'ciudadela', 'piratas', 'kraken', 'jugador'].includes(view.type) || (view.type === 'continente' && (!!view.horde || !!feat)));
  if (view.type !== 'brumas' && view.colonizedBy == null && hostile) types.push('atacar');
  // La Armada: también se toman sus fondeaderos
  const armada = feat?.kind === 'armada';
  if (armada) types.push('bloquear');
  const enemyCity = known && view.type === 'jugador' && !(view.alliance && view.alliance.id === game.alliance?.id);
  if (enemyCity) types.push('invadir', 'bloquear', 'sabotaje');
  if (known && view.type === 'jugador') types.push('transporte');
  if (view.type === 'jugador' && view.alliance && view.alliance.id === game.alliance?.id) types.push('apoyo');
  if (view.type === 'libre' && view.explored && view.colonizedBy == null) types.push('colonizar');
  if (view.type === 'ciudadela' && view.explored && view.colonizedBy == null) types.push('conquistar');
  // Desde una ciudad ocupada solo se lanzan ataques y espías
  const allowed = base ? types.filter((t) => OUTPOST_MISSIONS.includes(t)) : types;

  const buttons = allowed
    .map((t) => {
      const label = t === 'explorar' && view.type === 'jugador' ? 'Espiar' : t === 'sabotaje' ? 'Sabotear' : t === 'bloquear' ? (armada ? 'Al fondeadero' : 'Bloquear') : armada && t === 'atacar' ? 'Asaltar el campamento' : MISSION_TYPES[t].name;
      return `<button class="${['atacar', 'invadir', 'bloquear'].includes(t) ? 'danger' : 'primary'} small" data-action="mission" data-type="${t}">${MISSION_TYPES[t].icon} ${label}</button>`;
    })
    .join('');
  const warHint = enemyCity
    ? `<p class="hint small">🦅 <b>Invadir</b>: si tus tropas desembarcan y acaban con su ejército, se quedan ocupando la ciudad (${OCCUPATION.hours} h como mucho): te llevas tributo, saqueas su almacén y atacas desde allí. ⛓️ <b>Bloquear</b>: solo barcos de guerra; si vencen a su flota, cierran su puerto ${BLOCKADE.hours} h como mucho. <button class="link" data-action="guide" data-topic="invasiones">📖 Más en la guía</button></p>`
    : '';
  const cargoForm = types.includes('transporte')
    ? `<h4>Recursos para transportar</h4><div class="payload">${RESOURCE_KEYS.map(
        (r) => `<label title="${RESOURCES[r].name}">${RESOURCES[r].icon}<input type="number" name="p-${r}" min="0" placeholder="0" inputmode="numeric" /></label>`,
      ).join('')}</div><p class="hint">Si no eliges barcos, salen los mercantes que hagan falta.</p>`
    : '';
  const spyHint = view.type === 'jugador' && types.includes('explorar') && !view.mine ? spyHelp(view) : '';
  const colony = types.includes('colonizar')
    ? `<div class="hint">Los colonos viajan en un mercante y se quedan con él. Llevan:</div>${costList(game.planMission('colonizar', view.id, { mercante: 1 }).cost ?? {}, game.resources)}`
    : types.includes('conquistar')
      ? `<div class="hint">🏴 Para conquistarla, tus tropas tienen que acabar con toda la guarnición. Los colonos van en un mercante, se quedan con él y llevan:</div>${costList(game.planMission('conquistar', view.id, { mercante: 1, lancero: 1 }).cost ?? {}, game.resources)}`
      : '';
  return `<div class="section">
    <h4>Enviar flota <span class="muted small">(${game.fleetsAtSea()}/${game.fleetSlots()} en el mar)</span></h4>
    ${fromSelect}${closed}
    <div class="fleet">${rows}</div>
    ${game.heroStatus() === 'casa' && !base ? `<label class="hero-toggle"><input type="checkbox" name="with-hero" /> 🎖️ Que vaya ${escapeHtml(game.hero.name)} (Nv ${game.hero.level})</label>` : ''}
    ${jointSelect(game, view)}
    <div class="fleet-summary" data-fleet-summary></div>
    ${cargoForm}
    ${colony}
    ${spyHint}
    <div class="mission-buttons">${buttons}</div>
    ${warHint}
    ${armada ? postSelect(game, view, feat) : ''}
    ${feat ? `<p class="hint small">${feat.icon} ${FEAT_FLEET_HINT[feat.kind] ?? FEAT_FLEET_HINT.tifon}</p>` : ''}
    ${hostile && (!feat || (feat.boss && feat.kind === 'tifon')) ? `<button class="ghost wide sim-btn" data-action="simulate">🎲 ${feat ? 'Simular contra la fase actual' : 'Simular el combate'}</button>` : ''}
    <div class="hint warn" data-fleet-reason></div>
  </div>`;
}

/** Ataques de tu alianza hacia esta ciudad a los que puedes sumar tu flota. */
function jointSelect(game, view) {
  if (view.type !== 'jugador') return '';
  const joints = (game.world.joints ?? []).filter((j) => j.target === view.id && j.leaderId !== game.userId);
  if (!joints.length) return '';
  const left = (t) => fmtTime(Math.max(0, (t - game.now()) / 1000));
  return `<label class="joint-pick">🤝 <select name="join">
      <option value="">Ataque propio</option>
      ${joints.map((j) => `<option value="${escapeHtml(j.key)}">Unirse al ataque de ${escapeHtml(j.leader)} (llega en ${left(j.arrive)}${j.allies ? `, con ${j.allies} más` : ''})</option>`).join('')}
    </select></label>`;
}

/** Opciones de la flota: almirante y ataque conjunto. */
export function readOpts(root) {
  const from = root.querySelector('[name="from"]')?.value;
  const post = root.querySelector('[name="post"]')?.value;
  return { hero: !!root.querySelector('[name="with-hero"]')?.checked, join: root.querySelector('[name="join"]')?.value || undefined, from: from ? Number(from) : undefined, post: post !== undefined && post !== '' ? Number(post) : undefined };
}

const FEAT_FLEET_HINT = {
  tifon: 'Manda barcos de guerra para la primera fase (en el mar) y tropas de tierra para las siguientes. Tu flota espera frente a la costa y combate en la siguiente oleada junto a las de los demás.',
  armada: 'Al fondeadero: solo barcos de guerra; si lo tomáis, tu flota se queda allí aguantando sus salidas (otros pueden ir de escolta). Asaltar el campamento: tropas de tierra con barcos, en la oleada, junto a los demás y con la coraza.',
  hidra: 'Solo se lucha en tierra: manda tropas con barcos que las lleven. Tu flota espera frente a la costa y combate en la siguiente oleada junto a las de los demás.',
};

/** A qué fondeadero de la Armada va la flota (los tomados por otros, para escoltarlos). */
function postSelect(game, view, feat) {
  const posts = feat.posts ?? Array.from({ length: game.world.islands().filter((x) => x.land === view.id).length || 3 }, (_, i) => ({ i, holderName: null, squad: null }));
  const options = posts
    .map((p) => `<option value="${p.i}">Fondeadero ${p.i + 1} ${escapeHtml(postName(game, view, p.i))} · ${p.holderName ? `de ${escapeHtml(p.holderName)} (escolta)` : p.squad != null ? `libre, ${p.squad} fenicias` : 'libre'}</option>`)
    .join('');
  return `<label class="joint-pick">⚓ Fondeadero <select name="post">${options}</select></label>`;
}

/** Unidades elegidas en el formulario de flota. */
export function readFleet(root) {
  const units = {};
  for (const input of root.querySelectorAll('input[name^="f-"]')) {
    const n = Math.floor(Number(input.value) || 0);
    if (n > 0) units[input.name.slice(2)] = n;
  }
  return units;
}

/** Recursos elegidos para un transporte. */
export function readPayload(root) {
  const out = {};
  for (const input of root.querySelectorAll('input[name^="p-"]')) {
    const n = Math.floor(Number(input.value) || 0);
    if (n > 0) out[input.name.slice(2)] = n;
  }
  return out;
}

/** Qué averiguan los espías según cuántos botes mandes, y el riesgo si se conoce su torre de vigía. */
function spyHelp(view) {
  const tiers = SPY_TIERS.map((s) => `<li><b>${s.boats} ${s.boats === 1 ? 'bote' : 'botes'}</b>: ${s.boats > 1 ? 'además, ' : ''}${s.text.charAt(0).toLowerCase() + s.text.slice(1)}</li>`).join('');
  const torre = view.intel?.defenses?.torre;
  const risk =
    torre != null
      ? `Con su torre de vigía a nivel ${torre}, los descubren: ${SPY_TIERS.map((s) => `${s.boats} ${s.boats === 1 ? 'bote' : 'botes'}, ${Math.round(spyRisk(torre, s.boats) * 100)} %`).join(' · ')}.`
      : 'Su torre de vigía da hasta un 50 % de probabilidad de descubrirlos (lo sabrás espiando con 4 botes).';
  return `<details class="spy-help"><summary>🔭 Espiar: cuantos más botes, más averiguan… y más fácil es que los hundan</summary><ul>${tiers}</ul><p class="muted small">${risk}</p></details>`;
}

/**
 * Atajos cuando no eliges unidades: explorar manda un bote y un transporte,
 * los mercantes que hagan falta para la carga.
 */
export function fleetFor(game, type, units, payload = {}, from) {
  if (Object.keys(units).length) return units;
  const pool = poolFor(game, from);
  if ((type === 'explorar' || type === 'sabotaje') && pool.bote > 0) return { bote: 1 };
  if (type === 'transporte' && pool.mercante > 0) {
    const total = Object.values(payload).reduce((a, b) => a + b, 0);
    const need = Math.max(1, Math.ceil(total / UNITS.mercante.cargo));
    return { mercante: Math.min(need, pool.mercante) };
  }
  return units;
}

function refreshFleet(game, id, root) {
  const summary = root.querySelector('[data-fleet-summary]');
  if (!summary) return;
  const units = readFleet(root);
  const any = Object.keys(units).length > 0;
  const base = game.planMission('atacar', id, units, null, readOpts(root));
  const text = any
    ? `👥 ${base.used}/${base.capacity} plazas · 📦 ${fmtNum(base.cargo)} de carga${base.seconds ? ` · ⏱ ${fmtTime(base.seconds)} de ida` : ''}`
    : 'Elige cuántas unidades mandas.';
  if (summary.textContent !== text) summary.textContent = text;

  // Si ninguna misión es posible, explicar por qué la última (la más "seria") no lo es
  let anyOk = false;
  let lastReason = '';
  const payload = readPayload(root);
  const opts = readOpts(root);
  for (const btn of root.querySelectorAll('[data-action="mission"]')) {
    const plan = game.planMission(btn.dataset.type, id, fleetFor(game, btn.dataset.type, units, payload, opts.from), payload, opts);
    btn.disabled = !plan.ok;
    btn.title = plan.ok ? `Llegada en ${fmtTime(plan.seconds)}` : plan.reason;
    anyOk ||= plan.ok;
    if (!plan.ok) lastReason = plan.reason;
  }
  const hint = any && !anyOk ? lastReason : '';
  const reason = root.querySelector('[data-fleet-reason]');
  if (reason && reason.textContent !== hint) reason.textContent = hint;
}

/** La isla tal como se ve en el mapa, en pequeño (con la bandera de quien la gobierne). */
function islandArt(game, view) {
  const isl = game.world.island(view.id);
  if (!isl || view.type === 'brumas') return '';
  const ownerId = view.type === 'jugador' ? view.owner : view.colonizedBy;
  const bannerColor = ownerId === game.userId ? game.state.banner?.color : game.world.playerInfo(ownerId)?.banner?.color;
  const look = `${islandLook(view)}|${bannerColor ?? ''}`;
  const url = portrait('island', `${view.id}|${look}`, {
    width: 340,
    height: 150,
    model: () => {
      const g = new THREE.Group();
      g.add(createIslandBase(isl), createIslandFeature({ ...isl, colonizedBy: view.colonizedBy, bannerColor }, look));
      return g;
    },
  });
  return url ? `<div class="building-art island-art"><img src="${url}" alt="" draggable="false" /></div>` : '';
}

/** Tema de la guía que explica esta isla. */
function islandGuide(view) {
  if (view.colonized) return 'colonias';
  if (view.type === 'jugador') return view.port?.by != null ? 'invasiones' : 'jugadores';
  if (view.type === 'brumas') return 'expediciones';
  if (view.type === 'continente' && featActive(view.feat)) return 'gestas';
  if (view.type === 'ciudadela' || view.type === 'continente' || view.land) return 'continentes';
  if (view.type === 'libre') return 'colonias';
  return 'archipielago';
}

export function islandPanel(hud, id) {
  const game = hud.game;
  const view = game.island(id);
  const t = ISLAND_TYPES[view.type];
  let icon = view.colonized || view.colonizedBy != null ? '🚩' : view.explored ? t.icon : '❔';
  let sub = view.colonized ? `Tu colonia · nivel ${view.colony?.level ?? 1}` : view.explored ? `${view.typeName}${view.tier ? ` · Nv ${view.tier}` : ''}` : 'Isla desconocida';
  if (view.type === 'jugador') {
    icon = '🏰';
    sub = `Ciudad de ${escapeHtml(view.ownerName)}`;
  }
  const html = `
    <div class="panel-head">
      <span class="panel-icon">${icon}</span>
      <div>
        <h3>${escapeHtml(view.name)}</h3>
        <div class="panel-lvl">${sub} · a ${fmtNum(view.dist)} leguas</div>
      </div>
      <button class="icon-btn help-btn" data-action="guide" data-topic="${islandGuide(view)}" title="Qué es esto (guía)">?</button>
      <button class="icon-btn" data-action="close" title="Cerrar">✕</button>
    </div>
    ${islandArt(game, view)}
    ${infoSection(game, view)}
    ${inboundSection(game, view)}
    ${fleetForm(hud, game, view)}`;
  return {
    html,
    refresh(root) {
      refreshFleet(game, id, root);
    },
  };
}
