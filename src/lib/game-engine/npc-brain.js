const DECISION_INTERVAL_TICKS = 2

/**
 * @typedef {import('./npc-manager.js')} NPCManager
 */

/**
 * @typedef {Object} NPCDecisionContext
 * @property {number} tickId
 * @property {number} now
 * @property {NPCBrainState} npc
 * @property {NPCEnvironmentState} environment
 */

/**
 * @typedef {Object} NPCBrainState
 * @property {string} instanceId
 * @property {string} npcId
 * @property {string | null} definitionId
 * @property {string} roomId
 * @property {string} state
 * @property {number} hp
 * @property {number} hpMax
 * @property {string | null} targetId
 * @property {number} nextActionTick
 * @property {import('@prisma/client').NPCDisposition} disposition
 * @property {boolean} canBeAttacked
 * @property {import('@prisma/client').NPCMobility} mobility
 * @property {Record<string, any>} stats
 * @property {Record<string, any>} metadata
 * @property {Array<{ playerId: string, threat: number, lastUpdated: number }>} threat
 */

/**
 * @typedef {Object} NPCEnvironmentState
 * @property {Array<{ id: string, roomId: string, hp: number, hpMax: number, level: number }>} players
 * @property {function(string, string): string[] | null} findPath
 * @property {function(string): string[]} getAdjacentRooms
 * @property {string} homeRoom
 * @property {number} leashDistance
 * @property {number} leashTimeMs
 * @property {number} engagedAt
 */

/**
 * @typedef {Object} NPCDecisionAction
 * @property {'move' | 'attack' | 'bark' | 'return_home' | 'reset' | 'idle'} type
 * @property {string} [toRoom]
 * @property {string} [targetId]
 * @property {boolean} [force]
 */

/**
 * @typedef {Object} NPCDecisionResult
 * @property {string} state
 * @property {number} nextThinkTick
 * @property {Array<NPCDecisionAction>} actions
 * @property {string | null} targetId
 */

class NPCBrain {
  /**
   * @param {object} options
   * @param {(fromRoom: string, toRoom: string) => string[] | null} options.findPath
   */
  constructor({ findPath }) {
    this.findPath = findPath
  }

  /**
   * @param {NPCDecisionContext} context
   * @returns {Promise<NPCDecisionResult | null>}
   */
  async think(context) {
    const { npc, tickId } = context
    if (npc.hp <= 0 || npc.state === 'DEAD') {
      return {
        state: 'DEAD',
        nextThinkTick: tickId + DECISION_INTERVAL_TICKS,
        actions: [],
        targetId: null,
      }
    }

    if (!this.shouldThink(npc, tickId)) {
      return null
    }

    switch (npc.state) {
      case 'IDLE':
        return this.onIdle(context)
      case 'PATROL':
        return this.onPatrol(context)
      case 'WANDER':
        return this.onWander(context)
      case 'NOTICE':
        return this.onNotice(context)
      case 'PURSUE':
        return this.onPursue(context)
      case 'ENGAGE':
        return this.onEngage(context)
      case 'FLEE':
        return this.onFlee(context)
      case 'RETURN_HOME':
        return this.onReturnHome(context)
      default:
        return this.onIdle(context)
    }
  }

  /**
   * @param {NPCBrainState} npc
   * @param {number} tickId
   */
  shouldThink(npc, tickId) {
    return tickId >= (npc.nextActionTick ?? 0)
  }

  /**
   * @param {NPCDecisionContext} context
   * @returns {NPCDecisionResult}
   */
  onIdle(context) {
    const { npc, environment, tickId } = context
    const visibleTarget = this.pickTarget(environment.players, npc)

    if (visibleTarget) {
      if (npc.disposition === 'HOSTILE') {
        return this.transition('NOTICE', tickId, [{ type: 'bark' }], visibleTarget.id)
      }
    }

    const mobility = npc.mobility || 'STATIONARY'
    if (mobility === 'PATROL') {
      return this.transition('PATROL', tickId, [])
    }

    if (mobility === 'WANDER') {
      return this.transition('WANDER', tickId, [])
    }

    return this.transition('IDLE', tickId, [{ type: 'idle' }])
  }

  /**
   * @param {NPCDecisionContext} context
   */
  onPatrol(context) {
    const { npc, environment, tickId } = context
    const patrolPath = npc.metadata?.patrolPath || []
    if (!Array.isArray(patrolPath) || patrolPath.length === 0) {
      return this.transition('IDLE', tickId, [])
    }

    const nextIndex = (npc.metadata?.patrolIndex ?? 0) % patrolPath.length
    const nextRoom = patrolPath[nextIndex]
    const actions = []

    if (nextRoom && nextRoom !== npc.roomId) {
      actions.push({ type: 'move', toRoom: nextRoom })
    } else {
      actions.push({ type: 'idle' })
    }

    const target = this.pickTarget(environment.players, npc)
    if (target && npc.disposition === 'HOSTILE') {
      return this.transition('NOTICE', tickId, actions, target.id)
    }

    return this.transition('PATROL', tickId, actions)
  }

  /**
   * @param {NPCDecisionContext} context
   */
  onWander(context) {
    const { npc, environment, tickId } = context
    const wanderRooms = npc.metadata?.wanderRooms || []
    if (!Array.isArray(wanderRooms) || wanderRooms.length === 0) {
      return this.transition('IDLE', tickId, [])
    }
    const nextRoom = wanderRooms[Math.floor(Math.random() * wanderRooms.length)]
    const actions = []
    if (nextRoom && nextRoom !== npc.roomId) {
      actions.push({ type: 'move', toRoom: nextRoom })
    } else {
      actions.push({ type: 'idle' })
    }

    const target = this.pickTarget(environment.players, npc)
    if (target && npc.disposition === 'HOSTILE') {
      return this.transition('NOTICE', tickId, actions, target.id)
    }

    return this.transition('WANDER', tickId, actions)
  }

  async onNotice(context) {
    const { npc, environment, tickId } = context
    const targetId = npc.targetId
    const target = environment.players.find((player) => player.id === targetId) || this.pickTarget(environment.players, npc)

    if (!target) {
      return this.transition('RETURN_HOME', tickId, [])
    }

    if (target.roomId === npc.roomId) {
      return this.transition('ENGAGE', tickId, [{ type: 'attack', targetId: target.id }], target.id)
    }

    return this.transition('PURSUE', tickId, [], target.id)
  }

  async onPursue(context) {
    const { npc, environment, tickId } = context
    if (!npc.targetId) {
      return this.transition('RETURN_HOME', tickId, [])
    }

    const target = environment.players.find((player) => player.id === npc.targetId)
    if (!target) {
      return this.transition('RETURN_HOME', tickId, [])
    }

    if (target.roomId === npc.roomId) {
      return this.transition('ENGAGE', tickId, [{ type: 'attack', targetId: target.id }], target.id)
    }

    const path = await environment.findPath(npc.roomId, target.roomId)
    if (!path || path.length === 0) {
      return this.transition('RETURN_HOME', tickId, [])
    }

    const nextRoom = path[0]
    return this.transition('PURSUE', tickId, [{ type: 'move', toRoom: nextRoom }], target.id)
  }

  onEngage(context) {
    const { npc, environment, tickId } = context
    if (!npc.targetId) {
      return this.transition('RETURN_HOME', tickId, [])
    }
    const target = environment.players.find((player) => player.id === npc.targetId)
    if (!target) {
      return this.transition('RETURN_HOME', tickId, [])
    }

    if (target.roomId !== npc.roomId) {
      return this.transition('PURSUE', tickId, [], target.id)
    }

    return this.transition('ENGAGE', tickId, [{ type: 'attack', targetId: target.id }], target.id)
  }

  async onFlee(context) {
    const { npc, environment, tickId } = context
    const homeRoom = environment.homeRoom || npc.metadata?.homeRoom || npc.roomId
    if (npc.roomId === homeRoom) {
      return this.transition('IDLE', tickId, [], null)
    }
    const path = await environment.findPath(npc.roomId, homeRoom)
    if (!path || path.length === 0) {
      return this.transition('RETURN_HOME', tickId, [], null)
    }
    return this.transition('FLEE', tickId, [{ type: 'move', toRoom: path[0] }], npc.targetId)
  }

  async onReturnHome(context) {
    const { npc, environment, tickId } = context
    const homeRoom = environment.homeRoom || npc.metadata?.homeRoom || npc.roomId
    if (npc.roomId === homeRoom) {
      return this.transition('IDLE', tickId, [{ type: 'reset' }], null)
    }
    const path = await environment.findPath(npc.roomId, homeRoom)
    if (!path || path.length === 0) {
      return this.transition('IDLE', tickId, [{ type: 'reset' }], null)
    }
    return this.transition('RETURN_HOME', tickId, [{ type: 'move', toRoom: path[0] }], null)
  }

  /**
   * @param {NPCDecisionResult['state']} state
   * @param {number} tickId
   * @param {NPCDecisionResult['actions']} actions
   * @param {string | null} [targetId]
   * @returns {NPCDecisionResult}
   */
  transition(state, tickId, actions, targetId = null) {
    return {
      state,
      actions,
      nextThinkTick: tickId + DECISION_INTERVAL_TICKS,
      targetId,
    }
  }

  /**
   * @param {NPCEnvironmentState['players']} players
   * @param {NPCBrainState} npc
   */
  pickTarget(players, npc) {
    if (!players || players.length === 0) {
      return null
    }

    const threatSorted = [...(npc.threat || [])].sort((a, b) => b.threat - a.threat)
    for (const entry of threatSorted) {
      const candidate = players.find((player) => player.id === entry.playerId)
      if (candidate) {
        return candidate
      }
    }

    return players[0]
  }
}

module.exports = {
  NPCBrain,
  DECISION_INTERVAL_TICKS,
}

