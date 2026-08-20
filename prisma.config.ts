import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer reads connection URLs from schema.prisma, and the CLI does
// not implicitly load env files the way v6 did. Load them here, matching Next's
// precedence (.env.local overrides .env).
loadEnv({ path: path.join(__dirname, '.env') })
loadEnv({ path: path.join(__dirname, '.env.local'), override: true })

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
    // Was package.json "prisma.seed" in v6.
    seed: 'tsx prisma/seed.ts',
  },
  // Migrations/introspection use the direct (non-pooled) connection.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
