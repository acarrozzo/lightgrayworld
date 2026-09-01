const { TickClock, WORLD_TICK_MS } = require('./tick-clock')
const { RoomState } = require('./room-state')
const { PlayerActionQueue } = require('./player-action-queue')
const { prisma } = require('../db-client')
const { topUpRoomEnemyGroup } = require('../game-data/room-enemies')
const { updatePresence } = require('../services/presence-store')

class GameEngine {
  constructor(io, tickMs = WORLD_TICK_MS) {
    this.io = io
    this.tickClock = new TickClock(tickMs)
    this.rooms = new Map()
    this.playerQueue = new PlayerActionQueue({
      maxQueueLength: 5,
    })
    // playerId -> Set<socketId>. One account can hold several connections (a
    // second tab), and each of them should receive that player's events. This
    // was a single socketId, so a second login silently redirected every battle,
    // inventory and level-up event to whichever tab connected last.
    this.playerSockets = new Map()
    // Map<playerId, Map<roomId, enemySlug>> — enemies waiting for a player when they return to a room.
    // Populated on room exit, consumed on room entry, cleared on disconnect.
    this.persistedEnemies = new Map()
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
      if (!this.playerSockets.has(playerState.id)) {
        this.playerSockets.set(playerState.id, new Set())
      }
      this.playerSockets.get(playerState.id).add(playerState.socketId)
    }
  }

  /**
   * Drop one connection without tearing down the player's session — the second
   * tab closing while the first is still open.
   */
  unregisterSocket(playerId, socketId) {
    const sockets = this.playerSockets.get(playerId)
    if (!sockets) {
      return
    }
    sockets.delete(socketId)
    if (sockets.size === 0) {
      this.playerSockets.delete(playerId)
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
    this.persistedEnemies.delete(playerId)
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
          this.applyClickTick(playerId, roomId).catch((err) => {
            console.error('[GameEngine] Failed to apply click tick for player', playerId, err)
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

  /**
   * Everything that advances once per counted action, in one place.
   *
   * The original game measured temporary effects in clicks rather than seconds
   * ("fly for 100 clicks", "+5 hp / click"), so the click counter is also the
   * clock for buff countdowns and gear regen. Chat is excluded upstream, the
   * same exclusion the click counter has always used.
   *
   * Runs off the action's critical path (fire-and-forget from
   * processUserAction) — a slow regen write must never delay the action
   * result the player is waiting on.
   */
  async applyClickTick(playerId, roomId) {
    const { tickBuffs, BUFF_LABELS } = require('./services/buff-service')
    const { getEquippedRegen, applyRegenTick } = require('./services/regen-service')

    const [{ clicks }, { buffs, expired }, regen] = await Promise.all([
      prisma.user.update({
        where: { id: playerId },
        data: { clicks: { increment: 1 } },
        select: { clicks: true },
      }),
      tickBuffs(prisma, playerId),
      getEquippedRegen(playerId),
    ])

    const vitals = await applyRegenTick(playerId, regen)

    // One event carries the whole tick to the acting player: the click count,
    // the buff countdowns, and the regenerated vitals when gear moved them.
    this.emitToPlayer(playerId, 'player:clicks-update', {
      clicks,
      buffs,
      ...(vitals || {}),
    })

    if (vitals) {
      // Keep the room panel and the global roster's HP/MP bars live for everyone
      // else too — same path a battle turn's vitals take.
      const room = this.rooms.get(roomId)
      room?.updatePlayer?.(playerId, (state) => ({ ...state, hp: vitals.hp, mp: vitals.mp }))
      if (this.io) {
        this.io.to(`room-${roomId}`).emit('player-vitals', { id: playerId, roomId, ...vitals })
        updatePresence(this.io, playerId, { hp: vitals.hp, mp: vitals.mp })
      }
    }

    // Tell the player the moment an effect runs out — a wings potion lapsing
    // mid-sewer is the difference between crossing the river and not.
    for (const field of expired) {
      this.emitToPlayer(playerId, 'action:feedback', {
        action: 'buff expired',
        message: `Your ${BUFF_LABELS[field] || field} effect has worn off.`,
        outcome: 'info',
        ts: Date.now(),
        timestamp: new Date().toISOString(),
        success: true,
        data: { buffs },
      })
    }
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

      // Mirror battle lifecycle to the rest of the room so other players can show an
      // "in battle" tag. A terminal event (victory/defeat/fled) wins over 'battle:started'
      // for the 1-turn-kill case where both fire in the same result.
      const events = result.playerEvents.map((e) => e.event)
      const enteredBattle = events.includes('battle:started')
      const leftBattle =
        events.includes('battle:victory') ||
        events.includes('battle:defeat') ||
        events.includes('battle:fled')
      if (enteredBattle || leftBattle) {
        const inBattle = enteredBattle && !leftBattle
        this.io
          .to(`room-${roomId}`)
          .emit('player-battle-status', { id: playerId, roomId, inBattle })
        // Same fact, global audience: the Players tab shows an "In Battle" tag for
        // anyone in the world, not just people standing in the same room.
        updatePresence(this.io, playerId, { inBattle })
      }

      // Mirror the player's vitals to the room so other players' HP/MP bars stay live
      // whenever they change — battle damage, rest, healing springs, consumables, etc.
      // HP/MP land in different shapes by handler: battle puts them at the payload top
      // level (playerHp/playerHpMax/...), while rest and item handlers nest them in
      // payload.data (hp/hpMax/mp/mpMax). Merge the latest value of each field seen
      // across this action's events so the broadcast reflects the final state.
      let latestVitals = null
      const pick = (top, nested) => (typeof top === 'number' ? top : typeof nested === 'number' ? nested : undefined)
      for (const { payload } of result.playerEvents) {
        if (!payload) continue
        const d = payload.data || {}
        const hp = pick(payload.playerHp, d.hp)
        const hpMax = pick(payload.playerHpMax, d.hpMax)
        const mp = pick(payload.playerMp, d.mp)
        const mpMax = pick(payload.playerMpMax, d.mpMax)
        if (hp === undefined && hpMax === undefined && mp === undefined && mpMax === undefined) continue
        if (!latestVitals) latestVitals = { id: playerId, roomId }
        if (hp !== undefined) latestVitals.hp = hp
        if (hpMax !== undefined) latestVitals.hpMax = hpMax
        if (mp !== undefined) latestVitals.mp = mp
        if (mpMax !== undefined) latestVitals.mpMax = mpMax
      }
      if (latestVitals) {
        this.io.to(`room-${roomId}`).emit('player-vitals', latestVitals)
        // Keep the global roster's HP/MP bars live as well. updatePresence no-ops
        // when nothing actually changed, so this does not add a broadcast per action.
        updatePresence(this.io, playerId, {
          hp: latestVitals.hp,
          hpMax: latestVitals.hpMax,
          mp: latestVitals.mp,
          mpMax: latestVitals.mpMax,
        })
      }
    }

    if (result.backgroundWork) {
      result.backgroundWork
        .then((extraEvents) => {
          ;(extraEvents ?? []).forEach(({ event, payload }) => {
            console.log(`[GameEngine] Emitting deferred event: ${event} to player ${playerId}`)
            this.emitToPlayer(playerId, event, payload)
          })
        })
        // Producers are expected to handle their own failures and return events
        // describing them, but the engine must not depend on every future one
        // remembering: an unhandled rejection here is fatal to the process.
        .catch((error) => {
          console.error(`[GameEngine] backgroundWork failed for player ${playerId}:`, error)
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
        fromRoomEnemyRoster: result.transfer.fromRoomEnemyRoster,
      })
    }
  }

  emitToPlayer(playerId, event, payload) {
    const sockets = this.playerSockets.get(playerId)
    if (!sockets) {
      return
    }

    for (const socketId of [...sockets]) {
      const socket = this.io.sockets.sockets.get(socketId)
      if (socket) {
        socket.emit(event, payload)
      } else {
        // The connection is gone but disconnect bookkeeping never ran for it.
        sockets.delete(socketId)
      }
    }

    if (sockets.size === 0) {
      this.playerSockets.delete(playerId)
    }
  }

  transferPlayer({ playerState, fromRoomId, toRoomId, fromRoomEnemyRoster }) {
    if (!playerState?.id || !toRoomId) {
      return
    }

    // Persist the full enemy roster the player leaves behind, so returning to the
    // room restores the same wave instead of rolling a fresh one.
    if (Array.isArray(fromRoomEnemyRoster) && fromRoomEnemyRoster.length) {
      if (!this.persistedEnemies.has(playerState.id)) {
        this.persistedEnemies.set(playerState.id, new Map())
      }
      this.persistedEnemies.get(playerState.id).set(fromRoomId, fromRoomEnemyRoster)
    }

    const fromRoom = this.rooms.get(fromRoomId)
    if (fromRoom) {
      fromRoom.removePlayer(playerState.id)
    }

    const destinationRoom = this.getOrCreateRoom(toRoomId)
    destinationRoom.addPlayer({ ...playerState, roomId: toRoomId })

    const persistedRoster = this.persistedEnemies.get(playerState.id)?.get(toRoomId)
    if (persistedRoster) {
      // On re-entry, refill a partial leftover roster back toward the room's wave
      // size (gated by spawnChance), re-adding any missing guaranteed enemies.
      const refilledRoster = topUpRoomEnemyGroup(toRoomId, persistedRoster)
      destinationRoom.setPlayerEnemyRoster(playerState.id, refilledRoster)
      this.persistedEnemies.get(playerState.id).delete(toRoomId)
    }
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
