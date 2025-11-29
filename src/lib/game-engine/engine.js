const { TickClock, WORLD_TICK_MS } = require('./tick-clock')
const { RoomState } = require('./room-state')
const { PlayerActionQueue } = require('./player-action-queue')

class GameEngine {
  constructor(io, tickMs = WORLD_TICK_MS) {
    this.io = io
    this.tickClock = new TickClock(tickMs)
    this.rooms = new Map()
    this.playerQueue = new PlayerActionQueue({
      timeoutMs: 5000,
      maxQueueLength: 5,
    })
    this.playerSockets = new Map()
    this.lastMetricsLoggedAt = 0
  }

  start() {
    this.tickClock.start(async (tickId) => {
      const start = performance.now()

      await this.processWorldTick(tickId)

      const elapsed = performance.now() - start
      if (tickId % 10 === 0) {
        this.maybeLogMetrics(tickId, elapsed)
      }
    })
  }

  stop() {
    this.tickClock.stop()
  }

  getMetrics() {
    return {
      tick: this.tickClock.getMetrics(),
      roomCount: this.rooms.size,
      actionQueue: this.playerQueue.getMetrics(),
    }
  }

  registerPlayer(playerState) {
    const room = this.getOrCreateRoom(playerState.roomId)
    room.addPlayer(playerState)
    if (playerState.id && playerState.socketId) {
      this.playerSockets.set(playerState.id, playerState.socketId)
    }
  }

  movePlayer({ playerId, fromRoomId, toRoomId, playerState }) {
    // Intentionally keep player in the source room until movement intent resolves
    // const fromRoom = this.rooms.get(fromRoomId)
    // if (fromRoom) {
    //   fromRoom.removePlayer(playerId)
    // }

    const toRoom = this.getOrCreateRoom(toRoomId)
    if (playerState) {
      toRoom.addPlayer({ ...playerState, roomId: toRoomId })
    }
  }

  unregisterPlayer(playerId, roomId) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(playerId)
    }
    this.playerQueue.clearPlayer(playerId, { rejectPending: true })
    console.log(`[GameEngine] Player ${playerId} unregistered and action queue cleared`)
    this.playerSockets.delete(playerId)
  }

  getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new RoomState(roomId)
      this.rooms.set(roomId, room)
    }
    return room
  }

  async processWorldTick(tickId) {
    const roomStates = {}

    for (const [roomId, room] of this.rooms.entries()) {
      if (typeof room.getState === 'function') {
        roomStates[roomId] = room.getState()
      } else {
        roomStates[roomId] = { players: room.players?.size || 0 }
      }
    }

    console.log(`[GameEngine] World Tick #${tickId} - Broadcasting to all clients. Active rooms: ${this.rooms.size}`)

    this.io.emit('world:tick', {
      tickId,
      timestamp: Date.now(),
      rooms: roomStates,
    })
  }

  async processUserAction({ playerId, roomId, action }) {
    if (!playerId || !roomId || !action) {
      throw new Error('processUserAction requires playerId, roomId, and action')
    }

    return this.playerQueue.enqueueAction(
      playerId,
      async () => {
        const room = this.getOrCreateRoom(roomId)
        const result = await room.executeAction(action, playerId)

        this.handleActionResult({ roomId, playerId, result })
        return result
      },
      {
        actionType: action?.type,
        roomId,
      }
    )
  }

  queueIntent({ roomId, intent }) {
    if (!roomId || !intent) {
      throw new Error('queueIntent requires roomId and intent')
    }

    const { playerId, type, data = {} } = intent
    if (!playerId) {
      throw new Error('queueIntent requires intent.playerId')
    }
    if (!type) {
      throw new Error('queueIntent requires intent.type')
    }

    let resolvedType = type
    let resolvedData = data

    if (type === 'action') {
      resolvedType = data?.action
      if (!resolvedType) {
        throw new Error('queueIntent action intents require data.action')
      }
      resolvedData = { ...data }
    }

    const action = {
      type: resolvedType,
      data: resolvedData,
      intentId: intent.id,
      timestamp: intent.timestamp,
    }

    return this.processUserAction({
      playerId,
      roomId,
      action,
    })
  }

  handleActionResult({ roomId, playerId, result }) {
    if (!result) {
      return
    }

    console.log(`[GameEngine] handleActionResult for player ${playerId}, action: ${result.action}`)

    if (result.playerEvent) {
      console.log(`[GameEngine] Emitting player event: ${result.playerEvent.event} to player ${playerId}`)
      this.emitToPlayer(playerId, result.playerEvent.event, result.playerEvent.payload)
    }

    if (result.roomEvent) {
      console.log(`[GameEngine] Emitting room event: ${result.roomEvent.event} to room ${roomId}`)
      this.io.to(`room-${roomId}`).emit(result.roomEvent.event, result.roomEvent.payload)
    }

    if (Array.isArray(result.broadcastEvents)) {
      console.log(`[GameEngine] Broadcasting ${result.broadcastEvents.length} events`)
      result.broadcastEvents.forEach(({ event, payload, targetRoomId }) => {
        if (targetRoomId) {
          console.log(`[GameEngine] Broadcasting ${event} to room ${targetRoomId}`)
          this.io.to(`room-${targetRoomId}`).emit(event, payload)
        } else {
          console.log(`[GameEngine] Broadcasting ${event} globally`)
          this.io.emit(event, payload)
        }
      })
    }

    if (result.transfer?.toRoomId && result.transfer.playerState) {
      console.log(`[GameEngine] Transferring player ${playerId} to room ${result.transfer.toRoomId}`)
      this.transferPlayer({
        playerState: result.transfer.playerState,
        fromRoomId: result.transfer.fromRoomId || roomId,
        toRoomId: result.transfer.toRoomId,
      })
    }
  }

  emitToPlayer(playerId, event, payload) {
    const socketId = this.playerSockets.get(playerId)
    if (!socketId) {
      return
    }

    const socket = this.io.sockets.sockets.get(socketId)
    if (socket) {
      socket.emit(event, payload)
    }
  }

  transferPlayer({ playerState, fromRoomId, toRoomId }) {
    if (!playerState?.id || !toRoomId) {
      return
    }

    const fromRoom = this.rooms.get(fromRoomId)
    if (fromRoom) {
      fromRoom.removePlayer(playerState.id)
    }

    const destinationRoom = this.getOrCreateRoom(toRoomId)
    destinationRoom.addPlayer({ ...playerState, roomId: toRoomId })
  }

  maybeLogMetrics(tickId, elapsed) {
    const now = Date.now()
    if (now - this.lastMetricsLoggedAt < 10_000) {
      return
    }

    this.lastMetricsLoggedAt = now
    const tickMetrics = this.tickClock.getMetrics()
    const queueMetrics = this.playerQueue.getMetrics()
    console.log(
      `[GameEngine] tick=${tickId} rooms=${this.rooms.size} tickAvg=${tickMetrics.avgTickTime.toFixed(
        2
      )}ms p95=${tickMetrics.p95TickTime.toFixed(2)}ms last=${elapsed.toFixed(
        2
      )}ms actionQueue={ enqueued=${queueMetrics.enqueued} started=${
        queueMetrics.started
      } completed=${queueMetrics.completed} timedOut=${queueMetrics.timedOut} rejected=${
        queueMetrics.rejected
      } active=${queueMetrics.activePlayers} }`
    )
  }
}

module.exports = {
  GameEngine,
}
