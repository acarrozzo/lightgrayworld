// Who is in a room, as one answer.
//
// There used to be four builders of this list and they disagreed:
//   - the socket move payload read live sockets plus ghosts, and knew who was idle;
//   - `/api/game/room/current` read the database's `isActive` column, which a
//     crash strands as true forever, and knew nothing of idle or of ghosts;
//   - `/api/game/room/[roomId]` read the same column, added ghosts, dropped idle;
//   - `login:success` sent ghosts only.
// So an idle player looked active after the viewer refreshed, and whether an
// offline ghost appeared depended on which of two requests landed first.
//
// Every one of them now calls this. The list is:
//   1. everyone the presence store has in the room (a live session, active or
//      idle, including one inside its reconnect grace window: the room was
//      never told they left, so they have not);
//   2. the ghosts of players whose session ended there (ghost-player-store,
//      24h), shown as 'disconnected'.
//
// Both stores live on `global`, so an API route and the socket server read the
// same data although Next bundles its own copy of this module.

const { getAllPresence, getPresence } = require('./presence-store.js')
const { getGhostsForRoom } = require('./ghost-player-store.js')

const STAT_KEYS = ['str', 'dex', 'mag', 'def', 'strMod', 'dexMod', 'magMod', 'defMod']

/**
 * The presence half of a room card: 'active' or 'idle', and for an idle player
 * the moment they went quiet, as `lastSeen` (the field the client's room list
 * already reads for "how long").
 */
function presenceFields(entry) {
  const isIdle = entry?.status === 'idle'
  return {
    presenceStatus: isIdle ? 'idle' : 'active',
    ...(isIdle ? { lastSeen: entry.idleSince ?? entry.lastSeen ?? Date.now() } : {}),
  }
}

/** Presence fields for one player by id, for the `player-joined` payload. */
function presenceFieldsFor(userId) {
  return presenceFields(getPresence(userId))
}

function toOccupant(roomId, entry, detail) {
  const stats = {}
  for (const key of STAT_KEYS) stats[key] = detail?.[key] ?? null
  return {
    id: entry.id,
    username: entry.username,
    level: entry.level,
    hp: entry.hp,
    hpMax: entry.hpMax,
    mp: entry.mp,
    mpMax: entry.mpMax,
    currentRoom: roomId,
    isActive: true,
    uIcon: entry.uIcon ?? null,
    uIconColor: entry.uIconColor ?? null,
    ...stats,
    inBattle: Boolean(entry.inBattle),
    battleEnemyName: entry.inBattle ? entry.battleEnemyName ?? null : null,
    partyLeaderId: entry.partyLeaderId ?? null,
    pet: entry.pet ?? entry.activePet ?? null,
    title: entry.title ?? null,
    ...presenceFields(entry),
  }
}

/**
 * @param {string} roomId
 * @param {Object} [options]
 * @param {(userId: string) => (Object|null|undefined)} [options.detailOf]
 *   Where the caller keeps each player's stat block (str/dex/mag/def and their
 *   mods): the live player object on the socket side, a database row on the
 *   HTTP side. Presence does not carry them. Who is here, and whether they are
 *   idle, never comes from this.
 * @param {Object} [options.arriving]
 *   A live player walking in right now. Presence still has them in the room
 *   they are leaving when the move payload is built, so they are named here.
 * @returns {Array<Object>} live occupants first, then disconnected ghosts
 */
function buildRoomOccupants(roomId, { detailOf = null, arriving = null } = {}) {
  if (!roomId) return []

  const seen = new Set()
  const players = []

  if (arriving?.id) {
    seen.add(arriving.id)
    // Their own live object for the numbers; presence for whether they are
    // idle (a follower pulled along by a leader can arrive idle).
    const presence = getPresence(arriving.id)
    players.push(
      toOccupant(
        roomId,
        {
          ...arriving,
          inBattle: presence?.inBattle ?? false,
          battleEnemyName: presence?.battleEnemyName ?? null,
          partyLeaderId: presence?.partyLeaderId ?? null,
          status: presence?.status ?? 'active',
          idleSince: presence?.idleSince ?? null,
        },
        detailOf?.(arriving.id) ?? arriving
      )
    )
  }

  for (const entry of getAllPresence()) {
    if (entry.currentRoom !== roomId || seen.has(entry.id)) continue
    seen.add(entry.id)
    players.push(toOccupant(roomId, entry, detailOf?.(entry.id)))
  }

  for (const ghost of getGhostsForRoom(roomId)) {
    if (seen.has(ghost.id)) continue
    seen.add(ghost.id)
    players.push({ ...ghost, status: 'disconnected', presenceStatus: 'disconnected' })
  }

  return players
}

/**
 * The same list split the way the HTTP room load has always returned it:
 * `players` (connected, active or idle) and `roomGhosts` (disconnected).
 */
function splitRoomOccupants(occupants) {
  const players = []
  const roomGhosts = []
  for (const occupant of occupants) {
    if (occupant.presenceStatus === 'disconnected') roomGhosts.push(occupant)
    else players.push(occupant)
  }
  return { players, roomGhosts }
}

module.exports = { buildRoomOccupants, splitRoomOccupants, presenceFieldsFor }
