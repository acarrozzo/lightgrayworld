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
 * on arrival, keyed by the landing's `discoveryId`). The four guild halls are
 * sub-hubs too, but open by membership (`membershipFactionId`): the original's
 * guild squares lit when the initiation quest was turned in, and that quest's
 * row is still what opens them. The VIP rooms — the Lobby, Room Zero and the
 * Solar Office — are always open. As in the original, each fast travel costs
 * MP.
 *
 * Below the world sits the original's second teleport box, "You can fast
 * travel to any boss you have previously defeated": one landing per boss
 * (`BOSS_TELEPORTS`), open once the player's KillList holds a kill of it.
 *
 * Destinations decided at runtime rather than listed here — a guild lair, a
 * defeat respawn, a flee retreat — are authorized per-use through
 * `game-engine/teleport-grants`, not by adding them to this list.
 */
const { TELEPORT_HUBS, WORLD_REGIONS, MAP_SHEETS, getWorldRegionForRoom, getMapSheetForRoom, getMapIdForRoom } = require('./world-map')
const { BOSSES } = require('./bosses.generated')

/** The original charged 1 MP per fast travel. */
const TELEPORT_MP_COST = 1

const TELEPORT_LOCATIONS = TELEPORT_HUBS.map((hub) => ({
  roomId: hub.roomId,
  regionId: hub.regionId,
  /** What `discoveredTeleports` must hold for this landing to be open. */
  discoveryId: hub.discoveryId,
  /** A guild hall: open to the faction's members instead of by discovery. */
  membershipFactionId: hub.unlockedByMembership || null,
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
 * they have collected, the enemies they have killed (an iterable of slugs,
 * only needed for a boss landing) and the guilds they belong to (an iterable
 * of faction ids, only needed for a guild hall — `memberGuildIds` in
 * factions.js derives it from quest rows). Costs and combat/party rules are
 * checked by the caller.
 */
function isTeleportDestinationOpen(destination, discoveredTeleports, killedSlugs, memberships) {
  if (!destination) return false
  if (destination.bossSlug) {
    return includes(killedSlugs, destination.bossSlug)
  }
  if (destination.membershipFactionId) {
    return includes(memberships, destination.membershipFactionId)
  }
  if (destination.alwaysOpen) return true
  const key = destination.discoveryId ?? destination.regionId
  return Array.isArray(discoveredTeleports) && discoveredTeleports.includes(key)
}

/** The boss landings a player has opened, in display order (highest level first). */
function defeatedBossTeleports(killedSlugs) {
  return BOSS_TELEPORTS.filter((boss) => includes(killedSlugs, boss.slug))
}

/**
 * The world's regions in the order the Teleport page lists them: by hub room
 * number, the Grassy Field first and Star City last.
 */
const REGIONS_IN_WORLD_ORDER = WORLD_REGIONS.filter((region) => region.hub).sort(
  (a, b) => Number(a.hub.roomId) - Number(b.hub.roomId)
)

/**
 * Boss landings laid over the world: one group per region that holds any of
 * `bosses`, in the Regions ladder's own order. Inside a region the bosses
 * come lowest level first — the Death Worm (23) above the Axeman (25), the
 * Kraken (25) above the four L35 ocean bosses — and a tie goes to the sheet
 * nearer the surface in the atlas's order, so Red Beard on the Rocky Flats
 * surface sits above Phoenix in the Mine though both are L30. The Teleport
 * page draws its Bosses ladder this way (a heading per region, the region's
 * colour) and the World Tool's Teleport page the same, so the two cannot
 * drift. A boss whose lair is on no region's sheet (there is none today) is
 * left out rather than invented a region.
 *
 * @param {Array<{ roomId: string, level: number, name: string }>} bosses
 * @returns {Array<{ region: object, bosses: typeof bosses }>}
 */
function groupBossTeleportsByRegion(bosses) {
  const sheetIndex = (roomId) => MAP_SHEETS.findIndex((sheet) => sheet.id === getMapIdForRoom(roomId))
  return REGIONS_IN_WORLD_ORDER.map((region) => ({
    region,
    bosses: bosses
      .filter((boss) => getWorldRegionForRoom(boss.roomId)?.id === region.id)
      .sort((a, b) => a.level - b.level || sheetIndex(a.roomId) - sheetIndex(b.roomId) || a.name.localeCompare(b.name)),
  })).filter((group) => group.bosses.length > 0)
}

/**
 * The map sheet a boss's lair is drawn on, when it is not the region's
 * surface: "Underground", "Sewers", "Mine", "Underwater", "Upper Level",
 * "The Despair". Null on the surface, where the region's heading says it all.
 */
function bossSheetLevel(roomId) {
  const level = getMapSheetForRoom(roomId)?.level
  return level && level !== 'Surface' ? level : null
}

function includes(iterable, value) {
  if (!iterable) return false
  if (iterable instanceof Set) return iterable.has(value)
  for (const entry of iterable) if (entry === value) return true
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
  groupBossTeleportsByRegion,
  bossSheetLevel,
}
