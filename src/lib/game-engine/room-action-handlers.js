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
    case '003':
      return handleRoom003Actions(normalizedAction, playerId, roomState)
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
      return executePickRedberry(playerId, roomState)
    default:
      return null
  }
}

/**
 * Handle actions for room 003 (Wood Cabin)
 */
function handleRoom003Actions(action, playerId, roomState) {
  switch (action) {
    case 'ex cabin':
      return executeExamineCabin(playerId, roomState)
    case 'attack dummy':
      return executeAttackDummy(playerId, roomState)
    case 'cook meat':
      return executeCookMeat(playerId, roomState)
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
    "The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.",
    playerId,
    roomState
  )
}

/**
 * Execute the 'pick redberry' action for room 002
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executePickRedberry(playerId, roomState) {
  return executeBasicDisplay(
    'pick redberry',
    "You pick a redberry from the bush. The fruit looks ripe and juicy, ready to restore your health.",
    playerId,
    roomState
  )
}

/**
 * Execute the 'examine cabin' action for room 003
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executeExamineCabin(playerId, roomState) {
  return executeBasicDisplay(
    'ex cabin',
    "You examine the cabin. It's warm and cozy, with a cooking fire burning and the Old Man rocking in his chair.",
    playerId,
    roomState
  )
}

/**
 * Execute the 'attack dummy' action for room 003
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executeAttackDummy(playerId, roomState) {
  return executeBasicDisplay(
    'attack dummy',
    "You attack the training dummy. Your weapon strikes true!",
    playerId,
    roomState
  )
}

/**
 * Execute the 'cook meat' action for room 003
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function executeCookMeat(playerId, roomState) {
  return executeBasicDisplay(
    'cook meat',
    "You cook the meat over the fire. It smells delicious!",
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

