import { BOARD, BOARD_SECTIONS } from '../game/data.js';
import { api, getToken } from '../net/api.js';
import { askChoice, askConfirm, askPrompt } from './dialog.js';
import { escapeHtml, fmtAgo } from './format.js';

// El foro de la comunidad: una ventana propia (no la del HUD) para que se pueda abrir también desde
// la portada, sin cuenta. Tiene tres vistas: las secciones, los temas de una sección y un tema.
// Lo que escriben los jugadores va con translate="no" (no se traduce).

const text = (s) => escapeHtml(s).replace(/\n/g, '<br />');

/** La inicial de un jugador para su medallón, y un color propio (siempre el mismo para cada nombre). */
const initial = (name) => [...String(name ?? '?').trim()][0]?.toUpperCase() ?? '?';
const AVATAR_COLORS = ['#b5542f', '#2f7a8a', '#6a8a2f', '#8a4f9e', '#a8862c', '#3f6fb0', '#9e3f5c', '#4f7f5f'];
function nameColor(name) {
  let h = 0;
  for (const ch of String(name ?? '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export class Board {
  /** `onChange`: avisa al HUD cuando se ha leído algo (para el contador de no leídos). */
  constructor({ onChange = null } = {}) {
    this.onChange = onChange;
    this.root = null;
    this.view = { kind: 'sections' };
    this.data = null;
  }

  get open() {
    return !!this.root;
  }

  /** Abre el foro (en una sección o un tema, si se dice). */
  async show({ section = null, thread = null } = {}) {
    if (!this.root) this.#mount();
    if (thread != null) await this.#openThread(thread);
    else if (section) await this.#openSection(section);
    else await this.#openSections();
  }

  close() {
    if (!this.root) return;
    window.removeEventListener('keydown', this.keys, true);
    this.root.remove();
    this.root = null;
    this.onChange?.();
  }

  #mount() {
    const root = document.createElement('div');
    root.className = 'board-overlay';
    root.innerHTML = '<div class="modal-card board-card" role="dialog" aria-modal="true" aria-label="Foro de Aegium"></div>';
    root.addEventListener('click', (e) => this.#click(e));
    root.addEventListener('submit', (e) => this.#submit(e));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches?.('li[data-action]')) e.target.click();
    });
    this.keys = (e) => {
      // (con un diálogo abierto encima, el Escape es suyo)
      if (e.key === 'Escape' && !document.querySelector('.dialog')) {
        e.stopImmediatePropagation();
        this.close();
      }
    };
    window.addEventListener('keydown', this.keys, true);
    document.body.appendChild(root);
    this.root = root;
    this.card = root.firstElementChild;
  }

  get #loggedIn() {
    return !!getToken() && this.data?.me != null;
  }

  // ── Vistas ────────────────────────────────────────────────────────────────

  async #load(path) {
    try {
      return await api('GET', path);
    } catch (err) {
      this.#render(`<p class="form-error">${escapeHtml(err.message)}</p>`);
      return null;
    }
  }

  async #openSections() {
    const data = await this.#load('/api/board');
    if (!data) return;
    this.data = data;
    this.view = { kind: 'sections' };
    const rows = Object.entries(BOARD_SECTIONS)
      .map(([id, s]) => {
        const info = data.sections[id];
        const last = info.last
          ? `<span class="board-last"><span class="muted">Último:</span> <b translate="no">${escapeHtml(info.last.title)}</b> <span class="muted">· ${escapeHtml(info.last.by)}, ${fmtAgo(info.last.t)}</span></span>`
          : '<span class="board-last muted">Aún no hay temas: ¡abre el primero!</span>';
        return `<li class="board-section${info.unread ? ' unread' : ''}" style="--sec: ${s.color}" data-action="board-section" data-section="${id}" tabindex="0">
          <span class="board-medal">${s.icon}</span>
          <span class="board-info">
            <span class="board-name"><b>${s.name}</b>${info.unread ? ` <span class="badge-inline" title="Temas con mensajes nuevos">${info.unread} ${info.unread === 1 ? 'nuevo' : 'nuevos'}</span>` : ''}${s.modOnly ? ' <span class="board-tag">Solo el equipo</span>' : ''}</span>
            <span class="board-desc">${s.text}</span>
            ${last}
          </span>
          <span class="board-stats"><b>${info.threads}</b><span>${info.threads === 1 ? 'tema' : 'temas'}</span><b>${info.posts ?? 0}</b><span>${(info.posts ?? 0) === 1 ? 'mensaje' : 'mensajes'}</span></span>
        </li>`;
      })
      .join('');
    this.#render(`<ul class="board-sections">${rows}</ul>${this.#loginHint()}`);
  }

  async #openSection(section) {
    const data = await this.#load(`/api/board?section=${encodeURIComponent(section)}`);
    if (!data) return;
    this.data = data;
    this.view = { kind: 'section', section };
    const s = BOARD_SECTIONS[section];
    const canWrite = this.#loggedIn && (!s.modOnly || data.canModerate);
    const threads = data.threads ?? [];
    const rows = threads
      .map(
        (th) => `<li class="board-thread${th.unread ? ' unread' : ''}${th.pinned ? ' pinned' : ''}" data-action="board-thread" data-id="${th.id}" tabindex="0">
          <span class="bt-main">
            <span class="bt-title">${th.pinned ? '<span class="board-tag pin">📌 Fijado</span>' : ''}${th.locked ? '<span class="board-tag lock">🔒 Cerrado</span>' : ''}<span translate="no">${escapeHtml(th.title)}</span></span>
            <span class="bt-by muted small">por <b translate="no">${escapeHtml(th.author)}</b> · ${fmtAgo(th.t)}</span>
          </span>
          <span class="bt-count" title="Respuestas">💬 ${Math.max(0, th.count - 1)}</span>
          <span class="bt-last small"><b translate="no">${escapeHtml(th.lastBy)}</b><span class="muted">${fmtAgo(th.last)}</span></span>
        </li>`,
      )
      .join('');
    const compose = canWrite ? '<button class="primary small" data-action="board-compose">✏️ Tema nuevo</button>' : '';
    const form = canWrite
      ? `<form class="board-compose stack" data-form="board-new" ${threads.length ? 'hidden' : ''}>
          <input name="title" maxlength="${BOARD.title}" minlength="3" placeholder="Título del tema" required />
          <textarea name="text" rows="5" maxlength="${BOARD.text}" placeholder="¿Qué quieres contar?" required></textarea>
          <div class="board-actions">${threads.length ? '<button type="button" class="ghost small" data-action="board-compose">Cancelar</button>' : ''}<button class="primary small">Publicar el tema</button></div>
        </form>`
      : s.modOnly && this.#loggedIn
        ? '<p class="muted small">En los anuncios solo escribe el equipo de Aegium.</p>'
        : '';
    const list = threads.length
      ? `<div class="board-cols small muted"><span>Tema</span><span>Respuestas</span><span>Último mensaje</span></div><ul class="board-threads">${rows}</ul>`
      : '<p class="board-empty muted">Todavía no hay ningún tema en esta sección.</p>';
    this.#render(
      `${this.#crumbs([['board-home', null, 'Foro'], [null, null, `${s.icon} ${s.name}`]])}
      <header class="board-hero" style="--sec: ${s.color}">
        <span class="board-medal">${s.icon}</span>
        <div><h4>${s.name}</h4><p class="small">${s.text}</p></div>
        ${compose}
      </header>
      ${form}
      ${list}
      ${this.#loginHint()}`,
    );
  }

  async #openThread(id) {
    const data = await this.#load(`/api/board/thread?id=${id}`);
    if (!data) return;
    this.#showThread(data.thread);
  }

  #showThread(th) {
    this.view = { kind: 'thread', id: th.id, section: th.section, thread: th };
    this.data = { ...(this.data ?? {}), me: th.me, canModerate: th.canModerate };
    const s = BOARD_SECTIONS[th.section] ?? BOARD_SECTIONS.general;
    const mod = th.canModerate;
    const posts = th.posts
      .map((p, i) => {
        const tools = [
          th.me && !p.mine ? `<button class="post-tool" data-action="board-report" data-post="${p.id}" title="Denunciar el mensaje">🚩</button>` : '',
          mod && !p.mine ? `<button class="post-tool" data-action="board-mute" data-name="${escapeHtml(p.author)}" title="Silenciar a ${escapeHtml(p.author)} en el chat y el foro">🔇</button>` : '',
          p.mine || mod ? `<button class="post-tool" data-action="board-delete-post" data-post="${p.id}" title="Borrar el mensaje">🗑️</button>` : '',
        ].join('');
        const reports = p.reports ? `<span class="board-reports" title="Denuncias">🚩 ${p.reports}</span>` : '';
        const tags = [
          p.staff ? '<span class="board-tag staff">Equipo</span>' : '',
          p.author === th.author && i > 0 ? '<span class="board-tag">Autor del tema</span>' : '',
          p.mine ? '<span class="board-tag">Tú</span>' : '',
        ].join('');
        return `<article class="post${i === 0 ? ' first' : ''}" style="--who: ${nameColor(p.author)}">
          <span class="post-avatar" aria-hidden="true">${escapeHtml(initial(p.author))}</span>
          <div class="post-body">
            <div class="post-head"><b translate="no">${escapeHtml(p.author)}</b>${tags}<span class="post-meta">${reports}<span class="muted small">${i === 0 ? 'Abrió el tema' : `#${i + 1}`} · ${fmtAgo(p.t)}</span>${tools ? `<span class="post-tools">${tools}</span>` : ''}</span></div>
            <p translate="no">${text(p.text)}</p>
          </div>
        </article>`;
      })
      .join('');
    const modTools = mod
      ? `<div class="board-mod" role="group" aria-label="Moderación">
          <span class="muted small">Moderar:</span>
          <button class="ghost small" data-action="board-pin">${th.pinned ? '📌 Desfijar' : '📌 Fijar'}</button>
          <button class="ghost small" data-action="board-lock">${th.locked ? '🔓 Abrir' : '🔒 Cerrar'}</button>
          <button class="ghost small" data-action="board-move">↪ Mover</button>
          <button class="ghost small danger" data-action="board-delete" title="Borrar el tema">🗑️ Borrar</button>
        </div>`
      : '';
    const reply = th.canReply
      ? `<form class="board-reply stack" data-form="board-reply">
          <textarea name="text" rows="3" maxlength="${BOARD.text}" placeholder="Escribe tu respuesta…" required></textarea>
          <div class="board-actions"><button class="primary small">Responder</button></div>
        </form>`
      : th.me && th.locked
        ? '<p class="board-empty muted small">🔒 Este tema está cerrado: ya no admite respuestas.</p>'
        : th.me
          ? ''
          : this.#loginHint();
    const replies = th.posts.length - 1;
    this.#render(
      `${this.#crumbs([['board-home', null, 'Foro'], ['board-section', th.section, `${s.icon} ${s.name}`]])}
      <header class="board-topic" style="--sec: ${s.color}">
        <h4 class="board-title">${th.pinned ? '<span class="board-tag pin">📌 Fijado</span>' : ''}${th.locked ? '<span class="board-tag lock">🔒 Cerrado</span>' : ''}<span translate="no">${escapeHtml(th.title)}</span></h4>
        <p class="muted small">Abierto por <b translate="no">${escapeHtml(th.author)}</b> ${fmtAgo(th.t)} · ${replies} ${replies === 1 ? 'respuesta' : 'respuestas'}</p>
        ${modTools}
      </header>
      <div class="posts">${posts}</div>
      ${reply}`,
    );
  }

  /** Las migas de pan: Foro › Sección (› Tema). */
  #crumbs(items) {
    return `<nav class="board-crumbs small">${items
      .map(([action, section, label]) => (action ? `<button class="link" data-action="${action}"${section ? ` data-section="${section}"` : ''}>${label}</button>` : `<span>${label}</span>`))
      .join('<span class="muted">›</span>')}</nav>`;
  }

  #loginHint() {
    return getToken() && this.data?.me != null ? '' : '<p class="muted small board-login">🔑 Para escribir, entra con tu cuenta de Aegium (o créala gratis).</p>';
  }

  #render(body) {
    if (!this.card) return;
    this.card.innerHTML = `<div class="panel-head"><span class="panel-icon">🏛️</span><div><h3>Foro de Aegium</h3><div class="panel-lvl">La plaza de todos los que juegan</div></div>
        <button class="icon-btn" data-action="board-close" title="Cerrar">✕</button></div>
      <div class="board-body">${body}</div>`;
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  async #post(path, body) {
    try {
      return await api('POST', path, body);
    } catch (err) {
      this.#error(err.message);
      return null;
    }
  }

  #error(msg) {
    const old = this.card.querySelector('.board-error');
    old?.remove();
    const el = document.createElement('p');
    el.className = 'form-error board-error';
    el.textContent = msg;
    this.card.querySelector('.board-body')?.prepend(el);
  }

  async #click(e) {
    if (e.target === this.root) return this.close();
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const th = this.view.thread;
    switch (btn.dataset.action) {
      case 'board-close':
        return this.close();
      case 'board-compose': {
        // Abre (o cierra) el formulario del tema nuevo
        const form = this.card.querySelector('.board-compose');
        if (!form) return;
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector('input')?.focus();
        return;
      }
      case 'board-home':
        return this.#openSections();
      case 'board-section':
        return this.#openSection(btn.dataset.section);
      case 'board-thread':
        return this.#openThread(Number(btn.dataset.id));
      case 'board-pin':
      case 'board-lock': {
        const res = await this.#post(`/api/board/${btn.dataset.action.slice(6)}`, { id: th.id });
        if (res?.thread) this.#showThread(res.thread);
        return;
      }
      case 'board-move': {
        const options = Object.entries(BOARD_SECTIONS)
          .filter(([id]) => id !== th.section)
          .map(([id, s]) => ({ label: `${s.icon} ${s.name}`, value: id }));
        const section = await askChoice('¿A qué sección lo mueves?', options, { title: 'Mover el tema', icon: '↪' });
        if (!section) return;
        const res = await this.#post('/api/board/move', { id: th.id, section });
        if (res?.thread) this.#showThread(res.thread);
        return;
      }
      case 'board-delete': {
        if (!(await askConfirm('¿Borrar el tema entero? No se puede deshacer.', { title: 'Borrar el tema', icon: '🗑️', ok: 'Borrar', danger: true }))) return;
        const res = await this.#post('/api/board/delete', { id: th.id });
        if (res) await this.#openSection(th.section);
        return;
      }
      case 'board-delete-post': {
        if (!(await askConfirm('¿Borrar este mensaje? No se puede deshacer.', { title: 'Borrar el mensaje', icon: '🗑️', ok: 'Borrar', danger: true }))) return;
        const res = await this.#post('/api/board/delete-post', { id: th.id, post: Number(btn.dataset.post) });
        if (res?.deleted) await this.#openSection(th.section);
        else if (res?.thread) this.#showThread(res.thread);
        return;
      }
      case 'board-report': {
        if (!(await askConfirm('¿Denunciar este mensaje a los moderadores? Hazlo si insulta, molesta o hace trampas.', { title: 'Denunciar', icon: '🚩', ok: 'Denunciar' }))) return;
        const res = await this.#post('/api/board/report', { id: th.id, post: Number(btn.dataset.post) });
        if (res) btn.replaceWith(Object.assign(document.createElement('span'), { className: 'muted small', textContent: '🚩 Denunciado' }));
        return;
      }
      case 'board-mute': {
        const name = btn.dataset.name;
        const minutes = await askPrompt(`¿Cuántos minutos silencias a ${name} en el chat y el foro? (0 para quitárselo)`, { title: 'Silenciar', icon: '🔇', value: '60', type: 'number', min: 0, ok: 'Silenciar' });
        if (minutes == null) return;
        const res = await this.#post('/api/admin/mute', { name, minutes: Number(minutes) });
        if (res) this.#error(Number(minutes) ? `🔇 ${name} queda silenciado ${minutes} min.` : `🔈 ${name} puede volver a escribir.`);
        return;
      }
    }
  }

  async #submit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button');
    btn.disabled = true;
    const res =
      form.dataset.form === 'board-new'
        ? await this.#post('/api/board', { section: this.view.section, title: data.title, text: data.text })
        : await this.#post('/api/board/reply', { id: this.view.thread.id, text: data.text });
    btn.disabled = false;
    if (res?.thread) {
      this.#showThread(res.thread);
      this.card.querySelector('.posts .post:last-child')?.scrollIntoView({ block: 'nearest' });
    }
  }
}
