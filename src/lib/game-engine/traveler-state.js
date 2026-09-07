/**
 * Where the travelers are right now.
 *
 * Ephemeral server state, like lever-state and search-reveal-state: it lives
 * in this process and is rebuilt on restart. Two kinds of traveler live here
 * differently (see game-data/travelers.js for the why):
 *
 *   wander — the bunny, Sherman. Their room, their next move time and, for
 *            the bunny, when it comes back after being killed, are all in the
 *            `wanderers` map. A restart puts each one in a random room of its
 *            range; nobody has lost anything.
 *   route  — Wendell. His room is derived from the clock every time it is
 *            asked for, so this module holds nothing about him except the last
 *            room it announced him in, to notice when he has moved on.
 *
 * One interval drives both: due wanderers move, a dead bunny comes back, and a
 * route traveler who has crossed a stop boundary is announced. Every change
 * goes to the rooms it touches as a `room:travelers` event carrying the room's
 * new traveler list and one feed line, so a player standing there sees the
 * card appear or go and reads why.
 *
 * Shared, not per player: everyone in a room sees the same traveler. Fighting
 * the bunny is per player through the ordinary battle state; a kill calls
 * `onTravelerKilled`, which is what removes the shared bunny for everyone.
 */

const {
  TRAVELERS,
  getTraveler,
  wanderExits,
  oppositeDirection,
  routePositionAt,
  pickLine,
} = require('../game-data/travelers')
const { getEnemy } = require('../game-data/enemies')

const ROOM_TRAVELERS_EVENT = 'room:travelers'
const DEFAULT_TICK_MS = 1000

const state = {
  io: null,
  timer: null,
  /** Map<travelerId, { roomId, nextMoveAt, goneUntil }> */
  wanderers: new Map(),
  /** Map<travelerId, { roomId }> — the stop last announced for a route traveler. */
  route: new Map(),
  /** Overrides Math.random in tests. */
  random: Math.random,
}

function randomBetween([min, max]) {
  return min + Math.floor(state.random() * (max - min + 1))
}

function randomItem(list) {
  return list[Math.floor(state.random() * list.length)]
}

function fill(line, vars) {
  return String(line || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

// --- Views -----------------------------------------------------------------

/**
 * A traveler as the client sees it: identity, what you can do with it, and
 * — for one that can be fought — the enemy card's numbers.
 */
function buildTravelerView(traveler, roomId, now = Date.now()) {
  const enemy = traveler.enemySlug ? getEnemy(traveler.enemySlug) : null
  const view = {
    id: traveler.id,
    kind: traveler.kind,
    name: traveler.name,
    title: traveler.title || null,
    description: traveler.description,
    icon: traveler.icon,
    iconFile: traveler.iconFile,
    actions: traveler.actions.map((a) => ({ ...a })),
    enemy: enemy
      ? {
          slug: enemy.slug,
          name: enemy.name,
          description: enemy.description,
          icon: enemy.icon,
          level: enemy.level,
          hp: enemy.hp,
          att: enemy.att,
          def: enemy.def,
          isAggressive: Boolean(enemy.isAggressive),
          isFriendly: Boolean(enemy.isFriendly),
        }
      : null,
    leavesAt: null,
  }
  if (traveler.movement.type === 'route') {
    view.leavesAt = routePositionAt(traveler, now).leavesAt
  }
  return view
}

// --- Position ----------------------------------------------------------------

/** The room a traveler is in, or null while it is away (a killed bunny). */
function roomIdOf(travelerId, now = Date.now()) {
  const traveler = getTraveler(travelerId)
  if (!traveler) return null
  if (traveler.movement.type === 'route') {
    return routePositionAt(traveler, now).stop.roomId
  }
  const entry = state.wanderers.get(travelerId)
  if (!entry) return null
  if (entry.goneUntil && now < entry.goneUntil) return null
  return entry.roomId
}

function isTravelerInRoom(travelerId, roomId, now = Date.now()) {
  return Boolean(roomId) && roomIdOf(travelerId, now) === roomId
}

/** Every traveler standing in `roomId`, in registry order. */
function listTravelersInRoom(roomId, now = Date.now()) {
  if (!roomId) return []
  return TRAVELERS.filter((t) => roomIdOf(t.id, now) === roomId).map((t) => buildTravelerView(t, roomId, now))
}

// --- Emitting --------------------------------------------------------------

function emitRoom(roomId, line, now = Date.now()) {
  if (!state.io || !roomId) return
  state.io.to(`room-${roomId}`).emit(ROOM_TRAVELERS_EVENT, {
    roomId,
    travelers: listTravelersInRoom(roomId, now),
    line: line ? { message: line, outcome: 'info' } : null,
    ts: now,
  })
}

// --- Movement ----------------------------------------------------------------

function placeWanderer(traveler, roomId, now) {
  state.wanderers.set(traveler.id, {
    roomId,
    nextMoveAt: now + randomBetween(traveler.movement.everyMs),
    goneUntil: null,
    fleeing: false,
  })
}

function seedWanderer(traveler, now) {
  placeWanderer(traveler, randomItem(traveler.movement.rooms), now)
}

/** Move one wanderer to an adjacent room of its range, announcing both ends. */
function moveWanderer(traveler, now) {
  const entry = state.wanderers.get(traveler.id)
  if (!entry) return
  const exits = wanderExits(traveler, entry.roomId)
  if (exits.length === 0) {
    entry.nextMoveAt = now + randomBetween(traveler.movement.everyMs)
    return
  }
  const { direction, to } = randomItem(exits)
  const from = entry.roomId
  const leaveLines = entry.fleeing && traveler.lines.flee ? traveler.lines.flee : traveler.lines.leave
  placeWanderer(traveler, to, now)
  emitRoom(from, fill(pickLine(leaveLines), { to: direction }), now)
  emitRoom(to, fill(pickLine(traveler.lines.arrive), { from: oppositeDirection(direction) }), now)
}

function respawnWanderer(traveler, now) {
  const roomId = randomItem(traveler.movement.rooms)
  placeWanderer(traveler, roomId, now)
  emitRoom(roomId, pickLine(traveler.lines.respawn || traveler.lines.arrive), now)
}

/** Announce a route traveler that has crossed into a new stop since last tick. */
function checkRoute(traveler, now) {
  const position = routePositionAt(traveler, now)
  const last = state.route.get(traveler.id)
  if (!last) {
    state.route.set(traveler.id, { roomId: position.stop.roomId, index: position.index })
    return
  }
  if (last.index === position.index) return
  const from = last.roomId
  const to = position.stop.roomId
  state.route.set(traveler.id, { roomId: to, index: position.index })
  if (from === to) return
  emitRoom(from, fill(pickLine(traveler.lines.leave), { to: position.stop.via }), now)
  emitRoom(to, fill(pickLine(traveler.lines.arrive), { from: oppositeDirection(position.stop.via) }), now)
}

/** One pass: everything that is due at `now`. Exported so tests can drive it. */
function tick(now = Date.now()) {
  for (const traveler of TRAVELERS) {
    if (traveler.movement.type === 'route') {
      checkRoute(traveler, now)
      continue
    }
    const entry = state.wanderers.get(traveler.id)
    if (!entry) {
      seedWanderer(traveler, now)
      continue
    }
    if (entry.goneUntil) {
      if (now >= entry.goneUntil) respawnWanderer(traveler, now)
      continue
    }
    if (now >= entry.nextMoveAt) moveWanderer(traveler, now)
  }
}

/**
 * The shared bunny has been killed by one player: it leaves for everyone and
 * comes back after its respawn time. A second kill in the same window (a
 * fight that was already under way) changes nothing. `roomId` is where the
 * fight was; if the bunny had hopped on since, that room hears about it too.
 */
function onTravelerKilled(travelerId, roomId, now = Date.now()) {
  const traveler = getTraveler(travelerId)
  if (!traveler || traveler.movement.type !== 'wander') return false
  const entry = state.wanderers.get(travelerId)
  if (!entry || entry.goneUntil) return false
  const from = entry.roomId
  entry.goneUntil = now + (traveler.respawnMs || 5 * 60 * 1000)
  entry.nextMoveAt = Infinity
  const line = pickLine(traveler.lines.gone)
  emitRoom(from, line, now)
  if (roomId && roomId !== from) emitRoom(roomId, line, now)
  return true
}

/**
 * A fight has started in `roomId`. Anyone who flees fights (Sherman) and is
 * standing there moves on within seconds instead of on his usual clock. Cheap:
 * it only brings an existing timer forward.
 */
function onBattleStarted(roomId, now = Date.now()) {
  for (const traveler of TRAVELERS) {
    if (!traveler.fleesFights || traveler.movement.type !== 'wander') continue
    const entry = state.wanderers.get(traveler.id)
    if (!entry || entry.goneUntil || entry.roomId !== roomId || entry.fleeing) continue
    const soon = now + randomBetween(traveler.fleeDelayMs || [4000, 12000])
    entry.nextMoveAt = Math.min(entry.nextMoveAt, soon)
    entry.fleeing = true
  }
}

// --- Lifecycle ---------------------------------------------------------------

function start({ io, now = Date.now(), tickMs = DEFAULT_TICK_MS, timer = true } = {}) {
  state.io = io || null
  for (const traveler of TRAVELERS) {
    if (traveler.movement.type === 'route') {
      const position = routePositionAt(traveler, now)
      state.route.set(traveler.id, { roomId: position.stop.roomId, index: position.index })
    } else if (!state.wanderers.has(traveler.id)) {
      seedWanderer(traveler, now)
    }
  }
  if (timer && !state.timer) {
    state.timer = setInterval(() => {
      try {
        tick()
      } catch (err) {
        console.error('[Travelers] tick failed:', err)
      }
    }, tickMs)
    state.timer.unref?.()
  }
}

function stop() {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
}

/** Tests only: forget everything. */
function reset() {
  stop()
  state.io = null
  state.wanderers.clear()
  state.route.clear()
  state.random = Math.random
}

function setRandom(fn) {
  state.random = typeof fn === 'function' ? fn : Math.random
}

module.exports = {
  ROOM_TRAVELERS_EVENT,
  start,
  stop,
  tick,
  reset,
  setRandom,
  roomIdOf,
  isTravelerInRoom,
  listTravelersInRoom,
  buildTravelerView,
  onTravelerKilled,
  onBattleStarted,
}
