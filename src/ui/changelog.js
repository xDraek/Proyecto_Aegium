import { LANG } from '../i18n/index.js';
import { escapeHtml, resIcons } from './format.js';

// Notas de las actualizaciones, la más reciente primero. Para publicar una nueva, añádela arriba
// con un `id` distinto: a quien no la haya leído se le marca el botón 📰 de la barra de abajo.
// Con `en: { title, items }` sale también en inglés (las que no lo tienen se ven en español).

export const CHANGELOG = [
  {
    id: '2026-10-29a',
    date: '2026-10-29',
    title: 'Las ciudades bárbaras, renovadas',
    items: [
      '🏰 Las ciudades bárbaras de los continentes tienen un aspecto nuevo: un gran anillo de estacas con flejes de hierro y puntas de hueso, la puerta de troncos con el estandarte de la calavera de toro, el gran salón con los cuernos y la calavera en el tejado, tres atalayas con tejado rojo y cuernos, tiendas, puestos de mercado, la hoguera y sus guerreros. Las conquistadas lucen los colores de su dueño.',
    ],
    en: {
      title: 'Barbarian cities, renewed',
      items: [
        '🏰 Barbarian cities on the continents have a new look: a great ring of stakes with iron bands and bone tips, the log gate with the bull-skull banner, the great hall with horns and a skull on the roof, three watchtowers with red roofs and horns, tents, market stalls, the campfire and their warriors. Conquered ones wear their owner’s colours.',
      ],
    },
  },
  {
    id: '2026-10-28i',
    date: '2026-10-28',
    title: 'Los bárbaros, renovados',
    items: [
      '🪓 Los campamentos bárbaros tienen un aspecto nuevo: el gran salón de troncos con las vigas cruzadas, cuernos y una piel echada sobre el tejado, dos atalayas con antorcha, estandartes rojos, tiendas de piel, la hoguera con su anillo de piedras, empalizadas de estacas afiladas y armeros con lanzas.',
      '🛡️ Y sus guerreros también: a pecho descubierto y con pintura de guerra, melena con moño y barba larga, capa de pieles con collar de colmillos, la maza de pinchos empuñada y el escudo redondo de tablas con su emblema rojo.',
      '🏹 Los bárbaros tienen ahora sus propios arqueros (antes llevaban los griegos): con las mismas fuerzas, el arco con vendas rojas y púas de hueso y el carcaj a la espalda. Hacen guardia en lo alto de las atalayas de los campamentos.',
      '🐻 Nueva élite bárbara, el berserker: en plena furia, con un hacha de bronce en cada mano, mucho ataque y poca armadura. Es de espadas, así que castiga a las lanzas. Los campamentos de nivel 3, las ciudadelas y las hordas cambian unos cuantos bárbaros por berserkers del mismo valor.',
    ],
    en: {
      title: 'Barbarians, renewed',
      items: [
        '🪓 Barbarian camps have a new look: the great log hall with crossed beams, horns and a hide thrown over the roof, two watchtowers with torches, red banners, hide tents, the campfire with its ring of stones, palisades of sharpened stakes and spear racks.',
        '🛡️ And so are their warriors: bare-chested with war paint, a topknot and a long beard, a fur cloak with a fang necklace, the spiked club in hand and the round plank shield with its red emblem.',
        '🏹 Barbarians now have their own archers (they used the Greek ones before): same strength, a bow with red wraps and bone spikes and a quiver on the back. They stand guard on top of the camps’ watchtowers.',
        '🐻 A new barbarian elite, the berserker: in full fury, with a bronze axe in each hand, lots of attack and little armour. It counts as swords, so it punishes spears. Level-3 camps, citadels and hordes swap some barbarians for berserkers of the same worth.',
      ],
    },
  },
  {
    id: '2026-10-28h',
    date: '2026-10-28',
    title: 'Un combate con más táctica',
    items: [
      '🛡️ Vanguardia y retaguardia: los de distancia (honderos, arqueros) y las catapultas forman detrás. El enemigo golpea sobre todo a la vanguardia, y a la retaguardia solo le llega una parte mientras su vanguardia aguante: un muro de hoplitas protege a tus arqueros, y un ejército solo de arqueros cae enseguida.',
      '⚔️ Ventajas entre clases (+50 % de daño): las lanzas contra la caballería, los espadachines contra las lanzas y la caballería contra los de distancia y las catapultas. En el mar, los brulotes hacen +100 % a quinquerremes y dromones, y las liburnas +50 % a brulotes y trirremes.',
      '🏹 El primer asalto: los de distancia sueltan la mitad de su disparo y la caballería la mitad de su embestida antes que nadie, y lo que cae ahí ya no responde. La caballería carga con +25 % (salvo contra las lanzas, que frenan la carga).',
      '📋 Cada ficha de tropa dice su clase, su puesto y contra quién es fuerte o débil; los informes, la ventaja que más pesó en cada bando; y la guía lo explica todo en «Cómo se combate». El simulador ya calcula con estas reglas.',
      '⚖️ Las tropas no cambian de ataque ni de vida: lo que cambia es que la composición importa. Un ejército mezclado y bien pensado pierde menos; uno solo de cuerpo a cuerpo, algo más contra quien lleva arqueros.',
    ],
    en: {
      title: 'Combat with more tactics',
      items: [
        '🛡️ Vanguard and rearguard: ranged units (slingers, archers) and catapults form at the back. The enemy strikes mostly at the vanguard, and the rearguard only gets part of it while its vanguard holds: a wall of hoplites protects your archers, and an army of archers alone falls at once.',
        '⚔️ Class advantages (+50 % damage): spears against cavalry, swordsmen against spears and cavalry against ranged units and catapults. At sea, fireships deal +100 % to quinqueremes and dromons, and liburnas +50 % to fireships and triremes.',
        '🏹 The first round: ranged units loose half their shots and cavalry half its onslaught before anyone else, and whatever falls there no longer answers. Cavalry charges with +25 % (except against spears, which stop the charge).',
        '📋 Each troop card shows its class, its position and what it is strong or weak against; reports show the advantage that weighed most on each side; and the guide explains it all in «How combat works». The simulator already uses these rules.',
        '⚖️ Troops keep their attack and health: what changes is that composition matters. A mixed, well-thought-out army loses less; a melee-only one, somewhat more against enemies with archers.',
      ],
    },
  },
  {
    id: '2026-10-28g',
    date: '2026-10-28',
    title: 'Avisos importantes, a la vista',
    items: [
      '🐙 Cuando el Kraken despierta, el aviso sale resaltado en el chat, con un botón «📍 Ver la zona» que abre el mapa donde lo han visto los marineros.',
      '🐙 Mientras siga despierto y se le pueda derrotar, sale su icono arriba a la derecha, junto a la temporada y el favor. Al pulsarlo se abre el chat en el aviso que dice dónde lo han visto.',
      '📣 Los demás avisos importantes también salen resaltados en el chat, cada uno con su color: las gestas de la Liga (Tifón, Hidra, Armada) en oro, las hordas bárbaras en rojo y las temporadas del archipiélago en turquesa. Los de las gestas llevan también un botón «📍 Ver en el mapa» que abre su continente.',
      '📊 La barra de recursos ya no se descuadra con cifras grandes: a partir del millón se escriben en millones (por ejemplo 50M o 1,25M; la cifra exacta, al pasar el ratón) y la producción muy alta abreviada (+125k/h). En pantallas medianas todo va un poco más junto para que nada se corte.',
    ],
    en: {
      title: 'Important notices, in sight',
      items: [
        '🐙 When the Kraken wakes up, the notice stands out in the chat, with a «📍 See the area» button that opens the map where sailors have seen it.',
        '🐙 While it stays awake and can be defeated, its icon appears at the top right, next to the season and the favour. Press it to open the chat at the notice that says where it was seen.',
        '📣 The other important notices also stand out in the chat, each with its own colour: League feats (Typhon, Hydra, Armada) in gold, barbarian hordes in red and archipelago seasons in turquoise. The feat notices also have a «📍 View on the map» button that opens their continent.',
        '📊 The resource bar no longer gets thrown off by big numbers: from a million on they are written in millions (for example 50M or 1,25M; the exact figure on hover) and very high production is shortened (+125k/h). On medium screens everything sits a bit closer so nothing gets cut off.',
      ],
    },
  },
  {
    id: '2026-10-28f',
    date: '2026-10-28',
    title: 'Poderes del templo',
    items: [
      '🦉 Inspiración también acelera el reclutamiento: las tropas del cuartel y los barcos del puerto que estén en cola salen un 30 % antes, igual que la obra y la investigación en curso.',
      '🌬️ Viento favorable ahora dura hora y media: las flotas que ya están en el mar se ahorran la mitad de lo que les queda, y todas las que zarpes mientras esté activo van y vuelven al doble de rápido. Ya no hace falta tener flotas navegando para invocarlo.',
      '⚡ La Ira de los dioses se convierte en la Furia de Zeus: durante 2 horas tus tropas y barcos tienen +25 % de ataque al atacar, en las batallas que libres mientras dure y con las flotas que zarpen mientras esté activa (aunque lleguen después). Es la pareja de la Égida, que protege al defender.',
    ],
    en: {
      title: 'Temple powers',
      items: [
        '🦉 Inspiration also speeds up recruitment: the queued troops in the barracks and ships in the port come out 30 % sooner, just like the construction and research in progress.',
        '🌬️ Favourable wind now lasts an hour and a half: fleets already at sea save half of what they have left, and every fleet you send while it’s active goes and comes back twice as fast. You no longer need fleets at sea to invoke it.',
        '⚡ Wrath of the gods becomes Fury of Zeus: for 2 hours your troops and ships get +25 % attack when attacking, in the battles you fight while it lasts and with the fleets that set sail while it’s active (even if they arrive later). It’s the counterpart of the Aegis, which protects when defending.',
      ],
    },
  },
  {
    id: '2026-10-28e',
    date: '2026-10-28',
    title: 'Los tratos del mercado viajan en barco',
    items: [
      '⚖️ Las ofertas del mercado entre jugadores ya no se cambian al instante: al cerrar un trato, los barcos mercantes de cada uno zarpan hacia la ciudad del otro con su parte. Los recursos llegan cuando atracan, y los barcos no vuelven a estar libres hasta que regresan a tu puerto. Verás sus rutas en el mapa.',
      '🛥 Para publicar una oferta necesitas barcos mercantes libres (uno por cada 500 de carga): se quedan esperando en el puerto con la mercancía hasta que alguien acepta, y vuelven si la retiras o caduca. Para aceptar una, los mercantes que lleven el pago.',
      '⚓ Los mercaderes de un trato no ocupan una de tus flotas ni se pueden hacer volver: un trato cerrado no se deshace.',
      '⛓️ Una ciudad ocupada o con el puerto bloqueado no puede comerciar en el mercado: ni cambiar recursos ni publicar o aceptar ofertas. Sus ofertas salen marcadas y nadie las puede aceptar hasta que el puerto quede libre.',
    ],
    en: {
      title: 'Market deals travel by ship',
      items: [
        '⚖️ Market offers between players are no longer swapped instantly: when a deal is closed, each side’s merchant ships set sail for the other’s city with their part. The resources arrive when they dock, and the ships aren’t free again until they’re back in your port. You’ll see their routes on the map.',
        '🛥 To post an offer you need free merchant ships (one for every 500 of cargo): they wait in the port with the goods until someone accepts, and come back if you withdraw it or it expires. To accept one, you need the merchant ships to carry the payment.',
        '⚓ A deal’s merchants don’t take up one of your fleets and can’t be recalled: a closed deal can’t be undone.',
        '⛓️ An occupied city or one with a blockaded port can’t trade at the market: no exchanging resources, posting or accepting offers. Its offers are marked and nobody can accept them until the port is free again.',
      ],
    },
  },
  {
    id: '2026-10-28d',
    date: '2026-10-28',
    title: 'Aviso de actualizaciones',
    items: [
      '🆕 Cuando salga una actualización con el juego abierto, te avisará al momento y se marcará 📰, sin tener que recargar la página. Al pulsarlo, se carga la versión nueva y te enseña lo que ha cambiado.',
    ],
    en: {
      title: 'Update notices',
      items: [
        '🆕 When an update comes out while you have the game open, you’ll be told right away and 📰 will light up, with no need to reload the page. Press it to load the new version and see what’s changed.',
      ],
    },
  },
  {
    id: '2026-10-28c',
    date: '2026-10-28',
    title: 'Las fortalezas piratas, renovadas',
    items: [
      '🏴‍☠️ Las fortalezas piratas tienen un aspecto nuevo: un recinto de piedra almenado sobre las peñas, dos torres con brasero y bandera negra, el templo saqueado con su frontón de la calavera, el mercadillo bajo un toldo negro y un muelle de madera con el corsario amarrado junto a la grúa.',
    ],
    en: {
      title: 'Pirate fortresses, renewed',
      items: [
        '🏴‍☠️ Pirate fortresses have a new look: a crenellated stone keep on the rocks, two towers with braziers and black flags, the plundered temple with its skull pediment, a market under a black awning and a wooden pier with the corsair moored beside the crane.',
      ],
    },
  },
  {
    id: '2026-10-28b',
    date: '2026-10-28',
    title: 'Mejor en el móvil',
    items: [
      '📱 En el móvil, la pantalla ya no se descuadra (ampliada o desplazada) al escribir una cantidad o al abrir el chat. El chat ya no saca el teclado nada más abrirlo: sale al tocar el campo para escribir.',
      '⚔️ Al reclutar tropas o botar barcos, el contador vuelve a 0: así se ve al momento que ya han salido.',
    ],
    en: {
      title: 'Better on mobile',
      items: [
        '📱 On mobile, the screen no longer gets thrown off (zoomed in or shifted) when typing an amount or opening the chat. The chat no longer pops up the keyboard as soon as it opens: it appears when you tap the field to type.',
        '⚔️ When you recruit troops or launch ships, the counter goes back to 0, so you can see right away that they’re on their way.',
      ],
    },
  },
  {
    id: '2026-10-28a',
    date: '2026-10-28',
    title: 'Pequeños arreglos',
    items: [
      '🏝️ Los nombres de las islas concuerdan («Islote Negro», «Isla Roja», «Prado Salvaje») y ya no se repiten en el archipiélago: cada fosa del Kraken tiene el suyo (Fosa de Caribdis, de Escila…). Las colonias se llaman como su isla.',
      '📜 Los <b>encargos de hoy</b> ya no dicen «los tres» cuando solo tienes dos, y el favor del premio solo se promete si tienes templo (sin templo no se podía guardar).',
      '⚔️ Reclutar con la cantidad a 0 ya no recluta una tropa. En el puerto, el botón dice «Botar», y en el Ejército se lee «Hondero miliciano × 2».',
      '⌨️ Escape cierra también el panel de una isla aunque estés escribiendo en él. El simulador te lleva al resultado al simular. La paga de oro pequeña sale como «−0,1» y no «−0». Fundar una alianza sin nombre avisa.',
    ],
    en: {
      title: 'Small fixes',
      items: [
        '🏝️ Island names now agree in gender and number and are no longer repeated across the archipelago: each Kraken trench has its own (Trench of Charybdis, of Scylla…). Colonies are named after their island.',
        '📜 <b>Today’s tasks</b> no longer say “all three” when you only have two, and the favor in the prize is only promised if you have a temple (without one it couldn’t be stored).',
        '⚔️ Recruiting with the amount at 0 no longer recruits a unit. In the port, the button says “Launch”, and the Army shows “Slinger × 2”.',
        '⌨️ Escape also closes an island’s panel even while you’re typing in it. The simulator takes you to the result when you simulate. Small gold upkeep shows as “−0.1” instead of “−0”. Founding an alliance without a name now warns you.',
      ],
    },
  },
  {
    id: '2026-10-27j',
    date: '2026-10-27',
    title: 'Las fosas del Kraken, rehechas',
    items: [
      '🐙 Las <b>fosas del Kraken</b> tienen un aspecto nuevo: una isla en forma de media luna que abraza un <b>golfo</b> de aguas negras y hondas, la guarida del Kraken. En el fondo del golfo, medio sepultadas por el agua, están las <b>ruinas de una ciudad hundida</b>: columnas que salen del mar, una escalinata que baja al agua y la estatua de Poseidón hundida hasta el pecho. En la bocana, un barco que no logró salir.',
      '🌿 La isla parece de verdad: costa irregular con entrantes y salientes, cabos redondeados a la entrada del golfo, laderas suaves, lomas, hierba, bosquecillos de olivos, pinos y cipreses, y rocas en tierra, en la playa y entre las olas.',
      '🔱 Ya no las guardan corsarios: entre las ruinas viven los <b>tritones</b>, con tridente y cola de pez, y sus <b>hipocampos</b> de guerra, medio caballo y medio pez. Son igual de fuertes que los de antes, y los que quedaban en cada fosa siguen ahí.',
      '👁️ Si tu último bote vio al Kraken en una fosa, lo verás allí: emerge en el centro del golfo, mirando al mar, con los tentáculos sobre las ruinas.',
    ],
    en: {
      title: 'The Kraken’s trenches, remade',
      items: [
        '🐙 The <b>Kraken’s trenches</b> have a new look: a crescent-shaped island embracing a <b>gulf</b> of black, deep waters, the Kraken’s lair. At the back of the gulf, half buried by the water, lie the <b>ruins of a sunken city</b>: columns rising from the sea, a stairway down into the water and the statue of Poseidon sunk up to its chest. At the mouth, a ship that never made it out.',
        '🌿 The island looks real: an irregular coastline with inlets and headlands, rounded capes at the entrance of the gulf, gentle slopes, knolls, grass, groves of olive trees, pines and cypresses, and rocks inland, on the beach and among the waves.',
        '🔱 They are no longer guarded by corsairs: the <b>tritons</b> live among the ruins, with tridents and fish tails, and their war <b>hippocampi</b>, half horse and half fish. They are just as strong as before, and those left in each trench are still there.',
        '👁️ If your last boat saw the Kraken in a trench, you will see it there: it rises in the middle of the gulf, facing the sea, with its tentacles over the ruins.',
      ],
    },
  },
  {
    id: '2026-10-27i',
    date: '2026-10-27',
    title: 'Los bárbaros crecen contigo',
    items: [
      '📈 Los <b>campamentos bárbaros</b>, las <b>ciudades bárbaras</b>, los <b>piratas</b> y los corsarios de las <b>fosas</b> ya no se quedan pequeños: sus guerreros y su botín <b>crecen con tu ciudad</b> (con lo que producen tus edificios). Así saquearlos merece la pena toda la partida, no solo los primeros días. Cada jugador los ve a su medida; el Kraken sigue con sus propios niveles.',
      '🪓 Los dos campamentos más pequeños dan más botín: hasta <b>2500</b> y <b>4500</b> (antes 1500 y 3200), con los mismos bárbaros.',
      '🔨 Cuando una isla arrasada se rearma, vuelve con <b>la mitad de su botín</b> en vez de vacía: ya no llegas a un campamento sin nada porque un vecino lo saqueó antes.',
      '🔭 Lo que viste con tus botes antes de este cambio está desfasado: <b>vuelve a explorar</b> antes de atacar. Las flotas que ya estaban en el mar luchan contra los bárbaros de antes.',
    ],
    en: {
      title: 'Barbarians grow with you',
      items: [
        '📈 <b>Barbarian camps</b>, <b>barbarian cities</b>, <b>pirates</b> and the corsairs of the <b>trenches</b> no longer fall behind: their warriors and their loot <b>grow with your city</b> (with what your buildings produce). That way raiding them is worth it all game long, not just in the first days. Each player sees them at their own scale; the Kraken keeps its own levels.',
        '🪓 The two smallest camps give more loot: up to <b>2500</b> and <b>4500</b> (before 1500 and 3200), with the same barbarians.',
        '🔨 When a razed island rearms, it comes back with <b>half its loot</b> instead of empty: you no longer reach a camp with nothing because a neighbour raided it first.',
        '🔭 What your boats saw before this change is out of date: <b>explore again</b> before attacking. Fleets that were already at sea fight the old barbarians.',
      ],
    },
  },
  {
    id: '2026-10-27h',
    date: '2026-10-27',
    title: 'El simulador ya no se inventa un Kraken',
    items: [
      '🎲 En el <b>simulador de combate</b> el defensor llevaba siempre un Kraken de más (el nivel del Kraken se contaba también como tropa), así que las batallas salían mucho más duras de lo que eran. Arreglado.',
      '🐙 El campo «Nivel del Kraken» solo aparece cuando pones algún Kraken en el defensor.',
    ],
    en: {
      title: 'The simulator no longer invents a Kraken',
      items: [
        '🎲 In the <b>combat simulator</b> the defender always had an extra Kraken (the Kraken’s level was also counted as a unit), so battles came out much harder than they really were. Fixed.',
        '🐙 The “Kraken level” field only shows up when you add a Kraken to the defender.',
      ],
    },
  },
  {
    id: '2026-10-27g',
    date: '2026-10-27',
    title: 'Una cosa a la vez',
    items: [
      '🏛️ Un edificio que trabaja no puede estar en obras a la vez: mientras la <b>academia</b> investiga no se puede mejorar, y mientras se mejora no se puede investigar.',
      '⚔️ Lo mismo con el <b>cuartel</b> (si está entrenando tropas) y el <b>puerto</b> (si está botando barcos): primero termina lo que tienen entre manos, o cancélalo, y luego se mejoran. Si están en obras, no reclutan hasta que acaben.',
      '🔨 El resto de edificios se pueden seguir mejorando mientras tanto, como siempre.',
    ],
    en: {
      title: 'One thing at a time',
      items: [
        '🏛️ A building that is working can’t be under construction at the same time: while the <b>academy</b> is researching it can’t be upgraded, and while it’s being upgraded it can’t research.',
        '⚔️ The same goes for the <b>barracks</b> (if they’re training troops) and the <b>port</b> (if it’s launching ships): first finish what they’re doing, or cancel it, and then upgrade them. While under construction, they don’t recruit until it’s done.',
        '🔨 Every other building can still be upgraded in the meantime, as always.',
      ],
    },
  },
  {
    id: '2026-10-27f',
    date: '2026-10-27',
    title: 'Un mapa del mundo más vivo',
    items: [
      '⛵ Tus <b>flotas en el mar</b> salen en el mapa del mundo con su ruta, y avanzan mientras lo miras. Las flotas enemigas que vienen hacia ti se ven en rojo. Pasa por encima de un barco (o púlsalo) para ver adónde va y cuánto le falta.',
      '🏝️ Las islas tienen ahora su costa y sus bajíos, y de cerca se ve qué hay en cada una (🪓 bárbaros, ☠️ piratas, 🏺 ruinas, 🌴 deshabitada…). Las ciudades llevan el emblema de su estandarte.',
      '👁️ Debajo del mapa puedes <b>ocultar capas</b>: islas, flotas, nombres o las ciudades de cada bando. Se recuerda para la próxima vez. La leyenda completa está plegada en «Leyenda».',
      '🧭 Al buscar a alguien o ir a unas coordenadas, el mapa viaja hasta allí poco a poco, y una rosa de los vientos marca el norte.',
    ],
    en: {
      title: 'A livelier world map',
      items: [
        '⛵ Your <b>fleets at sea</b> now show on the world map with their route, and they move while you watch. Enemy fleets heading for you are shown in red. Hover over a ship (or tap it) to see where it’s going and how long it has left.',
        '🏝️ Islands now have their coastline and shallows, and up close you can see what’s on each one (🪓 barbarians, ☠️ pirates, 🏺 ruins, 🌴 uninhabited…). Cities carry the emblem from their banner.',
        '👁️ Below the map you can <b>hide layers</b>: islands, fleets, names or the cities of each side. It’s remembered for next time. The full legend is folded under “Legend”.',
        '🧭 When you search for someone or go to some coordinates, the map glides there, and a compass rose marks north.',
      ],
    },
  },
  {
    id: '2026-10-27e',
    date: '2026-10-27',
    title: 'El móvil, más limpio',
    items: [
      '📱 La barra de abajo tiene ahora cinco botones grandes y con su nombre: <b>Mapa</b> (o Mi isla), <b>Ejército</b>, <b>Misiones</b>, <b>Chat</b> y <b>Más</b>. En «Más» están el correo, la alianza, los amigos, la clasificación, el mapa del mundo, los informes, las novedades y las opciones; si hay algo nuevo dentro, sale un punto rojo.',
      '🏛️ Al abrir un edificio, una isla, el chat o las opciones, la lista de abajo se aparta y lo abierto ocupa todo el alto de la pantalla.',
      '🧭 La cámara se mueve con los dedos (uno arrastra, dos acercan y giran), así que de sus botones solo queda el de centrar la vista.',
    ],
    en: {
      title: 'A cleaner mobile view',
      items: [
        '📱 The bottom bar now has five big, labelled buttons: <b>Map</b> (or My island), <b>Army</b>, <b>Quests</b>, <b>Chat</b> and <b>More</b>. “More” holds mail, alliance, friends, rankings, the world map, reports, news and options; if there’s something new inside, a red dot shows up.',
        '🏛️ When you open a building, an island, the chat or the options, the list at the bottom steps aside and what you opened takes the full height of the screen.',
        '🧭 The camera moves with your fingers (one drags, two zoom and rotate), so only the recenter button is left.',
      ],
    },
  },
  {
    id: '2026-10-27d',
    date: '2026-10-27',
    title: 'El Kraken, más esquivo y más fuerte',
    items: [
      '🐙 El Kraken ya no se queda para siempre en la misma fosa: si en <b>6 horas</b> nadie lo derrota, se sumerge (se avisa en el chat) y al cabo de un rato asoma en <b>otra fosa</b> distinta.',
      '🧭 Las coordenadas del aviso son más <b>aproximadas</b>: puede estar hasta a 4 casillas de lo que dicen los marineros, así que toca explorar más para dar con él.',
      '💪 Cada vez que alguien lo derrota, despierta <b>más fuerte</b>: sube un nivel y gana un 50 % más de ataque y de vida que al principio. Tus botes exploradores te dicen su nivel, y el simulador lo tiene en cuenta.',
    ],
    en: {
      title: 'The Kraken, more elusive and stronger',
      items: [
        '🐙 The Kraken no longer stays forever in the same trench: if nobody defeats it within <b>6 hours</b>, it dives (announced in the chat) and after a while surfaces in <b>another trench</b>.',
        '🧭 The warning coordinates are more <b>approximate</b>: it can be up to 4 squares from where sailors say, so you’ll have to explore more to find it.',
        '💪 Every time someone defeats it, it wakes up <b>stronger</b>: it goes up a level and gains 50 % more attack and health than at first. Your scout boats tell you its level, and the simulator takes it into account.',
      ],
    },
  },
  {
    id: '2026-10-27c',
    date: '2026-10-27',
    title: 'El mapa ya no cierra la página en el iPhone',
    items: [
      '📱 Al explorar el mapa desde el móvil (sobre todo en iPhone), la página podía cerrarse sola con «ha generado problemas repetidamente». El juego guardaba en memoria las ciudades, campamentos y ruinas de todas las islas del archipiélago, aunque estuvieran lejísimos, y las que ibas visitando. Ahora solo construye las que tienes cerca y suelta las que dejas atrás, así que la memoria no crece por mucho que recorras el mapa.',
    ],
    en: {
      title: 'The map no longer crashes the page on iPhone',
      items: ['📱 When exploring the map on mobile (especially iPhone), the page could close by itself with “a problem repeatedly occurred”. The game kept in memory the cities, camps and ruins of every island in the archipelago, however far away, plus the ones you visited. Now it only builds the ones near you and releases the ones you leave behind, so memory no longer grows however much you roam the map.'],
    },
  },
  {
    id: '2026-10-27b',
    date: '2026-10-27',
    title: 'Las ofertas del mercado, en el chat',
    items: [
      '⚖️ Cuando alguien publica una oferta en el mercado del archipiélago, sale un aviso en el chat general con lo que da y lo que pide, y un botón <b>Ver ofertas</b> que te lleva directo al mercado.',
      '💬 Para no llenar el chat, cada jugador anuncia como mucho una oferta cada 10 minutos (las demás se ven igual en el mercado).',
    ],
    en: {
      title: 'Market offers, in the chat',
      items: [
        '⚖️ When someone posts an offer on the archipelago market, a notice appears in the general chat with what they give and what they ask for, and a <b>See offers</b> button that takes you straight to the market.',
        '💬 To keep the chat tidy, each player announces at most one offer every 10 minutes (the rest still show up in the market).',
      ],
    },
  },
  {
    id: '2026-10-27a',
    date: '2026-10-27',
    title: 'Nuevo icono del faro',
    items: [
      '🪔 El faro tenía de icono una torre moderna; ahora es una lámpara de aceite con su llama, como el fuego que ardía en lo alto del faro de Alejandría.',
    ],
    en: {
      title: 'New lighthouse icon',
      items: ['🪔 The lighthouse had a modern tower as its icon; now it’s an oil lamp with its flame, like the fire that burned atop the Lighthouse of Alexandria.'],
    },
  },
  {
    id: '2026-10-26s',
    date: '2026-10-26',
    title: 'Novedades enteras en el móvil',
    items: [
      '📱 En el móvil, el texto de las novedades se salía por la derecha y se cortaba (sobre todo con la letra del teléfono grande). Ahora cabe entero, y si no hay sitio la fecha baja debajo del título.',
    ],
    en: {
      title: 'Full news on mobile',
      items: ['📱 On mobile, the news text spilled off the right and got cut off (especially with a large phone font). Now it fits completely, and if there’s no room the date moves below the title.'],
    },
  },
  {
    id: '2026-10-26r',
    date: '2026-10-26',
    title: 'Lluvia nueva, y menos a menudo',
    items: [
      '🌧️ La lluvia es nueva: cada gota cae a su ritmo, con su estela, inclinada por el viento (que en las tormentas sopla fuerte y a rachas), y sobre el mar se abren pequeñas salpicaduras. Con el cielo cubierto el sol ya no centellea en el agua.',
      '⛅ Llueve menos: más o menos una media hora de cada diez, y las tormentas son raras.',
    ],
    en: {
      title: 'New rain, and less often',
      items: [
        '🌧️ The rain is new: each drop falls at its own pace, with its trail, slanted by the wind (which blows hard and in gusts during storms), and small splashes open on the sea. Under an overcast sky the sun no longer glints on the water.',
        '⛅ It rains less: roughly one half-hour in ten, and storms are rare.',
      ],
    },
  },
  {
    id: '2026-10-26q',
    date: '2026-10-26',
    title: 'Tu tropa, en la ventana de dar de baja',
    items: [
      '🪖 Al dar de baja tropas o barcos, la ventana muestra en su medallón el modelo de esa unidad en pequeño, en vez de un emoji.',
    ],
    en: {
      title: 'Your unit, in the dismiss window',
      items: ['🪖 When dismissing troops or ships, the window shows a small model of that unit in its medallion instead of an emoji.'],
    },
  },
  {
    id: '2026-10-26p',
    date: '2026-10-26',
    title: 'Tarjetas del ejército más claras',
    items: [
      '🥖 En la ventana del ejército, cada tropa y barco muestra ahora también la comida que consume por hora, junto al ataque, la vida y la paga.',
      '🪙 La moneda de oro de la paga salía metida en un recuadro dorado como si fuera un retrato: ahora se ve limpia. Y si los datos no caben en una línea, baja cada uno entero con su icono, en vez de quedarse el icono arriba y el número abajo.',
    ],
    en: {
      title: 'Clearer army cards',
      items: [
        '🥖 In the army window, each troop and ship now also shows the food it eats per hour, next to attack, health and pay.',
        '🪙 The gold coin for pay appeared inside a golden box as if it were a portrait: now it looks clean. And if the stats don’t fit on one line, each one moves down whole with its icon, instead of the icon staying above and the number below.',
      ],
    },
  },
  {
    id: '2026-10-26o',
    date: '2026-10-26',
    title: 'Cabecera de las ventanas sin huecos',
    items: [
      '🖥️ En el ordenador, al bajar por una ventana larga (clasificación, novedades…) la cabecera se quedaba un poco por debajo del borde y por encima asomaban las pestañas y filas que pasaban por detrás. Ahora se pega arriba del todo.',
    ],
    en: {
      title: 'Window headers without gaps',
      items: ['🖥️ On desktop, when scrolling a long window (rankings, news…) the header stuck slightly below the edge and the tabs and rows passing behind peeked out above it. Now it sticks right to the top.'],
    },
  },
  {
    id: '2026-10-26n',
    date: '2026-10-26',
    title: 'Preguntas con el estilo de Aegium',
    items: [
      '🏛️ Las preguntas de «¿Seguro?» y las que te piden un dato (dar de baja tropas, vender una reliquia, abandonar una colonia, dejar la alianza, irte de vacaciones, declarar la guerra…) ya no son las ventanas grises del navegador: salen con el marco de Aegium, con su título y botones claros. Enter acepta y Escape cancela.',
      '📢 Al compartir un informe eliges el chat con un botón (general, alianza o gesta) en lugar de ir respondiendo «Cancelar».',
    ],
    en: {
      title: 'Questions in Aegium style',
      items: [
        '🏛️ “Are you sure?” questions and those asking for a value (dismissing troops, selling a relic, abandoning a colony, leaving the alliance, going on vacation, declaring war…) are no longer the grey browser windows: they appear with the Aegium frame, a title and clear buttons. Enter accepts and Escape cancels.',
        '📢 When sharing a report you pick the chat with a button (general, alliance or feat) instead of answering “Cancel”.',
      ],
    },
  },
  {
    id: '2026-10-26m',
    date: '2026-10-26',
    title: 'El marco del menú de opciones, en su sitio',
    items: [
      '📱 En el móvil, al bajar por el menú de opciones (⚙) el marco se movía con las opciones y su borde de abajo acababa en medio. Ahora el marco se queda quieto y lo que se desplaza son solo las opciones.',
    ],
    en: {
      title: 'The options menu frame stays put',
      items: ['📱 On mobile, scrolling the options menu (⚙) moved its frame along with the options, leaving the bottom border in the middle. Now the frame stays still and only the options scroll.'],
    },
  },
  {
    id: '2026-10-26l',
    date: '2026-10-26',
    title: 'Logro Expansionista',
    items: [
      '🚩 El logro de tener 3 colonias se llamaba también «Fundador» y se confundía con el de los primeros jugadores: ahora se llama <b>Expansionista</b>. Si lo llevabas de título, ya sale con el nombre nuevo.',
    ],
    en: {
      title: 'Expansionist achievement',
      items: ['🚩 The achievement for having 3 colonies was also called “Founder” and was confused with the one for early players: it’s now called <b>Expansionist</b>. If you wore it as a title, it already shows the new name.'],
    },
  },
  {
    id: '2026-10-26k',
    date: '2026-10-26',
    title: 'Nuevo emblema de Fundador',
    items: [
      '🌅 El logro de <b>Fundador</b> estrena emblema: un yelmo de hoplita con penacho rojo entre laureles de oro. Lo verás en tu perfil, en la guía y en los avisos.',
    ],
    en: {
      title: 'New Founder emblem',
      items: ['🌅 The <b>Founder</b> achievement has a new emblem: a hoplite helmet with a red crest among golden laurels. You’ll see it in your profile, the guide and notifications.'],
    },
  },
  {
    id: '2026-10-26j',
    date: '2026-10-26',
    title: 'Nombres largos bien alineados',
    items: [
      '📱 En la clasificación y en el resto de listas, los nombres largos que ocupan dos líneas («Aleksander Tiriev») ya no salen centrados: quedan alineados con los demás.',
    ],
    en: {
      title: 'Long names aligned properly',
      items: ['📱 In the rankings and other lists, long names that take up two lines are no longer centred: they line up with the rest.'],
    },
  },
  {
    id: '2026-10-26i',
    date: '2026-10-26',
    title: 'Volver al continente',
    items: [
      '🗺️ En las tierras de un continente hay arriba un botón <b>← Volver a</b> el continente: vuelves a su lista de tierras para elegir otra sin cerrar la ventana.',
    ],
    en: {
      title: 'Back to the continent',
      items: ['🗺️ The lands of a continent now have a <b>← Back to</b> the continent button at the top: you return to its list of lands to pick another without closing the window.'],
    },
  },
  {
    id: '2026-10-26h',
    date: '2026-10-26',
    title: 'El chat ya no tapa los edificios',
    items: [
      '💬 En pantallas anchas, si tienes un edificio o una isla abiertos, el chat se abre a su izquierda en vez de quedarse encima.',
      '💬 En el móvil, la tablet y las pantallas pequeñas no caben los dos: al abrir el chat se cierra el edificio, y al abrir un edificio se cierra el chat.',
    ],
    en: {
      title: 'The chat no longer covers buildings',
      items: [
        '💬 On wide screens, if a building or island is open, the chat opens to its left instead of on top of it.',
        '💬 On phones, tablets and small screens the two don’t fit: opening the chat closes the building, and opening a building closes the chat.',
      ],
    },
  },
  {
    id: '2026-10-26g',
    date: '2026-10-26',
    title: 'Más ligero en móviles y tablets',
    items: [
      '🔋 Con los gráficos en calidad normal (lo que viene en móviles y tablets) el juego pide mucho menos al aparato: se dibuja a 30 imágenes por segundo, las sombras se rehacen menos veces, el mar lleva menos detalle y las tablets usan menos resolución interna. Debería ir más fluido, calentarse menos y gastar menos batería.',
      '🪟 Con una ventana abierta, el juego de detrás (que queda borroso) se dibuja más despacio, en cualquier aparato.',
      '✨ En móviles y tablets se ha vuelto a la calidad normal aunque tuvieras puesta la alta. Si tu aparato va sobrado, puedes volver a todo el detalle en ⚙ → «Gráficos de alta calidad».',
    ],
    en: {
      title: 'Lighter on phones and tablets',
      items: [
        '🔋 With graphics at normal quality (the default on phones and tablets) the game asks much less of your device: it draws 30 frames per second, shadows are redrawn less often, the sea has less detail and tablets use a lower internal resolution. It should run smoother, stay cooler and use less battery.',
        '🪟 While a window is open, the game behind it (which is blurred) is drawn more slowly, on any device.',
        '✨ Phones and tablets have been switched back to normal quality even if you had chosen high. If your device has power to spare, you can go back to full detail in ⚙ → “High-quality graphics”.',
      ],
    },
  },
  {
    id: '2026-10-26f',
    date: '2026-10-26',
    title: 'Arreglos en el móvil',
    items: [
      '📱 La <b>clasificación</b> y los <b>informes</b> ya no se salen de la pantalla en el móvil: las pestañas pasan a dos filas y el lugar y la hora de cada informe bajan de línea.',
      '📱 En <b>En marcha</b> y al <b>enviar una flota</b> los nombres largos («Atacar Escollo Negra», «Milicia con lanza») se leen enteros en vez de quedarse cortados.',
      '📱 La etiqueta de tropas «en casa» del cuartel ya no se parte en dos, y la temporada de la portada lleva el icono nuevo.',
    ],
    en: {
      title: 'Mobile fixes',
      items: [
        '📱 The <b>rankings</b> and <b>reports</b> no longer spill off the screen on mobile: tabs wrap onto two rows and each report’s place and time move to their own line.',
        '📱 In <b>Under way</b> and when <b>sending a fleet</b>, long names are shown in full instead of being cut off.',
        '📱 The barracks’ “at home” troop tag no longer splits in two, and the season on the front page uses the new icon.',
      ],
    },
  },
  {
    id: '2026-10-26e',
    date: '2026-10-26',
    title: 'Los iconos nuevos, en todas partes',
    items: [
      '🖼️ Los iconos nuevos de los recursos y del favor salen ya en todo el juego: lo que comen y cobran las tropas, los trabajadores, los avisos, los informes, el chat, las tareas diarias, la guía, la temporada del archipiélago y la mina de cristal.',
    ],
    en: {
      title: 'The new icons, everywhere',
      items: ['🖼️ The new resource and favour icons now appear throughout the game: what troops eat and are paid, workers, notifications, reports, the chat, daily tasks, the guide, the archipelago season and the crystal mine.'],
    },
  },
  {
    id: '2026-10-26d',
    date: '2026-10-26',
    title: 'Nuevo icono del favor',
    items: [
      '🙏 El <b>favor de los dioses</b> también estrena icono: unas manos en oración entre laureles de oro, ante un sol con la greca. Lo verás arriba, en el templo, en los poderes divinos y en las recompensas.',
    ],
    en: {
      title: 'New favour icon',
      items: ['🙏 The <b>favour of the gods</b> has a new icon too: hands in prayer among golden laurels, before a sun with the Greek key. You’ll see it at the top, in the temple, in the divine powers and in rewards.'],
    },
  },
  {
    id: '2026-10-26c',
    date: '2026-10-26',
    title: 'Nuevos iconos de los recursos',
    items: [
      '🪵 La <b>madera</b> estrena icono: un montón de troncos recién cortados, con sus anillos. La <b>piedra</b>, unos sillares de caliza recién sacados de la cantera. La <b>comida</b>, una gavilla de trigo atada con cuerda. El <b>cristal</b>, una drusa de cristales azules sobre la roca. Y el <b>oro</b>, una moneda con la cabeza de Atenea. Los verás en la barra de recursos, en los costes y en el mercado.',
    ],
    en: {
      title: 'New resource icons',
      items: ['🪵 <b>Wood</b> has a new icon: a pile of freshly cut logs, with their rings. <b>Stone</b>, some limestone blocks fresh from the quarry. <b>Food</b>, a sheaf of wheat tied with rope. <b>Crystal</b>, a cluster of blue crystals on the rock. And <b>gold</b>, a coin bearing the head of Athena. You’ll see them in the resource bar, in costs and at the market.'],
    },
  },
  {
    id: '2026-10-26b',
    date: '2026-10-26',
    title: 'Los espías traen el informe a casa',
    items: [
      '🔭 El <b>informe de los espías</b> ya no llega en cuanto los botes alcanzan la ciudad espiada: lo traen ellos, así que lo tienes cuando <b>vuelven a casa</b> (o a la base desde la que zarparon). Si los descubren y los hunden, te enteras igual que antes.',
    ],
    en: {
      title: 'Spies bring the report home',
      items: ['🔭 The <b>spy report</b> no longer arrives as soon as the boats reach the city being spied on: they carry it, so you get it when they <b>return home</b> (or to the base they sailed from). If they are discovered and sunk, you find out as before.'],
    },
  },
  {
    id: '2026-10-26a',
    date: '2026-10-26',
    title: 'El Coloso, hasta el nivel 10',
    items: [
      '🗽 El <b>Coloso</b> tiene ahora nivel máximo: el <b>10</b>. Ahí queda terminado, con su oro y la antorcha encendida, y da +50 % a toda la producción.',
    ],
    en: {
      title: 'The Colossus, up to level 10',
      items: ['🗽 The <b>Colossus</b> now has a maximum level: <b>10</b>. There it is finished, with its gold and the torch lit, and gives +50 % to all production.'],
    },
  },
  {
    id: '2026-10-25i',
    date: '2026-10-25',
    title: 'Arreglos en el móvil',
    items: [
      '🪟 Arreglado: a veces, al volver a abrir una ventana (la cuenta, el perfil, los amigos…) salía vacía y había que recargar la página. Ahora se abren siempre con su contenido.',
      '📱 La guía de inicio ya no tapa lo que explica en el móvil: su tarjeta se aparta, el panel se desplaza solo hasta el botón que hay que pulsar y el aro dorado queda justo encima.',
      '📱 Con una ventana abierta en el móvil, los avisos salen abajo y no tapan su cabecera.',
    ],
    en: {
      title: 'Mobile fixes',
      items: [
        '🪟 Fixed: sometimes, when reopening a window (account, profile, friends…) it came up empty and you had to reload the page. Now they always open with their content.',
        '📱 The getting-started guide no longer covers what it explains on mobile: its card moves out of the way, the panel scrolls by itself to the button you need to press and the golden ring sits right on it.',
        '📱 With a window open on mobile, notifications appear at the bottom and don’t cover its header.',
      ],
    },
  },
  {
    id: '2026-10-25h',
    date: '2026-10-25',
    title: 'Avisa de los fallos',
    items: [
      '🐞 Nuevo <b>Reportar un fallo</b> en el menú ⚙: cuéntanos qué ha pasado y les llega a los moderadores, que te pueden contestar por correo. Con el aviso va lo que tenías abierto, tu navegador y los últimos errores de la página, para encontrarlo antes.',
    ],
    en: {
      title: 'Report bugs',
      items: ['🐞 New <b>Report a bug</b> in the ⚙ menu: tell us what happened and it goes to the moderators, who can reply to you by mail. The report includes what you had open, your browser and the page’s latest errors, so it can be found sooner.'],
    },
  },
  {
    id: '2026-10-25g',
    date: '2026-10-25',
    title: 'Nubes de algodón',
    items: [
      '☁️ Las <b>nubes</b> se renuevan: cúmulos blancos y redondeados, con la panza en sombra, en vez de bloques de piedra. También las que tapan las islas sin explorar y los bancos de niebla del Mar de las Brumas.',
    ],
    en: {
      title: 'Cotton clouds',
      items: ['☁️ The <b>clouds</b> are renewed: round white cumulus clouds with shaded bellies, instead of blocks of stone. The ones covering unexplored islands and the fog banks of the Sea of Mists too.'],
    },
  },
  {
    id: '2026-10-25f',
    date: '2026-10-25',
    title: 'Noticias e informes en inglés',
    items: [
      '🌐 En inglés ya salen también las noticias, los informes de combate y espionaje, los avisos del chat y los mensajes de «no se puede» que manda el juego.',
    ],
    en: {
      title: 'News and reports in English',
      items: ['🌐 In English, the news, battle and spy reports, chat announcements and the «you can’t do that» messages the game sends are now translated too.'],
    },
  },
  {
    id: '2026-10-25e',
    date: '2026-10-25',
    title: 'Aegium in English',
    items: [
      '🌐 Ya se puede jugar en <b>inglés</b>: elige el idioma en ⚙ Ajustes o en la portada. Están traducidos los menús, los paneles, los edificios, las tropas, las misiones y la guía; las noticias e informes que manda el juego llegarán en inglés en una próxima actualización.',
    ],
    en: {
      title: 'Aegium in English',
      items: [
        '🌐 You can now play in <b>English</b>: choose the language in ⚙ Settings or on the home page. Menus, panels, buildings, troops, missions and the guide are translated; the news and reports the game sends will come in English in an upcoming update.',
      ],
    },
  },
  {
    id: '2026-10-25d',
    date: '2026-10-25',
    title: 'Playas en orden',
    items: [
      '🏖️ Las cabañas de pescadores, los embarcaderos, las barcas, las redes y las palmeras ya no se meten en los montes de la cantera y la mina: buscan su sitio en la arena libre.',
    ],
    en: {
      title: 'Tidy beaches',
      items: ['🏖️ Fishermen’s huts, piers, boats, nets and palm trees no longer poke into the quarry and mine mountains: they find their spot on the free sand.'],
    },
  },
  {
    id: '2026-10-25c',
    date: '2026-10-25',
    title: 'Más mar entre las islas',
    items: [
      '🌊 Las islas ya no nacen pegadas: hay más mar alrededor de tu ciudad y entre las islas vecinas, y los continentes dejan su hueco. Las islas que ya existían se han recolocado (las mismas islas, solo más separadas).',
      '🛶 Los barcos flotan sobre las olas que tienen debajo: los botes pequeños ya no se hunden entre ellas mientras navegan.',
    ],
    en: {
      title: 'More sea between the islands',
      items: [
        '🌊 Islands are no longer born stuck together: there’s more sea around your city and between neighbouring islands, and continents leave their gap. Existing islands have been moved (the same islands, just further apart).',
        '🛶 Ships float on the waves beneath them: small boats no longer sink between them while sailing.',
      ],
    },
  },
  {
    id: '2026-10-25b',
    date: '2026-10-25',
    title: 'Desde los cimientos',
    items: [
      '🪓 Las ciudades nuevas empiezan solo con el <b>ayuntamiento</b>: el <b>aserradero</b> y la <b>cantera</b> los construyes tú con los recursos iniciales, que no cambian. Las primeras misiones y el consejero te guían para levantarlos.',
    ],
    en: {
      title: 'From the foundations',
      items: ['🪓 New cities start with just the <b>town hall</b>: you build the <b>sawmill</b> and the <b>quarry</b> yourself with the starting resources, which haven’t changed. The first missions and the advisor guide you through it.'],
    },
  },
  {
    id: '2026-10-25-mundo',
    date: '2026-10-25',
    title: 'Un mundo nuevo',
    items: [
      '🌊 <b>El archipiélago empieza de cero</b>: todas las ciudades, flotas, alianzas y foros del mundo anterior se han borrado, y todos salimos desde la misma casilla.',
      '🪪 <b>Tu cuenta sigue siendo tuya</b>: el mismo nombre, contraseña y correo. También conservas a tus <b>amigos</b> y, si lo eras, el título de <b>Fundador</b>.',
      '🏛️ Al entrar, eliges el <b>nombre de tu ciudad nueva</b> y la fundas en un rincón del mapa recién trazado.',
    ],
    en: {
      title: 'A new world',
      items: [
        '🌊 <b>The archipelago starts from scratch</b>: every city, fleet, alliance and forum from the previous world has been erased, and we all start from the same square.',
        '🪪 <b>Your account is still yours</b>: the same name, password and email. You also keep your <b>friends</b> and, if you had it, the <b>Founder</b> title.',
        '🏛️ When you log in, you choose the <b>name of your new city</b> and found it in a corner of the freshly drawn map.',
      ],
    },
  },
  {
    id: '2026-10-22j',
    date: '2026-10-22',
    title: 'Iconos más de la época',
    items: [
      '🕯️ Los <b>visitantes</b> dejan los iconos modernos: los peregrinos llegan con su vela, el mercader ambulante en 🐫 camello y los restos de un naufragio con 🌊 la marea.',
      '⛵ En el informe de espionaje, los barcos del puerto usan el icono del trirreme.',
    ],
  },
  {
    id: '2026-10-22-parche',
    date: '2026-10-22',
    title: 'Gran parche de mantenimiento y mejora',
    items: [
      '🏛️ <b>Logo nuevo</b>: la columna jónica de oro entre laureles verdes, con el nombre en letras de oro labradas. Lo verás en la portada, en los correos, en la pestaña del navegador y en la barra de arriba.',
      '✉️ <b>Correos de cuenta renovados</b> (alta, cambio de correo y contraseña olvidada), con el logo y un diseño más cuidado. Llegan desde <b>no-responder@aegium-online.es</b>.',
      '🪪 <b>Nombres únicos</b>: ya no puede haber dos jugadores ni dos ciudades con el mismo nombre (sin contar mayúsculas, tildes ni espacios).',
      '⚔️ <b>Las tropas, renovadas</b> con un aspecto griego: la <b>Milicia con lanza</b> (lino, casco con penacho negro y escudo de madera), el <b>Hondero</b> con la honda volando, el <b>Arquero</b> listo para tirar, el <b>Espadachín</b> (que deja el escudo de legionario), el <b>Hoplita</b> con el escudo del sol de Vergina, el <b>Espartano</b> con la lambda roja, el <b>Arquero cretense</b> tensando el arco, el <b>Catafracto</b> con su caballo de escamas de bronce, el <b>Elefante de guerra</b> acorazado con su torre de arqueros y la <b>Catapulta</b> de torsión.',
      '🐎 El <b>Caballero</b> pasa a llamarse <b>Jinete</b> y estrena aspecto: caballo castaño con bridas y gualdrapa, y el jinete con manto azul y la lanza larga terciada. Sus estadísticas no cambian.',
      '🖼️ <b>Iconos propios para todas las tropas</b>: <img class="res-img unit-img" src="/ui/lancero.png" alt="" /> milicia, <img class="res-img unit-img" src="/ui/hondero.png" alt="" /> hondero, <img class="res-img unit-img" src="/ui/arquero-arco.png" alt="" /> arquero, <img class="res-img unit-img" src="/ui/espadachin-escudo.png" alt="" /> espadachín, <img class="res-img unit-img" src="/ui/hoplita.png" alt="" /> hoplita, <img class="res-img unit-img" src="/ui/caballero-v2.png" alt="" /> jinete, <img class="res-img unit-img" src="/ui/espartano.png" alt="" /> espartano, <img class="res-img unit-img" src="/ui/cretense.png" alt="" /> arquero cretense, <img class="res-img unit-img" src="/ui/catafracto.png" alt="" /> catafracto y <img class="res-img unit-img" src="/ui/elefante.png" alt="" /> elefante. También los llevan sus compañías de la taberna.',
      '⛵ <b>Y para todos los barcos</b>: <img class="res-img unit-img" src="/ui/bote-v2.png" alt="" /> bote explorador, <img class="res-img unit-img" src="/ui/mercante-v2.png" alt="" /> mercante, <img class="res-img unit-img" src="/ui/trirreme-v2.png" alt="" /> trirreme, <img class="res-img unit-img" src="/ui/brulote-v2.png" alt="" /> brulote, <img class="res-img unit-img" src="/ui/quinquerreme-v2.png" alt="" /> quinquerreme, <img class="res-img unit-img" src="/ui/dromon-v2.png" alt="" /> dromón y <img class="res-img unit-img" src="/ui/liburna.png" alt="" /> liburna. La corona de laureles queda para las <b>tropas de élite</b>: así se distinguen de un vistazo.',
      '🏺 <b>Todas las reliquias</b> tienen icono propio: <img class="res-img unit-img" src="/ui/espada-jason.png" alt="" /> la <b>Espada de Jasón</b>, de hoja ancha con empuñadura azul y pomo con el sol; <img class="res-img unit-img" src="/ui/escudo-aquiles.png" alt="" /> el <b>Escudo de Aquiles</b>, de bronce labrado con guerreros y caballos entre grecas; <img class="res-img unit-img" src="/ui/tridente-bronce.png" alt="" /> el <b>Tridente de bronce</b>, con su pátina verde; <img class="res-img unit-img" src="/ui/ancla-poseidon.png" alt="" /> el <b>Ancla de Poseidón</b>, con su cabo y el tridente grabado; <img class="res-img unit-img" src="/ui/cuerno-abundancia.png" alt="" /> el <b>Cuerno de la abundancia</b>, rebosante de trigo, uvas, granadas y monedas; <img class="res-img unit-img" src="/ui/lira-orfeo.png" alt="" /> la <b>Lira de Orfeo</b>, con sus palomas y el sol; <img class="res-img unit-img" src="/ui/hoz-cronos.png" alt="" /> la <b>Hoz de Cronos</b>, con el reloj de arena en la hoja; <img class="res-img unit-img" src="/ui/colmillo-kraken.png" alt="" /> el <b>Colmillo del Kraken</b>, abrazado por sus tentáculos de bronce; <img class="res-img unit-img" src="/ui/perla-abismo.png" alt="" /> la <b>Perla del abismo</b>, irisada entre tentáculos; <img class="res-img unit-img" src="/ui/ojo-kraken.png" alt="" /> el <b>Ojo del Kraken</b>, de pupila rasgada bajo el tridente; <img class="res-img unit-img" src="/ui/mascara-minotauro.png" alt="" /> la <b>Máscara del Minotauro</b>, de bronce con grecas y la argolla en el morro; <img class="res-img unit-img" src="/ui/vellocino-oro.png" alt="" /> el <b>Vellocino de oro</b>, de rizos dorados con la cabeza del carnero; <img class="res-img unit-img" src="/ui/rayo-zeus.png" alt="" /> el <b>Rayo de Zeus</b>, de oro con el rostro del dios y relámpagos azules; <img class="res-img unit-img" src="/ui/escama-tifon.png" alt="" /> la <b>Escama de Tifón</b>, negra y agrietada de lava; <img class="res-img unit-img" src="/ui/tiara-gran-rey.png" alt="" /> la <b>Tiara del Gran Rey</b>, de oro con laureles y lapislázuli; <img class="res-img unit-img" src="/ui/remo-temistocles.png" alt="" /> el <b>Remo de Temístocles</b>, con la trirreme labrada en la pala entre salpicaduras; <img class="res-img unit-img" src="/ui/piel-nemea.png" alt="" /> la <b>Piel del león de Nemea</b>, con sus garras y las fíbulas de bronce; y <img class="res-img unit-img" src="/ui/yelmo-hades.png" alt="" /> el <b>Yelmo de Hades</b>, de bronce ennegrecido con la calavera y el penacho negro.',
      '🐉 <b>Gestas</b>: la <b>Hidra de Lerna</b> sale de su pantano como una bestia de cuatro patas con un abanico de cuellos de crestas doradas y fauces abiertas. Y el <b>campamento del Gran Rey</b> en la gesta de la Armada se renueva (pabellón púrpura con el disco alado, tiendas, toldos, estandartes y empalizada); cuando llega, el aviso lo dice claro: <i>las huestes del Gran Rey Jerjes han venido a saquear</i> el continente.',
      '🌾 <b>Tu isla cobra vida al crecer</b>: los campos de cultivo de detrás de la granja y su rebaño de ovejas aparecen con la <b>granja a nivel 8</b>, y los carros de bueyes recorren la avenida cuando tienes el <b>puerto</b>.',
      '🎖️ El <b>almirante</b> llega como mucho al <b>nivel 10</b> (antes, al 30). Si el tuyo estaba más arriba, se queda en el 10 y recuperas sus 10 puntos de habilidad para repartirlos de nuevo.',
      '🎁 El <b>regalo diario</b> da la mitad que antes (el del séptimo día: 125 de oro, 125 de cristal y 10 de favor) y crece un 10 % por nivel del ayuntamiento en vez de un 25 %. Los encargos diarios no cambian.',
      '🏴‍☠️ Los <b>piratas</b> atacan unas <b>dos veces por semana</b> (cada 3 o 4 días) en vez de cada pocas horas; el primero, un día después de tener el ayuntamiento a nivel 3.',
    ],
  },
  {
    id: '2026-10-20a',
    date: '2026-10-20',
    title: 'Nuevo nombre: Aegium',
    items: [
      '🏛️ El juego se llama ahora <b>Aegium</b>, como la antigua ciudad de Acaya junto al golfo de Corinto. Todo lo demás sigue igual: tu cuenta, tu ciudad y tus partidas.',
      '🌿 El logo conserva la columna dorada entre laureles, que es también el nuevo icono de la pestaña.',
    ],
  },
  {
    id: '2026-10-19d',
    date: '2026-10-19',
    title: 'El puerto acelera tus flotas',
    items: ['⚓ El <b>puerto</b> ya no acelera la construcción de barcos: ahora cada nivel hace tus <b>flotas un 2 % más rápidas</b> (a nivel 10, +20 %). Los barcos los construye más rápido solo el <b>astillero</b>, un 8 % por nivel.'],
  },
  {
    id: '2026-10-19c',
    date: '2026-10-19',
    title: 'Colonias con guarnición',
    items: [
      '🏕️ Nueva misión <b>Guarnición</b>: despliega tropas y barcos en tus colonias. Se quedan defendiéndolas hasta que las retires y no ocupan una flota en el mar.',
      '⚓ Las colonias con guarnición son <b>bases</b>: elige la colonia en «Zarpar desde» para atacar, espiar, sabotear, bloquear o invadir desde allí. La flota vuelve a la colonia y el botín llega a tu capital.',
      '⚔️ Las colonias ya se pueden <b>saquear</b>: si vences a su guarnición, te llevas 6 h de lo que produce y la dejas 12 h sin producir. La colonia sigue siendo de su dueño, y valen las mismas protecciones que contra las ciudades. La torre de vigía te avisa si viene alguien hacia tus colonias.',
    ],
  },
  {
    id: '2026-10-19b',
    date: '2026-10-19',
    title: 'Punto de los millares',
    items: ['🔢 Las cifras de cuatro dígitos ya llevan su punto de los millares, como las demás: «5.757» en vez de «5757».'],
  },
  {
    id: '2026-10-19a',
    date: '2026-10-19',
    title: 'Fundadores del archipiélago',
    items: [
      '🌅 Nuevo logro: <b>Fundador</b>. Lo reciben todos los que llegan al archipiélago en su primer mes, y se puede llevar de título junto a tu nombre desde tu perfil. ¡Gracias por estar desde el principio!',
      '⚡ Arreglado: los logros <b>Azote de reyes</b> y <b>Azote de Tifón</b> se confundían (ganar uno marcaba los dos). Ahora cada uno va por su lado y el título que llevabas muestra el que ganaste.',
    ],
  },
  {
    id: '2026-10-18g',
    date: '2026-10-18',
    title: 'Puerto y astillero',
    items: [
      '⚓ El <b>puerto</b> bota los barcos un 5 % más rápido por nivel (antes un 10 %): a nivel 10, +45 %. Su ficha ya no se presenta como astillero (es otro edificio) y esa mejora se llama ahora «Velocidad al botar barcos».',
      '🛠️ Cada <b>barco de guerra</b> pide ahora un nivel de <b>astillero</b>: trirreme, 1; brulote, 2; quinquerreme, 4; liburna, 5; dromón, 7. Sin astillero solo se botan botes y mercantes. Los barcos que ya tienes no cambian.',
      '⛴️ La <b>liburna</b> es más rápida (×1,8 en vez de ×1,6) y pega más (60 de ataque en vez de 52).',
    ],
  },
  {
    id: '2026-10-18f',
    date: '2026-10-18',
    title: 'Lo leído, en todos tus dispositivos',
    items: ['📱 Lo que ya has leído en el <b>chat</b>, los <b>avisos</b> al entrar y las <b>novedades</b> se guardan ahora en tu cuenta: si entras desde otro dispositivo ya no te salen otra vez como nuevos.'],
  },
  {
    id: '2026-10-18e',
    date: '2026-10-18',
    title: 'El ayuntamiento manda y la taberna mejora',
    items: [
      '🏛️ Para subir cualquier edificio por encima del <b>nivel 5</b> hace falta el ayuntamiento: del 6 al 10, ayuntamiento 3; del 11 al 15, el 6; del 16 al 20, el 9; y así, 3 más cada 5 niveles. Lo que ya tengas construido se queda como está.',
      '🔓 Algunos edificios piden ahora el ayuntamiento para construirse: la muralla, el 3; la forja, la torre de vigía y el astillero, el 4; y el faro, el 5.',
      '🍺 La <b>taberna</b> atrae mercenarios mejores a medida que sube: a nivel 1 solo milicia con lanza y honderos; a nivel 3, arqueros; a nivel 5, hoplitas; a nivel 7, jinetes; a nivel 9, espartanos y arqueros de Creta; y a nivel 12, catafractos. De cada compañía vienen más soldados cuantos más niveles tenga la taberna por encima del suyo.',
    ],
  },
  {
    id: '2026-10-18d',
    date: '2026-10-18',
    title: 'Un solo Kraken, reliquias nuevas y coordenadas',
    items: [
      '🐙 Ahora solo hay <b>un Kraken</b> en todos los mares. Despierta en una de las fosas cuando nadie lo espera y en el chat se avisa con unas coordenadas aproximadas: manda exploradores a buscarlo. Cuando alguien lo derrota, vuelve a dormir y nadie sabe cuándo regresará.',
      '🏴‍☠️ Las fosas del Kraken siguen ahí, pero sin él: ahora las guardan muchos más corsarios y piratas, con el oro de mil naufragios. La misión «Señor de la fosa» pide ganar un ataque contra una de ellas.',
      '🏺 Las <b>reliquias</b> son ahora de tres clases. <b>Básicas</b> (muy poca ventaja): un 20 % en ruinas, conquistas, hordas y expediciones. <b>Épicas</b>: solo las deja el Kraken, un 55 % de las veces. <b>Legendarias</b>: solo en las gestas de la Liga. Las que ya tenías se quedan, con el valor de su nueva clase.',
      '⚔️ Al caer el enemigo de una gesta deja siempre una reliquia legendaria, y los juramentados de la última oleada <b>se la disputan</b> con las tropas de tierra que les quedan, por eliminatorias (una cuarta parte de los que caen en la disputa vuelve herida a casa). El Azote y el Corazón de león ya no se llevan reliquia segura, y el Navarco cobra un 25 % más de botín.',
      '📍 El mapa del mundo tiene <b>coordenadas</b> [x:y]. Las ves en la ficha de cada isla y al pasar por el mapa, y puedes ir a unas concretas. Las coordenadas que salen en el chat se pueden pulsar.',
    ],
  },
  {
    id: '2026-10-18c',
    date: '2026-10-18',
    title: 'Menos comida de la granja',
    items: ['🌾 Para que la comida no sobre tanto, la <b>granja</b> produce un 25 % menos en todos los niveles (a nivel 10, unas 970 por hora en vez de 1.300). Las tropas siguen comiendo lo mismo: vigila tu balance si tienes un ejército grande.'],
  },
  {
    id: '2026-10-18b',
    date: '2026-10-18',
    title: 'Menos favor del templo',
    items: ['🙏 Para equilibrar los poderes divinos, el <b>templo</b> genera menos favor: 4 por hora por cada nivel hasta el 5 y 2 por cada nivel más (antes 6 y 3). A nivel 5 son 20 por hora y a nivel 10, 30.'],
  },
  {
    id: '2026-10-18a',
    date: '2026-10-18',
    title: 'Recursos en el móvil',
    items: ['📱 Arreglados los <b>recursos</b> de arriba en el móvil: con cifras grandes la producción por hora se salía de su casilla y pisaba la de al lado. Ahora va abreviada (+3,5k) y, en los móviles estrechos, debajo de la cantidad.'],
  },
  {
    id: '2026-10-17a',
    date: '2026-10-17',
    title: 'Conexión, solo para amigos',
    items: ['🔒 Si estás conectado o no ya solo lo ven tus <b>amigos</b>: en tu perfil y en la lista de tu alianza, los demás capitanes no lo verán.'],
  },
  {
    id: '2026-10-16a',
    date: '2026-10-16',
    title: 'Simulador más fiel y almirante al máximo',
    items: [
      '🎲 El <b>simulador de combate</b> calcula como el combate de verdad: los porcentajes suman siempre 100 %, las catapultas rebajan la muralla, cuenta al almirante si lo llevas y, contra una ciudad, usa todo lo que vieron tus espías (torre de vigía, faro, refuerzos de sus aliados y sus mejoras militares). Lo que no vieron, te lo avisa.',
      '☄️ Las <b>catapultas</b> ya rebajan también la muralla de las ciudades de otros jugadores, como dice su descripción (antes solo servían contra las islas neutrales).',
      '🎖️ El <b>almirante</b> en el nivel máximo ya no enseña más experiencia de la que cabe: pone «Nivel máximo».',
    ],
  },
  {
    id: '2026-10-15z',
    date: '2026-10-15',
    title: 'Más fluido',
    items: ['⚡ El juego va más fluido sin perder nada de lo que se ve: los letreros se colocan en pantalla mucho más rápido, la isla tiene menos piezas que recorrer en cada fotograma y lo que está oculto (como los fuegos apagados de día) ya no se anima. Los letreros de las flotas del mapa, además, ya no se pisan entre sí.'],
  },
  {
    id: '2026-10-15y',
    date: '2026-10-15',
    title: 'Más vida en la granja',
    items: ['🐑 La <b>granja</b> gana detalle: un pozo de piedra con su cubo, un huerto con sus surcos y un hortelano, y la carreta de grano. Con el nivel llegan gallinas picoteando, un cobertizo de teja con balas de paja, el espantapájaros, un corral con ovejas y colmenas de paja.'],
  },
  {
    id: '2026-10-15x',
    date: '2026-10-15',
    title: 'Nueva mina de cristal',
    items: ['💎 La <b>mina de cristal</b> se renueva: un roquedal de caliza en la falda del monte con un gran racimo de cristales azules que pica un minero, la boca de la galería con su entibado y la vía por donde salen las vagonetas cargadas de cristal. Al lado, una terraza de sillares con la greca azul y su escalera, y con el nivel llegan el toldo con la mesa donde se clasifica el cristal, la grúa de madera que sube las cajas, más vetas en las peñas y el estandarte azul.'],
  },
  {
    id: '2026-10-15w',
    date: '2026-10-15',
    title: 'Nueva forja',
    items: ['⚒️ La <b>forja</b> es ahora un taller de bronce al aire libre: muros bajos de sillares y un muro alto con la greca azul y estantes de vasijas, la fragua redonda de piedra con su lecho de carbón, las brasas al rojo, su fuego siempre encendido y su humo, el yunque donde golpea el herrero entre chispas, un pórtico de columnas con bandas azules y tejado de teja sobre la mesa del armero, y un toldo de lona sobre otra mesa. Con el nivel llegan escudos de bronce, lanzas, cajas de lingotes y el estandarte azul.'],
  },
  {
    id: '2026-10-15v',
    date: '2026-10-15',
    title: 'Disolver reclutamientos',
    items: ['⚖️ Disolver tropas que aún se están reclutando devuelve ahora el <b>60 %</b> de lo pagado (antes, el 70 %). Cancelar una obra o una investigación sigue devolviendo el 70 %.'],
  },
  {
    id: '2026-10-15u',
    date: '2026-10-15',
    title: 'Nueva torre de vigía',
    items: ['👁️ La <b>torre de vigía</b> se renueva: torre cuadrada de sillares con su puerta bajo un frontón, saeteras y un anillo de ménsulas que sostiene la terraza, con barandillas de madera. Arriba, un templete de columnas con tejado de teja, el brasero y la guardia. A un lado ondea su estandarte azul, y al pie se acumulan lanzas, escudos y cajas según el nivel.'],
  },
  {
    id: '2026-10-15t',
    date: '2026-10-15',
    title: 'Edificios sobre la hierba',
    items: ['🌿 Fuera los solares de tierra redondos y los enlosados cuadrados de debajo de los edificios: ahora cada uno se asienta directamente sobre la hierba de la isla.'],
  },
  {
    id: '2026-10-15s',
    date: '2026-10-15',
    title: 'Fuego de verdad',
    items: ['🔥 El <b>fuego</b> se ve mucho mejor en todo el juego (antorchas, pebeteros, braseros, el altar del templo, el faro, la antorcha del Coloso, las hogueras de los campamentos…): lenguas de fuego que se mecen, amarillas en la base y rojas en las puntas, con un halo de luz y pavesas que suben. Los fuegos se encienden al anochecer y se apagan al amanecer (salvo la antorcha del Coloso, que arde siempre), y de noche arden también los pebeteros de la avenida del puerto.'],
  },
  {
    id: '2026-10-15r',
    date: '2026-10-15',
    title: 'Un Coloso más imponente',
    items: ['🗽 El <b>Coloso</b> es ahora mucho más grande: se alza por encima de toda la isla y se ve desde cualquier punto.'],
  },
  {
    id: '2026-10-15q',
    date: '2026-10-15',
    title: 'Un faro como el de Alejandría',
    items: ['🗼 El <b>faro</b> se renueva al estilo del de Alejandría: sobre un islote de rocas, un recinto de sillares con su escalinata hacia el camino y pilares en las esquinas, y una torre de tres cuerpos (cuadrado, octogonal y redondo) con pilastras, friso, ventanucos y su puerta de madera bajo un pequeño pórtico griego. Arriba, la linterna de columnas con el fuego, la cúpula y Poseidón con su tridente. Con el nivel llegan los estandartes azules (4), las esfinges (6) y la cúpula de oro (8).'],
  },
  {
    id: '2026-10-15p',
    date: '2026-10-15',
    title: 'Barra de abajo en el móvil',
    items: ['📱 Arreglada la barra de abajo en el móvil y la tablet: al deslizarla de lado ya no se corta el cuadro de las colonias. Ahora la fila de colonias y la de edificios o islas se deslizan cada una por su cuenta.'],
  },
  {
    id: '2026-10-15o',
    date: '2026-10-15',
    title: 'Murallas con más detalle',
    items: ['🏰 Las <b>murallas</b> se renuevan: altos muros de grandes sillares con almenas seguidas y adarve, y torres cuadradas coronadas de almenas, con saeteras y estandartes azules con ribetes de oro (más torres a partir del nivel 6). La puerta es ahora un pórtico de mármol con frontón azul entre dos torres, con los portones abiertos y antorchas.'],
  },
  {
    id: '2026-10-15n',
    date: '2026-10-15',
    title: 'Tus colonias, a mano',
    items: ['🚩 En la barra lateral, bajo el ejército, aparece la lista de <b>tus colonias</b>: qué recurso dan y cuánto por hora, su nivel y si se están ampliando 🔨 o las han saqueado 🔥. Pulsa una y vas directo a ella en el mapa, con su panel abierto.'],
  },
  {
    id: '2026-10-15m',
    date: '2026-10-15',
    title: 'Todo el archipiélago a la vista',
    items: [
      '🗺️ En la vista de las islas ya se ve <b>todo el archipiélago</b>: las islas lejanas y sus ciudades ya no desaparecen. Para atacar a las ciudades lejanas siguen haciendo falta las Cartas náuticas.',
      '⚡ El juego va más ligero: las islas lejanas se dibujan simplificadas hasta que te acercas, lo que tapa la niebla no se dibuja y la lista de islas solo se descarga cuando cambia.',
    ],
  },
  {
    id: '2026-10-15l',
    date: '2026-10-15',
    title: 'Tejados de teja',
    items: ['🏛️ Los <b>edificios</b> estrenan tejados de teja como el del almacén: tejas curvas en hileras, cumbreras y caballetes en las esquinas. El ayuntamiento, la academia, el cuartel, el mercado, la taberna, la forja, el aserradero, la fundición, el puerto, el astillero y el faro; y el templo, con sus tejas de oro.'],
  },
  {
    id: '2026-10-15k',
    date: '2026-10-15',
    title: 'Casco de la estatua',
    items: ['🏆 Arreglado el casco de la estatua de la gesta: el penacho ya va encima, de delante atrás, y no le tapa la cara.'],
  },
  {
    id: '2026-10-15j',
    date: '2026-10-15',
    title: 'Estatua de la gesta',
    items: [
      '🏆 La <b>estatua</b> que ganas al vencer una gesta es ahora un gran hoplita de mármol: casco de penacho, capa al viento, lanza en alto y escudo de oro con la gema de su gesta. Se alza sobre un pedestal con columnas, greca y estandarte azul, rodeado de braseros encendidos y cipreses.',
    ],
  },
  {
    id: '2026-10-15i',
    date: '2026-10-15',
    title: 'Almacén nuevo',
    items: [
      '📦 El <b>almacén</b> estrena aspecto: muros de sillares, tejado de tejas, frontón azul, greca de oro y portón entre columnas. A su lado, un cobertizo con toldo azul lleno de sacos, y con los niveles llegan estandartes, braseros, el carro de carga y más cajas, barriles y ánforas.',
    ],
  },
  {
    id: '2026-10-15h',
    date: '2026-10-15',
    title: 'Jurar una gesta',
    items: [
      '🌋 Al <b>jurar una gesta</b> dejas tus guerras: terminan tus ocupaciones y bloqueos de ciudades de otros jugadores y se dan la vuelta tus flotas que iban a por ellos. Así nadie se queda con su ciudad ocupada sin poder liberarla por la tregua sagrada. Antes de jurar, el juego te avisa de lo que vas a dejar.',
    ],
  },
  {
    id: '2026-10-15g',
    date: '2026-10-15',
    title: 'Avisos que se pueden ocultar',
    items: [
      '⚔️ La banda roja de <b>avisos</b> (ataques, piratas, bloqueos, hordas, gestas) tiene una <b>✕</b> para ocultarla. Queda una pastilla pequeña con cuántos avisos hay: púlsala para volver a verlos. Si llega un aviso nuevo, la banda se vuelve a abrir sola.',
    ],
  },
  {
    id: '2026-10-15f',
    date: '2026-10-15',
    title: 'Bendiciones',
    items: [
      '🙏 Al invocar un <b>poder divino</b>, el aviso te dice cuánto falta para poder volver a invocarlo.',
    ],
  },
  {
    id: '2026-10-15e',
    date: '2026-10-15',
    title: 'Tifón sale del volcán',
    items: [
      '🌋 En la gesta de <b>Tifón</b>, el gigante sale del cráter en cuanto empieza la lucha, y está vivo: respira, se balancea, agita los brazos y mueve la cabeza. Piel de roca volcánica recorrida por venas de lava, melena y barba salvajes, ojos y fauces de fuego, garras y serpientes de boca abierta que le brotan de los hombros (muchas más en la fase de las cien cabezas). El volcán, una montaña de basalto agrietada de lava, echa rocas y ceniza.',
    ],
  },
  {
    id: '2026-10-15d',
    date: '2026-10-15',
    title: 'Ofrendas en la fragua',
    items: [
      '🔥 Al ofrendar en la <b>fragua de Hefesto</b>, cada casilla llega como mucho a lo que tienes de ese recurso (y a lo que aún cabe en la fragua): si escribes de más, se corrige solo. Las cifras grandes ya caben enteras.',
    ],
  },
  {
    id: '2026-10-15c',
    date: '2026-10-15',
    title: 'Barras de progreso más claras',
    items: [
      '⏳ Las <b>barras de progreso</b> (lo que está en marcha, obras e investigaciones) resaltan más: relleno dorado brillante sobre un fondo oscuro con filo dorado. Y los navegadores con «modo oscuro automático» (algunas tablets) ya no le cambian los colores al juego.',
    ],
  },
  {
    id: '2026-10-15b',
    date: '2026-10-15',
    title: 'Tablet, ciudades lejanas y sonido de la isla',
    items: [
      '⚙ El <b>menú de opciones</b> se abre encima de su botón y entre las dos barras: ya no tapa la barra de arriba ni el botón de cerrar del panel abierto (en tablets y pantallas bajas se desplaza por dentro).',
      '⚓ Al ir a una <b>ciudad lejana</b> desde el mapa del mundo ves también las islas que tiene alrededor, y el mar ya no se queda liso a su alrededor.',
      '🏝️ Nuevo <b>sonido de fondo de la isla</b>, bajito, y las <b>gaviotas</b> graznan cada 30 a 45 segundos. Se regulan con el volumen de «Ambiente» en ⚙.',
    ],
  },
  {
    id: '2026-10-15',
    date: '2026-10-15',
    title: 'Informes con enlace',
    items: [
      '🗺️ En los <b>informes</b> (espionaje, ataques, exploraciones…), el nombre de la isla es un enlace: púlsalo y te lleva a ella en el mapa. También en los informes que se comparten en el chat.',
    ],
  },
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
      '🏛️ <b>Aegium</b> estrena logo: la columna dorada entre laureles. También es el icono de la pestaña del navegador.',
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
const SEEN_KEY = 'aegium.newsSeen';

/** Si hay una nota sin leer: ni en este navegador ni en tu cuenta (`seen`, la última vista en cualquier dispositivo). */
export function hasUnreadNews(seen = null) {
  // (si otro dispositivo ya va por una más nueva, esta también la has visto)
  if (seen && seen >= CHANGELOG[0].id) return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== CHANGELOG[0].id;
  } catch {
    return false;
  }
}

/** Marca leídas las novedades en este navegador y devuelve la última (para apuntarla en la cuenta). */
export function markNewsRead() {
  try {
    localStorage.setItem(SEEN_KEY, CHANGELOG[0].id);
  } catch {
    // sin almacenamiento: se volverá a marcar
  }
  return CHANGELOG[0].id;
}

const dateFmt = new Intl.DateTimeFormat(LANG === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function newsHtml() {
  // En inglés, las notas que tienen su versión (`en`); las demás se quedan en español, enteras
  const entries = CHANGELOG.map((e, i) => {
    const t = (LANG !== 'es' && e[LANG]) || null;
    return `<article class="news-entry${i === 0 ? ' latest' : ''}"${t || LANG === 'es' ? '' : ' translate="no"'}>
      <header><h4>${escapeHtml(t?.title ?? e.title)}</h4><time datetime="${e.date}">${dateFmt.format(new Date(`${e.date}T12:00:00`))}</time></header>
      <ul>${(t?.items ?? e.items).map((it) => `<li>${resIcons(it)}</li>`).join('')}</ul>
    </article>`;
  }).join('');
  return `<div class="modal-card">
    <div class="panel-head"><span class="panel-icon">📰</span><div><h3>Novedades</h3><div class="panel-lvl">Lo que ha cambiado en las últimas actualizaciones</div></div>
      <button class="icon-btn" data-action="close-modal" title="Cerrar">✕</button></div>
    <div class="news">${entries}</div>
  </div>`;
}
