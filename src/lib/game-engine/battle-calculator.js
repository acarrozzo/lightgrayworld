function rand(a, b) {
  // Tolerate inverted ranges — a negative stat makes the low bound exceed the high one
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

const partyStore = require('../services/party-store')
const {
  selectEnemySpecial,
  hasSpecial,
  getEnemyBehaviours,
  rollDrain,
  MAX_EXTRA_HITS,
  HEAL_CHANCE_DENOMINATOR,
  STEAL_CHANCE_DENOMINATOR,
} = require('../game-data/enemy-specials')
const { rollSpell } = require('../game-data/spells')
const { rollSkillBonus } = require('../game-data/skills')

// Count other players in the same room who either have an active battle OR are in
// the player's party (party members are pinned to the same room, so presence counts).
function getOtherCombatantCount(roomState, excludePlayerId) {
  const counted = new Set()
  for (const [pid, battle] of roomState.activeBattles.entries()) {
    if (pid !== excludePlayerId && battle.isActive) counted.add(pid)
  }

  const party = partyStore.getParty(excludePlayerId)
  if (party && roomState.players) {
    for (const pid of party.memberIds) {
      if (pid !== excludePlayerId && roomState.players.has(pid)) counted.add(pid)
    }
  }

  return counted.size
}

function pickPlayerOffensiveStat(battleState) {
  const cat = battleState.equippedWeaponCategory || 'MELEE'
  return cat === 'RANGED' ? battleState.baseDex : battleState.baseStr
}

function pickPlayerDefensiveStat(battleState, enemy) {
  const enemyDmgType = enemy.damageType || 'MELEE'
  if (enemyDmgType === 'RANGED') return battleState.baseDex
  if (enemyDmgType === 'MAGIC') return battleState.baseMag
  return battleState.baseDef
}

/**
 * Can this weapon swing reach an airborne enemy? A ranged weapon always can;
 * a melee swing only when the player is airborne too (wings, or a flying
 * mount). A skill strike rides the swing, so it reaches exactly what the
 * weapon reaches — Magic Strike is a sword with magic on it, not a spell, and
 * is melee for this purpose (design decision, 2026-09-28). Spells never come
 * through here: they are projectile magic and always reach. The original's
 * rule: `eFly && !flying && weapontype != ranged && !magiccast` was the miss.
 * Shared by the calculator and the handlers' skill check so the MP refusal
 * and the roll agree.
 * @param {'MELEE'|'RANGED'|null|undefined} weaponCategory
 * @param {boolean} playerFlying
 */
function reachesFlyingEnemy(weaponCategory, playerFlying) {
  const cat = weaponCategory || 'MELEE'
  return cat !== 'MELEE' || Boolean(playerFlying)
}

/** The player-side record of a turn on which nothing was rolled. */
const NOTHING_LANDED = Object.freeze({
  playerRaw: 0,
  enemyBlock: 0,
  playerFinal: 0,
  missedFlyingMelee: false,
  immuneToMagic: false,
  immuneToWeapon: null,
  spell: null,
  skill: null,
  melted: false,
  enemyDodged: false,
  enemyBlockedAttack: false,
  petrified: false,
})

/**
 * Does the enemy slip this attack? Rolled by the handlers before any MP is
 * charged, so a dodged spell or strike costs nothing — the original rolled
 * `eDodge` ahead of the whole attack block. Never while the player is stone
 * (there is nothing to dodge) and never on an ambush turn.
 *
 * Block is the same shape — the whole attack comes to nothing and nothing is
 * spent — so it is rolled here too. Returns 'dodge', 'block' or false; the
 * handlers only care that it is truthy, the turn record says which.
 * @returns {'dodge' | 'block' | false}
 */
function rollEnemyDodge(enemy) {
  const { dodgeChance, blockChance } = getEnemyBehaviours(enemy)
  if (dodgeChance > 0 && rand(1, 100) <= Math.round(dodgeChance * 100)) return 'dodge'
  if (blockChance > 0 && rand(1, 100) <= Math.round(blockChance * 100)) return 'block'
  return false
}

/**
 * The enemy's block against one player attack: rand(0, DEF), or the whole DEF
 * every time for a Pure Defense enemy (the original's ePureD).
 */
function rollEnemyBlock(enemy) {
  return getEnemyBehaviours(enemy).pureDefense ? enemy.def : rand(0, enemy.def)
}

/**
 * The player's strike for one turn.
 *
 * Three shapes share the pipeline. A weapon strike rolls the weapon's stat
 * (STR melee, DEX ranged) and cannot reach a flying enemy unless the player
 * is flying too (see `reachesFlyingEnemy`). A spell — passed as
 * `{ def, level, cost }` — rolls the spell's own formula off effective MAG,
 * reaches flying enemies (the original's "ranged weapon or projectile magic"),
 * and does nothing at all to a magic-immune one. A skill strike — `skill` as
 * `{ def, level, cost }` — is the weapon swing plus the skill's bonus roll:
 * Slice, Smash and Aim add rand(1, lvl); Magic Strike adds a magic roll and,
 * against a magic-immune one, the swing lands but the magic does not. A
 * strike reaches only what its weapon reaches: a Magic Strike behind a sword
 * misses a flyer like the sword would. Either way the enemy answers with a
 * single rand(0, DEF) block and the result floors at zero.
 */
function resolvePlayerAttack(battleState, otherCombatants, { spell = null, skill = null, enemyDodged = false } = {}) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const weaponCat = battleState.equippedWeaponCategory || 'MELEE'

  // Stone swings at nothing. The turn still passes and the enemy still
  // answers; the handlers charge no MP and spend no ammo for it.
  if ((battleState.petrifiedTurns || 0) > 0) {
    return {
      ...NOTHING_LANDED,
      effectiveOff: Math.floor(pickPlayerOffensiveStat(battleState) * bonus),
      weaponCategory: weaponCat,
      petrified: true,
    }
  }

  // The enemy stepped out of it — spell, strike or swing alike. The handlers
  // roll this BEFORE charging MP (`rollEnemyDodge`), so a dodged cast is a
  // free one, as in the original.
  if (enemyDodged) {
    return {
      ...NOTHING_LANDED,
      effectiveOff: spell ? Math.floor(battleState.baseMag * bonus) : Math.floor(pickPlayerOffensiveStat(battleState) * bonus),
      weaponCategory: weaponCat,
      enemyDodged: true,
      enemyBlockedAttack: enemyDodged === 'block',
      spell: spell ? describeSpellCast(spell, null) : null,
    }
  }

  if (spell) {
    const effectiveMag = Math.floor(battleState.baseMag * bonus)
    if (enemy.isMagicImmune) {
      return {
        playerRaw: 0,
        enemyBlock: 0,
        playerFinal: 0,
        effectiveOff: effectiveMag,
        weaponCategory: weaponCat,
        missedFlyingMelee: false,
        immuneToMagic: true,
        immuneToWeapon: null,
        spell: describeSpellCast(spell, null),
      }
    }
    const roll = rollSpell(spell.def, spell.level, effectiveMag, rand)
    const enemyBlock = rollEnemyBlock(enemy)
    return {
      playerRaw: roll.amount,
      enemyBlock,
      playerFinal: Math.max(0, roll.amount - enemyBlock),
      effectiveOff: effectiveMag,
      weaponCategory: weaponCat,
      missedFlyingMelee: false,
      immuneToMagic: false,
      immuneToWeapon: null,
      spell: describeSpellCast(spell, roll),
    }
  }

  const offStat = pickPlayerOffensiveStat(battleState)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveOff = Math.floor(offStat * bonus)

  if (enemy.isFlying && !reachesFlyingEnemy(weaponCat, battleState.isFlying)) {
    return {
      playerRaw: 0,
      enemyBlock: 0,
      playerFinal: 0,
      effectiveOff,
      weaponCategory: weaponCat,
      missedFlyingMelee: true,
      immuneToMagic: false,
      immuneToWeapon: null,
      spell: null,
      skill: null,
    }
  }

  // The original's eStrImm / eDexImm: a blade that bounces off the Troll
  // Queen, an arrow that never finds the Dark Ranger. Nothing is rolled, the
  // way nothing is rolled for a fizzled spell, and the turn says so.
  const immuneToWeapon = weaponImmunity(enemy, weaponCat)
  if (immuneToWeapon) {
    return {
      playerRaw: 0,
      enemyBlock: 0,
      playerFinal: 0,
      effectiveOff,
      weaponCategory: weaponCat,
      missedFlyingMelee: false,
      immuneToMagic: false,
      immuneToWeapon,
      spell: null,
      skill: null,
    }
  }

  // Negative STR rolls negative — it can't heal the enemy, so playerFinal floors at 0 below
  const weaponRaw = rand(0, effectiveOff)
  let playerRaw = weaponRaw
  let skillUse = null
  let immuneToMagic = false
  if (skill) {
    if (skill.def.magic && enemy.isMagicImmune) {
      // The sword still bites; the magic fizzles and (see the handlers) costs nothing.
      immuneToMagic = true
      skillUse = describeSkillUse(skill, null, weaponRaw)
    } else {
      const effectiveMag = Math.floor(battleState.baseMag * bonus)
      const roll = rollSkillBonus(skill.def, skill.level, effectiveMag, rand)
      playerRaw = weaponRaw + roll.amount
      skillUse = describeSkillUse(skill, roll, weaponRaw)
    }
  }
  const enemyBlock = rollEnemyBlock(enemy)
  let playerFinal = Math.max(0, playerRaw - enemyBlock)
  // Melt: the magma takes a melee blow — and the blade — for half. The strike
  // riding the swing is halved with it; a shot or a spell is not.
  const melted = weaponCat !== 'RANGED' && getEnemyBehaviours(enemy).meltsMelee && playerFinal > 0
  if (melted) playerFinal = Math.floor(playerFinal / 2)
  return {
    playerRaw,
    enemyBlock,
    playerFinal,
    effectiveOff,
    weaponCategory: weaponCat,
    missedFlyingMelee: false,
    immuneToMagic,
    immuneToWeapon: null,
    spell: null,
    skill: skillUse,
    melted,
  }
}


/**
 * The client-facing record of a skill strike: what was used, at what level
 * and cost, and the split behind the number — the weapon's own roll and the
 * bonus on top. `roll` is null when a Magic Strike fizzled on a magic-immune
 * enemy (no bonus rolled, nothing charged).
 */
function describeSkillUse(skill, roll, weaponRaw) {
  return {
    id: skill.def.id,
    name: skill.def.name,
    level: skill.level,
    cost: skill.cost,
    icon: skill.def.icon,
    attackIcon: skill.def.attackIcon || skill.def.icon,
    hue: skill.def.hue,
    magic: Boolean(skill.def.magic),
    weaponRaw,
    bonus: roll ? roll.amount : 0,
    bonusMax: roll ? roll.max : 0,
    rolls: roll ? roll.rolls : [],
    text: roll ? `${weaponRaw} + ${roll.amount}` : null,
  }
}

/**
 * Which weapon category, if any, this enemy shrugs off. `isMeleeImmune` and
 * `isRangedImmune` on the definition are the original's eStrImm and eDexImm;
 * magic immunity is its own flag and its own check because a spell is a
 * different pipeline. Returns 'MELEE' | 'RANGED' | null.
 */
function weaponImmunity(enemy, weaponCategory) {
  if (weaponCategory === 'RANGED' && enemy.isRangedImmune) return 'RANGED'
  if (weaponCategory !== 'RANGED' && enemy.isMeleeImmune) return 'MELEE'
  return null
}

/**
 * The companion's swing, on every attack turn the player takes. The original's
 * companion attack exactly: its own small roll, blocked by a tenth of the
 * enemy's DEF, floored at zero, and subtracted from the enemy on top of the
 * player's own hit. Returns null when nothing is equipped in the slot.
 */
function resolveCompanionAttack(battleState) {
  const companion = battleState.companion
  if (!companion) return null
  const roll = rand(companion.damageMin, companion.damageMax)
  const tenth = Math.floor(battleState.enemy.def / 10)
  // Pure Defense holds against the companion too: the original's `enemydef/10`.
  const block = getEnemyBehaviours(battleState.enemy).pureDefense ? tenth : rand(0, tenth)
  return {
    name: companion.name,
    roll,
    block,
    damage: Math.max(0, roll - block),
  }
}

/**
 * The client-facing record of a cast: what was cast, at what level and cost,
 * and the roll behind the number. `roll` is null when the cast fizzled against
 * a magic-immune enemy (nothing was rolled, nothing was charged).
 */
function describeSpellCast(spell, roll) {
  return {
    id: spell.def.id,
    name: spell.def.name,
    level: spell.level,
    cost: spell.cost,
    icon: spell.def.icon,
    attackIcon: spell.def.attackIcon || spell.def.icon,
    hue: spell.def.hue,
    amount: roll ? roll.amount : 0,
    rolls: roll ? roll.rolls : [],
    text: roll ? roll.text : null,
  }
}

/**
 * @param {{ pendingDamage?: number }} [opts] `pendingDamage` is what the
 *   player's side dealt this turn and has not yet been taken off the enemy —
 *   so "is it hurt?" (Heal) reads the HP it will have when its turn comes.
 */
function resolveEnemyAttack(battleState, otherCombatants, { pendingDamage = 0 } = {}) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const enemyDmgType = enemy.damageType || 'MELEE'
  const defStat = pickPlayerDefensiveStat(battleState, enemy)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveDef = Math.floor(defStat * bonus)
  const behaviours = getEnemyBehaviours(enemy)

  // Heal comes first, as it did in the original's chain: a hurt healer spends
  // 1 turn in 4 mending rand(1, ATT) instead of attacking. Nothing else it
  // carries fires on that turn.
  const hpAtItsTurn = battleState.enemyCurrentHp - Math.max(0, pendingDamage)
  if (
    behaviours.heals &&
    hpAtItsTurn > 0 &&
    hpAtItsTurn < battleState.enemyMaxHp &&
    rand(1, HEAL_CHANCE_DENOMINATOR) === 1
  ) {
    return {
      enemyRaw: 0,
      playerBlock: 0,
      enemyFinal: 0,
      effectiveDef,
      enemyDamageType: enemyDmgType,
      enemyAction: null,
      dodged: false,
      poisonApplied: null,
      petrifyApplied: 0,
      extraHits: [],
      effects: { healCast: rand(1, Math.max(1, enemy.att)) },
    }
  }

  // Every hit the enemy lands this turn — the first and each one after it —
  // is rolled the same way, as the original's attack loop did: it re-ran the
  // whole perk chain per hit, so a Troll King's second swing can crit too.
  //
  // At most one special resolves per hit. A special replaces how the raw
  // damage is rolled; the single defense roll, the zero floor and damageType
  // are unchanged. Defense is rolled ONCE against whatever the hit produced —
  // a Power Attack does not get blocked three times. Negative DEF rolls
  // negative, so raw − block grows.
  //
  // A `bypassesDefense` special (bite, rage, firebreath, the standing pure
  // attack) is the original's "pure" damage: the roll IS the damage, and the
  // block is reported as 0 so `( rolls ) − block = total` still adds up.
  //
  // On an enemy that carries Pure Attack, everything is pure: a Power Attack,
  // Critical or Whirlwind lands every one of its rolls at full ATT, unblocked
  // (`$edamagetotal = $enemyatt * 3`, `* 10`, `* 6`), and so does each
  // extra hit.
  //
  // Dodge (the skill) is a flat lvl% chance a swing does nothing — no block
  // rolled, no damage taken — rolled per hit.
  const dodgeChance = battleState.dodgeChance || 0
  const enemyIsPure = hasSpecial(enemy, 'pure')
  let poisonApplied = null
  let petrifyApplied = 0
  const rollHit = () => {
    // Poison and stone are only on offer while they could take hold, which
    // includes not having been left already by an earlier hit this turn.
    const canPoison = !battleState.poisoned && !battleState.poisonImmune && !poisonApplied
    const canPetrify = (battleState.petrifiedTurns || 0) === 0 && petrifyApplied === 0
    const special = selectEnemySpecial(enemy, rand, { canPoison, canPetrify })

    let raw
    let action = null
    let bypass = false
    if (special) {
      const rolled = special.rollDamage(enemy, rand)
      const rolls = enemyIsPure ? rolled.rolls.map(() => enemy.att) : rolled.rolls
      raw = enemyIsPure ? rolls.reduce((sum, r) => sum + r, 0) : rolled.raw
      bypass = enemyIsPure || Boolean(special.bypassesDefense)
      action = { id: special.id, name: special.name, rolls }
    } else {
      raw = rand(0, enemy.att)
    }
    const hitDodged = dodgeChance > 0 && rand(1, 100) <= dodgeChance
    const block = hitDodged || bypass ? 0 : rand(0, effectiveDef)
    // A poison special is an ordinary hit that also leaves poison behind. The
    // original set it whether or not the blow got through the block, as long
    // as the swing was not dodged; it scales with the PLAYER's level. Stone
    // takes hold the same way: a dodged gaze is a gaze that missed.
    if (special?.applies === 'poison' && !hitDodged) {
      poisonApplied = { clicks: special.rollPoison(battleState.level || 1, rand), name: special.name }
    }
    if (special?.applies === 'petrify' && !hitDodged) petrifyApplied = special.rollPetrify(rand)
    return { raw, block, damage: hitDodged ? 0 : Math.max(0, raw - block), dodged: hitDodged, action }
  }

  const main = rollHit()
  const enemyRaw = main.raw
  const enemyAction = main.action
  const dodged = main.dodged
  const playerBlock = main.block
  const mainFinal = main.damage

  // The hits that follow the first: the guaranteed ones (Double / Triple Hit),
  // then a multi-hit roll after every hit, chained until it fails or the cap
  // is reached.
  const extraHits = []
  const rollExtraHit = () => {
    const hit = rollHit()
    return { raw: hit.raw, block: hit.block, damage: hit.damage, dodged: hit.dodged, ...(hit.action ? { action: hit.action } : {}) }
  }
  // The pack's hit is another animal, not this one's perk: a plain roll.
  const rollPlainHit = (att) => {
    const raw = rand(0, att)
    const hitDodged = dodgeChance > 0 && rand(1, 100) <= dodgeChance
    const block = hitDodged ? 0 : rand(0, effectiveDef)
    return { raw, block, damage: hitDodged ? 0 : Math.max(0, raw - block), dodged: hitDodged }
  }
  for (let i = 0; i < behaviours.extraHits; i += 1) extraHits.push(rollExtraHit())
  if (behaviours.multiHitChance > 0) {
    const threshold = Math.round(behaviours.multiHitChance * 100)
    while (extraHits.length < MAX_EXTRA_HITS && rand(1, 100) <= threshold) {
      extraHits.push(rollExtraHit())
    }
  }
  // Pack: once a turn, another of the pack may join in — one more hit, rolled
  // at twice the ATT.
  if (behaviours.packChance > 0 && rand(1, 100) <= Math.round(behaviours.packChance * 100)) {
    extraHits.push({ ...rollPlainHit(enemy.att * 2), pack: true })
  }

  // What rides on top of the attack. A theft is only a roll here — the
  // handlers take what the player actually has. The drains are unblockable
  // and undodgeable: the HP one is added to the damage, and the handlers give
  // it back to the enemy.
  const effects = {}
  if (behaviours.steals && rand(1, STEAL_CHANCE_DENOMINATOR) === 1) effects.stealRoll = rand(1, Math.max(1, enemy.att))
  if (behaviours.hpDrain > 0) effects.hpDrained = rollDrain(enemy, behaviours.hpDrain, rand)
  if (behaviours.mpDrain > 0) effects.mpDrainRoll = rollDrain(enemy, behaviours.mpDrain, rand)

  return {
    effects,
    enemyRaw,
    playerBlock,
    enemyFinal: mainFinal + extraHits.reduce((sum, hit) => sum + hit.damage, 0),
    effectiveDef,
    enemyDamageType: enemyDmgType,
    enemyAction,
    dodged,
    poisonApplied,
    petrifyApplied,
    extraHits,
  }
}


function resolveTurn(battleState, otherCombatants, { spell = null, skill = null, enemyDodged = false } = {}) {
  const player = resolvePlayerAttack(battleState, otherCombatants, { spell, skill, enemyDodged })
  // The companion waits when there is nothing to swing at: its owner is stone,
  // or the enemy is already out of the way.
  const companion = player.petrified || player.enemyDodged ? null : resolveCompanionAttack(battleState)
  const enemyAtk = resolveEnemyAttack(battleState, otherCombatants, {
    pendingDamage: player.playerFinal + (companion?.damage || 0),
  })

  return {
    // What the enemy's standing behaviours did this turn (see the handlers'
    // settleEnemyAftermath, which fills in what actually took hold).
    enemyEffects: { ...enemyAtk.effects, ...(player.enemyBlockedAttack ? { blocked: true } : {}) },
    // The player's own hit. The companion's is reported beside it, never
    // folded in, so the `raw − block = total` line the panel prints stays true.
    playerDealtDamage: player.playerFinal,
    // null with nothing in the slot; { name, roll, block, damage } otherwise.
    companion,
    enemyDealtDamage: enemyAtk.enemyFinal,
    playerRaw: player.playerRaw,
    enemyRaw: enemyAtk.enemyRaw,
    enemyBlocked: player.enemyBlock,
    playerBlocked: enemyAtk.playerBlock,
    playerStrMax: player.effectiveOff,
    playerDefMax: enemyAtk.effectiveDef,
    enemyStrMax: battleState.enemy.att,
    multiplayerBonus: otherCombatants > 0,
    bonusPercent: otherCombatants * 10,
    missedFlyingMelee: player.missedFlyingMelee,
    weaponCategory: player.weaponCategory,
    enemyDamageType: enemyAtk.enemyDamageType,
    // null on a normal attack; { id, name, rolls } when a special fired.
    enemyAction: enemyAtk.enemyAction,
    // null on a weapon strike; the cast record when a spell was thrown.
    spell: player.spell,
    // null on a plain swing or a spell; the strike record when a skill was used.
    skill: player.skill,
    immuneToMagic: player.immuneToMagic,
    // 'MELEE' | 'RANGED' when the enemy shrugged the weapon off; null otherwise.
    immuneToWeapon: player.immuneToWeapon,
    // True when Dodge turned the enemy's swing into nothing.
    playerDodged: enemyAtk.dodged,
    // { clicks, name } when the enemy's hit left poison; null otherwise.
    poisonApplied: enemyAtk.poisonApplied,
    // Turns of stone the enemy's gaze just put on the player; 0 otherwise.
    petrifyApplied: enemyAtk.petrifyApplied,
    // The enemy's hits after the first this turn: [{ raw, block, damage, dodged }].
    extraHits: enemyAtk.extraHits,
    // True when the enemy stepped out of the player's attack.
    enemyDodged: player.enemyDodged,
    // True when the player was stone this turn and could not act.
    petrified: player.petrified,
    // True when a melee blow was halved by the magma.
    melted: player.melted,
  }
}

/** Everything the enemy lost this turn: the player's hit plus the companion's. */
function totalDamageToEnemy(turn) {
  return (turn.playerDealtDamage || 0) + (turn.companion?.damage || 0)
}

module.exports = {
  rand,
  rollEnemyDodge,
  describeSpellCast,
  describeSkillUse,
  resolveTurn,
  resolveCompanionAttack,
  totalDamageToEnemy,
  weaponImmunity,
  reachesFlyingEnemy,
  resolvePlayerAttack,
  resolveEnemyAttack,
  pickPlayerOffensiveStat,
  pickPlayerDefensiveStat,
  getOtherCombatantCount,
}
