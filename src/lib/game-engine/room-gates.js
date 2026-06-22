/**
 * Room passage gates
 * Defines gates that block passage between rooms unless certain criteria are met
 */
const { prisma } = require('../db-client')

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

