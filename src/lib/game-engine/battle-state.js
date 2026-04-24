class BattleState {
  constructor({ playerId, roomId, enemy, playerStats }) {
    this.playerId = playerId
    this.roomId = roomId
    this.enemySlug = enemy.slug
    this.enemyName = enemy.name
    this.enemyCurrentHp = enemy.hp
    this.enemyMaxHp = enemy.hp
    this.enemy = enemy

    this.baseStr = Math.max(1, (playerStats.str || 0) + (playerStats.strMod || 0))
    this.baseDef = Math.max(1, (playerStats.def || 0) + (playerStats.defMod || 0))

    this.turnCount = 0
    this.canFlee = false
    this.isActive = true
    this.startedAt = Date.now()
  }

  updateStats(playerStats) {
    this.baseStr = Math.max(1, (playerStats.str || 0) + (playerStats.strMod || 0))
    this.baseDef = Math.max(1, (playerStats.def || 0) + (playerStats.defMod || 0))
  }

  incrementTurn() {
    this.turnCount++
    if (this.turnCount >= 10) this.canFlee = true
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
