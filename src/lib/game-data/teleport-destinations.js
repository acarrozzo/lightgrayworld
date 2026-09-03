/**
 * The fixed teleport network.
 *
 * This is the server's authority on where a fast travel may land, and the same
 * list the client's Fast travel grid renders — both derive it from the world
 * regions in `world-map.js`, so the grid can never offer a destination the
 * teleport handler would reject, or hide one it allows.
 *
 * Every region with a hub is a destination, and so is each of a region's
 * sub-hubs (the Blue Ocean's Underwater and Master Temple landings). World
 * destinations must be discovered: a player opens one by standing in its room
 * once (`discoveredTeleports` on the User row, written by the socket handlers
 * on arrival, keyed by the landing's `discoveryId`). The VIP rooms — the Lobby,
 * Room Zero and the Solar Office — are always open. As in the original, each
 * fast travel costs MP.
 *
 * Destinations decided at runtime rather than listed here — a guild lair, a
 * defeat respawn, a flee retreat — are authorized per-use through
 * `game-engine/teleport-grants`, not by adding them to this list.
 */
const { TELEPORT_HUBS } = require('./world-map')

/** The original charged 1 MP per fast travel. */
const TELEPORT_MP_COST = 1

const TELEPORT_LOCATIONS = TELEPORT_HUBS.map((hub) => ({
  roomId: hub.roomId,
  regionId: hub.regionId,
  /** What `discoveredTeleports` must hold for this landing to be open. */
  discoveryId: hub.discoveryId,
  name: hub.isSubHub ? `${hub.regionName}, ${hub.name}` : hub.regionName,
  description: hub.name,
  alwaysOpen: hub.alwaysOpen,
}))

const BY_ROOM = new Map(TELEPORT_LOCATIONS.map((location) => [location.roomId, location]))

/** True when `roomId` is part of the fixed teleport network (open or not). */
function isFixedTeleportDestination(roomId) {
  return BY_ROOM.has(roomId)
}

function getTeleportDestination(roomId) {
  return BY_ROOM.get(roomId) || null
}

/**
 * Whether a player may fast travel to `destination`, given the discovery ids
 * they have collected. Costs and combat/party rules are checked by the caller.
 */
function isTeleportDestinationOpen(destination, discoveredTeleports) {
  if (!destination) return false
  if (destination.alwaysOpen) return true
  const key = destination.discoveryId ?? destination.regionId
  return Array.isArray(discoveredTeleports) && discoveredTeleports.includes(key)
}

module.exports = {
  TELEPORT_MP_COST,
  TELEPORT_LOCATIONS,
  isFixedTeleportDestination,
  getTeleportDestination,
  isTeleportDestinationOpen,
}
