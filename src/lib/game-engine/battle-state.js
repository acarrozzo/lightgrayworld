const { getStatBuffBonuses } = require('./services/buff-service')
const { getPassiveSkillBonuses } = require('../game-data/skills')
const { getEnemyTraits } = require('../game-data/enemy-traits')

/**
 * What the player is holding, as the skills read it: the weapon's category,
 * whether it takes both hands, whether the off hand carries a shield, and
 * whether the mount under them flies (`metadata.grantsFlight`).
 * @typedef {{ weaponCategory: 'MELEE'|'RANGED'|null, isTwoHanded: boolean, hasShield: boolean, flyingMount?: boolean }} GearContext
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
  constructor({ playerId, roomId, enemy, playerStats, equippedWeaponCategory = null, companion = null, gear = null }) {
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
    // The equipped COMPANION, if any: { name, damageMin, damageMax }. It swings
    // on every attack turn the player takes (battle-calculator).
    this.companion = companion || null

    this.turnCount = 0
    // Turns the player is stone for (a Gorgon's or Medusa's gaze). While it
    // is above zero they cannot swing, cast, drink or retreat; the enemy keeps
    // attacking. Ticks down once per turn (`tickPetrify`).
    this.petrifiedTurns = 0
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
   * @param {Object|null} [companion]
   */
  updateStats(playerStats, gear, companion) {
    if (gear !== undefined) {
      if (gear === null || typeof gear === 'string') this.setGear(null, gear)
      else this.setGear(gear)
    }
    this.applyStats(playerStats)
    if (companion !== undefined) {
      this.companion = companion || null
    }
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
    }
  }
}

module.exports = { BattleState, playerIsFlying }
