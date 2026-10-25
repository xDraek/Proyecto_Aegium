import { escapeHtml } from './format.js';

// Notas de las actualizaciones, la más reciente primero. Para publicar una nueva, añádela arriba
// con un `id` distinto: a quien no la haya leído se le marca el botón 📰 de la barra de abajo.

export const CHANGELOG = [
  {
    id: '2026-10-25d',
    date: '2026-10-25',
    title: 'Playas en orden',
    items: [
      '🏖️ Las cabañas de pescadores, los embarcaderos, las barcas, las redes y las palmeras ya no se meten en los montes de la cantera y la mina: buscan su sitio en la arena libre.',
    ],
  },
  {
    id: '2026-10-25c',
    date: '2026-10-25',
    title: 'Más mar entre las islas',
    items: [
      '🌊 Las islas ya no nacen pegadas: hay más mar alrededor de tu ciudad y entre las islas vecinas, y los continentes dejan su hueco. Las islas que ya existían se han recolocado (las mismas islas, solo más separadas).',
      '🛶 Los barcos flotan sobre las olas que tienen debajo: los botes pequeños ya no se hunden entre ellas mientras navegan.',
    ],
  },
  {
    id: '2026-10-25b',
    date: '2026-10-25',
    title: 'Desde los cimientos',
    items: [
      '🪓 Las ciudades nuevas empiezan solo con el <b>ayuntamiento</b>: el <b>aserradero</b> y la <b>cantera</b> los construyes tú con los recursos iniciales, que no cambian. Las primeras misiones y el consejero te guían para levantarlos.',
    ],
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
      '📍 El mapa del mundo tiene <b>coordenadas</b> [x:y], como en Ikariam. Las ves en la ficha de cada isla y al pasar por el mapa, y puedes ir a unas concretas. Las coordenadas que salen en el chat se pueden pulsar.',
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
