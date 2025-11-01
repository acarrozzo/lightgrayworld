const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { setSocketIO, SOCKET_EVENTS } = require('./src/lib/socket-utils.js')
const { GameEngine } = require('./src/lib/game-engine/engine.js')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

// Initialize Socket.io
let io = null

app.prepare().then(() => {
  const httpServer = createServer(handler)
  
  // Initialize Socket.io
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  })

  // Set the global Socket.io instance
  setSocketIO(io)

  // Initialize the game engine
  const gameEngine = new GameEngine(io)
  gameEngine.start()
  global.gameEngine = gameEngine

  // Store active players
  const activePlayers = new Map()
  const roomPlayers = new Map()

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)
 
    const createIntentId = () => `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
 
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
          lastActive: new Date()
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

          // Notify other players in the room only when newly joining
          socket.to(`room-${playerData.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_JOINED, {
            id: playerData.id,
            username: playerData.username,
            level: playerData.level,
            hp: playerData.hp,
            hpMax: playerData.hpMax,
            mp: playerData.mp,
            mpMax: playerData.mpMax,
            currentRoom: playerData.currentRoom,
            isActive: true
          })
        }

        // Register player with the game engine state
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

    // Handle player movement
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
        }
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

      // Leave old room
      socket.leave(`room-${fromRoom}`)
      if (roomPlayers.has(fromRoom)) {
        roomPlayers.get(fromRoom).delete(socket.id)
        socket.to(`room-${fromRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          id: player.id,
          username: player.username
        })
      }

      // Join new room
      socket.join(`room-${toRoom}`)
      if (!roomPlayers.has(toRoom)) {
        roomPlayers.set(toRoom, new Set())
      }
      roomPlayers.get(toRoom).add(socket.id)

      // Update player data
      player.currentRoom = toRoom
      activePlayers.set(socket.id, player)

      prisma.user.update({
        where: { id: player.id },
        data: { currentRoom: toRoom },
      }).catch((error) => {
        console.error('Failed to persist player room change', error)
      })

      console.log(`[Server] Socket ${socket.id} rooms:`, Array.from(socket.rooms))
      console.log(`Queued movement intent for player ${player.username} from ${fromRoom} to ${toRoom}`)
    })

    // Handle chat messages
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
      try {
        const player = activePlayers.get(socket.id)
        if (!player) return

        // Basic sanitization for Socket.io messages
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
          }
        })

        console.log(`Queued chat intent from ${player.username}`)
      } catch (error) {
        console.error('Error handling chat message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle game actions
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
        }
      })

      console.log(`Queued action intent from ${player.username}: ${data.action}`)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      const player = activePlayers.get(socket.id)
      if (player) {
        gameEngine.unregisterPlayer(player.id, player.currentRoom)

        // Notify other players in the room
        socket.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          id: player.id,
          username: player.username
        })
        
        // Remove from room players
        if (roomPlayers.has(player.currentRoom)) {
          roomPlayers.get(player.currentRoom).delete(socket.id)
        }
        
        // Remove from active players
        activePlayers.delete(socket.id)
        
        console.log(`Player ${player.username} disconnected`)
      }
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
        .listen(port, () => {
          console.log(`> Ready on http://${hostname}:${port}`)
          console.log(`> Socket.io server running`)
        })
    })

