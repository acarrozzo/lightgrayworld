const { executeRoomAction } = require('./room-action-handlers')
const { pickupRoomItem, dropRoomItem, getRoomItems } = require('./services/room-item-service')
const { getPlayerInventory } = require('./services/inventory-service')

class RoomState {
  constructor(roomId) {
    this.roomId = roomId
    this.players = new Map()
    this.lastActionAt = null
    this.lastTickPlayerCount = null
    this.lastAmbientHintAt = 0
  }

  addPlayer(playerState) {
    if (!playerState?.id) return
    this.players.set(playerState.id, { ...playerState })
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
  }

  updatePlayer(playerId, updater) {
    const player = this.players.get(playerId)
    if (!player) return
    const updated = typeof updater === 'function' ? updater({ ...player }) : player
    this.players.set(playerId, updated)
  }

  getState() {
    return {
      roomId: this.roomId,
      playerCount: this.players.size,
      lastActionAt: this.lastActionAt,
    }
  }

  getTickUpdate(now = Date.now()) {
    const playerCount = this.players.size
    
    // Always get ambient data (no longer conditional)
    const ambientData = this.buildAmbientData(now)
    
    // Always return an update - world tick IS the display
    // Track player count changes but always return update when players are present
    const playerCountChanged =
      this.lastTickPlayerCount === null || this.lastTickPlayerCount !== playerCount

    this.lastTickPlayerCount = playerCount

    // Always return an update object when there are players
    // This ensures world ticks always occur every 5 seconds
    return {
      playerCount,
      ambientData: ambientData || null,
    }
  }

  async executeAction(action, playerId, currentTickNumber, nextTickAt) {
    // First, check if this is a room-specific action
    const actionName = action.type || action
    const roomSpecificResult = await executeRoomAction(
      this.roomId,
      actionName,
      playerId,
      this,
      currentTickNumber,
      nextTickAt
    )
    
    // If room-specific handler returned a result, use it
    if (roomSpecificResult !== null) {
      return roomSpecificResult
    }
    
    // Otherwise, fall back to standard actions
    switch (action.type) {
      case 'pickup_item':
        return this.executePickupItem(action, playerId)
      case 'drop_item':
        return this.executeDropItem(action, playerId)
      case 'move':
        return this.executeMove(action, playerId)
      case 'chat':
        return this.executeChat(action, playerId)
      case 'search':
        return this.executeSearch(playerId)
      case 'rest':
        return this.executeRest(playerId)
      case 'look':
        return this.executeLook(action, playerId)
      case 'examine_item':
        return this.executeExamineItem(action, playerId)
      case 'examine_player_item':
        return this.executeExaminePlayerItem(action, playerId)
      default:
        return this.createErrorResult(action.type, `Unknown action type: ${action.type}`)
    }
  }

  async executePickupItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('pickup_item', 'Player not found in this room')
    }

    const { roomItemId, quantity = 1 } = action.data || {}
    if (!roomItemId) {
      return this.createErrorResult('pickup_item', 'Room item ID is required')
    }

    this.touchActivity()

    const result = await pickupRoomItem(playerId, roomItemId, quantity, this.roomId)

    if (!result.success) {
      return this.createErrorResult('pickup_item', result.message)
    }

    return {
      success: true,
      action: 'pickup_item',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('pickup_item', 'success', result.message, {
          inventory: result.inventory,
          roomItems: result.roomItems,
        }),
      },
      broadcastEvents: [
        {
          event: 'room:items:update',
          targetRoomId: this.roomId,
          payload: {
            roomId: this.roomId,
            items: result.roomItems,
          },
        },
      ],
    }
  }

  async executeDropItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('drop_item', 'Player not found in this room')
    }

    const { playerItemId, quantity = 1 } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('drop_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await dropRoomItem(playerId, playerItemId, quantity, this.roomId)

    if (!result.success) {
      return this.createErrorResult('drop_item', result.message)
    }

    return {
      success: true,
      action: 'drop_item',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('drop_item', 'success', result.message, {
          inventory: result.inventory,
          roomItems: result.roomItems,
        }),
      },
      broadcastEvents: [
        {
          event: 'room:items:update',
          targetRoomId: this.roomId,
          payload: {
            roomId: this.roomId,
            items: result.roomItems,
          },
        },
      ],
    }
  }

  executeMove(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[RoomState:${this.roomId}] executeMove - Player ${playerId} not found`)
      return this.createErrorResult('move', 'Player not found in this room')
    }

    const fromRoom = action.data?.fromRoom || this.roomId
    const toRoom = action.data?.toRoom
    if (!toRoom) {
      console.log(`[RoomState:${this.roomId}] executeMove - No destination room provided`)
      return this.createErrorResult('move', 'No destination room provided')
    }

    console.log(`[RoomState:${this.roomId}] executeMove - ${player.username} moving from ${fromRoom} to ${toRoom}`)

    this.touchActivity()
    this.removePlayer(playerId)

    const toRoomName = action.data?.toRoomName || toRoom
    const roomData = action.data?.roomData
    const direction = action.data?.direction
    const message = direction ? `You travel ${direction}` : `You teleport to ${toRoomName}`

    return {
      success: true,
      action: 'move',
      data: { fromRoom, toRoom, toRoomName, roomData },
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('move', 'success', message, { toRoom, toRoomName, roomData, direction }),
      },
      broadcastEvents: [
        {
          event: 'room:player-moved',
          payload: {
            playerId,
            username: player.username,
            fromRoom,
            toRoom,
          },
          targetRoomId: fromRoom,
        },
        {
          event: 'room:player-moved',
          payload: {
            playerId,
            username: player.username,
            fromRoom,
            toRoom,
          },
          targetRoomId: toRoom,
        },
      ],
      transfer: {
        toRoomId: toRoom,
        fromRoomId: this.roomId,
        playerState: {
          ...player,
          roomId: toRoom,
        },
      },
    }
  }

  executeChat(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('chat', 'Player not found in this room')
    }

    const message = action.data?.message?.toString().trim()
    if (!message) {
      return this.createErrorResult('chat', 'Message cannot be empty')
    }

    this.touchActivity()

    const timestamp = new Date()
    const chatId = `${playerId}-${timestamp.getTime()}`

    const payload = {
      id: chatId,
      userId: playerId,
      username: player.username,
      level: player.level ?? 1,
      message,
      timestamp,
      roomId: this.roomId,
    }

    console.log(`[RoomState:${this.roomId}] Broadcasting chat message from ${player.username}: "${message}"`)

    return {
      success: true,
      action: 'chat',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('chat', 'success', 'Message sent', { message }),
      },
      broadcastEvents: [
        {
          event: 'chat-message',
          payload,
        },
      ],
    }
  }

  executeSearch(playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('search', 'Player not found in this room')
    }

    this.touchActivity()

    return {
      success: true,
      action: 'search',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('search', 'success', 'You search the room and find nothing.'),
      },
    }
  }

  executeRest(playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('rest', 'Player not found in this room')
    }

    this.touchActivity()

    const healAmount = Math.max(1, Math.floor((player.hpMax ?? 10) * 0.1))
    const startingHp = player.hp ?? 0
    const newHp = Math.min(player.hpMax ?? 10, startingHp + healAmount)
    const recovered = Math.max(0, newHp - startingHp)

    this.updatePlayer(playerId, (state) => ({
      ...state,
      hp: newHp,
    }))

    return {
      success: true,
      action: 'rest',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('rest', 'success', `You recover ${recovered} HP.`, {
          hp: newHp,
        }),
      },
    }
  }

  executeLook(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('look', 'Player not found in this room')
    }

    this.touchActivity()

    const roomName = action?.data?.roomName || this.roomId
    const message = `You look around: ${roomName}`

    return {
      success: true,
      action: 'look',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('look', 'success', message, {
          roomId: this.roomId,
          playerCount: this.players.size,
        }),
      },
    }
  }

  async executeExamineItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('examine_item', 'Player not found in this room')
    }

    const { roomItemId } = action.data || {}
    if (!roomItemId) {
      return this.createErrorResult('examine_item', 'Room item ID is required')
    }

    this.touchActivity()

    // Get all room items to find the one being examined
    const roomItems = await getRoomItems(this.roomId)
    const item = roomItems.find((item) => item.id === roomItemId)

    if (!item) {
      return this.createErrorResult('examine_item', 'Item not found in this room')
    }

    const itemName = item.template.name
    const itemDescription = item.template.description || 'You see nothing special about it.'
    const message = `You examine the ${itemName}. ${itemDescription}`

    return {
      success: true,
      action: 'examine_item',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('examine_item', 'success', message, {
          roomId: this.roomId,
          itemName,
          itemDescription,
        }),
      },
    }
  }

  async executeExaminePlayerItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('examine_player_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('examine_player_item', 'Player item ID is required')
    }

    this.touchActivity()

    // Get player inventory to find the item being examined
    const inventory = await getPlayerInventory(playerId)
    const item = inventory.find((item) => item.id === playerItemId)

    if (!item) {
      return this.createErrorResult('examine_player_item', 'Item not found in your inventory')
    }

    const itemName = item.template.name
    const itemDescription = item.template.description || 'You see nothing special about it.'
    const message = `You examine the${itemName}. ${itemDescription}`

    return {
      success: true,
      action: 'examine_player_item',
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('examine_player_item', 'success', message, {
          itemName,
          itemDescription,
        }),
      },
    }
  }

  createFeedbackPayload(action, outcome, message, data = {}) {
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

  createErrorResult(action, message) {
    return {
      success: false,
      action,
      message,
      playerEvent: {
        event: 'action:feedback',
        payload: this.createFeedbackPayload(action, 'failure', message),
      },
    }
  }

  touchActivity() {
    this.lastActionAt = Date.now()
  }

  buildAmbientData(now) {
    // Removed MIN_AMBIENT_INTERVAL_MS restriction - ambient data is part of every world tick
    const hasPlayers = this.players.size > 0

    if (!hasPlayers) {
      return null
    }

    // Update timestamp every time (no interval check)
    // Ambient data generates on every world tick (every 5 seconds)
    this.lastAmbientHintAt = now

    const flavorSnippets = [
      'A faint breeze rustles through the area.',
      'You hear distant footsteps echo briefly.',
      'The lights flicker for just a moment.',
      'Something unseen shifts in the shadows.',
    ]

    const flavor = flavorSnippets[Math.floor(Math.random() * flavorSnippets.length)]

    return {
      type: 'flavor',
      message: flavor,
      timestamp: now,
    }
  }
}

module.exports = {
  RoomState,
}
