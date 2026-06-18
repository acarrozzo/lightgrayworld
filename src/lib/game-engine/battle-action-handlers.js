const { prisma } = require('../db-client')
const { BattleState } = require('./battle-state')
const { resolveTurn, resolveEnemyAttack, getOtherCombatantCount } = require('./battle-calculator')
const { calcBattleWinRewards, getPriorKills, persistBattleWin, handleBattleWin, handleBattleDefeat } = require('./battle-win-handler')
const { getEnemy } = require('../game-data/enemies')
const { isProbabilistic } = require('../game-data/room-enemies')
const { getRoomEnemies } = require('../game-data/room-enemies')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')

function makeFeedback(action, outcome, message, data = {}) {
  const ts = Date.now()
  return {
    action,
    message,
    outcome,
    ts,
    timestamp: new Date(ts).toISOString(),
    success: outcome === 'success',
    data,
  }
}

function errorResult(action, message) {
  return {
    success: false,
    action,
    message,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: makeFeedback(action, 'failure', message),
      },
    ],
  }
}

// Fetch the stats needed for BattleState from DB
async function fetchPlayerStats(playerId) {
  return prisma.user.findUnique({
    where: { id: playerId },
    select: { str: true, dex: true, mag: true, def: true, strMod: true, dexMod: true, magMod: true, defMod: true, hp: true, hpMax: true },
  })
}

// Fetch the equipped MAIN_HAND weapon category. Returns 'MELEE' | 'RANGED' | null (null = unarmed).
async function fetchEquippedWeaponCategory(playerId) {
  const item = await prisma.playerItem.findFirst({
    where: { playerId, isEquipped: true, slot: 'MAIN_HAND' },
    select: { ItemTemplate: { select: { weaponCategory: true } } },
  })
  return item?.ItemTemplate?.weaponCategory || null
}

// ─── start_battle ───────────────────────────────────────────────────────────

async function executeStartBattle(action, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) return errorResult('start_battle', 'Player not found in this room')

  if (roomState.activeBattles.has(playerId)) {
    return errorResult('start_battle', 'You are already in a battle.')
  }

  const { enemySlug, isAutoInitiated = false } = action.data || {}
  if (!enemySlug) return errorResult('start_battle', 'No enemy specified.')

  if (isProbabilistic(roomState.roomId)) {
    const activeSlug = roomState.getPlayerActiveEnemy(playerId)
    if (activeSlug !== enemySlug) {
      return errorResult('start_battle', 'That enemy is not here.')
    }
  } else {
    const roomConfig = getRoomEnemies(roomState.roomId)
    if (!roomConfig || !roomConfig.enemies.includes(enemySlug)) {
      return errorResult('start_battle', 'That enemy is not here.')
    }
  }

  const enemy = getEnemy(enemySlug)
  if (!enemy) return errorResult('start_battle', 'Unknown enemy.')

  const playerStats = await fetchPlayerStats(playerId)
  if (!playerStats) return errorResult('start_battle', 'Could not load your stats.')

  // Bug fix #5: prevent dead players from initiating combat
  if (playerStats.hp <= 0) return errorResult('start_battle', 'You cannot fight while dead.')

  const equippedWeaponCategory = await fetchEquippedWeaponCategory(playerId)
  const battleState = new BattleState({ playerId, roomId: roomState.roomId, enemy, playerStats, equippedWeaponCategory })
  roomState.activeBattles.set(playerId, battleState)

  await prisma.user.update({ where: { id: playerId }, data: { inFight: true } })
  roomState.touchActivity()

  // ─── Resolve first turn immediately ──────────────────────────────────────
  const isAdvantageTurn = enemy.isAggressive && isAutoInitiated
  const otherCombatants = getOtherCombatantCount(roomState, playerId)

  let firstTurn
  if (isAdvantageTurn) {
    // Enemy gets a free hit — player was entering the room, no counter-attack
    const enemyAtk = resolveEnemyAttack(battleState, otherCombatants)
    firstTurn = {
      playerDealtDamage: 0,
      enemyDealtDamage: enemyAtk.enemyFinal,
      playerRaw: null,
      enemyRaw: enemyAtk.enemyRaw,
      enemyBlocked: 0,
      playerBlocked: enemyAtk.playerBlock,
      playerStrMax: Math.floor(battleState.baseStr * (1 + otherCombatants * 0.1)),
      playerDefMax: enemyAtk.effectiveDef,
      enemyStrMax: enemy.att,
      multiplayerBonus: otherCombatants > 0,
      bonusPercent: otherCombatants * 10,
      missedFlyingMelee: false,
      weaponCategory: battleState.equippedWeaponCategory,
      enemyDamageType: enemyAtk.enemyDamageType,
    }
    battleState.recordTurn(0, enemyAtk.enemyFinal, otherCombatants > 0, firstTurn)
  } else {
    // Player-initiated — normal full turn
    firstTurn = resolveTurn(battleState, otherCombatants)
    battleState.applyDamageToEnemy(firstTurn.playerDealtDamage)
    battleState.recordTurn(firstTurn.playerDealtDamage, firstTurn.enemyDealtDamage, firstTurn.multiplayerBonus, firstTurn)
  }

  battleState.incrementTurn()

  // Apply enemy damage to player HP
  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: { hp: { decrement: firstTurn.enemyDealtDamage } },
    select: { hp: true, hpMax: true },
  })
  const newPlayerHp = Math.max(0, updatedPlayer.hp)

  const snapshot = battleState.getSnapshot()

  const startPayload = {
    ...snapshot,
    // Use the pre-damage enemy HP so the client renders the enemy at full health
    // before the turn animation plays. getSnapshot() reflects post-damage state,
    // which would be 0 on a 1-turn kill and prevent the HP bar drain from showing.
    enemyCurrentHp: snapshot.enemyCurrentHp > 0 ? snapshot.enemyCurrentHp : snapshot.enemyMaxHp,
    enemyIcon: enemy.name,
    enemyLevel: enemy.level,
    enemyAtt: enemy.att,
    enemyDef: enemy.def,
    enemyDescription: enemy.description,
    isAdvantageTurn,
    playerHp: playerStats.hp,
    playerHpMax: playerStats.hpMax,
    playerStr: battleState.baseStr,
    playerDef: battleState.baseDef,
  }

  let attackDesc
  if (isAdvantageTurn) {
    attackDesc = `You enter the area and the ${enemy.name} immediately attacks!`
  } else if (firstTurn.missedFlyingMelee) {
    attackDesc = `Your swing passes through empty air — the ${enemy.name} is out of reach!`
  } else {
    attackDesc = `You strike the ${enemy.name} for ${firstTurn.playerDealtDamage} damage.`
  }
  const defenseDesc = firstTurn.enemyDealtDamage === 0
    ? `The ${enemy.name} attacks but you block it!`
    : `The ${enemy.name} hits you for ${firstTurn.enemyDealtDamage} damage.`

  const turnPayload = {
    ...snapshot,
    playerHp: newPlayerHp,
    playerHpMax: updatedPlayer.hpMax,
    playerDealtDamage: firstTurn.playerDealtDamage,
    enemyDealtDamage: firstTurn.enemyDealtDamage,
    playerRaw: firstTurn.playerRaw,
    enemyRaw: firstTurn.enemyRaw,
    playerBlocked: firstTurn.playerBlocked,
    enemyBlocked: firstTurn.enemyBlocked,
    playerStrMax: firstTurn.playerStrMax,
    playerDefMax: firstTurn.playerDefMax,
    enemyStrMax: firstTurn.enemyStrMax,
    multiplayerBonus: firstTurn.multiplayerBonus,
    bonusPercent: firstTurn.bonusPercent,
    missedFlyingMelee: firstTurn.missedFlyingMelee,
    weaponCategory: firstTurn.weaponCategory,
    enemyDamageType: firstTurn.enemyDamageType,
    message: [attackDesc, defenseDesc].join(' '),
  }

  const playerEvents = [
    { event: 'battle:started', payload: startPayload },
    { event: 'battle:turn', payload: turnPayload },
  ]

  // Victory check (only possible on player-initiated turn)
  let startBattleBackgroundWork
  if (!isAdvantageTurn && battleState.isEnemyDead()) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    roomState.setPlayerGraceTurn(playerId)

    const isFirstKill = (await getPriorKills(playerId, enemy.slug)) === 0
    const rewards = calcBattleWinRewards(battleState, isFirstKill)
    const { xpAwarded, goldAwarded, droppedSlugs } = rewards

    const rewardParts = [`+${xpAwarded} XP`, `+${goldAwarded} Gold`]
    if (droppedSlugs.length > 0) rewardParts.push(`+${droppedSlugs.join(', ')}`)
    playerEvents.push({
      event: 'battle:victory',
      payload: {
        enemyName: enemy.name,
        xpAwarded,
        goldAwarded,
        droppedItems: droppedSlugs,
        lastTurnResult: firstTurn,
        message: `You defeated the ${enemy.name}! ${rewardParts.join('  ')}`,
        clearRoomEnemies: isProbabilistic(roomState.roomId),
        summary: {
          outcome: 'WIN',
          enemyName: enemy.name,
          enemyIcon: enemy.name,
          enemySlug: enemy.slug,
          turnsCount: battleState.turnCount,
          totalDamageDealt: battleState.totalDamageDealt,
          totalDamageReceived: battleState.totalDamageReceived,
          maxSingleHit: battleState.maxSingleHit,
          xpEarned: xpAwarded,
          goldEarned: goldAwarded,
          itemsDropped: droppedSlugs,
          multiplayerBonus: battleState.multiplayerBonusUsed,
          lastTurn: battleState.lastTurnResult,
        },
      },
    })

    startBattleBackgroundWork = persistBattleWin(playerId, battleState, rewards)
      .then(({ levelUp, inventory }) => {
        const events = []
        // Drops are persisted after battle:victory is emitted, so push the refreshed
        // inventory once the grants commit — otherwise the client never sees the items.
        if (inventory) events.push({ event: 'inventory:update', payload: { inventory } })
        if (levelUp?.leveled) events.push({ event: 'player:level-up', payload: levelUp })
        return events
      })
      .catch((err) => {
        console.error(`persistBattleWin failed on turn 1 for player ${playerId}:`, err)
        return []
      })
  } else if (newPlayerHp <= 0) {
    // Defeat check
    battleState.end()
    roomState.activeBattles.delete(playerId)
    try {
      await handleBattleDefeat(playerId, battleState)
    } catch (err) {
      console.error(`handleBattleDefeat failed on turn 1 for player ${playerId}:`, err)
    }
    playerEvents.push({
      event: 'battle:defeat',
      payload: {
        enemyName: enemy.name,
        respawnRoomId: RESPAWN_ROOM_ID,
        playerHp: 1,
        message: `The ${enemy.name} overwhelms you. You black out...`,
        summary: {
          outcome: 'LOSS',
          enemyName: enemy.name,
          enemyIcon: enemy.name,
          enemySlug: enemy.slug,
          turnsCount: battleState.turnCount,
          totalDamageDealt: battleState.totalDamageDealt,
          totalDamageReceived: battleState.totalDamageReceived,
          maxSingleHit: battleState.maxSingleHit,
          xpEarned: 0,
          goldEarned: 0,
          itemsDropped: [],
          multiplayerBonus: battleState.multiplayerBonusUsed,
          lastTurn: battleState.lastTurnResult,
        },
      },
    })
  }

  const broadcastMsg = isAdvantageTurn
    ? `${player.username} is attacked by a ${enemy.name}!`
    : `${player.username} engages a ${enemy.name}!`

  return {
    success: true,
    action: 'start_battle',
    backgroundWork: startBattleBackgroundWork,
    playerEvents,
    broadcastEvents: [
      {
        event: 'action:feedback',
        targetRoomId: roomState.roomId,
        payload: makeFeedback('start_battle', 'info', broadcastMsg),
      },
    ],
  }
}

// ─── player_attack ──────────────────────────────────────────────────────────

async function executePlayerAttack(action, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) return errorResult('player_attack', 'Player not found in this room')

  const battleState = roomState.activeBattles.get(playerId)
  if (!battleState || !battleState.isActive) {
    return errorResult('player_attack', 'You are not in a battle.')
  }

  const [liveStats, liveWeaponCategory] = await Promise.all([
    fetchPlayerStats(playerId),
    fetchEquippedWeaponCategory(playerId),
  ])
  if (!liveStats) return errorResult('player_attack', 'Could not load your stats.')
  battleState.updateStats(liveStats, liveWeaponCategory)

  const otherCombatants = getOtherCombatantCount(roomState, playerId)
  const turnResult = resolveTurn(battleState, otherCombatants)

  battleState.applyDamageToEnemy(turnResult.playerDealtDamage)
  battleState.incrementTurn()
  battleState.recordTurn(turnResult.playerDealtDamage, turnResult.enemyDealtDamage, turnResult.multiplayerBonus, turnResult)

  // Victory check
  if (battleState.isEnemyDead()) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    // 1-turn grace: the next turn action skips the spawn check so the player isn't
    // immediately thrown into another fight without warning.
    roomState.setPlayerGraceTurn(playerId)

    // Compute rewards synchronously — no DB — so we can emit victory immediately.
    // First-kill detection needs the pre-increment kill count, so read it before persisting.
    const isFirstKill = (await getPriorKills(playerId, battleState.enemy.slug)) === 0
    const rewards = calcBattleWinRewards(battleState, isFirstKill)
    const { xpAwarded, goldAwarded, droppedSlugs } = rewards

    const rewardParts = [`+${xpAwarded} XP`, `+${goldAwarded} Gold`]
    if (droppedSlugs.length > 0) rewardParts.push(`+${droppedSlugs.join(', ')}`)
    const winMsg = `You defeated the ${battleState.enemyName}! ${rewardParts.join('  ')}`

    // Fire DB persistence in the background; level-up event emitted via backgroundWork
    const backgroundWork = persistBattleWin(playerId, battleState, rewards)
      .then(({ levelUp, inventory }) => {
        const events = []
        // Drops are persisted after battle:victory is emitted, so push the refreshed
        // inventory once the grants commit — otherwise the client never sees the items.
        if (inventory) events.push({ event: 'inventory:update', payload: { inventory } })
        if (levelUp?.leveled) events.push({ event: 'player:level-up', payload: levelUp })
        return events
      })
      .catch((err) => {
        console.error(`persistBattleWin failed for player ${playerId}:`, err)
        return []
      })

    return {
      success: true,
      action: 'player_attack',
      backgroundWork,
      playerEvents: [
        {
          event: 'battle:victory',
          payload: {
            enemyName: battleState.enemyName,
            xpAwarded,
            goldAwarded,
            droppedItems: droppedSlugs,
            lastTurnResult: turnResult,
            message: winMsg,
            clearRoomEnemies: isProbabilistic(roomState.roomId),
            summary: {
              outcome: 'WIN',
              enemyName: battleState.enemyName,
              enemyIcon: battleState.enemyName,
              enemySlug: battleState.enemySlug,
              turnsCount: battleState.turnCount,
              totalDamageDealt: battleState.totalDamageDealt,
              totalDamageReceived: battleState.totalDamageReceived,
              maxSingleHit: battleState.maxSingleHit,
              xpEarned: xpAwarded,
              goldEarned: goldAwarded,
              itemsDropped: droppedSlugs,
              multiplayerBonus: battleState.multiplayerBonusUsed,
              lastTurn: battleState.lastTurnResult,
            },
          },
        },
      ],
      broadcastEvents: [
        {
          event: 'action:feedback',
          targetRoomId: roomState.roomId,
          payload: makeFeedback('player_attack', 'info', `${player.username} defeated the ${battleState.enemyName}!`),
        },
      ],
    }
  }

  // Bug fix #3: atomic HP decrement — avoids read-modify-write race with concurrent updates
  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: { hp: { decrement: turnResult.enemyDealtDamage } },
    select: { hp: true, hpMax: true },
  })
  const newHp = Math.max(0, updatedPlayer.hp)

  // Death check
  if (newHp <= 0) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    // Player respawns to a different room — clear their enemy slot so it doesn't carry over.
    roomState.clearPlayerEnemyState(playerId)

    try {
      await handleBattleDefeat(playerId, battleState)
    } catch (err) {
      console.error(`handleBattleDefeat failed for player ${playerId}:`, err)
    }

    return {
      success: true,
      action: 'player_attack',
      playerEvents: [
        {
          event: 'battle:defeat',
          payload: {
            enemyName: battleState.enemyName,
            respawnRoomId: RESPAWN_ROOM_ID,
            playerHp: 1,
            message: `The ${battleState.enemyName} overwhelms you. You black out...`,
            summary: {
              outcome: 'LOSS',
              enemyName: battleState.enemyName,
              enemyIcon: battleState.enemyName,
              enemySlug: battleState.enemySlug,
              turnsCount: battleState.turnCount,
              totalDamageDealt: battleState.totalDamageDealt,
              totalDamageReceived: battleState.totalDamageReceived,
              maxSingleHit: battleState.maxSingleHit,
              xpEarned: 0,
              goldEarned: 0,
              itemsDropped: [],
              multiplayerBonus: battleState.multiplayerBonusUsed,
              lastTurn: battleState.lastTurnResult,
            },
          },
        },
      ],
      // Bug fix #4: notify room of defeat
      broadcastEvents: [
        {
          event: 'action:feedback',
          targetRoomId: roomState.roomId,
          payload: makeFeedback('player_attack', 'info', `${player.username} was defeated by the ${battleState.enemyName}...`),
        },
      ],
    }
  }

  // Fight continues
  const snapshot = battleState.getSnapshot()
  const parts = []
  if (turnResult.missedFlyingMelee) {
    parts.push(`Your swing passes through empty air — the ${battleState.enemyName} is out of reach!`)
  } else {
    let strikeMsg = `You strike the ${battleState.enemyName} for ${turnResult.playerDealtDamage} damage.`
    if (turnResult.multiplayerBonus) strikeMsg += ` (+${turnResult.bonusPercent}% group bonus)`
    parts.push(strikeMsg)
  }
  if (turnResult.enemyDealtDamage === 0) {
    parts.push(`The ${battleState.enemyName} attacks but you block it!`)
  } else {
    parts.push(`The ${battleState.enemyName} hits you for ${turnResult.enemyDealtDamage} damage. (HP: ${newHp}/${updatedPlayer.hpMax})`)
  }

  return {
    success: true,
    action: 'player_attack',
    playerEvents: [
      {
        event: 'battle:turn',
        payload: {
          ...snapshot,
          playerHp: newHp,
          playerHpMax: updatedPlayer.hpMax,
          playerDealtDamage: turnResult.playerDealtDamage,
          enemyDealtDamage: turnResult.enemyDealtDamage,
          playerRaw: turnResult.playerRaw,
          enemyRaw: turnResult.enemyRaw,
          playerBlocked: turnResult.playerBlocked,
          enemyBlocked: turnResult.enemyBlocked,
          playerStrMax: turnResult.playerStrMax,
          playerDefMax: turnResult.playerDefMax,
          enemyStrMax: turnResult.enemyStrMax,
          multiplayerBonus: turnResult.multiplayerBonus,
          bonusPercent: turnResult.bonusPercent,
          missedFlyingMelee: turnResult.missedFlyingMelee,
          weaponCategory: turnResult.weaponCategory,
          enemyDamageType: turnResult.enemyDamageType,
          message: parts.join(' '),
        },
      },
    ],
  }
}

// ─── support turn (in-battle use_item / equip_item / unequip_item) ─────────
//
// Player spends their turn on a non-attack action (drink potion, swap weapon).
// The enemy still gets a full counterattack. Returns event(s) the caller appends
// to its own result. If the counterattack drops player HP to 0, the battle ends
// with the standard defeat flow.
async function resolveSupportTurn(playerId, roomState, actionMeta) {
  const battleState = roomState.activeBattles.get(playerId)
  if (!battleState || !battleState.isActive) return { playerEvents: [] }

  const player = roomState.players.get(playerId)
  const playerName = player?.username || 'Player'

  const [liveStats, liveWeaponCategory] = await Promise.all([
    fetchPlayerStats(playerId),
    fetchEquippedWeaponCategory(playerId),
  ])
  if (!liveStats) return { playerEvents: [] }
  battleState.updateStats(liveStats, liveWeaponCategory)

  const otherCombatants = getOtherCombatantCount(roomState, playerId)
  const enemyAtk = resolveEnemyAttack(battleState, otherCombatants)

  battleState.incrementTurn()
  const turnRecord = {
    playerDealtDamage: 0,
    enemyDealtDamage: enemyAtk.enemyFinal,
    playerRaw: null,
    enemyRaw: enemyAtk.enemyRaw,
    enemyBlocked: 0,
    playerBlocked: enemyAtk.playerBlock,
    playerStrMax: null,
    playerDefMax: enemyAtk.effectiveDef,
    enemyStrMax: battleState.enemy.att,
    multiplayerBonus: otherCombatants > 0,
    bonusPercent: otherCombatants * 10,
    missedFlyingMelee: false,
    weaponCategory: battleState.equippedWeaponCategory,
    enemyDamageType: enemyAtk.enemyDamageType,
  }
  battleState.recordTurn(0, enemyAtk.enemyFinal, otherCombatants > 0, turnRecord)

  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: { hp: { decrement: enemyAtk.enemyFinal } },
    select: { hp: true, hpMax: true },
  })
  const newHp = Math.max(0, updatedPlayer.hp)

  // Build the action description string for the battle:turn message.
  const actionDesc = describeSupportAction(actionMeta)
  const defenseDesc = enemyAtk.enemyFinal === 0
    ? `The ${battleState.enemyName} attacks but you block it!`
    : `The ${battleState.enemyName} hits you for ${enemyAtk.enemyFinal} damage.`

  // Defeat path: enemy counterattack killed the player
  if (newHp <= 0) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    roomState.clearPlayerEnemyState(playerId)
    try {
      await handleBattleDefeat(playerId, battleState)
    } catch (err) {
      console.error(`handleBattleDefeat failed during support turn for player ${playerId}:`, err)
    }
    return {
      playerEvents: [
        {
          event: 'battle:defeat',
          payload: {
            enemyName: battleState.enemyName,
            respawnRoomId: RESPAWN_ROOM_ID,
            playerHp: 1,
            message: `The ${battleState.enemyName} overwhelms you. You black out...`,
            summary: {
              outcome: 'LOSS',
              enemyName: battleState.enemyName,
              enemyIcon: battleState.enemyName,
              enemySlug: battleState.enemySlug,
              turnsCount: battleState.turnCount,
              totalDamageDealt: battleState.totalDamageDealt,
              totalDamageReceived: battleState.totalDamageReceived,
              maxSingleHit: battleState.maxSingleHit,
              xpEarned: 0,
              goldEarned: 0,
              itemsDropped: [],
              multiplayerBonus: battleState.multiplayerBonusUsed,
              lastTurn: battleState.lastTurnResult,
            },
          },
        },
      ],
      broadcastEvents: [
        {
          event: 'action:feedback',
          targetRoomId: roomState.roomId,
          payload: makeFeedback(actionMeta.kind, 'info', `${playerName} was defeated by the ${battleState.enemyName}...`),
        },
      ],
    }
  }

  const snapshot = battleState.getSnapshot()
  return {
    playerEvents: [
      {
        event: 'battle:turn',
        payload: {
          ...snapshot,
          playerHp: newHp,
          playerHpMax: updatedPlayer.hpMax,
          playerDealtDamage: 0,
          enemyDealtDamage: enemyAtk.enemyFinal,
          playerRaw: null,
          enemyRaw: enemyAtk.enemyRaw,
          playerBlocked: enemyAtk.playerBlock,
          enemyBlocked: 0,
          playerStrMax: null,
          playerDefMax: enemyAtk.effectiveDef,
          enemyStrMax: battleState.enemy.att,
          multiplayerBonus: otherCombatants > 0,
          bonusPercent: otherCombatants * 10,
          missedFlyingMelee: false,
          weaponCategory: battleState.equippedWeaponCategory,
          enemyDamageType: enemyAtk.enemyDamageType,
          actionMeta,
          message: [actionDesc, defenseDesc].join(' '),
        },
      },
    ],
  }
}

function describeSupportAction(meta) {
  if (!meta) return 'You take a moment.'
  const name = meta.itemName || 'item'
  const effect = meta.effectText ? ` (${meta.effectText})` : ''
  if (meta.kind === 'equip_item') return `You equip the ${name}.`
  if (meta.kind === 'unequip_item') return `You unequip the ${name}.`
  const verb = meta.actionVerb || 'use'
  // Capitalize the verb's past-tense-ish form for "use" → "use the X"
  return `You ${verb} the ${name}${effect}.`
}

// ─── player_flee ─────────────────────────────────────────────────────────────

async function executePlayerFlee(action, playerId, roomState) {
  const battleState = roomState.activeBattles.get(playerId)
  if (!battleState || !battleState.isActive) {
    return errorResult('player_flee', 'You are not in a battle.')
  }

  if (!battleState.canFlee) {
    const turnsLeft = 10 - battleState.turnCount
    return errorResult('player_flee', `You cannot flee yet. Fight for ${turnsLeft} more turn${turnsLeft !== 1 ? 's' : ''}.`)
  }

  battleState.end()
  roomState.activeBattles.delete(playerId)
  await prisma.user.update({ where: { id: playerId }, data: { inFight: false } })

  return {
    success: true,
    action: 'player_flee',
    playerEvents: [
      {
        event: 'battle:fled',
        payload: { message: 'You managed to escape!' },
      },
    ],
  }
}

module.exports = { executeStartBattle, executePlayerAttack, executePlayerFlee, resolveSupportTurn }
