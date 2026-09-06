#!/usr/bin/env node
/**
 * Quest data integrity check.
 *
 * Quests reference items, enemies, and other quests by slug/id. A typo in any
 * of these fails silently at runtime — the quest just becomes uncompletable or
 * never starts. This script cross-checks every reference in quests.json against
 * its source of truth and exits non-zero on any dangling reference, so the bug
 * is caught at author time instead of by a stuck player.
 *
 * Sources (all static — no database needed):
 *   - item slugs   : prisma/seed.ts  (every `slug: '...'` literal)
 *   - enemy slugs  : src/lib/game-data/enemies.js (ENEMIES[].slug)
 *   - quest ids    : keys of src/lib/game-data/quests.json
 *   - room triggers: src/lib/game-engine/quest-room-triggers.js
 *
 * It also checks that every quest can actually start. A quest opens in one of
 * three ways — another quest's startQuest effect, arriving in a room listed in
 * QUEST_ROOM_TRIGGERS, or the registration seed — and one that has none of them
 * is dead content: its giver only ever shows idle dialog and the chain behind
 * it never appears. Six Rocky Flats and Blue Ocean intros shipped that way.
 *
 * Run: node scripts/validate-quests.js   (or: npm run validate-quests)
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const QUESTS = require(path.join(ROOT, 'src/lib/game-data/quests.json'))
const { ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { QUEST_ROOM_TRIGGERS } = require(path.join(ROOT, 'src/lib/game-engine/quest-room-triggers.js'))

// The one quest a new account is born with (src/app/api/auth/register/route.ts).
const SEEDED_AT_REGISTRATION = new Set(['quest_oldman_000'])

// EquipSlot enum from prisma/schema.prisma — kept in sync manually (small, rarely changes).
const EQUIP_SLOTS = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'BODY', 'HANDS', 'FEET', 'RING', 'NECK', 'MOUNT', 'ARTIFACT', 'COMPANION'])
// `intro` is the "go and talk to this person" quest that opens a giver's set.
// It pays nothing — its reward is the quests it starts — so a reward on one is
// an authoring mistake, not a design choice.
const QUEST_TYPES = new Set(['main', 'side', 'intro'])
const REWARD_TYPES = new Set(['currency', 'xp', 'item'])
const REQUIREMENT_TYPES = new Set(['hasItem', 'hasAnyItem', 'killCount', 'killCountGroup', 'hasEquippedInSlot', 'level', 'hasFlag'])
const EFFECT_TYPES = new Set(['startQuest', 'completeQuest'])

// Item slugs: every `slug: '...'` / `slug: "..."` literal in the seed. This is a
// superset (it includes any non-item slug defined there too), which is safe — a
// genuinely missing slug is still absent from the set and gets flagged.
function loadItemSlugs() {
  const seed = fs.readFileSync(path.join(ROOT, 'prisma/seed.ts'), 'utf8')
  const slugs = new Set()
  for (const m of seed.matchAll(/slug:\s*['"]([^'"]+)['"]/g)) slugs.add(m[1])
  return slugs
}

const itemSlugs = loadItemSlugs()
const enemySlugs = new Set(ENEMIES.map((e) => e.slug))
const questIds = new Set(Object.keys(QUESTS))

const errors = []
const warnings = []
const err = (id, msg) => errors.push(`  [${id}] ${msg}`)

// Warn on duplicate `number` values (manual global sequence — easy to collide).
const numberSeen = new Map()

for (const [id, q] of Object.entries(QUESTS)) {
  if (typeof q.number === 'number') {
    if (numberSeen.has(q.number)) warnings.push(`  number ${q.number} reused by ${numberSeen.get(q.number)} and ${id}`)
    else numberSeen.set(q.number, id)
  }

  if (!q.giver || !q.giver.npcId) err(id, 'missing giver.npcId')
  if (!q.giver || !q.giver.roomId) err(id, 'missing giver.roomId')

  if (!QUEST_TYPES.has(q.questType)) err(id, `unknown questType "${q.questType}"`)
  if (q.questType === 'intro' && (q.rewards ?? []).length > 0) {
    err(id, 'intro quests give no rewards — move them to the quest this one starts')
  }
  // `isIntro` was folded into questType: 'intro'. A stray flag means stale authoring.
  if ('isIntro' in q) err(id, 'isIntro is no longer a field — use questType: "intro"')

  for (const req of q.requirements ?? []) {
    if (!REQUIREMENT_TYPES.has(req.type)) {
      err(id, `unknown requirement type "${req.type}"`)
      continue
    }
    if (req.type === 'hasItem' && !itemSlugs.has(req.itemSlug)) {
      err(id, `hasItem references unknown item slug "${req.itemSlug}"`)
    }
    if (req.type === 'hasAnyItem') {
      if (!Array.isArray(req.items) || req.items.length === 0) {
        err(id, 'hasAnyItem requires a non-empty items array')
      } else {
        for (const entry of req.items) {
          if (!itemSlugs.has(entry.itemSlug)) {
            err(id, `hasAnyItem references unknown item slug "${entry.itemSlug}"`)
          }
        }
      }
    }
    if (req.type === 'killCount' && !enemySlugs.has(req.enemySlug)) {
      err(id, `killCount references unknown enemy slug "${req.enemySlug}"`)
    }
    if (req.type === 'killCountGroup') {
      if (!Array.isArray(req.enemySlugs) || req.enemySlugs.length === 0) {
        err(id, 'killCountGroup requires a non-empty enemySlugs array')
      } else {
        for (const slug of req.enemySlugs) {
          if (!enemySlugs.has(slug)) err(id, `killCountGroup references unknown enemy slug "${slug}"`)
        }
      }
    }
    if (req.type === 'hasEquippedInSlot' && !EQUIP_SLOTS.has(req.slot)) {
      err(id, `hasEquippedInSlot references unknown slot "${req.slot}"`)
    }
  }

  for (const reward of q.rewards ?? []) {
    if (!REWARD_TYPES.has(reward.type)) {
      err(id, `unknown reward type "${reward.type}"`)
      continue
    }
    if (reward.type === 'item' && !itemSlugs.has(reward.itemSlug)) {
      err(id, `item reward references unknown item slug "${reward.itemSlug}"`)
    }
  }

  // onAccept + onComplete effects may reference other quests by id.
  for (const phase of ['onAccept', 'onComplete']) {
    for (const effect of q[phase] ?? []) {
      if (!EFFECT_TYPES.has(effect.type)) {
        err(id, `${phase}: unknown effect type "${effect.type}"`)
        continue
      }
      if (!questIds.has(effect.questId)) {
        err(id, `${phase}: ${effect.type} references unknown quest "${effect.questId}"`)
      }
    }
  }
}

// Reachability: every quest needs something that starts it.
const startable = new Set(SEEDED_AT_REGISTRATION)
for (const [roomId, trigger] of Object.entries(QUEST_ROOM_TRIGGERS)) {
  if (!questIds.has(trigger.questId)) {
    errors.push(`  [room ${roomId}] QUEST_ROOM_TRIGGERS references unknown quest "${trigger.questId}"`)
  }
  startable.add(trigger.questId)
}
for (const q of Object.values(QUESTS)) {
  for (const phase of ['onAccept', 'onComplete']) {
    for (const effect of q[phase] ?? []) {
      if (effect.type === 'startQuest' && effect.questId) startable.add(effect.questId)
    }
  }
}
for (const id of questIds) {
  if (!startable.has(id)) {
    err(id, 'unreachable — no startQuest effect, room trigger, or registration seed opens it')
  }
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

console.log(`✅ Quest validation passed: ${questIds.size} quests, all references resolve.`)
