const { PrismaClient } = require('@prisma/client')
const {
  setNPCState,
  getNPCState,
  deleteNPCState,
  getActiveNPCs,
  setSpawnTimer,
  getSpawnTimer,
  addNPCToRoom,
  removeNPCFromRoom,
} = require('../redis')

const DEFAULT_RESPAWN_SECONDS = 60
const DEFAULT_LEASH_DISTANCE = 6
const DEFAULT_LEASH_TIME_MS = 20_000

/**
 * @typedef {import('@prisma/client').NPC & { definition?: import('@prisma/client').NPCDefinition | null }} NPCSpawnRow
 */

/**
 * @typedef {Object} NPCSpawnConfig
 * @property {string} npcId
 * @property {string} roomId
 * @property {string} roomKey
 * @property {number} maxAlive
 * @property {number} spawnWeight
 * @property {boolean} persistent
 * @property {number} respawnSeconds
 * @property {number} leashDistance
 * @property {number} leashTimeMs
 * @property {Record<string, any>} stats
 * @property {Record<string, any> | null} questHooks
 * @property {Record<string, any> | null} vendorCatalog
 * @property {Record<string, any> | null} lootTable
 * @property {Record<string, any>} metadata
 * @property {NPCSpawnRow} raw
 */

class NPCManager {
  /**
   * @param {object} options
   * @param {PrismaClient} options.prisma
   * @param {(roomId: string) => import('./room-state').RoomState | undefined} options.getRoomState
   * @param {() => number} options.getCurrentTick
   */
  constructor({ prisma, getRoomState, getCurrentTick }) {
    this.prisma = prisma
    this.getRoomState = getRoomState
    this.getCurrentTick = getCurrentTick

    /** @type {Map<string, NPCSpawnConfig>} */
    this.spawnConfigs = new Map()

    /** @type {Map<string, Map<string, any>>} */
    this.activeInstances = new Map()

    /** @type {Map<string, { config: NPCSpawnConfig, instance: import('@prisma/client').NPCInstance, metadata: Record<string, any> }>} */
    this.instancesById = new Map()

    /** @type {Set<string>} */
    this.frozenInstances = new Set()

    /** @type {Map<string, number>} */
    this.roomLastActive = new Map()

    /** @type {Set<string>} */
    this.sleepingRooms = new Set()

    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return
    const npcRows = await this.prisma.nPC.findMany({
      include: {
        definition: true,
        room: true,
      },
    })

    npcRows.forEach((row) => this.registerSpawn(row))
    this.initialized = true
  }

  /**
   * @param {NPCSpawnRow & { room: import('@prisma/client').Room }} row
   */
  registerSpawn(row) {
    const stats = this.resolveStats(row)
    const respawnSeconds = this.resolveRespawnSeconds(row)
    const leashConfig = this.resolveLeash(row)
    const mobilityMode = row.mobility || row.definition?.mobility || 'STATIONARY'
    const mobilityConfig = row.mobilityPath || row.definition?.mobilityConfig || {}
    const metadata = {
      mobility: mobilityMode,
      patrolPath: mobilityConfig.patrolPath || mobilityConfig.path || [],
      wanderRooms: mobilityConfig.wanderRooms || mobilityConfig.rooms || [],
      dwellTicks: mobilityConfig.dwellTicks || mobilityConfig.dwell || null,
      services: row.definition?.services || [],
      barks: extractBarks(row),
      dialogueTree: row.dialogueTree || row.definition?.dialogueTree || null,
      questHooks: row.questHooks || row.definition?.questHooks || null,
      vendorCatalog: row.vendorCatalog || row.definition?.vendorCatalog || null,
    }

    const config = {
      npcId: row.id,
      roomId: row.roomId,
      roomKey: row.room.roomId,
      maxAlive: row.maxAlive || 1,
      spawnWeight: row.spawnWeight || 1,
      persistent: row.persistent || false,
      respawnSeconds,
      leashDistance: leashConfig.distance,
      leashTimeMs: leashConfig.timeMs,
      stats,
      questHooks: row.questHooks,
      vendorCatalog: row.vendorCatalog,
      lootTable: row.lootTable,
      metadata,
      raw: row,
    }

    this.spawnConfigs.set(row.id, config)
    if (!this.activeInstances.has(row.id)) {
      this.activeInstances.set(row.id, new Map())
    }
  }

  /**
   * Called when a player enters a room.
   * @param {string} roomId
   */
  markRoomActive(roomId) {
    this.roomLastActive.set(roomId, Date.now())
    this.sleepingRooms.delete(roomId)
  }

  /**
   * Called when a player leaves a room.
   * @param {string} roomId
   * @param {boolean} hasPlayers
   */
  markRoomInactive(roomId, hasPlayers) {
    if (hasPlayers) {
      this.markRoomActive(roomId)
      return
    }
    this.roomLastActive.set(roomId, Date.now())
    this.sleepingRooms.add(roomId)
  }

  /**
   * Called by the engine each tick.
   * @param {number} tickId
   */
  async tick(tickId) {
    if (!this.initialized) {
      await this.initialize()
    }

    const now = Date.now()

    for (const config of this.spawnConfigs.values()) {
      const roomState = this.getRoomState(config.roomKey)
      if (!roomState) continue

      const isSleeping = this.sleepingRooms.has(config.roomKey)
      if (isSleeping && !config.persistent) {
        continue
      }

      const instances = this.activeInstances.get(config.npcId)
      const aliveCount = instances ? instances.size : 0

      if (aliveCount < config.maxAlive) {
        const spawnDue = await this.isSpawnDue(config, now)
        if (spawnDue) {
          await this.spawnNPC({ config, tickId })
          continue
        }
      }
    }
  }

  /**
   * @param {NPCSpawnConfig} config
   * @param {number} now
   */
  async isSpawnDue(config, now) {
    const timer = await getSpawnTimer(config.roomKey)
    if (!timer) {
      return true
    }
    return timer.respawnAt <= now
  }

  /**
   * @param {{ config: NPCSpawnConfig, tickId: number }} params
   */
  async spawnNPC({ config, tickId }) {
    const definition = config.raw.definition
    const roomState = this.getRoomState(config.roomKey)

    if (!roomState) {
      return
    }

    const stats = config.stats
    const hpMax = stats.hpMax || stats.hp || 1
    const hp = hpMax
    const metadata = {
      spawnRoom: config.roomKey,
      homeRoom: config.raw.homeRoom || config.roomKey,
      leashDistance: config.leashDistance ?? DEFAULT_LEASH_DISTANCE,
      leashTimeMs: config.leashTimeMs ?? DEFAULT_LEASH_TIME_MS,
      mobility: config.metadata.mobility,
      patrolPath: config.metadata.patrolPath,
      wanderRooms: config.metadata.wanderRooms,
      dwellTicks: config.metadata.dwellTicks,
      services: config.metadata.services,
      barks: config.metadata.barks,
      questHooks: config.metadata.questHooks,
      vendorCatalog: config.metadata.vendorCatalog,
      dialogueTree: config.metadata.dialogueTree,
      mobilityConfig: config.metadata,
    }
    const statePayload = {
      instanceId: '',
      npcId: config.npcId,
      definitionId: definition?.id || null,
      currentRoom: config.roomKey,
      state: 'IDLE',
      hp,
      hpMax,
      targetId: null,
      lastTargetId: null,
      threat: [],
      cooldowns: {},
      nextActionTick: tickId + 2,
      path: [],
      metadata,
      lastUpdated: Date.now(),
    }

    const created = await this.prisma.nPCInstance.create({
      data: {
        npcId: config.npcId,
        definitionId: definition?.id || null,
        spawnKey: 'default',
        currentRoom: config.roomKey,
        hp,
        hpMax,
        state: 'IDLE',
      },
    })

    statePayload.instanceId = created.id
    await setNPCState(statePayload)
    await addNPCToRoom(config.roomKey, created.id)

    roomState.addNPC({
      instanceId: created.id,
      npcId: config.npcId,
      name: config.raw.name,
      disposition: config.raw.disposition,
      canBeAttacked: config.raw.canBeAttacked,
      roomId: config.roomKey,
      stats,
      state: 'IDLE',
      hp,
      hpMax,
      cooldowns: {},
      threat: [],
      metadata,
    })

    const instances = this.activeInstances.get(config.npcId)
    if (instances) {
      instances.set(created.id, {
        instance: created,
        lastSpawnedAt: Date.now(),
        metadata,
      })
    }
    this.instancesById.set(created.id, {
      config,
      instance: created,
      metadata,
    })

    return created.id
  }

  /**
   * @param {{ instanceId: string, npcId: string, fromRoom: string, toRoom: string }} params
   */
  async moveInstance({ instanceId, npcId, fromRoom, toRoom }) {
    const entry = this.instancesById.get(instanceId)
    const config = entry?.config || this.spawnConfigs.get(npcId)
    if (!config) return

    const runtime = await getNPCState(instanceId)
    if (!runtime) return

    const fromRoomState = this.getRoomState(fromRoom)
    if (fromRoomState) {
      fromRoomState.removeNPC(instanceId)
    }

    runtime.currentRoom = toRoom
    runtime.metadata = {
      ...(runtime.metadata || {}),
      currentRoom: toRoom,
    }

    await setNPCState(runtime)
    await removeNPCFromRoom(fromRoom, instanceId)
    await addNPCToRoom(toRoom, instanceId)

    const toRoomState = this.getRoomState(toRoom)
    if (toRoomState) {
      const metadata = {
        ...(entry?.metadata || config.metadata || {}),
        homeRoom: runtime.metadata?.homeRoom || config.raw.homeRoom || config.roomKey,
        leashDistance: runtime.metadata?.leashDistance ?? config.leashDistance,
        leashTimeMs: runtime.metadata?.leashTimeMs ?? config.leashTimeMs,
      }

      toRoomState.addNPC({
        instanceId,
        npcId,
        name: config.raw.name,
        disposition: config.raw.disposition,
        canBeAttacked: config.raw.canBeAttacked,
        roomId: toRoom,
        stats: config.stats,
        state: runtime.state || 'IDLE',
        hp: runtime.hp,
        hpMax: runtime.hpMax,
        cooldowns: runtime.cooldowns || {},
        threat: runtime.threat || [],
        metadata,
      })
    }

    const instances = this.activeInstances.get(npcId)
    if (instances && instances.has(instanceId)) {
      const instanceInfo = instances.get(instanceId)
      if (instanceInfo) {
        instanceInfo.instance.currentRoom = toRoom
      }
    }

    if (entry) {
      entry.instance.currentRoom = toRoom
      entry.metadata = {
        ...(entry.metadata || {}),
        homeRoom: runtime.metadata?.homeRoom || entry.metadata?.homeRoom || config.raw.homeRoom || config.roomKey,
      }
    }
    this.markRoomActive(toRoom)

    return runtime
  }

  /**
   * @param {object} npcState
   * @param {string} roomId
   */
  async updateRuntimeState(npcState, roomId) {
    const payload = {
      instanceId: npcState.instanceId,
      npcId: npcState.npcId,
      definitionId: npcState.definitionId || null,
      currentRoom: roomId,
      state: npcState.state,
      hp: npcState.hp,
      hpMax: npcState.hpMax,
      targetId: npcState.targetId || null,
      threat: npcState.threat || [],
      cooldowns: npcState.cooldowns || {},
      nextActionTick: npcState.nextActionTick || 0,
      path: npcState.path || [],
      metadata: npcState.metadata || {},
      lastUpdated: Date.now(),
    }

    await setNPCState(payload)
    const entry = this.instancesById.get(payload.instanceId)
    if (entry) {
      entry.metadata = {
        ...(entry.metadata || {}),
        ...payload.metadata,
      }
    }
  }

  /**
   * @param {{ instanceId: string, npcId: string, roomId: string }} params
   */
  async handleDeath({ instanceId, npcId, roomId }) {
    await deleteNPCState(instanceId)
    await removeNPCFromRoom(roomId, instanceId)

    const instances = this.activeInstances.get(npcId)
    if (instances) {
      instances.delete(instanceId)
    }
    this.instancesById.delete(instanceId)
    this.frozenInstances.delete(instanceId)

    await this.prisma.nPCInstance
      .update({
        where: { id: instanceId },
        data: {
          isSpawned: false,
          lastDespawnedAt: new Date(),
          currentRoom: roomId,
        },
      })
      .catch(() => {})
  }

  /**
   * Called when an NPC dies to schedule respawn.
   * @param {string} instanceId
   * @param {NPCSpawnConfig} config
   */
  async scheduleRespawn(instanceId, config) {
    const jitter = config.respawnSeconds * 0.1
    const delaySeconds = config.respawnSeconds + randomBetween(-jitter, jitter)
    const respawnAt = Date.now() + Math.max(5, Math.floor(delaySeconds * 1000))

    await setSpawnTimer(config.roomKey, {
      npcId: config.npcId,
      instanceId,
      respawnAt,
    })
  }

  async getRuntimeSnapshot(instanceId) {
    const runtime = await getNPCState(instanceId)
    if (!runtime) {
      return null
    }
    const config = this.spawnConfigs.get(runtime.npcId) || null
    const entry = this.instancesById.get(instanceId) || null
    return {
      runtime,
      config,
      npc: config?.raw || null,
      entry,
    }
  }

  async listRuntimeStates(filters = {}) {
    await this.initialize()

    let instanceIds = []
    if (filters.instanceId) {
      instanceIds = [filters.instanceId]
    } else if (filters.roomId) {
      instanceIds = await getActiveNPCs(filters.roomId)
    } else {
      instanceIds = await getActiveNPCs()
    }

    const results = []
    for (const instanceId of instanceIds) {
      const snapshot = await this.getRuntimeSnapshot(instanceId)
      if (!snapshot) continue

      const { runtime, config, npc } = snapshot
      if (filters.npcId && runtime.npcId !== filters.npcId) continue
      if (filters.definitionId && runtime.definitionId !== filters.definitionId) continue
      if (filters.state && runtime.state !== filters.state) continue

      results.push({
        instanceId: runtime.instanceId,
        runtime,
        config,
        npc,
      })
    }

    return results
  }

  async forceSpawn(npcId) {
    await this.initialize()
    const config = this.spawnConfigs.get(npcId)
    if (!config) {
      throw new Error(`NPC config not found for ${npcId}`)
    }
    const instanceId = await this.spawnNPC({
      config,
      tickId: this.getCurrentTick(),
    })
    return instanceId
  }

  async despawnInstance(instanceId, { scheduleRespawn = false } = {}) {
    const snapshot = await this.getRuntimeSnapshot(instanceId)
    if (!snapshot) {
      return { removed: false }
    }

    const { runtime, config } = snapshot
    const npcId = runtime.npcId
    const roomId = runtime.currentRoom

    const roomState = this.getRoomState(roomId)
    if (roomState) {
      roomState.removeNPC(instanceId)
    }

    await this.handleDeath({ instanceId, npcId, roomId })

    if (scheduleRespawn && config) {
      await this.scheduleRespawn(instanceId, config)
    }

    return {
      removed: true,
      npcId,
      roomId,
    }
  }

  async setFrozen(instanceId, frozen = true) {
    const snapshot = await this.getRuntimeSnapshot(instanceId)
    if (!snapshot) {
      throw new Error(`NPC instance ${instanceId} not found`)
    }

    const { runtime } = snapshot
    const roomState = this.getRoomState(runtime.currentRoom)
    if (!roomState) {
      throw new Error(`Room state ${runtime.currentRoom} not available`)
    }

    roomState.updateNPC(instanceId, (npc) => ({
      ...npc,
      metadata: {
        ...(npc.metadata || {}),
        frozen,
      },
    }))

    runtime.metadata = {
      ...(runtime.metadata || {}),
      frozen,
    }

    if (frozen) {
      this.frozenInstances.add(instanceId)
    } else {
      this.frozenInstances.delete(instanceId)
    }

    const entry = this.instancesById.get(instanceId)
    if (entry) {
      entry.metadata = {
        ...(entry.metadata || {}),
        frozen,
      }
    }

    await setNPCState(runtime)
  }

  async forceReturnHome(instanceId) {
    const snapshot = await this.getRuntimeSnapshot(instanceId)
    if (!snapshot) {
      throw new Error(`NPC instance ${instanceId} not found`)
    }
    const { runtime, config } = snapshot
    const roomState = this.getRoomState(runtime.currentRoom)
    if (!roomState) {
      throw new Error(`Room state ${runtime.currentRoom} not available`)
    }

    const nextTick = this.getCurrentTick()

    roomState.updateNPC(instanceId, (npc) => ({
      ...npc,
      state: 'RETURN_HOME',
      targetId: null,
      nextActionTick: nextTick,
      metadata: {
        ...(npc.metadata || {}),
        engagedAt: null,
      },
    }))

    runtime.state = 'RETURN_HOME'
    runtime.targetId = null
    runtime.nextActionTick = nextTick
    runtime.metadata = {
      ...(runtime.metadata || {}),
      engagedAt: null,
    }

    if (config) {
      runtime.metadata.homeRoom = runtime.metadata.homeRoom || config.raw.homeRoom || config.roomKey
    }

    await setNPCState(runtime)
  }

  async moveInstanceTo(instanceId, toRoomId) {
    const snapshot = await this.getRuntimeSnapshot(instanceId)
    if (!snapshot) {
      throw new Error(`NPC instance ${instanceId} not found`)
    }
    const { runtime } = snapshot
    const fromRoom = runtime.currentRoom
    if (fromRoom === toRoomId) {
      return {
        fromRoom,
        toRoom: toRoomId,
        unchanged: true,
      }
    }

    await this.moveInstance({
      instanceId,
      npcId: runtime.npcId,
      fromRoom,
      toRoom: toRoomId,
    })

    return {
      fromRoom,
      toRoom: toRoomId,
      unchanged: false,
    }
  }

  getSpawnConfigsSummary() {
    return Array.from(this.spawnConfigs.values()).map((config) => ({
      npcId: config.npcId,
      name: config.raw.name,
      description: config.raw.description,
      disposition: config.raw.disposition,
      canBeAttacked: config.raw.canBeAttacked,
      roomId: config.roomKey,
      persistent: config.persistent,
      maxAlive: config.maxAlive,
      services: config.metadata.services || [],
    }))
  }

  /**
   * @param {NPCSpawnRow} row
   */
  resolveStats(row) {
    if (row.stats) {
      return row.stats
    }
    if (row.definition?.stats) {
      return row.definition.stats
    }
    return {
      hp: 30,
      hpMax: 30,
      damage: { min: 2, max: 4 },
      defense: 0,
      attackSpeedTicks: 10,
    }
  }

  /**
   * @param {NPCSpawnRow} row
   */
  resolveRespawnSeconds(row) {
    if (row.respawnSeconds) return row.respawnSeconds
    if (row.definition?.respawnSeconds) return row.definition.respawnSeconds
    return DEFAULT_RESPAWN_SECONDS
  }

  /**
   * @param {NPCSpawnRow} row
   */
  resolveLeash(row) {
    if (row.leashDistance && row.leashTimeMs) {
      return { distance: row.leashDistance, timeMs: row.leashTimeMs }
    }
    if (row.definition) {
      return {
        distance: row.definition.leashDistance ?? DEFAULT_LEASH_DISTANCE,
        timeMs: row.definition.leashTimeMs ?? DEFAULT_LEASH_TIME_MS,
      }
    }
    return {
      distance: DEFAULT_LEASH_DISTANCE,
      timeMs: DEFAULT_LEASH_TIME_MS,
    }
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function extractBarks(row) {
  const fromNpc = Array.isArray(row.dialogueTree?.barks) ? row.dialogueTree.barks : null
  const fromDefinition = Array.isArray(row.definition?.dialogueTree?.barks)
    ? row.definition.dialogueTree.barks
    : null
  return fromNpc || fromDefinition || []
}

module.exports = {
  NPCManager,
}

