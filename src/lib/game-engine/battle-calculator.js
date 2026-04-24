function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Count other players in the same room who also have an active battle
function getOtherCombatantCount(roomState, excludePlayerId) {
  let count = 0
  for (const [pid, battle] of roomState.activeBattles.entries()) {
    if (pid !== excludePlayerId && battle.isActive) count++
  }
  return count
}

function resolveTurn(battleState, otherCombatants) {
  const bonus = 1 + otherCombatants * 0.1
  const effectiveStr = Math.max(1, Math.floor(battleState.baseStr * bonus))
  const effectiveDef = Math.max(1, Math.floor(battleState.baseDef * bonus))
  const enemy = battleState.enemy

  // Player attacks enemy
  const playerRaw = rand(Math.floor(effectiveStr * 0.6), effectiveStr)
  const enemyBlock = rand(Math.floor(enemy.def * 0.6), enemy.def)
  const playerFinal = Math.max(1, playerRaw - enemyBlock)

  // Enemy attacks player
  const enemyRaw = rand(Math.floor(enemy.att * 0.6), enemy.att)
  const playerBlock = rand(Math.floor(effectiveDef * 0.6), effectiveDef)
  const enemyFinal = Math.max(0, enemyRaw - playerBlock)

  return {
    playerDealtDamage: playerFinal,
    enemyDealtDamage: enemyFinal,
    playerRaw,
    enemyRaw,
    enemyBlocked: enemyBlock,
    playerBlocked: playerBlock,
    playerStrMax: effectiveStr,
    playerDefMax: effectiveDef,
    enemyStrMax: enemy.att,
    multiplayerBonus: otherCombatants > 0,
    bonusPercent: otherCombatants * 10,
  }
}

module.exports = { rand, resolveTurn, getOtherCombatantCount }
