import { RESOURCE_KEYS, RESOURCES } from '../game/data.js';

// Desplegable de recursos con sus iconos. Un <select> solo admite texto y el bronce tiene de
// icono una imagen (el lingote), así que se elige con este: un campo oculto con el `name` de
// siempre (se lee con `.value` como el select) y un botón que abre la lista. La lista vive en
// <body>, así que sobrevive a que el panel se vuelva a pintar mientras está abierta.

const face = (r) => `${RESOURCES[r].icon}<span>${RESOURCES[r].name}</span><i aria-hidden="true">▾</i>`;

export function resPicker(name, selected, label) {
  return `<span class="res-pick"><input type="hidden" name="${name}" value="${selected}" /><button type="button" class="res-pick-btn" data-res-pick="${name}" aria-haspopup="listbox" aria-expanded="false" aria-label="${label}">${face(selected)}</button></span>`;
}

/** Pone en cada botón el recurso de su campo (tras restaurar lo que había elegido el jugador). */
export function syncResPickers(root) {
  for (const btn of root.querySelectorAll('.res-pick-btn')) {
    const r = btn.parentElement.querySelector('input').value;
    if (RESOURCES[r] && btn.dataset.shown !== r) {
      btn.innerHTML = face(r);
      btn.dataset.shown = r;
    }
  }
}

let pop = null;

function close() {
  if (!pop) return;
  document.querySelector(`.res-pick-btn[data-res-pick="${pop.dataset.name}"]`)?.setAttribute('aria-expanded', 'false');
  pop.remove();
  pop = null;
}

function open(btn) {
  const name = btn.dataset.resPick;
  const current = btn.parentElement.querySelector('input').value;
  pop = document.createElement('div');
  pop.className = 'res-pop';
  pop.setAttribute('role', 'listbox');
  pop.dataset.name = name;
  pop.innerHTML = RESOURCE_KEYS.map(
    (r) => `<button type="button" role="option" data-res="${r}" aria-selected="${r === current}" class="${r === current ? 'on' : ''}">${RESOURCES[r].icon}<span>${RESOURCES[r].name}</span></button>`,
  ).join('');
  document.body.appendChild(pop);
  place();
  pop.querySelector('.on')?.focus();
}

/**
 * Pone la lista debajo de su botón (o encima si no cabe). Se vuelve a llamar al desplazarse o
 * cuando el panel se repinta (el botón es otro); si el botón ya no está, la lista se cierra.
 */
function place() {
  const btn = document.querySelector(`.res-pick-btn[data-res-pick="${pop.dataset.name}"]`);
  const rect = btn?.getBoundingClientRect();
  if (!rect?.width) return close();
  btn.setAttribute('aria-expanded', 'true');
  const h = pop.offsetHeight;
  const below = rect.bottom + 4 + h <= window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom')) || 0);
  pop.style.minWidth = `${rect.width}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - h)}px`;
}

function choose(r) {
  const name = pop.dataset.name;
  close();
  const input = document.querySelector(`.res-pick input[name="${name}"]`);
  if (!input || input.value === r) return;
  input.value = r;
  syncResPickers(input.parentElement);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Se llama una vez al arrancar la interfaz. */
export function installResPickers() {
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('.res-pop [data-res]');
    if (opt) return choose(opt.dataset.res);
    const btn = e.target.closest('.res-pick-btn');
    const was = pop?.dataset.name;
    close();
    if (btn && was !== btn.dataset.resPick) open(btn);
  });
  document.addEventListener('keydown', (e) => {
    if (!pop) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...pop.querySelectorAll('[data-res]')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  }, true);
  // Si se mueve lo de debajo (o se repinta el panel), la lista sigue a su botón
  const follow = () => pop && requestAnimationFrame(() => pop && place());
  window.addEventListener('resize', follow);
  document.addEventListener('scroll', follow, true);
  new MutationObserver(follow).observe(document.body, { childList: true, subtree: true });
}
