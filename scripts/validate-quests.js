#!/usr/bin/env node
/**
 * Quest data integrity check.
 *
 * Quests, givers and factions reference each other, items, enemies, rooms and
 * regions by id. A typo in any of these fails silently at runtime — the quest
 * never opens, the giver never reveals, the gate never passes. This script
 * cross-checks every reference in quests.json, quest-givers.json and
 * factions.js against its source of truth and exits non-zero on any dangling
 * one, so the bug is caught at author time instead of by a stuck player.
 *
 * Sources (all static — no database needed):
 *   - item slugs   : prisma/seed.ts  (every `slug: '...'` literal)
 *   - enemy slugs  : src/lib/game-data/enemies.js (ENEMIES[].slug)
 *   - room ids     : prisma/seed.ts  (every `roomId: '...'` literal)
 *   - region ids   : src/lib/game-data/world-map.js (ALL_REGIONS[].id)
 *   - quest ids    : keys of src/lib/game-data/quests.json
 *   - giver ids    : keys of src/lib/game-data/quest-givers.json
 *   - faction ids  : src/lib/game-data/factions.js
 *
 * It also checks the shape that makes the system work: every quest belongs to
 * exactly one giver's list, every `after` points at an earlier quest of the same
 * giver, every giver has a way of being revealed and a greeting, every guild's
 * membership quest is one of its own givers' quests, and every live faction
 * has at least one giver.
 *
 * Run: node scripts/validate-quests.js   (or: npm run validate-quests)
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const QUESTS = require(path.join(ROOT, 'src/lib/game-data/quests.json'))
const GIVERS = require(path.join(ROOT, 'src/lib/game-data/quest-givers.json'))
const { FACTIONS } = require(path.join(ROOT, 'src/lib/game-data/factions.js'))
const { ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { ALL_REGIONS } = require(path.join(ROOT, 'src/lib/game-data/world-map.js'))

// EquipSlot enum from prisma/schema.prisma — kept in sync manually (small, rarely changes).
const EQUIP_SLOTS = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'BODY', 'HANDS', 'FEET', 'RING', 'NECK', 'MOUNT', 'ARTIFACT', 'COMPANION'])
const QUEST_TYPES = new Set(['main', 'side'])
const REWARD_TYPES = new Set(['currency', 'xp', 'item'])
const REQUIREMENT_TYPES = new Set([
  'hasItem', 'hasAnyItem', 'killCount', 'killCountGroup', 'hasEquippedInSlot', 'level', 'hasFlag',
  'memberOf', 'giverMet', 'questCompleted', 'factionsComplete',
])
const REVEAL_TYPES = new Set(['always', 'questCompleted', 'giverMet', 'regionDiscovered', 'flag'])
// Fields from the previous shape. Their presence means stale authoring.
const RETIRED_QUEST_FIELDS = ['number', 'giver', 'onComplete', 'onAccept', 'completionMode', 'isIntro']

function loadSeedLiterals(key) {
  const seed = fs.readFileSync(path.join(ROOT, 'prisma/seed.ts'), 'utf8')
  const found = new Set()
  for (const m of seed.matchAll(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`, 'g'))) found.add(m[1])
  return found
}

// Item slugs: every `slug: '...'` literal in the seed. A superset (it includes
// any non-item slug defined there too), which is safe — a genuinely missing
// slug is still absent from the set and gets flagged.
const itemSlugs = loadSeedLiterals('slug')
const roomIds = loadSeedLiterals('roomId')
const enemySlugs = new Set(ENEMIES.map((e) => e.slug))
const regionIds = new Set(ALL_REGIONS.map((r) => r.id))
const questIds = new Set(Object.keys(QUESTS))
const giverIds = new Set(Object.keys(GIVERS))
const factionById = new Map(FACTIONS.map((f) => [f.id, f]))

const errors = []
const warnings = []
const err = (id, msg) => errors.push(`  [${id}] ${msg}`)
const warn = (id, msg) => warnings.push(`  [${id}] ${msg}`)

function checkRequirement(id, req, where) {
  if (!REQUIREMENT_TYPES.has(req.type)) {
    err(id, `${where}: unknown requirement type "${req.type}"`)
    return
  }
  if (req.type === 'hasItem' && !itemSlugs.has(req.itemSlug)) err(id, `${where}: hasItem references unknown item slug "${req.itemSlug}"`)
  if (req.type === 'hasAnyItem') {
    if (!Array.isArray(req.items) || req.items.length === 0) err(id, `${where}: hasAnyItem requires a non-empty items array`)
    else for (const entry of req.items) if (!itemSlugs.has(entry.itemSlug)) err(id, `${where}: hasAnyItem references unknown item slug "${entry.itemSlug}"`)
  }
  if (req.type === 'killCount' && !enemySlugs.has(req.enemySlug)) err(id, `${where}: killCount references unknown enemy slug "${req.enemySlug}"`)
  if (req.type === 'killCountGroup') {
    if (!Array.isArray(req.enemySlugs) || req.enemySlugs.length === 0) err(id, `${where}: killCountGroup requires a non-empty enemySlugs array`)
    else for (const slug of req.enemySlugs) if (!enemySlugs.has(slug)) err(id, `${where}: killCountGroup references unknown enemy slug "${slug}"`)
  }
  if (req.type === 'hasEquippedInSlot' && !EQUIP_SLOTS.has(req.slot)) err(id, `${where}: hasEquippedInSlot references unknown slot "${req.slot}"`)
  if (req.type === 'memberOf') {
    const f = factionById.get(req.factionId)
    if (!f) err(id, `${where}: memberOf references unknown faction "${req.factionId}"`)
    else if (!f.membershipQuest) err(id, `${where}: memberOf references "${req.factionId}", which is not a guild`)
  }
  if (req.type === 'giverMet' && !giverIds.has(req.giverId)) err(id, `${where}: giverMet references unknown giver "${req.giverId}"`)
  if (req.type === 'questCompleted' && !questIds.has(req.questId)) err(id, `${where}: questCompleted references unknown quest "${req.questId}"`)
  if (req.type === 'factionsComplete') {
    if (!Array.isArray(req.factionIds) || req.factionIds.length === 0) err(id, `${where}: factionsComplete requires a non-empty factionIds array`)
    else for (const fid of req.factionIds) if (!factionById.has(fid)) err(id, `${where}: factionsComplete references unknown faction "${fid}"`)
  }
}

// ---- factions
const seenFactionIds = new Set()
for (const f of FACTIONS) {
  if (seenFactionIds.has(f.id)) err(`faction ${f.id}`, 'duplicate faction id')
  seenFactionIds.add(f.id)
  if (!['region', 'guild'].includes(f.kind)) err(`faction ${f.id}`, `unknown kind "${f.kind}"`)
  if (f.kind === 'guild' && !f.membershipQuest) err(`faction ${f.id}`, 'a guild needs a membershipQuest')
  if (f.membershipQuest) {
    if (!questIds.has(f.membershipQuest)) err(`faction ${f.id}`, `membershipQuest "${f.membershipQuest}" is not a quest`)
    else if (GIVERS[QUESTS[f.membershipQuest].giverId]?.faction !== f.id) err(`faction ${f.id}`, `membershipQuest "${f.membershipQuest}" is not given by one of its own givers`)
  }
  if (f.hubRoomId && !roomIds.has(f.hubRoomId)) err(`faction ${f.id}`, `hubRoomId "${f.hubRoomId}" is not a seeded room`)
  if (!f.placeholder && !f.title) warn(`faction ${f.id}`, 'no title to earn at max standing')
}

// ---- givers
const questOwner = new Map()
for (const [giverId, g] of Object.entries(GIVERS)) {
  const id = `giver ${giverId}`
  if (!g.name) err(id, 'missing name')
  if (!g.roomId) err(id, 'missing roomId')
  else if (!roomIds.has(g.roomId)) err(id, `roomId "${g.roomId}" is not a seeded room`)
  if (!g.action) err(id, 'missing action (the room action that talks to them)')
  if (!g.icon) err(id, 'missing icon')
  if (g.faction !== null && !factionById.has(g.faction)) err(id, `unknown faction "${g.faction}"`)
  if (g.faction !== null && factionById.get(g.faction)?.placeholder) err(id, `faction "${g.faction}" is a placeholder — remove the flag now that it has a giver`)
  if (!g.greeting) err(id, 'missing greeting (what they say on first meeting)')
  if (!g.metLine) warn(id, 'no metLine; the feed will say "You meet <name>."')
  const rule = g.revealedBy
  if (!rule || !REVEAL_TYPES.has(rule.type)) err(id, `revealedBy has unknown type "${rule && rule.type}"`)
  else {
    if (rule.type === 'questCompleted' && !questIds.has(rule.questId)) err(id, `revealedBy references unknown quest "${rule.questId}"`)
    if (rule.type === 'giverMet' && !giverIds.has(rule.giverId)) err(id, `revealedBy references unknown giver "${rule.giverId}"`)
    if (rule.type === 'regionDiscovered' && !regionIds.has(rule.regionId)) err(id, `revealedBy references unknown region "${rule.regionId}"`)
  }
  for (const req of g.meetRequirements ?? []) checkRequirement(id, req, 'meetRequirements')
  if ((g.meetRequirements ?? []).length > 0 && !g.lockedDialog) err(id, 'meetRequirements without a lockedDialog')
  for (const entry of g.idleDialogs ?? []) {
    if (entry.ifCompleted !== null && entry.ifCompleted !== undefined && !questIds.has(entry.ifCompleted)) err(id, `idleDialogs references unknown quest "${entry.ifCompleted}"`)
    if (!entry.message) err(id, 'idleDialogs entry without a message')
  }
  if (!Array.isArray(g.quests) || g.quests.length === 0) err(id, 'a giver needs at least one quest')
  for (const questId of g.quests ?? []) {
    if (!questIds.has(questId)) { err(id, `lists unknown quest "${questId}"`); continue }
    if (questOwner.has(questId)) err(id, `quest "${questId}" is also listed by ${questOwner.get(questId)}`)
    questOwner.set(questId, giverId)
    if (QUESTS[questId].giverId !== giverId) err(id, `quest "${questId}" says its giver is "${QUESTS[questId].giverId}"`)
  }
}

// ---- quests
for (const [id, q] of Object.entries(QUESTS)) {
  for (const field of RETIRED_QUEST_FIELDS) if (field in q) err(id, `"${field}" is no longer a field — givers, order and chains live in quest-givers.json`)
  if (!q.giverId) err(id, 'missing giverId')
  else if (!giverIds.has(q.giverId)) err(id, `unknown giver "${q.giverId}"`)
  if (!questOwner.has(id)) err(id, 'not listed by any giver')
  if (!QUEST_TYPES.has(q.questType)) err(id, `unknown questType "${q.questType}"`)
  if (!q.title) err(id, 'missing title')
  if (!q.completionDialog) warn(id, 'no completionDialog')
  const list = GIVERS[q.giverId]?.quests ?? []
  for (const prev of q.after ?? []) {
    if (!questIds.has(prev)) { err(id, `after references unknown quest "${prev}"`); continue }
    if (QUESTS[prev].giverId !== q.giverId) err(id, `after references "${prev}", which belongs to another giver — a cross-giver dependency is a revealedBy rule, not an after`)
    else if (list.indexOf(prev) >= list.indexOf(id)) err(id, `after references "${prev}", which is listed after it`)
  }
  for (const req of q.requirements ?? []) checkRequirement(id, req, 'requirements')
  for (const reward of q.rewards ?? []) {
    if (!REWARD_TYPES.has(reward.type)) { err(id, `unknown reward type "${reward.type}"`); continue }
    if (reward.type === 'item' && !itemSlugs.has(reward.itemSlug)) err(id, `item reward references unknown item slug "${reward.itemSlug}"`)
  }
}

// ---- every live faction has someone speaking for it
for (const f of FACTIONS) {
  if (f.placeholder) continue
  if (!Object.values(GIVERS).some((g) => g.faction === f.id)) err(`faction ${f.id}`, 'no giver speaks for this faction — mark it placeholder or add one')
}

if (warnings.length) {
  console.warn(`⚠️  ${warnings.length} warning(s):`)
  console.warn(warnings.join('\n'))
}

if (errors.length) {
  console.error(`❌ Quest validation failed with ${errors.length} error(s):`)
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`✅ Quest validation passed: ${questIds.size} quests, ${giverIds.size} givers, ${FACTIONS.filter((f) => !f.placeholder).length} factions — all references resolve.`)
