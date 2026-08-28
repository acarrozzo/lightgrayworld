import type { PrismaClient } from '@prisma/client'

let _prisma: PrismaClient | undefined

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dbClient = require('./db-client')
      _prisma = dbClient.prisma as PrismaClient
    }
    return (_prisma as Record<string | symbol, unknown>)[prop]
  },
})
