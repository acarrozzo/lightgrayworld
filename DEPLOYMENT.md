# Deployment Guide

## Overview

The application runs as a single unified service on Fly.io:

- **Full Next.js application** (frontend + API routes) + **Socket.IO realtime server**: deploy to Fly.io.

This unified architecture ensures that API routes can access the gameEngine instance, matching the local development setup. The application is built and deployed as a single service for simplicity and consistency.

## Environment Variables

Reference `env.local.template` for sample values.

| Variable | Location | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | Local | Base URL of the Socket.IO server. Use `http://localhost:3000` locally. In production, this should match your Fly.io domain (e.g. `https://your-app.fly.dev`). |
| `NEXT_PUBLIC_SOCKET_PATH` | Local | Socket.IO path (defaults to `/socket.io`). Only set if you change it on the server. |
| `ALLOWED_ORIGINS` | Fly.io | Comma-separated list of frontend origins allowed to connect. Can include your Fly.io domain and any other domains that need access. |
| `DATABASE_URL` | Fly.io | Supabase PgBouncer connection string used at runtime (`6543` with `?pgbouncer=true`). |
| `DIRECT_URL` | Fly.io (migrations only) | Supabase direct connection string used exclusively by Prisma migrations (`5432`, no PgBouncer). |
| `PORT` | Fly.io | Fly injects this automatically (defaults to `8080`). Bind your server to `process.env.PORT`. |
| `NODE_ENV` | Fly.io | Set to `production` for production deployments. |

## Fly.io Deployment (Full Application)

1. Install the Fly CLI: `brew install flyctl` (or follow the [Fly docs](https://fly.io/docs/hands-on/install-flyctl/)).
2. Authenticate: `fly auth login`.
3. From the repo root run `fly launch` and accept the defaults (this generates `fly.toml`). Answer **no** when asked to deploy immediately.
4. Configure secrets so the runtime uses the pooled Supabase connection and the server knows which origins to allow:
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   fly secrets set DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
   fly secrets set ALLOWED_ORIGINS="https://your-app.fly.dev"
   ```
5. Deploy: `fly deploy`.
6. After the deployment finishes, note the generated domain (e.g. `https://your-app.fly.dev`). This is your application URL.

### Fly.io Notes

- Free allowances include one shared-CPU VM with auto sleep (`auto_stop_machines = true` in `fly.toml`). Expect a short cold start on the first request.
- Health checks hit `/healthz` or `/api/health` automatically as defined in `fly.toml`.
- The Dockerfile builds the Next.js application during the Docker build process, including icon generation and Next.js compilation.
- In-memory state (like gameEngine) resets whenever the VM restarts. Persist long-lived data in Supabase.
- Memory is set to 512mb to accommodate the full Next.js application alongside Socket.IO.

## Optional: Vercel Deployment (Frontend Only)

If you prefer to keep the frontend on Vercel for CDN benefits, you can:

1. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_SOCKET_URL=https://your-app.fly.dev` (your Fly.io domain)
   - `NEXT_PUBLIC_SOCKET_PATH=/socket.io` (only if you changed the path)
2. Configure Vercel to build only the frontend (this requires custom build configuration).
3. Note: API routes will not work on Vercel in this setup - they must be accessed via the Fly.io domain.

**Recommended:** Use the unified Fly.io deployment for simplicity and to ensure all features work correctly.

## Public Endpoints

- `GET /api/game/room/current`
  - Returns the initial room data (defaults to room `001`) without requiring authentication.
  - Response is rate limited to 60 requests per minute per IP (429 on excessive traffic).
  - Payload contains only non-sensitive information required to render the first screen.
  - Responses include `Cache-Control: private, no-store, must-revalidate` headers to prevent public caching.

All other game endpoints continue to require Bearer token authentication.

## Prisma Migrations & Baseline Reset

The schema is now tracked by a single baseline migration (`prisma/migrations/20251222024922_baseline_init`). Previous migrations have been archived in `prisma/migrations_archive/` for reference only.

1. **Develop schema changes**
   - Update [`prisma/schema.prisma`](prisma/schema.prisma).
   - Run `npx prisma migrate dev --name <change>` locally (this creates a new dated folder next to the baseline).
2. **Deploy migrations**
   - Commit the new migration folder(s).
   - In every environment (local dev DB, staging, production, Fly.io), run `npx prisma migrate deploy`.
3. **Resetting from scratch**
   - Drop the `public` schema (e.g. `psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`) or run `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<user confirmation>" npx prisma migrate reset`.
   - Run `npx prisma migrate deploy`.
   - Seed with `npx prisma db seed` (uses [`prisma/seed.ts`](prisma/seed.ts)).
   - For Fly.io, you can add a release command in `fly.toml` to run migrations before deployment.
4. **Verification**
   - `npx prisma migrate status` should report "Database schema is up to date".
   - Fly.io deployment logs should show the build process completing successfully.

## Local Development

1. Copy `env.local.template` to `.env.local`, fill in your Supabase credentials once, and keep it synced with the production values.
2. Start the combined dev server:
   - `npm run dev` (Next.js + Socket.IO on the same process, existing behavior)
3. Or run them separately for testing:
   - Terminal 1: `npm run dev:socket` (runs socket-server.js with Next.js)
   - Terminal 2: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_PATH=/socket.io npx next dev -p 3001` (runs separate Next.js instance)

The unified setup (`npm run dev`) matches production architecture where everything runs in a single process. Because the same Supabase database is used everywhere, exercise caution when running destructive operations locally.

