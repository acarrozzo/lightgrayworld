/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */

/**
 * Map of room IDs to room-specific actions. Each action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 */
const ROOM_ACTIONS = {
  '001': {
    'read sign': "You read the sign. It says: 'Welcome to Grassy Field Crossroads!'",
    'open gold chest': 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
  },
  '002': {
    'pick redberry': 'You pick a redberry from the bush. The fruit looks ripe and juicy, ready to restore your health.',
  },
  '003': {
    'ex cabin': "You examine the cabin. It's warm and cozy, with a cooking fire burning and the Old Man rocking in his chair.",
    'attack dummy': 'You attack the training dummy. Your weapon strikes true!',
    'cook meat': 'You cook the meat over the fire. It smells delicious!',
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
function executeRoomAction(roomId, action, playerId, roomState) {
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
    return handler(playerId, roomState)
  }

  if (typeof handler === 'string') {
    return executeBasicDisplay(normalizedAction, handler, playerId, roomState)
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
function executeBasicDisplay(actionName, message, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  return {
    success: true,
    action: actionName,
    playerEvent: {
      event: 'action:result',
      payload: createPlayerPayload(actionName, true, message, {
        roomId: roomState.roomId,
      }),
    },
  }
}

/**
 * Create a player payload for action results
 */
function createPlayerPayload(action, success, message, data = {}) {
  return {
    action,
    success,
    message,
    timestamp: new Date().toISOString(),
    data,
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
      event: 'action:result',
      payload: createPlayerPayload(action, false, message),
    },
  }
}

module.exports = {
  executeRoomAction,
}

