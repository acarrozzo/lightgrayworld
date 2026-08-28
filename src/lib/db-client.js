/**
 * Centralized Prisma client for CommonJS consumers (e.g., game engine).
 * Uses a Proxy so the real client is only created when a property is accessed
 * at runtime — not at import/require time. This prevents build-time failures
 * when DATABASE_URL is unavailable (e.g., Docker build stage).
 */
const globalForPrisma = globalThis

function createPrismaClient() {
  // Prisma 7 clients no longer resolve the connection URL themselves, so entry
  // points that run outside Next (server.js, socket-server.js) need env loaded.
  if (!process.env.DATABASE_URL) {
    const path = require('path')
    const root = path.join(__dirname, '..', '..')
    require('dotenv').config({ path: path.join(root, '.env') })
    require('dotenv').config({ path: path.join(root, '.env.local'), override: true })
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — Prisma cannot create a driver adapter.')
  }

  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const { normalizeConnectionString } = require('./db-connection-string.js')

  const adapter = new PrismaPg({
    connectionString: normalizeConnectionString(connectionString),
  })

  return new PrismaClient({ adapter })
}

function getPrisma() {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createPrismaClient()
  }
  return globalForPrisma.__prisma
}

/** @type {import('@prisma/client').PrismaClient} */
const prismaProxy = new Proxy({}, {
  get(_target, prop) {
    return getPrisma()[prop]
  },
})

module.exports = {
  prisma: prismaProxy,
}
