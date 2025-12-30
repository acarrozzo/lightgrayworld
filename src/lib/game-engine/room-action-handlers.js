/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */
const { grantPersonalItemOnce } = require('./effects')
const { grantItemOnce } = require('./services/inventory-service')
const { checkAndIncrementCap } = require('./services/action-cap-service')

/**
 * Format time remaining: hours+minutes if >= 60min, minutes+seconds if < 60min
 */
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return '0s'
  
  const totalMinutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${hours}h`
  }
  
  if (totalMinutes > 0) {
    if (remainingSeconds > 0) {
      return `${totalMinutes}m ${remainingSeconds}s`
    }
    return `${totalMinutes}m`
  }
  
  return `${remainingSeconds}s`
}

/**
 * Map of room IDs to room-specific actions. Each action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 * - A structured action definition object (supports effects)
 */
const ROOM_ACTIONS = {
  '000': {
    'read sign': {
      showModal: true,
      message: 'You read the sign attached to the pillar',
      modalContent: {
        title: 'You read the sign attached to the pillar',
        type: 'icon',
        icon: 'sign-metal',
        iconColor: 'gray-500',
        message: 'Welcome to Room Zero, the first room ever made. It is unlike the others. I allow you to stand here, for now.',
      },
    },
    'examine pillar': {
      showModal: true,
      message: 'You examine the glowing pillar at the center of the room.',
      modalContent: {
        type: 'icon',
        icon: 'pillar2',
        iconColor: 'blue-300/30',
        message: 'The bright blue light emanating from the pillar seems to be a button. Press it to teleport to the grassy field.',
      },
    },
  },
  '001': {
    'read sign': {
      showModal: true,
      message: "You read the sign. It says: 'Welcome to Grassy Field Crossroads!'",
      modalContent: {
        title: 'You read the sign',
        heading: { 
          text: 'Grassy Field Directory', 
          parts: ['Grassy Field', 'Directory'],
          description: 'Welcome! This directory shows nearby locations you can explore. Click the direction buttons to travel there instantly.'
        },
        locations: [
          { 
            name: 'Healing Waterfall', 
            direction: 'northwest',
            description: 'Rest here to restore your health. Essential for survival when you take damage in combat!'
          },
          { 
            name: 'Shaman Tent', 
            direction: 'northeast',
            description: 'A mystical place where you can learn new abilities and purchase magical items to aid your journey.'
          },
          { 
            name: 'Beach', 
            direction: 'west',
            description: 'A peaceful coastal area where you can gather resources and find items washed ashore.'
          },
          { 
            name: 'Wood Cabin', 
            direction: 'southwest',
            description: 'The Old Man lives here. He\'s your first quest giver and will help you get started on your adventure.'
          }
        ],
        questMessage: "Visit the OLD MAN at the cabin to start your first quest.",
        questMessageDescription: 'The Old Man will give you your first quest and help you learn the basics of the game. This is where your adventure truly begins!'
      },
      buttons: [
        { label: 'northwest', direction: 'northwest' },
        { label: 'northeast', direction: 'northeast' },
        { label: 'west', direction: 'west' },
        { label: 'southwest', direction: 'southwest' }
      ]
    },
    'open gold chest': {
      showModal: true,
      message: 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
      modalContent: {
        type: 'icon',
        icon: 'chest',
        message: 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
      },
    },
  },
  '002': {
    'pick redberry': {
      maxPerTick: 5,
      isCapped: true,
      effects: [{ type: 'grantItem', itemSlug: 'redberry', quantity: 1 }],
      generateMessage: (effects, capInfo) => {
        if (!effects?.[0]?.success) {
          const secondsRemaining = capInfo?.secondsUntilReset ?? 0
          const timeFormatted = formatTimeRemaining(secondsRemaining)
          return `No more redberries right now. The bushes will regrow in ${timeFormatted}.`
        }
        return `You pick a ripe redberry. (${capInfo.remaining} picks remaining this tick)`
      },
      determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    },
  },
  '003': {
    'ex cabin': "You examine the cabin. It's warm and cozy, with a cooking fire burning and the Old Man rocking in his chair.",
    'attack dummy': 'You attack the training dummy. Your weapon strikes true!',
    'cook meat': 'You cook the meat over the fire. It smells delicious!',
  },
  '004': {
    'pick flower': {
      effects: [
        { type: 'grantPersonalItemOnce', itemSlug: 'flower', quantity: 1 },
      ],
      generateMessage: (effects) => {
        const grantResult = effects?.[0]
        if (grantResult?.success) {
          return 'You pick a beautiful flower and tuck it safely away.'
        }
        return 'You already have a flower. One is enough for now.'
      },
      determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    },
  },
  '005': {
    'pick blueberry': {
      maxPerTick: 3,
      isCapped: true,
      effects: [{ type: 'grantItem', itemSlug: 'blueberry', quantity: 1 }],
      generateMessage: (effects, capInfo) => {
        if (!effects?.[0]?.success) {
          const secondsRemaining = capInfo?.secondsUntilReset ?? 0
          const timeFormatted = formatTimeRemaining(secondsRemaining)
          return `No more blueberries right now. The bushes will regrow in ${timeFormatted}.`
        }
        return `You pick a ripe blueberry. (${capInfo.remaining} picks remaining this tick)`
      },
      determineOutcome: ({ success }) => (success ? 'success' : 'info'),
    },
  },
}

/**
 * Execute a room-specific action
 * @param {string} roomId - The room ID where the action is being executed
 * @param {string} action - The action name (e.g., 'read sign', 'open gold chest')
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object|null} Action result object or null if action not found
 */
async function executeRoomAction(roomId, action, playerId, roomState, currentTickNumber, nextTickAt) {
  const normalizedAction = action.toLowerCase().trim()
  const roomActions = ROOM_ACTIONS[roomId]

  if (!roomActions) {
    return null
  }

  const handler = roomActions[normalizedAction]

  if (!handler) {
    return null
  }

  if (typeof handler === 'function') {
    return await handler(playerId, roomState)
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
 */
async function executeStructuredAction(actionName, definition, playerId, roomState, currentTickNumber, nextTickAt) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  let capResult = null

  // Handle capped actions before running effects
  if (definition.isCapped) {
    if (!currentTickNumber && currentTickNumber !== 0) {
      return createErrorResult(actionName, 'World tick unavailable. Please try again.')
    }

    capResult = await checkAndIncrementCap(
      playerId,
      roomState.roomId,
      actionName,
      definition.maxPerTick,
      currentTickNumber
    )

    const secondsUntilReset =
      typeof nextTickAt === 'number'
        ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
        : null

    if (!capResult.allowed) {
      const message = typeof definition.generateMessage === 'function'
        ? definition.generateMessage([{ success: false }], {
            remaining: 0,
            secondsUntilReset,
          })
        : 'You cannot perform this action right now.'

      const capExceededOutcome =
        typeof definition.determineOutcome === 'function'
          ? definition.determineOutcome({
              success: false,
              effectResults: [{ success: false }],
              capInfo: { remaining: 0, secondsUntilReset },
            }) || 'failure'
          : 'failure'

      return {
        success: false,
        action: actionName,
        message,
        playerEvent: {
          event: 'action:feedback',
          payload: createActionFeedbackPayload(actionName, capExceededOutcome, message, {
            roomId: roomState.roomId,
            remaining: 0,
            secondsUntilReset,
          }),
        },
      }
    }

    roomState.touchActivity()
  }

  const effects = Array.isArray(definition.effects) ? definition.effects : []
  const { results: effectResults, inventory } = await executeEffects(effects, playerId)

  const capInfo = definition.isCapped
    ? {
        remaining: capResult
          ? Math.max(0, definition.maxPerTick - capResult.usedCount)
          : 0,
        secondsUntilReset:
          typeof nextTickAt === 'number'
            ? Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))
            : null,
      }
    : null

  const message = typeof definition.generateMessage === 'function'
    ? definition.generateMessage(effectResults, capInfo)
    : definition.message || 'You take action.'

  const success = typeof definition.success === 'boolean'
    ? definition.success
    : effectResults.every((r) => r?.success !== false)

  const outcome =
    typeof definition.determineOutcome === 'function'
      ? definition.determineOutcome({
          success,
          effectResults,
          capInfo,
        }) || (success ? 'success' : 'failure')
      : success ? 'success' : 'failure'

  const data = {
    roomId: roomState.roomId,
    ...(inventory ? { inventory } : {}),
    ...(capInfo ? { remaining: capInfo.remaining, secondsUntilReset: capInfo.secondsUntilReset } : {}),
    effects: effectResults,
  }

  if (definition.showModal) {
    data.showModal = true
    // Check if definition has structured modalContent, otherwise use message string
    if (definition.modalContent) {
      data.modalContent = definition.modalContent
      if (definition.buttons) {
        data.buttons = definition.buttons
      }
    } else {
      data.modalContent = message
    }
  }

  return {
    success,
    action: actionName,
    playerEvent: {
      event: 'action:feedback',
      payload: createActionFeedbackPayload(actionName, outcome, message, data),
    },
  }
}

/**
 * Execute a list of effects and collect results.
 */
async function executeEffects(effects, playerId) {
  const results = []
  let latestInventory = null

  for (const effect of effects) {
    if (!effect?.type) continue

    if (effect.type === 'grantPersonalItemOnce') {
      const result = await grantPersonalItemOnce(playerId, effect.itemSlug, effect.quantity || 1)
      results.push(result)
      if (result.inventory) {
        latestInventory = result.inventory
      }
      continue
    }

    if (effect.type === 'grantItem') {
      const result = await grantItemOnce(playerId, effect.itemSlug, effect.quantity || 1)
      results.push({
        success: result.granted,
        message: result.reason,
        inventory: result.inventory,
      })
      if (result.inventory) {
        latestInventory = result.inventory
      }
      continue
    }

    results.push({ success: false, message: `Unknown effect type: ${effect.type}` })
  }

  return { results, inventory: latestInventory }
}

module.exports = {
  executeRoomAction,
}

