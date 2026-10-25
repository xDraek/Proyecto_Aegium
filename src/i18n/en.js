// Diccionario español → inglés (ver index.js). Repartido por partes del juego en en/*.js; si un
// texto sale en dos partes con distinta traducción, gana la última.
import core from './en/core.js';
import data from './en/data.js';
import game from './en/game.js';
import guide from './en/guide.js';
import hud from './en/hud.js';
import islands from './en/islands.js';
import modals from './en/modals.js';
import panels from './en/panels.js';
import server from './en/server.js';
import social from './en/social.js';

export default { ...server, ...game, ...guide, ...data, ...modals, ...social, ...islands, ...panels, ...hud, ...core };
