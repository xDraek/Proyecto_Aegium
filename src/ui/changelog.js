import { escapeHtml } from './format.js';

// Notas de las actualizaciones, la más reciente primero. Para publicar una nueva, añádela arriba
// con un `id` distinto: a quien no la haya leído se le marca el botón 📰 de la barra de abajo.

export const CHANGELOG = [
  {
    id: '2026-10-13b',
    date: '2026-10-13',
    title: 'La Edad del Bronce',
    items: [
      '<img class="res-img" src="/ui/bronce.png" alt="🥉" /> El hierro pasa a ser <b>bronce</b>, más propio de la época, con su lingote como icono: la fundición forja lingotes de bronce y las tropas llevan armas y escudos de bronce. Lo que tenías de hierro es ahora bronce, en la misma cantidad.',
      '📰 Nuevo botón de <b>Novedades</b> en la barra de abajo, con las notas de cada actualización.',
      'El botón de lo que tienes abierto se <b>resalta</b> en la barra de abajo, y al abrir otra cosa se cierra la anterior. Pulsar otra vez el botón lo cierra.',
    ],
  },
  {
    id: '2026-10-13',
    date: '2026-10-13',
    title: 'Ajustes de equilibrio',
    items: [
      'Cancelar una obra, una investigación o un reclutamiento devuelve el <b>70 %</b> de lo pagado. Los reclutamientos también se cancelan desde el cuadro «En marcha».',
      'El mercado cobra <b>impuestos altos</b> (entre el 40 % y el 75 %): ahora compensa comerciar con otros jugadores.',
      'Las colonias se pueden <b>abandonar</b>: la isla queda libre para cualquiera.',
      'Todas las tropas y todos los barcos cobran una <b>paga en oro</b> cada hora (la élite, más). Si el oro se acaba, desertan los que más cobran.',
      'Los <b>piratas</b> crecen con tus puntos y traen barcos para desembarcar a todos sus piratas.',
      'Al saquear te llevas <b>todo lo que no protege el almacén</b>, si cabe en tus barcos.',
      'Nueva investigación: <b>Cartas náuticas</b>. Sin ella, solo puedes atacar, invadir o bloquear ciudades a menos de 300 leguas.',
      'Las investigaciones piden más cristal. <b>Equitación</b> tiene niveles: con el 2, caballería; con el 4, elefantes de guerra.',
      'Los poderes del templo tienen un <b>tiempo de espera</b> y ya no se acumulan.',
      'Los botones de misión de las islas ya no se cortan.',
    ],
  },
  {
    id: '2026-10-12',
    date: '2026-10-12',
    title: 'Barras más cómodas y torre de vigía',
    items: [
      'Arriba quedan solo los recursos; el resto de opciones pasa a una <b>barra abajo</b>. En el móvil todo ocupa mucho menos.',
      'El cuadro de lo que está <b>en marcha</b> se pliega y se despliega.',
      'En el mapa del mundo, tus flotas llevan su <b>destino y el tiempo</b> que les queda, y se ve de quién son las demás.',
      'De un ataque se sabe quién viene y cuándo llega, pero qué tropas trae solo cuando entra en el alcance de tu <b>torre de vigía</b> (más alcance cuanto más nivel).',
    ],
  },
  {
    id: '2026-10-12-gestas',
    date: '2026-10-12',
    title: 'Gestas de la Liga',
    items: [
      'Eventos cooperativos contra enemigos de leyenda: <b>Tifón</b>, la <b>Armada del Gran Rey</b> y la <b>Hidra de Lerna</b>. Solo caen si combaten varios imperios a la vez.',
      'Fragua de Hefesto, chat de la gesta, calendario y estatuas para quienes vencen.',
    ],
  },
  {
    id: '2026-10-09',
    date: '2026-10-09',
    title: 'Combate naval y guerra entre jugadores',
    items: [
      'Los ataques van en <b>dos fases</b>: primero la batalla naval y, con el mar libre, el desembarco. Las tropas que no caben en los barcos que se hunden se ahogan.',
      'Se pueden <b>bloquear puertos</b> e <b>invadir ciudades</b> de otros jugadores, con protección para quien acaba de librarse.',
      'Guía del juego por capítulos, sonido de martillazos al construir y muchas mejoras en la isla: puerto de piedra, astillero, calles empedradas, embarcaderos y animales.',
    ],
  },
];

/** La última nota que ha visto este navegador (para marcar el botón si hay una nueva). */
const SEEN_KEY = 'imperium.newsSeen';

export function hasUnreadNews() {
  try {
    return localStorage.getItem(SEEN_KEY) !== CHANGELOG[0].id;
  } catch {
    return false;
  }
}

export function markNewsRead() {
  try {
    localStorage.setItem(SEEN_KEY, CHANGELOG[0].id);
  } catch {
    // sin almacenamiento: se volverá a marcar
  }
}

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function newsHtml() {
  const entries = CHANGELOG.map(
    (e, i) => `<article class="news-entry${i === 0 ? ' latest' : ''}">
      <header><h4>${escapeHtml(e.title)}</h4><time datetime="${e.date}">${dateFmt.format(new Date(`${e.date}T12:00:00`))}</time></header>
      <ul>${e.items.map((it) => `<li>${it}</li>`).join('')}</ul>
    </article>`,
  ).join('');
  return `<div class="modal-card">
    <div class="panel-head"><span class="panel-icon">📰</span><div><h3>Novedades</h3><div class="panel-lvl">Lo que ha cambiado en las últimas actualizaciones</div></div>
      <button class="icon-btn" data-action="close-modal" title="Cerrar">✕</button></div>
    <div class="news">${entries}</div>
  </div>`;
}
