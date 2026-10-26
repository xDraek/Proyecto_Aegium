import { escapeHtml, resIcons } from './format.js';

// Ventanas de confirmar, pedir un dato o avisar con el marco de Aegium, en lugar de las del
// navegador (confirm, prompt, alert). Devuelven una promesa: se usan con await.
// Van por encima de todo (también de las ventanas del juego). Enter acepta, Escape cancela y
// pulsar fuera es como cancelar.

let current = null;

function close(value) {
  if (!current) return;
  const { root, resolve, keys, before } = current;
  current = null;
  window.removeEventListener('keydown', keys, true);
  root.remove();
  // El foco vuelve a donde estaba (el botón que abrió la pregunta), si sigue en la página
  if (before?.isConnected) before.focus({ preventScroll: true });
  resolve(value);
}

/**
 * La ventana: título con icono, texto, un campo opcional y botones.
 * @param {{ title?: string, icon?: string, text: string, input?: object, buttons: { label: string, value: any, kind?: string }[], cancelValue: any }} o
 */
function open({ title, icon, text, input, buttons, cancelValue }) {
  // Si ya había una abierta, se da por cancelada
  if (current) close(current.cancelValue);
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'dialog';
    const head = title
      ? `<div class="panel-head"><span class="panel-icon">${resIcons(icon ?? '❔')}</span><div><h3>${escapeHtml(title)}</h3></div></div>`
      : '';
    const field = input
      ? `<input class="dialog-input" type="${input.type ?? 'text'}" ${input.type === 'number' ? 'inputmode="numeric"' : ''} ${input.min != null ? `min="${input.min}"` : ''} ${input.max != null ? `max="${input.max}"` : ''} ${input.maxLength ? `maxlength="${input.maxLength}"` : ''} ${input.readOnly ? 'readonly' : ''} placeholder="${escapeHtml(input.placeholder ?? '')}" value="${escapeHtml(input.value ?? '')}" />`
      : '';
    const body = escapeHtml(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${resIcons(line)}</p>`)
      .join('');
    root.innerHTML = `<div class="modal-card narrow dialog-card" role="dialog" aria-modal="true">
      ${head}
      <div class="dialog-text">${body}</div>
      ${field}
      <div class="dialog-actions">${buttons
        .map((b, i) => `<button type="button" class="${b.kind ?? 'ghost'}" data-i="${i}">${escapeHtml(b.label)}</button>`)
        .join('')}</div>
    </div>`;

    const field$ = root.querySelector('.dialog-input');
    const valueOf = (b) => (b.value === INPUT ? field$.value : b.value);
    const primary = buttons.find((b) => b.kind && b.kind !== 'ghost') ?? buttons[buttons.length - 1];

    root.addEventListener('click', (e) => {
      if (e.target === root) return close(cancelValue);
      const btn = e.target.closest('button[data-i]');
      if (btn) close(valueOf(buttons[Number(btn.dataset.i)]));
    });
    // Mientras está abierta, el teclado es suyo: ni atajos del juego ni el Escape de otras ventanas
    const keys = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close(cancelValue);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const focused = document.activeElement?.closest?.('.dialog button[data-i]');
        close(valueOf(focused ? buttons[Number(focused.dataset.i)] : primary));
      } else e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', keys, true);

    current = { root, resolve, keys, cancelValue, before: document.activeElement };
    document.body.appendChild(root);
    if (field$) {
      field$.focus();
      field$.select();
    } else root.querySelector(`button[data-i="${buttons.indexOf(primary)}"]`)?.focus();
  });
}

/** Marca de «el valor es lo escrito en el campo». */
const INPUT = Symbol('input');

/**
 * ¿Sí o no? Resuelve true si acepta.
 * @param {string} text
 * @param {{ title?: string, icon?: string, ok?: string, cancel?: string, danger?: boolean }} [opts]
 */
export function askConfirm(text, { title, icon, ok = 'Aceptar', cancel = 'Cancelar', danger = false } = {}) {
  return open({
    title,
    icon,
    text,
    cancelValue: false,
    buttons: [
      { label: cancel, value: false },
      { label: ok, value: true, kind: danger ? 'danger' : 'primary' },
    ],
  });
}

/**
 * Pedir un texto o un número. Resuelve lo escrito, o null si cancela.
 * @param {string} text
 * @param {{ title?: string, icon?: string, value?: string, placeholder?: string, type?: string, min?: number, max?: number, maxLength?: number, ok?: string, cancel?: string|null, readOnly?: boolean }} [opts]
 */
export function askPrompt(text, { title, icon, value = '', placeholder, type, min, max, maxLength, ok = 'Aceptar', cancel = 'Cancelar', readOnly = false } = {}) {
  const buttons = [{ label: ok, value: INPUT, kind: 'primary' }];
  if (cancel) buttons.unshift({ label: cancel, value: null });
  return open({ title, icon, text, input: { value, placeholder, type, min, max, maxLength, readOnly }, cancelValue: null, buttons });
}

/**
 * Elegir entre varias opciones. Resuelve el `value` de la elegida, o null si cancela.
 * @param {string} text
 * @param {{ label: string, value: any }[]} options
 * @param {{ title?: string, icon?: string, cancel?: string }} [opts]
 */
export function askChoice(text, options, { title, icon, cancel = 'Cancelar' } = {}) {
  return open({
    title,
    icon,
    text,
    cancelValue: null,
    buttons: [{ label: cancel, value: null }, ...options.map((o, i) => ({ label: o.label, value: o.value, kind: i === 0 ? 'primary' : 'ghost' }))],
  });
}

/** Un aviso con un solo botón. */
export function showAlert(text, { title, icon, ok = 'Entendido' } = {}) {
  return open({ title, icon, text, cancelValue: undefined, buttons: [{ label: ok, value: undefined, kind: 'primary' }] });
}
