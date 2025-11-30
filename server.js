const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { setSocketIO } = require('./src/lib/socket-utils.js')
const { GameEngine } = require('./src/lib/game-engine/engine.js')
const { PrismaClient } = require('@prisma/client')
const { setupSocketHandlers } = require('./src/lib/socket-server-handlers.js')
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

  // Setup socket handlers using shared module
  setupSocketHandlers(io, gameEngine, prisma, activePlayers, roomPlayers)

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

