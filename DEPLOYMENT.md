# Deployment Guide

## Overview

The application now runs as two services:

- **Next.js frontend**: deploy to Vercel.
- **Socket.IO realtime server**: deploy to Koyeb (or any long-lived Node host).

Environment variables drive which Socket.IO endpoint the client uses so local development and production both work without code changes.

## Environment Variables

Reference `env.local.template` for sample values.

| Variable | Location | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel + local | Base URL of the Socket.IO server. Use `http://localhost:3000` locally and your `https://*.koyeb.app` domain in production. |
| `NEXT_PUBLIC_SOCKET_PATH` | Vercel + local | Socket.IO path (defaults to `/socket.io`). Only set if you change it on the server. |
| `ALLOWED_ORIGINS` | Koyeb | Comma-separated list of frontend origins allowed to connect (e.g. `https://your-app.vercel.app,https://preview-url.vercel.app`). |
| `DATABASE_URL` | Vercel + Koyeb | Shared database connection string. |
| `PORT` | Koyeb | Koyeb injects this automatically (defaults to `8000`). |

## Koyeb Deployment (Socket Server)

1. Create a new Node.js service in Koyeb and connect this repository.
2. In the build configuration, set the **run command** to `node socket-server.js` or keep the generated `Procfile`.
3. Add environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL` for your production database
   - `ALLOWED_ORIGINS` containing your Vercel production (and optional preview) URLs
4. Deploy. After the deployment finishes, note the generated domain (e.g. `https://your-app.koyeb.app`).
5. Configure the health check path in Koyeb to `/healthz`.
6. Optional: hit `https://your-app.koyeb.app/healthz` to confirm the service is awake.

### Free Tier Notes

- Instances sleep after ~60 minutes of inactivity. The first connection after sleep cold-starts the service (expect a short delay and a reconnect attempt).
- In-memory state (maps of active players) resets on restart. Persist long-lived state in your database if/when needed.

## Vercel Deployment (Frontend)

1. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_SOCKET_URL=https://your-app.koyeb.app`
   - `NEXT_PUBLIC_SOCKET_PATH=/socket.io` (only if you changed the path)
   - `DATABASE_URL` matching the Koyeb value
2. Deploy the Next.js app. Vercel will build the frontend only (`next build`).
3. Test the deployed site and confirm the browser console shows a successful socket connection to the Koyeb URL (look for `Connected with ID:` logs).

## Local Development

1. Copy `env.local.template` to `.env.local` (ignored by Git) and adjust if needed.
2. Start the combined dev server:
   - `npm run dev` (Next.js + Socket.IO on the same process, existing behavior)
3. Or run them separately for parity with production:
   - Terminal 1: `npm run dev:socket`
   - Terminal 2: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_PATH=/socket.io npx next dev -p 3001`

With the split setup, the browser connects to the same socket URL configured in environment variables, so switching between local and production versions requires no code edits.

