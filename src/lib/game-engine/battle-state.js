const { getStatBuffBonuses } = require('./services/buff-service')

class BattleState {
  constructor({ playerId, roomId, enemy, playerStats, equippedWeaponCategory = null }) {
    this.playerId = playerId
    this.roomId = roomId
    this.enemySlug = enemy.slug
    this.enemyName = enemy.name
    this.enemyCurrentHp = enemy.hp
    this.enemyMaxHp = enemy.hp
    this.enemy = enemy

    // Keep the true value (mods can push a stat negative) — combat rolls guard the range.
    // Three contributions: the core stat, equipment mods (derived, stored on the
    // User row) and any running click-counted stat buff (reds/greens/blues/yellows),
    // which is applied here rather than folded into strMod — that column is
    // recomputed from equipment on every equip and would drop the buff.
    this.applyStats(playerStats)
    this.equippedWeaponCategory = equippedWeaponCategory || 'MELEE'

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

  applyStats(playerStats) {
    const buff = getStatBuffBonuses(playerStats)
    this.baseStr = (playerStats.str || 0) + (playerStats.strMod || 0) + buff.str
    this.baseDex = (playerStats.dex || 0) + (playerStats.dexMod || 0) + buff.dex
    this.baseMag = (playerStats.mag || 0) + (playerStats.magMod || 0) + buff.mag
    this.baseDef = (playerStats.def || 0) + (playerStats.defMod || 0) + buff.def
  }

  updateStats(playerStats, equippedWeaponCategory) {
    this.applyStats(playerStats)
    if (equippedWeaponCategory !== undefined) {
      this.equippedWeaponCategory = equippedWeaponCategory || 'MELEE'
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
}

module.exports = { BattleState }
