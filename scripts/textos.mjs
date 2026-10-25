// Saca los textos que se ven en pantalla (para el diccionario de idiomas, src/i18n): las cadenas y
// plantillas de los archivos dados, partidas por las etiquetas HTML, con {0}, {1}… en los ${…}.
//
//   node scripts/textos.mjs src/ui/*.js src/game/data.js index.html            → todos
//   node scripts/textos.mjs --faltan src/ui/*.js …                              → los que no están en en.js
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const onlyMissing = args.includes('--faltan');
const files = args.filter((a) => !a.startsWith('--'));
const BACKSLASH = String.fromCharCode(92);

/** Las cadenas de un archivo JS: { kind, parts: [texto, null (= ${…}), texto…] } */
function literals(src) {
  const out = [];
  let i = 0;
  const readTemplate = () => {
    // i está justo después de la comilla invertida
    const parts = [''];
    while (i < src.length) {
      const c = src[i];
      if (c === BACKSLASH) {
        parts[parts.length - 1] += src[i + 1];
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        break;
      }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        scan(1); // lo de dentro del ${…} (puede tener más cadenas)
        parts.push(null, '');
        continue;
      }
      parts[parts.length - 1] += c;
      i++;
    }
    out.push({ kind: '`', parts });
  };
  const scan = (depth) => {
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end < 0 ? src.length : end + 2;
        continue;
      }
      if (c === "'" || c === '"') {
        let s = '';
        i++;
        while (i < src.length && src[i] !== c) {
          if (src[i] === BACKSLASH) {
            s += src[i + 1];
            i += 2;
          } else s += src[i++];
        }
        i++;
        out.push({ kind: c, parts: [s] });
        continue;
      }
      if (c === '`') {
        i++;
        readTemplate();
        continue;
      }
      if (c === '/' && /[=(,:;!&|?{}[\n]\s*$/.test(src.slice(Math.max(0, i - 20), i))) {
        // Una expresión regular: se salta entera
        i++;
        let cls = false;
        while (i < src.length && (src[i] !== '/' || cls)) {
          if (src[i] === BACKSLASH) i++;
          else if (src[i] === '[') cls = true;
          else if (src[i] === ']') cls = false;
          i++;
        }
        i++;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          return;
        }
      }
      i++;
    }
  };
  scan(Infinity);
  return out;
}

/** Los trozos de texto visibles de una cadena: partida por etiquetas, con {n} en los huecos. */
function fragments(parts) {
  let n = 0;
  const joined = parts.map((p) => (p === null ? `\u0000${n++}\u0000` : p)).join('');
  // Las etiquetas cortan el texto (los atributos title/placeholder/aria-label se sacan aparte)
  const attrs = [...joined.matchAll(/(?:title|placeholder|aria-label|alt)="([^"]*)"/g)].map((m) => m[1]);
  const text = joined.replace(/<[^>]*>/g, '\u0001').split('\u0001');
  return [...text, ...attrs]
    .map((t) => t.replace(/\u0000(\d+)\u0000/g, '{$1}').replace(/\s+/g, ' ').trim())
    .filter((t) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(t.replace(/\{\d+\}/g, '')));
}

// Lo que no es texto para la gente: identificadores, clases, selectores, rutas…
const notText = (t) =>
  (/^[a-z0-9_.\-#:/[\]="'()>*+,{} ]*$/.test(t) && !/ [a-záéíóúñ]+ [a-záéíóúñ]+/.test(t)) ||
  /^(\/api\/|https?:|#|\.|\[data-|data-|aegium\.)/.test(t) ||
  /^[A-Z_]+$/.test(t);

const seen = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lits = file.endsWith('.html')
    ? [{ kind: 'html', parts: [src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')] }]
    : literals(src);
  for (const lit of lits) {
    for (const f of fragments(lit.parts)) {
      if (notText(f)) continue;
      if (!seen.has(f)) seen.set(f, file);
    }
  }
}
let dict = {};
if (onlyMissing) {
  try {
    dict = (await import(new URL('../src/i18n/en.js', import.meta.url))).default;
  } catch {}
}
const list = [...seen.keys()].filter((k) => !(k in dict));
for (const k of list) console.log(JSON.stringify(k));
console.error(`${list.length} textos`);
