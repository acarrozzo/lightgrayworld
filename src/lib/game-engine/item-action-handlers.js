/**
 * Item-specific action handlers
 * Handles execution of actions that are unique to specific items
 */
const { prisma } = require('../db-client')
const { getPlayerInventory } = require('./services/inventory-service')

/**
 * Map of item slugs to item-specific actions. Each action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 * - A structured action definition object (supports effects)
 */
/**
 * Handler for eating a redberry - removes item and increases HP
 */
async function handleEatRedberry(playerId, roomState, playerItemId) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult('eat', 'Player not found in this room')
  }

  if (!playerItemId) {
    return createErrorResult('eat', 'Item ID is required')
  }

  roomState.touchActivity()

  // Get player inventory to verify item exists
  const inventory = await getPlayerInventory(playerId)
  const item = inventory.find((item) => item.id === playerItemId)

  if (!item) {
    return createErrorResult('eat', 'Item not found in your inventory')
  }

  if (item.template.slug !== 'redberry') {
    return createErrorResult('eat', 'This action can only be used on redberries')
  }

  // Calculate new HP (increase by 1, capped at hpMax)
  const currentHp = player.hp ?? 0
  const hpMax = player.hpMax ?? 10
  const newHp = Math.min(hpMax, currentHp + 1)

  try {
    // Remove item from inventory and update HP in database
    await prisma.$transaction(async (tx) => {
      // Remove 1 redberry from inventory
      if (item.quantity === 1) {
        await tx.playerItem.delete({
          where: { id: playerItemId },
        })
      } else {
        await tx.playerItem.update({
          where: { id: playerItemId },
          data: { quantity: item.quantity - 1 },
        })
      }

      // Update player HP
      await tx.user.update({
        where: { id: playerId },
        data: { hp: newHp },
      })
    })

    // Update HP in memory
    roomState.updatePlayer(playerId, (state) => ({
      ...state,
      hp: newHp,
    }))

    // Get updated inventory
    const updatedInventory = await getPlayerInventory(playerId)

    const message = `You eat the redberry. You gain 1 HP.`
    const hpChange = newHp - currentHp

    const data = {
      roomId: roomState.roomId,
      hp: newHp,
      hpChange: hpChange,
      inventory: updatedInventory,
    }

    return {
      success: true,
      action: 'eat',
      playerEvent: {
        event: 'action:feedback',
        payload: createActionFeedbackPayload('eat', 'success', message, data),
      },
    }
  } catch (error) {
    console.error('Error eating redberry:', error)
    return createErrorResult('eat', 'Failed to eat the redberry')
  }
}

/**
 * Handler for eating a flower - removes item and decreases HP
 */
async function handleEatFlower(playerId, roomState, playerItemId) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult('eat', 'Player not found in this room')
  }

  if (!playerItemId) {
    return createErrorResult('eat', 'Item ID is required')
  }

  roomState.touchActivity()

  // Get player inventory to verify item exists
  const inventory = await getPlayerInventory(playerId)
  const item = inventory.find((item) => item.id === playerItemId)

  if (!item) {
    return createErrorResult('eat', 'Item not found in your inventory')
  }

  if (item.template.slug !== 'flower') {
    return createErrorResult('eat', 'This action can only be used on flowers')
  }

  // Calculate new HP (decrease by 1, minimum 0)
  const currentHp = player.hp ?? 0
  const newHp = Math.max(0, currentHp - 1)

  try {
    // Remove item from inventory and update HP in database
    await prisma.$transaction(async (tx) => {
      // Remove 1 flower from inventory
      if (item.quantity === 1) {
        await tx.playerItem.delete({
          where: { id: playerItemId },
        })
      } else {
        await tx.playerItem.update({
          where: { id: playerItemId },
          data: { quantity: item.quantity - 1 },
        })
      }

      // Update player HP
      await tx.user.update({
        where: { id: playerId },
        data: { hp: newHp },
      })
    })

    // Update HP in memory
    roomState.updatePlayer(playerId, (state) => ({
      ...state,
      hp: newHp,
    }))

    // Get updated inventory
    const updatedInventory = await getPlayerInventory(playerId)

    const message = `You eat the flower. You lose 1 HP.`
    const hpChange = currentHp - newHp

    const data = {
      roomId: roomState.roomId,
      hp: newHp,
      hpChange: -hpChange,
      inventory: updatedInventory,
      showModal: true,
      modalContent: {
        title: 'You eat the flower',
        type: 'icon',
        icon: 'flower',
        iconColor: 'pink-400/70',
        message: `You consume the flower. It tastes bitter and you feel weaker. You lose 1 HP.`,
      },
    }

    return {
      success: true,
      action: 'eat',
      playerEvent: {
        event: 'action:feedback',
        payload: createActionFeedbackPayload('eat', 'success', message, data),
      },
    }
  } catch (error) {
    console.error('Error eating flower:', error)
    return createErrorResult('eat', 'Failed to eat the flower')
  }
}

const ITEM_ACTIONS = {
  'welcome-book': {
    'read book': {
      showModal: true,
      message: 'You read the Welcome Book.',
      modalContent: {
        title: 'Welcome Book',
        type: 'icon',
        icon: 'book',
        iconColor: 'blue-400/70',
        message: 'Welcome to the world! This is your journey. Explore, fight, and discover what lies ahead. The path is yours to choose.',
      },
    },
  },
  'flower': {
    'eat': handleEatFlower,
  },
  'redberry': {
    'eat': handleEatRedberry,
  },
}

/**
 * Execute a item-specific action
 * @param {string} itemSlug - The item slug where the action is being executed
 * @param {string} action - The action name (e.g., 'read book')
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @param {string} playerItemId - The ID of the player item being used
 * @returns {Object|null} Action result object or null if action not found
 */
async function executeItemAction(itemSlug, action, playerId, roomState, currentTickNumber, nextTickAt, playerItemId = null) {
  const normalizedAction = action.toLowerCase().trim()
  const itemActions = ITEM_ACTIONS[itemSlug]

  if (!itemActions) {
    return null
  }

  const handler = itemActions[normalizedAction]

  if (!handler) {
    return null
  }

  if (typeof handler === 'function') {
    return await handler(playerId, roomState, playerItemId)
  }

  if (typeof handler === 'string') {
    return executeBasicDisplay(normalizedAction, handler, playerId, roomState)
  }

  // Check if handler is a simple object with showModal (but not a full structured action)
  if (isStructuredAction(handler) && handler.showModal && typeof handler.message === 'string' && !handler.effects && !handler.generateMessage) {
    return executeBasicDisplay(normalizedAction, handler.message, playerId, roomState, handler.showModal, handler)
  }

  if (isStructuredAction(handler)) {
    return executeStructuredAction(normalizedAction, handler, playerId, roomState, currentTickNumber, nextTickAt)
  }

  return null
}

/**
 * Reusable helper function for basic display actions
 * Displays a message to the feed when an action is performed
 * @param {string} actionName - The name of the action being performed
 * @param {string} message - The message to display to the player
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function createActionFeedbackPayload(action, outcome, message, data = {}) {
  const ts = Date.now()
  return {
    action,
    message,
    outcome,
    ts,
    timestamp: new Date(ts).toISOString(),
    success: outcome === 'success',
    data,
  }
}

function executeBasicDisplay(actionName, message, playerId, roomState, showModal = false, handler = null) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  const data = {
    roomId: roomState.roomId,
  }

  if (showModal) {
    data.showModal = true
    // Check if handler has structured modalContent, otherwise use message string
    if (handler && handler.modalContent) {
      data.modalContent = handler.modalContent
      if (handler.buttons) {
        data.buttons = handler.buttons
      }
    } else {
      data.modalContent = message
    }
  }

  return {
    success: true,
    action: actionName,
    playerEvent: {
      event: 'action:feedback',
      payload: createActionFeedbackPayload(actionName, 'success', message, data),
    },
  }
}

/**
 * Create an error result for failed actions
 */
function createErrorResult(action, message) {
  return {
    success: false,
    action,
    message,
    playerEvent: {
      event: 'action:feedback',
      payload: createActionFeedbackPayload(action, 'failure', message),
    },
  }
}

/**
 * Determine if an action handler is a structured definition.
 */
function isStructuredAction(handler) {
  return handler && typeof handler === 'object' && !Array.isArray(handler)
}

/**
 * Execute structured action definition with optional effects.
 * For now, this is a simplified version. Can be expanded later if needed.
 */
async function executeStructuredAction(actionName, definition, playerId, roomState, currentTickNumber, nextTickAt) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  // For now, treat structured actions similar to basic display
  // This can be expanded later to support effects, etc.
  const message = definition.message || `You perform ${actionName}.`
  const showModal = definition.showModal || false

  const data = {
    roomId: roomState.roomId,
  }

  if (showModal && definition.modalContent) {
    data.showModal = true
    data.modalContent = definition.modalContent
    if (definition.buttons) {
      data.buttons = definition.buttons
    }
  }

  return {
    success: true,
    action: actionName,
    playerEvent: {
      event: 'action:feedback',
      payload: createActionFeedbackPayload(actionName, 'success', message, data),
    },
  }
}

module.exports = {
  executeItemAction,
}

