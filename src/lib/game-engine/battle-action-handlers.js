const { prisma } = require('../db-client')
const { BattleState } = require('./battle-state')
const { resolveTurn, resolveEnemyAttack, getOtherCombatantCount, totalDamageToEnemy } = require('./battle-calculator')
const { calcBattleWinRewards, getOwnedFirstKillSlugs, persistBattleWin, handleBattleWin, handleBattleDefeat } = require('./battle-win-handler')
const { getEnemy } = require('../game-data/enemies')
const { isProbabilistic } = require('../game-data/room-enemies')
const { getRoomEnemies } = require('../game-data/room-enemies')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')
const { grantTeleport } = require('./teleport-grants')

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

/**
 * Persist a win in the background and turn the outcome into client events.
 *
 * `battle:victory` is emitted before this settles — the client is already
 * showing the spoils — so success pushes the refreshed inventory and any
 * level-up, and failure says so plainly instead of leaving a victory screen
 * standing for rewards that were never saved. The writes are one transaction,
 * so "nothing was awarded" is the literal truth when this rejects.
 */
function settleBattleWinPersistence(playerId, battleState, rewards) {
  return persistBattleWin(playerId, battleState, rewards)
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
      return [
        {
          event: 'action:feedback',
          payload: makeFeedback(
            'battle_rewards',
            'failure',
            'Your rewards from that fight could not be saved, so nothing was awarded. Please refresh before fighting again.'
          ),
        },
      ]
    })
}

/**
 * Tear down a lost battle and build the defeat event.
 *
 * Defeat can arrive from three places — the opening ambush turn, an ordinary
 * attack turn, and a support turn — and every one of them must leave the same
 * state behind. Keeping them as three hand-maintained copies is exactly how the
 * opening-turn path drifted: it never cleared the player's enemy roster, so the
 * hostile that had just killed them stayed in the room, and the respawn move was
 * then refused with "you cannot leave while hostile enemies are here". The
 * player sat at 1 HP in the room that killed them while the database already
 * said they were in the respawn room — recoverable only by refreshing.
 */
async function resolveBattleDefeat(playerId, roomState, battleState, enemyName, enemySlug) {
  battleState.end()
  roomState.activeBattles.delete(playerId)
  // The player respawns elsewhere: clear the enemy slot so the wave does not
  // carry over, and so nothing blocks the move out of this room.
  roomState.clearPlayerEnemyState(playerId)

  let buffs = null
  try {
    ;({ buffs } = await handleBattleDefeat(playerId, battleState))
  } catch (err) {
    console.error(`handleBattleDefeat failed for player ${playerId}:`, err)
  }

  // Dead is HP 0, in the database and in the live room alike. The player lies
  // where they fell with the death card open until they choose to rise; only
  // arriving in the Plane of Rebirth brings them back to 1 HP.
  roomState.updatePlayer(playerId, (state) => ({ ...state, hp: 0 }))

  return {
    event: 'battle:defeat',
    payload: {
      enemyName,
      respawnRoomId: RESPAWN_ROOM_ID,
      playerHp: 0,
      buffs,
      message: `The ${enemyName} overwhelms you. You black out...`,
      summary: {
        outcome: 'LOSS',
        enemyName,
        enemyIcon: enemyName,
        enemySlug,
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

// Enemy-side line of a battle:turn message. When a special fired it names itself,
// so the feed states what happened instead of leaving the player to infer it from
// a suspiciously large number.
function describeEnemyAttack(enemyName, damage, enemyAction, hpSuffix = '', dodged = false) {
  // The Dodge skill: the whole swing, special or not, came to nothing.
  if (dodged) {
    const what = enemyAction ? enemyAction.name.toUpperCase() : 'attack'
    return `You DODGE the ${enemyName}'s ${what}!${hpSuffix}`
  }
  if (enemyAction) {
    const label = enemyAction.name.toUpperCase()
    return damage === 0
      ? `The ${enemyName} unleashes a ${label} but you block it!`
      : `The ${enemyName} unleashes a ${label} for ${damage} damage!${hpSuffix}`
  }
  return damage === 0
    ? `The ${enemyName} attacks but you block it!`
    : `The ${enemyName} hits you for ${damage} damage.${hpSuffix}`
}

const { BUFF_SELECT } = require('./services/buff-service')
const { SKILL_SELECT } = require('./services/skill-service')
const { isShieldItem } = require('../game-data/skills')
const { weaponImmunity } = require('./battle-calculator')

// Fetch the stats needed for BattleState from DB. The skill levels ride along
// so the passives (One Handed, Toughness, Dodge, ...) fold in with the buffs.
async function fetchPlayerStats(playerId) {
  return prisma.user.findUnique({
    where: { id: playerId },
    select: { str: true, dex: true, mag: true, def: true, strMod: true, dexMod: true, magMod: true, defMod: true, hp: true, hpMax: true, ...BUFF_SELECT, ...SKILL_SELECT },
  })
}

// Fetch what is in the player's hands, as combat and the skills read it.
//
// `weaponCategory` is 'MELEE' | 'RANGED' | null (null = unarmed).
// `ammoSlug` is the item a shot consumes, declared as `metadata.ammo` on the
// weapon template — bows spend arrows, the crossbow spends bolts. Thrown ranged
// weapons (boomerang, chakram) declare none and never run dry, matching the
// original, which only ever checked ammo for bows and crossbows.
// `isTwoHanded` and `hasShield` are what the proficiencies, Block and the
// Slice/Smash/Aim weapon fit key on.
async function fetchEquippedWeapon(playerId) {
  const hands = await prisma.playerItem.findMany({
    where: { playerId, isEquipped: true, slot: { in: ['MAIN_HAND', 'OFF_HAND'] } },
    select: { slot: true, ItemTemplate: { select: { slug: true, equipSlot: true, weaponCategory: true, metadata: true } } },
  })
  const main = hands.find((row) => row.slot === 'MAIN_HAND')
  const off = hands.find((row) => row.slot === 'OFF_HAND')
  const template = main?.ItemTemplate
  const metadata = (template?.metadata && typeof template.metadata === 'object') ? template.metadata : null
  return {
    weaponCategory: template?.weaponCategory || null,
    ammoSlug: typeof metadata?.ammo === 'string' ? metadata.ammo : null,
    isTwoHanded: metadata?.isTwoHanded === true,
    hasShield: isShieldItem(off?.ItemTemplate),
  }
}

// Whether a skill strike's bonus can land at all. A bare melee swing cannot
// reach a flying enemy (a Magic Strike can — it is projectile magic), and a
// weapon the enemy shrugs off carries no bonus with it. When it cannot land
// the strike is dropped before anything is charged and the swing goes in as a
// plain attack, the way the original's flying check ran before the MP was spent.
function skillCanLand(skill, enemy, weaponCategory) {
  const cat = weaponCategory || 'MELEE'
  if (enemy.isFlying && cat === 'MELEE' && !skill.def.magic) return false
  if (weaponImmunity(enemy, cat)) return false
  return true
}

// The equipped COMPANION, if any, as the shape the calculator swings with:
// `{ name, damageMin, damageMax }` from the template's `metadata.companion`.
// Null when the slot is empty or the template declares no roll.
async function fetchEquippedCompanion(playerId) {
  const item = await prisma.playerItem.findFirst({
    where: { playerId, isEquipped: true, slot: 'COMPANION' },
    select: { ItemTemplate: { select: { name: true, metadata: true } } },
  })
  const metadata = item?.ItemTemplate?.metadata
  const roll = metadata && typeof metadata === 'object' ? metadata.companion : null
  if (!roll || typeof roll.damageMin !== 'number' || typeof roll.damageMax !== 'number') return null
  return { name: item.ItemTemplate.name, damageMin: roll.damageMin, damageMax: roll.damageMax }
}

// The player's ammo stack for a slug: its row id, count, and display name in a
// single query. Returns null when they hold none. Combat runs this on every
// ranged swing, so it stays one round trip.
async function readAmmo(playerId, ammoSlug) {
  const row = await prisma.playerItem.findFirst({
    where: { playerId, ItemTemplate: { slug: ammoSlug } },
    select: { id: true, quantity: true, ItemTemplate: { select: { name: true } } },
  })
  if (!row) return null
  return { id: row.id, remaining: row.quantity ?? 0, name: row.ItemTemplate?.name || ammoSlug }
}

// Fallback display name for the "you're out" message, used only when the player
// holds no stack at all (so readAmmo returned null) — an uncommon path.
async function ammoDisplayName(ammoSlug) {
  const template = await prisma.itemTemplate.findFirst({
    where: { slug: ammoSlug },
    select: { name: true },
  })
  return template?.name || ammoSlug
}

// Spend one round for a shot that resolved. Returns the count left (so the turn
// can report it, the way the original showed "N arrows left") plus the refreshed
// inventory, which the caller pushes so the inventory panel doesn't go stale
// mid-fight.
async function consumeAmmo(playerId, ammo) {
  const remaining = Math.max(0, ammo.remaining - 1)
  if (remaining <= 0) {
    await prisma.playerItem.delete({ where: { id: ammo.id } })
  } else {
    await prisma.playerItem.update({ where: { id: ammo.id }, data: { quantity: remaining } })
  }
  const { getPlayerInventory } = require('./services/inventory-service')
  return { remaining, inventory: await getPlayerInventory(playerId) }
}

// Pay for a spell before it is rolled. One guarded UPDATE: it lands only while
// the player still has the MP, so two casts in flight cannot both spend the
// same points. Returns the new vitals, or null when the MP was not there.
async function chargeSpellMp(playerId, spell) {
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "User" SET mp = mp - $2 WHERE id = $1 AND mp >= $2 RETURNING mp, "mpMax"`,
    playerId,
    spell.cost
  )
  const row = rows[0]
  return row ? { mp: Number(row.mp), mpMax: Number(row.mpMax) } : null
}

function notEnoughMpMessage(spell, verb = 'cast') {
  return `You don't have enough MP to ${verb} ${spell.def.name}! It costs ${spell.cost} MP.`
}

// Player-side line of a battle:turn message for a skill strike — a swing with
// a bonus on it. A Magic Strike on a magic-immune enemy still cuts, so the
// number stands; only the magic (and its MP) came to nothing.
function describeSkillStrike(enemyName, turn, extra = '') {
  const use = turn.skill
  const cost = turn.immuneToMagic ? 'no MP spent' : `${use.cost} MP`
  const note = turn.immuneToMagic ? ` The ${enemyName} is immune to magic — the strike's magic fizzles.` : ''
  return `You ${use.name} the ${enemyName} for ${turn.playerDealtDamage} damage (${cost}).${extra}${note}`
}

// Player-side line of a battle:turn message for a weapon strike, covering the
// three ways a swing can come to nothing: an airborne enemy, an enemy the
// weapon cannot hurt, and an ordinary hit. The companion's swing, when there
// is one, is reported on its own line so the two numbers stay separate.
function describeWeaponStrike(enemyName, turn, extra = '') {
  if (turn.missedFlyingMelee) {
    return `Your swing passes through empty air — the ${enemyName} is out of reach!`
  }
  if (turn.immuneToWeapon === 'RANGED') {
    return `Your shot glances off the ${enemyName} — it cannot be hit at range!`
  }
  if (turn.immuneToWeapon === 'MELEE') {
    return `Your blade bounces off the ${enemyName} — it cannot be cut!`
  }
  return `You strike the ${enemyName} for ${turn.playerDealtDamage} damage.${extra}`
}

function describeCompanionStrike(enemyName, companion) {
  if (!companion) return ''
  return companion.damage === 0
    ? ` Your ${companion.name} swings at the ${enemyName} but is blocked.`
    : ` Your ${companion.name} hits the ${enemyName} for ${companion.damage} damage.`
}

// Player-side line of a battle:turn message for a spell strike.
function describeSpellStrike(enemyName, turn) {
  const cast = turn.spell
  if (turn.immuneToMagic) {
    return `The ${enemyName} is immune to magic! Your ${cast.name} fizzles.`
  }
  return `You cast ${cast.name} for ${cast.cost} MP and hit the ${enemyName} for ${turn.playerDealtDamage} damage.`
}

// ─── start_battle ───────────────────────────────────────────────────────────

/**
 * A static room's `challenge` (game-data/room-enemies.js): the quests that must
 * all be turned in before its boss can be fought. Data on the spawn table,
 * evaluated here, so the rule lives beside the roster it protects and no path
 * into a fight skips it.
 */
async function meetsChallenge(playerId, challenge) {
  const questIds = challenge?.requiresCompletedQuests ?? []
  if (questIds.length === 0) return true
  const done = await prisma.questProgress.count({
    where: { userId: playerId, completed: true, questId: { in: questIds } },
  })
  return done >= questIds.length
}

async function executeStartBattle(action, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) return errorResult('start_battle', 'Player not found in this room')

  if (roomState.activeBattles.has(playerId)) {
    return errorResult('start_battle', 'You are already in a battle.')
  }

  // `spell` — { def, level, cost }, built server-side by room-state's
  // cast_spell — opens the fight with a spell instead of a weapon strike.
  // `skill` — the same shape from use_skill — opens it with a Slice, Smash,
  // Aim or Magic Strike: a weapon swing with the skill's bonus on it.
  const { enemySlug, isAutoInitiated = false, spell = null, skill = null } = action.data || {}
  if (!enemySlug) return errorResult('start_battle', 'No enemy specified.')

  if (isProbabilistic(roomState.roomId)) {
    const present = roomState.getPlayerEnemyRoster(playerId)
    if (!present.includes(enemySlug)) {
      return errorResult('start_battle', 'That enemy is not here.')
    }
  } else {
    const roomConfig = getRoomEnemies(roomState.roomId)
    if (!roomConfig || !roomConfig.enemies.includes(enemySlug)) {
      return errorResult('start_battle', 'That enemy is not here.')
    }
    // A boss that stands in plain sight but will not be fought until the
    // player has earned it — the Master Temple's Guardian behind its four
    // tests. Declared on the room's spawn table so the rule lives beside the
    // roster it protects, and checked here so no path into a fight skips it.
    if (roomConfig.challenge && !(await meetsChallenge(playerId, roomConfig.challenge))) {
      return errorResult('start_battle', roomConfig.challenge.message || 'You cannot fight that yet.')
    }
  }

  const enemy = getEnemy(enemySlug)
  if (!enemy) return errorResult('start_battle', 'Unknown enemy.')

  const playerStats = await fetchPlayerStats(playerId)
  if (!playerStats) return errorResult('start_battle', 'Could not load your stats.')

  // Bug fix #5: prevent dead players from initiating combat
  if (playerStats.hp <= 0) return errorResult('start_battle', 'You cannot fight while dead.')

  const [equippedWeapon, companion] = await Promise.all([fetchEquippedWeapon(playerId), fetchEquippedCompanion(playerId)])
  const { weaponCategory: equippedWeaponCategory, ammoSlug } = equippedWeapon

  // Engaging with an empty quiver: refuse before the battle exists rather than
  // opening one the player cannot act in. An aggressive enemy that jumps you
  // (isAutoInitiated) still starts a battle — it attacks regardless of your ammo.
  const isAdvantageTurn = enemy.isAggressive && isAutoInitiated
  // A spell fires no shot, so it spends no ammo — an empty quiver does not stop a Fireball.
  let ammo = null
  if (ammoSlug && !isAdvantageTurn && !spell) {
    ammo = await readAmmo(playerId, ammoSlug)
    if (!ammo || ammo.remaining <= 0) {
      const name = ammo?.name || (await ammoDisplayName(ammoSlug))
      return errorResult('start_battle', `You're out of ${name}s! Equip another weapon.`)
    }
  }

  // A spell is paid for before the fight exists, so a cast the player cannot
  // afford is refused outright rather than opening a battle they never struck
  // in. A magic-immune enemy is never charged — the cast does nothing, and the
  // original spent no MP on it either.
  let spellMp = null
  if (spell && !isAdvantageTurn && !enemy.isMagicImmune) {
    spellMp = await chargeSpellMp(playerId, spell)
    if (!spellMp) return errorResult('start_battle', notEnoughMpMessage(spell))
    roomState.updatePlayer(playerId, (state) => ({ ...state, mp: spellMp.mp }))
  }

  // A skill strike is paid for the same way. The MP buys the bonus, so when the
  // bonus cannot land the strike is dropped and nothing is charged: a Slice at
  // something airborne is a plain missed swing, and a Magic Strike on a
  // magic-immune enemy keeps its record (the panel says it fizzled) but costs
  // nothing, like a spell.
  let strike = skill && !isAdvantageTurn && skillCanLand(skill, enemy, equippedWeaponCategory) ? skill : null
  let skillMp = null
  if (strike && !(strike.def.magic && enemy.isMagicImmune)) {
    skillMp = await chargeSpellMp(playerId, strike)
    if (!skillMp) return errorResult('start_battle', notEnoughMpMessage(strike, 'use'))
    roomState.updatePlayer(playerId, (state) => ({ ...state, mp: skillMp.mp }))
  }

  const battleState = new BattleState({ playerId, roomId: roomState.roomId, enemy, playerStats, equippedWeaponCategory, companion, gear: equippedWeapon })
  roomState.activeBattles.set(playerId, battleState)

  await prisma.user.update({ where: { id: playerId }, data: { inFight: true } })
  roomState.touchActivity()

  // ─── Resolve first turn immediately ──────────────────────────────────────
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
      // An ambush swing is a normal enemy attack, so it can roll a special too.
      enemyAction: enemyAtk.enemyAction,
      spell: null,
      skill: null,
      immuneToMagic: false,
      immuneToWeapon: null,
      companion: null,
      playerDodged: enemyAtk.dodged,
    }
    battleState.recordTurn(0, enemyAtk.enemyFinal, otherCombatants > 0, firstTurn)
  } else {
    // Player-initiated — normal full turn, or the spell or skill that opened
    // the fight. The companion's swing lands beside the player's own.
    firstTurn = resolveTurn(battleState, otherCombatants, { spell, skill: strike })
    battleState.applyDamageToEnemy(totalDamageToEnemy(firstTurn))
    battleState.recordTurn(totalDamageToEnemy(firstTurn), firstTurn.enemyDealtDamage, firstTurn.multiplayerBonus, firstTurn)
  }

  battleState.incrementTurn()

  // The opening shot spends a round. Only a player-initiated turn fires — an
  // advantage turn is the enemy's swing, not yours.
  let ammoRemaining = null
  let ammoInventory = null
  if (ammo) {
    ;({ remaining: ammoRemaining, inventory: ammoInventory } = await consumeAmmo(playerId, ammo))
  }

  // Apply enemy damage to player HP
  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: { hp: { decrement: firstTurn.enemyDealtDamage } },
    select: { hp: true, hpMax: true },
  })
  const newPlayerHp = Math.max(0, updatedPlayer.hp)
  // Mirror the new HP into the in-memory room state so non-battle reads (e.g. rest)
  // don't operate on a stale, pre-damage value.
  roomState.updatePlayer(playerId, (state) => ({ ...state, hp: newPlayerHp }))

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
  } else if (firstTurn.spell) {
    attackDesc = describeSpellStrike(enemy.name, firstTurn) + describeCompanionStrike(enemy.name, firstTurn.companion)
  } else if (firstTurn.skill) {
    attackDesc = describeSkillStrike(enemy.name, firstTurn) + describeCompanionStrike(enemy.name, firstTurn.companion)
  } else {
    attackDesc = describeWeaponStrike(enemy.name, firstTurn) + describeCompanionStrike(enemy.name, firstTurn.companion)
  }
  const defenseDesc = describeEnemyAttack(enemy.name, firstTurn.enemyDealtDamage, firstTurn.enemyAction, '', firstTurn.playerDodged)

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
    enemyAction: firstTurn.enemyAction ?? null,
    spell: firstTurn.spell ?? null,
    skill: firstTurn.skill ?? null,
    immuneToMagic: firstTurn.immuneToMagic ?? false,
    immuneToWeapon: firstTurn.immuneToWeapon ?? null,
    companion: firstTurn.companion ?? null,
    playerDodged: firstTurn.playerDodged ?? false,
    ...(spellMp ? { playerMp: spellMp.mp, playerMpMax: spellMp.mpMax } : {}),
    ...(skillMp ? { playerMp: skillMp.mp, playerMpMax: skillMp.mpMax } : {}),
    ...(ammoSlug && !spell ? { ammo: { slug: ammoSlug, remaining: ammoRemaining } } : {}),
    message: [attackDesc, defenseDesc].join(' '),
  }

  const playerEvents = [
    { event: 'battle:started', payload: startPayload },
    { event: 'battle:turn', payload: turnPayload },
    // Spending a round changes inventory — push it so the panel's arrow count
    // tracks the fight instead of going stale until the next refresh.
    ...(ammoInventory ? [{ event: 'inventory:update', payload: { inventory: ammoInventory } }] : []),
  ]

  // Victory check (only possible on player-initiated turn)
  let startBattleBackgroundWork
  if (!isAdvantageTurn && battleState.isEnemyDead()) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    // Remove the defeated enemy from the present set; any others remain (no grace).
    // Only fully clear the room display when none are left.
    let remainingCount = 0
    let remainingEnemies = []
    if (isProbabilistic(roomState.roomId)) {
      remainingCount = roomState.removeEnemyFromRoster(playerId, enemySlug)
      remainingEnemies = roomState.buildEnemyList(roomState.getPlayerEnemyRoster(playerId))
    }

    const ownedFirstKillSlugs = await getOwnedFirstKillSlugs(playerId, enemy)
    const rewards = calcBattleWinRewards(battleState, ownedFirstKillSlugs)
    const { xpAwarded, goldAwarded, droppedSlugs, dropDetails } = rewards

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
        ...(spellMp ? { playerMp: spellMp.mp, playerMpMax: spellMp.mpMax } : {}),
    ...(skillMp ? { playerMp: skillMp.mp, playerMpMax: skillMp.mpMax } : {}),
        message: `You defeated the ${enemy.name}! ${rewardParts.join('  ')}`,
        clearRoomEnemies: isProbabilistic(roomState.roomId) && remainingCount === 0,
        remainingEnemies,
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
          dropDetails,
          multiplayerBonus: battleState.multiplayerBonusUsed,
          lastTurn: battleState.lastTurnResult,
        },
      },
    })

    startBattleBackgroundWork = settleBattleWinPersistence(playerId, battleState, rewards)
  } else if (newPlayerHp <= 0) {
    // Defeat check — an ambush that killed on the opening turn.
    playerEvents.push(
      await resolveBattleDefeat(playerId, roomState, battleState, enemy.name, enemy.slug)
    )
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

  // `spell` — { def, level, cost }, built server-side by room-state's
  // cast_spell — makes this turn a spell strike instead of a weapon swing.
  // `skill` — the same shape from use_skill — puts a Slice, Smash, Aim or
  // Magic Strike bonus on this turn's swing.
  const spell = action?.data?.spell ?? null
  const skill = action?.data?.skill ?? null

  const [liveStats, liveWeapon, liveCompanion] = await Promise.all([
    fetchPlayerStats(playerId),
    fetchEquippedWeapon(playerId),
    fetchEquippedCompanion(playerId),
  ])
  if (!liveStats) return errorResult('player_attack', 'Could not load your stats.')
  battleState.updateStats(liveStats, liveWeapon, liveCompanion)

  // Out of ammo: reject the shot without advancing the battle. The enemy does
  // NOT get a free counterattack — matching the original, and leaving the player
  // their turn to equip something else (which does cost a turn) instead of being
  // beaten to death unable to act. A spell fires no shot, so it never runs dry.
  const { ammoSlug } = liveWeapon
  let ammo = null
  if (ammoSlug && !spell) {
    ammo = await readAmmo(playerId, ammoSlug)
    if (!ammo || ammo.remaining <= 0) {
      const name = ammo?.name || (await ammoDisplayName(ammoSlug))
      return errorResult('player_attack', `You're out of ${name}s! Equip another weapon.`)
    }
  }

  // Not enough MP is treated like an empty quiver: the cast is refused and the
  // battle does not advance. (The original let the enemy swing anyway — a
  // mis-click cost you a turn — which is treated here as a defect, not canon.)
  // A magic-immune enemy is never charged: nothing is rolled, nothing is spent.
  let spellMp = null
  if (spell && !battleState.enemy.isMagicImmune) {
    spellMp = await chargeSpellMp(playerId, spell)
    if (!spellMp) return errorResult('player_attack', notEnoughMpMessage(spell))
    roomState.updatePlayer(playerId, (state) => ({ ...state, mp: spellMp.mp }))
  }

  // A skill strike pays the same way, and only when its bonus can land (see
  // skillCanLand). A Magic Strike on a magic-immune enemy keeps its record but
  // is never charged.
  const strike = skill && skillCanLand(skill, battleState.enemy, liveWeapon.weaponCategory) ? skill : null
  let skillMp = null
  if (strike && !(strike.def.magic && battleState.enemy.isMagicImmune)) {
    skillMp = await chargeSpellMp(playerId, strike)
    if (!skillMp) return errorResult('player_attack', notEnoughMpMessage(strike, 'use'))
    roomState.updatePlayer(playerId, (state) => ({ ...state, mp: skillMp.mp }))
  }

  const otherCombatants = getOtherCombatantCount(roomState, playerId)
  const turnResult = resolveTurn(battleState, otherCombatants, { spell, skill: strike })

  // The shot resolved — spend the round.
  let ammoRemaining = null
  let ammoInventory = null
  if (ammo) {
    ;({ remaining: ammoRemaining, inventory: ammoInventory } = await consumeAmmo(playerId, ammo))
  }

  battleState.applyDamageToEnemy(totalDamageToEnemy(turnResult))
  battleState.incrementTurn()
  battleState.recordTurn(totalDamageToEnemy(turnResult), turnResult.enemyDealtDamage, turnResult.multiplayerBonus, turnResult)

  // Victory check
  if (battleState.isEnemyDead()) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    // Remove the defeated enemy from the present set; any others remain (no grace —
    // the next turn action can immediately provoke another enemy).
    let remainingCount = 0
    let remainingEnemies = []
    if (isProbabilistic(roomState.roomId)) {
      remainingCount = roomState.removeEnemyFromRoster(playerId, battleState.enemySlug)
      remainingEnemies = roomState.buildEnemyList(roomState.getPlayerEnemyRoster(playerId))
    }

    // Compute rewards synchronously — no DB — so we can emit victory immediately.
    // firstKill drops are gated on current ownership, so read what the player already holds first.
    const ownedFirstKillSlugs = await getOwnedFirstKillSlugs(playerId, battleState.enemy)
    const rewards = calcBattleWinRewards(battleState, ownedFirstKillSlugs)
    const { xpAwarded, goldAwarded, droppedSlugs, dropDetails } = rewards

    const rewardParts = [`+${xpAwarded} XP`, `+${goldAwarded} Gold`]
    if (droppedSlugs.length > 0) rewardParts.push(`+${droppedSlugs.join(', ')}`)
    const finalBlow = turnResult.spell
      ? `Your ${turnResult.spell.name} finishes it. `
      : turnResult.skill
        ? `Your ${turnResult.skill.name} finishes it. `
        : ''
    const winMsg = `${finalBlow}You defeated the ${battleState.enemyName}! ${rewardParts.join('  ')}`

    // Fire DB persistence in the background; level-up event emitted via backgroundWork
    const backgroundWork = settleBattleWinPersistence(playerId, battleState, rewards)

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
            ...(spellMp ? { playerMp: spellMp.mp, playerMpMax: spellMp.mpMax } : {}),
    ...(skillMp ? { playerMp: skillMp.mp, playerMpMax: skillMp.mpMax } : {}),
            message: winMsg,
            clearRoomEnemies: isProbabilistic(roomState.roomId) && remainingCount === 0,
            remainingEnemies,
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
              dropDetails,
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
  // Mirror the new HP into the in-memory room state so non-battle reads (e.g. rest)
  // don't operate on a stale, pre-damage value.
  roomState.updatePlayer(playerId, (state) => ({ ...state, hp: newHp }))

  // Death check
  if (newHp <= 0) {
    return {
      success: true,
      action: 'player_attack',
      playerEvents: [
        await resolveBattleDefeat(
          playerId,
          roomState,
          battleState,
          battleState.enemyName,
          battleState.enemySlug
        ),
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
  if (turnResult.spell) {
    parts.push(describeSpellStrike(battleState.enemyName, turnResult))
  } else {
    let extra = ''
    if (turnResult.multiplayerBonus) extra += ` (+${turnResult.bonusPercent}% group bonus)`
    if (ammoRemaining !== null) extra += ` (${ammoRemaining} left)`
    parts.push(
      turnResult.skill
        ? describeSkillStrike(battleState.enemyName, turnResult, extra)
        : describeWeaponStrike(battleState.enemyName, turnResult, extra)
    )
  }
  if (turnResult.companion) parts.push(describeCompanionStrike(battleState.enemyName, turnResult.companion).trim())
  parts.push(
    describeEnemyAttack(
      battleState.enemyName,
      turnResult.enemyDealtDamage,
      turnResult.enemyAction,
      ` (HP: ${newHp}/${updatedPlayer.hpMax})`,
      turnResult.playerDodged
    )
  )

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
          enemyAction: turnResult.enemyAction ?? null,
          spell: turnResult.spell ?? null,
          skill: turnResult.skill ?? null,
          immuneToMagic: turnResult.immuneToMagic ?? false,
          immuneToWeapon: turnResult.immuneToWeapon ?? null,
          companion: turnResult.companion ?? null,
          playerDodged: turnResult.playerDodged ?? false,
          ...(spellMp ? { playerMp: spellMp.mp, playerMpMax: spellMp.mpMax } : {}),
    ...(skillMp ? { playerMp: skillMp.mp, playerMpMax: skillMp.mpMax } : {}),
          ...(ammoSlug && !spell ? { ammo: { slug: ammoSlug, remaining: ammoRemaining } } : {}),
          message: parts.join(' '),
        },
      },
      // Spending a round changes inventory — keep the panel's count live.
      ...(ammoInventory ? [{ event: 'inventory:update', payload: { inventory: ammoInventory } }] : []),
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

  const [liveStats, liveWeapon, liveCompanion] = await Promise.all([
    fetchPlayerStats(playerId),
    fetchEquippedWeapon(playerId),
    fetchEquippedCompanion(playerId),
  ])
  if (!liveStats) return { playerEvents: [] }
  // A support turn (potion, weapon swap) fires no shot, so it spends no ammo —
  // and the companion waits with you rather than swinging on its own.
  battleState.updateStats(liveStats, liveWeapon, liveCompanion)

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
    // Spending the turn on a potion or a weapon swap doesn't shield you from a
    // special — the counterattack rolls exactly like any other enemy attack.
    enemyAction: enemyAtk.enemyAction,
    spell: null,
    skill: null,
    immuneToMagic: false,
    immuneToWeapon: null,
    companion: null,
    playerDodged: enemyAtk.dodged,
  }
  battleState.recordTurn(0, enemyAtk.enemyFinal, otherCombatants > 0, turnRecord)

  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: { hp: { decrement: enemyAtk.enemyFinal } },
    select: { hp: true, hpMax: true },
  })
  const newHp = Math.max(0, updatedPlayer.hp)
  // Mirror the new HP into the in-memory room state so non-battle reads (e.g. rest)
  // don't operate on a stale, pre-damage value.
  roomState.updatePlayer(playerId, (state) => ({ ...state, hp: newHp }))

  // Build the action description string for the battle:turn message.
  const actionDesc = describeSupportAction(actionMeta)
  const defenseDesc = describeEnemyAttack(battleState.enemyName, enemyAtk.enemyFinal, enemyAtk.enemyAction, '', enemyAtk.dodged)

  // Defeat path: enemy counterattack killed the player
  if (newHp <= 0) {
    return {
      playerEvents: [
        await resolveBattleDefeat(
          playerId,
          roomState,
          battleState,
          battleState.enemyName,
          battleState.enemySlug
        ),
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
          enemyAction: enemyAtk.enemyAction ?? null,
          skill: null,
          playerDodged: enemyAtk.dodged ?? false,
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
  if (meta.kind === 'cast_spell') return `You cast ${name}${effect}.`
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
    const turnsLeft = 3 - battleState.turnCount
    return errorResult('player_flee', `You cannot retreat yet. Fight for ${turnsLeft} more turn${turnsLeft !== 1 ? 's' : ''}.`)
  }

  battleState.end()
  roomState.activeBattles.delete(playerId)
  // Fleeing abandons the room's enemies entirely: clear the roster so the retreat
  // move isn't blocked by the "can't leave while hostiles are here" rule, and so a
  // fresh wave rolls if the player ever returns.
  roomState.clearPlayerEnemyState(playerId)
  await prisma.user.update({ where: { id: playerId }, data: { inFight: false } })

  // The player retreats to the room they came from. The socket layer tracks each
  // player's previous room and passes it in; null when there's no prior room (the
  // client then simply stays put after escaping).
  const returnRoomId = action?.data?.returnRoomId ?? null

  // The retreat itself is performed by the client teleporting to this room, so
  // authorize that one destination. `returnRoomId` comes from the socket layer's
  // record of the player's previous room, not from the client.
  if (returnRoomId) {
    grantTeleport(playerId, returnRoomId)
  }

  return {
    success: true,
    action: 'player_flee',
    playerEvents: [
      {
        event: 'battle:fled',
        payload: { message: 'You managed to escape!', returnRoomId },
      },
    ],
  }
}

module.exports = {
  executeStartBattle,
  executePlayerAttack,
  executePlayerFlee,
  resolveSupportTurn,
  // What is in the player's hands, for use_skill's weapon-fit check before a
  // strike is even attempted.
  fetchEquippedWeapon,
  // Exported so the shared defeat teardown can be exercised directly: the bug it
  // fixes (a roster left behind, blocking the respawn move) is invisible from
  // the outside until a player is already stuck.
  resolveBattleDefeat,
}
