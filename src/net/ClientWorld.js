import { clock } from '../config.js';
import { session } from './api.js';
import { distance } from '../game/world.js';

// Copia en el navegador del mundo que ve el jugador (la manda el servidor en cada
// estado). Tiene la misma interfaz `world` que usa Game.

export class ClientWorld {
  constructor() {
    this.islandMap = new Map();
    this.states = {};
    this.players = {};
    this.joints = [];
    this.truces = new Set();
    this.wrecks = {};
    this.version = 0;
  }

  /** El pecio que hay frente a una isla (lo manda el servidor en cada estado), o null. */
  wreckAt(id, t = clock.now()) {
    const w = this.wrecks[id];
    return w && w.until > t ? w : null;
  }

  /**
   * Actualiza con los datos del servidor. La lista de islas solo llega cuando cambia (si no, viene
   * vacía y se queda la que había), y del estado de las islas, entero (`full`) o solo las que han
   * cambiado. Devuelve si ha cambiado el conjunto de islas.
   */
  apply({ islands, rev, states, statesRev, full = true, players }) {
    this.states = full ? states : { ...this.states, ...states };
    // (aunque llegue una foto más vieja que la anterior: así la siguiente pide desde ahí y se corrige)
    session.statesRev = statesRev ?? null;
    this.players = players;
    if (!islands) return false;
    const before = [...this.islandMap.keys()].sort().join();
    this.islandMap = new Map(islands.map((i) => [i.id, i]));
    session.islandsRev = rev ?? null;
    const changed = [...this.islandMap.keys()].sort().join() !== before;
    if (changed) this.version++;
    return changed;
  }

  island(id) {
    return this.islandMap.get(id) ?? null;
  }

  islandState(id) {
    return this.states[id] ?? null;
  }

  playerInfo(userId) {
    return this.players[userId] ?? null;
  }

  /** Relación con otro jugador tal como la calcula el servidor ('aliado', 'pacto', 'guerra' o null). */
  relation(_me, other) {
    return this.players[other]?.rel ?? null;
  }

  /** Un ataque de tu alianza al que te puedes unir (lo manda el servidor en cada estado). */
  jointAttack(key) {
    return this.joints.find((j) => j.key === key) ?? null;
  }

  /** Tregua sagrada de una gesta con otro jugador (la lista la manda el servidor en cada estado). */
  truce(_me, other) {
    return this.truces.has(Number(other));
  }

  sameAlliance(me, other) {
    return this.relation(me, other) === 'aliado';
  }

  /** Si `other` te ha atacado hace poco (lo calcula el servidor). */
  attackedBy(_me, other) {
    return !!this.players[other]?.hitMe;
  }

  islands() {
    return [...this.islandMap.values()];
  }

  /** Los asentamientos de un continente (los que lleguen en el estado). */
  sitesOn(land) {
    return this.islands().filter((i) => i.land === land);
  }

  islandsNear(homeId, radius) {
    const home = this.island(homeId);
    if (!home) return [];
    return this.islands()
      .map((i) => ({ ...i, d: distance(i, home) }))
      .filter((i) => i.d <= radius)
      .sort((a, b) => a.d - b.d);
  }
}
