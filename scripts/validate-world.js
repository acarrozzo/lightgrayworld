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
  ]),

  // Rooms deliberately not reachable by walking from the start room. 031
  // ("Stairway to Heaven") is stubbed endgame content with no entrance yet.
  detachedRooms: new Set(['031']),

  // Rooms with no map cell yet. Both are stubbed endgame content (029 "Guardian
  // Angel", 031 "Stairway to Heaven") and currently draw at the default cell.
  roomsWithoutMapCoords: new Set(['029', '031']),

  // Enemies authored ahead of the map that will hold them. They are named by
  // acceptable quests, so they must exist — they simply have no spawn yet.
  unspawnedEnemies: new Set([
    'glowing-octopus',
    'king-squid',
    'stone-sphinx',
    'gatekeeper',
    'hammerhead',
    'great-white',
    'troll-champion',
    'troll-queen',
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
  // "Unknown action type". 007/021's signs need sign text authored; 021's staff
  // shop is content from the original that was never ported.
  deadButtons: new Set([
    '007:read sign',
    '021:read sign',
    '021:buy staff',
  ]),
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
const { TELEPORT_LOCATIONS } = load('src/lib/game-data/teleport-destinations.js')
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
