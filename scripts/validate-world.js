#!/usr/bin/env node
/**
 * World data integrity check — the peer of validate-quests.js for everything
 * that is *not* a quest.
 *
 * The world is authored across a dozen files that reference each other only by
 * string id: the seed owns room topology, room-enemies owns spawns, enemies owns
 * drops, room-gates owns access, room-loot owns ground items, shops and recipes
 * own trade and crafting, and two client tables own the map and the action
 * buttons. Nothing checks that those references agree, so a typo fails silently
 * at runtime — a drop that never drops, a button that errors, a marker drawn on
 * the wrong cell, an exit into nowhere.
 *
 * quests.json is the one layer that already had a validator, and it is the one
 * layer that was clean. This script extends the same idea to the rest.
 *
 * Everything here is static: no database, no running server. Deliberate
 * deviations live in the ACCEPTED table below, so "intentional" is recorded in
 * the repo instead of in someone's memory.
 *
 * Run: node scripts/validate-world.js   (or: npm run validate-world)
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const load = (rel) => require(path.join(ROOT, rel))

// ─── Deliberate deviations ────────────────────────────────────────────────────
// Each entry is a decision, not a bug. Removing one should make this script fail.

const ACCEPTED = {
  // Exits with no return path. Verified against the original game's room files:
  // boss portals, one-way drops, and shortcuts that only run downhill.
  oneWayExits: new Set([
    '111k:southeast', // boss portal, gate-guarded
    '115k:northeast', // boss portal, gate-guarded
    '315d:east', // documented one-way in the seed
    '232b:east', // sewer pipe, noted in the Red Town port
    '118:west', // legacy asymmetry, faithful to the original
    '135:west', // legacy asymmetry, faithful to the original
    '020:northwest', // Room Zero is left by its own teleport button
    '028e:east',
    '111:northeast',
    '111:southeast',
    '115:southeast',
    '128:northeast',
    // Kobold Temple drops into the Lair Exit; 115a's own description ("passages
    // lead east and west") matches having no way back up. The long way round is
    // 115d southeast -> 115c -> 115a.
    '115d:south',
    // The Blue Ocean's currents. The original's ocean is full of one-way water:
    // "the natural water current here wants to take you southwest", "a strong
    // current drags you east", the storm you sail into and cannot sail out of.
    // Every one of these is the original's room file, checked exit by exit.
    '404:south', // the beachside current onto the Yellow temple; the temple sails west
    '404:west', // the beachside current onto the storm water, which runs north and south
    '405:northeast', // the Yellow temple's northeast current onto the beach water
    '407:north', // into the storm; the storm has no way back
    '408:south', // the jetty lands you on the Oasis; the Oasis sails elsewhere
    '409:east', // the Blue temple's east current into the quiet water
    '410:down', // out of the storm, down to the floor; the floor has no way up here
    '411:southwest', // toward the swamp water, which drifts west and north only
    '413:east', // the Oasis's east current onto the storm water
    '413:southeast', // the Oasis's southeast current onto the crossing
    '414:north', // north onto the Oasis; the Oasis has no south
    '414:south', // south onto the calm water, which has no north
    '415:northeast', // the calm water's northeast current onto the crossing
    '415:south', // south to the swamp water, which drifts west and north only
    '417:north', // the whirlpool's north current onto the Green temple
    '421:east', // off the massive wave; nothing sails west back onto it
    '480:northeast', // up out of the silver chest hollow
    '484:up', // up to the jetty; the jetty does not dive
    '487:east', // "a strong current drags you to the east"
    '488:up', // up to the beach water; the beach water does not dive
    '489:northwest', // into the cavern, which only leads on
    '489:southeast', // into the Mud Crab Nest, which is dry cave and does not swim
    '493:northwest', // the alcove's dark passage to the silver chest hollow
    '498:northwest', // the cavern lets out onto the wide floor
  ]),

  // Rooms deliberately not reachable by walking from the start room.
  //
  // 031 ("Stairway to Heaven") is endgame content with no entrance yet, and no
  // counterpart in the original at all — it is new to this version. It stays
  // seeded so the room id is reserved and its description is not lost.
  detachedRooms: new Set(['031']),

  // Rooms with no map cell. 031 has no entrance, so it has nowhere to be drawn;
  // 029 now has one, since it is reachable (see below).
  roomsWithoutMapCoords: new Set(['031']),

  // 029 ("Guardian Angel", the Destroyed Academy) is reachable and empty, and
  // that is a deliberate choice rather than an unfinished port left showing.
  //
  // The original gated 005-north on the Goblin Chief kill ("Complete Jack
  // Lumber's quests to open this gate") and put the Grand Quest 1-4 chain in
  // 029. Neither is ported. Rather than restore the gate, the room is left open
  // as a teaser for content still to come — so a bare room with an epic
  // description is expected here, not a bug.
  openEmptyRooms: new Set(['029']),

  // Enemies authored ahead of the map that will hold them. They are named by
  // acceptable quests, so they must exist — they simply have no spawn yet.
  unspawnedEnemies: new Set([
    'stone-sphinx',
    'gatekeeper',
    'troll-champion',
    'troll-queen',
    // Jungle Jim's "Angry Birds" wants a Falcon; it lives in the Dark Forest.
    'falcon',
  ]),
}

/**
 * Known gaps: real defects, not decisions.
 *
 * Separate from ACCEPTED on purpose — these are reported as warnings on every
 * run so they stay visible, rather than being blessed into silence. Fix the
 * content and delete the entry; do not add to this list to quiet a new failure.
 */
const KNOWN_GAPS = {
  // Buttons the client renders with no server handler, so clicking them returns
  // "Unknown action type". Empty, and worth keeping that way: the three that
  // were here — 007 and 021's signs, and 021's "buy staff" — are fixed. Both
  // signs are ported from the original; the staff button was removed, since the
  // Pajama Shaman never sold one in any version.
  deadButtons: new Set([]),
}

// ─── Sources ──────────────────────────────────────────────────────────────────

const DIRECTIONS = [
  'north', 'northeast', 'east', 'southeast', 'south',
  'southwest', 'west', 'northwest', 'up', 'down',
]

/** Opposite direction, for reciprocity. up/down included; diagonals mirror. */
const OPPOSITE = {
  north: 'south', south: 'north', east: 'west', west: 'east',
  northeast: 'southwest', southwest: 'northeast',
  northwest: 'southeast', southeast: 'northwest',
  up: 'down', down: 'up',
}

/**
 * Rooms from prisma/seed.ts. Each room is a flat object literal, so the slice
 * from one `roomId:` to the next contains exactly that room's exit fields.
 */
function loadRooms() {
  const seed = read('prisma/seed.ts')
  const marks = [...seed.matchAll(/roomId:\s*'([^']+)'/g)]
  const rooms = new Map()

  marks.forEach((mark, i) => {
    const roomId = mark[1]
    const slice = seed.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : seed.length)
    const exits = {}
    for (const dir of DIRECTIONS) {
      const m = slice.match(new RegExp(`\\b${dir}:\\s*(?:'([^']*)'|null)`))
      if (m && m[1]) exits[dir] = m[1]
    }
    // A roomId can appear more than once (later seeds patch earlier ones);
    // merge so the union of declared exits is validated.
    if (rooms.has(roomId)) Object.assign(rooms.get(roomId).exits, exits)
    else rooms.set(roomId, { roomId, exits })
  })

  return rooms
}

/** Item slugs — same superset approach validate-quests uses. */
function loadItemSlugs() {
  const slugs = new Set()
  for (const m of read('prisma/seed.ts').matchAll(/slug:\s*['"]([^'"]+)['"]/g)) slugs.add(m[1])
  return slugs
}

/** `'115h': { x: 350, y: 350 }` entries from the client map table. */
function loadMapCoords() {
  const src = read('src/components/game-interface/room-map-positions.ts')
  const coords = new Map()
  for (const m of src.matchAll(/'([^']+)':\s*\{\s*x:\s*(-?\d+)\s*,\s*y:\s*(-?\d+)\s*\}/g)) {
    coords.set(m[1], { x: Number(m[2]), y: Number(m[3]) })
  }
  const centered = new Set()
  const centeredBlock = src.match(/const CENTERED_ROOMS = new Set\(\[([\s\S]*?)\n\]\)/)
  if (centeredBlock) {
    for (const m of centeredBlock[1].matchAll(/'([^']+)'/g)) centered.add(m[1])
    // The mine shafts are generated rather than listed:
    //   ...Array.from({ length: 30 }, (_, i) => `311-${String(i + 1).padStart(2, '0')}`)
    const generated = centeredBlock[1].match(
      /Array\.from\(\{\s*length:\s*(\d+)\s*\}[\s\S]*?`([^`$]*)\$\{String\(i \+ 1\)\.padStart\((\d+),\s*'([^']*)'\)\}`/
    )
    if (generated) {
      const [, count, prefix, width, padChar] = generated
      for (let i = 1; i <= Number(count); i++) {
        centered.add(`${prefix}${String(i).padStart(Number(width), padChar)}`)
      }
    }
  }
  return { coords, centered }
}

/**
 * Extract `'roomId': [ ... ]` blocks by balancing brackets, so a one-line empty
 * entry (`'003b': [],`) cannot swallow the entries that follow it.
 */
function parseKeyedArrayBlocks(src) {
  const blocks = new Map()
  const keyRe = /'([^']+)':\s*\[/g
  let match
  while ((match = keyRe.exec(src)) !== null) {
    let depth = 1
    let i = keyRe.lastIndex
    while (i < src.length && depth > 0) {
      const ch = src[i]
      if (ch === '[') depth++
      else if (ch === ']') depth--
      i++
    }
    blocks.set(match[1], src.slice(keyRe.lastIndex, i - 1))
    keyRe.lastIndex = i
  }
  return blocks
}

const rooms = loadRooms()
const itemSlugs = loadItemSlugs()
const { coords: mapCoords, centered: centeredRooms } = loadMapCoords()

const { ENEMIES } = load('src/lib/game-data/enemies.js')
const { ROOM_ENEMIES } = load('src/lib/game-data/room-enemies.js')
const { ROOM_GATES } = load('src/lib/game-engine/room-gates.js')
const { REVEAL_DEFINITIONS } = load('src/lib/game-engine/search-reveal-state.js')
const { ROOM_LOOT } = load('src/lib/game-engine/config/room-loot.js')
const { SHOPS } = load('src/lib/game-data/shops.js')
const { CRAFTING_ROOMS, CRAFTING_RECIPES } = load('src/lib/game-data/crafting-recipes.js')
const { ROOM_ACTIONS: SERVER_ROOM_ACTIONS } = load('src/lib/game-engine/room-action-handlers.js')
const {
  TELEPORT_LOCATIONS,
  isFixedTeleportDestination,
} = load('src/lib/game-data/teleport-destinations.js')
const QUESTS = load('src/lib/game-data/quests.json')

const enemySlugs = new Set(ENEMIES.map((e) => e.slug))
const questIds = new Set(Object.keys(QUESTS))

// ─── Reporting ────────────────────────────────────────────────────────────────

const errors = []
const warnings = []
const err = (scope, msg) => errors.push(`  [${scope}] ${msg}`)
const warn = (scope, msg) => warnings.push(`  [${scope}] ${msg}`)
const isRoom = (id) => rooms.has(id)

// ─── 1. Room graph ────────────────────────────────────────────────────────────

for (const { roomId, exits } of rooms.values()) {
  for (const [dir, dest] of Object.entries(exits)) {
    if (!isRoom(dest)) {
      err('exits', `${roomId} ${dir} leads to "${dest}", which is not a seeded room`)
      continue
    }
    // Reciprocity: the destination should come back, by any direction.
    const back = rooms.get(dest).exits
    const returns = Object.values(back).includes(roomId)
    if (!returns && !ACCEPTED.oneWayExits.has(`${roomId}:${dir}`)) {
      err('exits', `${roomId} ${dir} -> ${dest} has no return path (add to ACCEPTED.oneWayExits if deliberate)`)
    }
  }
}

// Reachability by walking from the start room, plus the teleport network.
{
  const seeds = ['001', ...TELEPORT_LOCATIONS.map((l) => l.roomId)].filter(isRoom)
  const seen = new Set(seeds)
  const queue = [...seeds]
  while (queue.length) {
    const current = queue.shift()
    for (const dest of Object.values(rooms.get(current).exits)) {
      if (isRoom(dest) && !seen.has(dest)) {
        seen.add(dest)
        queue.push(dest)
      }
    }
  }
  for (const roomId of rooms.keys()) {
    if (!seen.has(roomId) && !ACCEPTED.detachedRooms.has(roomId)) {
      err('reachability', `${roomId} cannot be reached from the start room or any teleport destination`)
    }
  }
}

// ─── 2. Encounters ────────────────────────────────────────────────────────────

for (const [roomId, config] of Object.entries(ROOM_ENEMIES)) {
  if (!isRoom(roomId)) err('room-enemies', `spawn table for "${roomId}", which is not a seeded room`)
  for (const entry of config.enemies ?? []) {
    const slug = typeof entry === 'string' ? entry : entry.slug
    if (!enemySlugs.has(slug)) err('room-enemies', `${roomId} spawns unknown enemy "${slug}"`)
  }
}

const spawnedEnemies = new Set()
for (const config of Object.values(ROOM_ENEMIES)) {
  for (const entry of config.enemies ?? []) {
    spawnedEnemies.add(typeof entry === 'string' ? entry : entry.slug)
  }
}
for (const slug of enemySlugs) {
  if (!spawnedEnemies.has(slug) && !ACCEPTED.unspawnedEnemies.has(slug)) {
    warn('enemies', `"${slug}" is defined but never spawned (add to ACCEPTED.unspawnedEnemies if authored ahead of its map)`)
  }
}

// ─── 3. Drops ─────────────────────────────────────────────────────────────────

for (const enemy of ENEMIES) {
  const drops = enemy.drops || {}
  const check = (slug, where) => {
    if (!itemSlugs.has(slug)) err('drops', `${enemy.slug} ${where} drops unknown item "${slug}"`)
  }
  let cumulative = 0
  for (const entry of drops.main ?? []) {
    check(entry.itemSlug, 'main')
    cumulative += entry.chance ?? 0
  }
  if (cumulative > 1.000001) {
    err('drops', `${enemy.slug} main drop chances sum to ${cumulative.toFixed(3)} (> 1.0); later entries can never roll`)
  }
  for (const entry of drops.always ?? []) {
    check(typeof entry === 'string' ? entry : entry.itemSlug, 'always')
  }
  for (const slug of drops.firstKill ?? []) check(slug, 'firstKill')
}

// ─── 4. Ground loot, shops, crafting ──────────────────────────────────────────

for (const entry of ROOM_LOOT) {
  if (!isRoom(entry.roomId)) err('room-loot', `loot placed in "${entry.roomId}", which is not a seeded room`)
  if (!itemSlugs.has(entry.slug)) err('room-loot', `${entry.roomId} holds unknown item "${entry.slug}"`)
}

for (const [roomId, shop] of Object.entries(SHOPS)) {
  if (!isRoom(roomId)) err('shops', `shop in "${roomId}", which is not a seeded room`)
  for (const entry of shop.stock ?? []) {
    const slug = typeof entry === 'string' ? entry : entry.slug ?? entry.itemSlug
    if (!itemSlugs.has(slug)) err('shops', `${roomId} stocks unknown item "${slug}"`)
  }
  if (shop.requiresQuest && !questIds.has(shop.requiresQuest)) {
    err('shops', `${roomId} requires unknown quest "${shop.requiresQuest}"`)
  }
}

for (const roomId of CRAFTING_ROOMS ?? []) {
  if (!isRoom(roomId)) err('crafting', `crafting room "${roomId}" is not a seeded room`)
}
for (const recipe of Object.values(CRAFTING_RECIPES ?? {})) {
  const list = Array.isArray(recipe) ? recipe : [recipe]
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    for (const input of r.inputs ?? r.ingredients ?? []) {
      const slug = typeof input === 'string' ? input : input.slug ?? input.itemSlug
      if (slug && !itemSlugs.has(slug)) err('crafting', `recipe "${r.id ?? '?'}" needs unknown item "${slug}"`)
    }
    const outSlug = r.output?.slug ?? r.output?.itemSlug ?? r.outputSlug
    if (outSlug && !itemSlugs.has(outSlug)) err('crafting', `recipe "${r.id ?? '?'}" produces unknown item "${outSlug}"`)
  }
}

// ─── 5. Gates and reveals ─────────────────────────────────────────────────────

for (const [roomId, gates] of Object.entries(ROOM_GATES)) {
  if (!isRoom(roomId)) {
    err('gates', `gate on "${roomId}", which is not a seeded room`)
    continue
  }
  for (const dir of Object.keys(gates)) {
    if (!DIRECTIONS.includes(dir)) {
      err('gates', `${roomId} has a gate on "${dir}", which is not a direction`)
    } else if (!rooms.get(roomId).exits[dir]) {
      err('gates', `${roomId} gates "${dir}", but the room has no exit that way`)
    }
  }
}

// A hidden passage must agree three ways: the reveal definition, the seeded
// exit it opens, and a gate holding it shut until it is found.
for (const [roomId, def] of Object.entries(REVEAL_DEFINITIONS)) {
  if (!isRoom(roomId)) {
    err('reveals', `reveal in "${roomId}", which is not a seeded room`)
    continue
  }
  const seeded = rooms.get(roomId).exits[def.direction]
  if (!seeded) {
    err('reveals', `${roomId} reveals "${def.direction}", but the room has no exit that way`)
  } else if (seeded !== def.toRoom) {
    err('reveals', `${roomId} ${def.direction} reveals "${def.toRoom}" but the seeded exit leads to "${seeded}"`)
  }
  if (!ROOM_GATES[roomId]?.[def.direction]) {
    err('reveals', `${roomId} ${def.direction} is revealable but has no gate — the passage is walkable before it is found`)
  }
}

// ─── 6. Map placement ─────────────────────────────────────────────────────────

for (const roomId of rooms.keys()) {
  if (!mapCoords.has(roomId) && !centeredRooms.has(roomId) && !ACCEPTED.roomsWithoutMapCoords.has(roomId)) {
    err('map', `${roomId} has no map coordinates and is not centered — it will draw at the default cell`)
  }
}
for (const roomId of mapCoords.keys()) {
  if (!isRoom(roomId)) warn('map', `coordinates for "${roomId}", which is not a seeded room`)
}

// Coordinate direction sanity: for a cardinal exit between two rooms that both
// have coordinates and sit close enough to be on the same sheet, the coordinate
// delta must agree with the direction. This is what catches a mistyped cell.
const AXIS = {
  north: { axis: 'y', sign: -1 },
  south: { axis: 'y', sign: 1 },
  east: { axis: 'x', sign: 1 },
  west: { axis: 'x', sign: -1 },
}
for (const { roomId, exits } of rooms.values()) {
  const from = mapCoords.get(roomId)
  if (!from) continue
  for (const [dir, dest] of Object.entries(exits)) {
    const rule = AXIS[dir]
    const to = mapCoords.get(dest)
    if (!rule || !to) continue
    const dx = to.x - from.x
    const dy = to.y - from.y
    // Same sheet, adjacent-ish: ignore long jumps between map artworks.
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) continue
    const delta = rule.axis === 'x' ? dx : dy
    const offAxis = rule.axis === 'x' ? dy : dx
    if (delta === 0 || Math.sign(delta) !== rule.sign) {
      err('map', `${roomId} ${dir} -> ${dest}, but ${dest} is not ${dir} of it on the map (${rule.axis} delta ${delta})`)
    } else if (offAxis !== 0) {
      warn('map', `${roomId} ${dir} -> ${dest} is offset on the other axis by ${offAxis}px`)
    }
  }
}

// ─── 7. Client / server action parity ─────────────────────────────────────────

// Every button the client renders must resolve to something on the server, or
// clicking it falls through to "Unknown action type".

// Action types the engine handles itself in executeAction's switch, for every
// room — they never appear in a room's ROOM_ACTIONS table.
const ENGINE_ACTIONS = new Set([
  'attack', 'start_battle', 'player_attack', 'player_flee',
  'pickup_item', 'drop_item', 'move', 'chat', 'search', 'rest', 'look',
  'examine_item', 'examine_player_item', 'use_item', 'equip_item',
  'unequip_item', 'accept_quest', 'complete_quest',
])

// Buttons the client resolves without ever reaching the engine.
const CLIENT_ONLY_ACTIONS = new Set([
  'open crafting', // toggles the crafting panel; the craft itself is `craft`
  'open spellbook', // opens the spellbook modal; learning is HTTP, casting is `cast_spell`
  'teleport to grassy field', // rewritten client-side into a teleport action
])

{
  const blocks = parseKeyedArrayBlocks(read('src/lib/room-actions.ts'))
  for (const [roomId, body] of blocks) {
    if (!isRoom(roomId)) continue // not a room table (e.g. a helper list)
    const serverActions = SERVER_ROOM_ACTIONS[roomId] || {}
    for (const m of body.matchAll(/\baction:\s*'([^']+)'/g)) {
      const action = m[1]
      if (ENGINE_ACTIONS.has(action) || CLIENT_ONLY_ACTIONS.has(action)) continue
      if (!serverActions[action]) {
        const report = KNOWN_GAPS.deadButtons.has(`${roomId}:${action}`) ? warn : err
        report('actions', `${roomId} shows the button "${action}" but the server has no handler for it`)
      }
    }
  }
}

// ─── 8. Teleport network ──────────────────────────────────────────────────────

for (const location of TELEPORT_LOCATIONS) {
  if (!isRoom(location.roomId)) {
    err('teleport', `destination "${location.roomId}" (${location.name}) is not a seeded room`)
  }
}

// Every teleport destination hard-coded in the UI must be one the server will
// actually authorize, or the button silently fails. Destinations the server
// names at runtime (a guild lair, a flee retreat) arrive through a grant and
// carry no literal here, so only literals are checked.
{
  const uiFiles = [
    'src/components/GameInterface.tsx',
    'src/components/RoomBox.tsx',
    'src/components/game-interface/ExplorePanel.tsx',
  ]
  for (const file of uiFiles) {
    let src
    try {
      src = read(file)
    } catch {
      continue // panel renamed or removed; the other checks still apply
    }
    for (const m of src.matchAll(/toRoomId:\s*'([^']+)'/g)) {
      const roomId = m[1]
      if (!isFixedTeleportDestination(roomId)) {
        err(
          'teleport',
          `${file} teleports to "${roomId}", which is not in the fixed teleport network — the server will refuse it`
        )
      }
    }
  }
}

// ─── 8b. Recorded decisions that may go stale ─────────────────────────────────
//
// A room listed as deliberately open-and-empty should still be open and empty.
// Once it gains content or a gate the decision has been superseded, and the
// entry should go — otherwise the allowlist quietly starts excusing something
// nobody decided.
for (const roomId of ACCEPTED.openEmptyRooms) {
  if (!isRoom(roomId)) {
    warn('decisions', `openEmptyRooms lists "${roomId}", which is not a seeded room`)
    continue
  }
  const gained = []
  if (Object.keys(SERVER_ROOM_ACTIONS[roomId] || {}).length) gained.push('room actions')
  if (ROOM_ENEMIES[roomId]) gained.push('a spawn table')
  if (ROOM_LOOT.some((entry) => entry.roomId === roomId)) gained.push('ground loot')
  if (Object.keys(ROOM_GATES[roomId] || {}).length) gained.push('a gate')

  if (gained.length) {
    warn(
      'decisions',
      `${roomId} is listed as deliberately open and empty but now has ${gained.join(' and ')} — remove it from ACCEPTED.openEmptyRooms`
    )
  }
}

// ─── 9. Cross-language contracts ──────────────────────────────────────────────
//
// The engine is CommonJS and the app is TypeScript, so several contracts exist
// as a pair of files. Where one can be derived from the other it now is; where
// it cannot (Prisma's select typing needs literal types a JS import would lose),
// these checks stand in for derivation.

// Every socket event emitted anywhere in src/lib must appear in the canonical
// list, so a new event cannot quietly become an unlisted string literal — which
// is how `player-move`, `login:success`, `inventory:update` and
// `room:items:update` ended up in neither of the two lists that used to exist.
{
  const { SOCKET_EVENTS } = load('src/lib/socket-utils.js')
  const known = new Set(Object.values(SOCKET_EVENTS))

  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel, out)
      else if (entry.name.endsWith('.js')) out.push(rel)
    }
    return out
  }

  const emitted = new Map() // event name -> first file that emits it
  for (const file of walk('src/lib')) {
    const src = read(file)
    // `.emit('name'` and `{ event: 'name' }` are the two shapes the server uses.
    for (const m of src.matchAll(/\.emit\(\s*'([a-z][a-zA-Z0-9:_-]*)'/g)) {
      if (!emitted.has(m[1])) emitted.set(m[1], file)
    }
    for (const m of src.matchAll(/\bevent:\s*'([a-z][a-zA-Z0-9:_-]*)'/g)) {
      if (!emitted.has(m[1])) emitted.set(m[1], file)
    }
  }

  for (const [event, file] of emitted) {
    if (!known.has(event)) {
      err('socket-contract', `"${event}" is emitted in ${file} but is not in SOCKET_EVENTS`)
    }
  }
}

// The room-item field list exists twice: the engine's socket path uses the .js
// copy, API routes use the .ts one. They cannot be collapsed into a single
// export because Prisma's result typing depends on the literal types the .ts
// version declares, so the field lists are compared instead. They had drifted —
// the .js copy silently dropped value, canSell, canDrop and metadata.
{
  const fields = (file, marker) => {
    const src = read(file)
    const start = src.indexOf(marker)
    if (start === -1) return null
    // Read from the declaration to the first ItemTemplate select block after it,
    // then take that block's `field: true` entries.
    const inner = src
      .slice(start)
      .match(/ItemTemplate:\s*\{\s*select:\s*\{([\s\S]*?)\n\s*\},/)
    if (!inner) return null
    return [...inner[1].matchAll(/(\w+):\s*true/g)].map((m) => m[1]).sort()
  }

  const jsFields = fields('src/lib/game-engine/services/room-normalization.js', 'ROOM_ITEMS_SELECT')
  const tsFields = fields('src/lib/game-engine/services/room-normalization.ts', 'ROOM_ITEMS_SELECT')

  if (!jsFields || !tsFields) {
    warn('normalizer', 'could not parse ROOM_ITEMS_SELECT from both room-normalization files')
  } else if (jsFields.join(',') !== tsFields.join(',')) {
    const onlyJs = jsFields.filter((f) => !tsFields.includes(f))
    const onlyTs = tsFields.filter((f) => !jsFields.includes(f))
    err(
      'normalizer',
      `room-normalization.js and .ts select different item fields — only in .js: [${onlyJs}], only in .ts: [${onlyTs}]`
    )
  }
}

// ─── Result ───────────────────────────────────────────────────────────────────

if (warnings.length) {
  console.warn(`⚠️  ${warnings.length} warning(s):`)
  console.warn(warnings.join('\n'))
}

if (errors.length) {
  console.error(`\n❌ World validation failed with ${errors.length} error(s):`)
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(
  `✅ World validation passed: ${rooms.size} rooms, ${enemySlugs.size} enemies, ` +
    `${Object.keys(ROOM_ENEMIES).length} spawn tables, all references resolve.`
)
