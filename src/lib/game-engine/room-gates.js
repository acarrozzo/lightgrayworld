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
    'down': {
      check: async (playerId) => {
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
      message: "It's dark and dangerous down there. You need a weapon equipped or to be at least level 5 before heading into the basement.",
      modalContent: {
        title: 'The basement stairs are dangerous',
        type: 'icon',
        icon: 'npc-dwarfguard',
        iconColor: 'amber-500',
        message: "It's dark and dangerous down there. You need a weapon equipped or to be at least level 5 before heading into the basement.",
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
  }
}

module.exports = {
  checkRoomGate,
  ROOM_GATES,
}

