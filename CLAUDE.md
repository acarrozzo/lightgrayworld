# CLAUDE.md

## Project Overview

Light Gray World is a browser-based multiplayer RPG built with:

* Next.js 15
* React 19
* TypeScript
* Prisma
* PostgreSQL
* Socket.io

This project contains a custom game engine responsible for combat, entities, world state, progression, and multiplayer synchronization.

---

## Working Rules

When making changes:

1. Read only files directly related to the task.
2. Do not scan the entire repository unless explicitly requested.
3. Preserve existing architecture and patterns.
4. Prefer small targeted changes over large refactors.
5. Explain architectural concerns before implementing major changes.
6. Ask me questions for clarity and understanding, until you are satisfied with your information to properly execute the task.

---

## Repository Areas

### Frontend

```text
src/app
src/components
```

Contains UI, screens, dialogs, HUD elements, inventory, character views, and player interactions.

### Game Engine

```text
src/lib/game-engine
```

Contains:

* Combat
* Character systems
* Items
* Skills
* Quests
* World logic
* Progression systems

Treat this as the source of truth for game mechanics.

### Multiplayer

```text
server.js
src/lib/socket
```

Contains:

* Socket.io events
* Player synchronization
* Realtime interactions

### Database

```text
prisma
```

Contains:

* Prisma schema
* Migrations
* Seed data

---

## Development Commands

Install:

```bash
npm install
```

Development:

```bash
npm run dev
```

Database:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

Build:

```bash
npm run build
```

---

## Code Style

### TypeScript

* Prefer explicit types.
* Avoid `any`.
* Reuse existing types when available.

### React

* Functional components only.
* Follow existing patterns.
* Keep components focused and small.

### Game Systems

Before modifying mechanics:

1. Identify where the authoritative state lives.
2. Check for multiplayer implications.
3. Check persistence implications.
4. Verify UI updates remain synchronized.

---

## When Debugging

For bugs:

1. Identify affected feature.
2. Read only relevant files.
3. Trace state flow.
4. Propose root cause.
5. Suggest fix before large changes.

---

## Common Requests

### Adding a Feature

* Identify affected game system.
* Minimize surface area.
* Avoid duplicate logic.

### Fixing a Bug

* Reproduce.
* Isolate.
* Patch.
* Verify related systems.

### Refactoring

* Preserve behavior.
* Keep changes incremental.
* Avoid broad repository-wide rewrites.

---

## Important

Do not perform large architectural rewrites unless explicitly requested.

For most tasks, only a small subset of files should be loaded into context.
