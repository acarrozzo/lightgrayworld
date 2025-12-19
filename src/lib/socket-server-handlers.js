// Shared socket handling logic for server.js and socket-server.js
const { SOCKET_EVENTS } = require('./socket-utils.js')

// Constants
const ACTION_QUEUE_ERRORS = {
  QUEUE_FULL: 'QUEUE_FULL',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
}

const QUEUE_FULL_MESSAGE = 'Action queue is full. Please wait for pending actions to complete.'
const ACTION_TIMEOUT_MESSAGE = 'Action timed out after 5000ms.'

// Create error handler factory
function createEmitQueueAwareError(socket) {
  return ({ actionName, player, error, fallbackMessage }) => {
    if (!error) {
      socket.emit('action:error', { action: actionName, message: fallbackMessage })
      return
    }

    if (error.code === ACTION_QUEUE_ERRORS.QUEUE_FULL) {
      console.warn(
        `[Socket] Action rejected due to queue overflow`,
        { playerId: player?.id, action: actionName }
      )
      socket.emit('action:error', { action: actionName, message: QUEUE_FULL_MESSAGE })
      return
    }

    if (error.code === ACTION_QUEUE_ERRORS.ACTION_TIMEOUT) {
      console.error(
        `[Socket] Action timed out`,
        { playerId: player?.id, action: actionName }
      )
      socket.emit('action:error', { action: actionName, message: ACTION_TIMEOUT_MESSAGE })
      return
    }

    socket.emit('action:error', { action: actionName, message: fallbackMessage })
  }
}

// Create room transition function
function createTransitionPlayerRoom(prisma, socket, activePlayers, roomPlayers) {
  return async ({ player, fromRoom, toRoom }) => {
    if (!toRoom || fromRoom === toRoom) {
      return
    }

    socket.leave(`room-${fromRoom}`)
    if (roomPlayers.has(fromRoom)) {
      roomPlayers.get(fromRoom).delete(socket.id)
      socket.to(`room-${fromRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        id: player.id,
        username: player.username,
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
  return await prisma.room.findUnique({
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
      items: true,
      npcs: true,
    },
  })
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
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

    const emitQueueAwareError = createEmitQueueAwareError(socket)
    const transitionPlayerRoom = createTransitionPlayerRoom(prisma, socket, activePlayers, roomPlayers)

    // Handle player login
    socket.on(SOCKET_EVENTS.PLAYER_LOGIN, (playerData) => {
      console.log(`[Server] PLAYER_LOGIN received for socket ${socket.id}, player:`, playerData.username)
      console.log('[Server] PLAYER_LOGIN payload:', playerData)

      try {
        const previousState = activePlayers.get(socket.id)
        const previousRoom = previousState?.currentRoom

        activePlayers.set(socket.id, {
          ...playerData,
          socketId: socket.id,
          lastActive: new Date(),
        })
        console.log(`[Server] Player ${playerData.username} registered in activePlayers for socket ${socket.id}`)
        console.log(`[Server] activePlayers now has ${activePlayers.size} entries`)

        if (previousRoom && previousRoom !== playerData.currentRoom) {
          console.log(`[Server] Player ${playerData.username} moving socket room from ${previousRoom} to ${playerData.currentRoom}`)
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
      } catch (error) {
        console.error('Error handling player login:', error)
        socket.emit('error', { message: 'Failed to process login' })
      }
    })

    // Handle player movement
    socket.on('player-move', async (data) => {
      console.log(`[Socket] player-move event received from ${socket.id}:`, data)
      const player = activePlayers.get(socket.id)
      if (!player) {
        console.log(`[Socket] player-move - Player not found for socket ${socket.id}`)
        socket.emit('action:error', { action: 'move', message: 'Player not found' })
        return
      }

      const fromRoom = data?.fromRoom || player.currentRoom
      const toRoom = data?.toRoom

      console.log(`[Socket] player-move - ${player.username} moving from ${fromRoom} to ${toRoom}`)

      if (!toRoom) {
        console.log(`[Socket] player-move - Destination room missing`)
        socket.emit('action:error', { action: 'move', message: 'Destination room missing' })
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
          socket.emit('action:error', { action: 'move', message: 'Destination room not found' })
          return
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

        if (result?.success === false) {
          console.log(`[Socket] Movement failed:`, result.message)
          socket.emit('action:error', {
            action: 'move',
            message: result.message || 'Failed to move',
          })
          return
        }

        console.log(`[Socket] Transitioning player room`)
        await transitionPlayerRoom({ player, fromRoom, toRoom })

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
        socket.emit('action:error', { action: 'chat', message: 'Message cannot be empty' })
        return
      }

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

        if (result?.success === false) {
          console.log(`[Socket] Chat failed:`, result.message)
          socket.emit('action:error', { action: 'chat', message: result.message || 'Failed to send message' })
          return
        }

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
        socket.emit('action:error', { action: 'room-chat', message: 'Message cannot be empty' })
        return
      }

      if (!roomId) {
        socket.emit('action:error', { action: 'room-chat', message: 'Room ID is required' })
        return
      }

      // Validate player is in the specified room
      if (player.currentRoom !== roomId) {
        console.log(`[Socket] SEND_ROOM_CHAT_MESSAGE - Player ${player.username} not in room ${roomId} (current: ${player.currentRoom})`)
        socket.emit('action:error', { action: 'room-chat', message: 'You must be in the room to send room chat messages' })
        return
      }

      try {
        // Verify room exists
        const room = await prisma.room.findUnique({
          where: { roomId },
        })

        if (!room) {
          socket.emit('action:error', { action: 'room-chat', message: 'Room not found' })
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

      const actionName = data?.action?.toString().toLowerCase()
      const supportedActions = new Set(['search', 'rest', 'look'])

      if (!actionName) {
        socket.emit('action:error', { action: 'action', message: 'Action is required' })
        return
      }

      if (!supportedActions.has(actionName)) {
        socket.emit('action:error', { action: actionName, message: 'Unsupported action' })
        return
      }

      try {
        // For look action, fetch room data to get room name
        let actionData = {}
        if (actionName === 'look') {
          const currentRoom = await fetchRoomWithColors(prisma, player.currentRoom)
          if (currentRoom) {
            actionData.roomName = currentRoom.name
          }
        }

        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: player.currentRoom,
          action: {
            type: actionName,
            data: Object.keys(actionData).length > 0 ? actionData : undefined,
          },
        })

        if (result?.success === false) {
          socket.emit('action:error', {
            action: actionName,
            message: result.message || 'Action failed',
          })
          return
        }

        socket.emit('action:confirmed', {
          action: actionName,
          success: true,
          data: result?.data,
        })
      } catch (error) {
        console.error('Error handling game action:', error)
        emitQueueAwareError({
          actionName,
          player,
          error,
          fallbackMessage: 'Action failed',
        })
      }
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
        })

        if (roomPlayers.has(player.currentRoom)) {
          roomPlayers.get(player.currentRoom).delete(socket.id)
        }

        activePlayers.delete(socket.id)

        console.log(`Player ${player.username} disconnected`)
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

