const { createServer } = require('http')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const { GameEngine } = require('./src/lib/game-engine/engine.js')
const { setSocketIO } = require('./src/lib/socket-utils.js')
const { setupSocketHandlers } = require('./src/lib/socket-server-handlers.js')

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

// Setup socket handlers using shared module
setupSocketHandlers(io, gameEngine, prisma, activePlayers, roomPlayers)

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

