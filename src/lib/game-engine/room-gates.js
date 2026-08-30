/**
 * Room passage gates
 * Defines gates that block passage between rooms unless certain criteria are met
 */
const { prisma } = require('../db-client')

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
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { wings: true },
        })
        return user?.wings >= 1
      },
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
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { wings: true },
        })
        return user?.wings >= 1
      },
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
      check: async (playerId) => {
        const user = await prisma.user.findUnique({
          where: { id: playerId },
          select: { wings: true },
        })
        return user?.wings >= 1
      },
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

module.exports = {
  checkRoomGate,
  ROOM_GATES,
}

