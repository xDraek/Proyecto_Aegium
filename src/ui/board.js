import { BOARD, BOARD_SECTIONS } from '../game/data.js';
import { api, getToken } from '../net/api.js';
import { askChoice, askConfirm, askPrompt } from './dialog.js';
import { escapeHtml, fmtAgo } from './format.js';

// El foro de la comunidad: una ventana propia (no la del HUD) para que se pueda abrir también desde
// la portada, sin cuenta. Tiene tres vistas: las secciones, los temas de una sección y un tema.
// Lo que escriben los jugadores va con translate="no" (no se traduce).

const text = (s) => escapeHtml(s).replace(/\n/g, '<br />');

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
        const last = info.last ? `<span class="muted small board-last">Último: <span translate="no">«${escapeHtml(info.last.title)}»</span> · ${escapeHtml(info.last.by)}, ${fmtAgo(info.last.t)}</span>` : '<span class="muted small board-last">Aún no hay temas</span>';
        return `<li class="board-section${info.unread ? ' unread' : ''}" data-action="board-section" data-section="${id}">
          <span class="board-icon">${s.icon}</span>
          <span class="board-info"><b>${s.name}</b>${info.unread ? ` <span class="badge-inline">${info.unread}</span>` : ''}<span class="small">${s.text}</span>${last}</span>
          <span class="muted small">${info.threads} ${info.threads === 1 ? 'tema' : 'temas'}</span></li>`;
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
    const rows = (data.threads ?? [])
      .map(
        (th) => `<li data-action="board-thread" data-id="${th.id}" class="${th.unread ? 'unread' : ''}">
          <span class="who" translate="no">${th.pinned ? '📌 ' : ''}${th.locked ? '🔒 ' : ''}${escapeHtml(th.title)}</span>
          <span class="muted small">${th.count} ${th.count === 1 ? 'mensaje' : 'mensajes'} · ${escapeHtml(th.lastBy)}, ${fmtAgo(th.last)}</span></li>`,
      )
      .join('');
    const form = canWrite
      ? `<details class="new-thread" ${rows ? '' : 'open'}>
          <summary>✏️ Abrir un tema nuevo</summary>
          <form class="stack" data-form="board-new">
            <input name="title" maxlength="${BOARD.title}" minlength="3" placeholder="Título" required />
            <textarea name="text" rows="5" maxlength="${BOARD.text}" placeholder="¿Qué quieres contar?" required></textarea>
            <button class="primary small auto">Publicar</button>
          </form>
        </details>`
      : s.modOnly && this.#loggedIn
        ? '<p class="muted small">En los anuncios solo escriben los moderadores.</p>'
        : '';
    this.#render(
      `<div class="thread-head"><button class="ghost small" data-action="board-home">← Secciones</button><h4>${s.icon} ${s.name}</h4></div>
      <p class="desc small">${s.text}</p>
      ${form}
      ${rows ? `<ul class="mail-list forum-list">${rows}</ul>` : '<p class="muted">Todavía no hay ningún tema.</p>'}
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
          p.mine || mod ? `<button class="link small" data-action="board-delete-post" data-post="${p.id}" title="Borrar el mensaje">🗑️</button>` : '',
          th.me && !p.mine ? `<button class="link small" data-action="board-report" data-post="${p.id}" title="Denunciar el mensaje">🚩</button>` : '',
          mod && !p.mine ? `<button class="link small" data-action="board-mute" data-name="${escapeHtml(p.author)}" title="Silenciar a ${escapeHtml(p.author)} en el chat y el foro">🔇</button>` : '',
        ].join('');
        const reports = p.reports ? `<span class="board-reports" title="Denuncias">🚩 ${p.reports}</span>` : '';
        return `<article class="post${i === 0 ? ' first' : ''}"><div class="post-head"><b translate="no">${escapeHtml(p.author)}</b><span class="muted small">${fmtAgo(p.t)} ${reports}${tools}</span></div><p translate="no">${text(p.text)}</p></article>`;
      })
      .join('');
    const modTools = mod
      ? `<div class="row-actions board-mod">
          <button class="ghost small" data-action="board-pin">${th.pinned ? 'Desfijar' : '📌 Fijar'}</button>
          <button class="ghost small" data-action="board-lock">${th.locked ? '🔓 Abrir' : '🔒 Cerrar'}</button>
          <button class="ghost small" data-action="board-move">↪ Mover</button>
          <button class="ghost small" data-action="board-delete" title="Borrar el tema">🗑️ Borrar</button>
        </div>`
      : '';
    const reply = th.canReply
      ? `<form class="stack" data-form="board-reply">
          <textarea name="text" rows="3" maxlength="${BOARD.text}" placeholder="Escribe tu respuesta…" required></textarea>
          <button class="primary small auto">Responder</button>
        </form>`
      : th.me && th.locked
        ? '<p class="muted small">🔒 Este tema está cerrado.</p>'
        : th.me
          ? ''
          : this.#loginHint();
    this.#render(
      `<div class="thread-head"><button class="ghost small" data-action="board-section" data-section="${th.section}">← ${s.icon} ${s.name}</button></div>
      <h4 class="board-title">${th.pinned ? '📌 ' : ''}${th.locked ? '🔒 ' : ''}<span translate="no">${escapeHtml(th.title)}</span></h4>
      ${modTools}
      <div class="posts">${posts}</div>
      ${reply}`,
    );
  }

  #loginHint() {
    return getToken() && this.data?.me != null ? '' : '<p class="muted small board-login">Para escribir, entra con tu cuenta de Aegium (o créala gratis).</p>';
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
