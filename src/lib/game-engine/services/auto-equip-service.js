const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')
const { recomputeStatMods, PLAYER_SELECT } = require('./equipment-service')
const { SKILL_SELECT, projectSkillState } = require('./skill-service')
const { getPassiveSkillBonuses, isShieldItem } = require('../../game-data/skills')

/**
 * Auto-equip: the original's `max 1h` / `max 2h` / `max dex` / `max mag`
 * buttons (function-equip-max.php), plus the `max def` it drafted but never
 * shipped. One click dressed the player in the best thing they owned for
 * every slot, by hand-ordered priority lists per stat.
 *
 * Here the lists are replaced by the templates' own `statMods`: every slot
 * is filled with the owned item that scores highest for the target stat, and
 * the weapon hand is chosen as a pair — a one-hander's score includes the
 * best off-hand item beside it, a two-hander's stands alone. Skill passives
 * (One-Handed, Two-Handed, Ranged, Warcraft, Block behind a shield) are added
 * to the score for the gear in hand, as stats.php folded them — measured
 * against bare hands, so a passive that applies regardless (Toughness) never
 * makes an item look better than it is.
 *
 * Rules, applied per slot:
 *  - Only an item that scores above zero for the stat is ever put on. A slot
 *    with nothing better than what is worn is left alone — no churn, and no
 *    filling a slot with off-stat gear (the original did; that was declined).
 *  - What is worn is always allowed to stay, whatever it scores, unless it
 *    actively hurts the stat (a negative value), in which case the slot is
 *    emptied — zero beats less than zero.
 *  - `skipNegatives` drops any item carrying a negative modifier on any stat
 *    from the candidates. A worn item with negatives is then replaced by the
 *    best clean candidate, but is not stripped if nothing clean scores.
 *  - A two-hander in the main hand empties the off hand, as equipItem does.
 *    When a two-hander is worn, no weapon of the wanted kind is owned, and
 *    the mode allows one-handers, bare fists plus the best off-hand item
 *    stand in if that beats the two-hander — the original fell back to
 *    "fists" and still filled the off hand.
 *
 * `planAutoEquip` is pure — inventory rows in, a change list out — so it is
 * unit-tested without a database. `autoEquip` loads, plans, and applies the
 * plan in one transaction: one statement takes everything off, one puts
 * everything on, and the stat mods are recomputed from the rows as they now
 * stand before the transaction commits. Round trips do not grow with the
 * number of slots that change.
 */

const STAT_KEYS = ['str', 'dex', 'mag', 'def']

/** @typedef {'str1h'|'str2h'|'dex'|'mag'|'def'} AutoEquipMode */

const MODES = /** @type {const} */ ({
  str1h: {
    stat: 'str',
    label: 'STR (one-handed)',
    weaponLabel: 'one-handed weapon',
    allowsFists: true,
    mainFilter: (template) => template.weaponCategory === 'MELEE' && !isTwoHanded(template),
  },
  str2h: {
    stat: 'str',
    label: 'STR (two-handed)',
    weaponLabel: 'two-handed weapon',
    allowsFists: false,
    mainFilter: (template) => template.weaponCategory === 'MELEE' && isTwoHanded(template),
  },
  dex: {
    stat: 'dex',
    label: 'DEX',
    weaponLabel: 'ranged weapon',
    allowsFists: true,
    mainFilter: (template) => template.weaponCategory === 'RANGED',
  },
  mag: {
    stat: 'mag',
    label: 'MAG',
    weaponLabel: 'weapon',
    allowsFists: true,
    mainFilter: () => true,
  },
  def: {
    stat: 'def',
    label: 'DEF',
    weaponLabel: 'weapon',
    allowsFists: true,
    mainFilter: () => true,
  },
})

const MODE_IDS = Object.keys(MODES)

/** Every slot but the hands, in the order the character panel lays them out. */
const WORN_SLOTS = ['HEAD', 'BODY', 'HANDS', 'FEET', 'RING', 'NECK', 'MOUNT', 'ARTIFACT', 'COMPANION']
const ALL_SLOTS = ['MAIN_HAND', 'OFF_HAND', ...WORN_SLOTS]

const SLOT_LABELS = {
  MAIN_HAND: 'Main hand',
  OFF_HAND: 'Off hand',
  HEAD: 'Head',
  BODY: 'Body',
  HANDS: 'Hands',
  FEET: 'Feet',
  RING: 'Ring',
  NECK: 'Neck',
  MOUNT: 'Mount',
  ARTIFACT: 'Artifact',
  COMPANION: 'Companion',
}

/** Stand-in for an empty main hand while the weapon candidates are scored. */
const FISTS = Object.freeze({
  id: null,
  quantity: 1,
  isEquipped: false,
  slot: null,
  template: Object.freeze({ slug: 'fists', name: 'fists', equipSlot: 'MAIN_HAND', weaponCategory: null, metadata: Object.freeze({}) }),
})

function isAutoEquipMode(mode) {
  return typeof mode === 'string' && Object.prototype.hasOwnProperty.call(MODES, mode)
}

function metadataOf(template) {
  const metadata = template?.metadata
  return metadata && typeof metadata === 'object' ? metadata : {}
}

function isTwoHanded(template) {
  return metadataOf(template).isTwoHanded === true
}

/** The item's modifier for one stat, 0 when it has none. */
function statValue(row, stat) {
  const mods = metadataOf(row?.template).statMods
  const value = mods && typeof mods === 'object' ? mods[stat] : 0
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function hasNegativeMod(row) {
  return STAT_KEYS.some((key) => statValue(row, key) < 0)
}

/** Sum of every modifier — the tie-breaker when two items match on the target stat. */
function statPower(row) {
  return STAT_KEYS.reduce((total, key) => total + statValue(row, key), 0)
}

function passiveFor(stat, skillLevels, gear) {
  if (!skillLevels) return 0
  const bonuses = getPassiveSkillBonuses(skillLevels, gear)
  const value = bonuses[stat]
  return typeof value === 'number' ? value : 0
}

function gearContext(main, off) {
  return {
    weaponCategory: main?.template?.weaponCategory || null,
    isTwoHanded: main ? isTwoHanded(main.template) : false,
    hasShield: off ? isShieldItem(off.template) : false,
  }
}

/**
 * Highest-scoring row, with the worn item winning ties so nothing is swapped
 * for an equal, then total power, then name for a stable order.
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => number} score
 * @returns {T|null}
 */
function pickBest(rows, score) {
  let best = null
  let bestScore = -Infinity
  for (const row of rows) {
    const value = score(row)
    if (best === null || value > bestScore) {
      best = row
      bestScore = value
      continue
    }
    if (value < bestScore) continue
    // Tie on the target stat.
    if (best.isEquipped) continue
    if (row.isEquipped) {
      best = row
      continue
    }
    const powerDiff = statPower(row) - statPower(best)
    if (powerDiff > 0 || (powerDiff === 0 && String(row.template?.name || '').localeCompare(String(best.template?.name || '')) < 0)) {
      best = row
    }
  }
  return best
}

/**
 * Work out the best loadout for one stat from what the player owns.
 *
 * @param {Array<{ id: string, quantity: number, isEquipped: boolean, slot: string|null, template: { slug: string, name: string, equipSlot: string|null, weaponCategory: string|null, metadata: any } }>} inventory
 * @param {{ mode: AutoEquipMode, skipNegatives?: boolean, skillLevels?: Record<string, number>|null }} options
 * @returns {{
 *   mode: AutoEquipMode, stat: string, label: string, skipNegatives: boolean,
 *   changes: Array<{ slot: string, from: any|null, to: any|null }>,
 *   before: number, after: number,
 *   missingWeapon: boolean,
 * }}
 */
function planAutoEquip(inventory, { mode, skipNegatives = false, skillLevels = null }) {
  if (!isAutoEquipMode(mode)) {
    throw new Error(`planAutoEquip: unknown mode ${String(mode)}`)
  }
  const def = MODES[mode]
  const stat = def.stat

  const owned = (inventory || []).filter(
    (row) => row && row.quantity >= 1 && row.template && typeof row.template.equipSlot === 'string'
  )
  const worn = new Map()
  for (const row of owned) {
    if (row.isEquipped && row.slot) worn.set(row.slot, row)
  }
  const ownedIn = (slot) => owned.filter((row) => row.template.equipSlot === slot)
  const acceptable = (row) => !skipNegatives || !hasNegativeMod(row)
  const value = (row) => statValue(row, stat)

  /** @type {Map<string, any|null>} final loadout by slot */
  const final = new Map(worn)

  // Everything that is neither the current item nor a strictly better one
  // resolves to the same fallback: keep what is worn unless it hurts.
  const settle = (slot, best, bestScore, currentScore) => {
    const current = worn.get(slot) || null
    if (best && best !== current && bestScore > 0) {
      final.set(slot, best === FISTS ? null : best)
      return
    }
    if (current && currentScore < 0) {
      final.set(slot, null)
    }
  }

  // ── Hands ─────────────────────────────────────────────────────────────
  const currentMain = worn.get('MAIN_HAND') || null
  const currentOff = worn.get('OFF_HAND') || null

  // Passives are counted as what the gear adds over bare hands.
  const baseline = passiveFor(stat, skillLevels, gearContext(null, null))
  const passiveGain = (main, off) => passiveFor(stat, skillLevels, gearContext(main, off)) - baseline

  const offScore = (row) => value(row) + passiveGain(null, row)
  const offCandidates = ownedIn('OFF_HAND').filter(acceptable)
  const bestOff = pickBest(offCandidates, offScore)
  const offForPair = bestOff && offScore(bestOff) > 0 ? bestOff : null

  // A one-hander is scored with the best off-hand item beside it; a
  // two-hander alone. Passives follow the weapon kind of the candidate.
  const soloScore = (row) => value(row) + passiveGain(row, null)
  const pairScore = (row) => {
    if (isTwoHanded(row.template)) return soloScore(row)
    return value(row) + (offForPair ? value(offForPair) : 0) + passiveGain(row, offForPair)
  }

  // A weapon is only a candidate if it raises the stat on its own — an
  // off-hand item beside it must not carry a dead or harmful weapon in.
  const weaponCandidates = ownedIn('MAIN_HAND').filter(
    (row) => acceptable(row) && def.mainFilter(row.template) && soloScore(row) > 0
  )
  const currentMainScore = currentMain ? soloScore(currentMain) : 0
  const mainCandidates = [...weaponCandidates]
  // Bare hands and the off-hand item compete when a two-hander is worn (or
  // nothing is) and that pair would beat what is held.
  if (def.allowsFists && (!currentMain || isTwoHanded(currentMain.template)) && pairScore(FISTS) > currentMainScore) {
    mainCandidates.push(FISTS)
  }
  const bestMain = pickBest(mainCandidates, pairScore)
  settle('MAIN_HAND', bestMain, bestMain ? pairScore(bestMain) : 0, currentMainScore)
  const finalMain = final.get('MAIN_HAND') || null

  if (finalMain && isTwoHanded(finalMain.template)) {
    // Both hands taken: the off hand must be empty, as equipItem enforces.
    if (currentOff) final.set('OFF_HAND', null)
  } else {
    settle('OFF_HAND', bestOff, bestOff ? offScore(bestOff) : 0, currentOff ? offScore(currentOff) : 0)
  }

  // ── Everything else ───────────────────────────────────────────────────
  for (const slot of WORN_SLOTS) {
    const current = worn.get(slot) || null
    const best = pickBest(ownedIn(slot).filter(acceptable), value)
    settle(slot, best, best ? value(best) : 0, current ? value(current) : 0)
  }

  // ── Diff and totals ───────────────────────────────────────────────────
  const changes = []
  for (const slot of ALL_SLOTS) {
    const from = worn.get(slot) || null
    const to = final.get(slot) || null
    if (from === to) continue
    changes.push({ slot, from, to })
  }

  const total = (loadout) => {
    let sum = 0
    for (const row of loadout.values()) if (row) sum += value(row)
    return sum + passiveFor(stat, skillLevels, gearContext(loadout.get('MAIN_HAND') || null, loadout.get('OFF_HAND') || null))
  }

  return {
    mode,
    stat,
    label: def.label,
    skipNegatives: skipNegatives === true,
    changes,
    before: total(worn),
    after: total(final),
    missingWeapon: weaponCandidates.length === 0,
  }
}

function describeRow(row) {
  if (!row) return null
  return { id: row.id, slug: row.template.slug, name: row.template.name }
}

/**
 * One feed line: what went on, what came off, and where the stat landed. The
 * original printed a header and a line per slot; the feed here is one entry
 * per action, so the slots are listed inline.
 */
function describePlan(plan) {
  const statLabel = plan.stat.toUpperCase()
  if (plan.changes.length === 0) {
    const why = plan.missingWeapon
      ? ` You own no ${MODES[plan.mode].weaponLabel} that raises ${statLabel}${plan.skipNegatives ? ' without a negative stat' : ''}.`
      : ''
    return `You're already wearing your best ${plan.label} gear.${why}`
  }
  const parts = plan.changes.map(({ slot, to }) => `${SLOT_LABELS[slot] || slot} → ${to ? to.template.name : 'empty'}`)
  const delta = plan.after - plan.before
  const sign = delta > 0 ? '+' : ''
  return `You auto-equip to maximize ${plan.label}: ${parts.join(', ')}. ${statLabel} ${plan.before} → ${plan.after} (${sign}${delta}).`
}

/**
 * Write a plan's changes: one statement takes every outgoing item off, one
 * puts every incoming item on. Each is guarded on the rows still being the
 * player's and in the state the plan saw — worn for what comes off, held and
 * unworn for what goes on — and a count that comes up short throws, so a
 * drop or purchase that raced the plan rolls the whole loadout back rather
 * than half-dressing the player. Ids and slots are bound as parameters;
 * nothing from the client reaches the SQL text.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} playerId
 * @param {{ changes: Array<{ slot: string, from: any|null, to: any|null }> }} plan
 */
async function applyPlan(tx, playerId, plan) {
  const offIds = plan.changes.filter((change) => change.from).map((change) => change.from.id)
  const on = plan.changes.filter((change) => change.to).map((change) => ({ id: change.to.id, slot: change.slot }))

  if (offIds.length > 0) {
    const placeholders = offIds.map((_, index) => `$${index + 2}`).join(', ')
    const took = await tx.$executeRawUnsafe(
      `UPDATE "PlayerItem" SET "isEquipped" = false, slot = NULL, "updatedAt" = NOW()
       WHERE "playerId" = $1 AND "isEquipped" = true AND id IN (${placeholders})`,
      playerId,
      ...offIds
    )
    if (took !== offIds.length) throw new Error('auto-equip: something you were wearing changed in the meantime')
  }

  if (on.length > 0) {
    const values = on.map((_, index) => `($${index * 2 + 2}, $${index * 2 + 3})`).join(', ')
    const params = on.flatMap((row) => [row.id, row.slot])
    const put = await tx.$executeRawUnsafe(
      `UPDATE "PlayerItem" AS p SET "isEquipped" = true, slot = v.slot, "updatedAt" = NOW()
       FROM (VALUES ${values}) AS v(id, slot)
       WHERE p.id = v.id AND p."playerId" = $1 AND p."isEquipped" = false AND p.quantity >= 1`,
      playerId,
      ...params
    )
    if (put !== on.length) throw new Error('auto-equip: an item is no longer available')
  }
}

/**
 * The inventory as the plan leaves it, without a second read: the same rows
 * the transaction just verified, flipped the way it flipped them.
 */
function applyPlanToInventory(inventory, plan) {
  const flips = new Map()
  for (const { slot, from, to } of plan.changes) {
    if (from) flips.set(from.id, { isEquipped: false, slot: null })
    if (to) flips.set(to.id, { isEquipped: true, slot })
  }
  return inventory.map((row) => (flips.has(row.id) ? { ...row, ...flips.get(row.id) } : row))
}

/**
 * Plan and apply the loadout for a player.
 *
 * @param {string} playerId
 * @param {{ mode: AutoEquipMode, skipNegatives?: boolean }} options
 * @returns {Promise<{ success: boolean, message: string, changed?: boolean, label?: string, stat?: string, before?: number, after?: number, changes?: Array<{ slot: string, from: any, to: any }>, inventory?: Array, player?: Object }>}
 */
async function autoEquip(playerId, { mode, skipNegatives = false }) {
  if (!isAutoEquipMode(mode)) {
    return { success: false, message: 'Unknown auto-equip mode' }
  }

  const [inventory, skillRow] = await Promise.all([
    getPlayerInventory(playerId),
    prisma.user.findUnique({ where: { id: playerId }, select: SKILL_SELECT }),
  ])
  if (!skillRow) {
    return { success: false, message: 'Player not found' }
  }
  const skillLevels = projectSkillState(skillRow).skills

  const plan = planAutoEquip(inventory, { mode, skipNegatives: skipNegatives === true, skillLevels })
  const summary = {
    label: plan.label,
    stat: plan.stat,
    before: plan.before,
    after: plan.after,
    changes: plan.changes.map(({ slot, from, to }) => ({ slot, from: describeRow(from), to: describeRow(to) })),
  }

  if (plan.changes.length === 0) {
    const player = await prisma.user.findUnique({ where: { id: playerId }, select: PLAYER_SELECT })
    return { success: true, changed: false, message: describePlan(plan), inventory, player, ...summary }
  }

  // Everything lands or nothing does, and the mods are recomputed from the
  // rows as they stand inside the same transaction — the player view comes
  // back from that write, so nothing is read again afterwards.
  const player = await prisma.$transaction(async (tx) => {
    await applyPlan(tx, playerId, plan)
    return recomputeStatMods(playerId, { tx, select: PLAYER_SELECT })
  })

  return {
    success: true,
    changed: true,
    message: describePlan(plan),
    inventory: applyPlanToInventory(inventory, plan),
    player,
    ...summary,
  }
}

module.exports = {
  MODES,
  MODE_IDS,
  SLOT_LABELS,
  isAutoEquipMode,
  planAutoEquip,
  describePlan,
  applyPlan,
  applyPlanToInventory,
  autoEquip,
}
