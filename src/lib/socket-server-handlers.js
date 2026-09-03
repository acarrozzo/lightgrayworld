// Shared socket handling logic for server.js and socket-server.js
const { SOCKET_EVENTS, getSocketIdsForUser } = require('./socket-utils.js')
const partyStore = require('./services/party-store.js')
const { checkRoomGate, getGatedDirections } = require('./game-engine/room-gates.js')
const { getPlayerInventory } = require('./game-engine/services/inventory-service.js')
const {
  ROOM_ITEMS_SELECT,
  normalizeRoomData,
} = require('./game-engine/services/room-normalization.js')
const { getRoomEnemies, isProbabilistic, rollRoomEnemyGroup } = require('./game-data/room-enemies.js')
const {
  TELEPORT_MP_COST,
  getTeleportDestination,
  isTeleportDestinationOpen,
} = require('./game-data/teleport-destinations.js')
const { getMapSheetForRoom, getWorldRegionByHubRoom } = require('./game-data/world-map.js')
const { MAP_STATE_SELECT, projectMapState } = require('./game-engine/services/map-state.js')
const { debugLog } = require('./debug-log.js')
const {
  consumeTeleportGrant,
  clearTeleportGrants,
} = require('./game-engine/teleport-grants.js')
const { getEnemy } = require('./game-data/enemies.js')
const { loadRoomRoster } = require('./game-engine/services/room-roster-service.js')
const { ensureAutoRespawnItems } = require('./game-engine/services/room-item-service.js')
const { buildGatherCooldowns } = require('./game-engine/services/gather-status.js')
const { applyRoomQuestTrigger } = require('./game-engine/quest-room-triggers.js')
const { SPELL_SELECT, projectSpellState, unlockSpellTeacher } = require('./game-engine/services/spell-service.js')
const { getAllQuestProgress } = require('./game-engine/services/quest-service.js')
const {
  getRoomStateNote,
  getRoomActionOverrides,
  clearPlayerLevers,
  getExitOverlay: getLeverExitOverlay,
} = require('./game-engine/lever-state.js')
const {
  getRoomStateNote: getSearchRevealStateNote,
  getExitOverlay: getSearchRevealExitOverlay,
  clearPlayerReveals,
} = require('./game-engine/search-reveal-state.js')

// Constants
const ACTION_QUEUE_ERRORS = {
  QUEUE_FULL: 'QUEUE_FULL',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
}

const QUEUE_FULL_MESSAGE = 'Action queue is full. Please wait for pending actions to complete.'
const {
  DEFAULT_ACTION_TIMEOUT_MS,
} = require('./game-engine/player-action-queue.js')
const ACTION_TIMEOUT_MESSAGE = `Action timed out after ${DEFAULT_ACTION_TIMEOUT_MS}ms.`
const LAST_ACTIVE_PERSIST_INTERVAL = 60 * 1000
const { createWorldFeedEvent } = require('./services/world-feed-event-service.js')
const { createIdleDetectionService } = require('./services/idle-detection-service.js')
const { addGhost, removeGhost, getGhostsForRoom } = require('./services/ghost-player-store.js')
const {
  announcePresence,
  updatePresence,
  departPresence,
  buildPresenceSync,
} = require('./services/presence-store.js')

async function maybeStartAutoBattle({ socket, player, toRoom, gameEngine }) {
  if (isProbabilistic(toRoom)) {
    const destRoomState = gameEngine.getOrCreateRoom(toRoom)

    // Use a persisted enemy if transferPlayer already restored one for this room,
    // otherwise roll a fresh wave (the whole group at once).
    let slug = destRoomState.getPlayerActiveEnemy(player.id)
    if (!slug) {
      const group = rollRoomEnemyGroup(toRoom)
      destRoomState.setPlayerEnemyRoster(player.id, group)
      slug = group[0] || null
    }

    if (!slug) return

    const enemy = getEnemy(slug)
    if (!enemy) return

    // Notify the player about every enemy present on entry; out of battle they may
    // attack any of them.
    const roster = destRoomState.getPlayerEnemyRoster(player.id)
    const enemies = destRoomState.buildEnemyList(roster)
    const names = enemies.map((e) => e.name)
    const message = names.length <= 1
      ? `A ${enemy.name} is here!`
      : `${names.length} enemies are here: ${names.join(', ')}!`
    emitActionFeedback(socket, {
      action: 'enemy_spawn',
      message,
      outcome: 'danger',
      data: { enemySlug: slug, enemyName: enemy.name, enemy, enemies },
    })

    // A random present hostile enemy ambushes the player on entry.
    const targetSlug = destRoomState.pickHostileTarget(roster)
    if (!targetSlug) return

    if (destRoomState.activeBattles.has(player.id)) return
    try {
      await gameEngine.processUserAction({
        playerId: player.id,
        roomId: toRoom,
        action: { type: 'start_battle', data: { enemySlug: targetSlug, isAutoInitiated: true } },
      })
      console.log(`[Socket] Auto-battle started: ${player.username} vs ${targetSlug} in room ${toRoom}`)
    } catch (err) {
      console.error('[Socket] Failed to auto-start battle:', err)
      socket.emit('action:feedback', {
        action: 'start_battle',
        message: 'An enemy is here but failed to engage. Try attacking manually.',
        outcome: 'failure',
        ts: Date.now(),
        success: false,
      })
    }
    return
  }

  // Static rooms: always-present enemy logic.
  const roomEnemyConfig = getRoomEnemies(toRoom)
  if (!roomEnemyConfig) return

  const aggressiveSlug = roomEnemyConfig.enemies.find((slug) => {
    const e = getEnemy(slug)
    return e && e.isAggressive
  })
  if (!aggressiveSlug) return

  const destRoomState = gameEngine.getOrCreateRoom(toRoom)
  if (destRoomState.activeBattles.has(player.id)) return

  try {
    await gameEngine.processUserAction({
      playerId: player.id,
      roomId: toRoom,
      action: { type: 'start_battle', data: { enemySlug: aggressiveSlug, isAutoInitiated: true } },
    })
    console.log(`[Socket] Auto-battle started: ${player.username} vs ${aggressiveSlug} in room ${toRoom}`)
  } catch (err) {
    console.error('[Socket] Failed to auto-start battle:', err)
    socket.emit('action:feedback', {
      action: 'start_battle',
      message: 'An enemy is here but failed to engage. Try attacking manually.',
      outcome: 'failure',
      ts: Date.now(),
      success: false,
    })
  }
}

function emitActionFeedback(socket, payload) {
  const ts = payload.ts || Date.now()
  const success = payload.outcome === 'success'
  socket.emit(SOCKET_EVENTS.ACTION_FEEDBACK, {
    action: payload.action,
    message: payload.message,
    outcome: payload.outcome || 'info',
    ts,
    timestamp: new Date(ts).toISOString(),
    success,
    data: payload.data,
    eventType: payload.eventType,
    roomId: payload.roomId,
    actorId: payload.actorId,
    actorName: payload.actorName,
    actionId: payload.actionId,
    meta: payload.meta,
  })
}

// Create error handler factory
function createEmitQueueAwareError(socket) {
  return ({ actionName, player, error, fallbackMessage }) => {
    if (!error) {
      emitActionFeedback(socket, {
        action: actionName,
        message: fallbackMessage,
        outcome: 'failure',
      })
      return
    }

    if (error.code === ACTION_QUEUE_ERRORS.QUEUE_FULL) {
      console.warn(
        `[Socket] Action rejected due to queue overflow`,
        { playerId: player?.id, action: actionName }
      )
      emitActionFeedback(socket, {
        action: actionName,
        message: QUEUE_FULL_MESSAGE,
        outcome: 'failure',
        meta: { code: ACTION_QUEUE_ERRORS.QUEUE_FULL },
      })
      return
    }

    if (error.code === ACTION_QUEUE_ERRORS.ACTION_TIMEOUT) {
      console.error(
        `[Socket] Action timed out`,
        { playerId: player?.id, action: actionName }
      )
      emitActionFeedback(socket, {
        action: actionName,
        message: ACTION_TIMEOUT_MESSAGE,
        outcome: 'failure',
        meta: { code: ACTION_QUEUE_ERRORS.ACTION_TIMEOUT },
      })
      return
    }

    emitActionFeedback(socket, {
      action: actionName,
      message: fallbackMessage,
      outcome: 'failure',
    })
  }
}

async function recordWorldFeedEventSafe({ userId, username, eventType }) {
  try {
    await createWorldFeedEvent({ userId, username, eventType })
  } catch (error) {
    console.error('[WorldFeed] Failed to record event', { userId, username, eventType, error })
  }
}

/**
 * Move a connection between socket rooms and tell both rooms about it.
 *
 * Everything the rest of the server reads — socket-room membership, the live
 * player record, presence, party groupings — is updated synchronously before
 * this returns, so callers may start work in the new room (the ambush roll)
 * straight away. Only the database write is still in flight; the returned
 * promise settles when it has landed, for callers that need to know.
 */
function createTransitionPlayerRoom(io, prisma, socket, activePlayers, roomPlayers, broadcastRoomPartyState) {
  return ({ player, fromRoom, toRoom, exitDirection, entryDirection, isTeleport = false }) => {
    if (!toRoom || fromRoom === toRoom) {
      return Promise.resolve()
    }

    socket.leave(`room-${fromRoom}`)
    if (roomPlayers.has(fromRoom)) {
      roomPlayers.get(fromRoom).delete(socket.id)
      socket.to(`room-${fromRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        id: player.id,
        username: player.username,
        exitDirection: exitDirection || null,
        isTeleport: isTeleport || false,
        reason: 'move',
      })
    }

    socket.join(`room-${toRoom}`)
    if (!roomPlayers.has(toRoom)) {
      roomPlayers.set(toRoom, new Set())
    }
    roomPlayers.get(toRoom).add(socket.id)

    // Clear any ghost entry for this player in the destination room
    removeGhost(toRoom, player.id)

    socket.to(`room-${toRoom}`).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      id: player.id,
      username: player.username,
      level: player.level,
      hp: player.hp,
      hpMax: player.hpMax,
      mp: player.mp,
      mpMax: player.mpMax,
      currentRoom: toRoom,
      isActive: true,
      uIcon: player.uIcon ?? null,
      uIconColor: player.uIconColor ?? null,
      str: player.str ?? null,
      dex: player.dex ?? null,
      mag: player.mag ?? null,
      def: player.def ?? null,
      strMod: player.strMod ?? null,
      dexMod: player.dexMod ?? null,
      magMod: player.magMod ?? null,
      defMod: player.defMod ?? null,
      partyLeaderId: partyStore.getLeaderId(player.id),
      entryDirection: entryDirection || null,
      isTeleport: isTeleport || false,
    })

    // Remember where the player came from so a flee can retreat them back here.
    player.previousRoom = fromRoom
    player.currentRoom = toRoom
    // The room-scoped events above tell the two rooms involved; this tells everyone
    // else's roster where the player went.
    updatePresence(io, player.id, { currentRoom: toRoom, status: 'active' })
    // Re-broadcast party groupings so the mover (and the room) see current parties.
    if (broadcastRoomPartyState) broadcastRoomPartyState(toRoom)
    activePlayers.set(socket.id, player)

    return prisma.user
      .update({
        where: { id: player.id },
        data: { currentRoom: toRoom },
      })
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to persist player room change', error)
      })
  }
}

const ROOM_EXIT_SELECT = {
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
}

/**
 * Just a room's exits: enough to derive the direction of a move and check
 * that one exists. A single narrow read — the source room of a move used to be
 * fetched with its items and NPCs attached, several round trips for ten
 * columns, on every step.
 */
async function fetchRoomExits(prisma, roomId) {
  if (!roomId) return null
  return prisma.room.findUnique({ where: { roomId }, select: ROOM_EXIT_SELECT })
}

// Standard room query - ensures nameColor and subtitleColor are included.
// Deliberately without the `players` relation: who is in a room is live
// server state (see buildLiveRoomPlayers), not the database's last-known
// `currentRoom` of every account.
async function fetchRoomWithColors(prisma, roomId) {
  const room = await prisma.room.findUnique({
    where: { roomId },
    select: {
      id: true,
      roomId: true,
      name: true,
      subtitle: true,
      subtitlePosition: true,
      region: true,
      nameColor: true,
      subtitleColor: true,
      icon: true,
      iconColor: true,
      iconSize: true,
      directionColors: true,
      description: true,
      dangerLevel: true,
      isSafe: true,
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
      ...ROOM_ITEMS_SELECT,
      npcs: true,
    },
  })

  return normalizeRoomData(room)
}

// Direction finding helpers for entry/exit messages
const DIRECTION_KEYS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down']

function findDirectionKey(room, targetRoomId) {
  if (!room || !targetRoomId) {
    return null
  }

  for (const key of DIRECTION_KEYS) {
    if (room[key] === targetRoomId) {
      return key
    }
  }

  return null
}

/**
 * Everything arriving in `toRoom` discovers, in one write: the map sheet the
 * room is drawn on, and — when the room is a region's fast-travel hub — that
 * region's teleport. Each check is against what the player already carries, so
 * the write happens once per sheet or hub. The player hears about it through
 * action:feedback, whose `data.player` the client merges into its store; the
 * feed shows the line the original printed when you found a map.
 *
 * Resolves once persisted and mirrored onto the live player record; resolves
 * immediately when there is nothing new, which is almost every move.
 */
async function applyArrivalDiscoveries(prisma, socket, player, toRoom) {
  const unlocks = {}
  const messages = []

  const sheet = getMapSheetForRoom(toRoom)
  if (sheet?.flag && !player[sheet.flag]) {
    unlocks[sheet.flag] = true
    messages.push(`You found the ${sheet.title} map.`)
  }

  const hubRegion = getWorldRegionByHubRoom(toRoom)
  if (hubRegion && !hubRegion.alwaysOpen) {
    const discovered = Array.isArray(player.discoveredTeleports) ? player.discoveredTeleports : []
    if (!discovered.includes(hubRegion.id)) {
      unlocks.discoveredTeleports = [...discovered, hubRegion.id]
      messages.push(`Fast travel to ${hubRegion.name} is now open.`)
    }
  }

  if (Object.keys(unlocks).length === 0) return

  try {
    await prisma.user.update({ where: { id: player.id }, data: unlocks })
    Object.assign(player, unlocks)
    emitActionFeedback(socket, {
      action: 'discovery',
      message: messages.join(' '),
      outcome: 'success',
      data: { roomId: toRoom, player: unlocks },
    })
  } catch (error) {
    console.error(`[Socket] Error recording discoveries for room ${toRoom}:`, error)
  }
}

/**
 * Whether `player` may fast travel to `toRoomId` through the fixed network.
 *
 *  - `{ ok: false }`            — not a network destination; the caller falls
 *                                 through to the per-use grants.
 *  - `{ ok: false, reason }`    — a network hub the player has not found, or
 *                                 cannot afford. Refuse with the reason.
 *  - `{ ok: true, charge }`     — allowed; settle `charge` once the move lands.
 *
 * Discovery and MP are read from the row, not the live record: a second socket
 * for the same account may have unlocked a hub or spent the MP a moment ago.
 */
async function authorizeNetworkTeleport(prisma, player, toRoomId) {
  const destination = getTeleportDestination(toRoomId)
  if (!destination) return { ok: false }

  const row = await prisma.user.findUnique({
    where: { id: player.id },
    select: { mp: true, discoveredTeleports: true },
  })
  if (!row) return { ok: false, reason: 'Player not found' }

  if (!isTeleportDestinationOpen(destination, row.discoveredTeleports)) {
    return { ok: false, reason: `You have not found ${destination.name} yet.` }
  }
  if (row.mp < TELEPORT_MP_COST) {
    return { ok: false, reason: `You need ${TELEPORT_MP_COST} MP to teleport. Rest first.` }
  }
  return { ok: true, charge: { cost: TELEPORT_MP_COST, destination } }
}

/**
 * Take the MP for a network fast travel that has just landed. Clamped at zero
 * in the database rather than trusted from memory, then mirrored to the live
 * record, the room's live vitals, the roster, and the mover's own store
 * (action:feedback `data.mp`, which the client already merges).
 */
async function chargeTeleport({ prisma, io, socket, gameEngine, player, toRoom, charge }) {
  if (!charge) return
  try {
    const rows = await prisma.$queryRawUnsafe(
      `UPDATE "User" SET mp = GREATEST(mp - $2, 0) WHERE id = $1 RETURNING mp`,
      player.id,
      charge.cost
    )
    const row = rows?.[0]
    if (!row) return
    const mp = Number(row.mp)
    player.mp = mp
    gameEngine?.rooms?.get?.(toRoom)?.updatePlayer?.(player.id, (state) => ({ ...state, mp }))
    io.to(`room-${toRoom}`).emit(SOCKET_EVENTS.PLAYER_VITALS, { id: player.id, roomId: toRoom, mp })
    updatePresence(io, player.id, { mp })
    emitActionFeedback(socket, {
      action: 'teleport',
      message: `Fast travel to ${charge.destination.name}: ${charge.cost} MP.`,
      outcome: 'success',
      data: { roomId: toRoom, mp },
    })
  } catch (error) {
    console.error(`[Socket] Error charging teleport MP for ${player.username}:`, error)
  }
}

/**
 * Quests that open by arriving somewhere (town quest givers). `toRoom` is the
 * engine-confirmed destination, not the client's request. The quest list rides
 * on action:feedback's `data.quests`, which the client already folds into its
 * store — no bespoke event needed.
 */
async function announceRoomQuest(socket, player, toRoom) {
  try {
    const started = await applyRoomQuestTrigger(player.id, toRoom)
    if (!started) return
    const quests = await getAllQuestProgress(player.id)
    socket.emit('action:feedback', {
      action: 'quest started',
      message: `You have work from ${started.npc}: ${started.quest.title}.`,
      outcome: 'success',
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      success: true,
      data: { roomId: toRoom, quests },
    })
  } catch (error) {
    console.error('[Socket] Error applying room quest trigger:', error)
  }
}

/**
 * Spell teachers met by walking in (the Pajama Shaman's crash course). Same
 * shape as the arrival quest: the flag is written once, guarded server-side,
 * and the player hears about it through action:feedback, whose `data.player`
 * the client already merges into its store — so the spellbook's caps update
 * without a bespoke event.
 */
async function announceSpellTeacher(prisma, socket, player, toRoom) {
  try {
    const met = await unlockSpellTeacher(prisma, player.id, toRoom)
    if (!met) return
    player.spellTeachers = met.spellTeachers
    socket.emit('action:feedback', {
      action: 'spell teacher',
      message: met.message,
      outcome: 'success',
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      success: true,
      data: { roomId: toRoom, player: { spellTeachers: met.spellTeachers } },
    })
  } catch (error) {
    console.error('[Socket] Error unlocking spell teacher:', error)
  }
}

// Setup socket handlers
function setupSocketHandlers(io, gameEngine, prisma, activePlayers, roomPlayers, userIdToSocketIds = new Map()) {
  const idleDetectionService = createIdleDetectionService({
    activePlayers,
    onStateChange: (userId, username, roomId, isIdle) => {
      if (!roomId) return
      if (isIdle) {
        // Find full player data for the ghost entry
        let playerData = null
        for (const p of activePlayers.values()) {
          if (p.id === userId) { playerData = p; break }
        }
        if (playerData) addGhost(roomId, playerData, 'idle')
        io.to(`room-${roomId}`).emit(SOCKET_EVENTS.PLAYER_IDLE, {
          id: userId,
          username,
          roomId,
          lastSeen: Date.now(),
        })
        updatePresence(io, userId, { status: 'idle' })
      } else {
        removeGhost(roomId, userId)
        io.to(`room-${roomId}`).emit(SOCKET_EVENTS.PLAYER_RETURNED, {
          id: userId,
          username,
          roomId,
        })
        updatePresence(io, userId, { status: 'active' })
      }
    },
  })
  idleDetectionService.start()
  const lastActivityPersistedAt = new Map()

  // Find an online player's live state by user id (activePlayers is keyed by socket id).
  const findActivePlayerById = (playerId) => {
    for (const p of activePlayers.values()) {
      if (p.id === playerId) return p
    }
    return null
  }

  // Compute the party-leader mapping for the given room, used by the client to group
  // co-located players by their party (including parties the viewer isn't part of).
  const buildRoomPartyState = (roomId) => {
    const socketIds = roomPlayers.get(roomId)
    const members = []
    if (socketIds) {
      for (const sid of socketIds) {
        const p = activePlayers.get(sid)
        if (p) members.push({ id: p.id, partyLeaderId: partyStore.getLeaderId(p.id) })
      }
    }
    return members
  }

  // Broadcast the current room's party groupings to everyone in it. Call after any
  // event that changes who-is-partied-with-whom among co-located players.
  const broadcastRoomPartyState = (roomId) => {
    if (!roomId) return
    const members = buildRoomPartyState(roomId)
    io.to(`room-${roomId}`).emit(SOCKET_EVENTS.ROOM_PARTY_STATE, {
      roomId,
      members,
    })
    // Every party mutation (follow / leave / remove / disconnect) funnels through
    // here, so this is the one place the global roster needs to learn about them.
    for (const member of members) {
      updatePresence(io, member.id, { partyLeaderId: member.partyLeaderId })
    }
  }

  const toPartyInfo = (p) => ({
    id: p.id,
    username: p.username,
    level: p.level ?? 1,
    uIcon: p.uIcon ?? null,
    uIconColor: p.uIconColor ?? null,
  })

  // After a party leader travels, pull every same-room member into the destination.
  // Members are pinned to the leader, so this is the only way they move.
  const pullPartyMembers = async ({
    leaderId,
    fromRoom,
    toRoom,
    toRoomName,
    normalizedRoomData,
    exitDirection,
    entryDirection,
    isTeleport,
    // Whether members may skip the adjacency requirement. Deliberately separate
    // from `isTeleport`, which only shapes the room enter/leave messaging: an
    // authorization decision must never ride on a presentation flag.
    authorizedMove = false,
    // The leader's source-room exits, already read for the leader's own move.
    // Members stand in the same room, so the engine can derive each member's
    // direction from them instead of re-reading the room per member.
    sourceExits = null,
  }) => {
    const memberIds = partyStore.getLeaderMemberIds(leaderId)
    if (!memberIds.length) return

    for (const memberId of memberIds) {
      const memberPlayer = findActivePlayerById(memberId)
      if (!memberPlayer) continue // offline (should already be detached)
      if (memberPlayer.currentRoom !== fromRoom) continue // not co-located
      if ((memberPlayer.hp ?? 0) <= 0) continue // dead — being respawned/dropped

      try {
        const result = await gameEngine.processUserAction({
          playerId: memberId,
          roomId: fromRoom,
          action: {
            type: 'move',
            // A leader's teleport carries the party with it, so members skip the
            // adjacency requirement exactly when the leader did. A directional
            // move is left unauthorized on purpose: the engine re-derives the
            // direction per member and re-runs that member's own gate, which is
            // what keeps a member from being dragged through a gate they fail.
            authorizedMove: authorizedMove === true,
            sourceExits,
            data: { toRoom, toRoomName, roomData: normalizedRoomData },
          },
        })
        if (!result || result.success !== true) continue

        for (const sid of getSocketIdsForUser(memberId)) {
          const memberSocket = io.sockets.sockets.get(sid)
          if (!memberSocket) continue
          const memberTransition = createTransitionPlayerRoom(io, prisma, memberSocket, activePlayers, roomPlayers, broadcastRoomPartyState)
          await memberTransition({ player: memberPlayer, fromRoom, toRoom, exitDirection, entryDirection, isTeleport })
          // Dedicated event: the member didn't initiate this move, so the normal
          // action:confirmed/feedback path (which requires a pending move) would ignore it.
          memberSocket.emit(SOCKET_EVENTS.PARTY_PULLED, {
            fromRoom,
            toRoom,
            toRoomName,
            roomData: normalizedRoomData,
          })
          await maybeStartAutoBattle({ socket: memberSocket, player: memberPlayer, toRoom, gameEngine })
          // A member pulled into a hub has stood in it just as the leader has.
          await applyArrivalDiscoveries(prisma, memberSocket, memberPlayer, toRoom)
        }
      } catch (err) {
        console.error(`[Party] Failed to pull member ${memberId} from ${fromRoom} to ${toRoom}:`, err)
      }
    }
  }

  /**
   * The room's occupants as the server knows them right now: every live
   * connection in the room, then the ghosts of players who went idle or dropped
   * there — the same answer the HTTP room load gives. The socket move payload
   * used to read the destination's `players` relation from the database
   * instead: every account whose last known room this was, logged out or not.
   * So walking into a room could show people who were not there, and never
   * showed the ghosts a refresh would.
   *
   * `arrivingPlayer` is the mover, who is not in the room's socket set yet
   * when the payload is built. The client filters itself out of the room list,
   * but the HTTP load includes the viewer and the shape should not differ.
   */
  const buildLiveRoomPlayers = (roomId, arrivingPlayer) => {
    const roomState = gameEngine.getOrCreateRoom(roomId)
    const ghosts = new Map(getGhostsForRoom(roomId).map((g) => [g.id, g]))
    const seen = new Set()
    const players = []

    const pushLive = (p) => {
      if (!p?.id || seen.has(p.id)) return
      seen.add(p.id)
      const battle = roomState.activeBattles.get(p.id)
      // A player can be connected and idle at once; the ghost entry is what
      // remembers that, and the room list shows it the way a live idle event would.
      const idleGhost = ghosts.get(p.id)
      const isIdle = idleGhost?.status === 'idle'
      players.push({
        id: p.id,
        username: p.username,
        level: p.level,
        hp: p.hp,
        hpMax: p.hpMax,
        mp: p.mp,
        mpMax: p.mpMax,
        currentRoom: roomId,
        isActive: true,
        uIcon: p.uIcon ?? null,
        uIconColor: p.uIconColor ?? null,
        str: p.str ?? null,
        dex: p.dex ?? null,
        mag: p.mag ?? null,
        def: p.def ?? null,
        strMod: p.strMod ?? null,
        dexMod: p.dexMod ?? null,
        magMod: p.magMod ?? null,
        defMod: p.defMod ?? null,
        inBattle: Boolean(battle && battle.isActive),
        partyLeaderId: partyStore.getLeaderId(p.id),
        presenceStatus: isIdle ? 'idle' : 'active',
        ...(isIdle ? { lastSeen: idleGhost.lastSeen } : {}),
      })
    }

    if (arrivingPlayer) pushLive(arrivingPlayer)
    for (const sid of roomPlayers.get(roomId) ?? []) pushLive(activePlayers.get(sid))
    for (const ghost of ghosts.values()) {
      if (seen.has(ghost.id)) continue
      seen.add(ghost.id)
      players.push({ ...ghost, presenceStatus: ghost.status ?? 'disconnected' })
    }
    return players
  }

  /**
   * The destination room as this player will see it: the room record plus
   * everything per-player or live that the database does not hold — exit
   * overlays for passages they have not opened, lever and reveal notes, the
   * static enemy list, who is standing there, and the gather countdowns. One
   * builder for both ways of arriving, so a teleport into a lever room shows
   * the same exits a walk in would.
   */
  const buildDestinationRoomData = ({ destinationRoom, toRoom, player, gatherCooldowns }) => {
    // Probabilistic rooms start with no enemies — the spawn roll happens in
    // maybeStartAutoBattle after the move succeeds, and the client is told via
    // an enemy_spawn action:feedback.
    const destEnemyConfig = getRoomEnemies(toRoom)
    const destEnemies =
      destEnemyConfig && !isProbabilistic(toRoom)
        ? destEnemyConfig.enemies.map((slug) => getEnemy(slug)).filter(Boolean)
        : []

    const leverStateNote = getRoomStateNote(player.id, toRoom)
    const searchRevealStateNote = getSearchRevealStateNote(player.id, toRoom)
    // Both overlays mask DB-canonical exits the player has not opened yet:
    // search reveals (hidden passages) and levers (the Kobold false wall).
    const exitOverlay = {
      ...(getLeverExitOverlay(player.id, toRoom) || {}),
      ...(getSearchRevealExitOverlay(player.id, toRoom) || {}),
    }

    return {
      ...destinationRoom,
      ...exitOverlay,
      players: buildLiveRoomPlayers(toRoom, player),
      items: Array.isArray(destinationRoom.items) ? destinationRoom.items : [],
      npcs: Array.isArray(destinationRoom.npcs) ? destinationRoom.npcs : [],
      enemies: destEnemies,
      stateNote: leverStateNote || searchRevealStateNote || null,
      actionOverrides: getRoomActionOverrides(player.id, toRoom),
      gatedExits: getGatedDirections(toRoom),
      // Always an array: an empty one tells the client the room has no gather
      // action, so it need not ask over HTTP.
      gatherCooldowns: Array.isArray(gatherCooldowns) ? gatherCooldowns : [],
    }
  }

  /**
   * Read the destination for a move. The respawn check must precede the room
   * read (it may create the rows the read returns); the player's gather
   * countdowns depend on neither and go out alongside.
   */
  const loadDestination = async (player, toRoom) => {
    const [destinationRoom, gatherCooldowns] = await Promise.all([
      ensureAutoRespawnItems(toRoom).then(() => fetchRoomWithColors(prisma, toRoom)),
      buildGatherCooldowns(player.id, toRoom),
    ])
    return { destinationRoom, gatherCooldowns }
  }

  // True if any same-room member of this leader's party is locked in battle.
  const partyMemberInBattle = (leaderId, roomId) => {
    const memberIds = partyStore.getLeaderMemberIds(leaderId)
    if (!memberIds.length) return false
    const roomState = gameEngine.getOrCreateRoom(roomId)
    for (const memberId of memberIds) {
      const battle = roomState.activeBattles.get(memberId)
      if (battle && battle.isActive) return true
    }
    return false
  }

  // If a same-room member can't pass the gate the leader is using, return who/why.
  // Gates are per-player (weapon/quest/level/wings/lever/reveal), so a member may fail
  // a gate the leader passed. Only directional moves have gates (teleport bypasses them).
  const partyMemberGateBlocked = async (leaderId, fromRoom, direction) => {
    if (!direction) return null
    const memberIds = partyStore.getLeaderMemberIds(leaderId)
    if (!memberIds.length) return null
    for (const memberId of memberIds) {
      const memberPlayer = findActivePlayerById(memberId)
      if (!memberPlayer || memberPlayer.currentRoom !== fromRoom) continue
      if ((memberPlayer.hp ?? 0) <= 0) continue
      const gateResult = await checkRoomGate(fromRoom, direction, memberId)
      if (gateResult && !gateResult.allowed) {
        return { memberName: memberPlayer.username, message: gateResult.gate?.message || 'cannot pass this way.' }
      }
    }
    return null
  }

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

    const emitQueueAwareError = createEmitQueueAwareError(socket)
    const transitionPlayerRoom = createTransitionPlayerRoom(io, prisma, socket, activePlayers, roomPlayers, broadcastRoomPartyState)
    const touchPlayerActivity = (player) => {
      if (!player || !player.id) {
        return
      }

      const now = Date.now()
      player.lastActive = new Date(now)
      const wasIdle = idleDetectionService.markUserActive(player.id)

      // Any action means the player is no longer idle. Broadcast the return
      // immediately (and clear their ghost) rather than waiting for the next
      // idle-detection tick, which markUserActive would otherwise suppress.
      if (wasIdle && player.currentRoom) {
        removeGhost(player.currentRoom, player.id)
        io.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_RETURNED, {
          id: player.id,
          username: player.username,
          roomId: player.currentRoom,
        })
        updatePresence(io, player.id, { status: 'active' })
        createWorldFeedEvent({ userId: player.id, username: player.username, eventType: 'return' }).catch((error) => {
          console.error('[Socket] Failed to create return world feed event', error)
        })
      }

      const lastPersisted = lastActivityPersistedAt.get(player.id) || 0
      if (now - lastPersisted >= LAST_ACTIVE_PERSIST_INTERVAL) {
        lastActivityPersistedAt.set(player.id, now)
        prisma.user
          .update({
            where: { id: player.id },
            data: { lastActive: new Date(now), isActive: true },
          })
          .catch((error) => {
            console.error('[Socket] Failed to persist lastActive timestamp', error)
          })
      }
    }

    // Handle player login (server-authoritative; ignores client payload)
    socket.on(SOCKET_EVENTS.PLAYER_LOGIN, async () => {
      const authUser = socket.data?.user
      console.log(`[Server] PLAYER_LOGIN received for socket ${socket.id}, auth user:`, authUser?.username)

      if (!authUser || !authUser.userId) {
        socket.emit('auth:error', { message: 'Not authenticated' })
        socket.disconnect(true)
        return
      }

      try {
        const previousState = activePlayers.get(socket.id)
        if (previousState?.id && previousState.id !== authUser.userId) {
          const previousSocketSet = userIdToSocketIds.get(previousState.id)
          if (previousSocketSet) {
            previousSocketSet.delete(socket.id)
            if (previousSocketSet.size === 0) {
              userIdToSocketIds.delete(previousState.id)
            }
          }
        }
        const previousRoom = previousState?.currentRoom

        const dbPlayer = await prisma.user.findUnique({
          where: { id: authUser.userId },
          select: {
            id: true,
            username: true,
            level: true,
            hp: true,
            hpMax: true,
            mp: true,
            mpMax: true,
            currentRoom: true,
            isActive: true,
            uIcon: true,
            uIconColor: true,
            str: true,
            dex: true,
            mag: true,
            def: true,
            strMod: true,
            dexMod: true,
            magMod: true,
            defMod: true,
            physicalTraining: true,
            mentalTraining: true,
            ...MAP_STATE_SELECT,
            ...SPELL_SELECT,
          },
        })

        if (!dbPlayer || !dbPlayer.isActive) {
          socket.emit('auth:error', { message: 'Player not found or inactive' })
          socket.disconnect(true)
          return
        }

        const playerData = {
          id: dbPlayer.id,
          username: dbPlayer.username,
          level: dbPlayer.level,
          hp: dbPlayer.hp,
          hpMax: dbPlayer.hpMax,
          mp: dbPlayer.mp,
          mpMax: dbPlayer.mpMax,
          currentRoom: dbPlayer.currentRoom,
          isActive: dbPlayer.isActive,
          uIcon: dbPlayer.uIcon ?? null,
          uIconColor: dbPlayer.uIconColor ?? null,
          str: dbPlayer.str,
          dex: dbPlayer.dex,
          mag: dbPlayer.mag,
          def: dbPlayer.def,
          strMod: dbPlayer.strMod,
          dexMod: dbPlayer.dexMod,
          magMod: dbPlayer.magMod,
          defMod: dbPlayer.defMod,
          physicalTraining: dbPlayer.physicalTraining,
          mentalTraining: dbPlayer.mentalTraining,
          // Map sheets found and fast-travel hubs discovered, so the Map view
          // and the Fast travel grid open in the right state on reconnect.
          ...projectMapState(dbPlayer),
          // Spell levels and the teachers met, so a reconnect restores the
          // battle Spells tab and the spellbook's caps along with everything else.
          ...projectSpellState(dbPlayer),
          socketId: socket.id,
          lastActive: new Date(),
        }

        activePlayers.set(socket.id, playerData)
        if (!userIdToSocketIds.has(playerData.id)) {
          userIdToSocketIds.set(playerData.id, new Set())
        }
        userIdToSocketIds.get(playerData.id).add(socket.id)
        touchPlayerActivity(playerData)
        announcePresence(io, playerData, { partyLeaderId: partyStore.getLeaderId(playerData.id) })
        console.log(`[Server] Player ${playerData.username} registered in activePlayers for socket ${socket.id}`)
        console.log(`[Server] activePlayers now has ${activePlayers.size} entries`)

        if (previousRoom && previousRoom !== playerData.currentRoom) {
          console.log(
            `[Server] Player ${playerData.username} moving socket room from ${previousRoom} to ${playerData.currentRoom}`
          )
          socket.leave(`room-${previousRoom}`)
          if (roomPlayers.has(previousRoom)) {
            roomPlayers.get(previousRoom).delete(socket.id)
          }
        }

        if (!roomPlayers.has(playerData.currentRoom)) {
          roomPlayers.set(playerData.currentRoom, new Set())
        }

        const roomSet = roomPlayers.get(playerData.currentRoom)
        if (!roomSet.has(socket.id)) {
          socket.join(`room-${playerData.currentRoom}`)
          roomSet.add(socket.id)

          // Clear any existing ghost for this player in their room (they're back)
          removeGhost(playerData.currentRoom, playerData.id)

          socket.to(`room-${playerData.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_JOINED, {
            id: playerData.id,
            username: playerData.username,
            level: playerData.level,
            hp: playerData.hp,
            hpMax: playerData.hpMax,
            mp: playerData.mp,
            mpMax: playerData.mpMax,
            currentRoom: playerData.currentRoom,
            isActive: true,
            uIcon: playerData.uIcon ?? null,
            uIconColor: playerData.uIconColor ?? null,
            str: playerData.str ?? null,
            dex: playerData.dex ?? null,
            mag: playerData.mag ?? null,
            def: playerData.def ?? null,
            strMod: playerData.strMod ?? null,
            dexMod: playerData.dexMod ?? null,
            magMod: playerData.magMod ?? null,
            defMod: playerData.defMod ?? null,
            partyLeaderId: partyStore.getLeaderId(playerData.id),
            entryDirection: null, // No direction info on initial login
            isTeleport: false, // Login is not a teleport
          })
          // Update existing room occupants' view to include the newcomer's grouping.
          broadcastRoomPartyState(playerData.currentRoom)
        }

        gameEngine.registerPlayer({
          id: playerData.id,
          username: playerData.username,
          roomId: playerData.currentRoom,
          hp: playerData.hp,
          hpMax: playerData.hpMax,
          mp: playerData.mp,
          mpMax: playerData.mpMax,
          level: playerData.level,
          physicalTraining: playerData.physicalTraining,
          mentalTraining: playerData.mentalTraining,
          socketId: socket.id,
        })
        console.log(`[Server] Registered ${playerData.username} with engine in room ${playerData.currentRoom}`)

        console.log(`Player ${playerData.username} joined room ${playerData.currentRoom}`)

        // Send initial inventory snapshot to client
        const inventory = await getPlayerInventory(playerData.id)
        const roomGhosts = getGhostsForRoom(playerData.currentRoom).filter((g) => g.id !== playerData.id)
        // Session state the client cannot infer from a fresh page load. After a
        // full disconnect both are usually null — and sending the nulls is the
        // point: they are what let the client clear a phantom battle panel
        // (which blocks movement and teleport) or a party strip left standing
        // from before the connection dropped. Those events were missed while
        // the client was away, so nothing else would ever correct them.
        const activeBattle = gameEngine
          .getOrCreateRoom(playerData.currentRoom)
          .activeBattles.get(playerData.id)
        const battleResume =
          activeBattle && activeBattle.isActive
            ? activeBattle.getResumeSnapshot({
                playerHp: playerData.hp,
                playerHpMax: playerData.hpMax,
              })
            : null

        socket.emit('login:success', {
          player: playerData,
          inventory,
          roomGhosts,
          // Initial party groupings for this room (covers the listener-attach race
          // where a room broadcast would fire before the client is listening).
          roomPartyState: buildRoomPartyState(playerData.currentRoom),
          party: partyStore.getPartySnapshot(playerData.id),
          battle: battleResume,
        })

        // Full global roster for the Players tab. Deltas (world:presence-update)
        // follow on the same socket, so ordering guarantees no gap between the two.
        socket.emit(SOCKET_EVENTS.WORLD_PRESENCE_SYNC, buildPresenceSync())

        // Restore any persisted enemy roster for the current room so a refresh resumes
        // the exact wave that was there (full-HP battles) — this closes the "refresh to
        // reset the room" exploit. If nothing is persisted (the room was empty or fully
        // cleared), maybeStartAutoBattle rolls a fresh spawn check instead, same as
        // entering the room. Restored aggressive enemies ambush with a free hit, same
        // as walking in. Runs after login:success so the client has room context.
        if (isProbabilistic(playerData.currentRoom)) {
          try {
            const savedRoster = await loadRoomRoster(playerData.id, playerData.currentRoom)
            if (savedRoster && savedRoster.length) {
              const destRoomState = gameEngine.getOrCreateRoom(playerData.currentRoom)
              destRoomState.setPlayerEnemyRoster(playerData.id, savedRoster)
            }
          } catch (err) {
            console.error('[Socket] Failed to restore persisted room roster:', err)
          }
        }
        await maybeStartAutoBattle({ socket, player: playerData, toRoom: playerData.currentRoom, gameEngine })

        recordWorldFeedEventSafe({
          userId: playerData.id,
          username: playerData.username,
          eventType: 'login',
        })
      } catch (error) {
        console.error('Error handling player login:', error)
        socket.emit('auth:error', { message: 'Failed to process login' })
        socket.disconnect(true)
      }
    })

    // Handle player movement
    socket.on('player-move', async (data) => {
      console.log(`[Socket] player-move event received from ${socket.id}:`, data)
      const player = activePlayers.get(socket.id)
      if (!player) {
        console.log(`[Socket] player-move - Player not found for socket ${socket.id}`)
        emitActionFeedback(socket, {
          action: 'move',
          message: 'Player not found',
          outcome: 'failure',
        })
        return
      }

      touchPlayerActivity(player)

      // Party members are pinned to their leader — they can't travel on their own.
      if (partyStore.isMember(player.id)) {
        emitActionFeedback(socket, {
          action: 'move',
          message: 'You are following your party. Leave the party to move freely.',
          outcome: 'failure',
        })
        return
      }

      // The server's own record of where this player stands. A client-supplied
      // `fromRoom` would aim the reachability and gate checks at another room's
      // exits, so it is ignored entirely.
      const fromRoom = player.currentRoom
      const toRoom = data?.toRoom

      console.log(`[Socket] player-move - ${player.username} moving from ${fromRoom} to ${toRoom}`)

      if (!toRoom) {
        console.log(`[Socket] player-move - Destination room missing`)
        emitActionFeedback(socket, {
          action: 'move',
          message: 'Destination room missing',
          outcome: 'failure',
        })
        return
      }

      // A leader can't travel while any same-room party member is still in battle.
      if (partyStore.isLeader(player.id) && partyMemberInBattle(player.id, fromRoom)) {
        emitActionFeedback(socket, {
          action: 'move',
          message: 'You cannot travel while a party member is in battle.',
          outcome: 'failure',
        })
        return
      }

      try {
        const sourceExits = await fetchRoomExits(prisma, fromRoom)
        if (!sourceExits) {
          console.log(`[Socket] player-move - Source room ${fromRoom} not found`)
          emitActionFeedback(socket, {
            action: 'move',
            message: 'Source room not found',
            outcome: 'failure',
          })
          return
        }

        // Refuse a destination this room has no exit to, before anything writes.
        // The engine re-derives and re-validates this itself — that check is the
        // authority — but rejecting here keeps an arbitrary destination from
        // reaching ensureAutoRespawnItems, which creates item rows in whatever
        // room it is handed.
        const direction = findDirectionKey(sourceExits, toRoom)

        // The client sends teleports through this same event, so a destination
        // with no exit leading to it is not automatically illegal — it is legal
        // exactly when it is a teleport the server authorizes: a room in the
        // fixed network, or one the server itself just named for this player
        // (guild lair, defeat respawn, flee retreat) and has not yet spent.
        const isTeleportMove = !direction
        // A network fast travel must have been discovered and is paid for in MP
        // once it lands; a destination the server itself granted (guild lair,
        // respawn, flee retreat) is its own doing and stays free.
        let teleportCharge = null
        if (isTeleportMove) {
          const network = await authorizeNetworkTeleport(prisma, player, toRoom)
          if (network.ok) {
            teleportCharge = network.charge
          } else if (network.reason) {
            emitActionFeedback(socket, { action: 'move', message: network.reason, outcome: 'failure' })
            return
          } else if (!consumeTeleportGrant(player.id, toRoom)) {
            console.warn(
              `[Socket] player-move - ${player.username} requested unreachable/unauthorized ${toRoom} from ${fromRoom}`
            )
            emitActionFeedback(socket, {
              action: 'move',
              message: "You don't see an exit in that direction",
              outcome: 'failure',
            })
            return
          }
        }

        // A leader can't travel through a gate a party member can't pass — keep
        // the party together. Needs only the direction, so it is settled before
        // the destination is read rather than after.
        if (partyStore.isLeader(player.id)) {
          const gateBlock = await partyMemberGateBlocked(player.id, fromRoom, direction)
          if (gateBlock) {
            emitActionFeedback(socket, {
              action: 'move',
              message: `Your party can't go that way — ${gateBlock.memberName}: ${gateBlock.message}`,
              outcome: 'failure',
            })
            return
          }
        }

        const { destinationRoom, gatherCooldowns } = await loadDestination(player, toRoom)
        if (!destinationRoom) {
          console.log(`[Socket] player-move - Destination room ${toRoom} not found`)
          emitActionFeedback(socket, {
            action: 'move',
            message: 'Destination room not found',
            outcome: 'failure',
          })
          return
        }

        const normalizedRoomData = buildDestinationRoomData({
          destinationRoom,
          toRoom,
          player,
          gatherCooldowns,
        })
        const toRoomName = destinationRoom.name

        // Direction was derived above, before the destination was touched.
        // A teleport has no direction on either side.
        const exitDirection = direction
        const entryDirection = direction ? findDirectionKey(destinationRoom, fromRoom) : null

        console.log(`[Socket] Calling gameEngine.processUserAction for ${player.username}`)
        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: fromRoom,
          action: {
            type: 'move',
            // Authorized above for a teleport; left unset for a directional move
            // so the engine derives the direction itself and enforces the gate.
            authorizedMove: isTeleportMove,
            // The exits just read, so the engine's own derivation does not read
            // them again. Server-authored: it sits beside `authorizedMove`,
            // outside the half of the action built from client input.
            sourceExits,
            // Only the destination and its presentation data. The engine derives
            // the source room from where the player actually stands.
            data: { toRoom, toRoomName, roomData: normalizedRoomData },
          },
        })

        // The whole result object — room data, player list, items — on every
        // single move. Useful when tracing one action, unreadable otherwise.
        debugLog(`[Socket] processUserAction result:`, result)

        // CRITICAL: Only transition/persist player room if movement succeeded
        // The engine result is authoritative - do not transition unless result.success === true
        if (result && result.success === true) {
          console.log(`[Socket] Movement succeeded, transitioning player room`)
          // Derived from whether an exit actually led here, never from the client
          // payload — which used to let a caller relabel an ordinary step for the
          // room enter/leave messaging.
          const isTeleport = isTeleportMove
          // Socket rooms, presence and the live player record are moved before
          // this returns; only the database write is still in flight.
          const persisted = transitionPlayerRoom({ player, fromRoom, toRoom, exitDirection, entryDirection, isTeleport })

          console.log(`[Socket] Emitting action:confirmed to player`)
          socket.emit('action:confirmed', {
            action: 'move',
            success: true,
            data: result?.data || { fromRoom, toRoom, toRoomName, roomData: normalizedRoomData },
          })

          // The room is already on the player's screen (the engine's feedback
          // carried it); what they are waiting on now is whatever is waiting for
          // them. So the ambush roll starts the moment the socket is in the new
          // room, and the durable writes — current room, map unlocks, the
          // arrival quest — run beside it instead of ahead of it. They used to
          // run first, in sequence, with two room-chat rows nothing ever read.
          await Promise.all([
            maybeStartAutoBattle({ socket, player, toRoom, gameEngine }),
            persisted,
            chargeTeleport({ prisma, io, socket, gameEngine, player, toRoom, charge: teleportCharge }),
            applyArrivalDiscoveries(prisma, socket, player, toRoom),
            announceRoomQuest(socket, player, toRoom),
            announceSpellTeacher(prisma, socket, player, toRoom),
          ])

          // Pull any party members along with the leader.
          if (partyStore.isLeader(player.id)) {
            await pullPartyMembers({
              leaderId: player.id,
              fromRoom,
              toRoom,
              toRoomName,
              normalizedRoomData,
              exitDirection,
              entryDirection,
              isTeleport,
              // Members skip adjacency exactly when the leader did. On a
              // directional move this stays false on purpose, so the engine
              // re-runs each member's own gate rather than inheriting the
              // leader's right of way.
              authorizedMove: isTeleportMove,
              sourceExits,
            })
          }
        } else {
          console.log(`[Socket] Movement failed or blocked, not transitioning player room`)
          // The action:feedback event will be emitted by the engine with the error/modal
          // No need to emit action:confirmed for failed movements
        }
      } catch (error) {
        console.error('[Socket] Error handling player movement:', error)
        emitQueueAwareError({
          actionName: 'move',
          player,
          error,
          fallbackMessage: 'Failed to move',
        })
      }
    })

    // Handle chat messages
    socket.on(SOCKET_EVENTS.SEND_CHAT_MESSAGE, async (data) => {
      const player = activePlayers.get(socket.id)
      if (!player) {
        console.log(`[Socket] SEND_CHAT_MESSAGE - Player not found for socket ${socket.id}`)
        return
      }

      const sanitizedMessage = data.message ? data.message.toString().trim().substring(0, 500) : ''

      console.log(`[Socket] SEND_CHAT_MESSAGE from ${player.username}: "${sanitizedMessage}"`)

      if (!sanitizedMessage) {
        emitActionFeedback(socket, {
          action: 'chat',
          message: 'Message cannot be empty',
          outcome: 'failure',
        })
        return
      }

      touchPlayerActivity(player)

      try {
        console.log(`[Socket] Calling gameEngine.processUserAction for chat from ${player.username}`)
        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: player.currentRoom,
          action: {
            type: 'chat',
            data: { message: sanitizedMessage },
          },
        })

        debugLog(`[Socket] Chat processUserAction result:`, result)

        console.log(`[Socket] Emitting chat action:confirmed to player`)
        socket.emit('action:confirmed', { action: 'chat', success: true })
      } catch (error) {
        console.error('[Socket] Error handling chat message:', error)
        emitQueueAwareError({
          actionName: 'chat',
          player,
          error,
          fallbackMessage: 'Failed to send message',
        })
      }
    })

    // Handle room chat messages
    socket.on(SOCKET_EVENTS.SEND_ROOM_CHAT_MESSAGE, async (data) => {
      const player = activePlayers.get(socket.id)
      if (!player) {
        console.log(`[Socket] SEND_ROOM_CHAT_MESSAGE - Player not found for socket ${socket.id}`)
        return
      }

      const sanitizedMessage = data.message ? data.message.toString().trim().substring(0, 500) : ''
      const roomId = data.roomId ? data.roomId.toString() : ''

      console.log(`[Socket] SEND_ROOM_CHAT_MESSAGE from ${player.username} in room ${roomId}: "${sanitizedMessage}"`)

      if (!sanitizedMessage) {
        emitActionFeedback(socket, {
          action: 'room-chat',
          message: 'Message cannot be empty',
          outcome: 'failure',
        })
        return
      }

      if (!roomId) {
        emitActionFeedback(socket, {
          action: 'room-chat',
          message: 'Room ID is required',
          outcome: 'failure',
        })
        return
      }

      // Validate player is in the specified room
      if (player.currentRoom !== roomId) {
        console.log(`[Socket] SEND_ROOM_CHAT_MESSAGE - Player ${player.username} not in room ${roomId} (current: ${player.currentRoom})`)
        emitActionFeedback(socket, {
          action: 'room-chat',
          message: 'You must be in the room to send room chat messages',
          outcome: 'failure',
        })
        return
      }

      touchPlayerActivity(player)

      try {
        // Verify room exists
        const room = await prisma.room.findUnique({
          where: { roomId },
        })

        if (!room) {
          emitActionFeedback(socket, {
            action: 'room-chat',
            message: 'Room not found',
            outcome: 'failure',
          })
          return
        }

        // Save to database
        const roomChatMessage = await prisma.roomChatMessage.create({
          data: {
            userId: player.id,
            roomId: roomId,
            message: sanitizedMessage,
          },
          include: {
            user: {
              select: {
                username: true,
                level: true,
              },
            },
          },
        })

        // Broadcast to room only
        const payload = {
          id: roomChatMessage.id,
          userId: player.id,
          username: roomChatMessage.user.username,
          level: roomChatMessage.user.level,
          message: sanitizedMessage,
          timestamp: roomChatMessage.timestamp,
          roomId: roomId,
        }

        console.log(`[Socket] Broadcasting room chat message to room ${roomId}`)
        io.to(`room-${roomId}`).emit(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, payload)

        socket.emit('action:confirmed', { action: 'room-chat', success: true })
      } catch (error) {
        console.error('[Socket] Error handling room chat message:', error)
        emitQueueAwareError({
          actionName: 'room-chat',
          player,
          error,
          fallbackMessage: 'Failed to send room chat message',
        })
      }
    })

    // Handle game actions
    socket.on(SOCKET_EVENTS.GAME_ACTION, async (data) => {
      const player = activePlayers.get(socket.id)
      if (!player) return

      touchPlayerActivity(player)

      let actionType = null
      let actionData = {}

      if (typeof data?.action === 'string') {
        actionType = data.action.toLowerCase()
      } else if (data?.action && typeof data.action === 'object' && typeof data.action.type === 'string') {
        actionType = data.action.type
        actionData = data.action.data || {}
      }

      if (!actionType) {
        emitActionFeedback(socket, {
          action: 'action',
          message: 'Action is required',
          outcome: 'failure',
        })
        return
      }

      try {
        if (actionType === 'teleport') {
          if (partyStore.isMember(player.id)) {
            emitActionFeedback(socket, {
              action: 'teleport',
              message: 'You are following your party. Leave the party to move freely.',
              outcome: 'failure',
            })
            return
          }

          const toRoomId = actionData?.toRoomId
          if (!toRoomId) {
            emitActionFeedback(socket, { action: 'teleport', message: 'No destination specified', outcome: 'failure' })
            return
          }

          // A teleport destination is only legal if it belongs to the fixed
          // network everyone can reach, or the server just named this exact room
          // for this player (guild lair, defeat respawn, flee retreat) and the
          // grant has not been used yet. Without this the destination was simply
          // whatever the client asked for, which reached sealed mines, boss
          // chambers and loot rooms past every gate in the game.
          let teleportCharge = null
          const network = await authorizeNetworkTeleport(prisma, player, toRoomId)
          if (network.ok) {
            teleportCharge = network.charge
          } else if (network.reason) {
            emitActionFeedback(socket, { action: 'teleport', message: network.reason, outcome: 'failure' })
            return
          } else if (!consumeTeleportGrant(player.id, toRoomId)) {
            console.warn(
              `[Socket] teleport - ${player.username} requested unauthorized destination ${toRoomId}`
            )
            emitActionFeedback(socket, {
              action: 'teleport',
              message: 'You cannot teleport there.',
              outcome: 'failure',
            })
            return
          }

          const fromRoom = player.currentRoom

          if (partyStore.isLeader(player.id) && partyMemberInBattle(player.id, fromRoom)) {
            emitActionFeedback(socket, {
              action: 'teleport',
              message: 'You cannot travel while a party member is in battle.',
              outcome: 'failure',
            })
            return
          }
          const { destinationRoom, gatherCooldowns } = await loadDestination(player, toRoomId)
          if (!destinationRoom) {
            emitActionFeedback(socket, { action: 'teleport', message: 'Destination not found', outcome: 'failure' })
            return
          }

          const normalizedRoomData = buildDestinationRoomData({
            destinationRoom,
            toRoom: toRoomId,
            player,
            gatherCooldowns,
          })

          const result = await gameEngine.processUserAction({
            playerId: player.id,
            roomId: fromRoom,
            action: {
              type: 'move',
              // Authorized above, so the engine may skip the adjacency
              // requirement. It still refuses the move while a battle is active
              // or hostile enemies are present.
              authorizedMove: true,
              data: {
                toRoom: toRoomId,
                toRoomName: destinationRoom.name,
                roomData: normalizedRoomData,
              },
            },
          })

          if (result && result.success === true) {
            const persisted = transitionPlayerRoom({ player, fromRoom, toRoom: toRoomId, exitDirection: null, entryDirection: null, isTeleport: true })

            socket.emit('action:confirmed', {
              action: 'move',
              success: true,
              data: result?.data || { fromRoom, toRoom: toRoomId, toRoomName: destinationRoom.name, roomData: normalizedRoomData },
            })

            // Same arrival sequence as a walked move: the ambush first, the
            // durable writes beside it. Arriving by teleport now also unlocks
            // the destination's map and opens its arrival quest, which only a
            // walked entry used to do.
            await Promise.all([
              maybeStartAutoBattle({ socket, player, toRoom: toRoomId, gameEngine }),
              persisted,
              chargeTeleport({ prisma, io, socket, gameEngine, player, toRoom: toRoomId, charge: teleportCharge }),
              applyArrivalDiscoveries(prisma, socket, player, toRoomId),
              announceRoomQuest(socket, player, toRoomId),
              announceSpellTeacher(prisma, socket, player, toRoomId),
            ])

            if (partyStore.isLeader(player.id)) {
              await pullPartyMembers({
                leaderId: player.id,
                fromRoom,
                toRoom: toRoomId,
                toRoomName: destinationRoom.name,
                normalizedRoomData,
                exitDirection: null,
                entryDirection: null,
                isTeleport: true,
                // The leader's destination was authorized above, so members may
                // follow past the adjacency requirement.
                authorizedMove: true,
              })
            }
          } else {
            emitActionFeedback(socket, { action: 'teleport', message: result?.message || 'Teleport failed', outcome: 'failure' })
          }
          return
        }

        // Movement has its own event (`player-move`), which derives the source
        // room and direction server-side. Accepting a raw `move` here would hand
        // the engine a client-built payload for the one action type whose data
        // decides where a player may go, so it is refused outright.
        if (actionType === 'move') {
          emitActionFeedback(socket, {
            action: 'move',
            message: 'Use the compass to travel.',
            outcome: 'failure',
          })
          return
        }

        if (actionType === 'look') {
          const currentRoom = await prisma.room.findUnique({
            where: { roomId: player.currentRoom },
            select: { name: true },
          })
          if (currentRoom) {
            actionData = { ...actionData, roomName: currentRoom.name }
          }
        }

        // A successful flee retreats the player to the room they came from. Hand the
        // engine the previous room so the battle:fled payload can tell the client
        // where to navigate; the client then moves via the normal move pipeline.
        if (actionType === 'player_flee') {
          actionData = { ...actionData, returnRoomId: player.previousRoom ?? null }
        }

        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: player.currentRoom,
          action: {
            type: actionType,
            data: Object.keys(actionData).length > 0 ? actionData : undefined,
          },
        })

        socket.emit('action:confirmed', {
          action: actionType,
          success: result?.success ?? false,
          data: result?.data,
        })
      } catch (error) {
        console.error('Error handling game action:', error)
        emitQueueAwareError({
          actionName: actionType,
          player,
          error,
          fallbackMessage: 'Action failed',
        })
      }
    })

    // ─── Party events ──────────────────────────────────────────────────────
    const emitPartyError = (message) => {
      socket.emit(SOCKET_EVENTS.PARTY_ERROR, { message })
    }

    // Follow another player in the same room (joins their party as a member).
    socket.on(SOCKET_EVENTS.PARTY_FOLLOW, (data = {}) => {
      const player = activePlayers.get(socket.id)
      if (!player) return
      touchPlayerActivity(player)

      const targetId = data?.targetId
      if (!targetId || targetId === player.id) {
        emitPartyError('Invalid target.')
        return
      }

      const target = findActivePlayerById(targetId)
      if (!target) {
        emitPartyError('That player is not available.')
        return
      }
      if (target.currentRoom !== player.currentRoom) {
        emitPartyError('You must be in the same room to follow someone.')
        return
      }

      const res = partyStore.follow(toPartyInfo(player), toPartyInfo(target))
      if (!res.ok) emitPartyError(res.error)
      else broadcastRoomPartyState(player.currentRoom)
    })

    // Leave your current party (or disband it if you're the leader).
    socket.on(SOCKET_EVENTS.PARTY_LEAVE, () => {
      const player = activePlayers.get(socket.id)
      if (!player) return
      touchPlayerActivity(player)
      partyStore.leave(player.id)
      broadcastRoomPartyState(player.currentRoom)
    })

    // Leader removes a member.
    socket.on(SOCKET_EVENTS.PARTY_REMOVE, (data = {}) => {
      const player = activePlayers.get(socket.id)
      if (!player) return
      touchPlayerActivity(player)
      const memberId = data?.memberId
      if (!memberId) return
      const res = partyStore.remove(player.id, memberId)
      if (!res.ok) emitPartyError(res.error)
      else broadcastRoomPartyState(player.currentRoom)
    })

    // Handle explicit logout
    socket.on(SOCKET_EVENTS.USER_LOGOUT, async () => {
      const player = activePlayers.get(socket.id)
      if (!player) {
        socket.emit('auth:error', { message: 'Player not found' })
        return
      }

      try {
        await prisma.user.update({
          where: { id: player.id },
          data: {
            isActive: false,
            lastActive: new Date(),
          },
        })
      } catch (error) {
        console.error('[Socket] Failed to persist logout state', error)
      }

      await recordWorldFeedEventSafe({
        userId: player.id,
        username: player.username,
        eventType: 'logout',
      })

      socket.emit('auth:logout', { success: true })
      const socketSet = userIdToSocketIds.get(player.id)
      if (socketSet) {
        socketSet.delete(socket.id)
        if (socketSet.size === 0) {
          userIdToSocketIds.delete(player.id)
        }
      }
      // The party drop is left to the disconnect handler that `disconnect(true)`
      // triggers below, which does it only once this account's last connection
      // is gone. Doing it here unconditionally disbanded the party of a player
      // who was still playing in another tab.
      socket.disconnect(true)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      const player = activePlayers.get(socket.id)
      if (player) {
        // Retire this connection first, so the teardown below knows whether the
        // account has any left. Everything that ends a *session* — the action
        // queue, engine registration, the party, levers and reveals — used to
        // run on every disconnect, so closing one of two tabs tore down the
        // session the other tab was still using: its battle ended, its party
        // disbanded, and every later action failed with "Player not found in
        // this room" until a full re-login.
        const socketSet = userIdToSocketIds.get(player.id)
        if (socketSet) {
          socketSet.delete(socket.id)
          if (socketSet.size === 0) {
            userIdToSocketIds.delete(player.id)
          }
        }
        const isLastSocket = !userIdToSocketIds.has(player.id)

        // Per-connection bookkeeping always runs.
        if (roomPlayers.has(player.currentRoom)) {
          roomPlayers.get(player.currentRoom).delete(socket.id)
        }
        activePlayers.delete(socket.id)

        if (!isLastSocket) {
          // Another tab is still live: drop just this connection and leave the
          // player's session — battle, party, queue, presence — intact.
          gameEngine.unregisterSocket(player.id, socket.id)
          broadcastRoomPartyState(player.currentRoom)
          console.log(
            `[Socket] ${player.username} closed one connection; session still active on another`
          )
          return
        }

        if (gameEngine.playerQueue && gameEngine.playerQueue.clearPlayer) {
          gameEngine.playerQueue.clearPlayer(player.id, { rejectPending: true })
          console.log(`[Socket] Cleared action queue for player ${player.username}`)
        }
        gameEngine.unregisterPlayer(player.id, player.currentRoom)

        // Drop from any party (disbands it if they were leading).
        partyStore.onDisconnect(player.id)

        addGhost(player.currentRoom, player, 'disconnected')

        socket.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          id: player.id,
          username: player.username,
          exitDirection: null,
          isTeleport: false,
          reason: 'disconnect',
          lastSeen: Date.now(),
          ghostData: {
            id: player.id,
            username: player.username,
            level: player.level,
            hp: player.hp,
            hpMax: player.hpMax,
            mp: player.mp,
            mpMax: player.mpMax,
            currentRoom: player.currentRoom,
            uIcon: player.uIcon ?? null,
            uIconColor: player.uIconColor ?? null,
            isActive: false,
            status: 'disconnected',
            lastSeen: Date.now(),
          },
        })

        // If they led a party, surviving members' grouping changed — refresh the room.
        broadcastRoomPartyState(player.currentRoom)
        // This was the account's last connection, so it leaves the global roster.
        departPresence(io, player.id)
        lastActivityPersistedAt.delete(player.id)
        clearPlayerLevers(player.id)
        clearPlayerReveals(player.id)
        clearTeleportGrants(player.id)

        console.log(`Player ${player.username} disconnected`)

        recordWorldFeedEventSafe({
          userId: player.id,
          username: player.username,
          eventType: 'disconnect',
        })
      }
    })
  })
}

module.exports = {
  setupSocketHandlers,
  ACTION_QUEUE_ERRORS,
  QUEUE_FULL_MESSAGE,
  ACTION_TIMEOUT_MESSAGE,
}

