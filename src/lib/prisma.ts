import type { PrismaClient } from '@prisma/client'
import dbClient from './db-client'

export const prisma = dbClient.prisma as PrismaClient
