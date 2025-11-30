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
  const ACTION_QUEUE_ERRORS = {
    QUEUE_FULL: 'QUEUE_FULL',
    ACTION_TIMEOUT: 'ACTION_TIMEOUT',
  }
  const QUEUE_FULL_MESSAGE = 'Action queue is full. Please wait for pending actions to complete.'
  const ACTION_TIMEOUT_MESSAGE = 'Action timed out after 5000ms.'

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    console.log('[Server] Listening for player login event:', SOCKET_EVENTS.PLAYER_LOGIN)

    const emitQueueAwareError = ({ actionName, player, error, fallbackMessage }) => {
      if (!error) {
        socket.emit('action:error', { action: actionName, message: fallbackMessage })
        return
      }

      if (error.code === ACTION_QUEUE_ERRORS.QUEUE_FULL) {
        console.warn('[Socket] Action rejected due to queue overflow', {
          playerId: player?.id,
          action: actionName,
        })
        socket.emit('action:error', { action: actionName, message: QUEUE_FULL_MESSAGE })
        return
      }

      if (error.code === ACTION_QUEUE_ERRORS.ACTION_TIMEOUT) {
        console.error('[Socket] Action timed out', {
          playerId: player?.id,
          action: actionName,
        })
        socket.emit('action:error', { action: actionName, message: ACTION_TIMEOUT_MESSAGE })
        return
      }

      socket.emit('action:error', { action: actionName, message: fallbackMessage })
    }

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
      console.log('[Server] Received player-move event:', data)
      const player = activePlayers.get(socket.id)
      if (!player) {
        console.log('[Server] No player found for socket:', socket.id)
        return
      }

      const fromRoom = data?.fromRoom || player.currentRoom
      const toRoom = data?.toRoom

      console.log('[Server] Processing movement:', { playerId: player.id, fromRoom, toRoom })

      if (!toRoom) {
        socket.emit('action:error', { action: 'move', message: 'Destination room missing' })
        return
      }

      try {
        const destinationRoom = await prisma.room.findUnique({
          where: { roomId: toRoom },
          include: {
            players: true,
            npcs: true,
            items: true,
          },
        })
        const toRoomName = destinationRoom?.name

        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: fromRoom,
          action: {
            type: 'move',
            data: { fromRoom, toRoom, toRoomName, roomData: destinationRoom },
          },
        })

        if (result?.success === false) {
          socket.emit('action:error', { action: 'move', message: result.message || 'Failed to move' })
          return
        }

        await transitionPlayerRoom({ player, fromRoom, toRoom })

        socket.emit('action:confirmed', {
          action: 'move',
          success: true,
          data: result?.data || { fromRoom, toRoom, toRoomName, roomData: destinationRoom },
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
      if (!player) return

      try {
        // Basic sanitization for Socket.io messages
        const sanitizedMessage = data.message
          ? data.message.toString().trim().substring(0, 200)
          : ''

        if (!sanitizedMessage) {
          socket.emit('action:error', { action: 'chat', message: 'Message cannot be empty' })
          return
        }

        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: player.currentRoom,
          action: {
            type: 'chat',
            data: { message: sanitizedMessage },
          },
        })

        if (result?.success === false) {
          socket.emit('action:error', { action: 'chat', message: result.message || 'Failed to send message' })
          return
        }

        socket.emit('action:confirmed', { action: 'chat', success: true })
      } catch (error) {
        console.error('Error handling chat message:', error)
        emitQueueAwareError({
          actionName: 'chat',
          player,
          error,
          fallbackMessage: 'Failed to send message',
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
        const result = await gameEngine.processUserAction({
          playerId: player.id,
          roomId: player.currentRoom,
          action: {
            type: actionName,
          },
        })

        if (result?.success === false) {
          socket.emit('action:error', { action: actionName, message: result.message || 'Action failed' })
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

