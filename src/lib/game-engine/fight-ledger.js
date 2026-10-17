/**
 * The fight ledger: one compact row per resolved turn.
 *
 * The battle readout shows one turn at a time and forgets it on the next. The
 * ledger keeps every turn of a fight as a structured row — what you did and
 * for how much (raw − block), what the enemy did back, the effects either way,
 * and both HP after — so the fight can be read back during it (the Turn chip
 * on the battle card), right after it (the frozen victory box) and long after
 * it (the Battle Log, the World Tool player page).
 *
 * The server is the only author of rows. Every path that resolves a turn calls
 * `compactTurn` on the turn record it already has and pushes the row onto
 * `BattleState.turns`; a `battle:turn` payload carries its row as
 * `ledgerTurn`, a terminal payload (victory, defeat) and the reconnect
 * snapshot carry the whole list as `turns`, and the row list is written beside
 * the summary on `BattleLog` when the fight ends — a win, a death or a retreat.
 * The client never derives a row itself, so what it shows is what the server
 * resolved.
 *
 * The shape is the one the client reads (`lib/fight-ledger.ts` mirrors it) and
 * the one the database stores, so a change here needs both: a new field a
 * turn can carry must be added to this projection or it will never appear in
 * history.
 *
 * Rows are small by design (~150 bytes) and capped per fight (`LEDGER_CAP`), so
 * a long boss fight stays bounded in memory and in the row written at the end.
 */

/** Rows kept per fight. Beyond it the oldest go; the first turn is kept as a marker. */
const LEDGER_CAP = 400

/**
 * @typedef {{ k: 'poison'|'stone'|'absorb'|'drainHp'|'drainMp'|'steal'|'armor'|'heal', n: number } | { k: 'rise' }} LedgerFx
 *
 * @typedef {Object} LedgerTurn
 * @property {number} t  The turn number, 1-based, as the card's "Turn N" counts it.
 * @property {Object} you
 * @property {'strike'|'skill'|'spell'|'support'|'stone'|'none'} you.kind
 * @property {string|null} you.name  Skill, spell or item name; null for a bare swing.
 * @property {string|null} you.verb  The support action's kind (`use_item`, `equip_item`, …); null otherwise.
 * @property {number} you.dmg  Your own hit (not the helpers').
 * @property {number|null} you.raw  The offensive roll (a skill's weapon roll, a spell's amount).
 * @property {number|null} you.bonus  A skill's bonus on top of the weapon roll.
 * @property {number|null} you.block  The enemy's block against your hit.
 * @property {number|null} you.cost  MP the turn spent; null when nothing was charged.
 * @property {string|null} you.calc  A spell's own roll breakdown, as the server wrote it.
 * @property {'flying'|'immune-melee'|'immune-ranged'|'immune-magic'|'dodged'|'blocked'|null} you.miss  Why nothing landed.
 * @property {boolean} you.melted  A melee blow halved by magma.
 * @property {{ name: string, dmg: number }[]} you.helpers  A second arrow, a companion's swing.
 * @property {string|null} you.effect  A support turn's effect text ("+20 HP").
 * @property {Object} foe
 * @property {'hit'|'special'|'heal'|'windup'|'none'} foe.kind
 * @property {string|null} foe.name  The special or wind-up's name.
 * @property {number} foe.dmg  Everything it dealt this turn, extra hits included.
 * @property {number|null} foe.raw  Its first roll.
 * @property {number|null} foe.block  Your block against the first hit.
 * @property {number[]} foe.rolls  A special's individual rolls, when it listed them.
 * @property {{ dmg: number, name: string|null, dodged: boolean, pack: boolean }[]} foe.hits  Its hits after the first.
 * @property {boolean} foe.dodged  You dodged its first swing.
 * @property {LedgerFx[]} foe.fx  Poison, stone, absorb, drains, theft, Magic Armor, heal, resurrect.
 * @property {{ you: number, foe: number }} hp  Both sides after the turn.
 * @property {number|null} mp  Your MP after the turn, when the turn reported it.
 */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const orNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Project one resolved turn onto a ledger row.
 *
 * `turn` is the turn record the handlers already hold — `resolveTurn`'s result,
 * the hand-built record of an advantage or support turn, or a `battle:turn`
 * payload, which carries the same field names. `extras` is what the record
 * does not know: the turn number, both HP after the hit landed, MP when the
 * turn reported it, what Magic Armor absorbed, the support action, and whether
 * the enemy acted at all (it does not on the turn that kills it).
 *
 * @param {Object} turn
 * @param {{ turn: number, playerHp: number, enemyHp: number, playerMp?: number|null, absorbed?: number, actionMeta?: Object|null, enemyActed?: boolean }} extras
 * @returns {LedgerTurn}
 */
function compactTurn(turn, extras) {
  const t = turn || {}
  const meta = extras.actionMeta ?? t.actionMeta ?? null
  const spell = t.spell ?? null
  const skill = t.skill ?? null
  const effects = t.enemyEffects ?? {}

  // ── your side ──
  let miss = null
  if (t.missedFlyingMelee) miss = 'flying'
  else if (t.immuneToWeapon === 'MELEE') miss = 'immune-melee'
  else if (t.immuneToWeapon === 'RANGED') miss = 'immune-ranged'
  else if (t.immuneToMagic) miss = 'immune-magic'
  else if (effects.blocked) miss = 'blocked'
  else if (t.enemyDodged) miss = 'dodged'

  let kind
  if (t.petrified) kind = 'stone'
  else if (meta) kind = 'support'
  else if (spell) kind = 'spell'
  else if (skill) kind = 'skill'
  else if (orNull(t.playerRaw) === null && n(t.playerDealtDamage) === 0 && miss === null) kind = 'none'
  else kind = 'strike'

  const helpers = []
  if (t.extraShot) helpers.push({ name: 'Second arrow', dmg: n(t.extraShot.damage) })
  if (t.companion) helpers.push({ name: String(t.companion.name || 'Companion'), dmg: n(t.companion.damage) })

  const magicFizzled = Boolean(t.immuneToMagic)
  const you = {
    kind,
    name:
      kind === 'support'
        ? meta.itemName || meta.label || meta.text || null
        : spell
          ? spell.name
          : skill
            ? skill.name
            : null,
    verb: kind === 'support' ? meta.kind || null : null,
    dmg: kind === 'support' || kind === 'stone' || kind === 'none' ? 0 : n(t.playerDealtDamage),
    raw:
      kind === 'spell' ? orNull(spell.amount) ?? orNull(t.playerRaw)
      : kind === 'skill' ? orNull(skill.weaponRaw) ?? orNull(t.playerRaw)
      : kind === 'strike' ? orNull(t.playerRaw)
      : null,
    bonus: kind === 'skill' && !magicFizzled ? orNull(skill.bonus) : null,
    block: (kind === 'strike' || kind === 'skill' || kind === 'spell') && miss === null ? orNull(t.enemyBlocked) : null,
    cost:
      kind === 'spell' && !magicFizzled ? orNull(spell.cost)
      : kind === 'skill' && !magicFizzled ? orNull(skill.cost)
      : null,
    calc: kind === 'spell' ? spell.text ?? null : null,
    miss,
    melted: Boolean(t.melted),
    helpers,
    effect: kind === 'support' ? meta.effectText ?? null : null,
  }

  // ── the enemy's side ──
  const enemyActed = extras.enemyActed !== false
  const extraHits = Array.isArray(t.extraHits) ? t.extraHits : []
  const fx = []
  const addFx = (k, v) => {
    const amount = n(v)
    if (amount > 0) fx.push({ k, n: amount })
  }
  let foe
  if (!enemyActed) {
    foe = { kind: 'none', name: null, dmg: 0, raw: null, block: null, rolls: [], hits: [], dodged: false, fx }
  } else if (effects.windUp) {
    foe = { kind: 'windup', name: effects.windUp.name || null, dmg: 0, raw: null, block: null, rolls: [], hits: [], dodged: false, fx }
  } else if (effects.healCast !== undefined) {
    addFx('heal', effects.healCast)
    if (effects.resurrected) fx.push({ k: 'rise' })
    foe = { kind: 'heal', name: null, dmg: 0, raw: null, block: null, rolls: [], hits: [], dodged: false, fx }
  } else {
    const dmg = n(t.enemyDealtDamage)
    const action = t.enemyAction ?? null
    const acted = action !== null || orNull(t.enemyRaw) !== null || dmg > 0 || Boolean(t.playerDodged)
    if (effects.resurrected) fx.push({ k: 'rise' })
    addFx('stone', t.petrifyApplied)
    addFx('poison', t.poisonApplied?.clicks)
    addFx('absorb', t.enemyHealed)
    addFx('drainHp', effects.hpDrained)
    addFx('drainMp', effects.mpDrained)
    addFx('steal', effects.stolen)
    addFx('armor', extras.absorbed)
    foe = {
      kind: !acted ? 'none' : action ? 'special' : 'hit',
      name: action ? action.name || null : null,
      dmg,
      raw: acted ? orNull(t.enemyRaw) : null,
      block: acted ? orNull(t.playerBlocked) : null,
      rolls: action && Array.isArray(action.rolls) ? action.rolls.map(n) : [],
      hits: extraHits.map((hit) => ({
        dmg: n(hit.damage),
        name: hit.action ? hit.action.name || null : null,
        dodged: Boolean(hit.dodged),
        pack: Boolean(hit.pack),
      })),
      dodged: Boolean(t.playerDodged),
      fx,
    }
  }

  return {
    t: n(extras.turn),
    you,
    foe,
    hp: { you: Math.max(0, n(extras.playerHp)), foe: Math.max(0, n(extras.enemyHp)) },
    mp: orNull(extras.playerMp ?? null),
  }
}

/**
 * Append a row, keeping the list under the cap. Past the cap the second row
 * goes, never the first: a 500-turn fight still shows how it opened.
 * @param {LedgerTurn[]} turns
 * @param {LedgerTurn} row
 * @returns {LedgerTurn[]}  The same array, for chaining.
 */
function pushLedgerTurn(turns, row) {
  turns.push(row)
  if (turns.length > LEDGER_CAP) turns.splice(1, turns.length - LEDGER_CAP)
  return turns
}

module.exports = { LEDGER_CAP, compactTurn, pushLedgerTurn }
