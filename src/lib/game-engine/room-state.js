const { executeRoomAction } = require('./room-action-handlers')

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

  executeAction(action, playerId) {
    // First, check if this is a room-specific action
    const actionName = action.type || action
    const roomSpecificResult = executeRoomAction(this.roomId, actionName, playerId, this)
    
    // If room-specific handler returned a result, use it
    if (roomSpecificResult !== null) {
      return roomSpecificResult
    }
    
    // Otherwise, fall back to standard actions
    switch (action.type) {
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
      default:
        return this.createErrorResult(action.type, `Unknown action type: ${action.type}`)
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
    const message = direction ? `You travel ${direction}` : `You travel to ${toRoomName}`

    return {
      success: true,
      action: 'move',
      data: { fromRoom, toRoom, toRoomName, roomData },
      playerEvent: {
        event: 'action:result',
        payload: this.createPlayerPayload('move', true, message, { toRoom, toRoomName, roomData }),
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
        event: 'action:result',
        payload: this.createPlayerPayload('chat', true, 'Message sent', { message }),
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
        event: 'action:result',
        payload: this.createPlayerPayload('search', true, 'You search the room and find nothing.'),
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
        event: 'action:result',
        payload: this.createPlayerPayload('rest', true, `You recover ${recovered} HP.`, {
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
        event: 'action:result',
        payload: this.createPlayerPayload('look', true, message, {
          roomId: this.roomId,
          playerCount: this.players.size,
        }),
      },
    }
  }

  createPlayerPayload(action, success, message, data = {}) {
    return {
      action,
      success,
      message,
      timestamp: new Date().toISOString(),
      data,
    }
  }

  createErrorResult(action, message) {
    return {
      success: false,
      action,
      message,
      playerEvent: {
        event: 'action:result',
        payload: this.createPlayerPayload(action, false, message),
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
