const DEFAULT_LEASH_DISTANCE = 6
const DEFAULT_LEASH_TIME_MS = 20_000
const BARK_COOLDOWN_MS = 10_000
const ROOM_BARK_COOLDOWN_MS = 30_000
const PLAYER_ATTACK_COOLDOWN_TICKS = 8
const THREAT_DECAY_PER_SECOND = 5

class RoomState {
  constructor(
    roomId,
    {
      npcBrain = null,
      npcManager = null,
      pathfinder = null,
      onNPCMove = async () => {},
      onNPCDeath = async () => {},
      onNPCReset = async () => {},
      getRoomMeta = () => ({ roomId }),
    } = {}
  ) {
    this.roomId = roomId
    this.intents = []
    this.facts = []
    this.factSeq = 0

    this.players = new Map()
    this.npcs = new Map()

    this.npcBrain = npcBrain
    this.npcManager = npcManager
    this.pathfinder = pathfinder
    this.onNPCMove = onNPCMove
    this.onNPCDeath = onNPCDeath
    this.onNPCReset = onNPCReset
    this.getRoomMeta = getRoomMeta

    this.npcBarkTimestamps = new Map()
    this.roomLastBarkAt = 0
    this.playerCooldowns = new Map()
  }

  addPlayer(playerState) {
    this.players.set(playerState.id, playerState)
    this.npcManager?.markRoomActive(this.roomId)
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
    this.npcManager?.markRoomInactive(this.roomId, this.players.size > 0)
  }

  updatePlayer(playerId, updater) {
    const player = this.players.get(playerId)
    if (!player) return
    const updated = updater({ ...player })
    this.players.set(playerId, updated)
  }

  getPlayerIds() {
    return Array.from(this.players.keys())
  }

  getPlayerSnapshots() {
    return Array.from(this.players.values()).map((player) => ({
      id: player.id,
      username: player.username,
      roomId: this.roomId,
      hp: player.hp,
      hpMax: player.hpMax,
      level: player.level ?? 1,
    }))
  }

  queueIntent(intent) {
    this.intents.push(intent)
  }

  async processIntents(currentTick) {
    const { ready, pending } = this.partitionIntents(currentTick)
    this.replaceIntents(pending)

    const deduped = this.deduplicateIntents(ready)
    const ordered = this.orderIntents(deduped)

    const producedFacts = []

    for (const intent of ordered) {
      const facts = await this.resolveIntent(intent, currentTick)
      if (facts.length > 0) {
        facts.forEach((fact) => this.recordFact(fact))
        producedFacts.push(...facts)
      }
    }

    const npcFacts = await this.processNPCs(currentTick)
    if (npcFacts.length > 0) {
      npcFacts.forEach((fact) => this.recordFact(fact))
      producedFacts.push(...npcFacts)
    }

    return producedFacts
  }

  getFactsSince(seq) {
    return this.facts.filter((fact) => fact.seq > seq)
  }

  partitionIntents(currentTick) {
    const ready = []
    const pending = []

    for (const intent of this.intents) {
      if (intent.tickReceived <= currentTick) {
        ready.push(intent)
      } else {
        pending.push(intent)
      }
    }

    return { ready, pending }
  }

  replaceIntents(nextList) {
    this.intents.length = 0
    this.intents.push(...nextList)
  }

  deduplicateIntents(intents) {
    const deduped = new Map()
    intents.forEach((intent) => deduped.set(intent.id, intent))
    return Array.from(deduped.values())
  }

  orderIntents(intents) {
    return intents.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
      return a.playerId.localeCompare(b.playerId)
    })
  }

  async resolveIntent(intent, tickId) {
    switch (intent.type) {
      case 'move':
        return this.resolveMove(intent, tickId)
      case 'chat':
        return this.resolveChat(intent, tickId)
      case 'attack':
        return await this.resolveAttack(intent, tickId)
      case 'use_item':
        return this.resolveUseItem(intent, tickId)
      case 'look':
        return this.resolveLook(intent, tickId)
      case 'action':
        return this.resolveGenericAction(intent, tickId)
      default:
        console.warn(`[RoomState:${this.roomId}] Unknown intent type`, intent)
        return []
    }
  }

  resolveMove(intent, tickId) {
    const player = this.players.get(intent.playerId)
    if (!player) {
      return []
    }

    const fact = this.createFact({
      tickId,
      type: 'player_moved',
      data: {
        playerId: intent.playerId,
        username: player.username,
        fromRoom: intent.data.fromRoom,
        toRoom: intent.data.toRoom,
      },
      affectedPlayers: [intent.playerId],
    })

    this.removePlayer(intent.playerId)

    return [fact]
  }

  resolveChat(intent, tickId) {
    const player = this.players.get(intent.playerId)
    const username = player?.username ?? 'Unknown'
    const level = player?.level ?? 0

    return [
      this.createFact({
        tickId,
        type: 'chat',
        data: {
          playerId: intent.playerId,
          message: intent.data.message,
          username,
          level,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  async resolveAttack(intent, tickId) {
    const player = this.players.get(intent.playerId)

    if (!player) {
      return []
    }

    const targetId = intent.data.targetId || null
    if (targetId && this.npcs.has(targetId)) {
      const npc = this.npcs.get(targetId)
      if (npc) {
        return this.handlePlayerAttack(player, npc, tickId)
      }
    }

    return [
      this.createFact({
        tickId,
        type: 'attack_intent',
        data: {
          playerId: intent.playerId,
          username: player?.username || intent.playerId,
          targetId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  async handlePlayerAttack(player, npc, tickId) {
    const facts = []
    const now = Date.now()
    const cooldownUntil = this.playerCooldowns.get(player.id) || 0
    if (tickId < cooldownUntil) {
      return facts
    }
    this.playerCooldowns.set(player.id, tickId + PLAYER_ATTACK_COOLDOWN_TICKS)

    facts.push(
      this.createFact({
        tickId,
        type: 'attack_intent',
        data: {
          playerId: player.id,
          username: player.username,
          targetId: npc.instanceId,
        },
        affectedPlayers: this.getPlayerIds(),
      })
    )

    if (!npc.canBeAttacked) {
      facts.push(
        this.createFact({
          tickId,
          type: 'npc_invulnerable',
          data: {
            instanceId: npc.instanceId,
            npcId: npc.npcId,
            name: npc.name,
          },
          affectedPlayers: [player.id],
        })
      )
      return facts
    }

    this.decayThreat(npc, now)
    this.applyThreat(npc, player.id, 25, now)

    const damage = this.calculatePlayerDamage(player, npc)
    npc.hp = Math.max(0, npc.hp - damage)

    facts.push(
      this.createFact({
        tickId,
        type: 'npc_damaged',
        data: {
          instanceId: npc.instanceId,
          npcId: npc.npcId,
          name: npc.name,
          attackerId: player.id,
          damage,
          hpRemaining: npc.hp,
        },
        affectedPlayers: this.getPlayerIds(),
      })
    )

    if (npc.hp <= 0) {
      const deathFacts = await this.handleNPCDeath(npc, player.id, tickId)
      facts.push(...deathFacts)
    } else {
      await this.syncNPCState(npc)
    }

    return facts
  }

  decayThreat(npc, now) {
    if (!npc.threat || npc.threat.length === 0) return
    const decayPerMs = THREAT_DECAY_PER_SECOND / 1000
    npc.threat = npc.threat
      .map((entry) => {
        const elapsed = Math.max(0, now - entry.lastUpdated)
        const decayAmount = decayPerMs * elapsed
        const nextThreat = Math.max(0, entry.threat - decayAmount)
        return {
          playerId: entry.playerId,
          threat: nextThreat,
          lastUpdated: now,
        }
      })
      .filter((entry) => entry.threat > 0.01)
  }

  applyThreat(npc, playerId, amount, now) {
    if (!npc.threat) {
      npc.threat = []
    }
    const existing = npc.threat.find((entry) => entry.playerId === playerId)
    if (existing) {
      existing.threat += amount
      existing.lastUpdated = now
    } else {
      npc.threat.push({
        playerId,
        threat: amount,
        lastUpdated: now,
      })
    }
  }

  calculatePlayerDamage(player, npc) {
    const strength = player.str ?? 1
    const level = player.level ?? 1
    const min = 2 + Math.floor(strength / 2) + Math.floor(level / 3)
    const max = 5 + strength + Math.floor(level / 2)
    const roll = randomInt(min, max)
    const defense = npc.stats?.defense ?? 0
    return Math.max(1, roll - defense)
  }

  calculateNpcDamage(npc, player) {
    const damageRange = npc.stats?.damage || { min: 1, max: 3 }
    const min = damageRange.min ?? 1
    const max = damageRange.max ?? min + 2
    const roll = randomInt(min, max)
    const defense = player.def ?? 0
    return Math.max(1, roll - defense)
  }

  generateLoot(config) {
    if (!config?.lootTable) {
      return { items: [], currency: 0, xp: 0 }
    }

    const { lootTable } = config
    const loot = {
      items: [],
      currency: 0,
      xp: lootTable.xp ?? 0,
    }

    if (lootTable.currency) {
      const { min, max } = lootTable.currency
      loot.currency = randomInt(min, max)
    }

    if (Array.isArray(lootTable.drops)) {
      lootTable.drops.forEach((drop) => {
        const chance = drop.chance ?? 0
        if (Math.random() <= chance) {
          let quantity = 1
          if (typeof drop.quantity === 'number') {
            quantity = drop.quantity
          } else if (drop.quantity && typeof drop.quantity === 'object') {
            quantity = randomInt(drop.quantity.min ?? 1, drop.quantity.max ?? 1)
          }
          loot.items.push({
            itemId: drop.itemId,
            quantity,
          })
        }
      })
    }

    return loot
  }

  applyLootToPlayer(killerId, loot) {
    if (!killerId || !loot) return
    const player = this.players.get(killerId)
    if (!player) return

    const updated = {
      ...player,
    }

    if (loot.currency && loot.currency > 0) {
      updated.currency = (updated.currency || 0) + loot.currency
    }

    if (loot.xp && loot.xp > 0) {
      updated.xp = (updated.xp || 0) + loot.xp
    }

    this.players.set(killerId, updated)
  }

  handlePlayerDefeat(player, npc, tickId) {
    return [
      this.createFact({
        tickId,
        type: 'player_defeated',
        data: {
          playerId: player.id,
          username: player.username,
          npcId: npc.npcId,
          instanceId: npc.instanceId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  async handleNPCDeath(npc, killerId, tickId) {
    const facts = [
      this.createFact({
        tickId,
        type: 'npc_killed',
        data: {
          instanceId: npc.instanceId,
          npcId: npc.npcId,
          name: npc.name,
          killerId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]

    const config = this.npcManager?.spawnConfigs?.get(npc.npcId)
    const loot = this.generateLoot(config)

    if (loot && (loot.items.length > 0 || loot.currency > 0 || loot.xp > 0)) {
      facts.push(
        this.createFact({
          tickId,
          type: 'npc_loot',
          data: {
            instanceId: npc.instanceId,
            npcId: npc.npcId,
            name: npc.name,
            killerId,
            loot,
          },
          affectedPlayers: this.getPlayerIds(),
        })
      )
      this.applyLootToPlayer(killerId, loot)
    }

    this.npcs.delete(npc.instanceId)
    await this.onNPCDeath({
      instanceId: npc.instanceId,
      npcId: npc.npcId,
      roomId: this.roomId,
      loot,
      killerId,
    })

    return facts
  }

  async syncNPCState(npc) {
    if (!this.npcManager) return
    await this.npcManager.updateRuntimeState(npc, this.roomId)
  }

  resolveUseItem(intent, tickId) {
    return [
      this.createFact({
        tickId,
        type: 'use_item',
        data: {
          playerId: intent.playerId,
          itemId: intent.data.itemId,
        },
        affectedPlayers: [intent.playerId],
      }),
    ]
  }

  resolveLook(intent, tickId) {
    return [
      this.createFact({
        tickId,
        type: 'look',
        data: {
          playerId: intent.playerId,
        },
        affectedPlayers: [intent.playerId],
      }),
    ]
  }

  resolveGenericAction(intent, tickId) {
    const player = this.players.get(intent.playerId)

    return [
      this.createFact({
        tickId,
        type: 'player_action',
        data: {
          playerId: intent.playerId,
          action: intent.data.action,
          username: player?.username || intent.playerId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  addNPC(npcState) {
    const {
      instanceId,
      npcId,
      name,
      disposition,
      canBeAttacked,
      stats,
      hp,
      hpMax,
      state,
      cooldowns = {},
      threat = [],
      metadata = {},
    } = npcState

    const next = {
      instanceId,
      npcId,
      name,
      disposition,
      canBeAttacked,
      stats,
      hp,
      hpMax,
      state: state || 'IDLE',
      targetId: null,
      cooldowns: { ...cooldowns },
      threat: Array.isArray(threat) ? [...threat] : [],
      metadata: {
        ...metadata,
        homeRoom: metadata.homeRoom || this.roomId,
        leashDistance: metadata.leashDistance ?? DEFAULT_LEASH_DISTANCE,
        leashTimeMs: metadata.leashTimeMs ?? DEFAULT_LEASH_TIME_MS,
        engagedAt: metadata.engagedAt || null,
        patrolPath: metadata.patrolPath || [],
        patrolIndex: 0,
        wanderRooms: metadata.wanderRooms || [],
      },
      nextActionTick: 0,
      lastDecisionTick: 0,
    }

    this.npcs.set(instanceId, next)
  }

  removeNPC(instanceId) {
    this.npcs.delete(instanceId)
  }

  updateNPC(instanceId, updater) {
    const npc = this.npcs.get(instanceId)
    if (!npc) return
    const updated = updater({ ...npc })
    this.npcs.set(instanceId, updated)
  }

  async processNPCs(tickId) {
    if (!this.npcBrain) return []
    const facts = []
    const now = Date.now()

    if (this.players.size === 0) {
      const hasPersistent = Array.from(this.npcs.values()).some(
        (npc) => npc.metadata?.services && npc.metadata.services.includes('persistent')
      )
      if (!hasPersistent) {
        return facts
      }
    }

    for (const npc of this.npcs.values()) {
      if (npc.metadata?.frozen) {
        continue
      }
      this.decayThreat(npc, now)
      const decision = await this.evaluateNPC(npc, tickId, now)
      if (!decision) continue
      const decisionFacts = await this.applyNPCDecision(npc, decision, tickId, now)
      if (decisionFacts.length > 0) {
        facts.push(...decisionFacts)
      }
    }

    return facts
  }

  async evaluateNPC(npc, tickId, now) {
    if (!this.npcBrain) return null

    const players = this.getPlayerSnapshots()
    const homeRoom = npc.metadata?.homeRoom || this.roomId
    const leashDistance = npc.metadata?.leashDistance ?? DEFAULT_LEASH_DISTANCE
    const leashTimeMs = npc.metadata?.leashTimeMs ?? DEFAULT_LEASH_TIME_MS

    const forcedDecision = await this.shouldForceLeash(npc, tickId, homeRoom, now)
    if (forcedDecision) {
      return forcedDecision
    }

    const decision = await this.npcBrain.think({
      tickId,
      now,
      npc: {
        instanceId: npc.instanceId,
        npcId: npc.npcId,
        definitionId: npc.definitionId || null,
        roomId: this.roomId,
        state: npc.state,
        hp: npc.hp,
        hpMax: npc.hpMax,
        targetId: npc.targetId || null,
        nextActionTick: npc.nextActionTick || 0,
        disposition: npc.disposition,
        canBeAttacked: npc.canBeAttacked,
        mobility: npc.metadata?.mobility || npc.metadata?.mobilityMode || 'STATIONARY',
        stats: npc.stats || {},
        metadata: npc.metadata,
        threat: npc.threat,
      },
      environment: {
        players,
        homeRoom,
        leashDistance,
        leashTimeMs,
        engagedAt: npc.metadata?.engagedAt || 0,
        findPath: async (fromRoom, toRoom) => {
          if (!this.pathfinder) return null
          return this.pathfinder.findPath(fromRoom, toRoom)
        },
        getAdjacentRooms: () => [],
      },
    })

    return decision
  }

  async applyNPCDecision(npc, decision, tickId, now) {
    const facts = []
    npc.state = decision.state
    npc.nextActionTick = decision.nextThinkTick
    if (decision.targetId !== undefined) {
      npc.targetId = decision.targetId
      if (decision.targetId && npc.metadata) {
        npc.metadata.engagedAt = npc.metadata.engagedAt || now
      }
    }

    for (const action of decision.actions) {
      const actionFacts = await this.applyNPCAction(npc, action, tickId, now)
      if (actionFacts.length > 0) {
        facts.push(...actionFacts)
      }
    }

    npc.lastDecisionTick = tickId

    await this.syncNPCState(npc)

    return facts
  }

  async shouldForceLeash(npc, tickId, homeRoom, now) {
    const leashTimeMs = npc.metadata?.leashTimeMs ?? DEFAULT_LEASH_TIME_MS
    const leashDistance = npc.metadata?.leashDistance ?? DEFAULT_LEASH_DISTANCE
    const engagedAt = npc.metadata?.engagedAt

    if (engagedAt && now - engagedAt > leashTimeMs) {
      return {
        state: 'RETURN_HOME',
        actions: homeRoom !== this.roomId ? [{ type: 'move', toRoom: homeRoom }] : [{ type: 'reset' }],
        nextThinkTick: tickId + 2,
        targetId: null,
      }
    }

    if (homeRoom !== this.roomId && this.pathfinder) {
      const path = await this.pathfinder.findPath(homeRoom, this.roomId)
      if (path && path.length > leashDistance) {
        return {
          state: 'RETURN_HOME',
          actions: [{ type: 'move', toRoom: homeRoom }],
          nextThinkTick: tickId + 2,
          targetId: null,
        }
      }
    }

    return null
  }

  async applyNPCAction(npc, action, tickId, now) {
    switch (action.type) {
      case 'move':
        return this.handleNPCMove(npc, action.toRoom, tickId)
      case 'attack':
        return this.handleNPCAttackIntent(npc, action.targetId, tickId)
      case 'bark':
        return this.handleNPCBark(npc, tickId, now)
      case 'reset':
        this.resetNPCCombat(npc)
        return []
      case 'idle':
      default:
        return []
    }
  }

  async handleNPCMove(npc, toRoom, tickId) {
    if (!toRoom || toRoom === this.roomId) {
      return []
    }

    await this.onNPCMove({
      instanceId: npc.instanceId,
      npcId: npc.npcId,
      fromRoom: this.roomId,
      toRoom,
    })

    this.removeNPC(npc.instanceId)

    return [
      this.createFact({
        tickId,
        type: 'npc_moved',
        data: {
          instanceId: npc.instanceId,
          npcId: npc.npcId,
          name: npc.name,
          fromRoom: this.roomId,
          toRoom,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  async handleNPCAttackIntent(npc, targetId, tickId) {
    if (!targetId) return []

    const player = this.players.get(targetId)
    if (!player) {
      return []
    }

    const now = Date.now()
    const attackSpeed = npc.stats?.attackSpeedTicks ?? 10
    const nextReady = npc.cooldowns.attack || 0
    if (tickId < nextReady) {
      return []
    }
    npc.cooldowns.attack = tickId + attackSpeed

    const facts = [
      this.createFact({
        tickId,
        type: 'npc_attack_intent',
        data: {
          instanceId: npc.instanceId,
          npcId: npc.npcId,
          name: npc.name,
          targetId,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]

    const damage = this.calculateNpcDamage(npc, player)
    const hpRemaining = Math.max(0, (player.hp ?? 0) - damage)

    this.players.set(player.id, {
      ...player,
      hp: hpRemaining,
    })

    facts.push(
      this.createFact({
        tickId,
        type: 'player_damaged',
        data: {
          playerId: player.id,
          username: player.username,
          npcId: npc.npcId,
          instanceId: npc.instanceId,
          damage,
          hpRemaining,
        },
        affectedPlayers: this.getPlayerIds(),
      })
    )

    if (hpRemaining <= 0) {
      facts.push(
        ...this.handlePlayerDefeat(
          {
            ...player,
            hp: hpRemaining,
          },
          npc,
          tickId
        )
      )
    }

    await this.syncNPCState(npc)

    return facts
  }

  async handleNPCBark(npc, tickId, now) {
    if (!npc?.metadata?.barks || npc.metadata.barks.length === 0) {
      return []
    }

    const lastBark = this.npcBarkTimestamps.get(npc.instanceId) || 0
    if (now - lastBark < BARK_COOLDOWN_MS) {
      return []
    }

    if (now - this.roomLastBarkAt < ROOM_BARK_COOLDOWN_MS) {
      return []
    }

    const bark = npc.metadata.barks[Math.floor(Math.random() * npc.metadata.barks.length)]
    if (!bark) return []

    this.npcBarkTimestamps.set(npc.instanceId, now)
    this.roomLastBarkAt = now

    return [
      this.createFact({
        tickId,
        type: 'npc_bark',
        data: {
          instanceId: npc.instanceId,
          npcId: npc.npcId,
          name: npc.name,
          message: bark,
        },
        affectedPlayers: this.getPlayerIds(),
      }),
    ]
  }

  resetNPCCombat(npc) {
    npc.targetId = null
    npc.threat = []
    if (npc.metadata) {
      npc.metadata.engagedAt = null
    }
    this.onNPCReset({
      instanceId: npc.instanceId,
      npcId: npc.npcId,
      roomId: this.roomId,
    })
  }

  createFact({ tickId, type, data, affectedPlayers }) {
    return {
      seq: this.nextSeq(),
      tickId,
      type,
      data,
      affectedPlayers,
      timestamp: Date.now(),
    }
  }

  recordFact(fact) {
    this.facts.push(fact)
    if (this.facts.length > 500) {
      this.facts.splice(0, this.facts.length - 500)
    }
  }

  nextSeq() {
    this.factSeq += 1
    return this.factSeq
  }
}

module.exports = {
  RoomState,
}

function randomInt(min, max) {
  const lower = Math.floor(min)
  const upper = Math.ceil(max)
  if (upper <= lower) {
    return lower
  }
  return Math.floor(Math.random() * (upper - lower + 1)) + lower
}

