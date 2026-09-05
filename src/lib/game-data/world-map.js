/**
 * The world as sheets of map artwork and the regions they belong to.
 *
 * One CommonJS module so the server and the client read the same table: the
 * server unlocks a sheet's "found" flag and a region's fast travel when a
 * player arrives, and the client draws the compass mini-map, the Map view, the
 * World grid and the Fast travel grid from the same rows. It replaces three
 * copies that had drifted apart — `MAP_CONFIG` and `getMapIdForRoom` in the
 * game interface, and the room sets inside the socket handlers' map unlocks.
 *
 * Two ideas live here, and they are deliberately different:
 *
 *  - A **sheet** is one piece of artwork (`/img/lightgray_map_*.jpg`) with a
 *    per-player "found" flag on the User row. The compass and the Map view show
 *    sheets.
 *  - A **region** is a place on the world grid — the original's "Map of Vega"
 *    laid its nine surface maps out three by three with the Grassy Field in the
 *    middle, and that layout is kept here in reading order. A region groups its
 *    sheets (surface, underground, sewers, mine) and names the hub room fast
 *    travel lands in. Regions without a hub or sheets yet are placeholders: they
 *    render as "Not found yet" and keep the world's shape visible before the
 *    content exists, exactly as the original's teleport page did.
 *
 * This is not the theme layer's colour region (`theme/regions.ts`), which
 * answers "what does this room look like" — the Beach and the Scorpion Pit are
 * distinct colour regions but both sit on the Grassy Field sheet.
 */

// --- Sheets -------------------------------------------------------------------

const MAP_SHEETS = [
  { id: 'grassy-field', title: 'Grassy Field', src: '/img/lightgray_map_grassyfield_main_s1.jpg', flag: 'grassyFieldMap', region: 'grassy-field', level: 'Surface' },
  { id: 'grassy-field-underground', title: 'Grassy Field Underground', src: '/img/lightgray_map_grassyfield_underground.jpg', flag: 'grassyFieldUndergroundMap', region: 'grassy-field', level: 'Underground' },
  { id: 'forest', title: 'Forest', src: '/img/lightgray_map_forest_main.jpg', flag: 'forestMap', region: 'forest', level: 'Surface' },
  { id: 'forest-underground', title: 'Forest Underground', src: '/img/lightgray_map_forest_underground.jpg', flag: 'forestUndergroundMap', region: 'forest', level: 'Underground' },
  { id: 'red-town', title: 'Red Town', src: '/img/lightgray_map_redtown_main.jpg', flag: 'redTownMap', region: 'red-town', level: 'Surface' },
  { id: 'red-town-sewers', title: 'Red Town Sewers', src: '/img/lightgray_map_redtown_sewers.jpg', flag: 'redTownSewersMap', region: 'red-town', level: 'Sewers' },
  { id: 'rocky-flats', title: 'Rocky Flats', src: '/img/lightgray_map_rockyflats_main.jpg', flag: 'rockyFlatsMap', region: 'rocky-flats', level: 'Surface' },
  { id: 'rocky-flats-underground', title: 'Rocky Flats Underground', src: '/img/lightgray_map_rockyflats_underground.jpg', flag: 'rockyFlatsUndergroundMap', region: 'rocky-flats', level: 'Underground' },
  { id: 'neverending-mine', title: 'The Neverending Mine', src: '/img/lightgray_map_neverendingmine_main.jpg', flag: 'neverEndingMineMap', region: 'rocky-flats', level: 'Mine' },
  { id: 'ocean', title: 'Blue Ocean', src: '/img/lightgray_map_blueocean_main.jpg', flag: 'oceanMap', region: 'ocean', level: 'Surface' },
  { id: 'ocean-underwater', title: 'Under the Ocean', src: '/img/lightgray_map_blueocean_underwater.jpg', flag: 'oceanUnderwaterMap', region: 'ocean', level: 'Underwater' },
  { id: 'dark-forest', title: 'Dark Forest', src: '/img/lightgray_map_dark_forest_main.jpg', flag: 'darkForestMap', region: 'dark-forest', level: 'Surface' },
  // The tree tops and the Keep's second floor: the one sheet in the world that
  // sits ABOVE its surface rather than below it. The grid still files it with
  // the other non-surface sheets, labelled by its own level.
  { id: 'dark-forest-upper', title: 'Dark Forest Upper Level', src: '/img/lightgray_map_dark_forest_upperlevel.jpg', flag: 'darkForestUpperMap', region: 'dark-forest', level: 'Upper Level' },
  { id: 'room-zero', title: 'Room Zero', src: '/img/lightgray_map_roomzero.jpg', flag: 'roomZeroMap', region: 'room-zero', level: 'Surface' },
  { id: 'lobby', title: 'Plane of Rebirth', src: '/img/lightgray_map_the_lobby.jpg', flag: 'lobbyMap', region: 'lobby', level: 'Surface' },
  { id: 'solar-office', title: 'Solar Office', src: '/img/lightgray_map_solar_office.jpg', flag: 'solarOfficeMap', region: 'solar-office', level: 'Surface' },
]

/** The User columns that record a found sheet, for Prisma selects. */
const MAP_FLAG_FIELDS = MAP_SHEETS.map((sheet) => sheet.flag)

const SHEETS_BY_ID = new Map(MAP_SHEETS.map((sheet) => [sheet.id, sheet]))

// --- Regions ------------------------------------------------------------------

/**
 * The nine surface regions in the original's grid order (three columns):
 *
 *   Star City   | Mountains    | Dark Forest
 *   Blue Ocean  | Grassy Field | Forest
 *   Swamp       | Rocky Flats  | Red Town
 *
 * The seeded exits agree with it: the Grassy Field opens east into the Forest,
 * the Forest runs south into Red Town, Red Town runs west into the Rocky Flats,
 * and the Rocky Flats climb north back to the field.
 *
 * `color` is the suffix of the `world.*` theme token that paints the region's
 * tile; `hub` is where fast travel lands. Neither exists for a placeholder.
 *
 * `subHubs` are a region's extra fast-travel landings. The original's teleport
 * page gave the Blue Ocean three squares — the Oasis, "Underwater" and the
 * "Master Water Temple" — each found separately. They sit under their region's
 * tile on the grid and are discovered by standing in them, like the hub; their
 * discovery id is `<region>/<sub-hub>` so the User row's `discoveredTeleports`
 * can hold them beside the region ids.
 */
const WORLD_REGIONS = [
  { id: 'star-city', name: 'Star City' },
  { id: 'mountains', name: 'Mountains' },
  {
    id: 'dark-forest',
    name: 'Dark Forest',
    color: 'dark-forest',
    hub: { roomId: '507', name: 'Dark Forest Teleport' },
    // The original's teleport page gave the Ranger's Guild its own cube, open
    // to members. It is a sub-hub here: found by standing in the guild lobby,
    // which only a member can do, so membership is the discovery.
    subHubs: [{ id: 'rangers-guild', roomId: '515a', name: "Ranger's Guild" }],
  },
  {
    id: 'ocean',
    name: 'Blue Ocean',
    color: 'ocean',
    hub: { roomId: '413', name: 'Blue Oasis' },
    subHubs: [
      { id: 'underwater', roomId: '484', name: 'Underwater' },
      { id: 'master-temple', roomId: '425', name: 'Master Temple' },
    ],
  },
  { id: 'grassy-field', name: 'Grassy Field', color: 'grassy-field', hub: { roomId: '001', name: 'Crossroads' } },
  { id: 'forest', name: 'Forest', color: 'forest', hub: { roomId: '104', name: 'Forest Crossroads' } },
  { id: 'swamp', name: 'Swamp' },
  { id: 'rocky-flats', name: 'Rocky Flats', color: 'rocky-flats', hub: { roomId: '303', name: 'The Crossroads' } },
  { id: 'red-town', name: 'Red Town', color: 'red-town', hub: { roomId: '210', name: 'Grand Square' } },
]

/**
 * Rooms outside the world proper. Fast travel to these is always open — they
 * are the game's front door, not places to discover — and they sit in their
 * own row under the grid.
 */
const VIP_REGIONS = [
  { id: 'lobby', name: 'Plane of Rebirth', color: 'lobby', hub: { roomId: '999', name: 'Where the fallen wake' }, alwaysOpen: true },
  { id: 'room-zero', name: 'Room Zero', color: 'room-zero', hub: { roomId: '000', name: 'The starting room' }, alwaysOpen: true },
  { id: 'solar-office', name: 'Solar Office', color: 'solar-office', hub: { roomId: '088', name: 'Command office' }, alwaysOpen: true },
]

const ALL_REGIONS = [...WORLD_REGIONS, ...VIP_REGIONS]
const REGIONS_BY_ID = new Map(ALL_REGIONS.map((region) => [region.id, region]))
const REGIONS_BY_HUB = new Map(ALL_REGIONS.filter((r) => r.hub).map((region) => [region.hub.roomId, region]))

/**
 * Every fast-travel landing in the world — each region's hub and each of its
 * sub-hubs — as one flat list. `discoveryId` is what a player's
 * `discoveredTeleports` records: the region id for a hub, `<region>/<sub>` for
 * a sub-hub. `isSubHub` tells the grid whether to draw it as a tile or as a
 * button under one.
 */
const TELEPORT_HUBS = ALL_REGIONS.flatMap((region) => {
  if (!region.hub) return []
  const main = {
    regionId: region.id,
    regionName: region.name,
    discoveryId: region.id,
    roomId: region.hub.roomId,
    name: region.hub.name,
    isSubHub: false,
    alwaysOpen: region.alwaysOpen === true,
  }
  const subs = (region.subHubs || []).map((sub) => ({
    regionId: region.id,
    regionName: region.name,
    discoveryId: `${region.id}/${sub.id}`,
    roomId: sub.roomId,
    name: sub.name,
    isSubHub: true,
    alwaysOpen: false,
  }))
  return [main, ...subs]
})
const HUBS_BY_ROOM = new Map(TELEPORT_HUBS.map((hub) => [hub.roomId, hub]))

// --- Room → sheet -------------------------------------------------------------

const SCORPION_DUNGEON = new Set(['012b', '012c', '012d', '012e', '012f', '012g', '012h'])

const FOREST_UNDERGROUND = new Set([
  '111a', '111b', '111c', '111d', '111e', '111f', '111g', '111h', '111i', '111j', '111k',
  '115a', '115b', '115c', '115d', '115e', '115f', '115g', '115h', '115i', '115j', '115k',
])

/**
 * Rooms below Red Town: the sewers proper, the Thieve's Den and the Catacombs.
 * Listed explicitly rather than matched on a `232` prefix because two `232*`
 * rooms live above ground — the Back Alley by a Sewer (232) and the Thieve's
 * Den Secret Entrance (232mm).
 */
const RED_TOWN_SEWERS = new Set([
  '232a', '232b', '232c', '232d', '232e', '232f', '232g', '232h', '232i', '232j',
  '232k', '232l', '232m', '232n', '232o', '232p', '232q', '232r', '232s', '232t',
  '232u', '232v', '232w', '232x', '232y', '232z',
])

/**
 * Rocky Flats rooms drawn on the underground sheet: the Abandoned Mine's four
 * rooms and the chamber below the Stone Grotto. The surface entrances (315,
 * 321) stay on the surface sheet.
 */
const ROCKY_FLATS_UNDERGROUND = new Set(['315a', '315b', '315c', '315d', '321b'])

/**
 * Rooms drawn on the Under the Ocean sheet: everything from the Silver Chest
 * to the Kraken, and the Mud Cave under Mud Island. The surface entrances to
 * them (the whirlpool, the storm, Mud Island itself) stay on the surface sheet.
 */
const OCEAN_UNDERWATER = new Set([
  '480', '481', '482', '483', '484', '485', '486', '487', '488', '489',
  '490', '491', '492', '493', '494', '495', '496', '497', '498', '499',
])

/**
 * Rooms drawn on the Dark Forest upper level: the Ranger's Guild in the tree
 * tops (515a-e) and the second floor of the Dark Keep (516e-h). The guild's
 * ladder (515) and the Keep's ground floor stay on the surface sheet.
 */
const DARK_FOREST_UPPER = new Set(['515a', '515b', '515c', '515d', '515e', '516e', '516f', '516g', '516h'])

/** Which sheet a room is drawn on. */
function getMapIdForRoom(roomId) {
  if (!roomId) return 'grassy-field'
  if (roomId === '000') return 'room-zero'
  if (roomId === '999') return 'lobby'
  if (roomId === '088') return 'solar-office'
  if (DARK_FOREST_UPPER.has(roomId)) return 'dark-forest-upper'
  if (roomId.startsWith('5')) return 'dark-forest'
  if (OCEAN_UNDERWATER.has(roomId)) return 'ocean-underwater'
  if (roomId.startsWith('4')) return 'ocean'
  if (roomId.startsWith('003b') || (roomId.startsWith('028') && roomId !== '028') || SCORPION_DUNGEON.has(roomId)) {
    return 'grassy-field-underground'
  }
  if (FOREST_UNDERGROUND.has(roomId)) return 'forest-underground'
  if (RED_TOWN_SEWERS.has(roomId)) return 'red-town-sewers'
  // The Neverending Mine: Level 0 is drawn on the Rocky Flats Underground sheet
  // where the mine head sits; everything below it is on the mine's own artwork.
  if (roomId === '311-00') return 'rocky-flats-underground'
  if (roomId.startsWith('311-')) return 'neverending-mine'
  if (ROCKY_FLATS_UNDERGROUND.has(roomId)) return 'rocky-flats-underground'
  if (roomId.startsWith('3')) return 'rocky-flats'
  // The Red Guard Captain's lookout tower is drawn on the Forest artwork even
  // though its room ID belongs to the Red Town block.
  if (roomId === '215') return 'forest'
  if (roomId.startsWith('2')) return 'red-town'
  if (roomId.startsWith('1')) return 'forest'
  return 'grassy-field'
}

function getMapSheet(mapId) {
  return SHEETS_BY_ID.get(mapId) || null
}

function getMapSheetForRoom(roomId) {
  return SHEETS_BY_ID.get(getMapIdForRoom(roomId)) || MAP_SHEETS[0]
}

function getWorldRegion(regionId) {
  return REGIONS_BY_ID.get(regionId) || null
}

/** The region whose sheet a room is drawn on. */
function getWorldRegionForRoom(roomId) {
  return REGIONS_BY_ID.get(getMapSheetForRoom(roomId).region) || null
}

/** The region whose fast-travel hub is this room, or null. */
function getWorldRegionByHubRoom(roomId) {
  return REGIONS_BY_HUB.get(roomId) || null
}

/** The fast-travel landing (hub or sub-hub) that is this room, or null. */
function getTeleportHubByRoom(roomId) {
  return HUBS_BY_ROOM.get(roomId) || null
}

/** A region's sub-hubs as landings, in the order they are declared. */
function getSubHubsForRegion(regionId) {
  return TELEPORT_HUBS.filter((hub) => hub.isSubHub && hub.regionId === regionId)
}

/** The sheets that belong to a region, in the order they are listed above. */
function getSheetsForRegion(regionId) {
  return MAP_SHEETS.filter((sheet) => sheet.region === regionId)
}

module.exports = {
  MAP_SHEETS,
  MAP_FLAG_FIELDS,
  WORLD_REGIONS,
  VIP_REGIONS,
  ALL_REGIONS,
  getMapIdForRoom,
  getMapSheet,
  getMapSheetForRoom,
  getWorldRegion,
  getWorldRegionForRoom,
  getWorldRegionByHubRoom,
  getTeleportHubByRoom,
  getSubHubsForRegion,
  getSheetsForRegion,
  TELEPORT_HUBS,
  DARK_FOREST_UPPER,
}
