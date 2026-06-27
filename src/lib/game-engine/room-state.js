const { executeRoomAction } = require('./room-action-handlers')
const { executeItemAction } = require('./item-action-handlers')
const { pickupRoomItem, dropRoomItem, getRoomItems } = require('./services/room-item-service')
const { getPlayerInventory, grantItemOnce, getItemBySlug } = require('./services/inventory-service')
const { equipItem, unequipItem } = require('./services/equipment-service')
const { checkRoomGate } = require('./room-gates')
const { prisma } = require('../db-client')
const { executeStartBattle, executePlayerAttack, executePlayerFlee, resolveSupportTurn } = require('./battle-action-handlers')
const { getRoomEnemies, isProbabilistic, getRoomPriorityEnemy, rollRoomEnemyGroup } = require('../game-data/room-enemies')
const { getEnemy } = require('../game-data/enemies')
const { getRevealDefinition, markRevealed, clearRevealed } = require('./search-reveal-state')

const SEARCH_LOOT_TABLES = {
  '003b': {
    failMessage: 'You search the cabin basement but find nothing.',
    entries: [
      { message: 'You search the cabin basement and find a Blueberry!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 1 } },
      { message: 'You search the cabin basement and find 2 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 2 } },
      { message: 'You search the cabin basement and find some Cooked Meat!', effect: { type: 'grantItem', itemSlug: 'cooked-meat', quantity: 1 } },
      { message: 'You search the cabin basement and find a Crossbow Bolt!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 1 } },
      { message: (amount) => `You search the cabin basement and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 5, max: 25 } },
      { message: (amount) => `You search the cabin basement and find ${amount} Arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 2, maxQty: 5 } },
      { message: 'You search the cabin basement and find a Mace!', effect: { type: 'grantItem', itemSlug: 'mace', quantity: 1 } },
      { message: 'You search the cabin basement and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: 'You search the cabin basement and find a Dagger!', effect: { type: 'grantItem', itemSlug: 'dagger', quantity: 1 } },
      { message: 'You search the cabin basement and find a Long Sword!', effect: { type: 'grantItem', itemSlug: 'long-sword', quantity: 1 } },
    ],
  },
  '003bb': {
    failMessage: 'You search the destroyed basement but find nothing.',
    entries: [
      { message: 'You search the destroyed basement and find a Blueberry!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 1 } },
      { message: 'You search the destroyed basement and find 2 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 2 } },
      { message: 'You search the destroyed basement and find some Cooked Meat!', effect: { type: 'grantItem', itemSlug: 'cooked-meat', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Crossbow Bolt!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 1 } },
      { message: (amount) => `You search the destroyed basement and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 10, max: 30 } },
      { message: (amount) => `You search the destroyed basement and find ${amount} Arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 2, maxQty: 5 } },
      { message: 'You search the destroyed basement and find a Mace!', effect: { type: 'grantItem', itemSlug: 'mace', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Dagger!', effect: { type: 'grantItem', itemSlug: 'dagger', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Long Sword!', effect: { type: 'grantItem', itemSlug: 'long-sword', quantity: 1 } },
    ],
  },
}

// Pull a short "+5 HP" / "−1 HP" / "+10 MP" effect string out of an item action
// result so we can show it next to the action description on the battle panel.
function extractEffectText(result) {
  const data = result?.playerEvents?.[0]?.payload?.data
  if (!data) return null
  if (typeof data.hpChange === 'number' && data.hpChange !== 0) {
    const sign = data.hpChange > 0 ? '+' : ''
    return `${sign}${data.hpChange} HP`
  }
  if (typeof data.mpChange === 'number' && data.mpChange !== 0) {
    const sign = data.mpChange > 0 ? '+' : ''
    return `${sign}${data.mpChange} MP`
  }
  return null
}

// Combine the original action result with the support-turn events. If the
// support turn ended the battle with defeat, that takes over.
function mergeSupportTurnIntoResult(base, supportTurn) {
  if (!supportTurn || (!supportTurn.playerEvents?.length && !supportTurn.broadcastEvents?.length)) {
    return base
  }
  return {
    ...base,
    playerEvents: [...(base.playerEvents ?? []), ...(supportTurn.playerEvents ?? [])],
    broadcastEvents: [...(base.broadcastEvents ?? []), ...(supportTurn.broadcastEvents ?? [])],
  }
}

// Actions that consume a "turn" and may trigger a spawn check in probabilistic rooms.
// Free actions (chat, look, examine_*, accept_quest, complete_quest) do not.
// attack and move are handled separately (attack triggers battle directly; move triggers on entry).
const TURN_ACTIONS = new Set([
  'rest',
  'search',
  'use_item',
  'equip_item',
  'unequip_item',
  'pickup_item',
  'drop_item',
])

class RoomState {
  constructor(roomId) {
    this.roomId = roomId
    this.players = new Map()
    this.activeBattles = new Map()
    // Per-player enemy state for probabilistic rooms.
    // Map<playerId, { roster: string[] }>
    // roster = the set of enemy slugs currently present; out of battle the player may
    // attack any of them. Empty roster = no enemies present. Key absent = not yet rolled.
    this.playerEnemyState = new Map()
    this.lastActionAt = null
    this.lastTickPlayerCount = null
    this.lastAmbientHintAt = 0
  }

  addPlayer(playerState) {
    if (!playerState?.id) return
    this.players.set(playerState.id, { ...playerState })
    if (getRevealDefinition(this.roomId)) {
      clearRevealed(playerState.id, this.roomId)
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
    this.playerEnemyState.delete(playerId)
    if (getRevealDefinition(this.roomId)) {
      clearRevealed(playerId, this.roomId)
    }
    const battle = this.activeBattles.get(playerId)
    if (battle) {
      battle.end()
      this.activeBattles.delete(playerId)
      prisma.user.update({ where: { id: playerId }, data: { inFight: false } }).catch(() => {})
    }
  }

  // --- Per-player enemy state helpers (probabilistic rooms) ---
  //
  // Enemies present for a player are a flat roster: out of battle the player may
  // attack any of them. Index 0 is the default target for the bare 'attack' action
  // and there is no post-battle grace.

  // A present enemy slug (roster[0]), used as a default target for the bare
  // 'attack' action.
  getPlayerActiveEnemy(playerId) {
    return this.playerEnemyState.get(playerId)?.roster?.[0] ?? null
  }

  // Returns a present enemy slug (roster[0]), or null.
  getPlayerEnemySlug(playerId) {
    return this.playerEnemyState.get(playerId)?.roster?.[0] ?? null
  }

  // The full list of enemies currently present for this player.
  getPlayerEnemyRoster(playerId) {
    return this.playerEnemyState.get(playerId)?.roster ?? []
  }

  setPlayerActiveEnemy(playerId, slug) {
    this.playerEnemyState.set(playerId, { roster: slug ? [slug] : [] })
  }

  // Seeds the full roster of present enemies (used on room entry to place a fresh
  // wave, or to restore a roster persisted across a room transition).
  setPlayerEnemyRoster(playerId, slugs) {
    this.playerEnemyState.set(playerId, { roster: Array.isArray(slugs) ? slugs : [] })
  }

  // Removes one defeated enemy (by slug) from the roster after a battle win.
  // No grace period — the next turn action can immediately provoke another enemy.
  // Returns the number still present.
  removeEnemyFromRoster(playerId, slug) {
    const state = this.playerEnemyState.get(playerId)
    const roster = state?.roster ? [...state.roster] : []
    const idx = roster.indexOf(slug)
    if (idx !== -1) roster.splice(idx, 1)
    this.playerEnemyState.set(playerId, { roster })
    return roster.length
  }

  clearPlayerEnemyState(playerId) {
    this.playerEnemyState.delete(playerId)
  }

  // True if any aggressive enemy is present in the player's roster. Used to block
  // movement — the player cannot leave while hostiles remain.
  hasHostileEnemies(playerId) {
    return this.getPlayerEnemyRoster(playerId).some((slug) => getEnemy(slug)?.isAggressive)
  }

  // Picks the HOSTILE (aggressive) enemy to engage the player first, or null.
  // The room's designated `priority` enemy strikes first when it is present and
  // aggressive; otherwise a random present hostile is chosen.
  pickHostileTarget(slugs) {
    const hostiles = slugs.filter((slug) => getEnemy(slug)?.isAggressive)
    if (!hostiles.length) return null
    const prioritySlug = getRoomPriorityEnemy(this.roomId)
    if (prioritySlug && hostiles.includes(prioritySlug)) return prioritySlug
    return hostiles[Math.floor(Math.random() * hostiles.length)]
  }

  // Rolls a fresh wave (the whole group at once) only when nothing is present.
  // Returns { spawned: string[] } for a newly-rolled wave, or null otherwise.
  maybeSpawnEnemy(playerId) {
    if (!isProbabilistic(this.roomId)) return null

    const battle = this.activeBattles.get(playerId)
    if (battle?.isActive) return null

    // Enemies already present — no new wave (engagement handled by caller).
    if (this.playerEnemyState.get(playerId)?.roster?.length) return null

    const group = rollRoomEnemyGroup(this.roomId)
    this.playerEnemyState.set(playerId, { roster: group })
    return group.length ? { spawned: group } : null
  }

  // Maps a list of enemy slugs to full enemy objects (for client display payloads).
  buildEnemyList(slugs) {
    return slugs.map((slug) => getEnemy(slug)).filter(Boolean)
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
    const actionData = typeof action === 'object' ? (action.data ?? {}) : {}
    const roomSpecificResult = await executeRoomAction(
      this.roomId,
      actionName,
      playerId,
      this,
      currentTickNumber,
      nextTickAt,
      actionData
    )

    // If room-specific handler returned a result, use it
    if (roomSpecificResult !== null) {
      return roomSpecificResult
    }

    // Otherwise, fall back to standard actions
    let result
    switch (action.type) {
      case 'attack':
        return await this.executeAttack(playerId)
      case 'start_battle':
        return await executeStartBattle(action, playerId, this)
      case 'player_attack':
        return await executePlayerAttack(action, playerId, this)
      case 'player_flee':
        return await executePlayerFlee(action, playerId, this)
      case 'pickup_item':
        result = await this.executePickupItem(action, playerId)
        break
      case 'drop_item':
        result = await this.executeDropItem(action, playerId)
        break
      case 'move':
        return await this.executeMove(action, playerId)
      case 'chat':
        return this.executeChat(action, playerId)
      case 'search':
        result = await this.executeSearch(playerId)
        break
      case 'rest':
        result = await this.executeRest(playerId)
        break
      case 'look':
        return this.executeLook(action, playerId)
      case 'examine_item':
        return this.executeExamineItem(action, playerId)
      case 'examine_player_item':
        return this.executeExaminePlayerItem(action, playerId)
      case 'use_item':
        result = await this.executeUseItem(action, playerId, currentTickNumber, nextTickAt)
        break
      case 'equip_item':
        result = await this.executeEquipItem(action, playerId)
        break
      case 'unequip_item':
        result = await this.executeUnequipItem(action, playerId)
        break
      case 'accept_quest':
        return await this.executeAcceptQuest(action, playerId)
      case 'complete_quest':
        return await this.executeCompleteQuest(action, playerId)
      default:
        return this.createErrorResult(action.type, `Unknown action type: ${action.type}`)
    }

    // After a TURN_ACTION completes, check for enemy spawn in probabilistic rooms.
    if (result?.success && TURN_ACTIONS.has(action.type)) {
      result = await this.appendSpawnEvents(result, playerId)
    }

    return result
  }

  // After a turn action: resolve enemy presence and append notification / auto-battle
  // events. Announces a freshly-rolled wave (all enemies at once), then — if any hostile
  // enemy is present — a random one of them attacks the player. No post-battle grace.
  async appendSpawnEvents(result, playerId) {
    if (!isProbabilistic(this.roomId)) return result

    const battle = this.activeBattles.get(playerId)
    if (battle?.isActive) return result

    const spawned = this.maybeSpawnEnemy(playerId)

    const roster = this.getPlayerEnemyRoster(playerId)
    if (!roster.length) return result

    // Announce a freshly-rolled wave (the whole group at once).
    if (spawned?.spawned?.length) {
      const enemies = this.buildEnemyList(roster)
      const names = enemies.map((e) => e.name)
      const message = enemies.length === 1
        ? `A ${names[0]} emerges from the darkness!`
        : `${enemies.length} enemies emerge from the darkness: ${names.join(', ')}!`

      result = {
        ...result,
        playerEvents: [
          ...(result.playerEvents ?? []),
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload(
              'enemy_spawn',
              'danger',
              message,
              { enemySlug: roster[0], enemyName: enemies[0]?.name, enemy: enemies[0], enemies }
            ),
          },
        ],
      }
    }

    // The priority (or a random) present hostile enemy attacks the player.
    const targetSlug = this.pickHostileTarget(roster)
    if (targetSlug) {
      const battleResult = await executeStartBattle(
        { type: 'start_battle', data: { enemySlug: targetSlug, isAutoInitiated: true } },
        playerId,
        this
      )
      if (battleResult?.playerEvents?.length) {
        result = {
          ...result,
          playerEvents: [...(result.playerEvents ?? []), ...battleResult.playerEvents],
        }
      }
    }

    return result
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
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('pickup_item', 'success', result.message, {
            inventory: result.inventory,
            roomItems: result.roomItems,
          }),
        },
      ],
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
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('drop_item', 'success', result.message, {
            inventory: result.inventory,
            roomItems: result.roomItems,
          }),
        },
      ],
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

  async executeMove(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[RoomState:${this.roomId}] executeMove - Player ${playerId} not found`)
      return this.createErrorResult('move', 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return this.createErrorResult('move', 'You cannot leave while in combat. Fight or flee.')
    }

    // Cannot leave while any hostile (aggressive) enemy is still present. Passive
    // enemies do not block movement and persist with the player across the move.
    if (this.hasHostileEnemies(playerId)) {
      return this.createErrorResult('move', 'You cannot leave while hostile enemies are here. Defeat them first.')
    }

    const fromRoom = action.data?.fromRoom || this.roomId
    const toRoom = action.data?.toRoom
    if (!toRoom) {
      console.log(`[RoomState:${this.roomId}] executeMove - No destination room provided`)
      return this.createErrorResult('move', 'No destination room provided')
    }

    const direction = action.data?.direction
    const directionValidated = action.data?.directionValidated === true

    // 1. REACHABILITY VALIDATION (primary constraint)
    // Skip if the socket handler already validated the direction (avoids redundant DB fetch)
    if (direction && !directionValidated) {
      try {
        const sourceRoom = await prisma.room.findUnique({
          where: { roomId: fromRoom },
          select: {
            roomId: true,
            north: true,
            northeast: true,
            east: true,
            southeast: true,
            south: true,
            southwest: true,
            west: true,
            northwest: true,
            up: true,
            down: true,
          },
        })

        if (!sourceRoom) {
          console.log(`[RoomState:${this.roomId}] executeMove - Source room ${fromRoom} not found`)
          return this.createErrorResult('move', 'Source room not found')
        }

        // Check if the source room has an exit in the specified direction that leads to the destination
        const exitRoomId = sourceRoom[direction]
        if (exitRoomId !== toRoom) {
          console.log(`[RoomState:${this.roomId}] executeMove - No valid exit from ${fromRoom} ${direction} to ${toRoom}`)
          return this.createErrorResult('move', `You don't see an exit in that direction`)
        }
      } catch (error) {
        console.error(`[RoomState:${this.roomId}] executeMove - Error validating reachability:`, error)
        return this.createErrorResult('move', 'Failed to validate room connection')
      }
    }

    // 2. GATE CHECK (additional constraint, only if reachability passes)
    if (direction) {
      const gateResult = await checkRoomGate(fromRoom, direction, playerId)
      if (gateResult && !gateResult.allowed) {
        console.log(`[RoomState:${this.roomId}] executeMove - Gate blocked ${player.username} from ${fromRoom} going ${direction}`)
        const gate = gateResult.gate
        const message = gate.message || "You cannot pass through this way."

        if (gate.silent) {
          return this.createErrorResult('move', message)
        }

        return {
          success: false,
          action: 'move',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload('move', 'failure', message, {
                roomId: this.roomId,
                showModal: true,
                modalContent: gate.modalContent || message,
              }),
            },
          ],
        }
      }
      if (gateResult?.onPass) {
        await gateResult.onPass(playerId)
      }
    }

    // 3. MOVEMENT EXECUTION (both validations passed)
    console.log(`[RoomState:${this.roomId}] executeMove - ${player.username} moving from ${fromRoom} to ${toRoom}`)

    this.touchActivity()
    // Persist the full roster (passive enemies only — hostiles block the move above)
    // so the same wave is restored if the player returns to this room.
    const departingEnemyRoster = this.getPlayerEnemyRoster(playerId)
    this.removePlayer(playerId)

    const toRoomName = action.data?.toRoomName || toRoom
    const roomData = action.data?.roomData
    const message = direction ? `You travel ${direction}` : `You teleport to ${toRoomName}`

    return {
      success: true,
      action: 'move',
      data: { fromRoom, toRoom, toRoomName, roomData },
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('move', 'success', message, { toRoom, toRoomName, roomData, direction }),
        },
      ],
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
        fromRoomEnemyRoster: departingEnemyRoster,
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
      broadcastEvents: [
        {
          event: 'chat-message',
          payload,
        },
      ],
    }
  }

  async executeAttack(playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('attack', 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return await executePlayerAttack({ type: 'player_attack' }, playerId, this)
    }

    let target = null

    if (isProbabilistic(this.roomId)) {
      // For probabilistic rooms, use the player's currently spawned enemy.
      const activeSlug = this.getPlayerActiveEnemy(playerId)
      target = activeSlug ? getEnemy(activeSlug) : null
    } else {
      const roomEnemyData = getRoomEnemies(this.roomId)
      const slugs = roomEnemyData?.enemies ?? []
      const enemies = slugs.map((s) => getEnemy(s)).filter(Boolean)
      target = enemies.find((e) => e.isAggressive) ?? enemies[0] ?? null
    }

    if (!target) {
      this.touchActivity()
      return {
        success: true,
        action: 'attack',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('attack', 'info', 'Nothing to attack here.'),
          },
        ],
      }
    }

    return await executeStartBattle({ type: 'start_battle', data: { enemySlug: target.slug } }, playerId, this)
  }

  async executeSearch(playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('search', 'Player not found in this room')
    }

    this.touchActivity()

    const revealDef = getRevealDefinition(this.roomId)
    if (revealDef) {
      const chance = revealDef.chance ?? 1
      if (Math.random() >= chance) {
        return {
          success: true,
          action: 'search',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload('search', 'info', revealDef.failMessage),
            },
          ],
        }
      }
      markRevealed(playerId, this.roomId)
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'success', revealDef.successMessage, {
              stateNote: revealDef.stateNote,
              roomPatch: { [revealDef.direction]: revealDef.toRoom },
            }),
          },
        ],
      }
    }

    const lootTable = SEARCH_LOOT_TABLES[this.roomId]
    if (!lootTable) {
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'success', 'You search the room and find nothing.'),
          },
        ],
      }
    }

    // 50% success chance
    if (Math.random() < 0.5) {
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'info', lootTable.failMessage),
          },
        ],
      }
    }

    // Roll loot
    const roll = Math.floor(Math.random() * lootTable.entries.length)
    const entry = lootTable.entries[roll]
    let message

    let updatedInventory = null

    if (entry.effect.type === 'grantCurrency') {
      const amount = Math.floor(Math.random() * (entry.effect.max - entry.effect.min + 1)) + entry.effect.min
      message = entry.message(amount)
      await prisma.user.update({
        where: { id: playerId },
        data: { currency: { increment: amount } },
      })
    } else if (entry.effect.type === 'grantItem') {
      let qty = entry.effect.quantity || 1
      if (entry.effect.minQty != null && entry.effect.maxQty != null) {
        qty = Math.floor(Math.random() * (entry.effect.maxQty - entry.effect.minQty + 1)) + entry.effect.minQty
        message = entry.message(qty)
      } else {
        message = entry.message
      }
      const result = await grantItemOnce(playerId, entry.effect.itemSlug, qty)
      updatedInventory = result.inventory ?? null
    }

    return {
      success: true,
      action: 'search',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('search', 'success', message, {
            ...(updatedInventory ? { inventory: updatedInventory } : {}),
          }),
        },
      ],
    }
  }

  // Shared rest implementation.
  //   - Standard rest (overchargeBonus 0): recovers physical/mental training amounts, capped at max.
  //   - Overcharge rest (overchargeBonus > 0): sets HP/MP to max + bonus.
  async applyRest(playerId, { action, overchargeBonus = 0, overchargeMessage } = {}) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult(action, 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return this.createErrorResult(action, 'You cannot rest during combat.')
    }

    this.touchActivity()

    // Read live vitals from the DB, not the in-memory players map. Battle damage
    // only writes to the DB (see battle-action-handlers), so the in-memory hp/mp
    // can be stale-high after a fight. Resting off the stale value would report a
    // full/overcharged heal while leaving the real (low) DB hp untouched.
    const liveStats = await prisma.user.findUnique({
      where: { id: playerId },
      select: { hp: true, mp: true, hpMax: true, mpMax: true, physicalTraining: true, mentalTraining: true },
    })
    if (!liveStats) {
      return this.createErrorResult(action, 'Could not load your stats.')
    }

    const hpMax = liveStats.hpMax ?? player.hpMax ?? 10
    const mpMax = liveStats.mpMax ?? player.mpMax ?? 2

    let newHp
    let newMp
    let message

    if (overchargeBonus > 0) {
      newHp = hpMax + overchargeBonus
      newMp = mpMax + overchargeBonus
      message = overchargeMessage ?? `Your HP and MP are fully restored, plus an extra +${overchargeBonus} to each.`
    } else {
      const pt = liveStats.physicalTraining ?? player.physicalTraining ?? 1
      const mt = liveStats.mentalTraining ?? player.mentalTraining ?? 0
      const curHp = liveStats.hp ?? 0
      const curMp = liveStats.mp ?? 0

      // Recovery only ever increases vitals. If the player is overcharged
      // (hp/mp above max), preserve the overcharge instead of capping it away.
      newHp = Math.max(curHp, Math.min(hpMax, curHp + pt))
      newMp = Math.max(curMp, Math.min(mpMax, curMp + mt))
      const hpGained = Math.max(0, newHp - curHp)
      const mpGained = Math.max(0, newMp - curMp)

      if (hpGained === 0 && mpGained === 0) {
        // Keep the in-memory map aligned with the live DB values we just read.
        this.updatePlayer(playerId, (state) => ({ ...state, hp: newHp, mp: newMp }))
        return {
          success: true,
          action,
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload(action, 'success', 'You already have full HP and MP.', { hp: newHp, mp: newMp }),
            },
          ],
        }
      }

      const parts = []
      if (hpGained > 0) parts.push(`${hpGained} HP`)
      if (mpGained > 0) parts.push(`${mpGained} MP`)
      message = `You recover ${parts.join(' and ')}.`
    }

    this.updatePlayer(playerId, (state) => ({ ...state, hp: newHp, mp: newMp }))
    await prisma.user.update({ where: { id: playerId }, data: { hp: newHp, mp: newMp } })

    return {
      success: true,
      action,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload(action, 'success', message, { hp: newHp, mp: newMp }),
        },
      ],
    }
  }

  async executeRest(playerId) {
    return this.applyRest(playerId, { action: 'rest' })
  }

  // Lobby (room 999) rest: overcharges HP and MP to 10 above their max.
  async executeLobbyRest(playerId) {
    return this.applyRest(playerId, {
      action: 'rest in lobby',
      overchargeBonus: 10,
      overchargeMessage: 'You rest near the fountain. Your HP and MP are fully restored, plus an extra +10 to each.',
    })
  }

  // Waterfall (room 020) rest: overcharges HP and MP to 10 above their max.
  async executeWaterfallRest(playerId) {
    return this.applyRest(playerId, {
      action: 'rest at waterfall',
      overchargeBonus: 10,
      overchargeMessage: 'You rest beneath the waterfall. Your HP and MP are fully restored, plus an extra +10 to each.',
    })
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
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('look', 'success', message, {
            roomId: this.roomId,
            playerCount: this.players.size,
          }),
        },
      ],
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
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('examine_item', 'success', message, {
            roomId: this.roomId,
            itemName,
            itemDescription,
          }),
        },
      ],
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
    const message = `You examine the ${itemName}. ${itemDescription}`

    return {
      success: true,
      action: 'examine_player_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('examine_player_item', 'success', message, {
            itemName,
            itemDescription,
          }),
        },
      ],
    }
  }

  async executeUseItem(action, playerId, currentTickNumber, nextTickAt) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('use_item', 'Player not found in this room')
    }

    const { playerItemId, action: itemAction } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('use_item', 'Player item ID is required')
    }
    if (!itemAction) {
      return this.createErrorResult('use_item', 'Item action is required')
    }

    this.touchActivity()

    // Get player inventory to find the item being used
    const inventory = await getPlayerInventory(playerId)
    const item = inventory.find((item) => item.id === playerItemId)

    if (!item) {
      return this.createErrorResult('use_item', 'Item not found in your inventory')
    }

    const itemSlug = item.template.slug
    if (!itemSlug) {
      return this.createErrorResult('use_item', 'Item slug not found')
    }

    // Capture item identity before the action runs — the item may be consumed.
    const itemName = item.template.name
    const itemMetadata = item.template.metadata || null

    // Execute the item-specific action
    const itemActionResult = await executeItemAction(
      itemSlug,
      itemAction,
      playerId,
      this,
      currentTickNumber,
      nextTickAt,
      playerItemId,
      item
    )

    if (itemActionResult === null) {
      return this.createErrorResult('use_item', `Action "${itemAction}" is not available for this item`)
    }

    // If the player is in battle, the item use also costs a turn — the enemy strikes.
    if (itemActionResult.success && this.activeBattles.get(playerId)?.isActive) {
      const effectText = extractEffectText(itemActionResult)
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'use_item',
        itemSlug,
        itemName,
        itemMetadata,
        actionVerb: itemAction,
        effectText,
      })
      return mergeSupportTurnIntoResult(itemActionResult, supportTurn)
    }

    return itemActionResult
  }

  async executeEquipItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('equip_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('equip_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await equipItem(playerId, playerItemId)

    if (!result.success) {
      return this.createErrorResult('equip_item', result.message)
    }

    const baseResult = {
      success: true,
      action: 'equip_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('equip_item', 'success', result.message, {
            inventory: result.inventory,
            player: result.player,
          }),
        },
      ],
    }

    if (this.activeBattles.get(playerId)?.isActive) {
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'equip_item',
        itemSlug: result.item?.slug,
        itemName: result.item?.name,
        itemMetadata: result.item?.metadata ?? null,
        actionVerb: 'equip',
        effectText: null,
      })
      return mergeSupportTurnIntoResult(baseResult, supportTurn)
    }

    return baseResult
  }

  async executeUnequipItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('unequip_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('unequip_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await unequipItem(playerId, playerItemId)

    if (!result.success) {
      return this.createErrorResult('unequip_item', result.message)
    }

    const baseResult = {
      success: true,
      action: 'unequip_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('unequip_item', 'success', result.message, {
            inventory: result.inventory,
            player: result.player,
          }),
        },
      ],
    }

    if (this.activeBattles.get(playerId)?.isActive) {
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'unequip_item',
        itemSlug: result.item?.slug,
        itemName: result.item?.name,
        itemMetadata: result.item?.metadata ?? null,
        actionVerb: 'unequip',
        effectText: null,
      })
      return mergeSupportTurnIntoResult(baseResult, supportTurn)
    }

    return baseResult
  }

  async executeAcceptQuest(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('accept_quest', 'Player not found in this room')
    }

    const { questId, choiceId } = action.data || {}
    if (!questId) {
      return this.createErrorResult('accept_quest', 'Quest ID is required')
    }

    this.touchActivity()

    const { playerAcceptQuest, getQuestDef } = require('./services/quest-service')

    // Load quest definition early to validate room context
    const questDef = getQuestDef(questId)
    if (!questDef) {
      return this.createErrorResult('accept_quest', 'Quest not found')
    }

    // Validate that player is in the quest giver's room
    if (!questDef.giver || !questDef.giver.roomId) {
      return this.createErrorResult('accept_quest', 'Quest giver information is missing')
    }

    if (this.roomId !== questDef.giver.roomId) {
      const npcName = this.getNpcFriendlyName(questDef.giver.npcId || 'the quest giver')
      return this.createErrorResult('accept_quest', `You need to speak to ${npcName} to do that.`)
    }

    // playerAcceptQuest: sets data.accepted=true, immediately completes no-requirement quests
    const result = await playerAcceptQuest(playerId, questId)

    if (!result.success) {
      return this.createErrorResult('accept_quest', result.error || 'Failed to accept quest')
    }

    const questTitle = questDef.title || questId
    // If the quest was immediately completed (no requirements), include full reward data
    const isCompleted = result.player != null
    const feedbackMessage = isCompleted
      ? `Quest completed: ${questTitle}`
      : `Quest accepted: ${questTitle}`

    const data = {
      roomId: this.roomId,
      quests: result.quests,
      ...(isCompleted ? { player: result.player, inventory: result.inventory } : {}),
    }

    const playerEvents = [
      {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('accept_quest', 'success', feedbackMessage, data),
      },
    ]

    if (result.levelUp?.leveled) {
      playerEvents.push({ event: 'player:level-up', payload: result.levelUp })
    }

    return {
      success: true,
      action: 'accept_quest',
      playerEvents,
    }
  }

  async executeCompleteQuest(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('complete_quest', 'Player not found in this room')
    }

    const { questId } = action.data || {}
    if (!questId) {
      return this.createErrorResult('complete_quest', 'Quest ID is required')
    }

    this.touchActivity()

    const { completeQuest, getQuestDef } = require('./services/quest-service')
    
    // Load quest definition early to validate room context
    const questDef = getQuestDef(questId)
    if (!questDef) {
      return this.createErrorResult('complete_quest', 'Quest not found')
    }

    // Validate that player is in the quest giver's room
    if (!questDef.giver || !questDef.giver.roomId) {
      return this.createErrorResult('complete_quest', 'Quest giver information is missing')
    }

    if (this.roomId !== questDef.giver.roomId) {
      const npcName = this.getNpcFriendlyName(questDef.giver.npcId || 'the quest giver')
      return this.createErrorResult('complete_quest', `You need to speak to ${npcName} to do that.`)
    }

    const result = await completeQuest(playerId, questId)

    if (!result.success) {
      return this.createErrorResult('complete_quest', result.error || 'Failed to complete quest')
    }

    const questTitle = questDef ? questDef.title : questId

    // Build rewards message. Item rewards are enriched with their template name
    // (and icon) so the completion modal and feedback text can display them.
    const rewards = questDef?.rewards || []
    const enrichedRewards = []
    const rewardMessages = []
    for (const reward of rewards) {
      if (reward.type === 'currency') {
        enrichedRewards.push(reward)
        rewardMessages.push(`${reward.amount} gold`)
      } else if (reward.type === 'xp') {
        enrichedRewards.push(reward)
        rewardMessages.push(`${reward.amount} XP`)
      } else if (reward.type === 'item') {
        const template = await getItemBySlug(reward.itemSlug)
        const name = template?.name || reward.itemSlug
        const quantity = reward.quantity || 1
        enrichedRewards.push({ ...reward, name, quantity, icon: template?.icon || null })
        rewardMessages.push(quantity > 1 ? `${name} x${quantity}` : name)
      } else {
        enrichedRewards.push(reward)
      }
    }
    const rewardText = rewardMessages.length > 0 ? ` You received: ${rewardMessages.join(', ')}.` : ''

    // Build quest chain message if new quests were started
    let questChainData = null
    let toastMessage = null
    if (result.startedQuestIds && result.startedQuestIds.length > 0) {
      const { getQuestDef } = require('./services/quest-service')
      
      // Map quest IDs to quest definitions and format as "(number) title"
      const questEntries = result.startedQuestIds
        .map(questId => {
          const def = getQuestDef(questId)
          return def ? { number: def.number, title: def.title } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.number - b.number)
        .map(q => `(${q.number}) ${q.title}`)
      
      const formattedMessage = `New quests: ${questEntries.join(', ')}.`
      
      questChainData = {
        startedQuestIds: result.startedQuestIds,
        message: formattedMessage,
      }
      toastMessage = formattedMessage
    }

    // Build new quest entries for the rewards panel
    const newQuestTitles = (result.startedQuestIds || [])
      .map(id => {
        const def = getQuestDef(id)
        return def ? { title: `(${def.number}) ${def.title}`, objective: def.objective || null } : null
      })
      .filter(Boolean)

    const data = {
      roomId: this.roomId,
      quests: result.quests,
      inventory: result.inventory,
      player: result.player,
      showModal: true,
      modalContent: {
        type: 'icon',
        icon: questDef.giver?.icon || 'scroll',
        iconColor: 'yellow-400',
        title: questDef.giver?.name || 'Quest Complete',
        header: 'Quest Complete!',
        message: questDef.completionDialog || null,
      },
      questComplete: {
        questTitle: questDef.title,
        rewards: enrichedRewards,
        levelUp: result.levelUp?.leveled ? result.levelUp : null,
        newQuestTitles,
      },
    }

    // Add quest chain data if quests were started
    if (questChainData) {
      data.questChain = questChainData
      data.toast = toastMessage
    }

    const playerEvents = [
      {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('complete_quest', 'success', `Quest completed: ${questTitle}.${rewardText}`, data),
      },
    ]

    if (result.levelUp?.leveled) {
      playerEvents.push({ event: 'player:level-up', payload: result.levelUp })
    }

    return {
      success: true,
      action: 'complete_quest',
      playerEvents,
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
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload(action, 'failure', message),
        },
      ],
    }
  }

  /**
   * Convert npcId to friendly name for error messages
   * @param {string} npcId - The NPC ID
   * @returns {string} Friendly NPC name
   */
  getNpcFriendlyName(npcId) {
    if (npcId === 'old_man') {
      return 'the Old Man'
    }
    return npcId
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
  SEARCH_LOOT_TABLES,
}
