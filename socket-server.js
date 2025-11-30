const { createServer } = require('http')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const { GameEngine } = require('./src/lib/game-engine/engine.js')
const { setSocketIO, SOCKET_EVENTS } = require('./src/lib/socket-utils.js')

const prisma = new PrismaClient()

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/socket.io'

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:3000']

const httpServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: SOCKET_PATH,
})

setSocketIO(io)

const gameEngine = new GameEngine(io)
gameEngine.start()
global.gameEngine = gameEngine

const activePlayers = new Map()
const roomPlayers = new Map()

const ACTION_QUEUE_ERRORS = {
  QUEUE_FULL: 'QUEUE_FULL',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
}

const QUEUE_FULL_MESSAGE = 'Action queue is full. Please wait for pending actions to complete.'
const ACTION_TIMEOUT_MESSAGE = 'Action timed out after 5000ms.'

const emitQueueAwareError = ({ socket, actionName, player, error, fallbackMessage }) => {
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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

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

  const transitionPlayerRoom = async ({ player, fromRoom, toRoom }) => {
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
      const destinationRoom = await prisma.room.findUnique({
        where: { roomId: toRoom },
        select: {
          id: true,
          roomId: true,
          name: true,
          subtitle: true,
          subtitlePosition: true,
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
        },
      })

      if (!destinationRoom) {
        console.log(`[Socket] player-move - Destination room ${toRoom} not found`)
        socket.emit('action:error', { action: 'move', message: 'Destination room not found' })
        return
      }

      const normalizedRoomData = {
        ...destinationRoom,
        players: [],
        items: [],
        npcs: [],
      }
      const toRoomName = destinationRoom.name

      console.log(`[Socket] Calling gameEngine.processUserAction for ${player.username}`)
      const result = await gameEngine.processUserAction({
        playerId: player.id,
        roomId: fromRoom,
        action: {
          type: 'move',
          data: { fromRoom, toRoom, toRoomName, roomData: normalizedRoomData },
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

      console.log(`[Socket] Emitting action:confirmed to player`)
      socket.emit('action:confirmed', {
        action: 'move',
        success: true,
        data: result?.data || { fromRoom, toRoom, toRoomName, roomData: normalizedRoomData },
      })
    } catch (error) {
      console.error('[Socket] Error handling player movement:', error)
      emitQueueAwareError({
        socket,
        actionName: 'move',
        player,
        error,
        fallbackMessage: 'Failed to move',
      })
    }
  })

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
        socket,
        actionName: 'chat',
        player,
        error,
        fallbackMessage: 'Failed to send message',
      })
    }
  })

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
      const result = await gameEngine.processUserAction({
        playerId: player.id,
        roomId: player.currentRoom,
        action: {
          type: actionName,
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
        socket,
        actionName,
        player,
        error,
        fallbackMessage: 'Action failed',
      })
    }
  })

  socket.on('disconnect', () => {
    const player = activePlayers.get(socket.id)
    if (player) {
      gameEngine.playerQueue.clearPlayer(player.id, { rejectPending: true })
      console.log(`[Socket] Cleared action queue for player ${player.username}`)
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

httpServer.listen(PORT, HOST, () => {
  console.log(`> Socket server ready on http://${HOST}:${PORT}`)
  console.log(`> Allowed origins: ${allowedOrigins.join(', ')}`)
  console.log(`> Socket.io path: ${SOCKET_PATH}`)
})

const shutdown = async () => {
  console.log('Shutting down socket server...')
  await prisma.$disconnect().catch((error) => {
    console.error('Failed to disconnect Prisma client', error)
  })
  httpServer.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

