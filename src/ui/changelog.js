import { escapeHtml } from './format.js';

// Notas de las actualizaciones, la más reciente primero. Para publicar una nueva, añádela arriba
// con un `id` distinto: a quien no la haya leído se le marca el botón 📰 de la barra de abajo.

export const CHANGELOG = [
  {
    id: '2026-10-14k',
    date: '2026-10-14',
    title: 'El favor de los dioses',
    items: [
      '🛕 El <b>templo</b> llega como mucho al <b>nivel 10</b>, y a partir del nivel 6 cada nivel da 3 de favor por hora en vez de 6.',
      '🔓 Los poderes se <b>desbloquean con el nivel del templo</b>: Cosecha abundante (1), Inspiración (2), Viento favorable (4), Égida (6) e Ira de los dioses (8).',
      '🙏 Los <b>poderes divinos</b> cuestan más: Cosecha 110, Inspiración 90, Viento favorable 130, Égida 140 e Ira de los dioses 220.',
      'Las recompensas de favor bajan un poco (regalo del día 7: 20; las tres tareas del día: 15; peregrinos: 20; altar de la niebla: 35) y ya <b>no pasan del tope</b> del templo.',
    ],
  },
  {
    id: '2026-10-14j',
    date: '2026-10-14',
    title: 'Bárbaros que se reconstruyen',
    items: [
      '🪓 De los campamentos, ciudades bárbaras, piratas y el Kraken ya no ves en directo su guarnición ni su botín: solo <b>lo último que sabes</b> (tu último bote explorador o tu último ataque) y hace cuánto. Si ha habido combates desde entonces, te avisa.',
      '🔨 Si alguien acaba con toda la guarnición, <b>se están reconstruyendo</b>: no se ve qué tienen y nadie puede atacarlos hasta que se rearman. Las flotas que lleguen mientras tanto vuelven sin combatir.',
    ],
  },
  {
    id: '2026-10-14i',
    date: '2026-10-14',
    title: 'Mapas',
    items: [
      '🌊 Al alejar mucho la vista del archipiélago ya no se ve el borde del mar.',
      '🧭 En el mapa del mundo, el círculo marca ahora hasta dónde llegan tus flotas de guerra (300 leguas). Con <b>Cartas náuticas</b> desaparece y el mapa te recuerda que llegas a cualquier ciudad.',
    ],
  },
  {
    id: '2026-10-14h',
    date: '2026-10-14',
    title: 'Nuevo logo',
    items: [
      '🏛️ <b>Imperivm</b> estrena logo: la columna dorada entre laureles. También es el icono de la pestaña del navegador.',
      'Las imágenes del juego se guardan en tu navegador y ya no se descargan en cada visita: entra más rápido.',
    ],
  },
  {
    id: '2026-10-14g',
    date: '2026-10-14',
    title: 'El Coloso de Rodas',
    items: [
      '🗽 El <b>Coloso</b> estrena aspecto: a horcajadas sobre dos torres almenadas, con la antorcha en alto, corona de rayos, banda al pecho y el manto en la mano. Terminado (nivel 10), luce el bronce verdoso de la pátina y se adorna de oro.',
    ],
  },
  {
    id: '2026-10-14f',
    date: '2026-10-14',
    title: 'El juego va más fluido',
    items: [
      '⚡ La ciudad y el mapa se dibujan con muchas menos piezas (más de la mitad menos en la isla y unas cinco veces menos en el mapa): el juego va más suelto, sobre todo en el móvil.',
      'En el mapa, de lejos, ya no se dibujan la hierba, las flores, los animales ni los vecinos (no se distinguían). En calidad baja hay la mitad de hierba.',
    ],
  },
  {
    id: '2026-10-14e',
    date: '2026-10-14',
    title: 'La milicia',
    items: [
      '🔱 El lancero ahora es la <b>Milicia con lanza</b> y el hondero, el <b>Hondero miliciano</b>: ya no cobran paga en oro, pero comen el doble (🥖 2/h).',
      '🪙 Arqueros, espadachines, hoplitas, caballeros y arqueros cretenses cobran <b>0,2 de oro más por hora</b>, y las catapultas, 0,4 más.',
    ],
  },
  {
    id: '2026-10-14d',
    date: '2026-10-14',
    title: 'Ajustes contra trampas',
    items: [
      '🌫️ <b>Expediciones</b>: solo una a la vez, la flota pasa 2 h explorando la niebla y solo trae lo que <b>cabe en su bodega</b> (un bote explorador ya no vuelve cargado de oro). Los barcos abandonados que encuentras, como mucho tantos como barcos llevas.',
      '⚖️ <b>Comprar oro en el mercado</b> sale a la mitad (como mucho, un 30 % de su valor): el oro escasea.',
      '🛡️ La protección de los débiles (menos del 20 % de tus puntos) se mantiene <b>también en guerra</b>.',
      'Las <b>ofertas entre jugadores</b> no se pueden publicar ni aceptar de vacaciones o con el puerto en manos enemigas.',
      '🏴‍☠️ Mientras tengas protección de novato, los <b>piratas</b> vienen a media fuerza.',
    ],
  },
  {
    id: '2026-10-14c',
    date: '2026-10-14',
    title: 'Más protección para los nuevos y obras con bronce y cristal',
    items: [
      '🛡️ La <b>protección de novato</b> dura hasta los 1.000 puntos (antes, 100), como mucho tus 5 primeros días.',
      'Nadie puede atacar, sabotear, bloquear ni invadir a quien tenga <b>menos del 20 % de sus puntos</b>, salvo si estáis en guerra o si el débil le atacó primero (en las últimas 48 h).',
      'Las obras cuestan un 15 % menos de madera y piedra, pero <b>desde el nivel 7 piden también bronce y cristal</b>: la mina y la fundición vuelven a hacer falta.',
      'El <b>almacén</b> esconde ahora al menos el 8 % de lo que cabe en él: con un almacén grande, un saqueo ya no se lo lleva casi todo.',
      'Los <b>arqueros cretenses</b> aguantan más: 30 de vida (antes, 17).',
      'Las investigaciones de producción, <b>Arquitectura, Logística, Navegación y Comercio llegan al nivel 20</b>, con la mitad de efecto por nivel: al máximo dan lo mismo que antes, pero hay mucho más camino. Si ya las tenías, tu nivel se ha duplicado (no pierdes nada). Los barcos y las expediciones piden ahora el doble de nivel de Navegación (el mismo efecto).',
      '<b>Herrería y Armaduras</b> siguen en 10 niveles, pero los últimos cuestan bastante más.',
    ],
  },
  {
    id: '2026-10-14b',
    date: '2026-10-14',
    title: 'Dar de baja tropas y barcos',
    items: ['Puedes <b>dar de baja</b> tropas y barcos desde la ventana del ⚔️ ejército (la ✖ de cada tarjeta): dejan de comer y de cobrar, y recuperas el 20 % de la madera, la comida y el bronce que costaron (del resto, nada). Si tienes mercenarios de esa unidad, se van ellos primero, y por ellos no se recupera nada.'],
  },
  {
    id: '2026-10-14',
    date: '2026-10-14',
    title: 'El oro escasea y vuelven los elefantes',
    items: [
      '<b>Ninguna colonia da oro</b>. Las tierras y colonias que lo daban pasan a dar 💎 cristal, con una producción equivalente.',
      'El <b>mercado</b> da la mitad de oro por hora que antes.',
      '<b>Comercio</b>, <b>Herrería</b> y <b>Armaduras</b> dan la mitad de bonificación: +5 % por nivel (Comercio también mejora menos los cambios del mercado).',
      'Vuelve la <b>Doma de elefantes</b> 🐘: hace falta para entrenar elefantes de guerra y se investiga con Equitación 4. Cuesta bastante más que antes. Si ya tenías Equitación 4, la tienes hecha.',
      'Todas las <b>investigaciones</b> cuestan un 25 % más, salvo el <b>oro</b>, que ahora escasea: de oro piden menos que antes.',
    ],
  },
  {
    id: '2026-10-13e',
    date: '2026-10-13',
    title: 'Cartas náuticas: a cualquier rincón',
    items: [
      'Con <b>Cartas náuticas</b> ya puedes llegar de verdad a cualquier ciudad del archipiélago: en el 🌍 mapa del mundo, pulsa una ciudad lejana y luego <b>⚓ Ir</b>. Aparece en tu mapa y puedes atacarla, espiarla, invadirla o bloquearla. Antes las que estaban fuera de lo que ves decían «Fuera del alcance de tus barcos».',
      'Las ciudades de tu alianza se pueden traer igual, aunque no tengas las cartas.',
    ],
  },
  {
    id: '2026-10-13d',
    date: '2026-10-13',
    title: 'Espionaje por botes',
    items: [
      'Ya <b>no hace falta espiar</b> una ciudad para atacarla (aunque a ciegas te puedes llevar un susto).',
      'Cuantos <b>más botes</b> mandes a espiar, más averiguan: con 1, recursos y muralla; con 2, sus barcos; con 3, sus tropas; con 4, sus defensas; con 5, los refuerzos de sus aliados y sus mejoras militares. Pero también es <b>más fácil que los vean</b>, y si los descubren los hunden todos.',
      'La <b>torre de vigía</b> protege contra los espías poco a poco: un 2,5 % por nivel, hasta un 50 % en el nivel 20. La muralla ya no cuenta para descubrir espías (sí para los saboteadores).',
      'A los <b>saboteadores</b> los pillan como mucho un 65 % de las veces (antes, un 85 %).',
      'En el <b>móvil</b> ya no se montan los menús de abajo: los botones de la cámara, el cuadro «En marcha» y los paneles quedan siempre encima de la lista, y los avisos salen arriba, bajo los recursos.',
      'El botón <b>✕ de cerrar</b> ya no se pierde en el móvil: la cabecera de paneles y ventanas se queda fija al desplazar, el panel ya no crece por debajo de los recursos cuando se ve la barra del navegador, y con el móvil en horizontal se abre a pantalla completa.',
      'El lingote de <b>bronce</b> se ve bien en el mercado (los desplegables de recursos son nuevos, con sus iconos), en los informes y en los avisos.',
    ],
  },
  {
    id: '2026-10-13c',
    date: '2026-10-13',
    title: 'Lista de la izquierda plegable',
    items: ['La lista de edificios (y la de islas en el mapa) se <b>pliega</b> desde su cabecera para ver más de la isla. Se recuerda cómo la dejaste, y plegada sigue avisando con 🔨 si hay una obra en marcha.'],
  },
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
