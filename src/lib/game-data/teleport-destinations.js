/**
 * The fixed teleport network.
 *
 * This is the server's authority on where a fast travel may land, and the same
 * list the client's Travel grid renders — both derive it from the world
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
 * Below the world sits the original's second teleport box, "You can fast
 * travel to any boss you have previously defeated": one landing per boss
 * (`BOSS_TELEPORTS`), open once the player's KillList holds a kill of it.
 *
 * Destinations decided at runtime rather than listed here — a guild lair, a
 * defeat respawn, a flee retreat — are authorized per-use through
 * `game-engine/teleport-grants`, not by adding them to this list.
 */
const { TELEPORT_HUBS } = require('./world-map')
const { BOSSES } = require('./bosses.generated')

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
  cost: TELEPORT_MP_COST,
}))

const BY_ROOM = new Map(TELEPORT_LOCATIONS.map((location) => [location.roomId, location]))
const HUB_ROOMS = new Set(BY_ROOM.keys())

/**
 * The boss landings, highest level first — the order the Travel tab shows
 * them. Every enemy tagged `rank: 'boss'` with a `lair` in enemies.js is one
 * (read from bosses.generated.js, the browser-sized copy), except where the
 * lair is already a hub — the Hydra Pit and the Master Temple sub-hubs — so no
 * room gets two tiles. A boss with no lair (King Blade, who roams the mountain
 * ladder) has no landing. The original's page drew seventeen buttons and
 * could reach thirteen of them; this list is whatever the registry says.
 *
 * Each costs the boss's level in MP: the original charged three times the
 * *player's* level, a flat tax that made the Gator as dear as the Minotaur;
 * pricing the destination instead keeps an early rematch cheap and a late one
 * a real cast.
 */
const BOSS_TELEPORTS = BOSSES.filter((boss) => boss.rank === 'boss' && boss.lair && !HUB_ROOMS.has(boss.lair))
  .map((boss) => ({ ...boss, roomId: boss.lair, cost: boss.level }))
  .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))

const BOSS_BY_ROOM = new Map(BOSS_TELEPORTS.map((boss) => [boss.roomId, boss]))
const BOSS_BY_SLUG = new Map(BOSS_TELEPORTS.map((boss) => [boss.slug, boss]))

/** True when `roomId` is part of the fixed teleport network (open or not). */
function isFixedTeleportDestination(roomId) {
  return BY_ROOM.has(roomId) || BOSS_BY_ROOM.has(roomId)
}

/**
 * The destination behind a room: a hub (`discoveryId`, opened by discovery)
 * or a boss landing (`bossSlug`, opened by a kill). Both carry `name` and
 * `cost`; the teleport handler reads nothing else.
 */
function getTeleportDestination(roomId) {
  const hub = BY_ROOM.get(roomId)
  if (hub) return hub
  const boss = BOSS_BY_ROOM.get(roomId)
  if (!boss) return null
  return { roomId: boss.roomId, name: boss.name, cost: boss.cost, bossSlug: boss.slug }
}

/** The boss whose first kill opens a teleport, by enemy slug, or null. */
function getBossTeleport(enemySlug) {
  return BOSS_BY_SLUG.get(enemySlug) || null
}

/**
 * Whether a player may fast travel to `destination`, given the discovery ids
 * they have collected and the enemies they have killed (an iterable of slugs,
 * only needed for a boss landing). Costs and combat/party rules are checked by
 * the caller.
 */
function isTeleportDestinationOpen(destination, discoveredTeleports, killedSlugs) {
  if (!destination) return false
  if (destination.bossSlug) {
    return hasKilled(killedSlugs, destination.bossSlug)
  }
  if (destination.alwaysOpen) return true
  const key = destination.discoveryId ?? destination.regionId
  return Array.isArray(discoveredTeleports) && discoveredTeleports.includes(key)
}

/** The boss landings a player has opened, in display order (highest level first). */
function defeatedBossTeleports(killedSlugs) {
  return BOSS_TELEPORTS.filter((boss) => hasKilled(killedSlugs, boss.slug))
}

function hasKilled(killedSlugs, slug) {
  if (!killedSlugs) return false
  if (killedSlugs instanceof Set) return killedSlugs.has(slug)
  for (const killed of killedSlugs) if (killed === slug) return true
  return false
}

module.exports = {
  TELEPORT_MP_COST,
  TELEPORT_LOCATIONS,
  BOSS_TELEPORTS,
  isFixedTeleportDestination,
  getTeleportDestination,
  getBossTeleport,
  isTeleportDestinationOpen,
  defeatedBossTeleports,
}
