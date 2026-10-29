const { getStatBuffBonuses } = require('./services/buff-service')
const { getPassiveSkillBonuses } = require('../game-data/skills')
const { getEnemyTraits } = require('../game-data/enemy-traits')
const { pushLedgerTurn } = require('./fight-ledger')

/**
 * What the player is holding, as the skills read it: the weapon's category,
 * whether it takes both hands, whether the off hand carries a shield, and
 * whether the mount under them flies (`metadata.grantsFlight`).
 * @typedef {{ weaponCategory: 'MELEE'|'RANGED'|null, isTwoHanded: boolean, hasShield: boolean, flyingMount?: boolean, ammo?: string|null }} GearContext
 */

/**
 * Is the player airborne right now? The same two ways room gates read
 * (`playerCanFly` in room-gates.js): the click-counted `wings` buff, or a
 * flying mount. The original's battle.php exempted `$_SESSION['flying']` from
 * the flying-enemy check — a player on wings or a Sky Hawk could melee a bat.
 * @param {{ wings?: number }|null|undefined} playerStats  A User row carrying `wings`.
 * @param {GearContext|null|undefined} gear
 */
function playerIsFlying(playerStats, gear) {
  return (playerStats?.wings || 0) >= 1 || Boolean(gear && gear.flyingMount)
}

class BattleState {
  constructor({ playerId, roomId, enemy, playerStats, equippedWeaponCategory = null, gear = null }) {
    this.playerId = playerId
    this.roomId = roomId
    this.enemySlug = enemy.slug
    this.enemyName = enemy.name
    this.enemyCurrentHp = enemy.hp
    this.enemyMaxHp = enemy.hp
    this.enemy = enemy

    // Keep the true value (mods can push a stat negative) — combat rolls guard the range.
    // Four contributions: the core stat, equipment mods (derived, stored on the
    // User row), any running click-counted stat buff (reds/greens/blues/yellows),
    // and the passive skills for what is in hand. Buffs and skills are applied
    // here rather than folded into strMod — that column is recomputed from
    // equipment on every equip and would drop them.
    this.setGear(gear, equippedWeaponCategory)
    this.applyStats(playerStats)

    this.turnCount = 0
    // Turns the player is stone for (a Gorgon's or Medusa's gaze). While it
    // is above zero they cannot swing, cast, drink or retreat; the enemy keeps
    // attacking. Ticks down once per turn (`tickPetrify`).
    this.petrifiedTurns = 0
    // The id of a special the enemy is winding up (Firebreath's inhale); it
    // lands on the enemy's next turn. Null on an ordinary turn.
    this.enemyWindUp = null
    // The poison the player put on the enemy (Poison Dart): what it takes
    // each turn, past its DEF, and how many turns are left. Null when none.
    // It lives on the fight, as the original's `$_SESSION['poison_amt']` did:
    // a retreat, a death or a kill ends it with the fight, and a resurrected
    // enemy stands up clean.
    /** @type {{ perTurn: number, turnsLeft: number, source: string } | null} */
    this.enemyPoison = null
    // Retreat is open from the first moment of the fight. It used to unlock
    // after three turns, which meant walking into something far above your
    // level was a death sentence rather than a mistake you could back out of —
    // and the original had no such lock: `retreat` worked on the turn you typed
    // it. Breaking off leaves the enemy standing in the room at full HP, so
    // there is nothing to farm by fleeing.
    this.canFlee = true
    this.isActive = true
    this.startedAt = Date.now()

    this.totalDamageDealt = 0
    this.totalDamageReceived = 0
    this.maxSingleHit = 0
    this.multiplayerBonusUsed = false
    this.lastTurnResult = null
    // The fight's ledger: one compact row per resolved turn (fight-ledger.js),
    // in order, capped. Sent whole on reconnect and with the terminal event,
    // and written beside the summary on BattleLog when the fight ends.
    /** @type {import('./fight-ledger').LedgerTurn[]} */
    this.turns = []
  }

  /**
   * Record what is in hand. Accepts the full gear context, or — for callers
   * that only know the weapon's category — just that, with no shield and one
   * hand assumed.
   * @param {GearContext|null|undefined} gear
   * @param {'MELEE'|'RANGED'|null|undefined} [weaponCategory]
   */
  setGear(gear, weaponCategory) {
    const category = gear && gear.weaponCategory !== undefined ? gear.weaponCategory : (weaponCategory || null)
    this.gear = {
      weaponCategory: category || null,
      isTwoHanded: Boolean(gear && gear.isTwoHanded),
      hasShield: Boolean(gear && gear.hasShield),
      flyingMount: Boolean(gear && gear.flyingMount),
      // `metadata.ammo` of the weapon in hand — what tells a bow from a
      // crossbow for Multi Arrow and Bolt Upgrade. Handlers name it `ammoSlug`.
      ammo: (gear && (gear.ammo || gear.ammoSlug)) || null,
    }
    this.equippedWeaponCategory = this.gear.weaponCategory || 'MELEE'
  }

  /** Airborne this turn: wings still ticking, or a flying mount. Melee reaches a flying enemy. */
  get isFlying() {
    return playerIsFlying({ wings: this.wingsClicks }, this.gear)
  }

  applyStats(playerStats) {
    const buff = getStatBuffBonuses(playerStats)
    // The skill levels ride on the same row (SKILL_SELECT); a row without them
    // simply has no passives.
    const skill = getPassiveSkillBonuses(playerStats, this.gear, { str: playerStats.strMod || 0, dex: playerStats.dexMod || 0 })
    this.skillBonuses = skill
    this.dodgeChance = skill.dodgeChance
    this.multiArrowChance = skill.multiArrowChance || 0
    this.baseStr = (playerStats.str || 0) + (playerStats.strMod || 0) + buff.str + skill.str
    this.baseDex = (playerStats.dex || 0) + (playerStats.dexMod || 0) + buff.dex + skill.dex
    this.baseMag = (playerStats.mag || 0) + (playerStats.magMod || 0) + buff.mag
    this.baseDef = (playerStats.def || 0) + (playerStats.defMod || 0) + buff.def + skill.def
    // The status effects combat reads (see buff-service STATUS_FIELDS):
    // whether poison could take hold. (Iron Skin is DEF, folded in above by
    // getStatBuffBonuses.) The player's level is what an enemy's poison scales with.
    this.poisoned = (playerStats.poisonClicks || 0) > 0
    this.poisonImmune = (playerStats.poisonImmuneClicks || 0) > 0
    // Wings ride on the same row (BUFF_SELECT); ≥ 1 means the player flies.
    this.wingsClicks = playerStats.wings || 0
    this.level = playerStats.level || this.level || 1
  }

  /**
   * Re-read the live row mid-fight (a potion, a weapon swap). `gear` is the
   * full context, or a bare weapon category for older callers.
   * @param {Object} playerStats
   * @param {GearContext|'MELEE'|'RANGED'|null} [gear]
   */
  updateStats(playerStats, gear) {
    if (gear !== undefined) {
      if (gear === null || typeof gear === 'string') this.setGear(null, gear)
      else this.setGear(gear)
    }
    this.applyStats(playerStats)
  }

  incrementTurn() {
    this.turnCount++
  }

  recordTurn(playerDealt, enemyDealt, hadMultiplayerBonus, fullTurnResult = null) {
    this.totalDamageDealt += playerDealt
    this.totalDamageReceived += enemyDealt
    if (playerDealt > this.maxSingleHit) this.maxSingleHit = playerDealt
    if (hadMultiplayerBonus) this.multiplayerBonusUsed = true
    if (fullTurnResult) this.lastTurnResult = fullTurnResult
  }

  /** Keep a resolved turn's ledger row. The handlers build the row; this only files it. */
  recordLedgerTurn(row) {
    if (row) pushLedgerTurn(this.turns, row)
  }

  applyDamageToEnemy(amount) {
    this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - amount)
  }

  /**
   * HP Absorb: the enemy takes back what it dealt, up to full. Returns what
   * it actually recovered so the turn can say so. Nothing for a dead enemy.
   */
  healEnemy(amount) {
    if (this.enemyCurrentHp <= 0) return 0
    const healed = Math.max(0, Math.min(Math.floor(amount) || 0, this.enemyMaxHp - this.enemyCurrentHp))
    this.enemyCurrentHp += healed
    return healed
  }

  /** Resurrect: a dead enemy stands back up at full HP, and clean of poison. */
  reviveEnemy() {
    this.enemyCurrentHp = this.enemyMaxHp
    this.enemyPoison = null
  }

  /**
   * Put poison on the enemy. Refused while one is already running: the
   * original set its poison only when the old count was spent, so a second
   * dart never refreshed or stacked. Returns whether it took.
   * @param {number} perTurn
   * @param {number} turns
   * @param {string} source  The spell or weapon that left it, for the card.
   */
  poisonEnemy(perTurn, turns, source) {
    const amount = Math.max(0, Math.floor(Number(perTurn) || 0))
    const count = Math.max(0, Math.floor(Number(turns) || 0))
    if (amount <= 0 || count <= 0) return false
    if (this.enemyPoison || this.isEnemyDead()) return false
    this.enemyPoison = { perTurn: amount, turnsLeft: count, source: String(source || 'Poison') }
    return true
  }

  /**
   * One turn of poison: the enemy takes what is running, past its DEF, and
   * the count drops by one. Returns the tick — what it took, how many turns
   * are left after it, whether it was the killing blow — or null when nothing
   * is running or the enemy is already down.
   * @returns {{ amount: number, left: number, killed: boolean, source: string } | null}
   */
  burnEnemyPoison() {
    const poison = this.enemyPoison
    if (!poison || this.isEnemyDead()) return null
    const amount = Math.min(poison.perTurn, this.enemyCurrentHp)
    this.enemyCurrentHp -= amount
    poison.turnsLeft -= 1
    const left = poison.turnsLeft
    if (left <= 0) this.enemyPoison = null
    return { amount, left: Math.max(0, left), killed: this.enemyCurrentHp <= 0, source: poison.source }
  }

  /** Stone for this many turns, from the next one. */
  petrify(turns) {
    this.petrifiedTurns = Math.max(this.petrifiedTurns, Math.floor(turns) || 0)
  }

  /** One turn of stone has passed. */
  tickPetrify() {
    if (this.petrifiedTurns > 0) this.petrifiedTurns -= 1
  }

  get isPetrified() {
    return this.petrifiedTurns > 0
  }

  isEnemyDead() {
    return this.enemyCurrentHp <= 0
  }

  end() {
    this.isActive = false
  }

  getSnapshot() {
    return {
      enemySlug: this.enemySlug,
      enemyName: this.enemyName,
      enemyCurrentHp: this.enemyCurrentHp,
      enemyMaxHp: this.enemyMaxHp,
      turnCount: this.turnCount,
      canFlee: this.canFlee,
      petrifiedTurns: this.petrifiedTurns,
      // The poison on the enemy, so the card's pill survives a refresh.
      enemyPoison: this.enemyPoison ? { perTurn: this.enemyPoison.perTurn, turnsLeft: this.enemyPoison.turnsLeft, source: this.enemyPoison.source } : null,
    }
  }

  /**
   * The full client-facing battle shape, for a client picking up a fight that is
   * already under way — a reconnect, or a second tab opening mid-battle.
   *
   * Deliberately the same shape as the `battle:started` payload so the client
   * applies it through the existing handler and the two cannot drift. Unlike a
   * fresh start it reports live enemy HP rather than full, and is never an
   * advantage turn: the ambush, if there was one, already happened.
   */
  getResumeSnapshot({ playerHp, playerHpMax }) {
    return {
      ...this.getSnapshot(),
      enemyIcon: this.enemy.name,
      enemyLevel: this.enemy.level,
      enemyAtt: this.enemy.att,
      enemyDef: this.enemy.def,
      enemyDescription: this.enemy.description,
      enemyTraits: getEnemyTraits(this.enemy),
      isAdvantageTurn: false,
      playerHp,
      playerHpMax,
      playerStr: this.equippedWeaponCategory === 'RANGED' ? this.baseDex : this.baseStr,
      playerDef: this.baseDef,
      // The fight so far, so a refresh gets the ledger back along with the HP.
      turns: this.turns,
    }
  }
}

module.exports = { BattleState, playerIsFlying }
