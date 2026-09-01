import QUESTS from './game-data/quests.json'

export interface RoomAction {
  action: string
  label: string
  icon?: string
  className?: string
  questIds?: string[]
  /**
   * Hide this action until the player has completed the named quest.
   *
   * Presentation only — the server gates the action itself (see the guild NPCs'
   * `preCheck` in room-action-handlers.js), so hiding the button is never what
   * makes it safe. It exists so an NPC who has nothing to say yet does not
   * advertise themselves: both guilds show only their recruiter until you have
   * actually joined.
   */
  requiresCompletedQuest?: string
}

/**
 * All quest IDs given by an NPC, ordered by their `number`. Derived from
 * quests.json (the single source of truth) so any quest with the matching
 * `giver.npcId` — including ones started later via onComplete effects —
 * surfaces in the NPC's room panel automatically, with no parallel list to
 * keep in sync here.
 */
export function questIdsForNpc(npcId: string): string[] {
  return Object.entries(QUESTS as Record<string, { giver?: { npcId?: string }; number?: number }>)
    .filter(([, def]) => def.giver?.npcId === npcId)
    .sort((a, b) => (a[1].number ?? 0) - (b[1].number ?? 0))
    .map(([id]) => id)
}

export const ROOM_ACTIONS: Record<string, RoomAction[]> = {
  '000': [
    { action: 'read sign', label: 'Read Sign', icon: '', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'examine pillar', label: 'Examine Pillar', icon: '', className: 'bg-blue-500/70 hover:bg-blue-500' },
    { action: 'teleport to grassy field', label: 'Press Button (Teleports to Grassy Field)', icon: '', className: 'bg-green-500/70 hover:bg-green-500/90' },
  ],
  '001': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '002': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
  ],
  '003': [
    { action: 'talk to old man', label: 'Old Man', icon: 'npc-oldman', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('old_man') },
    { action: 'ex cabin', label: 'Examine Cabin', icon: 'cabin2', className: 'bg-gray-600 hover:bg-gray-700' },
    { action: 'attack dummy', label: 'Attack Dummy', icon: 'sword1', className: 'bg-red-500/70 hover:bg-red-500' },
    { action: 'open crafting', label: 'Open Crafting', icon: 'fire', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '003b': [],
  '003bb': [],
  '003c': [],
  '004': [],
  '005': [
    { action: 'pick blueberry', label: 'Pick Blueberry', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '012d': [
    { action: 'pull lever', label: 'Pull Lever', icon: 'sign-metal2' },
  ],
  '006': [
    { action: 'view shop', label: 'View Shop', icon: 'basicshop', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '007': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'talk to young soldier', label: 'Young Soldier', icon: 'npc-youngsoldier', className: 'bg-blue-600 hover:bg-blue-700', questIds: questIdsForNpc('young_soldier') },
  ],
  '024': [
    { action: 'talk to jack lumber', label: 'Jack Lumber', icon: 'npc-jacklumber', className: 'bg-green-600 hover:bg-green-700', questIds: questIdsForNpc('jack_lumber') },
    { action: 'open crafting', label: 'Open Crafting', icon: 'craft', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '025': [
    { action: 'chop wood', label: 'Chop Wood', icon: 'wood', className: 'bg-amber-700 hover:bg-amber-600' },
  ],
  '020': [
    { action: 'rest at waterfall', label: 'Rest at Waterfall', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'pick wheat', label: 'Pick Wheat', icon: 'flower', className: 'bg-amber-500 hover:bg-amber-400' },
  ],
  '021': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    // No "Buy Staff": the Pajama Shaman's shop is not ported yet, and a staff is
    // not something he ever sold — the original's stock was flail, morning star,
    // gladius, battle axe, warhammer, claymore, long bow, arrows, pajamas and
    // slippers. The button pointed at nothing and returned "Unknown action type".
    { action: 'open crafting', label: 'Open Crafting', icon: 'fire', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '014': [
    { action: 'shovel dirt', label: 'Shovel Dirt', icon: 'shovel', className: 'bg-taupe-600 hover:bg-taupe-500' },
  ],
  '015': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
    { action: 'mine stone', label: 'Mine Stone', icon: 'beach-rock', className: 'bg-stone-500 hover:bg-stone-400' },
  ],
  '016': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '017': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '018': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '019': [
    { action: 'teleport to grassy field', label: 'Teleport to Grassy Field', icon: 'world', className: 'bg-green-500/70 hover:bg-green-600' },
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '028h': [
    { action: 'search', label: 'Search', icon: 'eye', className: 'bg-yellow-500/70 hover:bg-yellow-400' },
  ],
  '999': [
    { action: 'rest in lobby', label: 'Rest at the Fountain', icon: 'heal', className: 'bg-green-600 hover:bg-green-700' },
    { action: 'teleport to grassy field', label: 'Teleport to the Grassy Field', icon: 'world', className: 'bg-green-500/70  hover:bg-green-600' },
  ],

  // Forest — berry bushes, Hunter Bill's camp, the Forest gold chest, and the
  // Forest Gnome's tree hut. The chop-wood button for every tree-bearing Forest
  // room is merged in below.
  '103': [
    { action: 'talk to freddie', label: 'Freddie', icon: 'npc-freddie', className: 'bg-amber-600 hover:bg-amber-700', questIds: questIdsForNpc('freddie') },
    { action: 'pay toll', label: 'Pay Toll (50 gold)', icon: 'gate', className: 'bg-yellow-700/80 hover:bg-yellow-700' },
    { action: 'get hammer', label: 'Get Hammer', icon: 'craft', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '103c': [
    { action: 'get wood', label: 'Get Wood', icon: 'wood', className: 'bg-amber-700 hover:bg-amber-600' },
  ],
  '104': [
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '117': [
    { action: 'get leather', label: 'Get Leather', icon: 'leather', className: 'bg-amber-800 hover:bg-amber-700' },
  ],
  '120': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
    { action: 'grab ring', label: 'Grab Ring', icon: 'ring', className: 'bg-green-700 hover:bg-green-600' },
  ],
  '121': [
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '124': [
    { action: 'grab arrows', label: 'Grab Arrows', icon: 'arrow', className: 'bg-amber-600 hover:bg-amber-700' },
  ],
  '131': [
    { action: 'fish', label: 'Fish the Lake', icon: 'fish', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '125': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
  ],
  '130': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
  ],
  '129': [
    { action: 'pick blueberry', label: 'Pick Blueberry', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '135': [
    { action: 'pick blueberry', label: 'Pick Blueberry', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '118': [
    { action: 'talk to hunter bill', label: 'Hunter Bill', icon: 'npc-hunterbill', className: 'bg-green-600 hover:bg-green-700', questIds: questIdsForNpc('hunter_bill') },
    { action: 'rest at camp', label: "Rest at Bill's Camp", icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '119': [
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '128': [
    { action: 'talk to forest gnome', label: 'Forest Gnome', icon: 'npc-forestgnome', className: 'bg-green-600 hover:bg-green-700', questIds: questIdsForNpc('forest_gnome') },
  ],

  // ==================== FOREST UNDERGROUND ====================
  // The two lair-mouth signs, the two treasure chests, and the Kobold Lair's
  // control lever. The hidden ways in (111g's searched passage, 127/132's gap in
  // the trees) need no button — Search is one of the four core actions RoomBox
  // renders in every room.
  '111': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '115': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '111h': [
    { action: 'open chest', label: 'Open Treasure Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '115f': [
    { action: 'open chest', label: 'Open Treasure Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '115h': [
    { action: 'flip lever', label: 'Flip Lever', icon: 'lever-up', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],

  // ==================== RED TOWN ====================
  // Seven quest givers, six shops, four chests, two rest points and the two
  // directory signs. The server owns every one of these actions; this only
  // renders the buttons.
  '207': [
    { action: 'view shop', label: 'View Shop', icon: 'veggies', className: 'bg-green-600 hover:bg-green-700' },
  ],
  '210': [
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'rest at fountain', label: 'Rest at Fountain', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'open crafting', label: 'Open Crafting', icon: 'craft', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '214': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '215': [
    { action: 'talk to red guard captain', label: 'Red Guard Captain', icon: 'npc-redguardcaptain', className: 'bg-red-600 hover:bg-red-700', questIds: questIdsForNpc('red_guard_captain') },
  ],
  '216': [
    { action: 'view shop', label: 'View Shop', icon: 'basicshop', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '218': [
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '220': [
    { action: 'view shop', label: 'View Shop', icon: 'bar', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '221': [
    { action: 'talk to the people', label: 'Town Hall Plaza', icon: 'npc-townhallplaza', className: 'bg-red-600 hover:bg-red-700', questIds: questIdsForNpc('town_hall_plaza') },
  ],
  '222': [
    { action: 'talk to mayor', label: 'Mayor Rudolf', icon: 'npc-mayor', className: 'bg-red-600 hover:bg-red-700', questIds: questIdsForNpc('mayor_rudolf') },
  ],
  '224': [
    { action: 'pick flower', label: 'Pick Flower', icon: 'flower', className: 'bg-yellow-500/80 hover:bg-yellow-500' },
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '225': [
    { action: 'talk to wizard recruiter', label: "Wizard's Guild Recruiter", icon: 'npc-wizard', className: 'bg-purple-600 hover:bg-purple-700', questIds: questIdsForNpc('wizards_guild_recruiter') },
    { action: 'talk to wizard morty', label: 'Wizard Morty', icon: 'npc-wizard2', className: 'bg-purple-600 hover:bg-purple-700', questIds: questIdsForNpc('wizard_morty'), requiresCompletedQuest: 'quest_wizardsguild_000' },
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'view shop', label: 'View Shop', icon: 'basicshop', className: 'bg-amber-500/80 hover:bg-amber-500' },
    { action: 'grab pack', label: "Grab Wizard's Pack", icon: 'npc-wizard', className: 'bg-purple-700 hover:bg-purple-600' },
    { action: 'rest at wizard fire', label: "Rest at Wizard's Fire", icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'teleport to kobold lair', label: 'Teleport to Kobold Lair', icon: 'world', className: 'bg-indigo-600 hover:bg-indigo-500', requiresCompletedQuest: 'quest_wizardsguild_000' },
  ],
  '226': [
    { action: 'talk to warrior recruiter', label: "Warrior's Guild Recruiter", icon: 'npc-warrior', className: 'bg-blue-600 hover:bg-blue-700', questIds: questIdsForNpc('warriors_guild_recruiter') },
    { action: 'talk to warrior pete', label: 'Warrior Pete', icon: 'npc-warrior2', className: 'bg-blue-600 hover:bg-blue-700', questIds: questIdsForNpc('warrior_pete'), requiresCompletedQuest: 'quest_warriorsguild_000' },
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'view shop', label: 'View Shop', icon: 'basicshop', className: 'bg-amber-500/80 hover:bg-amber-500' },
    { action: 'grab pack', label: "Grab Warrior's Pack", icon: 'npc-warrior', className: 'bg-blue-700 hover:bg-blue-600' },
    { action: 'rest at warrior fire', label: "Rest at Warrior's Fire", icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'teleport to ogre lair', label: 'Teleport to Ogre Lair', icon: 'world', className: 'bg-indigo-600 hover:bg-indigo-500', requiresCompletedQuest: 'quest_warriorsguild_000' },
  ],
  '227': [
    { action: 'view shop', label: 'View Shop', icon: 'sword1', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '229': [
    { action: 'view shop', label: 'View Shop', icon: 'steak', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '236': [
    { action: 'view shop', label: 'View Shop', icon: 'shop', className: 'bg-gray-600 hover:bg-gray-500' },
  ],
  '237': [
    { action: 'view shop', label: 'View Stables', icon: 'tent', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],

  // ==================== RED TOWN SEWERS / DEN / CATACOMBS ====================
  // The hidden doors down here (232 / 233 / 232mm / 232b / 232j / 232l) need no
  // entry: Search is a core action RoomBox renders in every room, and the
  // search-reveal definitions do the rest.
  '232o': [
    { action: 'open treasure chest', label: 'Open Treasure Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '232x': [
    { action: 'rest at oasis', label: 'Rest at the Oasis', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '232y': [
    { action: 'open gray chest', label: 'Open Gray Chest', icon: 'chest2', className: 'bg-gray-500 hover:bg-gray-400' },
  ],
  '232z': [
    { action: 'open silver chest', label: 'Open Silver Chest', icon: 'chest2', className: 'bg-sky-500/80 hover:bg-sky-500' },
  ],
  // ==================== ROCKY FLATS ====================
  '303': [
    { action: 'talk to dwarf captain', label: 'Dwarf Captain', icon: 'npc-dwarfcaptain', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('dwarf_captain') },
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '306': [
    { action: 'rest on the ledge', label: 'Rest on the Ledge', icon: 'heal', className: 'bg-green-600 hover:bg-green-700' },
    { action: 'grab arrows', label: 'Grab Arrows', icon: 'arrow', className: 'bg-amber-600 hover:bg-amber-700' },
    { action: 'grab bolts', label: 'Grab Bolts', icon: 'boltupgrade', className: 'bg-amber-700 hover:bg-amber-600' },
    { action: 'grab polearm', label: 'Grab Polearm', icon: 'equipment-polearm', className: 'bg-gray-600 hover:bg-gray-500' },
  ],
  '307': [
    { action: 'read bounty board', label: 'Bounty Board', icon: 'npc-bountyboard', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('dwarf_bounty_board') },
    { action: 'rest at the coal fire', label: 'Rest at the Coal Fire', icon: 'fire', className: 'bg-green-600 hover:bg-green-700' },
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '308': [
    { action: 'talk to mining recruiter', label: 'Mining Guild Recruiter', icon: 'npc-miner2', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('mining_guild_recruiter') },
    { action: 'talk to guild leader', label: 'Guild Leader', icon: 'npc-miner', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('mining_guild_leader'), requiresCompletedQuest: 'quest_miningguild_000' },
    { action: 'view shop', label: 'Supply Shop', icon: 'shop', className: 'bg-amber-500/80 hover:bg-amber-500' },
    { action: 'grab pack', label: 'Grab Mining Pack', icon: 'inv', className: 'bg-blue-700 hover:bg-blue-600' },
    { action: 'rest at the forge', label: 'Rest at the Forge', icon: 'fire', className: 'bg-green-600 hover:bg-green-700' },
    { action: 'open crafting', label: 'Open Crafting', icon: 'craft', className: 'bg-orange-600 hover:bg-orange-700' },
    { action: 'read sign', label: 'Read Directory', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '309': [
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '310': [
    { action: 'view shop', label: 'View Shop', icon: 'shop', className: 'bg-sky-500/80 hover:bg-sky-500' },
  ],
  '311': [
    { action: 'grab pickaxe', label: 'Grab Pickaxe', icon: 'pickaxe', className: 'bg-amber-600 hover:bg-amber-700' },
    { action: 'grab red potion', label: 'Grab Red Potions', icon: 'red-potion', className: 'bg-red-600 hover:bg-red-700' },
    { action: 'grab blue potion', label: 'Grab Blue Potions', icon: 'blue-potion', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '315': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
  '321b': [
    { action: 'ex gloves', label: 'Examine Gloves', icon: 'hand', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'grab gloves', label: 'Grab Gloves', icon: 'hand', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '322': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-red-700/70 hover:bg-red-700/90' },
  ],
  '325': [
    { action: 'flip switch', label: 'Flip Switch', icon: 'lever-up', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],

  // ==================== THE NEVERENDING MINE ====================
  // Mine Level 0 carries the sign; every level below it carries the pick. The
  // `mine here` buttons for 1-30 are merged in below rather than written out
  // thirty times — the rooms differ only in how deep they are.
  '311-00': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
  ],
}

// Working the level you are standing on. Digging DOWN is the compass, not a
// button: it is gated on carrying a pickaxe and pays ore on the way through
// (see room-gates.js), which is what makes the shaft a mine rather than stairs.
for (let depth = 1; depth <= 30; depth += 1) {
  const roomId = `311-${String(depth).padStart(2, '0')}`
  ROOM_ACTIONS[roomId] = [
    ...(ROOM_ACTIONS[roomId] ?? []),
    { action: 'mine here', label: 'Mine Here', icon: 'pickaxe', className: 'bg-amber-700 hover:bg-amber-600' },
  ]
}

/**
 * Forest rooms with choppable trees. Mirrors FOREST_CHOP_WOOD_ROOMS in
 * `game-engine/room-action-handlers.js` — the server owns the action, this just
 * renders its button. Kept as a merge so the berry rooms above (120/125/129/
 * 130/135) end up with both buttons without repeating either entry.
 */
const FOREST_CHOP_WOOD_ROOMS = [
  '116', '117', '119', '120', '121', '122', '123', '124', '125',
  '126', '127', '129', '130', '131', '132', '133', '134', '135', '136',
]

/**
 * Two-tree rooms. Mirrors FOREST_TWO_TREE_ROOMS in the engine: a second tree with
 * its own action key, and so its own cooldown. Both read "Chop Wood / Tree" —
 * they are two of the same thing, told apart by which one is still counting down.
 */
const FOREST_TWO_TREE_ROOMS = new Set(['117', '122', '124', '127', '129', '133', '134'])

const CHOP_WOOD_BUTTON = { label: 'Chop Wood', icon: 'wood', className: 'bg-amber-700 hover:bg-amber-600' }

for (const roomId of FOREST_CHOP_WOOD_ROOMS) {
  ROOM_ACTIONS[roomId] = [
    ...(ROOM_ACTIONS[roomId] ?? []),
    { action: 'chop wood', ...CHOP_WOOD_BUTTON },
    ...(FOREST_TWO_TREE_ROOMS.has(roomId) ? [{ action: 'chop wood 2', ...CHOP_WOOD_BUTTON }] : []),
  ]
}

/**
 * Get available actions for a specific room
 */
export function getRoomActions(roomId: string): RoomAction[] {
  return ROOM_ACTIONS[roomId] || []
}

/**
 * Check if an action is available for a specific room
 */
export function isActionAvailableForRoom(roomId: string, action: string): boolean {
  const actions = getRoomActions(roomId)
  return actions.some((a) => a.action.toLowerCase() === action.toLowerCase())
}

/**
 * Find the NPC talk action string that covers a given quest ID.
 * Returns the action string (e.g. "talk to old man") or null if not found.
 */
export function getNpcActionForQuest(questId: string): string | null {
  for (const actions of Object.values(ROOM_ACTIONS)) {
    for (const action of actions) {
      if (action.questIds?.includes(questId)) {
        return action.action
      }
    }
  }
  return null
}

