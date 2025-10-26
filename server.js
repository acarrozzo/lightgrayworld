const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { setSocketIO, SOCKET_EVENTS } = require('./src/lib/socket-utils.js')

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

  // Store active players
  const activePlayers = new Map()
  const roomPlayers = new Map()

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Handle player login
    socket.on(SOCKET_EVENTS.PLAYER_LOGIN, (playerData) => {
      try {
        activePlayers.set(socket.id, {
          ...playerData,
          socketId: socket.id,
          lastActive: new Date()
        })
        
        // Join room
        socket.join(`room-${playerData.currentRoom}`)
        
        // Add to room players
        if (!roomPlayers.has(playerData.currentRoom)) {
          roomPlayers.set(playerData.currentRoom, new Set())
        }
        roomPlayers.get(playerData.currentRoom).add(socket.id)
        
        // Notify other players in the room
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
        
        console.log(`Player ${playerData.username} joined room ${playerData.currentRoom}`)
      } catch (error) {
        console.error('Error handling player login:', error)
        socket.emit('error', { message: 'Failed to process login' })
      }
    })

    // Handle player movement
    socket.on('player-move', (data) => {
      const player = activePlayers.get(socket.id)
      if (!player) return

      const { fromRoom, toRoom } = data
      
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
      
      // Notify players in new room
      socket.to(`room-${toRoom}`).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        id: player.id,
        username: player.username,
        level: player.level,
        hp: player.hp,
        hpMax: player.hpMax,
        mp: player.mp,
        mpMax: player.mpMax,
        currentRoom: toRoom,
        isActive: true
      })
      
      console.log(`Player ${player.username} moved from room ${fromRoom} to ${toRoom}`)
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

        const message = {
          id: Date.now().toString(),
          username: player.username,
          message: sanitizedMessage,
          timestamp: new Date(),
          level: player.level,
          roomId: player.currentRoom
        }

        // Broadcast to all players in the same room
        io.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, message)
        
        console.log(`Chat message from ${player.username}: ${sanitizedMessage}`)
      } catch (error) {
        console.error('Error handling chat message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle game actions
    socket.on(SOCKET_EVENTS.GAME_ACTION, (data) => {
      const player = activePlayers.get(socket.id)
      if (!player) return

      // Broadcast action to all players in the same room
      socket.to(`room-${player.currentRoom}`).emit(SOCKET_EVENTS.PLAYER_ACTION, {
        playerId: player.id,
        username: player.username,
        action: data.action,
        timestamp: new Date()
      })
      
      console.log(`Player ${player.username} performed action: ${data.action}`)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      const player = activePlayers.get(socket.id)
      if (player) {
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

