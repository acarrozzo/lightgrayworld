const { TickClock, WORLD_TICK_MS } = require('./tick-clock')
const { RoomState } = require('./room-state')
const { PlayerActionQueue } = require('./player-action-queue')
const { prisma } = require('../db-client')

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
    this.lastTickProfile = null
    // Cached mirror of tick state (not authoritative - use tickClock methods instead)
    this.currentWorldTickNumber = 0
    this.nextWorldTickAt = null
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
    const tickStart = performance.now()
    const tickTimestamp = Date.now()
    // Use tickClock method to get nextTickAt (derived from tickId, not tickTimestamp + tickMs)
    const nextTickAt = this.tickClock.getNextTickTimestamp()
    // Update cached mirror (not authoritative source)
    this.currentWorldTickNumber = tickId
    this.nextWorldTickAt = nextTickAt
    const roomStats = []
    let activeRooms = 0
    let roomsWithUpdates = 0

    for (const [roomId, room] of this.rooms.entries()) {
      const playerCount = room?.players?.size || 0
      if (playerCount === 0) {
        continue
      }

      activeRooms += 1
      const roomStart = performance.now()
      let update = null

      if (typeof room.getTickUpdate === 'function') {
        update = room.getTickUpdate()
      } else {
        console.warn(`[GameEngine] Room ${roomId} missing getTickUpdate, skipping ambient tick`)
      }

      const roomElapsed = performance.now() - roomStart
      roomStats.push({
        roomId,
        elapsed: roomElapsed,
        emitted: Boolean(update),
      })

      if (!update) {
        continue
      }

      roomsWithUpdates += 1
      this.io.to(`room-${roomId}`).emit('world:tick', {
        tickId,
        tickNumber: tickId,
        timestamp: tickTimestamp,
        nextTickAt,
        tickIntervalMs: this.tickClock.tickMs,
        roomId,
        update,
      })
    }

    const totalElapsed = performance.now() - tickStart
    this.lastTickProfile = {
      tickId,
      totalElapsed,
      activeRooms,
      roomsWithUpdates,
      roomStats,
    }
  }

  async processUserAction({ playerId, roomId, action }) {
    if (!playerId || !roomId || !action) {
      throw new Error('processUserAction requires playerId, roomId, and action')
    }

    const actionType = action?.type
    const isChatAction =
      actionType === 'chat' ||
      (typeof actionType === 'string' && actionType.startsWith('talk'))

    return this.playerQueue.enqueueAction(
      playerId,
      async () => {
        const room = this.getOrCreateRoom(roomId)
        // Always use TickClock methods - single source of truth
        if (!this.tickClock) {
          throw new Error('TickClock not available - cannot process action')
        }
        const currentTickNumber = this.tickClock.getCurrentTickId()
        const nextTickAt = this.tickClock.getNextTickTimestamp()

        const result = await room.executeAction(
          action,
          playerId,
          currentTickNumber,
          nextTickAt
        )

        if (!isChatAction) {
          prisma.user
            .update({ where: { id: playerId }, data: { clicks: { increment: 1 } }, select: { clicks: true } })
            .then(({ clicks }) => {
              this.emitToPlayer(playerId, 'player:clicks-update', { clicks })
            })
            .catch((err) => {
              console.error('[GameEngine] Failed to increment clicks for player', playerId, err)
            })
        }

        this.handleActionResult({ roomId, playerId, result })
        return result
      },
      {
        actionType: action?.type,
        roomId,
      }
    )
  }

  handleActionResult({ roomId, playerId, result }) {
    if (!result) {
      return
    }

    console.log(`[GameEngine] handleActionResult for player ${playerId}, action: ${result.action}`)

    if (Array.isArray(result.playerEvents)) {
      result.playerEvents.forEach(({ event, payload }) => {
        console.log(`[GameEngine] Emitting player event: ${event} to player ${playerId}`)
        this.emitToPlayer(playerId, event, payload)
      })
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
    const tickProfile =
      this.lastTickProfile || {
        totalElapsed: elapsed,
        activeRooms: 0,
        roomsWithUpdates: 0,
        roomStats: [],
      }

    const perRoomTimes = tickProfile.roomStats.map((stat) => stat.elapsed)
    const perRoomSummary =
      perRoomTimes.length > 0
        ? `roomAvg=${this.average(perRoomTimes).toFixed(2)}ms roomMax=${Math.max(...perRoomTimes).toFixed(
            2
          )}ms roomMin=${Math.min(...perRoomTimes).toFixed(2)}ms`
        : 'roomAvg=0.00ms roomMax=0.00ms roomMin=0.00ms'

    const roomDetail =
      tickProfile.roomStats.length > 0 && tickProfile.roomStats.length <= 10
        ? ` roomDetails=[${tickProfile.roomStats
            .map(
              (stat) =>
                `${stat.roomId}:${stat.elapsed.toFixed(2)}ms${stat.emitted ? '' : '(idle)'}`
            )
            .join(', ')}]`
        : tickProfile.roomStats.length > 10
        ? ` roomsLogged=${tickProfile.roomStats.length}`
        : ''

    console.log(
      `[GameEngine] tick=${tickId} rooms=${this.rooms.size} tickAvg=${tickMetrics.avgTickTime.toFixed(
        2
      )}ms p95=${tickMetrics.p95TickTime.toFixed(2)}ms last=${elapsed.toFixed(
        2
      )}ms worldTickTotal=${tickProfile.totalElapsed.toFixed(2)}ms activeRooms=${
        tickProfile.activeRooms
      } roomsWithUpdates=${tickProfile.roomsWithUpdates} ${perRoomSummary}${roomDetail} actionQueue={ enqueued=${
        queueMetrics.enqueued
      } started=${queueMetrics.started} completed=${queueMetrics.completed} timedOut=${
        queueMetrics.timedOut
      } rejected=${queueMetrics.rejected} active=${queueMetrics.activePlayers} }`
    )
  }

  average(values) {
    if (!values.length) {
      return 0
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
}

module.exports = {
  GameEngine,
}
