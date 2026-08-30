/**
 * Where each room sits on its 800x800 map artwork, in image pixels (the
 * top-left corner of the room's cell). These coordinates originate from the
 * original game's background-position values.
 *
 * Two consumers share this table so they cannot drift:
 *  - the compass mini-map, which pans the artwork with `background-position`;
 *  - the full map view, which draws the "you are here" marker.
 */

export const MAP_IMAGE_SIZE = 800
/** Visible size of one room cell; the authored grid steps 105px between cells. */
export const MAP_CELL_SIZE = 100

const DEFAULT_POSITION = { x: 350, y: 350 }

/** Single-room maps (Solar Office, The Lobby) simply centre their artwork. */
const CENTERED_ROOMS = new Set(['088', '999'])

export const ROOM_MAP_COORDS: Record<string, { x: number; y: number }> = {
  '000': { x: 350, y: 350 },  // Room Zero
  '001': { x: 350, y: 350 },  // Grassy Field Crossroads
  '002': { x: 350, y: 455 },  // Grassy Field South
  '003': { x: 245, y: 455 },  // Wood Cabin
  '013': { x: 140, y: 560 },  // Marsh Behind the Cabin
  '003c': { x: 140, y: 455 },  // Young Soldier
  '004': { x: 245, y: 350 },  // Flower Patch
  '005': { x: 350, y: 245 },  // Grassy Field North
  '006': { x: 455, y: 350 },  // Basic Shop
  '007': { x: 455, y: 455 },  // Cave Entrance
  '014': { x: 140, y: 350 },  // Dirt Road West
  '015': { x: 35, y: 140 },  // On the Beach Sandy shores
  '016': { x: 35, y: 245 },  // On the Beach by a Giant Rock
  '017': { x: 35, y: 350 },  // Abandoned Docks
  '018': { x: 35, y: 455 },  // Rocky Beach
  '019': { x: 35, y: 560 },  // Sand Crab Nest
  '020': { x: 245, y: 245 },  // Healing Springs
  '021': { x: 455, y: 245 },  // Pajama Shaman
  '026': { x: 350, y: 560 },  // Stone Path South (south of 002)
  '027': { x: 350, y: 665 },  // Dwarf Guard - Gate to the Rocky Flats (south of 026)
  '028': { x: 245, y: 665 },  // Bat Cave Entrance (southwest of 026, west of 027)
  // Grassy Field Underground rooms (coordinates relative to underground map image)
  '003b': { x: 245, y: 455 },  // Cabin Basement
  '003bb': { x: 140, y: 455 },  // Destroyed Basement
  // Spider Cave rooms (overworld map, 105px grid steps from 007 at -455 -455)
  '008': { x: 455, y: 560 },  // Spider Cave Exit (south of 007)
  '009': { x: 455, y: 665 },  // Spider Cave #009 (south of 008)
  '010': { x: 560, y: 665 },  // Spider Cave #010 (east of 009)
  '011': { x: 560, y: 560 },  // Spider Cave #011 (east of 008 / north of 010)
  '012': { x: 665, y: 560 },  // Above the Scorpion Pit (east of 011)
  // Scorpion Pit underground (105px grid steps, underground map)
  '012b': { x: 665, y: 560 },  // Scorpion Pit EXIT
  '012c': { x: 665, y: 665 },  // Scorpion Pit Path (south of 012b)
  '012d': { x: 560, y: 665 },  // Scorpion Control Room (south of 012e)
  '012e': { x: 560, y: 560 },  // Scorpion Guard Room (northwest of 012c)
  '012f': { x: 560, y: 455 },  // Scorpion Hall (north of 012e)
  '012g': { x: 665, y: 350 },  // Scorpion Queen Nest (northeast of 012f)
  '012h': { x: 665, y: 245 },  // Scorpion Throne Room (north of 012g)
  // Bat Cave underground (entry via 028.down = 028b)
  // Row alignment: 028h shares row Y=-455 with 003bb/003b (cabin basements)
  '028b': { x: 245, y: 665 },  // Bat Cave EXIT (col 3, bottom row)
  '028c': { x: 350, y: 665 },  // Abandoned Workshop (col 4, bottom row)
  '028d': { x: 245, y: 560 },  // Bat Cave hub (col 3, middle row; north of 028b)
  '028e': { x: 140, y: 665 },  // Bat Nest (col 2, bottom row)
  '028f': { x: 140, y: 560 },  // Salamander Cavern (col 2, middle row; north of 028e)
  '028g': { x: 35, y: 560 },  // Goblin Tracks (col 1, middle row; west of 028f)
  '028h': { x: 35, y: 455 },  // Goblin Dead End (col 1, same row as 003bb/003b)
  '028i': { x: 35, y: 350 },  // Goblin Hideout (col 1, top; directly N of 028h)
  // East forest-edge rooms (overworld map, 105px grid steps east from 006)
  '022': { x: 560, y: 350 },  // Dirt Road East (east of 006)
  '023': { x: 665, y: 350 },  // Jack's Forest Gate (east of 022)
  '024': { x: 665, y: 245 },  // Jack Lumber (north of 023)
  '025': { x: 665, y: 140 },  // Goblin Woods (north of 024)
  // Forest rooms (coordinates relative to forest map image)
  '101': { x: 35, y: 350 },  // Forest Path (entry from west)
  '102': { x: 140, y: 455 },  // Forest Path near a Cow Farm
  '103': { x: 140, y: 350 },  // Freddie's Cow Farm
  '103b': { x: 140, y: 245 },  // Cows (north of 103)
  '103c': { x: 35, y: 245 },  // More Cows (west of 103b)
  '104': { x: 245, y: 455 },  // Stone Path by a Forest Gate
  '105': { x: 245, y: 350 },  // Traveling Wizard
  '106': { x: 245, y: 560 },  // Traveling Warrior
  '107': { x: 245, y: 665 },  // Stone Path by a Hill
  '108': { x: 140, y: 665 },  // Dirt Path Behind a Hill
  '109': { x: 35, y: 560 },  // Behind a Hill by a Cave
  '110': { x: 35, y: 455 },  // Behind a Hill
  '111': { x: 140, y: 560 },  // Ogre Cave
  '112': { x: 245, y: 245 },  // Stone Path
  '113': { x: 245, y: 140 },  // Stone Path
  '114': { x: 245, y: 35 },  // Stone Path by a Magical Gate
  '115': { x: 140, y: 140 },  // Kobold Lair
  '116': { x: 350, y: 350 },  // Forest Entrance
  '117': { x: 350, y: 245 },  // Under a Massive Tree
  '118': { x: 350, y: 140 },  // Hunter Bill
  '119': { x: 455, y: 35 },  // Forest by a Gold Chest
  '120': { x: 455, y: 140 },  // Forest by a River
  '121': { x: 455, y: 245 },  // Forest Clearing (hub)
  '122': { x: 455, y: 350 },  // Forest Fork in the Road
  '123': { x: 455, y: 455 },  // Forest Beaten Path
  '124': { x: 455, y: 560 },  // Red Guard Tower
  '125': { x: 560, y: 560 },  // Small Graveyard
  '126': { x: 665, y: 560 },  // Forest by a Cliff
  '127': { x: 665, y: 455 },  // Surrounded by Trees
  '128': { x: 560, y: 455 },  // Forest Gnome Tree Hut
  '129': { x: 665, y: 665 },  // Forest Dead End
  '130': { x: 560, y: 245 },  // Abandoned Campsite
  '131': { x: 560, y: 350 },  // Forest by a Lake
  '132': { x: 665, y: 350 },  // Forest Rocky Path
  '133': { x: 665, y: 245 },  // Forest Twisted Path
  '134': { x: 665, y: 140 },  // Approaching Troll Territory
  '135': { x: 560, y: 140 },  // Forest atop a Hill
  '136': { x: 665, y: 35 },  // Abandoned Troll Guard Post
  '137': { x: 560, y: 35 },  // Troll Base Camp
  // Forest Underground - Kobold Lair (coordinates relative to forest underground map image)
  '115a': { x: 140, y: 140 },  // Kobold Lair EXIT
  '115b': { x: 35, y: 140 },  // Kobold Dead End
  '115c': { x: 245, y: 140 },  // Kobold Twisted Path
  '115d': { x: 140, y: 35 },  // Kobold Temple
  '115e': { x: 350, y: 245 },  // Kobold Bloody Path
  '115f': { x: 245, y: 245 },  // Kobold Hidden Chamber
  '115g': { x: 455, y: 245 },  // Dark Courtyard
  '115h': { x: 350, y: 350 },  // Control Room
  '115i': { x: 560, y: 350 },  // Magic Altar
  '115j': { x: 560, y: 245 },  // Champion Arena
  '115k': { x: 560, y: 140 },  // Kobold Master Chambers
  // Forest Underground - Ogre Lair
  '111a': { x: 140, y: 560 },  // Ogre Lair EXIT
  '111b': { x: 35, y: 560 },  // Goblin Tent
  '111c': { x: 35, y: 665 },  // Rat's Nest
  '111d': { x: 140, y: 665 },  // Hob Goblin Hut
  '111e': { x: 245, y: 560 },  // Ogre Path
  '111f': { x: 350, y: 665 },  // Orc Den
  '111g': { x: 350, y: 560 },  // Ogre Yard
  '111h': { x: 245, y: 455 },  // Ogre Treasure Room
  '111i': { x: 455, y: 560 },  // Ogre Guard Room
  '111j': { x: 560, y: 560 },  // Ogress Fire Altar
  '111k': { x: 560, y: 665 },  // Ogre Lieutenant Quarters
  // Red Guard Captain Forest Lookout — the tower bridging the Forest map and
  // Red Town; it sits on the FOREST artwork, directly south of 124.
  '215': { x: 455, y: 665 },  // Red Guard Captain - Forest Lookout
  // Red Town (coordinates relative to the Red Town map image)
  '201': { x: 245, y: 35 },  // On a Path to Red Town by a Forest Gate
  '213': { x: 350, y: 35 },  // Red Guard Living Quarters
  '214': { x: 455, y: 35 },  // Red Guard Captain's Office
  '223': { x: 665, y: 35 },  // Red Dining Room
  '207': { x: 35, y: 140 },  // Broccoli Rob's Veggie Stand
  '203': { x: 140, y: 140 },  // On a Stone Path by a Farm
  '212': { x: 350, y: 140 },  // Red Guard Barracks
  '224': { x: 560, y: 140 },  // Babylon Gardens
  '222': { x: 665, y: 140 },  // Mayor Rudolf — Town Hall Office
  '208': { x: 35, y: 245 },  // Rob's Farm
  '202': { x: 140, y: 245 },  // On a Stone Path by Red Town
  '226': { x: 245, y: 245 },  // Warrior's Guild
  '211': { x: 350, y: 245 },  // Red Town Warrior's Way
  '216': { x: 455, y: 245 },  // Adam's General Store
  '219': { x: 560, y: 245 },  // Red Town Church
  '221': { x: 665, y: 245 },  // Town Hall Plaza
  '205': { x: 35, y: 350 },  // Rocky Flats Gate
  '204': { x: 140, y: 350 },  // Red Town Grand Gate
  '209': { x: 245, y: 350 },  // Red Town Grand Path
  '210': { x: 350, y: 350 },  // Red Town Grand Square (hub)
  '217': { x: 455, y: 350 },  // Red Town Royal Road
  '218': { x: 560, y: 350 },  // Red Town Courtyard (sewer entrance)
  '220': { x: 665, y: 350 },  // Todd's Pub & Inn
  '237': { x: 35, y: 455 },  // Red Town Stables
  '227': { x: 245, y: 455 },  // Michael's Weapon Shop
  '228': { x: 350, y: 455 },  // Wizards Way
  '225': { x: 455, y: 455 },  // Wizard's Guild
  '234': { x: 560, y: 455 },  // Back Alley Apartments
  '235': { x: 665, y: 455 },  // Red Town Docks
  '229': { x: 245, y: 560 },  // Vincenzo's Meat & Produce Stand
  '230': { x: 350, y: 560 },  // Red Town South Gate
  '231': { x: 455, y: 560 },  // Red Town Back Alley
  '232': { x: 560, y: 560 },  // Back Alley by a Sewer
  '233': { x: 665, y: 560 },  // Turn in the Back Alley
  '232mm': { x: 35, y: 665 },  // Thieve's Den Secret Entrance
  '236': { x: 560, y: 665 },  // Shady Shop (hidden south of 232)
  // Red Town Sewers, Thieve’s Den and the Catacombs
  // (coordinates relative to the Red Town Sewers map image)
  '232v': { x: 35, y: 35 },  // The Catacombs Sacred Altar
  '232u': { x: 140, y: 35 },  // The Catacombs Room of Skulls
  '232r': { x: 245, y: 35 },  // The Catacombs Gallery
  '232q': { x: 350, y: 35 },  // The Catacombs Library
  '232z': { x: 455, y: 35 },  // Silver Vault
  '232w': { x: 35, y: 140 },  // The Catacombs Sacrificial Chamber
  '232t': { x: 140, y: 140 },  // The Catacombs Torture Chamber
  '232s': { x: 245, y: 140 },  // The Catacombs Armory
  '232p': { x: 350, y: 140 },  // The Catacombs EXIT
  '232j': { x: 245, y: 245 },  // In the Sewer by the Catacombs
  '232y': { x: 455, y: 245 },  // Across a Sewer River by a Gray Chest
  '232k': { x: 140, y: 350 },  // It's Pitch Black in the Sewer
  '232i': { x: 350, y: 350 },  // In the Sewer by a "Waterfall"
  '232d': { x: 455, y: 350 },  // A Fork in the Sewer
  '232c': { x: 560, y: 350 },  // North Sewer EXIT (up to 218)
  '232h': { x: 245, y: 455 },  // Crossing the Sewer Path
  '232x': { x: 350, y: 455 },  // A Sewer Oasis (safe)
  '232e': { x: 455, y: 455 },  // Sewer Crossroads (hub)
  '232b': { x: 665, y: 455 },  // By a Large Curved Pipe in the Sewer
  '232l': { x: 140, y: 560 },  // At a Dead End in the Sewers
  '232g': { x: 350, y: 560 },  // In the Sewer by a Smelly "Pond"
  '232f': { x: 455, y: 560 },  // In the Sewer near the Exit
  '232a': { x: 560, y: 560 },  // South Sewer EXIT (up to 232)
  '232m': { x: 35, y: 665 },  // Thieve's Den Hangout
  '232n': { x: 140, y: 665 },  // Thieve's Den Training Room
  '232o': { x: 245, y: 665 },  // Thieve's Den Treasure Room
}

/** CSS `background-position` for the compass mini-map window. */
export const getRoomMapPosition = (roomId: string | undefined): string => {
  if (roomId && CENTERED_ROOMS.has(roomId)) return 'center'
  const coords = (roomId ? ROOM_MAP_COORDS[roomId] : undefined) ?? DEFAULT_POSITION
  return `-${coords.x}px -${coords.y}px`
}

/**
 * The room's centre as a 0..1 fraction of the map image, for positioning the
 * player marker. Returns null for rooms with no authored map coordinates so the
 * marker is omitted rather than pointing at the wrong place.
 */
export const getRoomMapMarker = (roomId: string | undefined): { x: number; y: number } | null => {
  if (!roomId) return null
  if (CENTERED_ROOMS.has(roomId)) return { x: 0.5, y: 0.5 }
  const coords = ROOM_MAP_COORDS[roomId]
  if (!coords) return null
  return {
    x: (coords.x + MAP_CELL_SIZE / 2) / MAP_IMAGE_SIZE,
    y: (coords.y + MAP_CELL_SIZE / 2) / MAP_IMAGE_SIZE,
  }
}
