/**
 * Room-specific action handlers
 * Handles execution of actions that are unique to specific rooms
 */

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
  
  // Route to specific handler based on room and action
  switch (roomId) {
    case '001':
      return handleRoom001Actions(normalizedAction, playerId, roomState)
    case '002':
      return handleRoom002Actions(normalizedAction, playerId, roomState)
    // Add more room handlers as needed
    default:
      return null
  }
}

/**
 * Handle actions for room 001 (Grassy Field Crossroads)
 */
function handleRoom001Actions(action, playerId, roomState) {
  switch (action) {
    case 'read sign':
      return executeReadSign(playerId, roomState)
    case 'open gold chest':
    case 'open chest':
      return executeOpenGoldChest(playerId, roomState)
    default:
      return null
  }
}

/**
 * Handle actions for room 002 (Grassy Field South)
 */
function handleRoom002Actions(action, playerId, roomState) {
  switch (action) {
    case 'pick redberry':
      // TODO: Implement in future
      return createErrorResult(action, 'This action is not yet implemented.')
    default:
      return null
  }
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
 * Execute the 'read sign' action for room 001
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executeReadSign(playerId, roomState) {
  return executeBasicDisplay(
    'read sign',
    "You read the sign. It says: 'Welcome to Grassy Field Crossroads!'",
    playerId,
    roomState
  )
}

/**
 * Execute the 'open gold chest' action for room 001
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executeOpenGoldChest(playerId, roomState) {
  return executeBasicDisplay(
    'open gold chest',
    "You open the gold chest and find it empty. Perhaps it was already looted?",
    playerId,
    roomState
  )
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

