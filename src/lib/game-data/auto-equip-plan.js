const { getPassiveSkillBonuses, isShieldItem } = require('./skills')

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
 * The plan's `before` and `after` are the stat as combat rolls it
 * (BattleState.applyStats, effectiveStats on the client): core plus running
 * buffs (`base`), plus gear, plus every passive for what is in hand — the Pro
 * multipliers included — so the number the feed and the battle card print is
 * the number the header shows and the next swing uses.
 *
 * `deltas` is the change to all four stats, not just the target: a MAX for
 * STR that takes a shield off costs DEF, and the preview says so.
 *
 * This module is the pure half — inventory rows in, a change list out — so
 * the server (services/auto-equip-service.js, which applies the plan) and
 * the client (the MAX row's hover preview) run the same rules, and it is
 * unit-tested without a database. The client's plan is only a preview; the
 * server plans again from its own rows when the button is pressed.
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
const WORN_SLOTS = ['HEAD', 'BODY', 'HANDS', 'FEET', 'RING', 'NECK', 'MOUNT', 'ARTIFACT']
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

// Flat passives only, for scoring: the Pro multiplier scales with the whole
// gear-side total, which every candidate for one slot shares apart from
// itself, so it cannot reorder them for a fixed weapon kind and is left out
// of the score. The reported totals pass `mods` and count it.
function passiveFor(stat, skillLevels, gear, mods) {
  if (!skillLevels) return 0
  const bonuses = getPassiveSkillBonuses(skillLevels, gear, mods)
  const value = bonuses[stat]
  return typeof value === 'number' ? value : 0
}

function gearContext(main, off) {
  return {
    weaponCategory: main?.template?.weaponCategory || null,
    isTwoHanded: main ? isTwoHanded(main.template) : false,
    hasShield: off ? isShieldItem(off.template) : false,
    ammo: typeof main?.template?.metadata?.ammo === 'string' ? main.template.metadata.ammo : null,
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
 * `base` is the part of the stat no gear touches — the core stat plus any
 * running buff — added to both totals so they read as the real stat. It
 * cannot change what is picked, and `deltas` do not need it.
 *
 * @param {Array<{ id: string, quantity: number, isEquipped: boolean, slot: string|null, template: { slug: string, name: string, equipSlot: string|null, weaponCategory: string|null, metadata: any } }>} inventory
 * @param {{ mode: AutoEquipMode, skipNegatives?: boolean, skillLevels?: Record<string, number>|null, base?: number }} options
 * @returns {{
 *   mode: AutoEquipMode, stat: string, label: string, skipNegatives: boolean,
 *   changes: Array<{ slot: string, from: any|null, to: any|null }>,
 *   before: number, after: number,
 *   deltas: { str: number, dex: number, mag: number, def: number },
 *   missingWeapon: boolean,
 * }}
 */
function planAutoEquip(inventory, { mode, skipNegatives = false, skillLevels = null, base = 0 }) {
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

  // The stat as BattleState.applyStats builds it: base, plus gear (the *Mod
  // column recomputeStatMods will write), plus the passives for these hands
  // with the gear-side STR and DEX the Pro multipliers scale.
  const gearSum = (loadout, key) => {
    let sum = 0
    for (const row of loadout.values()) if (row) sum += statValue(row, key)
    return sum
  }
  const gearSide = (loadout, key) => {
    const gear = gearContext(loadout.get('MAIN_HAND') || null, loadout.get('OFF_HAND') || null)
    const mods = { str: gearSum(loadout, 'str'), dex: gearSum(loadout, 'dex') }
    return gearSum(loadout, key) + passiveFor(key, skillLevels, gear, mods)
  }
  const startingBase = typeof base === 'number' && Number.isFinite(base) ? base : 0
  const deltas = /** @type {{ str: number, dex: number, mag: number, def: number }} */ ({ str: 0, dex: 0, mag: 0, def: 0 })
  for (const key of STAT_KEYS) deltas[key] = gearSide(final, key) - gearSide(worn, key)

  return {
    mode,
    stat,
    label: def.label,
    skipNegatives: skipNegatives === true,
    changes,
    before: startingBase + gearSide(worn, stat),
    after: startingBase + gearSide(final, stat),
    deltas,
    missingWeapon: weaponCandidates.length === 0,
  }
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

module.exports = {
  STAT_KEYS,
  MODES,
  MODE_IDS,
  SLOT_LABELS,
  isAutoEquipMode,
  planAutoEquip,
  describePlan,
}
