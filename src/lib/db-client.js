const { PrismaClient } = require('@prisma/client')

/**
 * Centralized Prisma client for CommonJS consumers (e.g., game engine).
 * Mirrors the singleton used in TypeScript to avoid multiple connections.
 */
const globalForPrisma = globalThis

/** @type {import('@prisma/client').PrismaClient} */
const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

module.exports = {
  prisma,
}

