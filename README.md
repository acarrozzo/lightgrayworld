# Light Gray

A multiplayer recreation of Light Gray RPG, a browser RPG I hand-coded in the early 2000s. The rooms, items, enemies and quests are ported from the original. The implementation is new: a server-authoritative Next.js app that brings a true shared multiplayer world experience while keeping the original's single-player, casual, turn-based progression.

It is a room-based, click-driven game. You travel, look, search, rest, attack, talk, equip, use, gather and craft. The numbers are shown, preparation matters, and dying has a cost.

## Stack

Next.js 15 and React 19 in TypeScript, with the game engine in CommonJS JavaScript. Prisma 7 on PostgreSQL (Supabase). Socket.IO for every gameplay command and live presence. Zustand for the client store. Tailwind 4 with a generated, theme-aware color system.

One Node process serves the Next.js app and the realtime server together. The server decides every result; the client only draws.

## Run it locally

Needs Node 20+ and a Supabase (or any PostgreSQL) database.

```bash
npm install
cp env.local.template .env.local   # fill in DATABASE_URL and DIRECT_URL
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:3000. The seed creates a test account, `testuser` / `password123`.

The dev and production databases may be the same Supabase project. Do not reset or reseed without checking which one `.env.local` points at.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Generate icons, themes and bosses, then start the unified dev server |
| `npm run dev:clean` | Same, after clearing `.next` |
| `npm run dev:engine` | Dev server that restarts when engine or game-data files change |
| `npm run check` | Validators, typecheck, lint and tests in one go |
| `npm test` | The `test/` suite (node test runner) |
| `npm run validate` | Quest, world-data and theme integrity checks |
| `npm run generate-themes` | Rebuild `src/app/generated-themes.css` after editing a theme |
| `npm run build` | Production build, validators included |

## Where things are

- `src/lib/game-engine/` is the server-side game: the action queue, room state, battles, services.
- `src/lib/game-data/` is the authored world: enemies, quests, spells, skills, recipes, maps, travelers.
- `prisma/seed.ts` holds the rooms and item templates.
- `src/components/` is the React client; `GameInterface.tsx` is the top-level coordinator.
- `src/app/(world-tool)/` is a read-only reference site for the world's data, built from the same definitions the game uses.

`CLAUDE.md` is the full working brief: architecture, invariants, and how to port a slice of the original. `DEPLOYMENT.md` covers Fly.io and migrations. `docs/DECISIONS.md` records the design calls that shaped the recreation. `ICON_BUILD_PROCESS.md` explains the sprite sheet.

The original game sits beside this repo for reference only and is never edited or committed.

## Status

The whole original map is ported except the Swamp. Combat, inventory, equipment, quests, factions, skills, spells, crafting, teleports, parties, chat, death and rebirth, and traveling NPCs are all in. Balance of the late game is still being tuned. One player at a time is the normal case today; the multiplayer model is there and tested, but has had little live traffic.
