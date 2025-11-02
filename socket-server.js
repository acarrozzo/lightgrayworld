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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

  const createIntentId = () => `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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
      })
      console.log(`[Server] Registered ${playerData.username} with engine in room ${playerData.currentRoom}`)

      console.log(`Player ${playerData.username} joined room ${playerData.currentRoom}`)
    } catch (error) {
      console.error('Error handling player login:', error)
      socket.emit('error', { message: 'Failed to process login' })
    }
  })

  socket.on('player-move', (data) => {
    console.log('[Server] Received player-move event:', data)
    console.log('[Server] Current socket ID:', socket.id)
    console.log('[Server] Active sockets:', Array.from(activePlayers.keys()))
    const player = activePlayers.get(socket.id)
    if (!player) {
      console.log('[Server] No player found for socket:', socket.id)
      console.log('[Server] Full activePlayers map:', activePlayers)
      return
    }

    const { fromRoom, toRoom } = data
    console.log('[Server] Processing movement:', { playerId: player.id, fromRoom, toRoom })

    gameEngine.queueIntent({
      roomId: fromRoom,
      intent: {
        id: createIntentId(),
        playerId: player.id,
        type: 'move',
        data: { fromRoom, toRoom },
        timestamp: Date.now(),
      },
    })
    console.log('[Server] Movement intent queued')

    gameEngine.movePlayer({
      playerId: player.id,
      fromRoomId: fromRoom,
      toRoomId: toRoom,
      playerState: {
        id: player.id,
        username: player.username,
        hp: player.hp,
        hpMax: player.hpMax,
        mp: player.mp,
        mpMax: player.mpMax,
        level: player.level,
      },
    })
    console.log('[Server] Player state updated in engine')

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

    player.currentRoom = toRoom
    activePlayers.set(socket.id, player)

    prisma.user
      .update({
        where: { id: player.id },
        data: { currentRoom: toRoom },
      })
      .catch((error) => {
        console.error('Failed to persist player room change', error)
      })

    console.log(`[Server] Socket ${socket.id} rooms:`, Array.from(socket.rooms))
    console.log(`Queued movement intent for player ${player.username} from ${fromRoom} to ${toRoom}`)
  })

  socket.on(SOCKET_EVENTS.SEND_CHAT_MESSAGE, (data) => {
    try {
      const player = activePlayers.get(socket.id)
      if (!player) return

      const sanitizedMessage = data.message
        ? data.message.toString().trim().substring(0, 200)
        : ''

      if (!sanitizedMessage) {
        socket.emit('error', { message: 'Message cannot be empty' })
        return
      }

      gameEngine.queueIntent({
        roomId: player.currentRoom,
        intent: {
          id: createIntentId(),
          playerId: player.id,
          type: 'chat',
          data: { message: sanitizedMessage },
          timestamp: Date.now(),
        },
      })

      console.log(`Queued chat intent from ${player.username}`)
    } catch (error) {
      console.error('Error handling chat message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  socket.on(SOCKET_EVENTS.GAME_ACTION, (data) => {
    const player = activePlayers.get(socket.id)
    if (!player) return

    if (!data?.action) {
      socket.emit('error', { message: 'Action is required' })
      return
    }

    gameEngine.queueIntent({
      roomId: player.currentRoom,
      intent: {
        id: createIntentId(),
        playerId: player.id,
        type: 'action',
        data: { action: data.action },
        timestamp: Date.now(),
      },
    })

    console.log(`Queued action intent from ${player.username}: ${data.action}`)
  })

  socket.on('disconnect', () => {
    const player = activePlayers.get(socket.id)
    if (player) {
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

