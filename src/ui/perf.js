// Medidor de rendimiento: un recuadro con lo que cuesta dibujar el juego (imágenes por segundo,
// órdenes de dibujo, triángulos, memoria…). Oculto: se abre con Alt + P o con ?perf en la dirección,
// y al pulsarlo copia los números (para que un jugador los pegue al avisar de que le va mal).

const KEY = 'aegium.perf';
/** Un fotograma que tarda más que esto se cuenta como tirón. */
const HITCH_MS = 50;

const flag = {
  read() {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  },
  write(on) {
    try {
      if (on) sessionStorage.setItem(KEY, '1');
      else sessionStorage.removeItem(KEY);
    } catch {
      // sin almacenamiento
    }
  },
};

export function createPerfMeter(world) {
  const info = world.renderer.info;
  let el = null;
  let on = false;
  let t0 = 0; // cuándo empezó el fotograma que se está midiendo
  let lastEnd = 0; // cuándo acabó el anterior
  let shownAt = 0;
  // Lo acumulado desde la última vez que se pintó el recuadro
  let frames = 0;
  let work = 0;
  let workMax = 0;
  let gapMax = 0;
  let gapAvg = 0; // (lo normal entre dos imágenes: con una ventana abierta o en calidad baja se dibujan menos)
  let calls = 0;
  let triangles = 0;
  const hitches = []; // (momentos de los tirones del último minuto)
  let text = '';

  const num = (n) => Math.round(n).toLocaleString('es-ES');

  function show(now) {
    const secs = (now - shownAt) / 1000;
    const c = world.renderer.domElement;
    const islands = Object.values(world.islands ?? {});
    let meshes = 0;
    world.scene.traverseVisible((o) => (o.isMesh || o.isPoints || o.isLine || o.isSprite) && meshes++);
    while (hitches.length && now - hitches[0] > 60000) hitches.shift();
    const heap = performance.memory ? `${num(performance.memory.usedJSHeapSize / 1e6)} MB` : 'no disponible';
    const rows = [
      ['Imágenes por segundo', `${num(frames / secs)}`],
      ['Trabajo por imagen', `${(work / Math.max(1, frames)).toFixed(1)} ms (máx. ${workMax.toFixed(0)})`],
      ['Espera más larga', `${gapMax.toFixed(0)} ms`],
      ['Tirones (último minuto)', `${hitches.length}`],
      ['Órdenes de dibujo', num(calls / Math.max(1, frames))],
      ['Triángulos', num(triangles / Math.max(1, frames))],
      ['Piezas a la vista', num(meshes)],
      ['Geometrías · texturas', `${num(info.memory.geometries)} · ${num(info.memory.textures)}`],
      ['Sombreadores', `${info.programs?.length ?? 0}`],
      ['Memoria del juego', heap],
      ['Lienzo', `${c.width}×${c.height} (×${world.renderer.getPixelRatio().toFixed(2)})`],
      ['Calidad · vista', `${world.high ? 'alta' : 'baja'} · ${world.view}`],
      ['Islas a la vista', `${islands.filter((e) => e.group.visible).length} de ${islands.length}`],
    ];
    text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    el.querySelector('pre').textContent = rows.map(([k, v]) => `${k.padEnd(24)} ${v}`).join('\n');
    shownAt = now;
    frames = work = workMax = gapMax = calls = triangles = 0;
  }

  function set(value) {
    if (on === value) return;
    on = value;
    flag.write(on);
    // (con el compositor hay varias pasadas por imagen: se suman todas y se pone a cero a mano)
    info.autoReset = !on;
    if (!on) {
      el?.remove();
      el = null;
      return;
    }
    el = document.createElement('div');
    el.id = 'perf';
    el.title = 'Pulsa para copiar los números · Alt + P para cerrarlo';
    el.innerHTML = '<b>Rendimiento</b><pre>Midiendo…</pre>';
    el.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`Aegium · rendimiento\n${text}\n${navigator.userAgent}`);
        el.classList.add('copied');
        setTimeout(() => el?.classList.remove('copied'), 900);
      } catch {
        // sin permiso para copiar
      }
    });
    document.body.appendChild(el);
    lastEnd = gapAvg = 0;
    shownAt = performance.now();
    frames = work = workMax = gapMax = calls = triangles = 0;
  }

  if (flag.read() || new URLSearchParams(location.search).has('perf')) set(true);

  return {
    get on() {
      return on;
    },
    toggle: () => set(!on),
    /** Antes de mover y dibujar el juego. */
    begin() {
      if (!on) return;
      info.reset();
      t0 = performance.now();
    },
    /** Después de dibujarlo. */
    end() {
      if (!on) return;
      const now = performance.now();
      const took = now - t0;
      const gap = lastEnd ? now - lastEnd : 0;
      lastEnd = now;
      frames++;
      work += took;
      workMax = Math.max(workMax, took);
      gapMax = Math.max(gapMax, gap);
      if (gap > HITCH_MS && gapAvg && gap > gapAvg * 2.2 && gap < 2000) hitches.push(now);
      if (gap && gap < 2000) gapAvg = gapAvg ? gapAvg + (gap - gapAvg) * 0.1 : gap;
      calls += info.render.calls;
      triangles += info.render.triangles;
      if (now - shownAt >= 500) show(now);
    },
  };
}
