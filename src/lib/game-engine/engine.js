const { TickClock, DEFAULT_TICK_MS } = require('./tick-clock')
const { RoomState } = require('./room-state')

class GameEngine {
  constructor(io, tickMs = DEFAULT_TICK_MS) {
    this.io = io
    this.tickClock = new TickClock(tickMs)
    this.rooms = new Map()
    this.lastMetricsLoggedAt = 0
  }

  start() {
    this.tickClock.start(async (tickId) => {
      const start = performance.now()

      for (const room of this.rooms.values()) {
        await this.processRoom(room, tickId)
      }

      const elapsed = performance.now() - start
      if (tickId % 10 === 0) {
        this.maybeLogMetrics(tickId, elapsed)
      }
    })
  }

  stop() {
    this.tickClock.stop()
  }

  queueIntent({ roomId, intent }) {
    const room = this.getOrCreateRoom(roomId)
    room.queueIntent({
      ...intent,
      tickReceived: this.tickClock.getCurrentTick(),
    })
  }

  getMetrics() {
    return {
      tick: this.tickClock.getMetrics(),
      roomCount: this.rooms.size,
    }
  }

  registerPlayer(playerState) {
    const room = this.getOrCreateRoom(playerState.roomId)
    room.addPlayer(playerState)
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
  }

  async processRoom(room, tickId) {
    const facts = room.processIntents(tickId)

    if (facts.length > 0) {
      const chatFacts = facts.filter((fact) => fact.type === 'chat')
      const otherFacts = facts.filter((fact) => fact.type !== 'chat')

      if (chatFacts.length > 0) {
        this.io.emit('game:facts', {
          facts: chatFacts,
          tickId,
        })

        console.log(
          `[GameEngine] Broadcasted ${chatFacts.length} chat facts globally on tick ${tickId}`
        )
      }

      if (otherFacts.length > 0) {
        this.io.to(`room-${room.roomId}`).emit('game:facts', {
          facts: otherFacts,
          tickId,
        })

        const movementFacts = otherFacts.filter((fact) => fact.type === 'player_moved')
        movementFacts.forEach((fact) => {
          const { fromRoom, toRoom } = fact.data || {}

          if (toRoom && toRoom !== room.roomId) {
            this.io.to(`room-${toRoom}`).emit('game:facts', {
              facts: [fact],
              tickId,
            })
          }

          if (fromRoom && fromRoom !== room.roomId) {
            this.io.to(`room-${fromRoom}`).emit('game:facts', {
              facts: [fact],
              tickId,
            })
          }
        })

        console.log(
          `[GameEngine] Broadcasted ${otherFacts.length} facts for room ${room.roomId} on tick ${tickId}`
        )
      }
    }
  }

  getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new RoomState(roomId)
      this.rooms.set(roomId, room)
    }
    return room
  }

  maybeLogMetrics(tickId, elapsed) {
    const now = Date.now()
    if (now - this.lastMetricsLoggedAt < 10_000) {
      return
    }

    this.lastMetricsLoggedAt = now
    const metrics = this.tickClock.getMetrics()
    console.log(
      `[GameEngine] tick=${tickId} rooms=${this.rooms.size} tickAvg=${metrics.avgTickTime.toFixed(
        2
      )}ms p95=${metrics.p95TickTime.toFixed(2)}ms last=${elapsed.toFixed(2)}ms`
    )
  }
}

module.exports = {
  GameEngine,
}
