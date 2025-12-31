/**
 * Item-specific action handlers
 * Handles execution of actions that are unique to specific items
 */

/**
 * Map of item slugs to item-specific actions. Each action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 * - A structured action definition object (supports effects)
 */
const ITEM_ACTIONS = {
  'welcome-book': {
    'read book': {
      showModal: true,
      message: 'You open the Welcome Book and begin reading.',
      modalContent: {
        title: 'Welcome Book',
        type: 'icon',
        icon: 'book',
        iconColor: 'blue-400/70',
        message: 'Welcome to the world! This is your journey. Explore, fight, and discover what lies ahead. The path is yours to choose.',
      },
    },
  },
}

/**
 * Execute a item-specific action
 * @param {string} itemSlug - The item slug where the action is being executed
 * @param {string} action - The action name (e.g., 'read book')
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object|null} Action result object or null if action not found
 */
async function executeItemAction(itemSlug, action, playerId, roomState, currentTickNumber, nextTickAt) {
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

