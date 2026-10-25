// Idiomas. El juego está escrito en español; en inglés se traduce lo que sale en pantalla con un
// diccionario español → inglés (en.js): cada texto de la página (y los title, placeholder y
// aria-label) se busca tal cual o en sus plantillas con huecos, «Mejorar a nivel {0}». Así se
// traduce también lo que llega ya escrito del servidor (noticias, informes, errores…).
//
// Lo que escriben los jugadores (chat, foros, correo, nombres) no se toca: va dentro de
// translate="no" o de la clase .notranslate.

const KEY = 'aegium.lang';
export const LANGS = { es: 'Español', en: 'English' };

function savedLang() {
  try {
    const l = localStorage.getItem(KEY);
    if (l && LANGS[l]) return l;
  } catch {}
  return 'es';
}

export const LANG = savedLang();

// Cada diccionario se descarga solo si se elige su idioma
const DICTS = { en: () => import('./en.js') };

/** Cambia el idioma (se recarga la página para que todo salga ya en el nuevo). */
export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  location.reload();
}

let exact = new Map();
let patterns = [];
const cache = new Map();
const MAX_CACHE = 20000;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** Prepara el diccionario: las entradas con {n} se convierten en plantillas con huecos. */
function compile(dict) {
  exact = new Map();
  patterns = [];
  // Un hueco al principio o al final suele ser un icono (que va en su propia etiqueta y deja el
  // texto aparte): «{0} Barcos en el puerto» sirve también para «Barcos en el puerto»
  const entries = Object.entries(dict);
  for (const [es, en] of Object.entries(dict)) {
    const k = norm(es);
    const strip = (s) => norm(s.replace(/^\{\d+\}\s*/, '').replace(/\s*\{\d+\}$/, ''));
    const short = strip(k);
    if (short !== k && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(short.replace(/\{\d+\}/g, '')) && !(short in dict)) {
      const lead = /^\{(\d+)\}/.exec(k)?.[1];
      const trail = /\{(\d+)\}$/.exec(k)?.[1];
      let e = en;
      for (const n of [lead, trail]) if (n != null) e = e.split(`{${n}}`).join(' ');
      entries.push([short, norm(e)]);
    }
  }
  for (const [es, en] of entries) {
    const key = norm(es);
    if (!/\{\d+\}/.test(key)) {
      exact.set(key, en);
      continue;
    }
    const order = [];
    const source = key
      .split(/(\{\d+\})/)
      .map((part) => {
        const m = /^\{(\d+)\}$/.exec(part);
        if (!m) return escapeRe(part);
        order.push(Number(m[1]));
        return '(.+?)';
      })
      .join('');
    // Lo que tiene más texto fijo, primero (es más concreto). Las plantillas casi sin texto fijo
    // («{0} · {1} de {2}») se comerían frases que no son suyas: no se usan (con uno o dos huecos
    // basta una palabra corta, «{0} Es {1}.»)
    const literal = key.replace(/\{\d+\}/g, '').length;
    const letters = key.replace(/\{\d+\}/g, '').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, '').length;
    if (letters < (order.length >= 3 ? 4 : 2)) continue;
    patterns.push({ re: new RegExp(`^${source}$`, 's'), order, en, literal });
  }
  patterns.sort((a, b) => b.literal - a.literal);
}

const LETTER = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/;

/** Busca un texto (sin espacios de más alrededor) en el diccionario; null si no lo encuentra. */
function lookup(core, depth) {
  const exactly = exact.get(core);
  if (exactly !== undefined) return exactly;
  for (const p of patterns) {
    const m = p.re.exec(core);
    if (!m) continue;
    // Lo que va en los huecos también se traduce si es un texto conocido (un edificio, una tropa…)
    const values = m.slice(1).map((v) => (depth < 3 ? tr(v, depth + 1) : v));
    return p.en.replace(/\{(\d+)\}/g, (_, n) => values[p.order.indexOf(Number(n))] ?? '');
  }
  if (depth >= 3) return null;
  // Un icono o signos alrededor («🪓 Campamento bárbaro ·», «La pantalla →»): se traduce lo de dentro
  const affix = /^([^A-Za-zÁÉÍÓÚáéíóúÑñ¿¡]*)(.*?)([^A-Za-zÁÉÍÓÚáéíóúÑñ]*)$/s.exec(core);
  if (affix && (affix[1] || affix[3]) && LETTER.test(affix[2])) {
    const inner = lookup(affix[2], depth + 1);
    if (inner != null) return affix[1] + inner + affix[3];
  }
  // «1 de 3»
  const ofN = /^(\d[\d.,]*) de (\d[\d.,]*)$/.exec(core);
  if (ofN) return `${ofN[1]} of ${ofN[2]}`;
  // Un nombre con su nivel o cantidad detrás: «Puerto 3»
  const num = /^(.*\D) (\d[\d.,]*)$/s.exec(core);
  if (num) {
    const head = lookup(num[1], depth + 1);
    if (head != null) return `${head} ${num[2]}`;
  }
  // Listas: «Puerto 3, Astillero 1 y Navegación 2», «Tu isla · hace 1 h», «Nada → +8 % de comida»
  const parts = core.split(/(, | y | · | → )/);
  if (parts.length > 1) {
    let changed = false;
    const out = parts.map((part, i) => {
      if (i % 2) return part === ' y ' ? ' and ' : part;
      const t = LETTER.test(part) ? lookup(part, depth + 1) : null;
      if (t == null) return part;
      changed = true;
      return t;
    });
    if (changed) return out.join('');
  }
  return null;
}

/** La traducción de un texto, o el mismo texto si no está en el diccionario. */
export function tr(text, depth = 0) {
  if (LANG === 'es' || text == null) return text;
  const s = String(text);
  const core = norm(s);
  if (!core || !LETTER.test(core)) return s;
  let out = cache.get(core);
  if (out === undefined) {
    out = lookup(core, depth);
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(core, out);
  }
  if (out == null) return s;
  // Se respetan los espacios de alrededor (separan el texto de las etiquetas vecinas)
  const lead = /^\s*/.exec(s)[0];
  const trail = /\s*$/.exec(s)[0];
  return lead + out + trail;
}

// ── La página ──────────────────────────────────────────────────────────────────────────────

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'KBD']);
const done = new WeakMap(); // nodo → lo último que le pusimos (para no traducirlo otra vez)

const skipped = (el) => !el || el.closest?.('[translate="no"], .notranslate');

function translateText(node) {
  const value = node.nodeValue;
  if (done.get(node) === value) return;
  const parent = node.parentElement;
  if (!parent || SKIP.has(parent.tagName) || skipped(parent)) return;
  const out = tr(value);
  done.set(node, out);
  if (out !== value) node.nodeValue = out;
}

function translateAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const out = tr(v);
    if (out !== v) el.setAttribute(a, out);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.tagName) || skipped(root)) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.ELEMENT_NODE) return SKIP.has(n.tagName) || n.getAttribute('translate') === 'no' || n.classList.contains('notranslate') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n);
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) if (!skipped(el)) translateAttrs(el);
}

/** Con el inglés elegido: carga el diccionario y traduce la página (y todo lo que vaya apareciendo). */
export async function startTranslation() {
  document.documentElement.lang = LANG;
  // Los selectores de idioma (en la portada y en Ajustes)
  for (const select of document.querySelectorAll('select[name="lang"]')) {
    select.value = LANG;
    select.addEventListener('change', () => setLang(select.value));
  }
  if (LANG === 'es') return;
  const { default: dict } = await DICTS[LANG]();
  compile(dict);
  // Para buscar desde la consola lo que falta por traducir en la pantalla abierta (y probar textos)
  window.__faltan = missingTexts;
  window.__tr = tr;
  document.title = tr(document.title);
  translateTree(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateText(r.target);
      else if (r.type === 'attributes') {
        if (!skipped(r.target)) translateAttrs(r.target);
      } else for (const n of r.addedNodes) translateTree(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Las ventanas del navegador (confirmar, preguntar, avisar)
  const { alert, confirm, prompt } = window;
  window.alert = (msg) => alert.call(window, tr(msg));
  window.confirm = (msg) => confirm.call(window, tr(msg));
  window.prompt = (msg, def) => prompt.call(window, tr(msg), def);
}

/** Para encontrar lo que falta por traducir: los textos en pantalla que no están en el diccionario. */
export function missingTexts(root = document.body) {
  const out = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName) || skipped(p) || p.closest('[hidden]')) continue;
    const t = norm(n.nodeValue);
    if (/[a-záéíóúñ]{3}/i.test(t) && /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|con|para|tu|tus|en|por|se|un|una|y)\b/i.test(t) && tr(t) === t) out.add(t);
  }
  return [...out];
}
