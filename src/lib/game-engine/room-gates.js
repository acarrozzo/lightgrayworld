/**
 * Room passage gates
 * Defines gates that block passage between rooms unless certain criteria are met
 */
const { prisma } = require('../db-client')

/**
 * Can the player fly right now?
 *
 * Two ways to be airborne, and the gates do not care which: the click-counted
 * `wings` buff (a potion or the spell), or an equipped mount that flies — which
 * today means the Stables' unicorn. A mount is a standing ability rather than a
 * countdown, so a unicorn owner crosses the sewer river without stocking potions.
 */
async function playerCanFly(playerId) {
  const user = await prisma.user.findUnique({
    where: { id: playerId },
    select: { wings: true },
  })
  if ((user?.wings ?? 0) >= 1) return true

  const flyingMount = await prisma.playerItem.findFirst({
    where: { playerId, isEquipped: true, slot: 'MOUNT' },
    select: { ItemTemplate: { select: { metadata: true } } },
  })
  return flyingMount?.ItemTemplate?.metadata?.grantsFlight === true
}

/**
 * Can the player cross open water?
 *
 * The Blue Ocean's surface rooms can be crossed in a Wooden Boat — an equipped
 * mount whose template says `boat` — or on wings, exactly the original's
 * `equipMount == 'wooden boat' || flying >= 1`. The islands and temples are dry
 * land and need neither.
 */
async function playerCanSail(playerId) {
  const mount = await prisma.playerItem.findFirst({
    where: { playerId, isEquipped: true, slot: 'MOUNT' },
    select: { ItemTemplate: { select: { metadata: true } } },
  })
  if (mount?.ItemTemplate?.metadata?.boat === true) return true
  return playerCanFly(playerId)
}

/**
 * Can the player breathe water right now? The click-counted `gills` buff (a
 * potion or, one day, the spell) is the only way — there is no mount for it.
 */
async function playerCanBreatheWater(playerId) {
  const user = await prisma.user.findUnique({
    where: { id: playerId },
    select: { gills: true },
  })
  return (user?.gills ?? 0) >= 1
}

/** Has the player put down the named enemy at least once? */
async function hasKilled(playerId, monster) {
  const kill = await prisma.killList.findUnique({
    where: { userId_monster: { userId: playerId, monster } },
    select: { kills: true },
  })
  return (kill?.kills ?? 0) >= 1
}

const SAIL_MESSAGE = "You can't go that way! You need to be flying or in a boat. A Wooden Boat is twenty wood at any crafting table."
const SAIL_MODAL = {
  title: 'Open water',
  type: 'icon',
  icon: 'boat',
  iconColor: 'blue-400',
  message:
    "You can't go that way! You need to be flying or in a boat. Craft a Wooden Boat out of 20 wood at a crafting table and ride it, or drink a Wings Potion.",
}
const SWIM_MESSAGE = "You can't swim that way! You need to be breathing water. Drink a Gills Potion first."
const SWIM_MODAL = {
  title: 'You cannot breathe down here',
  type: 'icon',
  icon: 'gills',
  iconColor: 'blue-400',
  message:
    "You can't swim that way! You need to be breathing water. Drink a Gills Potion — they wash up in the ocean, and the General Store sells them — and you have a hundred clicks of it.",
}

/** A gate across open water: boat or wings. */
const sailGate = () => ({ check: playerCanSail, message: SAIL_MESSAGE, modalContent: SAIL_MODAL })
/** A gate across deep water: gills. */
const swimGate = () => ({ check: playerCanBreatheWater, message: SWIM_MESSAGE, modalContent: SWIM_MODAL })

/**
 * Has the player completed any one of the Red Guard Captain's three quests?
 * Gates the lookout-tower ladder in both directions (rooms 124 and 215).
 */
async function captainQuestDone(playerId) {
  const done = await prisma.questProgress.findFirst({
    where: {
      userId: playerId,
      completed: true,
      questId: {
        in: [
          'quest_redguardcaptain_001',
          'quest_redguardcaptain_002',
          'quest_redguardcaptain_003',
        ],
      },
    },
    select: { id: true },
  })
  return !!done
}

/**
 * Is the player a member of either Red Town guild?
 *
 * Both dwarf guards onto the Rocky Flats want to see a badge and neither cares
 * which: the Grassy Field gate (027) took the Warrior's OR the Wizard's Guild,
 * and Red Town's gate (205) took the Warrior's Guild or a dead Ogre Lieutenant,
 * which is the same thing one step earlier. Membership is the completed guild
 * quest in both cases.
 */
async function guildMember(playerId) {
  const done = await prisma.questProgress.findFirst({
    where: {
      userId: playerId,
      completed: true,
      questId: { in: ['quest_warriorsguild_000', 'quest_wizardsguild_000'] },
    },
    select: { id: true },
  })
  return !!done
}

/** Has the player joined the Mining Guild — i.e. put Red Beard down? */
async function miningGuildMember(playerId) {
  const done = await prisma.questProgress.findUnique({
    where: { userId_questId: { userId: playerId, questId: 'quest_miningguild_000' } },
    select: { completed: true },
  })
  return !!done?.completed
}

/**
 * Map of room gates by roomId and direction
 * Each gate definition includes:
 * - check: async function that validates criteria (returns boolean)
 * - message: message to show when blocked
 * - modalContent: optional structured modal content
 */
const ROOM_GATES = {
  '002': {
    'south': {
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { chest1: true },
        })
        return !!user?.chest1
      },
      message: "The stone path south is locked. Get the gold key from the Young Soldier and open the gold chest to claim the boomerang.",
      modalContent: {
        title: 'A Field Guard blocks the stone path south',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'amber-500',
        message: "The stone path south is locked. Get the gold key from the Young Soldier and open the gold chest to claim the boomerang.",
      },
    },
  },
  '007': {
    'south': {
      check: async (playerId) => {
        const ratQuest = await prisma.questProgress.findUnique({
          where: { userId_questId: { userId: playerId, questId: 'quest_oldman_002' } },
          select: { completed: true },
        })
        return !!ratQuest?.completed
      },
      message: "Whoa, slow down killer. Help the Old Man with his rat problem before you head into the Spider Cave!",
      modalContent: {
        title: 'The Young Soldier blocks the way to the Spider Cave',
        type: 'icon',
        icon: 'npc-youngsoldier',
        iconColor: 'blue-400',
        message: "Whoa, slow down killer. Help the Old Man with his rat problem before you head into the Spider Cave!",
      },
    },
  },
  '004': {
    'west': {
      check: async (playerId) => {
        const mainHandItem = await prisma.playerItem.findFirst({
          where: {
            playerId,
            isEquipped: true,
            slot: 'MAIN_HAND',
          },
        })
        return !!mainHandItem
      },
      message: "You know there are aggressive sand crabs down there right?! You need a weapon equipped if you want to go to the beach.",
      modalContent: {
        title: 'A field Guard blocks you from going to the beach',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'amber-500',
        message: "You know there are aggressive sand crabs down there right?! You need a weapon equipped if you want to go to the beach.",
      },
    },
  },
  '003': {
    'west': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '003')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
    'down': {
      check: async (playerId) => {
        const flowerQuest = await prisma.questProgress.findUnique({
          where: { userId_questId: { userId: playerId, questId: 'quest_oldman_001' } },
          select: { completed: true },
        })
        if (!flowerQuest?.completed) return false
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { level: true },
        })
        if (user?.level >= 5) return true
        const mainHandItem = await prisma.playerItem.findFirst({
          where: {
            playerId,
            isEquipped: true,
            slot: 'MAIN_HAND',
          },
        })
        return !!mainHandItem
      },
      message: "The Old Man warns you the basement is overrun with rats. Help him with his wife's flower first, then he'll let you head down.",
      modalContent: {
        title: 'The basement stairs are blocked',
        type: 'icon',
        icon: 'npc-oldman',
        iconColor: 'amber-500',
        message: "The Old Man warns you the basement is overrun with rats. Help him with his wife's flower first, then he'll let you head down.",
      },
    },
    'southwest': {
      check: async (playerId) => {
        const ratQuest = await prisma.questProgress.findUnique({
          where: { userId_questId: { userId: playerId, questId: 'quest_oldman_002' } },
          select: { completed: true },
        })
        return !!ratQuest?.completed
      },
      message: "The marsh path is overgrown and treacherous. The Old Man says he'll clear the way once you've dealt with his rat problem.",
      modalContent: {
        title: 'The marsh path is blocked',
        type: 'icon',
        icon: 'npc-oldman',
        iconColor: 'amber-500',
        message: "The marsh path is overgrown and treacherous. The Old Man says he'll clear the way once you've dealt with his rat problem.",
      },
    },
  },
  '006': {
    'east': {
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { chest1: true },
        })
        return !!user?.chest1
      },
      message: "The road east is closed until you've opened the Gold Chest at the Crossroads.",
      modalContent: {
        title: 'A Field Guard blocks the road east',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'amber-500',
        message: "\"The road east is closed until you've opened the Gold Chest at the Crossroads. Get the Gold Key from the Young Soldier and crack it open first.\"",
      },
    },
  },
  '023': {
    'east': {
      check: async (playerId) => {
        const quest = await prisma.questProgress.findUnique({
          where: { userId_questId: { userId: playerId, questId: 'quest_jacklumber_000' } },
          select: { completed: true },
        })
        return !!quest?.completed
      },
      message: "A Red Guard blocks the Forest Path. Complete Jack Lumber's quests before heading east.",
      modalContent: {
        title: 'A Red Guard blocks the Forest Path',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'red-400',
        message: "\"You're not ready for the Forest yet. Go talk to Jack Lumber in his cabin to the north — complete his quests and I'll let you through.\"",
      },
    },
  },
  '020': {
    'northwest': {
      check: (playerId) => playerCanFly(playerId),
      message: "The path ahead is too treacherous. You need the ability to fly to traverse this route.",
      modalContent: {
        title: 'The path is blocked',
        type: 'icon',
        icon: 'mountain',
        iconColor: 'gray-600',
        message: "The path ahead is too treacherous. You need the ability to fly to traverse this route.",
      },
    },
  },
  '028h': {
    'north': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '028h')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '012f': {
    'northeast': {
      check: async (playerId) => {
        const { isLeverPulled } = require('./lever-state')
        return isLeverPulled(playerId, '012d-lever')
      },
      lever: true,
      message: "The passage is sealed shut. You need to find a way to unlock it from below.",
      modalContent: {
        title: 'The passage is sealed',
        type: 'icon',
        icon: 'sign-metal2',
        iconColor: 'red-400',
        message: "The passage to the Scorpion Nest is sealed shut. A control mechanism somewhere below must unlock it.",
      },
      onPass: async (playerId) => {
        const { resetLever } = require('./lever-state')
        resetLever(playerId, '012d-lever')
      },
    },
  },

  // ==================== FOREST ====================
  // Freddie charges 50 gold a trip to let you at his cows. Paying sets an
  // ephemeral pass; walking through the gate spends it, so the next armful of
  // leather costs another 50 — exactly what the original's `cowtoll` did.
  '103': {
    'north': {
      check: async (playerId) => {
        const { isLeverPulled, COW_TOLL } = require('./lever-state')
        return isLeverPulled(playerId, COW_TOLL)
      },
      message: 'Freddie leans on the gate. You need to pay the 50 gold toll to enter the cow farm.',
      modalContent: {
        title: 'Freddie blocks the gate to the cow farm',
        type: 'icon',
        icon: 'npc-freddie',
        iconColor: 'amber-400',
        message: '"Hold up! Cows are mine, hides are mine, and the gate is fifty gold. Pay the toll and it swings right open."',
      },
      onPass: async (playerId) => {
        const { resetLever, COW_TOLL } = require('./lever-state')
        resetLever(playerId, COW_TOLL)
      },
    },
  },
  // The two ends of the hidden trail through the trees. The exits are masked from
  // the client by the search-reveal overlay; these are the server-side half, so a
  // hand-sent move cannot walk a passage the player has not found.
  '127': {
    'north': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '127')
      },
      message: "You don't see an exit to the north. You should try searching.",
      silent: true,
    },
  },
  '132': {
    'south': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '132')
      },
      message: "You don't see an exit to the south. You should try searching.",
      silent: true,
    },
  },

  // ==================== FOREST UNDERGROUND ====================
  // Ogre Yard -> Ogre Treasure Room, behind a search.
  '111g': {
    'northwest': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '111g')
      },
      message: "You don't see an exit to the northwest.",
      silent: true,
    },
  },
  // The Kobold Lair's false west wall, opened by the Control Room lever (115h).
  // Hidden from the client by lever-state's exit overlay until it is thrown.
  '115e': {
    'west': {
      check: async (playerId) => {
        const { isLeverPulled, KOBOLD_SWITCH } = require('./lever-state')
        return isLeverPulled(playerId, KOBOLD_SWITCH)
      },
      // Hidden as well as gated: lever-state's exit overlay masks the direction
      // until the Control Room switch is thrown, so the wall reads as solid.
      hidden: true,
      lever: true,
      message: "You don't see an exit to the west.",
      silent: true,
    },
  },
  // The two boss-room exit portals. Both are one-way shortcuts back to their
  // lair's entrance chamber, inert until their boss is down — so the only way in
  // is still the long walk, and the only way to shorten the walk out is to win.
  '111k': {
    'southeast': {
      check: async (playerId) => {
        const kill = await prisma.killList.findUnique({
          where: { userId_monster: { userId: playerId, monster: 'ogre-lieutenant' } },
          select: { kills: true },
        })
        return (kill?.kills ?? 0) >= 1
      },
      message: 'You cannot use the portal to the exit until you defeat the Ogre Lieutenant.',
      modalContent: {
        title: 'The portal is dormant',
        type: 'icon',
        icon: 'world',
        iconColor: 'purple-400',
        message: 'The portal hangs dead in the corner. It will not carry you out of here until the Ogre Lieutenant is dealt with.',
      },
    },
  },
  '115k': {
    'northeast': {
      check: async (playerId) => {
        const kill = await prisma.killList.findUnique({
          where: { userId_monster: { userId: playerId, monster: 'kobold-master' } },
          select: { kills: true },
        })
        return (kill?.kills ?? 0) >= 1
      },
      message: 'You cannot use the portal to the exit until you defeat the Kobold Master.',
      modalContent: {
        title: 'The portal is dormant',
        type: 'icon',
        icon: 'world',
        iconColor: 'purple-400',
        message: 'The portal shimmers but will not open. The Kobold Master holds it shut, and will go on holding it until he cannot.',
      },
    },
  },

  // ==================== RED TOWN ====================
  // The Red Guard will not let an untested traveller into Red Town. The original
  // checked the player's Ogre kill count, which the modern KillList tracks by slug.
  '107': {
    'south': {
      check: async (playerId) => {
        const kill = await prisma.killList.findUnique({
          where: { userId_monster: { userId: playerId, monster: 'ogre' } },
          select: { kills: true },
        })
        return (kill?.kills ?? 0) >= 1
      },
      message: 'A Red Guard stops you at the gate. To gain access to Red Town you must prove your worth by killing an Ogre.',
      modalContent: {
        title: 'A Red Guard blocks the road to Red Town',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'red-400',
        message: '"Hold. Nobody walks into Red Town on my watch until they\'ve proven their worth against an Ogre. You\'ll find them in their lair, west of here."',
      },
    },
  },
  // The lookout tower is the Barracks' back door into Red Town, so the ladder is
  // gated in both directions. The original opened it on completing ANY ONE of the
  // Captain's three quests (room124.php and room215.php both checked quest11/12/13),
  // which also means the tower can only be unlocked from the town side — you meet
  // the Captain by walking up through the Barracks, never by climbing the ladder.
  '124': {
    'south': {
      check: captainQuestDone,
      message: "The Red Guard on the tower waves you off the ladder. Help the Captain out first.",
      modalContent: {
        title: 'A Red Guard waves you off the tower ladder',
        type: 'icon',
        icon: 'npc-redguardcaptain',
        iconColor: 'red-400',
        message: '"Captain\'s orders — the tower stays shut until you\'ve done something for him. His office is up through the Barracks, if you can find your way into town."',
      },
    },
  },
  '215': {
    'north': {
      check: captainQuestDone,
      message: "You can't climb down into the Forest until you've completed one of the Captain's quests.",
      modalContent: {
        title: 'The Captain blocks the tower ladder',
        type: 'icon',
        icon: 'npc-redguardcaptain',
        iconColor: 'red-400',
        message: '"Not yet. Finish one of my jobs and the ladder is yours." He nods south. "Otherwise the Forest Path will take you round the long way."',
      },
    },
  },
  // Town Hall's private dining room opens once the Babylon Gardens chest is open —
  // the Mayor's way of saying you have squared up with the town.
  '222': {
    'north': {
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { chest3: true },
        })
        return !!user?.chest3
      },
      message: "The dining room door is locked. Open the gold chest in the Babylon Gardens and the Mayor will unlock it.",
      modalContent: {
        title: 'The Red Dining Room is locked',
        type: 'icon',
        icon: 'npc-mayor',
        iconColor: 'red-400',
        message: '"That room is for people who have done this town a service." The Mayor gestures west. "Open the chest in the Gardens and we will call it settled."',
      },
    },
  },
  // Back-alley and sewer secret doors. The exits are hidden from the client by the
  // search-reveal exit overlay; these gates are the server-side half, so a hand-sent
  // move command cannot walk through a door the player has not found.
  '232': {
    'south': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '232')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '233': {
    'southeast': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '233')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '232mm': {
    'northeast': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '232mm')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '232b': {
    'east': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '232b')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '232l': {
    'southwest': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '232l')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  '232j': {
    'northeast': {
      check: async (playerId) => {
        const { isRevealed } = require('./search-reveal-state')
        return isRevealed(playerId, '232j')
      },
      message: "You don't see an exit in that direction.",
      silent: true,
    },
  },
  // The sewer river. Both banks are gated, so a player who flies across and lets
  // their wings lapse is not stranded past a one-way crossing.
  '232d': {
    'north': {
      check: (playerId) => playerCanFly(playerId),
      message: 'You will not be able to cross this sewer river unless you are flying. Find or buy a wings potion, or cast a wings spell.',
      modalContent: {
        title: 'A river of sewage blocks the way north',
        type: 'icon',
        icon: 'wings',
        iconColor: 'blue-400',
        message: 'You will not be able to cross this sewer river unless you are flying. Find or buy a wings potion, or cast a wings spell.',
      },
    },
  },
  '232y': {
    'south': {
      check: (playerId) => playerCanFly(playerId),
      message: 'You will not be able to cross back over this sewer river unless you are flying.',
      modalContent: {
        title: 'A river of sewage blocks the way south',
        type: 'icon',
        icon: 'wings',
        iconColor: 'blue-400',
        message: 'You will not be able to cross back over this sewer river unless you are flying. Find or buy a wings potion, or cast a wings spell.',
      },
    },
  },

  // ==================== ROCKY FLATS ====================
  // Both ways in. The original gated the Grassy Field gate on Warrior's OR
  // Wizard's Guild membership and the Red Town gate on the Warrior's Guild
  // alone; both are one dwarf with one question, so both take either badge.
  '027': {
    'south': {
      check: (playerId) => guildMember(playerId),
      message: "The Dwarf Guard puts an arm across the gate. \"Rocky Flats is guild country. Join the Warrior's Guild or the Wizard's Guild in Red Town and I'll open it.\"",
      modalContent: {
        title: 'The Dwarf Guard blocks the gate south',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'gray-400',
        message: "The Dwarf Guard puts an arm across the gate. \"Rocky Flats is guild country. Join the Warrior's Guild or the Wizard's Guild in Red Town and I'll open it.\" Meanwhile there is a bat cave west of here, and the forest path east goes to Red Town.",
      },
    },
  },
  '205': {
    'west': {
      check: (playerId) => guildMember(playerId),
      message: "The dwarf guard does not move. \"Nothing out there for the likes of you yet. Come back with a guild badge.\"",
      modalContent: {
        title: 'A Dwarf Guard blocks the road west',
        type: 'icon',
        icon: 'environment-dwarf-guard-gate',
        iconColor: 'gray-500',
        message: "The dwarf guard does not move. \"Nothing out there for the likes of you yet. Come back with a guild badge.\" The Warrior's Guild and the Wizard's Guild are both a short walk east.",
      },
    },
  },
  // The Grotto's carved stone door. The switch that moves it is in the Red Fort
  // Kitchen, past the Butcher — a room away and on the far side of the fort.
  // Session-scoped like the original's `$_SESSION['grottoswitch']`, and the exit
  // stays invisible until it is thrown rather than showing as a locked door.
  '319': {
    'southwest': {
      check: (playerId) => {
        const { isLeverPulled, GROTTO_SWITCH } = require('./lever-state')
        return isLeverPulled(playerId, GROTTO_SWITCH)
      },
      message: 'A giant carved stone door blocks the way to the Grotto. There must be a switch somewhere that moves it.',
      hidden: true,
      lever: true,
      modalContent: {
        title: 'The Grotto door will not move',
        type: 'icon',
        icon: 'gate',
        iconColor: 'gray-500',
        message: 'A giant carved stone door blocks the way to the Grotto. There must be a switch somewhere that moves it — somewhere in the fort, by the feel of it.',
      },
      // Spent on the way through, as the original spent it: the door grinds shut
      // behind you, so a second visit means a second trip past the Butcher.
      onPass: async (playerId) => {
        const { resetLever, GROTTO_SWITCH } = require('./lever-state')
        resetLever(playerId, GROTTO_SWITCH)
      },
    },
  },
  // The Silver Mine. The original drew the room on the map, greyed out, behind a
  // gate whose handler is `if (1 == 2)`. It is content that was never finished,
  // not content you have failed to unlock, so the door simply does not open.
  '317': {
    'south': {
      check: async () => false,
      message: 'The gate to the south is magically locked, and nothing you have opens it.',
      modalContent: {
        title: 'A magically locked gate',
        type: 'icon',
        icon: 'gate',
        iconColor: 'gray-500',
        message: 'The gate to the south is magically locked. Whatever is down in the Silver Mine, it is staying there for now.',
      },
    },
  },
  // The mine head. Membership is the Mining Guild's own initiation quest — put
  // Red Beard down in the Red Fort and the shaft is yours.
  '311': {
    'down': {
      check: (playerId) => miningGuildMember(playerId),
      message: 'ACCESS DENIED. Join the Mining Guild to gain access to the mine — the guild hall is south of here, and they want Red Beard dealt with first.',
      modalContent: {
        title: 'The mine is guild property',
        type: 'icon',
        icon: 'npc-miner2',
        iconColor: 'yellow-600',
        message: 'A miner steps in front of the cage. "Guild members only past here. Talk to the hall south of the square — they want the Red Fort dealt with first."',
      },
    },
  },
}

/**
 * The Blue Ocean's open water. Every exit that leaves a room across the water
 * needs a boat or wings; exits onto dry land — the Oasis, the islands, the
 * temples, the docks and the beach — never do. Built from a table of which
 * exits are water rather than written out fifty times, because the rule is one
 * rule and the original wrote it out fifty times.
 *
 * Under the ocean the same shape with gills: every swim between water rooms
 * needs them, every `up` to the surface does not, and the dry Mud Cave needs
 * nothing at all.
 */
const OCEAN_WATER_EXITS = {
  '016': ['west'],
  '017': ['west'],
  '401': ['northwest', 'southwest'],
  '402': ['southeast'],
  '403': ['west'],
  '404': ['west', 'south', 'northeast', 'east'],
  '405': ['west', 'northeast'],
  '406': ['west', 'north', 'south', 'east'],
  '407': ['northwest', 'north', 'south'],
  '408': ['northeast', 'southeast'],
  '409': ['southwest', 'east'],
  '411': ['west', 'north', 'southeast', 'southwest'],
  '412': ['northwest'],
  '413': ['west', 'southeast', 'east'],
  '414': ['north', 'south', 'east'],
  '415': ['west', 'south', 'northeast', 'east'],
  '416': ['west', 'northwest'],
  '417': ['north', 'east'],
  '418': ['northwest', 'southeast', 'east'],
  '419': ['west'],
  '420': ['southwest'],
  '421': ['southwest', 'east'],
  '422': ['west', 'southwest', 'northeast', 'east', 'southeast'],
  '423': ['northeast', 'east'],
  '424': ['northeast'],
}
for (const [roomId, directions] of Object.entries(OCEAN_WATER_EXITS)) {
  ROOM_GATES[roomId] = ROOM_GATES[roomId] || {}
  for (const direction of directions) ROOM_GATES[roomId][direction] = sailGate()
}

const UNDERWATER_SWIM_EXITS = {
  '402': ['down'],
  '410': ['down'],
  '417': ['down'],
  '420': ['down'],
  '480': ['east', 'northeast'],
  '481': ['west', 'north'],
  '482': ['south', 'northeast'],
  '483': ['north'],
  '484': ['northwest', 'northeast', 'east', 'south', 'southwest'],
  '485': ['southwest'],
  '486': ['southeast', 'west'],
  '487': ['northwest', 'east'],
  '488': ['southwest'],
  '489': ['northwest', 'northeast'],
  '493': ['northwest'],
  '494': ['west'],
  '495': ['west', 'southeast'],
  '496': ['northwest', 'east'],
  '498': ['northwest'],
  '499': ['southeast'],
}
for (const [roomId, directions] of Object.entries(UNDERWATER_SWIM_EXITS)) {
  ROOM_GATES[roomId] = ROOM_GATES[roomId] || {}
  for (const direction of directions) ROOM_GATES[roomId][direction] = swimGate()
}

// The four temples open onto the Master Temple only once their own boss is
// down — each temple checks its own kill, as the original's room files did.
const MASTER_TEMPLE_DOORS = [
  { roomId: '405', direction: 'southeast', monster: 'heavy-walrus', boss: 'Yellow Water Temple boss, the Heavy Walrus' },
  { roomId: '409', direction: 'northeast', monster: 'coral-wizard', boss: 'Blue Water Temple boss, the Coral Wizard' },
  { roomId: '418', direction: 'southwest', monster: 'smooth-ranger', boss: 'Green Water Temple boss, the Smooth Ranger' },
  { roomId: '423', direction: 'northwest', monster: 'thunder-barbarian', boss: 'Red Water Temple boss, the Thunder Barbarian' },
]
for (const door of MASTER_TEMPLE_DOORS) {
  ROOM_GATES[door.roomId] = ROOM_GATES[door.roomId] || {}
  ROOM_GATES[door.roomId][door.direction] = {
    check: (playerId) => hasKilled(playerId, door.monster),
    message: `You can't enter the Master Temple yet! You need to defeat the ${door.boss} first.`,
    modalContent: {
      title: 'The way to the Master Temple is shut',
      type: 'icon',
      icon: 'pillar2',
      iconColor: 'blue-300',
      message: `A wall of water stands where the passage should be. You can't enter the Master Temple yet — defeat the ${door.boss} first, and it will part for you.`,
    },
  }
}

// The coral door in the Underwater Alcove, opened by the lever in the reef
// (483). Session-scoped like the original's `$_SESSION['underwaterswitch']`,
// and the original never spent it — once the door was open it stayed open
// for the rest of the session, so there is no `onPass` here.
// The original checked the switch first and gills second; a gate has one
// message, so the door is the one reported and the swim rule still holds
// behind it — an open door is still deep water.
ROOM_GATES['493'].east = {
  check: async (playerId) => {
    const { isLeverPulled, UNDERWATER_SWITCH } = require('./lever-state')
    if (!isLeverPulled(playerId, UNDERWATER_SWITCH)) return false
    return playerCanBreatheWater(playerId)
  },
  lever: true,
  message: 'A massive Coral Door blocks the way to the east — and it is deep water beyond it. Open the door from the reef, and breathe water to swim through.',
  modalContent: {
    title: 'A massive Coral Door blocks the way east',
    type: 'icon',
    icon: 'gate',
    iconColor: 'purple-400',
    message: 'The coral door does not move. Somewhere in the reef to the north there is a piece of coral shaped like a lever, and this is what it opens. Beyond it is deep water: you will need gills to swim through even once it stands open.',
  },
}

/**
 * Every shaft in the Neverending Mine, built rather than written out thirty-one
 * times. Going down is not walking downstairs — it is digging the next level
 * out, so it needs a pickaxe in the pack and it pays ore on the way through,
 * which is what `onPass` is doing here. The pick tier decides what you bring
 * back up, never whether you can descend: a plain pickaxe reaches Mine Level 30,
 * it just fills your pack with stone on the way.
 */
for (let depth = 0; depth <= 29; depth += 1) {
  const roomId = `311-${String(depth).padStart(2, '0')}`
  ROOM_GATES[roomId] = {
    down: {
      check: async (playerId) => {
        const { getBestPickaxe } = require('./services/mining-service')
        return !!(await getBestPickaxe(playerId))
      },
      message: 'You need a pickaxe to mine down! Grab one at the mine head, or buy a better one from the Mining Guild.',
      modalContent: {
        type: 'icon',
        icon: 'pickaxe',
        iconColor: 'amber-400',
        title: 'You have nothing to dig with',
        message: 'You need a pickaxe to mine down! There are spares at the mine head above, and the Mining Guild sells iron, steel and mithril ones.',
      },
      onPass: async (playerId) => {
        const { mineOnce } = require('./services/mining-service')
        const result = await mineOnce(playerId, `311-${String(depth + 1).padStart(2, '0')}`)
        if (!result?.message) return null
        return { message: result.message, inventory: result.inventory }
      },
    },
  }
}

/**
 * Check if a gate exists and if the player meets the criteria
 * @param {string} roomId - The source room ID
 * @param {string} direction - The direction of travel
 * @param {string} playerId - The player's ID
 * @returns {Promise<{allowed: boolean, gate?: object}|null>} Gate check result or null if no gate exists
 */
async function checkRoomGate(roomId, direction, playerId) {
  const roomGates = ROOM_GATES[roomId]
  if (!roomGates) {
    return null
  }

  const gate = roomGates[direction]
  if (!gate) {
    return null
  }

  // Run the gate check function
  const allowed = await gate.check(playerId)

  return {
    allowed,
    gate,
    onPass: allowed && gate.onPass ? gate.onPass : null,
  }
}

/**
 * Which of a room's exits carry a gate, as plain direction names.
 *
 * Shipped on the room payload so the client can skip its optimistic room swap on
 * an exit the server may refuse. The client used to keep a hand-written copy of
 * this table (`CLIENT_ROOM_GATES`), which had fallen to 15 of 65 gates — every
 * gate added since the sewers was missing, so new content optimistically flashed
 * the destination and then rubber-banded back on rejection.
 *
 * Only *whether* an exit is gated, never why: the condition stays server-side.
 * That a visible exit is gated is not a secret — undiscovered passages are
 * hidden from the payload entirely by the lever and search-reveal overlays.
 */
function getGatedDirections(roomId) {
  return Object.keys(ROOM_GATES[roomId] || {})
}

module.exports = {
  checkRoomGate,
  getGatedDirections,
  ROOM_GATES,
}

