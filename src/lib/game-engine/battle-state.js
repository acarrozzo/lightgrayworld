const { getStatBuffBonuses } = require('./services/buff-service')
const { getPassiveSkillBonuses } = require('../game-data/skills')

/**
 * What the player is holding, as the skills read it: the weapon's category,
 * whether it takes both hands, and whether the off hand carries a shield.
 * @typedef {{ weaponCategory: 'MELEE'|'RANGED'|null, isTwoHanded: boolean, hasShield: boolean }} GearContext
 */

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
    this.canFlee = false
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
    }
    this.equippedWeaponCategory = this.gear.weaponCategory || 'MELEE'
  }

  applyStats(playerStats) {
    const buff = getStatBuffBonuses(playerStats)
    // The skill levels ride on the same row (SKILL_SELECT); a row without them
    // simply has no passives.
    const skill = getPassiveSkillBonuses(playerStats, this.gear)
    this.skillBonuses = skill
    this.dodgeChance = skill.dodgeChance
    this.baseStr = (playerStats.str || 0) + (playerStats.strMod || 0) + buff.str + skill.str
    this.baseDex = (playerStats.dex || 0) + (playerStats.dexMod || 0) + buff.dex + skill.dex
    this.baseMag = (playerStats.mag || 0) + (playerStats.magMod || 0) + buff.mag
    this.baseDef = (playerStats.def || 0) + (playerStats.defMod || 0) + buff.def + skill.def
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
    if (this.turnCount >= 3) this.canFlee = true
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
      isAdvantageTurn: false,
      playerHp,
      playerHpMax,
      playerStr: this.baseStr,
      playerDef: this.baseDef,
    }
  }
}

module.exports = { BattleState }
