# Deployment Guide

## Overview

The application runs as two services:

- **Next.js frontend**: deploy to Vercel.
- **Socket.IO realtime server**: deploy to Fly.io.

Environment variables drive which Socket.IO endpoint the client uses so local development and production both work without code changes.

## Environment Variables

Reference `env.local.template` for sample values.

| Variable | Location | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel + local | Base URL of the Socket.IO server. Use `http://localhost:3000` locally and your `https://*.fly.dev` domain in production. |
| `NEXT_PUBLIC_SOCKET_PATH` | Vercel + local | Socket.IO path (defaults to `/socket.io`). Only set if you change it on the server. |
| `ALLOWED_ORIGINS` | Fly.io | Comma-separated list of frontend origins allowed to connect (e.g. `https://your-app.vercel.app,https://preview-url.vercel.app`). |
| `DATABASE_URL` | Vercel + Fly.io | Supabase PgBouncer connection string used at runtime (`6543` with `?pgbouncer=true`). |
| `DIRECT_URL` | Local + Fly.io (migrations only) | Supabase direct connection string used exclusively by Prisma migrations (`5432`, no PgBouncer). |
| `PORT` | Fly.io | Fly injects this automatically (defaults to `8080`). Bind your server to `process.env.PORT`. |

## Fly.io Deployment (Socket Server)

1. Install the Fly CLI: `brew install flyctl` (or follow the [Fly docs](https://fly.io/docs/hands-on/install-flyctl/)).
2. Authenticate: `fly auth login`.
3. From the repo root run `fly launch` and accept the defaults (this generates `fly.toml`). Answer **no** when asked to deploy immediately.
4. Configure secrets so the runtime uses the pooled Supabase connection and the server knows which origins to allow:
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   fly secrets set DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
   fly secrets set ALLOWED_ORIGINS="https://your-app.vercel.app,https://your-app-git-preview.vercel.app"
   ```
5. Deploy: `fly deploy`.
6. After the deployment finishes, note the generated domain (e.g. `https://your-app.fly.dev`) and set it as `NEXT_PUBLIC_SOCKET_URL` in Vercel.

### Fly.io Notes

- Free allowances include one shared-CPU VM with auto sleep (`auto_stop_machines = true` in `fly.toml`). Expect a short cold start on the first request.
- Health checks hit `/healthz` automatically as defined in `fly.toml`.
- In-memory state resets whenever the VM restarts. Persist long-lived data in Supabase.

## Vercel Deployment (Frontend)

1. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_SOCKET_URL=https://your-app.fly.dev`
   - `NEXT_PUBLIC_SOCKET_PATH=/socket.io` (only if you changed the path)
   - `DATABASE_URL` matching the Koyeb value
   - `DIRECT_URL` matching the value set in Fly secrets (required for `prisma migrate deploy`)
2. Deploy the Next.js app. Vercel will build the frontend only (`next build`).
3. Test the deployed site and confirm the browser console shows a successful socket connection to the Fly.io URL (look for `Connected with ID:` logs).

## Public Endpoints

- `GET /api/game/room/current`
  - Returns the initial room data (defaults to room `001`) without requiring authentication.
  - Response is rate limited to 60 requests per minute per IP (429 on excessive traffic).
  - Payload contains only non-sensitive information required to render the first screen.
  - Responses include `Cache-Control: private, no-store, must-revalidate` headers to prevent public caching.

All other game endpoints continue to require Bearer token authentication.

## Local Development

1. Copy `env.local.template` to `.env.local`, fill in your Supabase credentials once, and keep it synced with the production values.
2. Start the combined dev server:
   - `npm run dev` (Next.js + Socket.IO on the same process, existing behavior)
3. Or run them separately for parity with production:
   - Terminal 1: `npm run dev:socket`
   - Terminal 2: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_PATH=/socket.io npx next dev -p 3001`

With the split setup, the browser connects to the same socket URL configured in environment variables, so switching between local and production versions requires no code edits. Because the same Supabase database is used everywhere, exercise caution when running destructive operations locally.

