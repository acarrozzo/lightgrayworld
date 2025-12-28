// Shared socket handling logic for server.js and socket-server.js
const { SOCKET_EVENTS } = require('./socket-utils.js')
const { getPlayerInventory } = require('./game-engine/services/inventory-service.js')
const {
  ROOM_ITEMS_SELECT,
  normalizeRoomData,
} = require('./game-engine/services/room-normalization.js')

// Constants
const ACTION_QUEUE_ERRORS = {
  QUEUE_FULL: 'QUEUE_FULL',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
}

const QUEUE_FULL_MESSAGE = 'Action queue is full. Please wait for pending actions to complete.'
const ACTION_TIMEOUT_MESSAGE = 'Action timed out after 5000ms.'
const LAST_ACTIVE_PERSIST_INTERVAL = 60 * 1000
const { createWorldFeedEvent } = require('./services/world-feed-event-service.js')
const { createIdleDetectionService } = require('./services/idle-detection-service.js')

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

// Create room transition function
function createTransitionPlayerRoom(prisma, socket, activePlayers, roomPlayers) {
  return async ({ player, fromRoom, toRoom, exitDirection, entryDirection }) => {
    if (!toRoom || fromRoom === toRoom) {
      return
    }

    socket.leave(`room-${fromRoom}`)
    if (roomPlayers.has(fromRoom)) {
      roomPlayers.get(fromRoom).delete(socket.id)
      socket.to(`room-${fromRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        id: player.id,
        username: player.username,
        exitDirection: exitDirection || null,
      })
    }

    socket.join(`room-${toRoom}`)
    if (!roomPlayers.has(toRoom)) {
      roomPlayers.set(toRoom, new Set())
    }
    roomPlayers.get(toRoom).add(socket.id)

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
      entryDirection: entryDirection || null,
    })

    player.currentRoom = toRoom
    activePlayers.set(socket.id, player)

    try {
      await prisma.user.update({
        where: { id: player.id },
        data: { currentRoom: toRoom },
      })
    } catch (error) {
      console.error('Failed to persist player room change', error)
    }
  }
}

// Standard room query - ensures nameColor and subtitleColor are included
async function fetchRoomWithColors(prisma, roomId) {
  const room = await prisma.room.findUnique({
    where: { roomId },
    select: {
      id: true,
      roomId: true,
      name: true,
      subtitle: true,
      subtitlePosition: true,
      nameColor: true,
      subtitleColor: true,
      icon: true,
      iconColor: true,
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
      players: {
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
        },
      },
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

function buildDirectionPhrase(direction, context) {
  if (!direction) {
    return 'an unknown direction'
  }

  if (direction === 'up') {
    return context === 'enter' ? 'above' : 'upward'
  }

  if (direction === 'down') {
    return context === 'enter' ? 'below' : 'downward'
  }

  return `the ${direction.replace(/_/g, ' ')}`
}

// Setup socket handlers
function setupSocketHandlers(io, gameEngine, prisma, activePlayers, roomPlayers) {
  const idleDetectionService = createIdleDetectionService({ activePlayers })
  idleDetectionService.start()
  const lastActivityPersistedAt = new Map()

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

    const emitQueueAwareError = createEmitQueueAwareError(socket)
    const transitionPlayerRoom = createTransitionPlayerRoom(prisma, socket, activePlayers, roomPlayers)
    const touchPlayerActivity = (player) => {
      if (!player || !player.id) {
        return
      }

      const now = Date.now()
      player.lastActive = new Date(now)
      idleDetectionService.markUserActive(player.id)

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
          socketId: socket.id,
          lastActive: new Date(),
        }

        activePlayers.set(socket.id, playerData)
        touchPlayerActivity(playerData)
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
            entryDirection: null, // No direction info on initial login
          })
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
          socketId: socket.id,
        })
        console.log(`[Server] Registered ${playerData.username} with engine in room ${playerData.currentRoom}`)

        console.log(`Player ${playerData.username} joined room ${playerData.currentRoom}`)

        // Send initial inventory snapshot to client
        const inventory = await getPlayerInventory(playerData.id)
        socket.emit('login:success', {
          player: playerData,
          inventory,
        })

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

      const fromRoom = data?.fromRoom || player.currentRoom
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

      try {
        // Fetch both rooms to calculate direction
        const [sourceRoom, destinationRoom] = await Promise.all([
          fetchRoomWithColors(prisma, fromRoom),
          fetchRoomWithColors(prisma, toRoom),
        ])

        if (!destinationRoom) {
          console.log(`[Socket] player-move - Destination room ${toRoom} not found`)
          emitActionFeedback(socket, {
            action: 'move',
            message: 'Destination room not found',
            outcome: 'failure',
          })
          return
        }

        // Ensure auto-respawn items exist in the destination room
        const { ensureAutoRespawnItems } = require('./game-engine/services/room-item-service')
        await ensureAutoRespawnItems(toRoom)
        // Re-fetch room data to include any respawned items
        const updatedDestinationRoom = await fetchRoomWithColors(prisma, toRoom)
        if (updatedDestinationRoom) {
          // Update destinationRoom with fresh data including respawned items
          destinationRoom.items = updatedDestinationRoom.items || []
          destinationRoom.players = updatedDestinationRoom.players || []
          destinationRoom.npcs = updatedDestinationRoom.npcs || []
        }

        const normalizedRoomData = {
          ...destinationRoom,
          players: Array.isArray(destinationRoom.players) ? destinationRoom.players : [],
          items: Array.isArray(destinationRoom.items) ? destinationRoom.items : [],
          npcs: Array.isArray(destinationRoom.npcs) ? destinationRoom.npcs : [],
        }
        const toRoomName = destinationRoom.name

        // Calculate direction from source room to destination
        const direction = sourceRoom ? findDirectionKey(sourceRoom, toRoom) : null

        // Calculate directions for entry/exit notifications
        const exitDirection = sourceRoom ? findDirectionKey(sourceRoom, toRoom) : null
        const entryDirection = destinationRoom ? findDirectionKey(destinationRoom, fromRoom) : null

        console.log(`[Socket] Calling gameEngine.processUserAction for ${player.username}`)
        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: fromRoom,
          action: {
            type: 'move',
            data: { fromRoom, toRoom, toRoomName, roomData: normalizedRoomData, direction },
          },
        })

        console.log(`[Socket] processUserAction result:`, result)

        console.log(`[Socket] Transitioning player room`)
        await transitionPlayerRoom({ player, fromRoom, toRoom, exitDirection, entryDirection })

        // Save entry/exit messages to database
        try {
          // Fetch both rooms for direction finding
          const fromRoomData = await fetchRoomWithColors(prisma, fromRoom)
          const toRoomData = await fetchRoomWithColors(prisma, toRoom)

          if (fromRoomData && toRoomData) {
            // Exit message for the room being left
            const exitDirection = findDirectionKey(fromRoomData, toRoom)
            const exitDirectionPhrase = buildDirectionPhrase(exitDirection, 'exit')
            const exitMessage = `${player.username} exits to ${exitDirectionPhrase}`

            await prisma.roomChatMessage.create({
              data: {
                userId: player.id,
                roomId: fromRoom,
                message: exitMessage,
                type: 'system',
              },
            })

            // Entry message for the room being entered
            const entryDirection = findDirectionKey(toRoomData, fromRoom)
            const entryDirectionPhrase = buildDirectionPhrase(entryDirection, 'enter')
            const entryMessage = `${player.username} enters from ${entryDirectionPhrase}`

            await prisma.roomChatMessage.create({
              data: {
                userId: player.id,
                roomId: toRoom,
                message: entryMessage,
                type: 'system',
              },
            })

            console.log(`[Socket] Saved entry/exit messages for ${player.username} moving from ${fromRoom} to ${toRoom}`)
          }
        } catch (error) {
          console.error('[Socket] Error saving entry/exit messages:', error)
          // Don't fail the movement if message saving fails
        }

        console.log(`[Socket] Emitting action:confirmed to player`)
        socket.emit('action:confirmed', {
          action: 'move',
          success: true,
          data: result?.data || { fromRoom, toRoom, toRoomName, roomData: normalizedRoomData },
        })
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

      const sanitizedMessage = data.message ? data.message.toString().trim().substring(0, 200) : ''

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

        console.log(`[Socket] Chat processUserAction result:`, result)

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

      const sanitizedMessage = data.message ? data.message.toString().trim().substring(0, 200) : ''
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
        if (actionType === 'look') {
          const currentRoom = await fetchRoomWithColors(prisma, player.currentRoom)
          if (currentRoom) {
            actionData = { ...actionData, roomName: currentRoom.name }
          }
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
          success: true,
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
      socket.disconnect(true)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      const player = activePlayers.get(socket.id)
      if (player) {
        if (gameEngine.playerQueue && gameEngine.playerQueue.clearPlayer) {
          gameEngine.playerQueue.clearPlayer(player.id, { rejectPending: true })
          console.log(`[Socket] Cleared action queue for player ${player.username}`)
        }
        gameEngine.unregisterPlayer(player.id, player.currentRoom)

        socket.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          id: player.id,
          username: player.username,
          exitDirection: null, // No direction info on disconnect
        })

        if (roomPlayers.has(player.currentRoom)) {
          roomPlayers.get(player.currentRoom).delete(socket.id)
        }

        activePlayers.delete(socket.id)
        lastActivityPersistedAt.delete(player.id)

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

