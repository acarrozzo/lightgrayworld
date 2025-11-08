const { TickClock, DEFAULT_TICK_MS } = require('./tick-clock')
const { RoomState } = require('./room-state')
const { NPCManager } = require('./npc-manager')
const { NPCPathfinder } = require('./npc-pathfinding')
const { NPCBrain } = require('./npc-brain')

class GameEngine {
  constructor(io, { tickMs = DEFAULT_TICK_MS, prisma } = {}) {
    this.io = io
    this.tickClock = new TickClock(tickMs)
    this.rooms = new Map()
    this.lastMetricsLoggedAt = 0

    this.prisma = prisma
    this.pathfinder = prisma ? new NPCPathfinder({ prisma }) : null
    this.npcBrain = this.pathfinder
      ? new NPCBrain({
          findPath: (fromRoom, toRoom) => this.pathfinder.findPath(fromRoom, toRoom),
        })
      : null
    this.npcManager = prisma
      ? new NPCManager({
          prisma,
          getRoomState: (roomId) => this.rooms.get(roomId),
          getCurrentTick: () => this.tickClock.getCurrentTick(),
        })
      : null
  }

  start() {
    this.tickClock.start(async (tickId) => {
      const start = performance.now()

      if (this.npcManager) {
        await this.npcManager.tick(tickId)
      }

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
    this.npcManager?.markRoomActive(playerState.roomId)
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
    this.npcManager?.markRoomActive(toRoomId)
  }

  unregisterPlayer(playerId, roomId) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(playerId)
    }
  }

  async processRoom(room, tickId) {
    const facts = await room.processIntents(tickId)

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

        const movementFacts = otherFacts.filter(
          (fact) => fact.type === 'player_moved' || fact.type === 'npc_moved'
        )
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
      room = new RoomState(roomId, {
        npcBrain: this.npcBrain,
        npcManager: this.npcManager,
        pathfinder: this.pathfinder,
        onNPCMove: (payload) => this.handleNPCMove(payload),
        onNPCDeath: (payload) => this.handleNPCDeath(payload),
        onNPCReset: (payload) => this.handleNPCReset(payload),
      })
      this.rooms.set(roomId, room)
    }
    return room
  }

  async handleNPCMove({ instanceId, npcId, fromRoom, toRoom }) {
    const targetRoom = this.getOrCreateRoom(toRoom)
    if (this.npcManager) {
      await this.npcManager.moveInstance({ instanceId, npcId, fromRoom, toRoom })
    }
    if (targetRoom) {
      this.npcManager?.markRoomActive(toRoom)
    }
  }

  async handleNPCDeath({ instanceId, npcId, roomId, loot, killerId }) {
    const config = this.npcManager?.spawnConfigs.get(npcId)
    if (config) {
      await this.npcManager?.handleDeath({ instanceId, npcId, roomId })
      await this.npcManager?.scheduleRespawn(instanceId, config)
    }

    if (this.prisma && killerId && loot) {
      const updates = {}
      if (loot.currency && loot.currency > 0) {
        updates.currency = { increment: loot.currency }
      }
      if (loot.xp && loot.xp > 0) {
        updates.xp = { increment: loot.xp }
      }
      if (Object.keys(updates).length > 0) {
        try {
          await this.prisma.user.update({
            where: { id: killerId },
            data: updates,
          })
        } catch (error) {
          console.error('[GameEngine] Failed to award loot currency/xp', error)
        }
      }

      if (Array.isArray(loot.items) && loot.items.length > 0) {
        for (const item of loot.items) {
          try {
            await this.prisma.inventoryItem.upsert({
              where: {
                userId_itemName: {
                  userId: killerId,
                  itemName: item.itemId,
                },
              },
              create: {
                userId: killerId,
                itemName: item.itemId,
                quantity: item.quantity,
              },
              update: {
                quantity: { increment: item.quantity },
              },
            })
          } catch (error) {
            console.error('[GameEngine] Failed to add loot item to inventory', error)
          }
        }
      }
    }
  }

  handleNPCReset({ roomId }) {
    this.npcManager?.markRoomActive(roomId)
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
