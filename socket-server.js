const { createServer } = require('http')
const next = require('next')
const { Server } = require('socket.io')
const { GameEngine } = require('./src/lib/game-engine/engine.js')
const { setSocketIO, setUserSocketMap } = require('./src/lib/socket-utils.js')
const { setupSocketHandlers } = require('./src/lib/socket-server-handlers.js')
const { verifySocketToken } = require('./src/lib/token-verification.js')

const { prisma } = require('./src/lib/db-client.js')

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/socket.io'

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:3000']

// Initialize Next.js
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, hostname: HOST, port: PORT })
const handler = app.getRequestHandler()

// Initialize Socket.io and game engine after Next.js is ready
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Let Next.js handle all routes (including API routes)
    return handler(req, res)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: SOCKET_PATH,
  })

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token

    if (!token) {
      return next(new Error('Authentication token required'))
    }

    const user = verifySocketToken(token)

    if (!user) {
      return next(new Error('Invalid or expired token'))
    }

    socket.data.user = user // { userId, username }
    next()
  })

  setSocketIO(io)

  const gameEngine = new GameEngine(io)
  gameEngine.start()
  global.gameEngine = gameEngine
  globalThis.gameEngine = gameEngine

  const activePlayers = new Map()
  const roomPlayers = new Map()
  const userIdToSocketIds = new Map()
  setUserSocketMap(userIdToSocketIds)

  // Setup socket handlers using shared module
  setupSocketHandlers(io, gameEngine, prisma, activePlayers, roomPlayers, userIdToSocketIds)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(PORT, HOST, () => {
      console.log(`> Server ready on http://${HOST}:${PORT}`)
      console.log(`> Socket.io path: ${SOCKET_PATH}`)
      console.log(`> Allowed origins: ${allowedOrigins.join(', ')}`)
    })

  const shutdown = async () => {
    console.log('Shutting down server...')
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
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

