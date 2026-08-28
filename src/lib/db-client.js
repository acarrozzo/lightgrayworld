const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { normalizeConnectionString } = require('./db-connection-string.js')

/**
 * Centralized Prisma client for CommonJS consumers (e.g., game engine).
 * Mirrors the singleton used in TypeScript to avoid multiple connections.
 */
const globalForPrisma = globalThis

// Prisma 7 clients no longer resolve the connection URL themselves, so entry
// points that run outside Next (server.js, socket-server.js) need env loaded.
if (!process.env.DATABASE_URL) {
  const path = require('path')
  const root = path.join(__dirname, '..', '..')
  require('dotenv').config({ path: path.join(root, '.env') })
  require('dotenv').config({ path: path.join(root, '.env.local'), override: true })
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — Prisma cannot create a driver adapter.')
  }

  // Prisma 7 requires an explicit driver adapter instead of the Rust engine.
  const adapter = new PrismaPg({
    connectionString: normalizeConnectionString(connectionString),
  })

  return new PrismaClient({ adapter })
}

/** @type {import('@prisma/client').PrismaClient} */
function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

module.exports = {
  get prisma() {
    return getPrisma()
  },
}
