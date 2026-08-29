# Light Gray RPG: Claude Code Guide

## Mission

Light Gray RPG is a modern, multiplayer-capable recreation of the author's original hand-coded browser RPG. The goal is not to turn it into a generic modern RPG. Preserve the original game's identity, geography, pacing, readable mechanics, strange details, and sense of discovery while replacing fragile implementation patterns with secure, maintainable, server-authoritative systems.

## Non-negotiable reference boundary

The original game is reference material only.

- A local copy may exist at `lg-DO NOT EDIT - ORIGINAL LG RPG GAME - FOR REFERENCE ONLY/`. It is intentionally ignored by Git.
- The historical reference is also available at commit `4f68a0d` under `DO NOT EDIT - ORIGINAL LG RPG GAME - FOR REFERENCE ONLY/`.
- Never edit, rename, format, migrate, delete, move, or commit the reference directory.
- Never use `git add -f` on it or copy the full legacy application back into the tracked tree.
- Port behavior and content into the modern implementation. Do not patch the reference implementation.

## Authority order

When sources disagree, use this order:

1. The user's current instruction and explicit design decision.
2. Deliberate behavior already implemented in the modern game.
3. The original game's player-facing behavior and content.
4. Current repository documentation.
5. Inference.

Do not silently undo a modern change merely because the legacy code differs. Determine whether the difference is an intentional adaptation, an unfinished port, or a regression. Ask only when that distinction changes the player experience materially.

Comments and docs can be stale. Verify them against executable code and data.

## Product identity to preserve

The original is a compact, action-driven browser RPG rather than a cinematic or automation-heavy RPG. Its recognizable qualities include:

- A gray, restrained, color-coded visual language with simple iconography.
- A room-first world explored through a compass, cardinal and vertical exits, short descriptions, maps, and typed or clicked actions.
- A persistent action/feed rhythm: travel, look, search, rest, attack, talk, equip, use, gather, craft, and discover.
- A world that starts small and opens outward through knowledge, items, quests, abilities, keys, maps, and environmental conditions.
- Readable numbers and outcomes. Combat exposes attack, defense, damage, healing, rewards, and status changes rather than hiding everything behind animation.
- Low-level beginnings, tangible preparation, and meaningful danger. Avoid accelerating the opening until rooms, gear, rest, and early quests become disposable.
- Hand-authored oddity and humor. Names, item combinations, NPC tone, unusual routes, hidden rooms, and surprising rewards are part of the game's identity.
- Character growth through core stats, physical/mental training, equipment, weapon styles, skills, spells, quest unlocks, and eventually evolution/reset systems.
- Broad long-term content: Grassy Field and its underground areas, Forest, Red Town, Rocky Flats, mines, ocean and underwater areas, Dark Forest/Keep, Mountains, Star City, The Despair, guilds, shops, temples, bosses, companions, pets, mounts, crafting, maps, teleport discoveries, chests, and long quest chains.

Preserve the function and feeling of these systems. Do not reproduce legacy bugs, insecure SQL/session patterns, giant conditional files, duplicated formulas, or accidental balance exploits for the sake of literal fidelity.

## Current implementation snapshot

The runnable game is a Next.js 15 / React 19 application using TypeScript, some CommonJS JavaScript, Prisma 7, PostgreSQL, Zustand, and Socket.IO. `server.js` runs Next.js and the realtime server together in development; `socket-server.js` is the production-oriented unified entry point.

This is an active recreation, not a greenfield prototype. Extend what exists before introducing a parallel system.

## Architecture and state flow

### Primary command path

For gameplay mutations, the intended flow is:

```text
React UI
  -> typed Socket.IO command
  -> src/lib/socket-server-handlers.js
  -> GameEngine per-player action queue
  -> RoomState / domain service
  -> Prisma transaction or durable write when needed
  -> structured player, room, and global events
  -> Zustand/UI projection
```

- The server validates identity, location, ownership, gates, costs, cooldowns, and legal transitions.
- The client may predict presentation, especially movement, but it does not decide the result.
- Failed server confirmation must reconcile optimistic UI back to authoritative state.
- `src/app/api/game/action/route.ts` and `src/app/api/game/navigate/route.ts` are deprecated. Do not revive a second HTTP gameplay engine.
- HTTP routes remain useful for authentication, initial/read hydration, quests, profiles, world-tool data, shops, DMs, and other request/response features. Mutations still need server-side authorization and invariant checks.

### State ownership

Treat each kind of state according to its lifetime:

- **Durable PostgreSQL/Prisma state:** accounts, player progression and vitals, current room, inventory, equipped `PlayerItem` rows, item templates, rooms, quests, battle logs, chat/DM history, action caps, and persisted per-player room enemy rosters.
- **Ephemeral server state:** active sockets, live room membership, active battles, action queues, party/follow relationships, ghosts/idle presence, lever state, and temporary search reveals. This state disappears on process restart unless intentionally persisted.
- **Client projection:** Zustand player/room/inventory/battle/party state, room caches, pending movement, panels, notifications, and local presentation preferences.
- **Local browser persistence:** feed/settings conveniences only. Never make local storage authoritative for rewards, location, progress, inventory, combat, or access.

Before changing a system, name its authoritative owner and decide what reconnect, refresh, duplicate socket, server restart, and concurrent actions should do.

### Important repository areas

- `src/lib/game-engine/engine.js`: tick orchestration, per-player action serialization, result routing, room transfers.
- `src/lib/game-engine/room-state.js`: room actions, player-scoped enemy rosters, movement rules, battle integration, ambient updates.
- `src/lib/game-engine/battle-*.js`: battle state, formulas, action resolution, rewards, defeat.
- `src/lib/game-engine/services/`: inventory, equipment, quests, leveling, room items, cooldowns, roster persistence.
- `src/lib/game-engine/room-action-handlers.js`: hand-authored room interactions, gathering, chests, crafting, and environmental actions.
- `src/lib/game-engine/room-gates.js`, `lever-state.js`, `search-reveal-state.js`: access and discovery logic.
- `src/lib/game-data/enemies.js`: enemy definitions and drops.
- `src/lib/game-data/room-enemies.js`: room spawn/wave rules.
- `src/lib/game-data/quests.json`: quest definitions; validate with `npm run validate-quests`.
- `src/lib/game-data/crafting-recipes.js`: shared client/server recipe definitions.
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`: durable schema and authored world/item data.
- `src/lib/socket-server-handlers.js`, `src/lib/socket.ts`, `src/lib/socket-utils.js`, `src/lib/socket-handlers.ts`: realtime transport and contracts.
- `src/lib/game-state.ts`: central client gameplay store.
- `src/components/GameInterface.tsx`: current top-level gameplay coordinator and layout.
- `src/components/game-interface/panels/`: focused character, inventory, quest, battle, map, party, player, feed, chat, crafting, and settings views.
- `src/app/rooms`, `src/app/items`, `src/app/enemies`, `src/app/quests`, `src/app/players`, `src/app/world-tool`: read-oriented world reference tools.
- `public/icons`, `public/img`: visual assets and maps. Generated sprite artifacts are intentionally ignored.

### Known seams to handle carefully

- The Node game runtime uses CommonJS while the app uses TypeScript/ES modules. Some shared contracts have JS and TS mirrors. When changing an event, room normalizer, or shared payload, find and update every runtime and type mirror or intentionally consolidate them in a scoped change.
- `Equipment` string slots and equipped `PlayerItem` rows coexist for compatibility. New gameplay should use the `PlayerItem`/`ItemTemplate` model unless a task explicitly migrates the legacy relation. Do not create a third equipment representation.
- Room topology/content is seeded in Prisma, while encounters, gates, actions, reveals, compass positions, and some map behavior live in separate modules. A room port is incomplete until these agree.
- `GameInterface.tsx` and several engine/socket files are large coordinators. Avoid unrelated rewrites. Extract a focused boundary when it reduces duplication for the feature being changed, while preserving behavior.
- The unified single-process deployment allows API routes to see the in-memory engine. Do not assume that property will remain safe under multiple instances. Durable truth belongs in the database; process-local state must be explicitly ephemeral or made instance-safe.

## Gameplay invariants

### Actions and time

- Player actions are serialized per player through `PlayerActionQueue`; preserve this protection against double clicks and races.
- Do not tie every action to the world tick. The current tick is UTC-aligned and used for shared ambient/world timing; gather caps use rolling cooldowns and combat is action-driven.
- Decide explicitly whether an action consumes a turn. In the current game, rest, search, use/equip/unequip, pickup/drop, and similar actions can provoke enemy behavior; free informational actions should not accidentally advance combat.
- Count clicks consistently and exclude chat as the engine currently does unless the design is intentionally changed.
- Time displayed by the UI should be derived from server timestamps, not trusted client clocks.

### Rooms, exploration, and gates

- Room IDs are stable content identities. Preserve original IDs when porting corresponding rooms.
- Every exit must have a valid reciprocal or intentionally one-way relationship. Hidden exits must remain hidden until revealed even if the destination exists in data.
- Validate movement from the server's current player room; never trust client-supplied `fromRoom`, `toRoom`, direction, or unlocked-map state by itself.
- Teleport and recall are progression systems, not unrestricted debug navigation. Validate discovered destinations, costs, combat restrictions, party rules, and exceptional rooms on the server.
- Gates can depend on quests, level, equipped gear, items, abilities such as wings/gills, levers, searches, or other discoveries. Keep the blocked message and discovery experience as part of the content.
- A room is more than a name and connections. Port description, subtitle, icon/color, map placement, NPCs, actions, items, encounter rules, gates, search/reveal behavior, and relevant quest hooks together.

### Combat

- Combat is server-authoritative and intentionally legible. Preserve the recognizable random-roll shape unless a balance task explicitly changes it: an offensive roll opposed by a defensive roll, floored at zero, with weapon/enemy type determining the relevant stat.
- Current melee uses STR, ranged uses DEX, and incoming melee/ranged/magic attacks defend with DEF/DEX/MAG respectively. Flying enemies reject melee attacks.
- Refresh/equipment/use-item behavior during battle must not grant free turns, reset enemy state, duplicate drops, or bypass damage.
- Rewards, kill counts, quest progress, first-kill drops, currency, XP, and inventory changes must be idempotent or transactionally protected.
- Defeat, flee, disconnect, reconnect, and movement must clean up or restore battle flags consistently.
- Preserve readable battle feedback and the danger of poor preparation. Animation can clarify outcomes but must not conceal them or delay authoritative state.

### Multiplayer

The current model is not a shared-enemy MMO combat model:

- Players share presence, room/world chat, DMs, activity, live vitals, and battle status.
- Parties are ephemeral leader/follower groups of up to six. Members are pulled with the leader and cannot move independently while following.
- Battles are currently player-scoped. Co-located active combatants and party members grant a 10% offensive and defensive bonus per other counted combatant.

Preserve that model unless the user explicitly chooses a shared encounter/party-combat redesign. Do not gradually mix shared enemy HP, individual enemy rosters, shared loot, and independent rewards; that creates unclear ownership and exploits.

For every multiplayer change, reason through:

- two players acting at the same time;
- two sockets for one account;
- leader/member travel and gate differences;
- disconnect/reconnect and server restart;
- who receives an event and who may see private data;
- reward ownership, contribution, kill credit, and loot rules;
- whether state is player-scoped, party-scoped, room-scoped, or global.

### Progression, inventory, and economy

- Preserve the original cubic XP curve currently implemented as `2 * (level + 1)^3`, one CP and TP per level, SP equal to the new level capped at 20 per level, and HP/MP growth based on physical/mental training unless a deliberate balance change is requested.
- Core stats, training, skills, spells, equipment, and consumables should remain distinct progression choices rather than collapsing into one gear-score system.
- Use stable slugs/IDs for items, enemies, quests, recipes, and effects. Display names may change without breaking saved progress.
- Inventory ownership, stack caps, equip slots, two-handed/off-hand conflicts, shop value, drop restrictions, and consumable effects are validated on the server.
- Use transactions for multi-resource changes such as crafting, buying/selling, quest turn-ins, chests, and battle rewards.
- Do not let the client dictate prices, quantities, rewards, stats, cooldown completion, or item metadata.
- When changing an item template or quest ID, consider existing persisted rows and supply a migration/compatibility path.

### Quests and authored content

- Keep quest content declarative in `quests.json` and behavior generic in the quest service when possible.
- Prefer reusable requirements/effects over quest-ID conditionals. Add a new requirement/effect type only when it represents a reusable game concept.
- Quest acceptance, progress, consumption, reward grants, and follow-up quest activation must be atomic and safe to retry.
- Preserve the original's staged discovery: NPC dialog, environmental clues, item hunts, kill goals, keys, skill teachers, and world access should reinforce one another.
- Keep the World Tool/read pages derived from the same definitions used by gameplay so documentation does not drift.

## How to port a legacy slice

Work vertically and incrementally. A good slice is a room cluster, quest step, enemy family, shop, or crafting tier that can be played and verified end to end.

1. **Trace the original experience.** Read the relevant room file, room description, battle set, quest conditions, item/equipment code, map/teleport conditions, and action handlers. Record what the player sees, can do, must earn, risks, and receives.
2. **Trace the modern dependencies.** Find the current room seed, gates, actions, enemies, items, quests, maps, socket events, state updates, and UI surfaces. Search by room ID and stable slug, not only display name.
3. **Write a short behavior contract.** State entry conditions, actions, turn cost, success/failure results, persistence scope, multiplayer scope, reconnect behavior, and rewards.
4. **Choose fidelity deliberately.** Classify each difference as `preserve`, `modernize`, `defer`, or `discard as legacy defect`. Mention material deviations in the change summary.
5. **Implement one authoritative path.** Put mechanics in the engine/service layer, durable data in Prisma/data definitions, and presentation in React. Do not duplicate rules in buttons or API routes.
6. **Verify the loop.** Test arrival, look/search/talk, combat or interaction, reward/progress, leaving/returning, refresh/reconnect, blocked paths, and a second player's view.
7. **Stop at a coherent boundary.** Do not pre-build speculative abstractions for distant legacy systems. Generalize after at least two real cases reveal the stable pattern.

## Modernization principles

Modernization should improve reliability, clarity, accessibility, responsiveness, security, and multiplayer coherence without sanding off the game's personality.

Prefer:

- structured events over parsing feed strings;
- declarative definitions over huge conditional files;
- stable identifiers over display-name coupling;
- transactions and idempotency over ordered side effects;
- server validation over hidden/disabled client controls;
- small domain services over new god objects;
- responsive, keyboard/touch-friendly UI that keeps the room, compass, action, feed, and character state easy to scan;
- the existing gray/color vocabulary and icon style over an unrelated design-system makeover;
- observability around queues, ticks, persistence, and socket errors without logging secrets or tokens.

Avoid:

- generic MMO systems added only because they are conventional;
- idle-game automation that replaces deliberate actions;
- global balance rewrites while porting content;
- hiding the world's navigation and mechanics behind excessive menus;
- client-only fixes for server-state bugs;
- broad migrations without a saved-player compatibility plan;
- treating every legacy quirk as canon or every old implementation detail as a requirement.

## Working method

Before editing:

- Read the task-relevant modern files and the corresponding legacy reference files.
- Check Git history when a surprising modern behavior may be intentional.
- Search for all uses of affected room IDs, quest IDs, item/enemy slugs, socket events, Prisma fields, and local-storage keys.
- Identify durable, ephemeral server, and client state involved.
- Note multiplayer and migration consequences before changing schemas or contracts.

While editing:

- Make the smallest coherent change, not the smallest textual patch.
- Keep mechanics out of React event handlers.
- Reuse existing normalization and inventory/equipment/quest services.
- Validate all client-controlled identifiers and values.
- Preserve unrelated user changes and avoid mass formatting.
- Do not perform a large architectural rewrite without explicit approval.

After editing:

- Verify success, failure, retry, refresh/reconnect, and concurrency-sensitive paths.
- Confirm server, client types, socket constants, payload handlers, and UI projections agree.
- Confirm room/item/quest/enemy definitions and World Tool views agree.
- Run the narrowest relevant checks, then broader checks proportional to risk.
- Summarize what stayed faithful, what was modernized, and any unresolved design decision.

## Validation commands

Use the commands relevant to the change:

```bash
npm run validate-quests
npm run lint
npm run build
```

For schema changes:

```bash
npx prisma generate
npx prisma migrate dev --name <descriptive-name>
npx prisma migrate status
```

Do not reset, drop, or reseed a database without explicit confirmation. Local and production environments may point to shared Supabase data.

There is currently no comprehensive automated gameplay test suite. For mechanic changes, add focused tests where practical and perform an explicit manual scenario check. A build alone does not validate socket ordering, persistence, balance, or multiplayer behavior.

## Definition of done

A gameplay change is done when:

- it matches an understood behavior contract;
- legacy fidelity and intentional modernization are distinguishable;
- the server remains authoritative;
- durable and ephemeral state behave correctly across refresh/reconnect;
- duplicate actions cannot duplicate costs or rewards;
- affected socket and HTTP payloads remain compatible or are migrated together;
- the UI works at desktop and mobile sizes and preserves keyboard/touch basics;
- another player receives only the correct room/global/private events;
- authored data and World Tool/read views do not drift;
- relevant validation passes;
- the reference game remains untouched.

## Ask only high-value questions

Proceed with reasonable, reversible assumptions. Ask before implementation when the answer would materially change canon, progression, persistence, multiplayer ownership, economy, or saved-player compatibility. In particular, do not assume a transition from the current player-scoped battle model to shared party encounters, or that a modern deviation from the original should be reverted, without an explicit decision.
