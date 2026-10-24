import { clock, universe } from '../src/config.js';
import { RESOURCES } from '../src/game/data.js';
import { assault, battle, combineGroups, count, hasCombat, shareSurvivors, splitForces } from '../src/game/combat.js';
import { bossLeft, capByRest, effectiveEmpires, featAt, featBoss, featCoop, featHours, featRewards, forceOf, forgeBonus, forgeGoal, forgeHours, forgeRoom, pledgeEmpires, relicDuel, rewardBag, splitWar, unitsValue } from '../src/game/feats.js';
import { Game, newState, rebuilding } from '../src/game/Game.js';
import { fmtEs } from '../src/game/num.js';
import { ACHIEVEMENTS, BASIC_RELIC_CHANCE, CONTEST_CATEGORIES, CONTEST_DAYS, CONTEST_PRIZES, FEATS, FEAT_THEMES, HORDE, KRAKEN_RULES, PROTECTION, QUESTS, UNITS, VISITORS, WONDERS, WORLD_EVENTS, WORLD_EVENT_HOURS } from '../src/game/data.js';
import { playerCombat, watchRange, wonderLevel, wonderOf, worldEventAt } from '../src/game/rules.js';
import { coordsOf, fmtCoords, footprint, freshIslandState, generateContinent, generateSector, homeIsland, KRAKEN_LAIR, sectorCenter, sectorVertices, withoutGold } from '../src/game/world.js';
import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, newRecoveryCode, newSecret, normalizeCode, verifyPassword } from './auth.js';

// El mundo de todos los jugadores, en memoria. Implementa la interfaz `world`
// que usa Game (islas compartidas, información de otros jugadores, ataques).

const VIEW_RADIUS = 700; // leguas alrededor de tu isla que ves en el mapa
const ONLINE_MS = 5 * 60_000;
const STATES_FULL_MS = 60_000; // cada cuánto se manda entero el estado de las islas a una conexión en vivo
const DAY_MS = 86_400_000;
const FOUNDER_DAYS = 30; // quien se registra en el primer mes es Fundador (la fecha se cambia desde Estadísticas)
const ACTIVE_DAYS_KEPT = 60; // días con visita que se guardan de cada jugador (para las estadísticas)
const MAX_CHAT = 300;
const MAX_MAIL = 60;
const MAX_MEMBERS = 20;
const MAX_OFFERS = 5;
const OFFER_DAYS = 3;
const RANK_SIZE = 50; // filas de las clasificaciones por categoría
const MAP_CACHE_MS = 30_000;
const INACTIVE_MS = 7 * 86_400_000; // una semana sin entrar: inactivo
const MAX_THREADS = 40;
const MAX_POSTS = 200;
export const NAME_RE = /^[\p{L}\p{N}_ .-]{3,20}$/u;

/** Un nombre para comparar: sin mayúsculas, tildes ni espacios de más («Lúcio » y «lucio» son el mismo). */
export function nameKey(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export const EMAIL_RE = /^[^\s@<>()"',;]{1,64}@[^\s@<>()"',;]+\.[^\s@<>()"',;]{2,}$/;
const HOUR = 3_600_000;
/** Primera letra en mayúscula (para «la Hidra» al empezar una frase). */
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
// Cuánto vale cada enlace o permiso que se manda por correo
const TOKEN_HOURS = { registro: 24, correo: 24, clave: 1, permiso: 0.5 };
const tokenHash = (token) => createHash('sha256').update(String(token)).digest('hex');
const cleanEmail = (email) => String(email ?? '').trim().toLowerCase();
const ALLIANCE_RE = /^[\p{L}\p{N}_ .'-]{3,30}$/u;
// Flotas que avisan al llegar a tu ciudad
const HOSTILE = new Set(['atacar', 'invadir', 'bloquear']);

/** Lo que tiene el enemigo al emerger (para las barras y para saber cuánto le queda). */
function bossFull(theme, boss) {
  if (theme.kind === 'armada') return { inmortal: boss.inmortal, arquero_persa: boss.arquero_persa, fenicia: boss.posts.reduce((a, p) => a + p.full, 0) };
  if (theme.kind === 'hidra') return { hidra: boss.hidra };
  return Object.fromEntries(theme.phases.map((p) => [p.unit, boss[p.unit]]));
}

/** Une la batalla en el mar (`sea`) y la de tierra (`land`) de una misma oleada en un solo resultado. */
function joinBattles(sea, land) {
  const add = (a, b) => {
    const out = { ...a };
    for (const [u, n] of Object.entries(b ?? {})) out[u] = (out[u] ?? 0) + n;
    return out;
  };
  return {
    ...land,
    rounds: (sea.rounds ?? 0) + (land.rounds ?? 0),
    att: { start: sea.att.start, left: land.att.left, lost: add(sea.att.lost, land.att.lost) },
    def: { start: { ...sea.def.start, ...land.def.start }, left: { ...sea.def.left, ...land.def.left }, lost: { ...sea.def.lost, ...land.def.lost } },
    naval: sea.naval,
    drowned: add(sea.drowned, land.drowned),
    seaWon: true,
  };
}

/** Quién bloquea el puerto u ocupa la ciudad (para quien la mira desde fuera). */
function portOf(state) {
  const info = state.occupied ?? state.blockade;
  return info ? { kind: state.occupied ? 'invadir' : 'bloquear', by: info.by, name: info.name, banner: info.banner ?? null, until: info.until } : null;
}
const TAG_RE = /^[\p{L}\p{N}]{2,5}$/u;

export class WorldServer {
  constructor(store) {
    this.store = store;
    this.users = new Map(); // id → { id, username, pass, created, lastSeen }
    this.byName = new Map(); // nombre en minúsculas → id
    this.byEmail = new Map(); // correo en minúsculas → id
    this.games = new Map(); // id → Game
    this.islands = new Map(); // id → isla (datos fijos)
    // Versión de la lista de islas: el navegador que ya la tiene no la vuelve a recibir en cada estado
    this.islandsBoot = Date.now().toString(36);
    this.islandsCount = 0;
    this.islandList = null;
    this.islandStates = new Map(); // id → estado compartido
    // Versión del estado de las islas: cada cambio (`touch`) la sube y apunta qué isla cambió, así a
    // cada navegador solo se le mandan las islas que han cambiado desde la versión que ya tiene
    this.statesSeq = 0;
    this.stateRevs = new Map(); // id → versión en que cambió por última vez
    this.chat = [];
    this.dirtyIslands = new Set();
    this.newIslands = [];
    this.pendingChat = [];
    this.rankingCache = null;
    this.sockets = new Map(); // id → Set de conexiones en vivo
    this.pendingPush = new Set(); // jugadores cuyo estado ha cambiado y hay que avisar
    this.admins = new Set(String(process.env.ADMINS ?? '').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean));
  }

  async load() {
    const data = await this.store.load();
    this.meta = { sectors: 0, seed: Math.floor(Math.random() * 1e9), ...data.meta };
    if (!this.meta.secret) this.meta.secret = process.env.AUTH_SECRET || newSecret();
    this.secret = process.env.AUTH_SECRET || this.meta.secret;
    // Semilla del calendario de eventos (aparte de la del mapa: el navegador la conoce)
    this.meta.eventSeed ??= Math.floor(Math.random() * 2 ** 31);
    universe.eventSeed = this.meta.eventSeed;
    universe.eventOverride = this.meta.eventOverride ?? null;
    // (las tierras que daban oro, de mundos de antes, ahora dan cristal)
    for (const isl of data.islands) this.islands.set(isl.id, withoutGold(isl));
    // Las fosas de antes guardaban cada una su Kraken: ahora solo hay uno para todos (ver #updateKraken)
    for (const isl of this.islands.values()) if (isl.type === 'kraken') Object.assign(isl, KRAKEN_LAIR, { garrison: { ...KRAKEN_LAIR.garrison } });
    for (const [id, st] of Object.entries(data.islandStates)) this.islandStates.set(id, st);
    for (const isl of this.islands.values()) {
      if (isl.type !== 'jugador' && !this.islandStates.has(isl.id)) this.islandStates.set(isl.id, freshIslandState(isl, clock.now()));
    }
    for (const u of data.users) {
      this.users.set(u.id, { ...u, lastSeen: 0 });
      this.byName.set(u.username.toLowerCase(), u.id);
      if (u.email) this.byEmail.set(u.email, u.id);
    }
    // Los códigos de recuperación ya no se usan: la cuenta se recupera por correo
    delete this.meta.recovery;
    this.meta.tokens ??= {};
    for (const [uid, state] of Object.entries(data.players)) {
      const id = Number(uid);
      if (this.users.has(id)) this.games.set(id, this.#makeGame(id, state));
    }
    this.meta.mod ??= {};
    this.meta.chatDeleted ??= [];
    const deleted = new Set(this.meta.chatDeleted);
    this.chat = data.chat.filter((m) => !deleted.has(m.id)).slice(-MAX_CHAT);
    this.meta.alliances ??= {};
    this.meta.diplomacy ??= {};
    this.meta.forums ??= {};
    // Amigos (mutuos) y solicitudes pendientes: id → lista de ids
    this.meta.friends ??= {};
    this.meta.friendRequests ??= {};
    this.meta.offers ??= [];
    this.meta.founderUntil ??= Date.now() + FOUNDER_DAYS * DAY_MS;
    // Mantenimiento: MAINTENANCE=on/off en el entorno lo fija al arrancar; si no, se queda como estaba
    const m = String(process.env.MAINTENANCE ?? '').toLowerCase();
    if (m === 'on' && !this.meta.maintenance) this.meta.maintenance = { since: Date.now(), text: '' };
    if (m === 'off') this.meta.maintenance = null;
    this.#grantFounders();
    this.memberOf = new Map();
    for (const a of Object.values(this.meta.alliances)) for (const uid of a.members) this.memberOf.set(uid, a.id);
    // Mundos de antes de los continentes: se añaden donde quepan
    for (let s = 0; s < this.meta.sectors; s++) this.#addContinents(s, clock.now());
    this.#refreshWonders();
    this.#ensureContest();
    // Ponerse al día con lo que pasó mientras el servidor estuvo apagado
    this.tick();
    await this.persist(true);
  }

  #makeGame(userId, state) {
    const game = new Game({ state, world: this, userId, mode: 'server' });
    game.dirty = false;
    // Cualquier cambio en su partida se le empuja por la conexión en vivo
    game.addEventListener('change', () => this.pendingPush.add(userId));
    return game;
  }

  // ── Cuentas ────────────────────────────────────────────────────────────────

  /** Comprueba los datos de una cuenta nueva y los deja limpios. */
  #checkAccount(username, city, password, email) {
    username = String(username ?? '').trim();
    city = String(city ?? '').trim() || username;
    if (!NAME_RE.test(username)) throw new UserError('El nombre debe tener entre 3 y 20 letras o números.');
    if (!NAME_RE.test(city)) throw new UserError('El nombre de la ciudad debe tener entre 3 y 20 letras o números.');
    if (password != null && (typeof password !== 'string' || password.length < 6 || password.length > 100)) throw new UserError('La contraseña debe tener al menos 6 caracteres.');
    if (this.byName.has(username.toLowerCase()) || this.#userTaken(username)) throw new UserError('Ese nombre ya está cogido.');
    if (this.#cityTaken(city)) throw new UserError('Ya hay una ciudad con ese nombre: elige otro.');
    if (email != null) this.#checkEmail(email);
    return { username, city };
  }

  /** Si ya hay un jugador con ese nombre (sin mirar mayúsculas, tildes ni espacios). */
  #userTaken(name) {
    const key = nameKey(name);
    for (const u of this.users.values()) if (nameKey(u.username) === key) return true;
    return false;
  }

  /** Si ya hay una ciudad de otro jugador con ese nombre (sin mirar mayúsculas, tildes ni espacios). */
  #cityTaken(name, exceptOwner = null) {
    const key = nameKey(name);
    for (const isl of this.islands.values()) if (isl.type === 'jugador' && isl.owner !== exceptOwner && nameKey(isl.name) === key) return true;
    return false;
  }

  #checkEmail(email) {
    if (!EMAIL_RE.test(email) || email.length > 120) throw new UserError('Ese correo no parece válido.');
    if (this.byEmail.has(email)) throw new UserError('Ya hay una cuenta con ese correo. Si es tuya, entra o recupera la contraseña.');
  }

  /**
   * Crea la cuenta y su sector. `pass` puede venir ya cifrada (al confirmar un registro).
   * Con `email`, el correo queda verificado.
   */
  async register(username, password, city, { email = null, pass = null } = {}) {
    ({ username, city } = this.#checkAccount(username, city, pass ? null : password, email));
    const created = Date.now();
    pass ??= hashPassword(password);
    const id = await this.store.createUser({ username, pass, created, email });
    this.users.set(id, { id, username, pass, created, lastSeen: created, email });
    this.byName.set(username.toLowerCase(), id);
    if (email) this.byEmail.set(email, id);
    this.#settle(id, username, city);
    await this.persist(true);
    return id;
  }

  /** Cada jugador nuevo (o cada cuenta tras un wipe) abre un sector del archipiélago con su ciudad. */
  #settle(id, username, city) {
    const sector = this.meta.sectors++;
    const now = clock.now();
    const home = homeIsland(sector, id, city);
    const c = sectorCenter(sector);
    const lands = this.#landsNear(c.x, c.z, 520).filter((o) => o.type === 'continente');
    const neutrals = generateSector(sector, this.meta.seed, lands);
    for (const isl of [home, ...neutrals]) this.#addIsland(isl, now);
    this.#addContinents(sector, now);
    const game = this.#makeGame(id, newState({ now, home: home.id, name: username }));
    game.dirty = true;
    this.games.set(id, game);
    this.#grantFounders();
    if (this.meta.contest) this.meta.contest.base[id] = this.#contestStats(game);
    this.rankingCache = null;
    this.announce(`⚓ ${username} funda la ciudad de ${city}`);
  }

  /** Una cuenta sin ciudad (tras un wipe): le falta fundarla para jugar. */
  needsCity(userId) {
    return this.users.has(userId) && !this.games.has(userId);
  }

  /** Tras un wipe, cada jugador funda su ciudad nueva con el nombre que elija. */
  async foundCity(userId, city) {
    if (!this.needsCity(userId)) throw new UserError('Ya tienes una ciudad.');
    const { username } = this.users.get(userId);
    city = String(city ?? '').trim() || username;
    if (!NAME_RE.test(city)) throw new UserError('El nombre de la ciudad debe tener entre 3 y 20 letras o números.');
    if (this.#cityTaken(city)) throw new UserError('Ya hay una ciudad con ese nombre: elige otro.');
    this.#settle(userId, username, city);
    await this.persist(true);
  }

  #addIsland(isl, now) {
    this.islands.set(isl.id, isl);
    this.#islandsChanged();
    this.newIslands.push(isl);
    if (isl.type !== 'jugador') {
      this.islandStates.set(isl.id, freshIslandState(isl, now));
      this.dirtyIslands.add(isl.id);
    }
  }

  #islandsChanged() {
    this.islandsCount++;
    this.islandList = null;
    this.continentList = null;
    this.ownerList = null;
  }

  /** Los continentes (donde puede haber una gesta), para no recorrer todas las islas en cada foto. */
  #continents() {
    return (this.continentList ??= [...this.islands.values()].filter((isl) => isl.type === 'continente'));
  }

  /** Quiénes tienen una ciudad o una colonia (los jugadores que salen en el mapa). */
  #owners() {
    if (!this.ownerList) {
      const set = new Set();
      for (const isl of this.islands.values()) {
        if (isl.owner != null) set.add(isl.owner);
        const c = this.islandStates.get(isl.id)?.colonizedBy;
        if (c != null) set.add(c);
      }
      this.ownerList = [...set];
    }
    return this.ownerList;
  }

  /** La versión de la lista de islas (cambia al añadir una o al rebautizar una ciudad). */
  islandsRev() {
    return `${this.islandsBoot}.${this.islandsCount}`;
  }

  /** Tierras cerca de un punto, con el radio que ocupan en el mar. */
  #landsNear(x, z, radius) {
    const out = [];
    for (const isl of this.islands.values()) {
      if (isl.land) continue; // los asentamientos van dentro de su continente
      if (Math.hypot(isl.x - x, isl.z - z) <= radius) out.push({ x: isl.x, z: isl.z, r: footprint(isl), type: isl.type });
    }
    return out;
  }

  /** Continentes en los vértices de un sector (cada vértice se decide una sola vez). */
  #addContinents(sector, now) {
    this.meta.vertices ??= {};
    for (const v of sectorVertices(sector)) {
      if (this.meta.vertices[v.key]) continue;
      this.meta.vertices[v.key] = 1;
      const made = generateContinent(v, this.meta.seed, this.#landsNear(v.x, v.z, 160));
      if (made) for (const isl of made) this.#addIsland(isl, now);
    }
  }

  /** Entrar con el nombre o con el correo. */
  login(username, password) {
    const key = String(username ?? '').trim().toLowerCase();
    const id = this.byName.get(key) ?? this.byEmail.get(key);
    const user = id != null ? this.users.get(id) : null;
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.pass)) throw new UserError('Nombre o contraseña incorrectos.');
    if (this.isBanned(id)) throw new UserError(`Esta cuenta está suspendida${this.meta.mod[id].reason ? `: ${this.meta.mod[id].reason}` : '.'}`);
    return id;
  }

  // ── Correo: registro, confirmación y contraseña olvidada ──────────────────
  // Cada enlace lleva un código al azar; aquí solo se guarda su huella (sha256), con
  // lo que hace falta para terminar la operación y cuándo caduca.

  hasEmail(userId) {
    return !!this.users.get(userId)?.email;
  }

  /**
   * A quién mandar un aviso por correo (moderadores): todas las cuentas con correo, o solo la del
   * moderador si es una prueba. Un aviso de verdad no se repite en 12 horas, por si se pide dos veces.
   */
  mailingList(adminId, { test = false } = {}) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const all = [...this.users.values()].filter((u) => u.email).map((u) => ({ id: u.id, email: u.email, username: u.username }));
    if (test) return all.filter((u) => u.id === adminId);
    const last = this.meta.mailAllAt ?? 0;
    if (Date.now() - last < 12 * HOUR) throw new UserError('El aviso ya se mandó hace menos de 12 horas.');
    this.meta.mailAllAt = Date.now();
    return all;
  }

  #issue(kind, data) {
    const token = randomBytes(32).toString('base64url');
    this.meta.tokens[tokenHash(token)] = { kind, ...data, expires: Date.now() + TOKEN_HOURS[kind] * HOUR };
    return token;
  }

  /** Usa un código: lo devuelve (y lo borra, salvo `keep`) si es de ese tipo y no ha caducado. */
  #take(token, kinds, keep = false) {
    const key = tokenHash(token);
    const t = this.meta.tokens[key];
    if (!t || !kinds.includes(t.kind) || t.expires < Date.now()) return null;
    if (!keep) delete this.meta.tokens[key];
    return t;
  }

  /** Quita los códigos caducados y los que se sustituyen por uno nuevo. */
  #dropTokens(match) {
    const now = Date.now();
    for (const [key, t] of Object.entries(this.meta.tokens)) if (t.expires < now || match?.(t)) delete this.meta.tokens[key];
  }

  /**
   * Primer paso del registro: nada se crea hasta que el jugador abre el enlace del correo.
   * Volver a registrarse con el mismo nombre o correo sustituye al intento anterior.
   */
  async startRegistration({ email, username, password, password2, city }) {
    email = cleanEmail(email);
    ({ username, city } = this.#checkAccount(username, city, password, email));
    if (password !== password2) throw new UserError('Las contraseñas no coinciden.');
    const lc = username.toLowerCase();
    this.#dropTokens((t) => t.kind === 'registro' && (t.email === email || t.username.toLowerCase() === lc));
    const token = this.#issue('registro', { email, username, city, pass: hashPassword(password) });
    await this.store.save({ meta: this.meta });
    return { token, email, username };
  }

  /** Abrir un enlace: confirma un registro (crea la cuenta) o un correo nuevo. Devuelve el jugador. */
  async confirm(token) {
    const t = this.#take(token, ['registro', 'correo']);
    if (!t) throw new UserError('Este enlace ya no vale: ha caducado o ya se ha usado.');
    if (t.kind === 'registro') {
      const id = await this.register(t.username, null, t.city, { email: t.email, pass: t.pass });
      return { id, created: true };
    }
    const user = this.users.get(t.uid);
    if (!user) throw new UserError('Esa cuenta ya no existe.');
    if (this.byEmail.has(t.email) && this.byEmail.get(t.email) !== t.uid) throw new UserError('Ese correo ya lo usa otra cuenta.');
    if (user.email) this.byEmail.delete(user.email);
    user.email = t.email;
    this.byEmail.set(t.email, t.uid);
    await this.store.updateEmail(t.uid, t.email);
    await this.store.save({ meta: this.meta });
    return { id: t.uid, created: false };
  }

  /** Permiso corto para añadir el correo a una cuenta antigua (tras entrar con su contraseña). */
  async emailPermit(userId) {
    const token = this.#issue('permiso', { uid: userId });
    await this.store.save({ meta: this.meta });
    return token;
  }

  /** Pedir un correo para una cuenta: con el permiso de entrada o, desde el juego, con la contraseña. */
  async requestEmail({ permit, userId, password, email }) {
    let uid = userId;
    if (permit != null) uid = this.#take(permit, ['permiso'], true)?.uid;
    else if (!this.users.has(uid) || typeof password !== 'string' || !verifyPassword(password, this.users.get(uid).pass)) throw new UserError('La contraseña no es correcta.');
    if (uid == null || !this.users.has(uid)) throw new UserError('Ha pasado demasiado tiempo: vuelve a entrar con tu nombre y contraseña.');
    email = cleanEmail(email);
    if (this.users.get(uid).email === email) throw new UserError('Ese ya es el correo de tu cuenta.');
    this.#checkEmail(email);
    this.#dropTokens((t) => t.kind === 'correo' && t.uid === uid);
    const token = this.#issue('correo', { uid, email });
    await this.store.save({ meta: this.meta });
    return { token, email, username: this.users.get(uid).username };
  }

  /** Contraseña olvidada: un enlace al correo de la cuenta (null si no hay ninguna con ese correo). */
  async forgotPassword(email) {
    email = cleanEmail(email);
    const id = this.byEmail.get(email);
    if (id == null || this.isBanned(id)) return null;
    this.#dropTokens((t) => t.kind === 'clave' && t.uid === id);
    const token = this.#issue('clave', { uid: id });
    await this.store.save({ meta: this.meta });
    return { token, email, username: this.users.get(id).username };
  }

  async resetPassword(token, password, password2) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) throw new UserError('La contraseña nueva debe tener al menos 6 caracteres.');
    if (password !== password2) throw new UserError('Las contraseñas no coinciden.');
    const t = this.#take(token, ['clave']);
    if (!t || !this.users.has(t.uid)) throw new UserError('Este enlace ya no vale: ha caducado o ya se ha usado. Pide otro.');
    const user = this.users.get(t.uid);
    user.pass = hashPassword(password);
    await this.store.updatePassword(t.uid, user.pass);
    this.endSessions(t.uid);
    await this.store.save({ meta: this.meta });
    return t.uid;
  }

  /** El correo de un jugador, para enseñárselo a él mismo (con parte oculta). */
  maskedEmail(userId) {
    const email = this.users.get(userId)?.email;
    if (!email) return null;
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }

  /** Moderación: una contraseña temporal para quien la ha perdido todo. */
  async adminResetPassword(adminId, name) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const id = this.byName.get(String(name ?? '').trim().toLowerCase());
    if (id == null) throw new UserError('No hay ningún jugador con ese nombre.');
    const temp = normalizeCode(newRecoveryCode()).slice(0, 10).toLowerCase();
    const user = this.users.get(id);
    user.pass = hashPassword(temp);
    await this.store.updatePassword(id, user.pass);
    this.endSessions(id);
    return temp;
  }

  seen(userId) {
    const u = this.users.get(userId);
    if (u) u.lastSeen = Date.now();
    // La última visita también se guarda (con un minuto de margen) para saber quién está inactivo
    const g = this.games.get(userId);
    if (g && Date.now() - (g.state.lastSeen ?? 0) > 60_000) {
      g.state.lastSeen = Date.now();
      g.dirty = true;
    }
    // Y qué días ha entrado (para los jugadores activos de cada día en las estadísticas)
    const day = Math.floor(Date.now() / DAY_MS);
    const days = g?.state.activeDays ?? [];
    if (g && days.at(-1) !== day) {
      g.state.activeDays = [...days, day].slice(-ACTIVE_DAYS_KEPT);
      g.dirty = true;
    }
  }

  // ── Fundadores y estadísticas ──────────────────────────────────────────────

  /** Quien se registró hasta `meta.founderUntil` es Fundador (un logro que se puede llevar de título). Nunca se quita. */
  #grantFounders() {
    for (const u of this.users.values()) {
      const g = this.games.get(u.id);
      if (!g || g.state.founder || u.created > this.meta.founderUntil) continue;
      g.state.founder = true;
      g.receiveNews(null, '🌅 ¡Eres Fundador! Llegaste al archipiélago en su primer mes. Puedes llevarlo de título desde tu perfil.', 'success');
      g.dirty = true;
      this.pendingPush.add(u.id);
    }
  }

  /** Cambia hasta cuándo se es Fundador (solo moderadores). Quien ya lo es lo sigue siendo. */
  setFounderUntil(adminId, until) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    if (!Number.isFinite(until) || until <= 0) throw new UserError('Esa fecha no vale.');
    this.meta.founderUntil = until;
    this.#grantFounders();
    return this.adminStats(adminId);
  }

  /**
   * Las estadísticas del juego (solo moderadores): altas, jugadores activos, retención por semana de
   * alta y en qué misión se quedan los que se van.
   *
   * La retención es «de ventana abierta»: de los que se registraron hace al menos N días, cuántos
   * volvieron N días o más después de registrarse (su última visita fue después). Así se puede
   * calcular con lo que ya se guardaba de cada jugador.
   */
  adminStats(adminId) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const now = Date.now();
    const today = Math.floor(now / DAY_MS);
    const players = [...this.users.values()]
      .filter((u) => this.games.has(u.id))
      .map((u) => {
        const s = this.games.get(u.id).state;
        return { u, s, created: u.created ?? now, last: Math.max(s.lastSeen ?? 0, u.lastSeen ?? 0, u.created ?? 0) };
      });
    const within = (ms) => players.filter((p) => now - p.last <= ms).length;
    // Altas y jugadores activos de cada uno de los últimos 30 días
    const days = Array.from({ length: 30 }, (_, i) => today - 29 + i);
    const daily = days.map((day) => ({
      day,
      signups: players.filter((p) => Math.floor(p.created / DAY_MS) === day).length,
      active: players.filter((p) => (p.s.activeDays ?? []).includes(day)).length,
    }));
    // Retención por semana de alta (las últimas 8 semanas, de 7 en 7 días hasta hoy)
    const cohorts = Array.from({ length: 8 }, (_, k) => {
      const to = today - 7 * k;
      const from = to - 6;
      const group = players.filter((p) => {
        const d = Math.floor(p.created / DAY_MS);
        return d >= from && d <= to;
      });
      const back = {};
      for (const n of [1, 7, 30]) {
        const old = group.filter((p) => now - p.created >= n * DAY_MS);
        back[n] = old.length ? { k: old.filter((p) => p.last - p.created >= n * DAY_MS).length, of: old.length } : null;
      }
      return { from, to, n: group.length, back };
    });
    // Dónde se quedan: los que no entran desde hace 3 días, por la misión que tenían pendiente
    const gone = players.filter((p) => now - p.last > 3 * DAY_MS && now - p.created > 3 * DAY_MS);
    const stuck = {};
    for (const p of gone) {
      const claimed = new Set(p.s.quests?.claimed ?? []);
      const next = QUESTS.find((q) => !claimed.has(q.id));
      const key = next ? next.id : 'todas';
      stuck[key] = (stuck[key] ?? 0) + 1;
    }
    const dropoff = Object.entries(stuck)
      .map(([id, n]) => ({ id, title: QUESTS.find((q) => q.id === id)?.title ?? 'Todas las misiones hechas', order: QUESTS.findIndex((q) => q.id === id), n }))
      .sort((a, b) => b.n - a.n || a.order - b.order);
    return {
      now,
      accounts: players.length,
      online: players.filter((p) => now - (p.u.lastSeen ?? 0) < ONLINE_MS).length,
      active: { day: within(DAY_MS), week: within(7 * DAY_MS), month: within(30 * DAY_MS) },
      vacation: players.filter((p) => p.s.vacation).length,
      daily,
      cohorts,
      gone: gone.length,
      dropoff,
      founders: { until: this.meta.founderUntil, count: players.filter((p) => p.s.founder).length },
    };
  }

  isInactive(userId) {
    const g = this.games.get(userId);
    const last = g?.state.lastSeen ?? this.users.get(userId)?.created ?? 0;
    return Date.now() - last > INACTIVE_MS;
  }

  // ── Interfaz `world` para Game ─────────────────────────────────────────────

  island(id) {
    return this.islands.get(id) ?? null;
  }

  islandState(id) {
    return this.islandStates.get(id) ?? null;
  }

  /** Los asentamientos de un continente. */
  sitesOn(land) {
    return [...this.islands.values()].filter((i) => i.land === land);
  }

  touch(id) {
    this.dirtyIslands.add(id);
    this.stateRevs.set(id, ++this.statesSeq);
  }

  /** La versión del estado de las islas, con el arranque delante (al reiniciar no vale ninguna de antes). */
  statesRev() {
    return `${this.islandsBoot}.${this.statesSeq}`;
  }

  /**
   * Desde qué versión del estado de las islas basta con mandar lo que ha cambiado (`knownStates`, la
   * que tiene el navegador), o -1 si hay que mandarlo todo: no tiene ninguna, es de otro arranque o
   * ha cambiado la lista de islas.
   */
  #statesSince(knownRev, knownStates) {
    if (knownRev !== this.islandsRev() || !knownStates) return -1;
    const [boot, seq] = String(knownStates).split('.');
    const n = Number(seq);
    return boot === this.islandsBoot && Number.isSafeInteger(n) && n >= 0 && n <= this.statesSeq ? n : -1;
  }

  /** Si `viewer` puede ver cuándo se conecta `other`: él mismo y sus amigos, nadie más. */
  seesOnline(viewer, other) {
    return viewer === other || (this.meta.friends[viewer] ?? []).includes(other);
  }

  playerInfo(userId) {
    const game = this.games.get(userId);
    const user = this.users.get(userId);
    if (!game || !user) return null;
    const a = this.allianceOf(userId);
    return {
      name: user.username,
      score: game.score(),
      protected: game.isProtected(),
      townLevel: game.level('ayuntamiento'),
      online: Date.now() - user.lastSeen < ONLINE_MS,
      vacation: !!game.state.vacation,
      inactive: this.isInactive(userId),
      banner: game.state.banner ?? null,
      alliance: a ? { id: a.id, tag: a.tag, name: a.name } : null,
      port: portOf(game.state),
      // Recién liberada: a salvo de bloqueos e invasiones desde `shieldFrom` hasta `shield`
      shield: game.state.shieldUntil || null,
      shieldFrom: game.state.shieldFrom ?? 0,
      // Estatua de una gesta ganada (tema y hasta cuándo)
      statue: game.state.statue ?? null,
    };
  }

  /** Si viene alguna flota enemiga hacia la ciudad de este jugador. */
  underAttack(userId) {
    const game = this.games.get(userId);
    return !!game && this.incoming(game.state.home).length > 0;
  }

  sameAlliance(a, b) {
    const x = this.memberOf.get(a);
    return x != null && x === this.memberOf.get(b);
  }

  /** Si `attacker` ha atacado, invadido o bloqueado a `victim` hace poco (para poder responderle aunque sea débil). */
  attackedBy(victim, attacker) {
    return (this.games.get(attacker)?.hitsOn(victim, PROTECTION.revengeHours) ?? 0) > 0;
  }

  /** Qué relación hay entre dos jugadores: 'aliado', 'pacto', 'guerra' o null. */
  relation(a, b) {
    const x = this.memberOf.get(a);
    const y = this.memberOf.get(b);
    if (x == null || y == null) return null;
    if (x === y) return 'aliado';
    return this.meta.diplomacy[pairKey(x, y)]?.type ?? null;
  }

  /**
   * Tropas de apoyo de otros jugadores estacionadas en la isla `homeId`.
   * `apply(left)` deja a cada una con sus supervivientes tras un combate.
   */
  supportersAt(homeId, hostId) {
    const out = [];
    for (const [uid, game] of this.games) {
      if (uid === hostId) continue;
      for (const mission of game.state.missions) {
        if (mission.type !== 'apoyo' || mission.phase !== 'estacionada' || mission.target !== homeId) continue;
        out.push({
          game,
          mission,
          apply: (left) => {
            mission.units = Object.fromEntries(Object.entries(left).filter(([, n]) => n > 0));
            if (!Object.keys(mission.units).length) game.state.missions = game.state.missions.filter((m) => m !== mission);
            game.dirty = true;
          },
        });
      }
    }
    return out;
  }

  /** Aviso para el dueño de una isla (alguien le manda tropas, etc.). */
  hostNews(ownerId, text) {
    const host = this.games.get(ownerId);
    if (!host) return;
    host.receiveNews(null, text, 'success');
    host.dirty = true;
  }

  /** Si dos jugadores dejan de ser aliados, sus tropas de apoyo vuelven a casa. */
  #recallBrokenSupport() {
    const now = clock.now();
    for (const [uid, game] of this.games) {
      for (const m of game.state.missions) {
        if (m.type !== 'apoyo' || m.phase !== 'estacionada') continue;
        const host = this.islands.get(m.target)?.owner;
        if (host != null && this.sameAlliance(uid, host)) continue;
        m.phase = 'vuelta';
        m.turn = now;
        m.back = now + (m.arrive - m.depart);
        game.dirty = true;
      }
    }
  }

  /** Llega un transporte de otro jugador a la isla de `ownerId`. */
  deliver(ownerId, payload, t) {
    const target = this.games.get(ownerId);
    if (!target) return false;
    target.update(t);
    target.receiveTransport(payload, t);
    target.dirty = true;
    return true;
  }

  islandsNear(homeId, radius) {
    const home = this.islands.get(homeId);
    if (!home) return [];
    const out = [];
    for (const isl of this.islands.values()) {
      const d = Math.hypot(isl.x - home.x, isl.z - home.z);
      if (d <= radius) out.push({ ...isl, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  /**
   * Una colonia abandonada queda libre. Si era una ciudad conquistada, los bárbaros la repueblan
   * desde cero (su guarnición y su botín vuelven a crecer poco a poco).
   */
  decolonize(id, userId, now = clock.now()) {
    const rt = this.islandStates.get(id);
    if (!rt || rt.colonizedBy !== userId) return false;
    rt.colonizedBy = null;
    rt.garrison = {};
    rt.garrisonAt = now;
    rt.stock = {};
    rt.stockAt = now;
    this.touch(id);
    this.mapCache = null;
    this.ownerList = null;
    return true;
  }

  colonize(id, userId) {
    const rt = this.islandStates.get(id);
    if (!rt || rt.colonizedBy != null) return false;
    rt.colonizedBy = userId;
    this.touch(id);
    this.ownerList = null;
    return true;
  }

  // ── Invasiones bárbaras ────────────────────────────────────────────────────

  /** Quién tiene colonia en cada continente (id del continente → ids de jugadores). */
  #colonistsByLand() {
    const out = new Map();
    for (const [uid, g] of this.games) {
      for (const c of g.state.colonies) {
        const land = this.islands.get(c.id)?.land;
        if (!land) continue;
        if (!out.has(land)) out.set(land, new Set());
        out.get(land).add(uid);
      }
    }
    return out;
  }

  #hoursMs(h) {
    return (h * 3_600_000) / universe.speed;
  }

  #between([a, b]) {
    return this.#hoursMs(a + Math.random() * (b - a));
  }

  /** Aparecen hordas en los continentes con colonias, y las que no se derrotan a tiempo saquean. */
  #updateHordes(now) {
    // Una vez cada diez segundos basta
    if (now - (this.hordeCheck ?? 0) < 10_000 / Math.max(1, universe.speed)) return;
    this.hordeCheck = now;
    const colonists = this.#colonistsByLand();
    for (const [land, uids] of colonists) {
      const cont = this.islands.get(land);
      const rt = this.islandStates.get(land);
      if (!cont || !rt) continue;
      // Mientras hay una gesta en el continente no llegan hordas (y la próxima espera a que acabe)
      if (rt.feat && rt.feat.stage !== 'fin' && !rt.horde) {
        const after = rt.feat.end + this.#hoursMs(24);
        if (!rt.nextHorde || rt.nextHorde < after) {
          rt.nextHorde = after;
          this.touch(land);
        }
        continue;
      }
      if (!rt.horde) {
        if (!rt.nextHorde) {
          rt.nextHorde = now + this.#between(HORDE.firstHours);
          this.touch(land);
        } else if (now >= rt.nextHorde) this.#spawnHorde(cont, rt, uids, now);
        continue;
      }
      if (now >= rt.horde.deadline) this.#ravage(cont, rt, uids, now);
    }
  }

  #spawnHorde(cont, rt, uids, now) {
    const k = 1 + HORDE.perColonist * (uids.size - 1);
    const garrison = Object.fromEntries(Object.entries(HORDE.garrison).map(([u, n]) => [u, Math.round(n * k)]));
    rt.horde = { spawn: now, deadline: now + this.#hoursMs(HORDE.warnHours), garrison, start: { ...garrison }, damage: {}, names: {}, colonists: uids.size };
    this.touch(cont.id);
    const total = Object.values(garrison).reduce((a, b) => a + b, 0);
    this.announce(`🔥 Una horda de ${total} bárbaros desembarca en ${cont.name}: arrasará sus colonias en ${HORDE.warnHours} h si nadie la detiene`);
    for (const uid of uids) {
      this.hostNews(uid, `🔥 ¡Una horda bárbara amenaza tus colonias de ${cont.name}! Atácala antes de ${HORDE.warnHours} h`);
      this.pendingPush.add(uid);
    }
    this.mapCache = null;
  }

  /** La horda no ha caído a tiempo: las colonias del continente se quedan un día sin producir. */
  #ravage(cont, rt, uids, now) {
    const until = now + this.#hoursMs(HORDE.ravageHours);
    for (const uid of uids) {
      const game = this.games.get(uid);
      game.update(now);
      for (const c of game.state.colonies) {
        if (this.islands.get(c.id)?.land !== cont.id) continue;
        c.raidedUntil = until;
        const crt = this.islandStates.get(c.id);
        if (crt) {
          crt.raidedUntil = until;
          this.touch(c.id);
        }
      }
      game.dirty = true;
      this.hostNews(uid, `🔥 La horda ha saqueado tus colonias de ${cont.name}: no producirán en ${HORDE.ravageHours} h`);
      this.pendingPush.add(uid);
    }
    this.announce(`🔥 Nadie detuvo a la horda: ha arrasado las colonias de ${cont.name}`);
    rt.horde = null;
    rt.nextHorde = now + this.#between(HORDE.gapHours);
    this.touch(cont.id);
  }

  /** La horda ha caído: botín para todos según los bárbaros que abatió cada uno, y una reliquia posible para el mejor. */
  hordeDefeated(id, t) {
    const rt = this.islandStates.get(id);
    const cont = this.islands.get(id);
    const h = rt?.horde;
    if (!h) return;
    const total = Object.values(h.damage).reduce((a, b) => a + b, 0) || 1;
    const k = 1 + HORDE.perColonist * ((h.colonists ?? 1) - 1);
    const ranking = Object.entries(h.damage).sort((a, b) => b[1] - a[1]);
    for (const [uid, n] of ranking) {
      const game = this.games.get(Number(uid));
      if (!game || !n) continue;
      const share = n / total;
      const bag = Object.fromEntries(Object.entries(HORDE.reward).map(([r, v]) => [r, Math.floor(v * k * share)]));
      game.giveResources(bag, `🏆 Tu parte del botín de la horda de ${cont.name} (${Math.round(share * 100)} % de los bárbaros abatidos)`);
      game.dirty = true;
      this.pendingPush.add(Number(uid));
    }
    const best = ranking[0];
    if (best && Math.random() < BASIC_RELIC_CHANCE) this.games.get(Number(best[0]))?.awardRelic(`entre los estandartes de la horda de ${cont.name}`, 'basica', t);
    const names = ranking.slice(0, 3).map(([uid, n]) => `${h.names?.[uid] ?? '¿?'} (${n})`).join(', ');
    this.announce(`🏆 ¡La horda de ${cont.name} ha sido derrotada! Más bárbaros abatidos: ${names}`);
    rt.horde = null;
    rt.nextHorde = t + this.#between(HORDE.gapHours);
    this.touch(id);
    this.mapCache = null;
  }

  // ── Gestas de la Liga ──────────────────────────────────────────────────────
  // Eventos cooperativos puntuales (data.js: FEATS y FEAT_THEMES; reglas puras en
  // src/game/feats.js). El calendario convoca a los imperios cercanos a un
  // continente; los que juran combaten en oleadas que se resuelven aquí, en el
  // tick, con la hora exacta de cada una (no según el orden de las partidas).

  /** Convoca las gestas del calendario y hace avanzar las que están en marcha. */
  #updateFeats(now) {
    this.meta.featSites ??= [];
    const cyc = featAt(now);
    // Se convoca al empezar los presagios (si el servidor estaba parado, mientras quede al menos la mitad)
    if (now >= cyc.omen && now < (cyc.omen + cyc.start) / 2 && this.meta.featCycle !== cyc.k) {
      this.meta.featCycle = cyc.k;
      this.#summonFeats(cyc, now);
    }
    for (const id of [...this.meta.featSites]) {
      const f = this.islandStates.get(id)?.feat;
      if (f) this.#runFeat(id, now);
      // Acabada y pasada la tregua, ya no hay nada que vigilar
      if (!f || (f.stage === 'fin' && now >= (f.truceUntil ?? f.end))) this.meta.featSites = this.meta.featSites.filter((x) => x !== id);
    }
  }

  /** Si un jugador puede ser convocado: activo, con algo de recorrido y sin perjurio. */
  #featCandidate(game, now) {
    const s = game.state;
    if (s.vacation || game.isProtected() || game.score() < FEATS.minPoints) return false;
    if ((s.history?.length ?? 0) < FEATS.minDays) return false;
    if ((s.perjuryUntil ?? 0) > now) return false;
    if (this.#inFeat(game.userId)) return false;
    return Date.now() - (s.lastSeen ?? 0) <= FEATS.seenHours * 3_600_000;
  }

  /** Si un jugador ya está convocado a una gesta que no ha acabado (solo se está en una a la vez). */
  #inFeat(uid, except = null) {
    for (const id of this.meta.featSites ?? []) {
      if (id === except) continue;
      const f = this.islandStates.get(id)?.feat;
      if (f && f.stage !== 'fin' && f.convoked.includes(uid)) return true;
    }
    return false;
  }

  /**
   * Al empezar los presagios de un ciclo: en cada continente libre se convoca a los imperios
   * cercanos (primero donde más hay), sin repetir a nadie.
   */
  #summonFeats(cyc, now) {
    let pool = [...this.games.values()].filter((g) => this.#featCandidate(g, now));
    const homeOf = (g) => this.islands.get(g.state.home);
    const sites = new Map();
    const busy = (c) => {
      const rt = this.islandStates.get(c.id);
      return !rt || rt.horde || (rt.feat && rt.feat.stage !== 'fin');
    };
    for (const radius of [FEATS.radius, FEATS.radiusMax]) {
      let free = [...this.islands.values()].filter((c) => c.type === 'continente' && !sites.has(c.id) && !busy(c));
      while (pool.length >= FEATS.minConvoked && free.length) {
        let best = null;
        for (const c of free) {
          const near = pool
            .map((g) => ({ g, d: Math.hypot(homeOf(g).x - c.x, homeOf(g).z - c.z) }))
            .filter((x) => x.d <= radius)
            .sort((a, b) => a.d - b.d);
          if (!best || near.length > best.near.length) best = { c, near };
        }
        if (!best || best.near.length < FEATS.minConvoked) break;
        const chosen = best.near.slice(0, FEATS.maxConvoked).map((x) => x.g);
        sites.set(best.c.id, chosen);
        pool = pool.filter((g) => !chosen.includes(g));
        free = free.filter((c) => c !== best.c);
      }
    }
    for (const [site, games] of sites) this.startFeat(site, { ...cyc, players: games.map((g) => g.userId) }, now);
    for (const g of pool) {
      g.receiveNews(null, `${FEAT_THEMES[cyc.theme].icon} ${cap(FEAT_THEMES[cyc.theme].enemy)} despierta en el archipiélago, pero esta vez no hay ninguna gesta cerca de tu ciudad`, 'info');
      this.pendingPush.add(g.userId);
    }
    if (sites.size) {
      const t = FEAT_THEMES[cyc.theme];
      const names = [...sites.keys()].map((id) => this.islands.get(id)?.name).join(', ');
      this.announce(`${t.icon} ${t.name}: presagios en ${names}. Los imperios cercanos están convocados a la gesta.`);
    }
  }

  /**
   * Empieza una gesta en el continente `site` con los jugadores `players` convocados. La usa el
   * calendario y también la moderación (y las pruebas). Devuelve si ha podido.
   */
  startFeat(site, { theme = Object.keys(FEAT_THEMES)[0], k = null, omen, start, end, players = [] }, now = clock.now()) {
    const isl = this.islands.get(site);
    const rt = this.islandStates.get(site);
    if (isl?.type !== 'continente' || !rt || rt.horde || (rt.feat && rt.feat.stage !== 'fin')) return false;
    omen ??= now;
    start ??= omen + Math.round(featHours(FEATS.omenHours));
    end ??= start + Math.round(featHours(FEATS.hours));
    // Nadie está en dos gestas a la vez
    players = players.filter((uid) => !this.#inFeat(uid, site));
    // Cada sitio tiene su propio desfase de oleadas (reparte la carga y los husos horarios)
    let h = 0;
    for (const ch of String(site)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const waveMs = Math.round(featHours(FEATS.waveHours));
    rt.feat = {
      k: k ?? `m${start}`,
      theme,
      stage: 'presagio',
      omen,
      start,
      end,
      nextWave: start + (h % 997) / 997 * waveMs,
      tier: rt.featTier ?? 0,
      convoked: [...players],
      pledged: {},
      names: {},
      boss: null,
      glory: {},
      brought: {},
      risk: {},
      fallen: {},
      waves: [],
      perjurers: [],
      perjuryDone: false,
      result: null,
      truceUntil: end,
      forge: { goal: 0, total: 0, by: {} },
    };
    rt.feat.nextWave = Math.round(rt.feat.nextWave);
    if (rt.nextHorde) rt.nextHorde = Math.max(rt.nextHorde, end + this.#hoursMs(24));
    for (const uid of players) {
      const g = this.games.get(uid);
      if (!g) continue;
      g.update(now);
      g.featSummoned({ k: rt.feat.k, site, theme, siteName: isl.name }, now);
      this.pendingPush.add(uid);
    }
    this.meta.featSites = [...new Set([...(this.meta.featSites ?? []), site])];
    this.touch(site);
    this.mapCache = null;
    return true;
  }

  /** Moderación: lanza ya una gesta en el continente más cercano a quien la pide (o en el que se nombre). */
  adminStartFeat(adminId, { site = null, omenMinutes = null } = {}) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    // «/gesta hidra Kalos 5»: la primera palabra puede ser el tema (tifon, armada o hidra)
    let theme = null;
    if (site) {
      const [first, ...rest] = String(site).trim().split(/\s+/);
      if (FEAT_THEMES[nameKey(first)]) {
        theme = nameKey(first);
        site = rest.join(' ') || null;
      }
    }
    const me = this.islands.get(this.games.get(adminId)?.state.home) ?? { x: 0, z: 0 };
    const free = [...this.islands.values()].filter((c) => c.type === 'continente' && (!site || c.id === site || c.name === site));
    free.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    const cont = free.find((c) => {
      const rt = this.islandStates.get(c.id);
      return rt && !rt.horde && !(rt.feat && rt.feat.stage !== 'fin');
    });
    if (!cont) throw new UserError('No hay ningún continente libre para la gesta.');
    const now = clock.now();
    const players = [...this.games.values()]
      .filter((g) => !g.state.vacation && !this.#inFeat(g.userId))
      .map((g) => ({ g, d: Math.hypot(this.islands.get(g.state.home).x - cont.x, this.islands.get(g.state.home).z - cont.z) }))
      .filter((x) => x.d <= FEATS.radiusMax)
      .sort((a, b) => a.d - b.d)
      .slice(0, FEATS.maxConvoked)
      .map((x) => x.g.userId);
    const omen = now;
    const start = omen + Math.round(omenMinutes != null ? (Math.max(1, Number(omenMinutes) || 1) * 60_000) / universe.speed : featHours(FEATS.omenHours));
    this.startFeat(cont.id, { ...(theme ? { theme } : {}), omen, start, players }, now);
    const t = FEAT_THEMES[theme ?? Object.keys(FEAT_THEMES)[0]];
    this.announce(`${t.icon} Los moderadores despiertan una gesta en ${cont.name}: ${t.name}`);
    return { site: cont.id, name: cont.name, players: players.length };
  }

  /** Un jugador jura la gesta del continente `site`. `snap`: { name, at, power, prod, mix }. */
  pledgeFeat(uid, site, snap, t) {
    const f = this.islandStates.get(site)?.feat;
    if (!f || f.stage === 'fin') return { ok: false, reason: 'No hay ninguna gesta en ese continente.' };
    if (!f.convoked.includes(uid)) return { ok: false, reason: 'No te han convocado a esta gesta.' };
    if (f.pledged[uid]) return { ok: false, reason: 'Ya has jurado esta gesta.' };
    if (f.perjurers.includes(uid)) return { ok: false, reason: 'Rompiste tu juramento: ya no puedes volver a jurar esta gesta.' };
    if (t >= f.start + featHours(FEATS.pledgeCloseHours)) return { ok: false, reason: 'El juramento ya está cerrado: la lucha va muy avanzada.' };
    const { AM, HM, AL, HL, f: force } = snap.power;
    f.pledged[uid] = { name: snap.name, at: t, P: { AM, HM, AL, HL }, f: force, prod: snap.prod, mix: snap.mix };
    f.names[uid] = snap.name;
    this.#forgeGoal(f);
    // Jurar con la lucha empezada endurece al enemigo
    if (f.boss) this.#rebaseFeat(f, site);
    this.touch(site);
    for (const id of Object.keys(f.pledged)) this.pendingPush.add(Number(id));
    return { ok: true, k: f.k, theme: f.theme };
  }

  /** La meta de la fragua sale de la producción de los que siguen jurados. */
  #forgeGoal(f) {
    f.forge ??= { goal: 0, total: 0, by: {} };
    f.forge.goal = forgeGoal(Object.values(f.pledged).map((p) => p.prod ?? 0), forgeHours(f.theme));
  }

  /** Cuánto puede ofrendar aún un jugador en la fragua de `site`. */
  featForgeRoom(uid, site, t) {
    const f = this.islandStates.get(site)?.feat;
    if (!f || f.stage === 'fin' || t >= f.end) return { ok: false, reason: 'No hay ninguna gesta en marcha en ese continente.' };
    const me = f.pledged[uid];
    if (!me) return { ok: false, reason: 'Jura primero la gesta para poder ofrendar en su fragua.' };
    f.forge ??= { goal: 0, total: 0, by: {} };
    return { ok: true, room: Math.floor(forgeRoom(f.forge, uid, me.prod)), full: f.forge.total - (f.forge.used ?? 0) >= f.forge.goal };
  }

  /** Apunta una ofrenda (ya pagada) en la fragua: suma a la meta y da gloria. */
  featForge(uid, site, value, t) {
    const f = this.islandStates.get(site)?.feat;
    if (!f?.pledged[uid] || !(value > 0)) return;
    const F = FEATS.forge;
    const forge = (f.forge ??= { goal: 0, total: 0, by: {} });
    const before = forgeBonus(forge).quarters;
    forge.by[uid] = (forge.by[uid] ?? 0) + value;
    forge.total += value;
    if (forge.goal) f.glory[uid] = (f.glory[uid] ?? 0) + (F.glory * value) / forge.goal;
    const after = forgeBonus(forge).quarters;
    if (after > before && FEAT_THEMES[f.theme].forge !== 'brea') {
      const theme = FEAT_THEMES[f.theme];
      const name = this.islands.get(site)?.name ?? '';
      for (const id of Object.keys(f.pledged)) {
        this.games.get(Number(id))?.receiveNews(null, `🔥 La fragua de Hefesto en ${name} llega al ${after * 25} %: +${Math.round(after * F.atk * 1000) / 10} % de ataque contra ${theme.enemy}${after * F.lava >= 1 ? ' y ya no os alcanza su lava' : ` y un ${Math.round(after * F.lava * 100)} % menos de lava`}`, 'success');
        this.pendingPush.add(Number(id));
      }
    }
    this.touch(site);
  }

  /** Llega una flota a la gesta: puede esperar a la oleada si su dueño la juró y aún no ha acabado. */
  featArrive(site, uid, t, m = null) {
    const f = this.islandStates.get(site)?.feat;
    const theme = f ? FEAT_THEMES[f.theme] : null;
    if (!f || f.stage === 'fin' || t >= f.end) return { ok: false, reason: 'La gesta ya ha terminado. La flota vuelve a casa.' };
    if (!f.pledged[uid]) return { ok: false, reason: 'No juraste esta gesta: tu flota se da la vuelta.' };
    // Armada: un fondeadero que exista, y uno solo por jugador
    if (m?.type === 'bloquear') {
      const posts = f.boss?.posts?.length ?? this.#featCtx(site, f).posts;
      if (theme.kind !== 'armada' || !(m.post >= 0 && m.post < posts)) return { ok: false, reason: 'Ahí no hay ningún fondeadero que tomar. La flota vuelve a casa.' };
      const other = this.games.get(uid)?.state.missions.some((x) => x !== m && x.feat === site && x.type === 'bloquear' && x.phase === 'estacionada' && x.post !== m.post);
      if (other) return { ok: false, reason: 'Ya tienes una flota en otro fondeadero: solo puedes sostener uno.' };
    }
    return { ok: true, icon: theme.icon, enemy: theme.enemy, post: m?.type === 'bloquear' ? m.post : null };
  }

  /** Tregua sagrada: los que juraron la misma gesta no se pueden atacar desde que emerge el enemigo hasta unas horas después (salvo en guerra). */
  truce(a, b, t) {
    if (a === b || this.relation(a, b) === 'guerra') return false;
    for (const id of this.meta.featSites ?? []) {
      const f = this.islandStates.get(id)?.feat;
      if (!this.#inTruce(f, t)) continue;
      if (f.pledged[a] && f.pledged[b]) return true;
    }
    return false;
  }

  /**
   * Si en el instante `t` corre la tregua de una gesta. No depende de que el bucle ya la haya puesto
   * al día: emerge en `start` si para entonces juraron bastantes, y mientras no acabe la tregua llega
   * hasta el final más unas horas (así manda el orden de los hechos, como con los puertos).
   */
  #inTruce(f, t) {
    if (!f) return false;
    let from = f.emergedAt;
    if (from == null) {
      if (f.stage !== 'presagio' || t < f.start) return false;
      const powers = Object.values(f.pledged).map((p) => ({ ...p.P, f: p.f }));
      if (powers.length < FEATS.minPledges || pledgeEmpires(powers) < FEATS.minEffective) return false;
      from = f.start;
    }
    const until = f.stage === 'fin' ? (f.truceUntil ?? f.end) : f.end + Math.round(featHours(FEATS.truceAfterHours));
    return t >= from && t < until;
  }

  /** Con quién tiene tregua ahora un jugador (para el navegador). */
  #truceWith(uid, t) {
    const out = new Set();
    for (const id of this.meta.featSites ?? []) {
      const f = this.islandStates.get(id)?.feat;
      if (!this.#inTruce(f, t) || !f.pledged[uid]) continue;
      for (const other of Object.keys(f.pledged)) if (Number(other) !== uid && this.relation(uid, Number(other)) !== 'guerra') out.add(Number(other));
    }
    return [...out];
  }

  /** Hace avanzar una gesta hasta `now`, suceso a suceso y en orden: emerger, oleadas, perjuros y final. */
  #runFeat(id, now) {
    const rt = this.islandStates.get(id);
    const f = rt.feat;
    const perjuryAt = f.start + Math.round(featHours(FEATS.perjuryHours));
    for (let guard = 0; guard < 200 && f.stage !== 'fin'; guard++) {
      const events = [];
      const { start, end, nextWave } = f;
      if (!f.boss) events.push([start, 0, () => this.#emergeFeat(id, start)]);
      else {
        if (nextWave <= end) events.push([nextWave, 1, () => this.#featWave(id, nextWave)]);
        if (!f.perjuryDone) events.push([perjuryAt, 2, () => this.#purgePerjurers(id, perjuryAt)]);
        events.push([end, 3, () => this.#finishFeat(id, end)]);
      }
      events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const ev = events[0];
      if (!ev || ev[0] > now) break;
      if (ev[1] === 1) f.nextWave = nextWave + Math.round(featHours(FEATS.waveHours));
      ev[2]();
    }
  }

  /** Empieza la lucha: si han jurado bastantes imperios, emerge el enemigo a la medida de su poder. */
  #emergeFeat(id, t) {
    const rt = this.islandStates.get(id);
    const f = rt.feat;
    const theme = FEAT_THEMES[f.theme];
    const name = this.islands.get(id)?.name ?? '';
    const pledged = Object.values(f.pledged);
    const powers = pledged.map((p) => ({ ...p.P, f: p.f }));
    if (pledged.length < FEATS.minPledges || pledgeEmpires(powers) < FEATS.minEffective) {
      f.stage = 'fin';
      f.result = 'dormido';
      f.truceUntil = t;
      this.#releaseFeatFleets(id, t, `${theme.icon} ${cap(theme.enemy)} vuelve a dormirse: tu flota vuelve a casa`);
      for (const uid of f.convoked) {
        this.games.get(uid)?.receiveNews(null, `${theme.icon} No se juntaron bastantes imperios y ${theme.enemy} vuelve a dormirse en ${name}. Nadie pierde nada.`, 'info');
        this.pendingPush.add(uid);
      }
      this.touch(id);
      return;
    }
    const boss = featBoss(f.theme, capByRest(powers), f.tier, this.#featCtx(id, f));
    f.boss = { ...boss, phase: 0, full: bossFull(theme, boss) };
    f.stage = 'lucha';
    f.emergedAt = t;
    const headline = theme.arrives ? theme.arrives(name) : `¡${cap(theme.enemy)} emerge en ${name}!`;
    this.announce(`${theme.icon} ${headline} ${pledged.length} imperios han jurado hacerle frente.`);
    for (const uid of Object.keys(f.pledged)) {
      this.games.get(Number(uid))?.receiveNews(null, `${theme.icon} ${headline} La primera oleada, en cuanto lleguen las flotas.`, 'error');
      this.pendingPush.add(Number(uid));
    }
    this.touch(id);
  }

  /** Las flotas que esperan en la gesta `id` desde antes de `tw` (y de jugadores que la juraron). */
  #featFleets(id, tw) {
    const f = this.islandStates.get(id).feat;
    const out = [];
    for (const [uid, game] of this.games) {
      if (!f.pledged[uid]) continue;
      for (const m of game.state.missions) if (m.feat === id && m.phase === 'estacionada' && (m.waitSince ?? Infinity) <= tw) out.push({ uid, game, m });
    }
    return out;
  }

  /**
   * Una oleada: las flotas que esperan combaten juntas contra el enemigo. Cada tema tiene su
   * combate (#waveTifon, #waveHydra, #waveArmada); el reparto de supervivientes, gloria e informes
   * es común (#featSettle).
   */
  #featWave(id, tw) {
    const f = this.islandStates.get(id).feat;
    const boss = f.boss;
    const theme = FEAT_THEMES[f.theme];
    const kind = theme.kind ?? 'tifon';
    const name = this.islands.get(id)?.name ?? '';
    const all = this.#featFleets(id, tw);
    // En la Armada, las flotas de los fondeaderos combaten aparte (y se quedan)
    const posted = kind === 'armada' ? all.filter((x) => x.m.type === 'bloquear') : [];
    const groups = all
      .filter((x) => !posted.includes(x))
      .map((x) => {
        const c = playerCombat(x.game.state);
        return { ...x, units: { ...x.m.units }, atkMul: c.atkMul, hpMul: c.hpMul };
      });
    const forces = groups.map((g) => forceOf(g.units, g.atkMul, g.hpMul));
    // Cada jugador cuenta una vez, aunque traiga varias flotas
    const byPlayer = {};
    groups.forEach((g, i) => (byPlayer[g.uid] = (byPlayer[g.uid] ?? 0) + forces[i]));
    const N = effectiveEmpires(Object.values(byPlayer));
    const coop = featCoop(N);
    const wave = { t: tw, players: Object.keys(byPlayer).length, N: Math.round(N * 100) / 100, coop: Math.round(coop * 100) / 100, phase: boss.phase ?? 0, killed: 0 };
    const fmtN = String(wave.N).replace('.', ',');
    const ctx = { id, f, boss, theme, name, tw, groups, forces, coop, wave, lines: [] };

    // La Armada: primero los fondeaderos (no tienen coraza)
    if (kind === 'armada') this.#armadaPosts(ctx, posted);

    if (!groups.length || coop <= 0) {
      // Sin combate: Tifón se rehace un poco (sus cabezas no, que no se curan)
      let regrow = '';
      if (kind === 'tifon') {
        const unit = theme.phases[boss.phase].unit;
        if (unit !== 'cabeza') {
          boss[unit] = Math.min(boss.full[unit], boss[unit] + Math.ceil(FEATS.regrow * boss.full[unit]));
          regrow = ` y ${theme.enemy} se rehace un ${Math.round(FEATS.regrow * 100)} %`;
        }
      }
      if (kind === 'armada') this.#armadaCamp(ctx, 0);
      // Quien trajo su flota cumplió su juramento aunque la coraza no cediera
      f.present ??= {};
      for (const g of groups) f.present[g.uid] = true;
      for (const g of groups) {
        g.game.receiveNews(null, `${theme.icon} La coraza de ${theme.enemy} no cede: en la oleada solo había ${fmtN} imperios efectivos. Hacen falta más (tu flota sigue esperando).`, 'error');
        this.pendingPush.add(g.uid);
      }
      this.announce(`${theme.icon} Oleada sin asalto: ${groups.length ? `solo ${fmtN} imperios efectivos esperaban` : 'no esperaba ninguna flota'}${regrow}. ${ctx.lines.join(' ')}`.trim(), `f:${id}`);
      f.waves = [...f.waves, wave].slice(-16);
      this.touch(id);
      return;
    }

    const army = combineGroups(groups);
    // La fragua de Hefesto: más ataque y menos lava (en la Hidra hace brea y no da ataque)
    const forge = theme.forge === 'brea' ? { atk: 1, lava: 1 } : forgeBonus(f.forge);
    army.atkMul *= forge.atk;
    Object.assign(ctx, { army, forge, glory: groups.map(() => 0), kills: groups.map(() => 0), units: army.units, main: null });
    if (kind === 'armada') this.#waveArmada(ctx);
    else if (kind === 'hidra') this.#waveHydra(ctx);
    else this.#waveTifon(ctx);

    const lefts = shareSurvivors(groups.map((g) => g.units), ctx.units);
    const text = (i) =>
      `${groups.length > 1 ? `Combatís ${Object.keys(byPlayer).length} imperios juntos` : 'Combates'} (${fmtN} imperios efectivos: el ${Math.round(coop * 100)} % de vuestro daño atraviesa su coraza). ${ctx.lines.join(' ')} Tu gloria: +${Math.round(ctx.glory[i])}.`;
    this.#featSettle(ctx, groups, lefts, ctx.glory, ctx.kills, forces, ctx.main, text);
    f.waves = [...f.waves, wave].slice(-16);
    this.touch(id);
    // Resumen de la oleada en el chat de la gesta, para coordinarse
    this.announce(`${theme.icon} Oleada: ${Object.keys(byPlayer).length} imperios (${fmtN} efectivos, coraza ${Math.round(coop * 100)} %). ${ctx.lines.join(' ')}`, `f:${id}`);
    if (ctx.victory) this.#finishFeat(id, tw, 'victoria', groups);
    else if (kind === 'tifon' && wave.phase !== boss.phase) this.announce(`${theme.icon} ${name}: cae la fase «${theme.phases[wave.phase].name}» de ${theme.enemy}. Empieza «${theme.phases[boss.phase].name}».`);
  }

  /** Reparte la gloria y las bajas de un combate entre los grupos según `weights`. */
  #featCredit(ctx, amount, killed, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((w, i) => {
      const k = total ? w / total : 1 / weights.length;
      ctx.glory[i] += amount * k;
      ctx.kills[i] += killed * k;
    });
  }

  /** Peso de cada grupo en tierra: sus tropas desembarcadas más un cuarto de sus barcos. */
  #landWeights(ctx, unitsByGroup) {
    return unitsByGroup.map((u, i) => forceOf(splitWar(u).land, ctx.groups[i].atkMul, ctx.groups[i].hpMul) + 0.25 * forceOf(splitWar(u).sea, ctx.groups[i].atkMul, ctx.groups[i].hpMul));
  }

  /** Tifón: el mar con sus sierpes y, ganado el mar, gigantes y después las cabezas. */
  #waveTifon(ctx) {
    const { boss, theme, coop, army, forge, wave, groups, lines } = ctx;
    const phases = theme.phases;
    const T = theme.tune;
    // Fase I: en el mar (solo cuentan los barcos de guerra). Si se gana, se desembarca en la misma oleada
    let landNow = boss.phase >= 1;
    if (boss.phase === 0) {
      const r = assault({ units: ctx.units, atkMul: army.atkMul, hpMul: army.hpMul }, { units: { sierpe: boss.sierpe }, atkMul: 1, hpMul: 1 / coop });
      const killed = boss.sierpe - (r.def.left.sierpe ?? 0);
      boss.sierpe -= killed;
      this.#featCredit(ctx, (killed / boss.full.sierpe) * phases[0].glory, killed, groups.map((g) => forceOf(splitWar(g.units).sea, g.atkMul, g.hpMul)));
      wave.killed += killed;
      lines.push(`En el mar abatís ${killed} ${killed === 1 ? 'sierpe' : 'sierpes'}${boss.sierpe ? ` (quedan ${boss.sierpe})` : ': el mar es vuestro'}.`);
      ctx.units = r.att.left;
      ctx.main = r;
      if (boss.sierpe <= 0) {
        boss.phase = 1;
        landNow = r.landed;
      }
    }
    // Fases en tierra: gigantes y después las cabezas
    if (landNow && boss.phase >= 1 && boss.phase < phases.length) {
      const now = shareSurvivors(groups.map((g) => g.units), ctx.units);
      const unit = phases[boss.phase].unit;
      const fury = unit === 'cabeza' && boss.cabeza <= T.furyAt;
      const def =
        unit === 'cabeza'
          ? { units: { cabeza: boss.cabeza }, atkMul: boss.headAtk * (fury ? T.fury : 1), hpMul: boss.headHp / coop, extraAtk: fury ? boss.lava * forge.lava : 0, extraOnlyAlive: true }
          : { units: { [unit]: boss[unit] }, atkMul: 1, hpMul: 1 / coop };
      const r = assault({ units: ctx.units, atkMul: army.atkMul, hpMul: army.hpMul }, def);
      const killed = boss[unit] - (r.def.left[unit] ?? 0);
      boss[unit] -= killed;
      this.#featCredit(ctx, (killed / boss.full[unit]) * phases[boss.phase].glory, killed, this.#landWeights(ctx, now));
      wave.killed += killed;
      const what = unit === 'cabeza' ? (killed === 1 ? 'cabeza' : 'cabezas') : killed === 1 ? 'gigante' : 'gigantes';
      lines.push(`${r.landed ? 'En tierra' : 'No llegáis a desembarcar:'} abatís ${killed} ${what}${boss[unit] ? ` (quedan ${boss[unit]})` : ''}${fury ? ' contra su furia' : ''}.`);
      ctx.units = r.att.left;
      // Si en la misma oleada se luchó en el mar y en tierra, el informe lleva las dos batallas
      ctx.main = ctx.main ? joinBattles(ctx.main, r) : r;
      if (boss[unit] <= 0) boss.phase += 1;
    }
    ctx.victory = boss.phase >= phases.length;
  }

  /**
   * La Hidra: se cortan cabezas en tierra; las que no se cauterizan con la brea de la fragua vuelven
   * como dos, y la última solo cae cauterizada y con bastantes imperios en la oleada.
   */
  #waveHydra(ctx) {
    const { f, boss, theme, coop, army, wave, groups, lines } = ctx;
    const T = theme.tune;
    const now = shareSurvivors(groups.map((g) => g.units), ctx.units);
    const heads = boss.hidra;
    const r = assault({ units: ctx.units, atkMul: army.atkMul, hpMul: army.hpMul }, { units: { hidra: heads }, atkMul: boss.headAtk, hpMul: boss.headHp / coop });
    let killed = heads - (r.def.left.hidra ?? 0);
    // Cauterizar con la brea que haya en la fragua
    const forge = (f.forge ??= { goal: 0, total: 0, by: {} });
    const avail = Math.max(0, (forge.total ?? 0) - (forge.used ?? 0));
    const can = Math.floor(avail / boss.brea);
    // La cabeza inmortal: si caerían todas, la última solo cae cauterizada y con la coraza abierta
    const immortal = killed === heads && !(coop >= T.finalCoop && can >= killed);
    if (immortal) killed -= 1;
    const burnt = Math.min(killed, can);
    forge.used = (forge.used ?? 0) + burnt * boss.brea;
    const next = Math.min(T.maxHeads, heads - killed + 2 * (killed - burnt));
    boss.hidra = next;
    boss.cut = (boss.cut ?? 0) + killed;
    this.#featCredit(ctx, (killed / T.heads) * theme.phases[0].glory, killed, this.#landWeights(ctx, now));
    wave.killed += killed;
    const grown = killed - burnt;
    lines.push(
      `${r.landed ? 'En tierra' : 'No llegáis a desembarcar:'} cortáis ${killed} ${killed === 1 ? 'cabeza' : 'cabezas'}${burnt ? `, cauterizáis ${burnt} con la brea` : ''}${grown ? ` y ${grown === 1 ? 'una vuelve' : `${grown} vuelven`} como dos` : ''}.${immortal ? ' La cabeza inmortal resiste: solo cae cauterizada y con al menos 3 imperios efectivos.' : ''} ${next ? `Quedan ${next}.` : '¡La Hidra cae!'}`,
    );
    ctx.units = r.att.left;
    ctx.main = r;
    ctx.victory = next === 0;
  }

  /**
   * La Armada, en el mar: cada fondeadero libre se toma contra su escuadra; uno tomado aguanta sus
   * salidas (cada vez mayores). Las flotas de los fondeaderos se quedan hasta caer o retirarse.
   */
  #armadaPosts(ctx, posted) {
    const { f, boss, theme } = ctx;
    const T = theme.tune;
    const full = boss.posts.every((p) => p.holder != null);
    boss.posts.forEach((post, i) => {
      const here = posted.filter((x) => x.m.post === i);
      if (!here.length) {
        if (post.holder != null) {
          // Se fueron todos: el fondeadero vuelve a estar libre
          post.holder = null;
          post.held = 0;
          post.freeWaves = 0;
          post.squad = Math.max(post.squad, Math.ceil(post.full / 2));
        } else if (++post.freeWaves >= T.regenWaves) post.squad = post.full;
        return;
      }
      const groups = here.map((x) => {
        const c = playerCombat(x.game.state);
        return { ...x, units: { ...x.m.units }, atkMul: c.atkMul, hpMul: c.hpMul };
      });
      const forces = groups.map((g) => forceOf(g.units, g.atkMul, g.hpMul));
      const army = combineGroups(groups);
      const taking = post.holder == null;
      const enemy = taking ? post.squad : Math.ceil(post.full * (T.sortie + T.sortieStep * (post.held + 1)));
      const r = battle({ units: army.units, atkMul: army.atkMul, hpMul: army.hpMul }, { units: { fenicia: enemy } });
      const killed = enemy - (r.def.left.fenicia ?? 0);
      const alive = hasCombat(r.att.left);
      const local = { ...ctx, groups, glory: groups.map(() => 0), kills: groups.map(() => 0) };
      const weights = forces;
      let text;
      if (taking) {
        post.squad -= killed;
        if (post.squad <= 0 && alive) {
          post.holder = groups[0].uid;
          post.held = 0;
          post.freeWaves = 0;
          post.squad = 0;
          this.#featCredit(local, T.takeGlory, killed, weights);
          text = `Tomáis el fondeadero ${i + 1}: su escuadra se hunde.`;
        } else {
          this.#featCredit(local, 0, killed, weights);
          text = `El fondeadero ${i + 1} resiste: hundís ${killed} ${killed === 1 ? 'fenicia' : 'fenicias'} (quedan ${Math.max(0, post.squad)}).`;
        }
      } else if (alive) {
        post.held += 1;
        const g = T.postGlory * (full ? 2 : 1);
        this.#featCredit(local, g, killed, weights);
        for (const x of groups) (f.held ??= {})[x.uid] = (f.held[x.uid] ?? 0) + 1;
        text = `El fondeadero ${i + 1} aguanta una salida de ${enemy} fenicias${full ? ' (con el cerco completo, doble gloria)' : ''}.`;
      } else {
        post.holder = null;
        post.held = 0;
        post.freeWaves = 0;
        post.squad = r.def.left.fenicia ?? 0;
        this.#featCredit(local, 0, killed, weights);
        text = `Una salida de ${enemy} fenicias rompe el fondeadero ${i + 1}: vuelve a estar libre.`;
      }
      ctx.lines.push(text);
      const lefts = shareSurvivors(groups.map((g) => g.units), r.att.left);
      const report = (k) => `${text} Tu gloria: +${Math.round(local.glory[k])}.`;
      this.#featSettle({ ...ctx, wave: { ...ctx.wave, killed: alive ? 1 : 0 } }, groups, lefts, local.glory, local.kills, forces, r, report, { stay: true, title: `Fondeadero ${i + 1}` });
    });
    boss.free = boss.posts.filter((p) => p.holder == null).length;
  }

  /** La Armada, en tierra: el asalto al campamento (con sus escuadras libres en el mar). */
  #waveArmada(ctx) {
    const { boss, theme, coop, army, wave, groups, lines } = ctx;
    const T = theme.tune;
    const free = boss.free ?? boss.posts.filter((p) => p.holder == null).length;
    const before = { inmortal: boss.inmortal, arquero_persa: boss.arquero_persa };
    // Las escuadras de los fondeaderos libres defienden el mar
    const freeSquads = boss.posts.filter((p) => p.holder == null).reduce((a, p) => a + Math.max(0, p.squad), 0);
    let r = null;
    if (freeSquads > 0) {
      r = assault({ units: ctx.units, atkMul: army.atkMul, hpMul: army.hpMul }, { units: { fenicia: freeSquads }, hpMul: 1 / coop });
      const sunk = freeSquads - (r.def.left.fenicia ?? 0);
      // Las bajas se reparten entre las escuadras libres
      let left = sunk;
      for (const p of boss.posts.filter((x) => x.holder == null)) {
        const k = Math.min(p.squad, Math.round((sunk * p.squad) / freeSquads), left);
        p.squad -= k;
        left -= k;
      }
      lines.push(`En el mar hundís ${sunk} fenicias de las escuadras libres${r.seaWon ? '' : ': no llegáis a desembarcar'}.`);
      ctx.units = r.att.left;
      ctx.main = r;
      if (!r.seaWon) {
        this.#armadaCamp(ctx, 0);
        ctx.victory = false;
        return;
      }
    }
    const now = shareSurvivors(groups.map((g) => g.units), ctx.units);
    const camp = { inmortal: boss.inmortal, arquero_persa: boss.arquero_persa };
    const hp = Math.max(0.3, 1 + T.siegeHp * free - boss.hunger);
    const towers = T.towers * (camp.inmortal * UNITS.inmortal.atk + camp.arquero_persa * UNITS.arquero_persa.atk) * boss.campAtk;
    const r2 = assault({ units: ctx.units, atkMul: army.atkMul, hpMul: army.hpMul }, { units: camp, atkMul: boss.campAtk, hpMul: hp / coop, wallHp: T.wall, extraAtk: towers, extraOnlyAlive: true }, { needLanding: true });
    boss.inmortal = r2.def.left.inmortal ?? 0;
    boss.arquero_persa = r2.def.left.arquero_persa ?? 0;
    const lifeOf = (u) => (u.inmortal ?? 0) * UNITS.inmortal.hp + (u.arquero_persa ?? 0) * UNITS.arquero_persa.hp;
    const removed = lifeOf(before) - lifeOf(boss);
    const killed = before.inmortal + before.arquero_persa - boss.inmortal - boss.arquero_persa;
    this.#featCredit(ctx, (removed / Math.max(1, lifeOf(boss.full))) * theme.phases[1].glory, killed, this.#landWeights(ctx, now));
    wave.killed += killed;
    lines.push(`${r2.landed ? 'En el campamento' : 'No llegáis a desembarcar:'} abatís ${killed} persas (quedan ${boss.inmortal + boss.arquero_persa}).`);
    ctx.units = r2.att.left;
    ctx.main = ctx.main ? joinBattles(ctx.main, r2) : r2;
    this.#armadaCamp(ctx, killed, before);
    ctx.victory = boss.inmortal + boss.arquero_persa <= 0;
  }

  /** El campamento tras la oleada: con fondeaderos libres se rehace; con el cerco completo pasa hambre. */
  #armadaCamp(ctx, killed, before = null) {
    const { boss, theme, lines } = ctx;
    const T = theme.tune;
    const K = boss.posts.length;
    const free = boss.posts.filter((p) => p.holder == null).length;
    if (free === 0) {
      boss.hunger = Math.min(T.hungerMax, (boss.hunger ?? 0) + T.hunger);
      lines.push(`Cerco completo: el campamento pasa hambre (−${Math.round(boss.hunger * 100)} % de vida).`);
    } else if (killed > 0 && before) {
      // Por los fondeaderos libres le llegan refuerzos: recupera parte de lo perdido
      for (const u of ['inmortal', 'arquero_persa']) {
        const lost = before[u] - boss[u];
        boss[u] = Math.min(boss.full[u], boss[u] + Math.round((lost * free) / K));
      }
      if (boss.inmortal + boss.arquero_persa > 0) lines.push(`Por ${free === 1 ? 'el fondeadero libre' : `los ${free} fondeaderos libres`} le llegan refuerzos.`);
    }
  }

  /**
   * Cierra una oleada para cada grupo: supervivientes, gloria, bajas propias (sin mercenarios),
   * informe y vuelta a casa (o se quedan, en los fondeaderos de la Armada).
   */
  #featSettle(ctx, groups, lefts, glory, kills, forces, main, text, { stay = false, title = null } = {}) {
    const { f, theme, id, name, tw, wave } = ctx;
    const phases = theme.phases;
    groups.forEach((g, i) => {
      const uid = g.uid;
      const left = lefts[i];
      const lost = {};
      for (const [u, n] of Object.entries(g.units)) if (n - (left[u] ?? 0) > 0) lost[u] = n - (left[u] ?? 0);
      f.glory[uid] = (f.glory[uid] ?? 0) + glory[i];
      f.brought[uid] = (f.brought[uid] ?? 0) + forces[i];
      f.risk[uid] = (f.risk[uid] ?? 0) + unitsValue(splitWar(g.units).sea) + unitsValue(splitWar(g.units).land);
      // Los mercenarios caen primero y no vuelven heridos: solo cuentan las bajas propias
      const mercs = {};
      for (const c of g.game.state.mercs ?? []) mercs[c.unit] = (mercs[c.unit] ?? 0) + c.count;
      const fallen = (f.fallen[uid] ??= {});
      for (const [u, n] of Object.entries(lost)) {
        const mine = n - Math.min(n, mercs[u] ?? 0);
        if (mine > 0) fallen[u] = (fallen[u] ?? 0) + mine;
      }
      (f.present ??= {})[uid] = true;
      const phaseName = title ?? phases[Math.min(wave.phase, phases.length - 1)].name;
      const report = {
        t: tw,
        kind: 'gesta',
        icon: theme.icon,
        island: id,
        islandName: name,
        outcome: wave.killed ? 'victoria' : 'derrota',
        enemy: theme.enemy,
        title: `Oleada contra ${theme.enemy}: ${phaseName}`,
        text: text(i),
      };
      g.game.settleFeat(g.m, { left, lost, kills: Math.round(kills[i]), report, result: main, stay }, tw);
      this.pendingPush.add(uid);
    });
  }

  /** Lo que el enemigo necesita saber del sitio y de los juramentados (fondeaderos, marinos y producción). */
  #featCtx(id, f) {
    const posts = this.sitesOn(id).length || 3;
    const pledged = Object.values(f.pledged);
    return { posts, mariners: pledged.map((p) => ({ AM: p.P.AM, HM: p.P.HM })), prods: pledged.map((p) => p.prod ?? 0) };
  }

  /** Con el enemigo ya fuera, recalcula su tamaño con el poder de los que quedan jurados. */
  #rebaseFeat(f, id) {
    const powers = Object.values(f.pledged).map((p) => ({ ...p.P, f: p.f }));
    if (!f.boss || !powers.length) return;
    const kind = FEAT_THEMES[f.theme].kind ?? 'tifon';
    const nb = featBoss(f.theme, capByRest(powers), f.tier, this.#featCtx(id, f));
    if (kind === 'armada') {
      // El campamento en proporción a lo que le quede; las escuadras libres, a su tamaño nuevo
      for (const u of ['inmortal', 'arquero_persa']) {
        f.boss[u] = Math.max(0, Math.round((f.boss[u] * nb[u]) / Math.max(1, f.boss.full[u])));
        f.boss.full[u] = nb[u];
      }
      f.boss.campAtk = nb.campAtk;
      f.boss.posts.forEach((p, i) => {
        const squad = nb.posts[i]?.full ?? p.full;
        if (p.holder == null) p.squad = Math.max(0, Math.round((p.squad * squad) / Math.max(1, p.full)));
        p.full = squad;
      });
      return;
    }
    if (kind === 'hidra') {
      f.boss.headHp = nb.headHp;
      f.boss.headAtk = nb.headAtk;
      f.boss.brea = nb.brea;
      return;
    }
    FEAT_THEMES[f.theme].phases.forEach((p, i) => {
      const u = p.unit;
      if (i < f.boss.phase || u === 'cabeza') return;
      if (i === f.boss.phase) f.boss[u] = Math.max(1, Math.round((f.boss[u] * nb[u]) / f.boss.full[u]));
      else f.boss[u] = nb[u];
      f.boss.full[u] = nb[u];
    });
    f.boss.headHp = nb.headHp;
    f.boss.headAtk = nb.headAtk;
    f.boss.lava = nb.lava;
  }

  /**
   * A las tantas horas de lucha, quien juró y no ha combatido (ni llevado su flota, ni la tiene en
   * camino) es perjuro. Se vuelve a mirar al acabar, por si la flota que estaba en camino se retiró.
   */
  #purgePerjurers(id, t) {
    const f = this.islandStates.get(id).feat;
    f.perjuryDone = true;
    this.touch(id);
    const theme = FEAT_THEMES[f.theme];
    const siteName = this.islands.get(id)?.name ?? '';
    const out = Object.keys(f.pledged).filter((uid) => {
      if ((f.brought[uid] ?? 0) > 0 || f.present?.[uid] || (f.forge?.by?.[uid] ?? 0) > 0) return false;
      const g = this.games.get(Number(uid));
      return !g?.state.missions.some((m) => m.target === id && m.phase !== 'vuelta');
    });
    if (!out.length) return;
    for (const uid of out) {
      delete f.pledged[uid];
      f.perjurers.push(Number(uid));
      const g = this.games.get(Number(uid));
      if (!g) continue;
      g.update(t);
      g.featPerjury({ themeName: theme.name, siteName }, t);
      this.pendingPush.add(Number(uid));
    }
    // Sin ellos el enemigo es más pequeño (y la fragua pide menos)
    this.#forgeGoal(f);
    this.#rebaseFeat(f, id);
    this.touch(id);
  }

  /** Las flotas que esperaban en la gesta vuelven a casa. */
  #releaseFeatFleets(id, t, text) {
    for (const [uid, game] of this.games) {
      for (const m of game.state.missions) {
        if (m.feat !== id || m.phase !== 'estacionada') continue;
        game.featRelease(m, t, text);
        this.pendingPush.add(uid);
      }
    }
  }

  /**
   * La disputa por la reliquia legendaria, al caer el enemigo: los juramentados de la última oleada
   * luchan entre sí, por eliminatorias, con las tropas de tierra que les quedan (ver `relicDuel`). Las
   * bajas son de verdad (una parte vuelve herida al cobrar) y las flotas vuelven a casa con lo que
   * quede. Si nadie sigue en pie, la reliquia es para quien más gloria ganó.
   * Devuelve { winner (uid en texto), winnerName, lines, lost: { uid: n }, fallen: { uid: unidades } }.
   */
  #relicDuel(id, f, theme, last, rewards, t) {
    const landOf = (units) => Object.fromEntries(Object.entries(units).filter(([u, n]) => n > 0 && UNITS[u].kind === 'tierra'));
    // Las flotas de cada uno en la última oleada que siguen navegando (con las que les quedan)
    const fleets = new Map();
    for (const g of last) {
      if (!f.pledged[g.uid] || !g.game.state.missions.includes(g.m)) continue;
      if (!fleets.has(g.uid)) fleets.set(g.uid, { game: g.game, ms: [] });
      fleets.get(g.uid).ms.push(g.m);
    }
    const players = [...fleets].map(([uid, { game, ms }]) => {
      const units = {};
      for (const m of ms) for (const [u, n] of Object.entries(landOf(m.units))) units[u] = (units[u] ?? 0) + n;
      const c = playerCombat(game.state);
      return { uid, units, atkMul: c.atkMul, hpMul: c.hpMul, glory: f.glory[uid] ?? 0 };
    });
    const res = relicDuel(players);
    const nameOf = (uid) => f.pledged[uid]?.name ?? '¿?';
    let winner = res.winner;
    const lines = [];
    if (winner == null) {
      winner = Object.entries(rewards).find(([, r]) => r.top)?.[0] ?? null;
      lines.push(winner != null ? `nadie seguía en pie con tropas de tierra, así que es para quien más gloria ganó: ${nameOf(winner)}.` : 'nadie seguía en pie con tropas de tierra para reclamarla.');
    } else if (!res.rounds.length) {
      lines.push(`solo ${nameOf(winner)} seguía en pie con tropas de tierra y se la queda sin luchar.`);
    } else {
      res.rounds.forEach((round, i) => {
        const fights = round.map((x) => (x.bye != null ? `${nameOf(x.bye)} pasa sin luchar` : `${nameOf(x.winner)} vence a ${nameOf(x.winner === x.a ? x.b : x.a)}`));
        lines.push(`${i === res.rounds.length - 1 ? 'Final' : `Ronda ${i + 1}`}: ${fights.join('; ')}.`);
      });
      lines.push(`¡${nameOf(winner)} se queda la reliquia!`);
    }
    // Las bajas, repartidas entre las flotas de cada uno
    const lost = {};
    for (const [uid, { game, ms }] of fleets) {
      const n = Object.values(res.lost[uid] ?? {}).reduce((a, b) => a + b, 0);
      if (!n && !res.kills[uid]) continue;
      lost[uid] = n;
      const lefts = shareSurvivors(ms.map((m) => landOf(m.units)), res.left[uid]);
      const changes = ms.map((m, i) => [m, { ...Object.fromEntries(Object.entries(m.units).filter(([u]) => UNITS[u].kind !== 'tierra')), ...lefts[i] }]);
      game.featDuel(changes, res.lost[uid] ?? {}, res.kills[uid] ?? 0);
      this.pendingPush.add(Number(uid));
    }
    winner = winner != null ? String(winner) : null;
    const winnerName = winner != null ? nameOf(winner) : null;
    if (winnerName) this.announce(`🏺 ${winnerName} se queda la reliquia legendaria de ${theme.enemy} tras la disputa en ${this.islands.get(id)?.name ?? ''}.`);
    this.announce(`🏺 Disputa por la reliquia: ${lines.join(' ')}`, `f:${id}`);
    const byUid = (o) => Object.fromEntries(Object.entries(o).map(([uid, v]) => [String(uid), v]));
    return { winner, winnerName, lines, lost: byUid(lost), fallen: byUid(res.lost) };
  }

  /**
   * Se acaba la gesta: victoria, victoria a medias o derrota; se paga a cada uno y cambia el nivel del
   * sitio. En una victoria, `last` son las flotas de la última oleada (las que se disputan la reliquia).
   */
  #finishFeat(id, t, result = null, last = []) {
    const rt = this.islandStates.get(id);
    const f = rt.feat;
    if (f.stage === 'fin') return;
    const theme = FEAT_THEMES[f.theme];
    const name = this.islands.get(id)?.name ?? '';
    const R = FEATS.reward;
    result ??= bossLeft(f.theme, f.boss) <= R.half ? 'media' : 'derrota';
    // Los perjuros se apartan antes de pagar (si la lucha ha durado lo bastante): también quien
    // tenía la flota en camino a la hora del juicio y luego la retiró
    if (t - f.start >= featHours(FEATS.perjuryHours)) this.#purgePerjurers(id, t);
    f.stage = 'fin';
    f.result = result;
    f.finishedAt = t;
    f.truceUntil = t + Math.round(featHours(FEATS.truceAfterHours));
    this.#releaseFeatFleets(id, t, `${theme.icon} La gesta de ${name} ha terminado: tu flota vuelve a casa`);

    const won = result !== 'derrota';
    const players = {};
    for (const [uid, p] of Object.entries(f.pledged)) {
      const offered = f.forge?.by?.[uid] ?? 0;
      players[uid] = { prod: p.prod, f: p.f, brought: f.brought[uid] ?? 0, glory: f.glory[uid] ?? 0, risk: (f.risk[uid] ?? 0) + offered, offered };
    }
    const rewards = featRewards(players, { result, phasesWon: Math.min(f.boss?.phase ?? 0, theme.phases.length - 1), tier: f.tier });
    const bands = ['Bronce', 'Plata', 'Oro'];
    let topName = null;
    let heartName = null;
    // Armada: el Navarco es quien más oleadas aguantó en un fondeadero
    const navarch = theme.kind === 'armada' && won ? Object.entries(f.held ?? {}).filter(([uid]) => f.pledged[uid]).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
    let navarchName = null;
    // Los tres con más gloria de una victoria tienen estatua en su isla una semana
    const statues = result === 'victoria' ? Object.entries(rewards).filter(([, r]) => r.band >= 0).sort((a, b) => b[1].share - a[1].share).slice(0, 3).map(([uid]) => uid) : [];
    // Al caer el enemigo, su reliquia legendaria se la disputan los que siguen en pie
    const duel = result === 'victoria' ? this.#relicDuel(id, f, theme, last, rewards, t) : null;
    for (const [uid, r] of Object.entries(rewards)) {
      const game = this.games.get(Number(uid));
      if (!game) continue;
      game.update(t);
      const back = R.wounded[won ? 0 : 1];
      const wounded = Object.fromEntries(Object.entries(f.fallen[uid] ?? {}).map(([u, n]) => [u, Math.floor(n * back)]).filter(([, n]) => n > 0));
      // De la disputa por la reliquia también vuelve herida una parte de los caídos
      let duelBack = 0;
      for (const [u, n] of Object.entries(duel?.fallen[uid] ?? {})) {
        const k = Math.floor(n * R.duelWounded);
        if (k <= 0) continue;
        wounded[u] = (wounded[u] ?? 0) + k;
        duelBack += k;
      }
      const featBack = Object.values(wounded).reduce((a, b) => a + b, 0) - duelBack;
      // El Navarco se lleva más botín
      const bag = rewardBag(r.value * (uid === navarch ? theme.tune.navarch : 1), f.pledged[uid].mix);
      if (r.top) topName = f.pledged[uid].name;
      if (r.heart) heartName = f.pledged[uid].name;
      if (uid === navarch) navarchName = f.pledged[uid].name;
      const title = { victoria: `¡${cap(theme.enemy)} ha caído!`, media: `${cap(theme.enemy)} huye malherido`, derrota: `${cap(theme.enemy)} resiste` }[result];
      const parts = [
        r.band >= 0
          ? `Tramo ${bands[r.band]}: trajiste el ${Math.round(r.effort * 100)} % de tu fuerza${r.offer > 0 ? `, ofrendaste ${String(Math.round(r.offer * 10) / 10).replace('.', ',')} h de tu producción` : ''} y ganaste el ${Math.round(r.share * 100)} % de la gloria.`
          : 'No llegaste a ningún tramo de premio: hace falta combatir (o ofrendar) más.',
        r.top ? `⚡ Eres el Azote de ${theme.enemy}: quien más gloria ha ganado.` : '',
        r.heart ? '🦁 Corazón de león: nadie se ha esforzado más que tú.' : '',
        uid === navarch ? `⚓ Navarco: nadie ha aguantado más oleadas en un fondeadero (+${Math.round((theme.tune.navarch - 1) * 100)} % de botín).` : '',
        statues.includes(uid) ? `🗿 Tu isla levanta una estatua a tu victoria sobre ${theme.enemy}: todos la verán durante una semana.` : '',
        r.blessing ? `La bendición del Olimpo te da +${Math.round(R.blessing * 100)} % de producción durante ${r.blessing} h.` : '',
        featBack > 0 ? `Vuelven ${featBack} heridos de los que cayeron.` : '',
        duel ? `🏺 Disputa por la reliquia: ${duel.lines.join(' ')}${duel.lost[uid] ? ` En la disputa pierdes ${duel.lost[uid]} tropas de tierra${duelBack ? `, pero ${duelBack} vuelven heridas a casa` : ''}.` : ''}` : '',
      ];
      game.receiveFeatReward(
        {
          bag,
          blessingHours: r.blessing,
          wounded,
          relic: duel?.winner === uid,
          theme: f.theme,
          top: r.top,
          heart: r.heart,
          won,
          emblem: result === 'victoria' && r.band >= 2 ? theme.emblem : null,
          navarch: uid === navarch,
          statue: statues.includes(uid) ? { theme: f.theme, until: t + Math.round(featHours(24 * 7)) } : null,
          report: { t, kind: 'gesta', island: id, islandName: name, outcome: won ? 'victoria' : 'derrota', enemy: theme.enemy, title, text: parts.filter(Boolean).join(' '), loot: bag },
        },
        t,
      );
      this.pendingPush.add(Number(uid));
    }
    // El sitio sube si se gana pronto y baja si se pierde
    const [lo, hi] = FEATS.tiers;
    if (result === 'victoria' && t - (f.emergedAt ?? f.start) <= featHours(24)) rt.featTier = Math.min(hi, (rt.featTier ?? 0) + 1);
    if (result === 'derrota') rt.featTier = Math.max(lo, (rt.featTier ?? 0) - 1);
    // Si la Armada gana, el continente queda un tiempo como satrapía: ni maravilla ni colonias nuevas
    if (result === 'derrota' && theme.kind === 'armada') rt.satrapyUntil = t + Math.round(featHours(theme.tune.satrapyHours));
    this.meta.featHall = [{ k: f.k, site: id, siteName: name, theme: f.theme, result, t, players: Object.keys(f.pledged).length, top: topName, heart: heartName, navarch: navarchName, relic: duel?.winnerName ?? null }, ...(this.meta.featHall ?? [])].slice(0, 12);
    const msg = {
      victoria: `${theme.icon} ¡${cap(theme.enemy)} ha caído en ${name}!${topName ? ` Azote: ${topName}.` : ''}${heartName ? ` Corazón de león: ${heartName}.` : ''}`,
      media: `${theme.icon} ${cap(theme.enemy)} huye malherido de ${name}: victoria a medias.`,
      derrota: `${theme.icon} ${cap(theme.enemy)} resiste en ${name}: la gesta ha fracasado.${theme.kind === 'armada' ? ` ${name} queda como satrapía ${theme.tune.satrapyHours} h: ni maravilla ni colonias nuevas.` : ''}`,
    }[result];
    this.announce(msg);
    this.touch(id);
    this.mapCache = null;
  }

  // ── El Kraken ──────────────────────────────────────────────────────────────

  /**
   * Solo hay un Kraken en todos los mares. Mientras duerme, nadie sabe cuándo despertará: cuando le
   * llega la hora (`wakeAt`, que nunca sale del servidor) aparece en una fosa cualquiera que no esté
   * arrasada y se avisa en el chat con unas coordenadas aproximadas. Allí se queda hasta que caiga.
   */
  #updateKraken(now) {
    const k = (this.meta.kraken ??= { lair: null, wakeAt: now + Math.random() * featHours(KRAKEN_RULES.windowHours) });
    if (k.lair != null) {
      if (this.islandStates.get(k.lair)?.kraken) return;
      // (la fosa ya no lo tiene: que vuelva a despertar en otra)
      k.lair = null;
      k.wakeAt = now;
    }
    if (now < k.wakeAt) return;
    const lairs = [...this.islands.values()].filter((isl) => isl.type === 'kraken' && this.islandStates.has(isl.id) && !rebuilding(isl, this.islandStates.get(isl.id), now));
    if (!lairs.length) {
      k.wakeAt = now + 10 * 60_000;
      return;
    }
    const isl = lairs[Math.floor(Math.random() * lairs.length)];
    this.islandStates.get(isl.id).kraken = true;
    this.touch(isl.id);
    k.lair = isl.id;
    k.wokeAt = now;
    const [cx, cy] = coordsOf(isl.x, isl.z);
    const d = KRAKEN_RULES.hintCells;
    const off = () => Math.floor(Math.random() * (2 * d + 1)) - d;
    this.announce(`🐙 ¡El Kraken ha despertado! Los marineros han visto sus tentáculos cerca de ${fmtCoords([cx + off(), cy + off()])}.`);
  }

  /** Alguien ha derrotado al Kraken: vuelve a dormir y despertará en un momento que nadie sabe. */
  krakenSlain(id, name, t) {
    const R = KRAKEN_RULES;
    const isl = this.islands.get(id);
    this.meta.kraken = { lair: null, slainAt: t, wakeAt: t + featHours(R.regenHours) + Math.random() * featHours(R.windowHours) };
    this.touch(id);
    const where = isl ? `${isl.name} ${fmtCoords(coordsOf(isl.x, isl.z))}` : 'su fosa';
    this.announce(`🐙 ${name} ha derrotado al Kraken en ${where}. Vuelve a dormir en las profundidades… hasta quién sabe cuándo.`);
  }

  // ── Eventos a mano (moderadores) ───────────────────────────────────────────

  /**
   * Desencadena ya un evento del juego (los comandos del chat /temporada, /kraken, /horda,
   * /piratas, /visitante y /competicion; la gesta va por adminStartFeat). `arg` es el resto
   * del comando. Devuelve el texto con lo que ha pasado.
   */
  adminEvent(adminId, kind, arg = '') {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const now = clock.now();
    const words = String(arg ?? '').trim().split(/\s+/).filter(Boolean);
    if (kind === 'temporada') return this.#adminSeason(words, now);
    if (kind === 'kraken') return this.#adminKraken(now);
    if (kind === 'horda') return this.#adminHorde(adminId, words.join(' '), now);
    if (kind === 'piratas' || kind === 'visitante') return this.#adminVisit(adminId, kind, words, now);
    if (kind === 'competicion') return this.#adminContest();
    throw new UserError('Evento desconocido.');
  }

  /** «/temporada oro 6»: una temporada del archipiélago desde ya (manda sobre el calendario). «/temporada off» la termina. */
  #adminSeason([id, hours], now) {
    const list = Object.keys(WORLD_EVENTS).join(', ');
    if (!id) throw new UserError(`Escribe /temporada y una de estas: ${list}; y si quieres, las horas. /temporada off la termina.`);
    const key = nameKey(id);
    if (key === 'off' || key === 'fin') {
      const o = this.meta.eventOverride;
      if (!o || now >= o.end) throw new UserError('No hay ninguna temporada puesta a mano.');
      o.end = Math.max(o.start, now);
      universe.eventOverride = o;
      this.#pushAll();
      return '⏹️ Temporada terminada: vuelve el calendario de siempre';
    }
    const ev = WORLD_EVENTS[key];
    if (!ev) throw new UserError(`No hay ninguna temporada «${id}». Son: ${list}.`);
    const h = Math.min(72, Math.max(0.1, Number(String(hours ?? '').replace(',', '.')) || WORLD_EVENT_HOURS));
    this.meta.eventOverride = { id: key, start: now, end: now + this.#hoursMs(h) };
    universe.eventOverride = this.meta.eventOverride;
    this.#pushAll();
    return `${ev.icon} ${ev.name} durante ${String(h).replace('.', ',')} h`;
  }

  /** Despierta al Kraken ya, en una fosa al azar. */
  #adminKraken(now) {
    const k = this.meta.kraken;
    if (k?.lair != null && this.islandStates.get(k.lair)?.kraken) {
      const isl = this.islands.get(k.lair);
      throw new UserError(`El Kraken ya está despierto, en ${isl.name} ${fmtCoords(coordsOf(isl.x, isl.z))}.`);
    }
    this.meta.kraken = { ...(k ?? {}), lair: null, wakeAt: now };
    this.#updateKraken(now);
    const lair = this.meta.kraken.lair;
    if (lair == null) throw new UserError('No hay ninguna fosa libre donde pueda despertar.');
    const isl = this.islands.get(lair);
    return `🐙 El Kraken despierta en ${isl.name} ${fmtCoords(coordsOf(isl.x, isl.z))}`;
  }

  /** Una horda bárbara ya, en el continente dicho o en el más cercano con colonias. */
  #adminHorde(adminId, site, now) {
    const me = this.islands.get(this.games.get(adminId)?.state.home) ?? { x: 0, z: 0 };
    const colonists = this.#colonistsByLand();
    const lands = [...colonists.keys()]
      .map((id) => this.islands.get(id))
      .filter((c) => c && (!site || c.id === site || nameKey(c.name) === nameKey(site)))
      .sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    const cont = lands.find((c) => {
      const rt = this.islandStates.get(c.id);
      return rt && !rt.horde && !(rt.feat && rt.feat.stage !== 'fin');
    });
    if (!cont) throw new UserError(site ? 'Ese continente no tiene colonias, ya tiene una horda o hay una gesta en marcha.' : 'No hay ningún continente con colonias libre de hordas y de gestas.');
    this.#spawnHorde(cont, this.islandStates.get(cont.id), colonists.get(cont.id), now);
    return `🔥 Horda bárbara en ${cont.name} (${colonists.get(cont.id).size} ${colonists.get(cont.id).size === 1 ? 'colono' : 'colonos'})`;
  }

  /** Piratas o un visitante para un jugador (sin nombre, para el propio moderador). */
  #adminVisit(adminId, kind, words, now) {
    let variant = null;
    if (kind === 'visitante' && words[0] && VISITORS[nameKey(words[0])]) variant = nameKey(words.shift());
    const name = words.join(' ');
    const uid = name ? this.byName.get(name.toLowerCase()) : adminId;
    const game = uid != null ? this.games.get(uid) : null;
    if (!game) throw new UserError('No hay ningún jugador con ese nombre.');
    const res = game.summonEvent(kind, variant, now);
    if (!res.ok) throw new UserError(res.reason);
    const who = this.users.get(uid).username;
    if (kind === 'piratas') return `🏴‍☠️ Velas piratas rumbo a la isla de ${who}`;
    const v = VISITORS[game.state.visitor?.kind ?? variant];
    return `${v?.icon ?? '🐫'} ${v?.name ?? 'Un visitante'} en la isla de ${who}`;
  }

  /** Termina ya la competición semanal: reparte los premios y empieza otra. */
  #adminContest() {
    const c = this.meta.contest;
    if (!c) throw new UserError('No hay ninguna competición en marcha.');
    c.end = Date.now();
    this.#finishContest();
    return `🏅 Competición ${c.n} terminada: premios repartidos y empieza la siguiente`;
  }

  /** Que todos los jugadores reciban el estado nuevo (p. ej. al cambiar la temporada). */
  #pushAll() {
    for (const uid of this.games.keys()) this.pendingPush.add(uid);
  }

  // ── Competición semanal ────────────────────────────────────────────────────

  #contestStats(game) {
    const out = {};
    for (const c of Object.values(CONTEST_CATEGORIES)) out[c.stat] = game.state.stats[c.stat] ?? 0;
    return out;
  }

  /** Empieza una competición nueva: lo que lleva cada uno ahora es su punto de partida. */
  #ensureContest(start = Date.now()) {
    if (this.meta.contest) return;
    const base = {};
    for (const [uid, game] of this.games) base[uid] = this.#contestStats(game);
    const n = (this.meta.contestSeq = (this.meta.contestSeq ?? 0) + 1);
    this.meta.contest = { n, start, end: start + (CONTEST_DAYS * 86_400_000) / universe.speed, base };
  }

  /** Lo hecho esta semana en cada categoría, de mayor a menor. */
  contestStandings() {
    const c = this.meta.contest;
    const out = {};
    for (const [key, cat] of Object.entries(CONTEST_CATEGORIES)) {
      out[key] = [...this.games.entries()]
        .map(([uid, g]) => ({ uid, name: g.name, score: Math.floor((g.state.stats[cat.stat] ?? 0) - (c.base[uid]?.[cat.stat] ?? 0)) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
    }
    return out;
  }

  #finishContest() {
    const c = this.meta.contest;
    const standings = this.contestStandings();
    const winners = {};
    for (const [key, list] of Object.entries(standings)) {
      const cat = CONTEST_CATEGORIES[key];
      winners[key] = list.slice(0, 3).map((r, i) => {
        const game = this.games.get(r.uid);
        game.update(clock.now());
        game.giveResources(CONTEST_PRIZES[i], `🏅 ${['¡Primer', 'Segundo', 'Tercer'][i]} puesto en ${cat.name} de la competición semanal! Premio entregado.`);
        if (i === 0) game.state.stats.contestWins = (game.state.stats.contestWins ?? 0) + 1;
        game.dirty = true;
        return { name: r.name, score: r.score };
      });
      if (winners[key][0]) this.announce(`🏅 ${cat.icon} ${winners[key][0].name} gana la semana en ${cat.name} (${fmtEs(winners[key][0].score)} ${cat.unit})`);
    }
    this.meta.hall = [{ n: c.n, end: c.end, winners }, ...(this.meta.hall ?? [])].slice(0, 12);
    this.meta.contest = null;
    this.#ensureContest(c.end);
    this.rankingCache = null;
  }

  /** La competición vista por un jugador: el podio de cada categoría y su puesto. */
  contestView(userId) {
    const c = this.meta.contest;
    const standings = this.contestStandings();
    const categories = {};
    for (const [key, list] of Object.entries(standings)) {
      const i = list.findIndex((r) => r.uid === userId);
      categories[key] = {
        top: list.slice(0, 10).map((r, k) => ({ rank: k + 1, name: r.name, score: r.score, me: r.uid === userId })),
        me: i >= 0 ? { rank: i + 1, score: list[i].score } : null,
      };
    }
    return { n: c.n, end: c.end, categories, prizes: CONTEST_PRIZES, hall: (this.meta.hall ?? []).slice(0, 3) };
  }

  // ── Maravillas de los continentes ──────────────────────────────────────────

  /** Bonos de las maravillas de los continentes donde hay colonias de la lista. */
  wonderBonusFor(colonies) {
    const out = {};
    const seen = new Set();
    for (const c of colonies) {
      const land = this.islands.get(c.id)?.land;
      if (!land || seen.has(land)) continue;
      seen.add(land);
      const cont = this.islands.get(land);
      const level = wonderLevel(this.islandStates.get(land)?.wonder?.progress);
      if (!cont || !level) continue;
      const w = WONDERS[wonderOf(cont)];
      out[w.stat] = (out[w.stat] ?? 0) + level * w.per;
    }
    return out;
  }

  /** Recalcula el bono de quienes tienen colonia en un continente (o de todos). */
  #refreshWonders(continentId = null, now = clock.now()) {
    for (const game of this.games.values()) {
      if (continentId && !game.state.colonies.some((c) => this.islands.get(c.id)?.land === continentId)) continue;
      const next = this.wonderBonusFor(game.state.colonies);
      if (JSON.stringify(next) === JSON.stringify(game.state.wonderBonus ?? {})) continue;
      game.update(now); // que la producción hasta ahora vaya con el bono anterior
      game.state.wonderBonus = next;
      game.dirty = true;
      this.pendingPush.add(game.userId);
    }
  }

  donateWonder(id, userId, amount, now) {
    const rt = this.islandStates.get(id);
    const cont = this.islands.get(id);
    if (!rt || !cont) return;
    rt.wonder ??= { progress: 0, donors: {} };
    const before = wonderLevel(rt.wonder.progress);
    rt.wonder.progress += amount;
    rt.wonder.donors[userId] = (rt.wonder.donors[userId] ?? 0) + amount;
    this.touch(id);
    const after = wonderLevel(rt.wonder.progress);
    if (after > before) {
      const w = WONDERS[wonderOf(cont)];
      this.announce(`${w.icon} ${w.name} de ${cont.name} sube a nivel ${after}`);
      this.#refreshWonders(id, now);
    }
    // Que todos los que miran el continente vean el progreso
    for (const game of this.games.values()) if (game.state.colonies.some((c) => this.islands.get(c.id)?.land === id)) this.pendingPush.add(game.userId);
  }

  spyPlayer(ownerId, t) {
    const target = this.games.get(ownerId);
    if (!target || target.state.vacation) return null;
    target.update(t);
    return { name: target.name, ...target.spyReport() };
  }

  sabotage(ownerId, payload, t) {
    const target = this.games.get(ownerId);
    if (!target || target.state.vacation) return null;
    target.update(t);
    const res = target.receiveSabotage(payload, t);
    target.dirty = true;
    return res;
  }

  // ── Bloqueos y ocupaciones ─────────────────────────────────────────────────

  /** Una flota llega a bloquear el puerto de `ownerId`: combate naval contra su flota. */
  blockadePlayer(ownerId, payload, t) {
    const target = this.games.get(ownerId);
    if (!target || target.state.vacation) return null;
    target.update(t);
    const res = target.receiveBlockade(payload, t);
    target.dirty = true;
    this.pendingPush.add(ownerId);
    return res;
  }

  /** Empieza un bloqueo o una ocupación de la ciudad de `ownerId` (la ocupación releva a cualquier bloqueo). */
  seizePort(ownerId, kind, info, t) {
    const target = this.games.get(ownerId);
    if (!target) return false;
    target.update(t);
    if (kind === 'invadir' && target.state.blockade) {
      const b = this.stationAt(ownerId, 'bloquear');
      if (b?.mission) b.game.endStation(b.mission, t, 'relevo');
      target.state.blockade = null;
      if (b?.game) this.pendingPush.add(b.game.userId);
    }
    target.portSeized(kind, info, t);
    target.dirty = true;
    this.pendingPush.add(ownerId);
    this.mapCache = null;
    return true;
  }

  /**
   * Quién bloquea o ocupa la ciudad de `ownerId` (la ocupación primero, o el `kind` pedido):
   * { kind, info, game, mission } (sin `mission` si la flota ya no está), o null.
   */
  stationAt(ownerId, kind = null) {
    const s = this.games.get(ownerId)?.state;
    if (!s) return null;
    kind ??= s.occupied ? 'invadir' : s.blockade ? 'bloquear' : null;
    const info = kind === 'invadir' ? s.occupied : kind === 'bloquear' ? s.blockade : null;
    if (!info) return null;
    const game = this.games.get(info.by) ?? null;
    const mission = game?.state.missions.find((m) => m.id === info.mission && m.type === kind && m.phase === 'estacionada') ?? null;
    return { kind, info, game, mission };
  }

  /**
   * Lleva al instante `t` a quien bloquea u ocupa la ciudad de `ownerId`, antes de que otra flota
   * mire si sigue ahí o si la ciudad ya está protegida: así cuenta el orden de los hechos y no el
   * orden en que el servidor procesa las partidas. (Si es la propia partida, `#advance` lo ignora.)
   */
  settlePort(ownerId, t) {
    const st = this.stationAt(ownerId);
    if (st?.mission) st.game.update(t);
  }

  /** Se acaba un bloqueo o una ocupación en la isla `islandId`. Devuelve el tributo que se llevan. */
  liftStation(islandId, { by, mission, kind, reason, who }, t) {
    const owner = this.islands.get(islandId)?.owner;
    const target = this.games.get(owner);
    const info = kind === 'invadir' ? target?.state.occupied : target?.state.blockade;
    if (!info || info.by !== by || info.mission !== mission) return {};
    target.update(t);
    const owed = target.portFreed(kind, { reason, who }, t);
    target.dirty = true;
    this.pendingPush.add(owner);
    this.pendingPush.add(by);
    this.mapCache = null;
    return owed;
  }

  /**
   * Alguien combate contra quien bloquea u ocupa la ciudad de `ownerId`: el dueño desde dentro
   * (`fromSea: false`; contra un bloqueo, solo con barcos) o sus aliados llegando por mar.
   * Devuelve { kind, result, broken, enemy } o null.
   */
  fightStation(ownerId, attacker, t, { fromSea = true } = {}) {
    let st = this.stationAt(ownerId);
    if (!st) return null;
    const victim = this.games.get(ownerId);
    // Que quien la mantiene llegue a este instante (puede que se le acabe el tiempo justo antes)
    if (st.mission) {
      st.game.update(t);
      st = this.stationAt(ownerId);
      if (!st) return null;
    }
    if (!st.mission) {
      // La flota ya no está: la ciudad queda libre sin combate
      victim.state[st.kind === 'invadir' ? 'occupied' : 'blockade'] = null;
      victim.dirty = true;
      return { kind: st.kind, result: null, broken: true, enemy: st.info.name };
    }
    const occ = playerCombat(st.game.state);
    const def = { units: { ...st.mission.units }, atkMul: occ.atkMul, hpMul: occ.hpMul };
    const result = fromSea ? assault(attacker, def, { needLanding: st.kind === 'invadir' }) : battle(attacker, def);
    const left = splitForces(result.def.left);
    // Sin barcos de guerra no hay bloqueo; sin soldados, no hay ocupación
    const broken = st.kind === 'bloquear' ? !hasCombat(left.sea) : !hasCombat(left.land);
    st.game.stationFought(st.mission, { result, broken, enemy: attacker.name }, t);
    st.game.dirty = true;
    victim.dirty = true;
    this.pendingPush.add(st.game.userId);
    this.pendingPush.add(ownerId);
    return { kind: st.kind, result, broken, enemy: st.info.name };
  }

  /** Quien ocupa la ciudad de `ownerId` la saquea: { tribute, loot }. */
  plunderCity(ownerId, payload, t) {
    const target = this.games.get(ownerId);
    if (!target?.state.occupied) return null;
    target.update(t);
    const res = target.plunderedBy(payload, t);
    target.dirty = true;
    this.pendingPush.add(ownerId);
    return res;
  }

  /**
   * Bloqueos y ocupaciones que ya no se sostienen: la flota ha desaparecido, ya no quedan soldados
   * ocupando o los dos jugadores ya no están enfrentados (aliados o con un pacto).
   */
  #checkStations(now) {
    for (const [uid, game] of this.games) {
      for (const kind of ['invadir', 'bloquear']) {
        const st = this.stationAt(uid, kind);
        if (!st) continue;
        if (!st.mission) {
          game.update(now);
          game.portFreed(kind, { reason: 'tiempo' }, now);
          game.dirty = true;
          this.pendingPush.add(uid);
          continue;
        }
        const rel = this.relation(st.info.by, uid);
        const units = splitForces(st.mission.units);
        const empty = kind === 'invadir' ? !hasCombat(units.land) : !hasCombat(units.sea);
        if (rel === 'aliado' || rel === 'pacto' || empty) {
          st.game.update(now);
          st.game.endStation(st.mission, now, empty ? 'tiempo' : 'paz');
          st.game.dirty = true;
          this.pendingPush.add(st.game.userId);
        }
      }
    }
  }

  attackPlayer(ownerId, payload, t) {
    const target = this.games.get(ownerId);
    if (!target || target.state.vacation) return null;
    // Que el defensor llegue al momento del ataque (si no está ya ocupado)
    target.update(t);
    const res = target.receiveAttack(payload, t);
    target.dirty = true;
    // En guerra entre alianzas se lleva la cuenta de bajas y botín de cada bando
    if (res && payload.attackerId != null && this.relation(payload.attackerId, ownerId) === 'guerra') {
      const x = this.memberOf.get(payload.attackerId);
      const y = this.memberOf.get(ownerId);
      const war = this.meta.diplomacy[pairKey(x, y)];
      war.kills[x] = (war.kills[x] ?? 0) + count(res.result.def.lost);
      war.kills[y] = (war.kills[y] ?? 0) + count(res.result.att.lost);
      war.loot[x] = (war.loot[x] ?? 0) + count(res.stolen);
      war.battles = (war.battles ?? 0) + 1;
    }
    return res;
  }

  /**
   * Alguien ataca la colonia `islandId` de `ownerId`: la defiende su guarnición. Si la saquean, la
   * colonia queda marcada (`raidedUntil`) para que nadie la vuelva a saquear mientras no produce.
   */
  raidColony(ownerId, islandId, payload, t) {
    const target = this.games.get(ownerId);
    const rt = this.islandStates.get(islandId);
    if (!target || target.state.vacation || rt?.colonizedBy !== ownerId) return null;
    target.update(t);
    const res = target.receiveColonyRaid(islandId, payload, t);
    if (!res) return null;
    target.dirty = true;
    this.pendingPush.add(ownerId);
    if (res.raidedUntil) {
      rt.raidedUntil = res.raidedUntil;
      this.touch(islandId);
    }
    // En guerra entre alianzas se lleva la cuenta de bajas y botín de cada bando
    if (payload.attackerId != null && this.relation(payload.attackerId, ownerId) === 'guerra') {
      const x = this.memberOf.get(payload.attackerId);
      const y = this.memberOf.get(ownerId);
      const war = this.meta.diplomacy[pairKey(x, y)];
      war.kills[x] = (war.kills[x] ?? 0) + count(res.result.def.lost);
      war.kills[y] = (war.kills[y] ?? 0) + count(res.result.att.lost);
      war.loot[x] = (war.loot[x] ?? 0) + count(res.stolen);
      war.battles = (war.battles ?? 0) + 1;
    }
    return res;
  }

  /** Las tropas que guardan una colonia (lo que ve quien la espía). */
  colonyGarrison(islandId) {
    const owner = this.islandStates.get(islandId)?.colonizedBy;
    return owner != null ? (this.games.get(owner)?.garrisonOf(islandId) ?? {}) : {};
  }

  // ── Ataques conjuntos ──────────────────────────────────────────────────────

  /** Un ataque contra otra ciudad al que pueden unirse los aliados de quien lo lanza (clave «jugador-flota»). */
  jointAttack(key) {
    const [uid, mid] = String(key ?? '').split('-').map(Number);
    const game = this.games.get(uid);
    const m = game?.state.missions.find((x) => x.id === mid);
    if (!m || m.type !== 'atacar' || m.phase !== 'ida' || m.joint) return null;
    if (this.islands.get(m.target)?.type !== 'jugador') return null;
    const allies = this.#jointMissions(key);
    return { key, leaderId: uid, leader: game.name, target: m.target, targetName: m.targetName, arrive: m.arrive, allies: allies.length, names: allies.map((x) => x.game.name) };
  }

  #jointMissions(key) {
    const out = [];
    for (const game of this.games.values()) {
      for (const mission of game.state.missions) if (mission.joint === key && mission.phase === 'ida') out.push({ game, mission });
    }
    return out;
  }

  /** Las flotas unidas a un ataque, listas para combatir junto a quien lo dirige. */
  jointFleets(key, t) {
    return this.#jointMissions(key).map(({ game, mission }) => {
      game.update(t);
      return {
        uid: game.userId,
        name: game.name,
        mission,
        combat: playerCombat(game.state),
        settle: (data) => {
          game.settleJoint(mission, data, t);
          game.dirty = true;
        },
      };
    });
  }

  /** Ataques de tu alianza (y tuyos) a los que se puede uno unir, para el navegador. */
  #jointList(userId) {
    const a = this.allianceOf(userId);
    const out = [];
    for (const uid of a ? a.members : [userId]) {
      for (const m of this.games.get(uid)?.state.missions ?? []) {
        if (m.type !== 'atacar' || m.phase !== 'ida' || m.joint) continue;
        const info = this.jointAttack(`${uid}-${m.id}`);
        if (info) out.push(info);
      }
    }
    return out;
  }

  announce(text, channel = 'global') {
    this.#pushChat({ name: null, text, system: true, channel });
  }

  #pushChat(data) {
    const msg = { id: (this.meta.chatSeq = (this.meta.chatSeq ?? 0) + 1), t: Date.now(), ...data };
    this.chat.push(msg);
    this.pendingChat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat.shift();
    for (const uid of this.sockets.keys()) {
      const [visible] = this.#visibleChat(uid, [msg]);
      if (visible) this.send(uid, { type: 'chat', message: visible });
    }
    return msg;
  }

  /** Qué mensajes puede leer un jugador (el canal global, el de su alianza y el de su gesta), ya preparados para él. */
  #visibleChat(userId, messages) {
    const a = this.allianceOf(userId);
    const mine = a ? `a:${a.id}` : null;
    const site = this.#featChat(userId);
    const feat = site ? `f:${site}` : null;
    return messages
      .filter((m) => !m.channel || m.channel === 'global' || m.channel === mine || m.channel === feat)
      .map((m) => ({ ...m, channel: !m.channel || m.channel === 'global' ? 'global' : m.channel.startsWith('f:') ? 'gesta' : 'alianza' }));
  }

  /**
   * El continente de la gesta en cuyo chat puede escribir un jugador: los convocados, desde los
   * presagios hasta que acaba la tregua (o null).
   */
  #featChat(userId) {
    const site = this.games.get(userId)?.state.feat?.site;
    const f = site ? this.islandStates.get(site)?.feat : null;
    if (!f || f.k !== this.games.get(userId).state.feat.k || !f.convoked.includes(userId)) return null;
    if (f.stage === 'fin' && clock.now() >= (f.truceUntil ?? f.end)) return null;
    return site;
  }

  /** El canal interno de un mensaje: 'global', el de tu alianza o el de tu gesta. */
  #chatChannel(userId, channel) {
    if (channel === 'alianza') {
      const a = this.allianceOf(userId);
      if (!a) throw new UserError('No estás en ninguna alianza.');
      return `a:${a.id}`;
    }
    if (channel === 'gesta') {
      const site = this.#featChat(userId);
      if (!site) throw new UserError('No estás convocado a ninguna gesta en marcha.');
      return `f:${site}`;
    }
    return 'global';
  }

  // ── Bucle y guardado ───────────────────────────────────────────────────────

  tick() {
    const now = clock.now();
    for (const game of this.games.values()) game.update(now);
    // Flotas que esperaban a un ataque conjunto que ya no va (lo han retirado o se ha perdido)
    for (const game of this.games.values()) {
      for (const m of game.state.missions) {
        if (!m.joint || m.phase !== 'ida') continue;
        if (this.jointAttack(m.joint) && now <= m.arrive + 60_000) continue;
        game.releaseJoint(m, now);
      }
    }
    if (this.meta.contest && Date.now() >= this.meta.contest.end) this.#finishContest();
    this.#updateHordes(now);
    this.#updateFeats(now);
    this.#updateKraken(now);
    this.#checkStations(now);
    // Enlaces de correo caducados (cada diez minutos)
    if (Date.now() - (this.tokenSweep ?? 0) > 600_000) {
      this.tokenSweep = Date.now();
      this.#dropTokens();
    }
    // Cuando empieza una temporada del archipiélago, se anuncia una sola vez
    const ev = worldEventAt(now);
    if (this.meta.eventAnnounced !== ev.start) {
      this.meta.eventAnnounced = ev.start;
      if (ev.event) this.announce(`${ev.event.icon} Comienza ${ev.event.name}: ${ev.event.text}`);
    }
    // Las ofertas del mercado caducan y devuelven lo apartado
    const limit = Date.now() - OFFER_DAYS * 86_400_000;
    if (this.meta.offers.some((o) => o.t < limit)) {
      for (const o of this.meta.offers.filter((x) => x.t < limit)) this.games.get(o.seller)?.giveResources(o.give, '⚖️ Una oferta tuya del mercado ha caducado');
      this.meta.offers = this.meta.offers.filter((o) => o.t >= limit);
    }
  }

  async persist(force = false) {
    const players = [];
    for (const [userId, game] of this.games) {
      if (game.dirty || force) {
        players.push({ userId, state: game.state });
        game.dirty = false;
      }
    }
    const islandStates = [...this.dirtyIslands].map((id) => [id, this.islandStates.get(id)]);
    this.dirtyIslands.clear();
    const islands = this.newIslands.splice(0);
    const chat = this.pendingChat.splice(0);
    if (!players.length && !islandStates.length && !islands.length && !chat.length && !force) return;
    await this.store.save({ meta: this.meta, players, islands, islandStates, chat });
  }

  // ── Lo que ve cada jugador ─────────────────────────────────────────────────

  /**
   * Lo que ve un jugador: todo el archipiélago. La lista de islas (que casi nunca cambia) solo va
   * si quien lo pide no tiene ya la versión `knownRev`.
   */
  /**
   * Lo que ve un jugador. `knownRev` y `knownStates`: las versiones de la lista de islas y de su
   * estado que ya tiene el navegador. Si están al día, la lista no se repite y del estado solo van
   * las islas que han cambiado desde entonces (`world.full` dice si va entero).
   */
  snapshot(userId, knownRev = null, knownStates = null) {
    const game = this.games.get(userId);
    const user = this.users.get(userId);
    const now = clock.now();
    game.update(now);
    const rev = this.islandsRev();
    const since = this.#statesSince(knownRev, knownStates);
    const islands = (this.islandList ??= [...this.islands.values()]);
    const states = {};
    const put = (isl) => {
      const rt = isl && this.islandStates.get(isl.id);
      if (!rt) return;
      if (rt.feat) states[isl.id] = { ...rt, feat: this.#publicFeat(rt.feat, userId, isl.id) };
      else if (isl.loot) {
        // Cuántos defienden y cuánto botín tienen solo se sabe espiando (o atacando)
        // (ni si el Kraken está en esta fosa)
        const { garrison, stock, kraken, ...open } = rt;
        states[isl.id] = open;
      } else states[isl.id] = rt;
    };
    if (since < 0) for (const isl of islands) put(isl);
    else {
      // Solo las que han cambiado desde lo que tiene el navegador, y las gestas siempre (cada uno ve la suya)
      for (const [id, r] of this.stateRevs) if (r > since) put(this.islands.get(id));
      for (const isl of this.#continents()) if (this.islandStates.get(isl.id)?.feat) put(isl);
    }
    const players = {};
    for (const uid of this.#owners()) {
      // Si está conectado, solo se lo cuenta a sus amigos
      const info = this.playerInfo(uid);
      players[uid] = { ...info, online: this.seesOnline(userId, uid) ? info?.online : null, rel: this.relation(userId, uid), hitMe: uid !== userId && this.attackedBy(userId, uid) };
    }
    const a = this.allianceOf(userId);
    // El correo va aparte (puede ser largo): aquí solo cuántos sin leer
    const { mail, ...state } = game.state;
    return {
      serverTime: now,
      speed: universe.speed,
      eventSeed: universe.eventSeed,
      eventOverride: universe.eventOverride,
      userId,
      username: user.username,
      alliance: a ? { id: a.id, tag: a.tag, name: a.name } : null,
      admin: this.isAdmin(userId),
      mailUnread: (mail ?? []).filter((m) => m.box === 'in' && !m.read).length,
      forumUnread: this.#forumUnread(userId),
      applications: a && this.#canManage(a, userId) ? (a.applications ?? []).length : 0,
      friendRequests: (this.meta.friendRequests[userId] ?? []).length,
      state,
      world: { islands: knownRev === rev ? null : islands, rev, states, statesRev: this.statesRev(), full: since < 0, players },
      incoming: this.incoming(game.state.home, game.level('torre'), now, game.state.colonies.map((c) => c.id)),
      joint: this.#jointList(userId),
      traffic: this.#traffic(userId, game.state.home),
      support: this.supportersAt(game.state.home, userId).map(({ game: g, mission }) => ({ from: g.name, units: mission.units })),
      owed: this.#owedTo(game),
      truce: this.#truceWith(userId, now),
    };
  }

  /** Lo que ven los demás de una gesta: sin el poder ni la producción de cada juramentado. */
  #publicFeat(f, userId, site) {
    const mine = f.pledged[userId];
    const pledged = Object.fromEntries(Object.entries(f.pledged).map(([uid, p]) => [uid, { name: p.name }]));
    if (mine) pledged[userId] = { name: mine.name, f: mine.f, prod: mine.prod };
    const { risk, fallen, brought, forge, ...rest } = f;
    const by = forge?.by ?? {};
    return {
      ...rest,
      pledged,
      brought: brought[userId] != null ? { [userId]: brought[userId] } : {},
      // De la fragua, solo lo de todos y lo tuyo
      forge: { goal: forge?.goal ?? 0, total: forge?.total ?? 0, used: forge?.used ?? 0, by: by[userId] ? { [userId]: by[userId] } : {}, givers: Object.keys(by).length },
      waiting: f.stage === 'lucha' || f.stage === 'presagio' ? this.#featWaitingFor(site, userId) : null,
    };
  }

  /** Quién espera ya la próxima oleada y cuánto dejaría pasar la coraza (se calcula como mucho cada pocos segundos). */
  #featWaiting(site) {
    this.featWaitCache ??= new Map();
    const hit = this.featWaitCache.get(site);
    if (hit && Date.now() - hit.at < 3000) return hit.value;
    const byPlayer = {};
    let fleets = 0;
    for (const { uid, game, m } of this.#featFleets(site, Infinity)) {
      // En la Armada, las de los fondeaderos no cuentan para la coraza del asalto
      if (m.type === 'bloquear') continue;
      const c = playerCombat(game.state);
      byPlayer[uid] = (byPlayer[uid] ?? 0) + forceOf(m.units, c.atkMul, c.hpMul);
      fleets++;
    }
    const N = effectiveEmpires(Object.values(byPlayer));
    const value = { fleets, players: Object.keys(byPlayer).length, N: Math.round(N * 100) / 100, coop: Math.round(featCoop(N) * 100) / 100, byPlayer };
    this.featWaitCache.set(site, { at: Date.now(), value });
    return value;
  }

  /**
   * Lo que espera la próxima oleada visto por un jugador: el total y, de los demás, solo la suma
   * de sus fuerzas y de sus cuadrados (para que calcule cuánto subiría la coraza con su flota).
   */
  #featWaitingFor(site, userId) {
    const { byPlayer, ...rest } = this.#featWaiting(site);
    let S = 0;
    let Q = 0;
    for (const [uid, f] of Object.entries(byPlayer)) {
      if (Number(uid) === userId) continue;
      S += f;
      Q += f * f;
    }
    return { ...rest, mine: Math.round(byPlayer[userId] ?? 0), othersSum: Math.round(S), othersSq: Math.round(Q) };
  }

  /** Tributo apartado en cada ciudad que ocupa este jugador (id de la misión → recursos). */
  #owedTo(game) {
    const out = {};
    for (const m of game.state.missions) {
      if (m.type !== 'invadir' || m.phase !== 'estacionada') continue;
      const owner = this.islands.get(m.target)?.owner;
      const occ = this.games.get(owner)?.state.occupied;
      if (occ?.by === game.userId && occ.mission === m.id) out[m.id] = Object.fromEntries(Object.entries(occ.owed ?? {}).map(([r, n]) => [r, Math.floor(n)]));
    }
    return out;
  }

  /** Flotas de otros jugadores que navegan cerca de ti (sin decir qué llevan), para ver el mar con vida. */
  #traffic(userId, homeId) {
    const home = this.islands.get(homeId);
    if (!home) return [];
    const near = (isl) => isl && Math.hypot(isl.x - home.x, isl.z - home.z) <= VIEW_RADIUS;
    const out = [];
    for (const [uid, g] of this.games) {
      if (uid === userId) continue;
      const home = this.islands.get(g.state.home);
      for (const m of g.state.missions) {
        if (m.target === homeId || (m.phase !== 'ida' && m.phase !== 'vuelta')) continue;
        const from = m.from ? this.islands.get(m.from) : home;
        const to = this.islands.get(m.target);
        if (!to || !(near(from) || near(to))) continue;
        const ship = ['dromon', 'galeon', 'trirreme', 'brulote', 'mercante', 'bote'].find((s) => m.units[s]) ?? 'mercante';
        // Se ve de quién es (su nombre y su estandarte), pero no qué lleva
        out.push({ id: `${uid}-${m.id}`, fx: from.x, fz: from.z, tx: to.x, tz: to.z, depart: m.depart, arrive: m.arrive, back: m.back, phase: m.phase, ship, ally: this.sameAlliance(userId, uid), owner: g.name, banner: g.state.banner?.color ?? null });
      }
    }
    return out.slice(0, 40);
  }

  /** Cambiar el nombre de tu ciudad (una vez por semana). */
  renameCity(userId, name) {
    name = String(name ?? '').trim();
    if (!NAME_RE.test(name)) throw new UserError('El nombre de la ciudad debe tener entre 3 y 20 letras o números.');
    const game = this.games.get(userId);
    const wait = (game.state.renamedAt ?? 0) + 7 * 86_400_000 - Date.now();
    if (wait > 0) throw new UserError(`Solo puedes cambiar el nombre una vez por semana (faltan ${Math.ceil(wait / 86_400_000)} días).`);
    if (this.#cityTaken(name, userId)) throw new UserError('Ya hay una ciudad con ese nombre: elige otro.');
    const isl = this.islands.get(game.state.home);
    const old = isl.name;
    isl.name = name;
    this.#islandsChanged();
    game.state.renamedAt = Date.now();
    game.dirty = true;
    this.newIslands.push(isl); // se guarda de nuevo con su nombre
    this.mapCache = null;
    this.rankingCache = null;
    this.announce(`🏰 ${game.name} rebautiza ${old} como ${name}`);
    this.pendingPush.add(userId);
  }

  /** Flotas de otros jugadores que vienen a atacar esta isla. */
  /**
   * Flotas enemigas que vienen hacia `homeId`. Se sabe quién viene y cuándo llega, pero qué
   * tropas trae solo se ve cuando ya está a menos de `watchRange(watch)` leguas (la torre de
   * vigía); hasta entonces, `revealAt` dice cuándo se verán.
   */
  /** Las flotas enemigas de camino a tu ciudad `homeId` (o a tus colonias `colonies`), con lo que distingue la torre. */
  incoming(homeId, watch = 0, now = clock.now(), colonies = []) {
    const targets = new Set([homeId, ...colonies]);
    const range = watchRange(watch);
    const list = [];
    for (const [uid, other] of this.games) {
      for (const m of other.state.missions) {
        if (!targets.has(m.target) || m.phase !== 'ida' || !HOSTILE.has(m.type)) continue;
        const home = this.islands.get(m.target);
        const from = this.islands.get(m.from ?? other.state.home);
        const dist = from && home ? Math.hypot(from.x - home.x, from.z - home.z) : 0;
        const revealAt = Math.round(m.arrive - (m.arrive - m.depart) * Math.min(1, range / Math.max(1, dist)));
        const seen = now >= revealAt;
        const units = seen ? Object.fromEntries(Object.entries(m.units).filter(([, n]) => n > 0)) : null;
        const size = units ? Object.values(units).reduce((a, b) => a + b, 0) : null;
        list.push({ id: `${uid}-${m.id}`, type: m.type, from: other.name, fromIsland: from?.name, x: from?.x, z: from?.z, depart: m.depart, arrive: m.arrive, revealAt, size, units, ...(m.target !== homeId ? { colony: home?.name ?? '' } : {}) });
      }
    }
    return list.sort((a, b) => a.arrive - b.arrive);
  }

  ranking(userId) {
    if (!this.rankingCache || Date.now() - this.rankingCache.at > 10_000) {
      const rows = [...this.games.entries()].map(([id, g]) => ({
        id,
        name: this.users.get(id)?.username ?? '¿?',
        city: this.islands.get(g.state.home)?.name ?? '',
        island: g.state.home,
        points: g.score(),
        colonies: g.state.colonies.length,
        coloso: g.level('coloso'),
        kills: g.state.stats.kills ?? 0,
        loot: g.state.stats.loot ?? 0,
        tag: this.allianceOf(id)?.tag ?? null,
      }));
      rows.sort((a, b) => b.points - a.points);
      rows.forEach((r, i) => (r.rank = i + 1));
      // Clasificaciones por categoría: solo quien tenga algo que contar
      const by = (key) =>
        rows
          .filter((r) => r[key] > 0)
          .sort((a, b) => b[key] - a[key])
          .slice(0, RANK_SIZE)
          .map((r, i) => ({ ...r, rank: i + 1 }));
      this.rankingCache = { at: Date.now(), rows, military: by('kills'), raiders: by('loot'), alliances: this.allianceList() };
    }
    const { rows, military, raiders } = this.rankingCache;
    const mark = ({ id, ...r }) => ({ ...r, me: id === userId });
    const { id: _, ...me } = rows.find((r) => r.id === userId) ?? {};
    return {
      top: rows.slice(0, 100).map(mark),
      military: military.map(mark),
      raiders: raiders.map(mark),
      me: userId != null && me.name ? me : null,
      total: rows.length,
      alliances: this.rankingCache.alliances,
    };
  }

  stats() {
    const now = Date.now();
    const online = [...this.users.values()].filter((u) => now - u.lastSeen < ONLINE_MS).length;
    const ev = worldEventAt(clock.now());
    const event = ev.event ? { icon: ev.event.icon, name: ev.event.name, text: ev.event.text, end: ev.end } : null;
    return { players: this.users.size, online, top: this.ranking(null).top.slice(0, 5), event, maintenance: this.maintenanceText() };
  }

  // ── Mantenimiento ──────────────────────────────────────────────────────────
  // Mientras dura, solo los moderadores entran; a los demás se les dice en la portada.

  /** El aviso de mantenimiento, o null si el juego está abierto. */
  maintenanceText() {
    const m = this.meta.maintenance;
    if (!m) return null;
    return m.text || 'El servidor está en mantenimiento hasta nuevo aviso. Volvemos pronto.';
  }

  /** Si el juego está cerrado para este jugador (los moderadores siempre pueden entrar). */
  closedFor(userId) {
    return !!this.meta.maintenance && !this.isAdmin(userId);
  }

  /** Abre o cierra el juego (solo moderadores). Al cerrarlo, echa a quien esté conectado. */
  setMaintenance(adminId, on, text = '') {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    this.meta.maintenance = on ? { since: Date.now(), text: String(text ?? '').trim().slice(0, 300) } : null;
    if (on) {
      for (const [uid, set] of this.sockets) {
        if (this.isAdmin(uid)) continue;
        for (const ws of set) ws.close(4004, 'mantenimiento');
      }
    }
    return { maintenance: this.maintenanceText() };
  }

  addChat(userId, text, channel = 'global') {
    const user = this.users.get(userId);
    text = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) throw new UserError('Escribe algo.');
    const muted = this.meta.mod[userId]?.mutedUntil ?? 0;
    if (muted > Date.now()) throw new UserError(`Estás silenciado en el chat hasta las ${new Date(muted).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`);
    const ch = this.#chatChannel(userId, channel);
    return this.#pushChat({ name: user.username, title: this.#titleOf(userId), text, channel: ch });
  }

  /** El título que lleva un jugador (el nombre de un logro suyo), o null. */
  #titleOf(userId) {
    const id = this.games.get(userId)?.state.title;
    return id ? (ACHIEVEMENTS.find((a) => a.id === id)?.name ?? null) : null;
  }

  /** Publicar un informe de combate en el chat (general o de la alianza). */
  shareReport(userId, t, channel = 'global') {
    const game = this.games.get(userId);
    const r = game.state.reports.find((x) => x.t === t && x.battle);
    if (!r) throw new UserError('Ese informe ya no existe.');
    const muted = this.meta.mod[userId]?.mutedUntil ?? 0;
    if (muted > Date.now()) throw new UserError('Estás silenciado en el chat.');
    const ch = this.#chatChannel(userId, channel);
    const icon = { victoria: '🏆', derrota: '💀', empate: '🏳️' }[r.outcome] ?? '📜';
    // Solo lo necesario para verlo y repetir el combate
    const report = { t: r.t, kind: r.kind, outcome: r.outcome, title: r.title, islandName: r.islandName, enemy: r.enemy, defending: r.defending, battle: r.battle, loot: r.loot, wall: r.wall, towers: r.towers };
    return this.#pushChat({ name: game.name, title: this.#titleOf(userId), text: `${icon} ${r.title}`, channel: ch, report });
  }

  /** Mensajes nuevos que puede leer el jugador: el canal global y el de su alianza. */
  chatSince(userId, after) {
    return this.#visibleChat(
      userId,
      this.chat.filter((m) => m.id > after),
    );
  }

  // ── Alianzas ───────────────────────────────────────────────────────────────

  allianceOf(userId) {
    const id = this.memberOf?.get(userId);
    return id != null ? this.meta.alliances[id] : null;
  }

  #alliancePoints(a) {
    return a.members.reduce((sum, uid) => sum + (this.games.get(uid)?.score() ?? 0), 0);
  }

  allianceList(userId = null) {
    return Object.values(this.meta.alliances)
      .map((a) => ({
        id: a.id,
        name: a.name,
        tag: a.tag,
        members: a.members.length,
        points: this.#alliancePoints(a),
        open: !!a.open,
        applied: userId != null && (a.applications ?? []).some((x) => x.uid === userId),
      }))
      .sort((a, b) => b.points - a.points)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }

  allianceDetail(userId) {
    const a = this.allianceOf(userId);
    if (!a) return null;
    const members = a.members
      .map((uid) => {
        const info = this.playerInfo(uid);
        const role = uid === a.founder ? 'lider' : (a.officers ?? []).includes(uid) ? 'oficial' : 'miembro';
        return { id: uid, name: info?.name, city: this.islands.get(this.games.get(uid)?.state.home)?.name, island: this.games.get(uid)?.state.home, points: info?.score ?? 0, online: this.seesOnline(userId, uid) ? info?.online : null, founder: uid === a.founder, role };
      })
      .sort((x, y) => y.points - x.points);
    return {
      id: a.id,
      name: a.name,
      tag: a.tag,
      description: a.description,
      founder: a.founder,
      isFounder: a.founder === userId,
      canManage: this.#canManage(a, userId),
      open: !!a.open,
      points: this.#alliancePoints(a),
      members,
      diplomacy: this.#diplomacyOf(a.id),
      // Las solicitudes solo las ven quienes pueden aceptarlas
      applications: this.#canManage(a, userId)
        ? (a.applications ?? []).map((x) => ({ id: x.uid, name: this.users.get(x.uid)?.username ?? '¿?', points: this.games.get(x.uid)?.score() ?? 0, t: x.t, text: x.text }))
        : [],
    };
  }

  createAlliance(userId, name, tag) {
    name = String(name ?? '').trim();
    tag = String(tag ?? '').trim().toUpperCase();
    if (this.allianceOf(userId)) throw new UserError('Ya estás en una alianza.');
    if ((this.games.get(userId)?.level('ayuntamiento') ?? 0) < 2) throw new UserError('Necesitas el ayuntamiento a nivel 2 para fundar una alianza.');
    if (!ALLIANCE_RE.test(name)) throw new UserError('El nombre de la alianza debe tener entre 3 y 30 caracteres.');
    if (!TAG_RE.test(tag)) throw new UserError('La etiqueta debe tener entre 2 y 5 letras o números.');
    const all = Object.values(this.meta.alliances);
    if (all.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new UserError('Ya hay una alianza con ese nombre.');
    if (all.some((a) => a.tag === tag)) throw new UserError('Esa etiqueta ya está cogida.');
    const id = (this.meta.allianceSeq = (this.meta.allianceSeq ?? 0) + 1);
    this.meta.alliances[id] = { id, name, tag, founder: userId, members: [userId], description: '', created: Date.now() };
    this.memberOf.set(userId, id);
    this.rankingCache = null;
    this.announce(`🤝 ${this.users.get(userId).username} funda la alianza ${name} [${tag}]`);
    return this.allianceDetail(userId);
  }

  /** Líder u oficial: puede aceptar solicitudes, expulsar y moderar. */
  #canManage(a, userId) {
    return a.founder === userId || (a.officers ?? []).includes(userId);
  }

  /** Pedir entrar: en una alianza abierta se entra directamente; si no, queda la solicitud. */
  // ── Amigos ─────────────────────────────────────────────────────────────────
  // Se piden por el nombre; cuando el otro acepta, son amigos los dos. Así se ve
  // quién está conectado y se le escribe o se visita su perfil en un clic.

  #friendId(name) {
    const id = this.byName.get(String(name ?? '').trim().toLowerCase());
    if (id == null || !this.games.has(id)) throw new UserError('No hay ningún jugador con ese nombre.');
    return id;
  }

  #link(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const list = (this.meta.friends[x] ??= []);
      if (!list.includes(y)) list.push(y);
      this.meta.friendRequests[x] = (this.meta.friendRequests[x] ?? []).filter((id) => id !== y);
    }
  }

  /** Pedir amistad (si el otro ya te la había pedido, sois amigos al momento). */
  addFriend(userId, name) {
    const other = this.#friendId(name);
    if (other === userId) throw new UserError('No puedes añadirte a ti mismo.');
    if ((this.meta.friends[userId] ?? []).includes(other)) throw new UserError('Ya sois amigos.');
    if ((this.meta.friendRequests[userId] ?? []).includes(other)) {
      this.#link(userId, other);
      this.hostNews(other, `👥 ${this.users.get(userId).username} ha aceptado tu amistad`);
      this.pendingPush.add(other);
      return 'amigos';
    }
    const pending = (this.meta.friendRequests[other] ??= []);
    if (pending.includes(userId)) throw new UserError('Ya le has pedido amistad. Espera a que conteste.');
    const sent = Object.values(this.meta.friendRequests).filter((list) => list.includes(userId)).length;
    if (sent >= 30) throw new UserError('Tienes demasiadas solicitudes sin contestar.');
    if (pending.length >= 50) throw new UserError('Ese jugador tiene demasiadas solicitudes pendientes.');
    pending.push(userId);
    this.hostNews(other, `👥 ${this.users.get(userId).username} quiere ser tu amigo`);
    this.pendingPush.add(other);
    return 'pedida';
  }

  answerFriend(userId, name, accept) {
    const other = this.#friendId(name);
    const pending = this.meta.friendRequests[userId] ?? [];
    if (!pending.includes(other)) throw new UserError('Esa solicitud ya no existe.');
    if (accept) {
      this.#link(userId, other);
      this.hostNews(other, `👥 ${this.users.get(userId).username} ha aceptado tu amistad`);
      this.pendingPush.add(other);
    } else this.meta.friendRequests[userId] = pending.filter((id) => id !== other);
  }

  /** Dejar de ser amigos, o retirar una solicitud que mandaste. */
  removeFriend(userId, name) {
    const other = this.#friendId(name);
    for (const [x, y] of [[userId, other], [other, userId]]) this.meta.friends[x] = (this.meta.friends[x] ?? []).filter((id) => id !== y);
    this.meta.friendRequests[other] = (this.meta.friendRequests[other] ?? []).filter((id) => id !== userId);
  }

  /** Lista de amigos (con quién está conectado), solicitudes recibidas y enviadas. */
  friendList(userId) {
    const card = (id) => {
      const info = this.playerInfo(id);
      const user = this.users.get(id);
      if (!info || !user) return null;
      return {
        name: info.name,
        city: this.islands.get(this.games.get(id).state.home)?.name ?? '',
        score: info.score,
        online: info.online,
        lastSeen: this.games.get(id).state.lastSeen ?? user.lastSeen ?? 0,
        alliance: info.alliance?.tag ?? null,
        island: this.games.get(id).state.home,
      };
    };
    const friends = (this.meta.friends[userId] ?? []).map(card).filter(Boolean);
    friends.sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen);
    return {
      friends,
      incoming: (this.meta.friendRequests[userId] ?? []).map(card).filter(Boolean),
      outgoing: Object.entries(this.meta.friendRequests)
        .filter(([, list]) => list.includes(userId))
        .map(([id]) => card(Number(id)))
        .filter(Boolean),
    };
  }

  requestJoin(userId, allianceId, text = '') {
    const a = this.meta.alliances[Number(allianceId)];
    if (!a) throw new UserError('Esa alianza ya no existe.');
    if (this.allianceOf(userId)) throw new UserError('Ya estás en una alianza.');
    if (a.open) return this.joinAlliance(userId, a.id);
    if (a.members.length >= MAX_MEMBERS) throw new UserError(`La alianza está llena (${MAX_MEMBERS} miembros).`);
    a.applications ??= [];
    if (a.applications.some((x) => x.uid === userId)) throw new UserError('Ya has pedido entrar en esa alianza.');
    if (a.applications.length >= 30) throw new UserError('Esa alianza tiene demasiadas solicitudes pendientes.');
    a.applications.push({ uid: userId, t: Date.now(), text: String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) });
    this.announce(`📨 ${this.users.get(userId).username} pide entrar en la alianza`, `a:${a.id}`);
    for (const uid of [a.founder, ...(a.officers ?? [])]) this.pendingPush.add(uid);
    return null;
  }

  cancelApplication(userId, allianceId) {
    const a = this.meta.alliances[Number(allianceId)];
    if (!a) return;
    a.applications = (a.applications ?? []).filter((x) => x.uid !== userId);
  }

  /** Aceptar o rechazar a quien pide entrar (líder u oficiales). */
  answerApplication(userId, targetId, accept) {
    const a = this.allianceOf(userId);
    if (!a || !this.#canManage(a, userId)) throw new UserError('Solo el líder y los oficiales pueden responder a las solicitudes.');
    const app = (a.applications ?? []).find((x) => x.uid === targetId);
    if (!app) throw new UserError('Esa solicitud ya no está.');
    a.applications = a.applications.filter((x) => x !== app);
    const name = this.users.get(targetId)?.username ?? '¿?';
    if (!accept) {
      this.hostNews(targetId, `📨 La alianza ${a.name} [${a.tag}] no ha aceptado tu solicitud`);
      return this.allianceDetail(userId);
    }
    if (this.allianceOf(targetId)) throw new UserError(`${name} ya está en otra alianza.`);
    this.joinAlliance(targetId, a.id);
    this.hostNews(targetId, `🤝 ¡Te han aceptado en la alianza ${a.name} [${a.tag}]!`);
    this.pendingPush.add(targetId);
    return this.allianceDetail(userId);
  }

  /** El líder nombra o quita oficiales. */
  setOfficer(userId, targetId, on) {
    const a = this.allianceOf(userId);
    if (!a || a.founder !== userId) throw new UserError('Solo el líder nombra oficiales.');
    if (!a.members.includes(targetId) || targetId === userId) throw new UserError('Ese jugador no está en tu alianza.');
    a.officers = (a.officers ?? []).filter((uid) => uid !== targetId);
    if (on) a.officers.push(targetId);
    const name = this.users.get(targetId).username;
    this.announce(on ? `⭐ ${name} es ahora oficial de la alianza` : `${name} deja de ser oficial`, `a:${a.id}`);
    return this.allianceDetail(userId);
  }

  /** El líder cede el mando a otro miembro (y pasa a ser oficial). */
  transferLeadership(userId, targetId) {
    const a = this.allianceOf(userId);
    if (!a || a.founder !== userId) throw new UserError('Solo el líder puede ceder el mando.');
    if (!a.members.includes(targetId) || targetId === userId) throw new UserError('Ese jugador no está en tu alianza.');
    a.founder = targetId;
    a.officers = [...(a.officers ?? []).filter((uid) => uid !== targetId), userId];
    this.announce(`👑 ${this.users.get(targetId).username} lidera ahora la alianza`, `a:${a.id}`);
    for (const uid of a.members) this.pendingPush.add(uid);
    return this.allianceDetail(userId);
  }

  /** Abierta (entra quien quiera) o con solicitud. */
  setAllianceOpen(userId, open) {
    const a = this.allianceOf(userId);
    if (!a || a.founder !== userId) throw new UserError('Solo el líder decide cómo se entra en la alianza.');
    a.open = !!open;
    return this.allianceDetail(userId);
  }

  joinAlliance(userId, allianceId) {
    const a = this.meta.alliances[Number(allianceId)];
    if (!a) throw new UserError('Esa alianza ya no existe.');
    if (this.allianceOf(userId)) throw new UserError('Ya estás en una alianza.');
    if (a.members.length >= MAX_MEMBERS) throw new UserError(`La alianza está llena (${MAX_MEMBERS} miembros).`);
    a.members.push(userId);
    this.memberOf.set(userId, a.id);
    // Sus solicitudes a otras alianzas ya no hacen falta
    for (const other of Object.values(this.meta.alliances)) if (other.applications) other.applications = other.applications.filter((x) => x.uid !== userId);
    this.rankingCache = null;
    this.announce(`🤝 ${this.users.get(userId).username} se une a la alianza`, `a:${a.id}`);
    return this.allianceDetail(userId);
  }

  leaveAlliance(userId, { kickedBy } = {}) {
    const a = this.allianceOf(userId);
    if (!a) throw new UserError('No estás en ninguna alianza.');
    a.members = a.members.filter((uid) => uid !== userId);
    a.officers = (a.officers ?? []).filter((uid) => uid !== userId);
    this.memberOf.delete(userId);
    const name = this.users.get(userId).username;
    if (!a.members.length) {
      delete this.meta.alliances[a.id];
      delete this.meta.forums[a.id];
      for (const key of Object.keys(this.meta.diplomacy)) if (key.split('-').includes(String(a.id))) delete this.meta.diplomacy[key];
    } else {
      // Si se va el líder, manda el oficial más antiguo (o el miembro más antiguo)
      if (a.founder === userId) {
        a.founder = a.officers[0] ?? a.members[0];
        a.officers = a.officers.filter((uid) => uid !== a.founder);
      }
      this.announce(kickedBy ? `🤝 ${name} ha sido expulsado de la alianza` : `🤝 ${name} deja la alianza`, `a:${a.id}`);
    }
    this.rankingCache = null;
    this.#recallBrokenSupport();
  }

  kickMember(userId, targetId) {
    const a = this.allianceOf(userId);
    if (!a || !this.#canManage(a, userId)) throw new UserError('Solo el líder y los oficiales pueden expulsar.');
    if (targetId === userId || !a.members.includes(targetId)) throw new UserError('Ese jugador no está en tu alianza.');
    if (targetId === a.founder || (a.founder !== userId && (a.officers ?? []).includes(targetId))) throw new UserError('No puedes expulsar a alguien de tu mismo rango o superior.');
    this.leaveAlliance(targetId, { kickedBy: userId });
    return this.allianceDetail(userId);
  }

  /** Carta para todos los miembros de tu alianza. */
  allianceCircular(userId, subject, text) {
    const a = this.allianceOf(userId);
    if (!a) throw new UserError('No estás en ninguna alianza.');
    const to = a.members.filter((uid) => uid !== userId);
    if (!to.length) throw new UserError('Eres el único miembro de la alianza.');
    this.#deliverMail(userId, to, `[${a.tag}] Circular`, subject, text);
  }

  // ── Foro de la alianza ─────────────────────────────────────────────────────

  #forum(userId) {
    const a = this.allianceOf(userId);
    if (!a) throw new UserError('No estás en ninguna alianza.');
    this.meta.forums[a.id] ??= [];
    return { a, threads: this.meta.forums[a.id] };
  }

  #forumUnread(userId) {
    const a = this.allianceOf(userId);
    const threads = a ? (this.meta.forums[a.id] ?? []) : [];
    const seen = this.games.get(userId)?.state.forumSeen ?? {};
    const me = this.users.get(userId)?.username;
    return threads.filter((th) => th.lastBy !== me && th.last > (seen[th.id] ?? 0)).length;
  }

  /** Los temas del foro, los fijados primero y luego por la última respuesta. */
  forumList(userId) {
    const { a, threads } = this.#forum(userId);
    const seen = this.games.get(userId).state.forumSeen ?? {};
    const me = this.users.get(userId).username;
    return {
      canModerate: this.#canManage(a, userId),
      threads: threads
        .map((th) => ({
          id: th.id,
          title: th.title,
          author: th.author,
          t: th.t,
          last: th.last,
          lastBy: th.lastBy,
          count: th.posts.length,
          pinned: !!th.pinned,
          unread: th.lastBy !== me && th.last > (seen[th.id] ?? 0),
        }))
        .sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.last - x.last),
    };
  }

  /** Un tema entero; al leerlo queda marcado como leído. */
  forumThread(userId, id) {
    const { a, threads } = this.#forum(userId);
    const th = threads.find((x) => x.id === id);
    if (!th) throw new UserError('Ese tema ya no existe.');
    const game = this.games.get(userId);
    game.state.forumSeen ??= {};
    game.state.forumSeen[th.id] = th.last;
    // Olvidar lo leído de temas que ya no existen
    for (const key of Object.keys(game.state.forumSeen)) if (!threads.some((x) => x.id === Number(key))) delete game.state.forumSeen[key];
    game.dirty = true;
    const me = this.users.get(userId).username;
    return { ...th, canModerate: this.#canManage(a, userId), mine: th.author === me };
  }

  forumPost(userId, threadId, title, text) {
    const { a, threads } = this.#forum(userId);
    text = String(text ?? '').trim().slice(0, 3000);
    if (!text) throw new UserError('Escribe el mensaje.');
    const author = this.users.get(userId).username;
    const now = Date.now();
    const post = { id: (this.meta.postSeq = (this.meta.postSeq ?? 0) + 1), author, t: now, text };
    let th;
    if (threadId == null) {
      title = String(title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (title.length < 3) throw new UserError('El título debe tener al menos 3 letras.');
      th = { id: (this.meta.threadSeq = (this.meta.threadSeq ?? 0) + 1), title, author, t: now, last: now, lastBy: author, pinned: false, posts: [post] };
      threads.push(th);
      // Si hay demasiados, se va el más viejo sin fijar
      if (threads.length > MAX_THREADS) {
        const old = threads.filter((x) => !x.pinned).sort((x, y) => x.last - y.last)[0];
        if (old) threads.splice(threads.indexOf(old), 1);
      }
      this.announce(`🗂️ ${author} abre un tema en el foro: «${title}»`, `a:${a.id}`);
    } else {
      th = threads.find((x) => x.id === threadId);
      if (!th) throw new UserError('Ese tema ya no existe.');
      th.posts.push(post);
      if (th.posts.length > MAX_POSTS) th.posts.splice(1, th.posts.length - MAX_POSTS);
      th.last = now;
      th.lastBy = author;
    }
    for (const uid of a.members) this.pendingPush.add(uid);
    return this.forumThread(userId, th.id);
  }

  /** Fijar o borrar un tema: quien lidera (o quien lo abrió, para borrarlo). */
  forumModerate(userId, threadId, op) {
    const { a, threads } = this.#forum(userId);
    const th = threads.find((x) => x.id === threadId);
    if (!th) throw new UserError('Ese tema ya no existe.');
    const leader = this.#canManage(a, userId);
    if (op === 'pin') {
      if (!leader) throw new UserError('Solo quien lidera la alianza puede fijar temas.');
      th.pinned = !th.pinned;
    } else if (op === 'delete') {
      if (!leader && th.author !== this.users.get(userId).username) throw new UserError('Solo puedes borrar los temas que has abierto tú.');
      threads.splice(threads.indexOf(th), 1);
    } else {
      throw new UserError('Esa acción no existe.');
    }
    for (const uid of a.members) this.pendingPush.add(uid);
  }

  // ── Diplomacia entre alianzas ──────────────────────────────────────────────

  /** Pactos, guerras y propuestas de una alianza, vistos desde ella. */
  #diplomacyOf(allianceId) {
    const out = [];
    for (const [key, rec] of Object.entries(this.meta.diplomacy)) {
      const [x, y] = key.split('-').map(Number);
      if (x !== allianceId && y !== allianceId) continue;
      const other = this.meta.alliances[x === allianceId ? y : x];
      if (!other) continue;
      out.push({
        id: other.id,
        name: other.name,
        tag: other.tag,
        type: rec.type,
        since: rec.since,
        proposal: rec.proposal ? { kind: rec.proposal.kind, mine: rec.proposal.from === allianceId } : null,
        war:
          rec.type === 'guerra'
            ? { kills: rec.kills[allianceId] ?? 0, losses: rec.kills[other.id] ?? 0, loot: rec.loot[allianceId] ?? 0, lootLost: rec.loot[other.id] ?? 0, battles: rec.battles ?? 0, declaredByUs: rec.by === allianceId }
            : null,
      });
    }
    const order = { guerra: 0, pacto: 1 };
    return out.sort((p, q) => (order[p.type] ?? 2) - (order[q.type] ?? 2) || p.name.localeCompare(q.name));
  }

  /**
   * Lo que hace quien lidera una alianza con otra: proponer un pacto, aceptar
   * o rechazar una propuesta, romper un pacto, declarar la guerra o pedir la paz.
   */
  diplomacy(userId, otherId, op) {
    const a = this.allianceOf(userId);
    if (!a || a.founder !== userId) throw new UserError('Solo quien lidera la alianza lleva la diplomacia.');
    const b = this.meta.alliances[Number(otherId)];
    if (!b || b.id === a.id) throw new UserError('Esa alianza no existe.');
    const key = pairKey(a.id, b.id);
    const rec = this.meta.diplomacy[key];
    const now = Date.now();
    const us = `${a.name} [${a.tag}]`;
    const them = `${b.name} [${b.tag}]`;
    const both = (text) => {
      this.announce(text, `a:${a.id}`);
      this.announce(text, `a:${b.id}`);
    };
    switch (op) {
      case 'pacto':
        if (rec?.type === 'pacto') throw new UserError('Ya tenéis un pacto de no agresión.');
        if (rec?.type === 'guerra') throw new UserError('Estáis en guerra: primero hay que firmar la paz.');
        if (rec?.proposal) throw new UserError('Ya hay una propuesta pendiente entre vosotros.');
        this.meta.diplomacy[key] = { type: null, since: now, proposal: { kind: 'pacto', from: a.id, t: now } };
        both(`🕊️ ${us} propone un pacto de no agresión a ${them}`);
        break;
      case 'paz':
        if (rec?.type !== 'guerra') throw new UserError('No estáis en guerra.');
        if (rec.proposal) throw new UserError('Ya hay una propuesta de paz pendiente.');
        rec.proposal = { kind: 'paz', from: a.id, t: now };
        both(`🕊️ ${us} ofrece la paz a ${them}`);
        break;
      case 'aceptar': {
        if (!rec?.proposal || rec.proposal.from === a.id) throw new UserError('No hay ninguna propuesta que aceptar.');
        if (rec.proposal.kind === 'pacto') {
          this.meta.diplomacy[key] = { type: 'pacto', since: now, proposal: null };
          this.announce(`🕊️ ${us} y ${them} firman un pacto de no agresión`);
        } else {
          delete this.meta.diplomacy[key];
          const n = rec.battles ?? 0;
          this.announce(`🕊️ ${us} y ${them} firman la paz${n ? ` tras ${n} ${n === 1 ? 'batalla' : 'batallas'}` : ''}`);
        }
        break;
      }
      case 'rechazar':
        if (!rec?.proposal) throw new UserError('No hay ninguna propuesta.');
        both(rec.proposal.from === a.id ? `📜 ${us} retira su propuesta a ${them}` : `📜 ${us} rechaza la propuesta de ${them}`);
        if (rec.type) rec.proposal = null;
        else delete this.meta.diplomacy[key];
        break;
      case 'romper':
        if (rec?.type !== 'pacto') throw new UserError('No tenéis ningún pacto.');
        delete this.meta.diplomacy[key];
        both(`📜 ${us} rompe el pacto de no agresión con ${them}`);
        break;
      case 'guerra':
        if (rec?.type === 'guerra') throw new UserError('Ya estáis en guerra.');
        this.meta.diplomacy[key] = { type: 'guerra', since: now, by: a.id, proposal: null, kills: {}, loot: {}, battles: 0 };
        this.announce(`⚔️ ${us} declara la guerra a ${them}${rec?.type === 'pacto' ? ' rompiendo su pacto' : ''}`);
        break;
      default:
        throw new UserError('Esa acción no existe.');
    }
    // Las relaciones cambian lo que ve cada miembro de las dos alianzas
    for (const uid of [...a.members, ...b.members]) this.pendingPush.add(uid);
    this.mapCache = null;
  }

  describeAlliance(userId, text) {
    const a = this.allianceOf(userId);
    if (!a || !this.#canManage(a, userId)) throw new UserError('Solo el líder y los oficiales pueden cambiar la descripción.');
    a.description = String(text ?? '').trim().slice(0, 500);
    return this.allianceDetail(userId);
  }

  // ── Mapa del mundo ─────────────────────────────────────────────────────────

  /**
   * Todo el archipiélago en pocas cifras: las ciudades de los jugadores y el
   * resto de islas como [x, z, tipo, colono]. Se recalcula cada medio minuto.
   */
  worldMap(userId) {
    if (!this.mapCache || Date.now() - this.mapCache.at > MAP_CACHE_MS || this.mapCache.size !== this.islands.size) {
      const cities = [];
      const islands = [];
      for (const isl of this.islands.values()) {
        if (isl.type === 'jugador') {
          const g = this.games.get(isl.owner);
          if (!g) continue;
          const a = this.allianceOf(isl.owner);
          const port = portOf(g.state);
          cities.push({
            id: isl.id,
            x: Math.round(isl.x),
            z: Math.round(isl.z),
            city: isl.name,
            uid: isl.owner,
            name: g.name,
            points: g.score(),
            protected: g.isProtected(),
            vacation: !!g.state.vacation,
            inactive: this.isInactive(isl.owner),
            color: g.state.banner?.color ?? null,
            emblem: g.state.banner?.emblem ?? null,
            aid: a?.id ?? null,
            tag: a?.tag ?? null,
            // Bloqueada u ocupada: { kind, name } de quien lo hace
            port: port && { kind: port.kind, name: port.name },
          });
        } else {
          const entry = [Math.round(isl.x), Math.round(isl.z), isl.type, this.islandStates.get(isl.id)?.colonizedBy ?? 0];
          if (isl.type === 'continente') entry.push(Math.round(isl.size * 2.4));
          islands.push(entry);
        }
      }
      this.mapCache = { at: Date.now(), size: this.islands.size, cities, islands };
    }
    // Lo que depende de quién mira: con quién tiene pacto o guerra su alianza
    const mine = this.memberOf.get(userId);
    const relations = {};
    if (mine != null) {
      relations[mine] = 'aliado';
      for (const [key, rec] of Object.entries(this.meta.diplomacy)) {
        const [x, y] = key.split('-').map(Number);
        if (rec.type && (x === mine || y === mine)) relations[x === mine ? y : x] = rec.type;
      }
    }
    const { cities, islands } = this.mapCache;
    return { cities, islands, relations, viewRadius: VIEW_RADIUS, feats: this.#mapFeats(userId) };
  }

  /** Salón de las gestas: las que están en marcha, las últimas que acabaron y los que más han vencido. */
  featHallView(userId) {
    const heroes = [...this.games.values()]
      .filter((g) => (g.state.stats.feats ?? 0) > 0)
      .map((g) => ({ name: g.name, feats: g.state.stats.feats ?? 0, top: g.state.stats.featTop ?? 0, heart: g.state.stats.featHeart ?? 0, me: g.userId === userId }))
      .sort((a, b) => b.feats - a.feats || b.top - a.top || b.heart - a.heart)
      .slice(0, 10);
    return { active: this.#mapFeats(userId), hall: (this.meta.featHall ?? []).slice(0, 12), heroes };
  }

  /** Las gestas en marcha, para el mapa del mundo (sin caché: son pocas y cambian de etapa). */
  #mapFeats(userId) {
    const out = [];
    for (const id of this.meta.featSites ?? []) {
      const f = this.islandStates.get(id)?.feat;
      const isl = this.islands.get(id);
      if (!f || !isl || (f.stage !== 'presagio' && f.stage !== 'lucha')) continue;
      const theme = FEAT_THEMES[f.theme];
      out.push({
        site: id,
        x: Math.round(isl.x),
        z: Math.round(isl.z),
        size: Math.round(isl.size * 2.4),
        name: isl.name,
        icon: theme.icon,
        enemy: theme.enemy,
        stage: f.stage,
        start: f.start,
        end: f.end,
        pledged: Object.keys(f.pledged).length,
        convoked: f.convoked.length,
        me: f.convoked.includes(userId),
      });
    }
    return out;
  }

  // ── Conexiones en vivo (WebSocket) ─────────────────────────────────────────

  addSocket(userId, ws) {
    if (!this.sockets.has(userId)) this.sockets.set(userId, new Set());
    this.sockets.get(userId).add(ws);
  }

  removeSocket(userId, ws) {
    const set = this.sockets.get(userId);
    set?.delete(ws);
    if (set && !set.size) this.sockets.delete(userId);
  }

  send(userId, msg) {
    const set = this.sockets.get(userId);
    if (!set) return;
    const data = JSON.stringify(msg);
    for (const ws of set) if (ws.readyState === 1) ws.send(data);
  }

  /** Manda el estado nuevo a quien esté conectado y haya tenido cambios. */
  flushPush() {
    const rev = this.islandsRev();
    const now = Date.now();
    for (const uid of this.pendingPush) {
      const set = this.sockets.get(uid);
      if (!set || !this.games.has(uid)) continue;
      // Cada conexión recibe la lista de islas solo si aún no tiene esta versión, y del estado de las
      // islas, lo que ha cambiado desde lo último que le llegó (entero de vez en cuando, por si acaso)
      for (const ws of set) {
        if (ws.readyState !== 1) continue;
        const fresh = now - (ws.statesFullAt ?? 0) < STATES_FULL_MS;
        const snap = this.snapshot(uid, ws.islandsRev ?? null, fresh ? ws.statesRev : null);
        ws.send(JSON.stringify({ type: 'snapshot', data: snap }));
        ws.islandsRev = rev;
        ws.statesRev = snap.world.statesRev;
        if (snap.world.full) ws.statesFullAt = now;
      }
    }
    this.pendingPush.clear();
  }

  // ── Moderación ─────────────────────────────────────────────────────────────
  // Moderadores: nombres en la variable de entorno ADMINS, separados por comas.

  isAdmin(userId) {
    return this.admins.has(this.users.get(userId)?.username.toLowerCase());
  }

  isBanned(userId) {
    return !!this.meta.mod?.[userId]?.banned;
  }

  #target(adminId, name) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const id = this.byName.get(String(name ?? '').trim().toLowerCase());
    if (id == null) throw new UserError('No hay ningún jugador con ese nombre.');
    if (this.isAdmin(id)) throw new UserError('No se puede moderar a otro moderador.');
    return id;
  }

  mute(adminId, name, minutes) {
    const id = this.#target(adminId, name);
    const m = Math.max(0, Math.min(60 * 24 * 30, Math.floor(Number(minutes) || 0)));
    this.meta.mod[id] = { ...this.meta.mod[id], mutedUntil: m ? Date.now() + m * 60_000 : 0 };
    this.announce(m ? `🔇 ${this.users.get(id).username} ha sido silenciado en el chat` : `🔈 ${this.users.get(id).username} puede volver a escribir`);
  }

  ban(adminId, name, reason, banned = true) {
    const id = this.#target(adminId, name);
    this.meta.mod[id] = { ...this.meta.mod[id], banned, reason: banned ? String(reason ?? '').slice(0, 200) : '' };
    if (banned) for (const ws of this.sockets.get(id) ?? []) ws.close(4003, 'Cuenta suspendida');
  }

  deleteChat(adminId, msgId) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const id = Number(msgId);
    this.chat = this.chat.filter((m) => m.id !== id);
    this.meta.chatDeleted.push(id);
    if (this.meta.chatDeleted.length > 500) this.meta.chatDeleted.splice(0, this.meta.chatDeleted.length - 500);
    for (const uid of this.sockets.keys()) this.send(uid, { type: 'chat-delete', id });
  }

  broadcast(adminId, text) {
    if (!this.isAdmin(adminId)) throw new UserError('Solo para moderadores.');
    const clean = String(text ?? '').trim().slice(0, 300);
    if (!clean) throw new UserError('Escribe el anuncio.');
    this.announce(`📣 ${clean}`);
  }

  // ── Perfil y cuenta ────────────────────────────────────────────────────────

  /** El perfil de un jugador tal como lo ve `viewer` (si está conectado, solo lo ven sus amigos). */
  profile(name, viewer = null) {
    const id = this.byName.get(String(name ?? '').trim().toLowerCase());
    const game = id != null ? this.games.get(id) : null;
    if (!game) throw new UserError('No hay ningún jugador con ese nombre.');
    const info = this.playerInfo(id);
    const rank = this.ranking(null).top.find((r) => r.name === info.name)?.rank ?? null;
    return {
      name: info.name,
      city: this.islands.get(game.state.home)?.name,
      island: game.state.home,
      alliance: info.alliance,
      points: info.score,
      rank,
      online: this.seesOnline(viewer, id) ? info.online : null,
      joined: this.users.get(id).created,
      townLevel: info.townLevel,
      colonies: game.state.colonies.map((c) => c.name),
      coloso: game.level('coloso'),
      victories: game.stats.victories,
      kills: game.stats.kills ?? 0,
      loot: game.stats.loot ?? 0,
      feats: { won: game.stats.feats ?? 0, top: game.stats.featTop ?? 0, heart: game.stats.featHeart ?? 0 },
      achievements: game.achievements(),
      hero: game.state.hero ? { name: game.state.hero.name, level: game.state.hero.level } : null,
      banner: game.state.banner ?? null,
      title: this.#titleOf(id),
      titleId: game.state.title ?? null,
      history: (game.state.history ?? []).map((h) => ({ day: h.day, points: h.points })),
      muted: (this.meta.mod[id]?.mutedUntil ?? 0) > Date.now(),
      banned: this.isBanned(id),
    };
  }

  async changePassword(userId, current, next) {
    const user = this.users.get(userId);
    if (typeof current !== 'string' || !verifyPassword(current, user.pass)) throw new UserError('La contraseña actual no es correcta.');
    if (typeof next !== 'string' || next.length < 6 || next.length > 100) throw new UserError('La contraseña nueva debe tener al menos 6 caracteres.');
    user.pass = hashPassword(next);
    await this.store.updatePassword(userId, user.pass);
    this.endSessions(userId);
  }

  // ── Sesiones ───────────────────────────────────────────────────────────────
  // Las sesiones son tokens firmados que no se guardan en el servidor; para cerrarlas todas (al
  // cambiar la contraseña) se apunta desde cuándo valen y se rechazan las firmadas antes.

  /** Cierra todas las sesiones abiertas de un jugador (y sus conexiones en vivo). */
  endSessions(userId) {
    (this.meta.sessionsSince ??= {})[userId] = Date.now();
    for (const ws of this.sockets.get(userId) ?? []) ws.close(4001, 'sesion cerrada');
  }

  /** Si una sesión firmada en `iat` se cerró después (por un cambio de contraseña). */
  sessionClosed(userId, iat) {
    return (this.meta.sessionsSince?.[userId] ?? 0) > iat;
  }

  // ── Correo ─────────────────────────────────────────────────────────────────

  sendMail(userId, toName, subject, text) {
    const toId = this.byName.get(String(toName ?? '').trim().toLowerCase());
    if (toId == null) throw new UserError('No hay ningún jugador con ese nombre.');
    this.#deliverMail(userId, [toId], this.users.get(toId).username, subject, text);
  }

  /** Deja una carta en el buzón de cada destinatario y una copia en los enviados. */
  #deliverMail(userId, recipients, toLabel, subject, text) {
    subject = String(subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || '(sin asunto)';
    text = String(text ?? '').trim().slice(0, 2000);
    if (!text) throw new UserError('Escribe el mensaje.');
    const from = this.users.get(userId).username;
    const id = (this.meta.mailSeq = (this.meta.mailSeq ?? 0) + 1);
    const base = { id, t: Date.now(), from, to: toLabel, subject, text };
    const put = (uid, box) => {
      const game = this.games.get(uid);
      game.state.mail ??= [];
      game.state.mail.unshift({ ...base, box, read: box === 'out' });
      if (game.state.mail.length > MAX_MAIL) game.state.mail.length = MAX_MAIL;
      game.dirty = true;
    };
    for (const uid of recipients) {
      put(uid, 'in');
      this.pendingPush.add(uid); // que vea el sobre al momento
    }
    if (!recipients.includes(userId)) put(userId, 'out');
  }

  mailbox(userId) {
    return this.games.get(userId).state.mail ?? [];
  }

  /**
   * Lo último que ha visto un jugador: los mensajes de cada canal del chat, los avisos y las novedades.
   * Se guarda en su cuenta (no en el navegador) para que en otro dispositivo no vuelva a salir como
   * nuevo. Solo avanza: un dispositivo atrasado no lo puede deshacer.
   */
  markSeen(userId, { chat, note, news } = {}) {
    const game = this.games.get(userId);
    if (!game) return;
    const seen = (game.state.seen ??= {});
    const ahead = (now, n) => Number.isSafeInteger(n) && n > (now ?? 0);
    let changed = false;
    for (const ch of ['global', 'alianza', 'gesta']) {
      if (!ahead(seen.chat?.[ch], chat?.[ch])) continue;
      seen.chat = { ...seen.chat, [ch]: chat[ch] };
      changed = true;
    }
    if (ahead(seen.note, note)) {
      seen.note = note;
      changed = true;
    }
    // (las novedades tienen ids con la fecha delante: «2026-10-18e»)
    if (typeof news === 'string' && news.length <= 24 && news > (seen.news ?? '')) {
      seen.news = news;
      changed = true;
    }
    if (changed) game.dirty = true;
  }

  readMail(userId, id) {
    const game = this.games.get(userId);
    for (const m of game.state.mail ?? []) if (id === 'all' || m.id === Number(id)) m.read = true;
    game.dirty = true;
  }

  deleteMail(userId, id) {
    const game = this.games.get(userId);
    game.state.mail = (game.state.mail ?? []).filter((m) => m.id !== Number(id));
    game.dirty = true;
  }

  // ── Mercado del archipiélago (ofertas entre jugadores) ─────────────────────

  #cleanOffer(bag) {
    const entries = Object.entries(bag ?? {}).filter(([res]) => Object.hasOwn(RESOURCES, res));
    if (entries.length !== 1) throw new UserError('Cada lado de la oferta es un solo recurso.');
    const [res, raw] = entries[0];
    const n = Math.floor(Number(raw));
    if (!(n >= 1 && n <= 10_000_000)) throw new UserError('Cantidad no válida.');
    return { [res]: n };
  }

  /** Para comerciar con otros jugadores hace falta el puerto libre y no estar de vacaciones. */
  #canTrade(game, what) {
    if (game.state.vacation) throw new UserError(`De vacaciones no puedes ${what}.`);
    if (game.portClosed()) throw new UserError(`Tu puerto está en manos enemigas: no puedes ${what}.`);
  }

  listOffers(userId) {
    return this.meta.offers
      .map((o) => ({ ...o, sellerName: this.users.get(o.seller)?.username ?? '¿?', mine: o.seller === userId }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 100);
  }

  postOffer(userId, give, want) {
    give = this.#cleanOffer(give);
    want = this.#cleanOffer(want);
    if (Object.keys(give)[0] === Object.keys(want)[0]) throw new UserError('Elige dos recursos distintos.');
    const game = this.games.get(userId);
    this.#canTrade(game, 'publicar ofertas');
    if (game.level('mercado') < 1) throw new UserError('Necesitas un mercado para comerciar.');
    if (this.meta.offers.filter((o) => o.seller === userId).length >= MAX_OFFERS) throw new UserError(`Como mucho ${MAX_OFFERS} ofertas a la vez.`);
    if (!game.takeResources(give)) throw new UserError('No tienes esos recursos.');
    const id = (this.meta.offerSeq = (this.meta.offerSeq ?? 0) + 1);
    this.meta.offers.push({ id, seller: userId, give, want, t: Date.now() });
  }

  cancelOffer(userId, id) {
    const o = this.meta.offers.find((x) => x.id === Number(id));
    if (!o || o.seller !== userId) throw new UserError('Esa oferta no es tuya o ya no existe.');
    this.meta.offers = this.meta.offers.filter((x) => x !== o);
    this.games.get(userId).giveResources(o.give);
  }

  acceptOffer(userId, id) {
    const o = this.meta.offers.find((x) => x.id === Number(id));
    if (!o) throw new UserError('Alguien se te ha adelantado: esa oferta ya no existe.');
    if (o.seller === userId) throw new UserError('Es tu propia oferta.');
    const buyer = this.games.get(userId);
    this.#canTrade(buyer, 'aceptar ofertas');
    const owner = this.games.get(o.seller);
    if (owner?.portClosed()) throw new UserError(`El puerto de ${owner.name} está en manos enemigas: sus mercaderes no pueden salir.`);
    if (!buyer.takeResources(o.want)) throw new UserError('No tienes lo que piden.');
    this.meta.offers = this.meta.offers.filter((x) => x !== o);
    buyer.giveResources(o.give);
    const name = this.users.get(userId).username;
    const seller = this.games.get(o.seller);
    seller?.giveResources(o.want, `⚖️ ${name} ha aceptado tu oferta del mercado`);
    for (const g of [buyer, seller]) if (g) g.state.stats.trades = (g.state.stats.trades ?? 0) + 1;
  }
}

/** Error que se puede enseñar tal cual al jugador. */
export class UserError extends Error {}

/** Clave de la relación entre dos alianzas (la misma en los dos sentidos). */
function pairKey(x, y) {
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}
