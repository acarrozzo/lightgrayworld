/**
 * Spell progression and out-of-combat casting.
 *
 * The registry (game-data/spells.js) says what a spell *is*; this service is
 * where it meets the User row: which levels the player holds, which teachers
 * they have met, spending SP, and the one spell effect that is not a combat
 * roll — healing. Combat casting lives with the rest of combat in
 * battle-calculator.js / battle-action-handlers.js.
 *
 * Every write here is a guarded conditional update, the same shape the CP/TP
 * routes use: the pre-read only produces a friendly message, the WHERE clause
 * is what stops two clicks from spending the same points or the same MP.
 */
const { prisma } = require('../../db-client')
const {
  SPELLS,
  SPELL_COLUMNS,
  SPELL_TEACHER_FLAGS,
  SPELL_TEACHER_ROOMS,
  getSpell,
  getSpellMaxLevel,
  getNextLearnCost,
  rollSpell,
} = require('../../game-data/spells')
const { BUFF_SELECT, getStatBuffBonuses } = require('./buff-service')

/**
 * Prisma `select` covering every spell level and teacher flag.
 *
 * Written out rather than derived from the registry so TypeScript sees literal
 * keys: spread into a route's `select`, an index-signature object widens the
 * whole result type and every field on it stops type-checking. The registry is
 * still the source of truth — `assertSpellSelectMatchesRegistry` (run at load,
 * and by the tests) fails loudly if a spell or teacher is added to one and not
 * the other.
 */
const SPELL_SELECT = /** @type {const} */ ({
  magicMissile: true,
  fireball: true,
  poisonDart: true,
  atomicBlast: true,
  heal: true,
  regenerate: true,
  antidote: true,
  magicArmor: true,
  ironSkin: true,
  wings: true,
  gills: true,
  pajamaShamanFlag: true,
  travelingWizardFlag: true,
  wizardSkillFlag: true,
  starCitySpellsFlag: true,
})

function assertSpellSelectMatchesRegistry() {
  const expected = [...SPELL_COLUMNS, ...SPELL_TEACHER_FLAGS].sort()
  const actual = Object.keys(SPELL_SELECT).sort()
  if (expected.join(',') !== actual.join(',')) {
    throw new Error(
      `SPELL_SELECT is out of step with game-data/spells.js: expected [${expected.join(', ')}], got [${actual.join(', ')}]`
    )
  }
}
assertSpellSelectMatchesRegistry()

/**
 * The client-facing projection of a User row's spell state. Both maps are
 * keyed by the User column, which is also how the registry refers to them.
 * @param {Object|null|undefined} row
 * @returns {{ spells: Record<string, number>, spellTeachers: Record<string, boolean> }}
 */
function projectSpellState(row) {
  /** @type {Record<string, number>} */
  const spells = {}
  for (const column of SPELL_COLUMNS) spells[column] = Number(row?.[column] ?? 0)
  /** @type {Record<string, boolean>} */
  const spellTeachers = {}
  for (const flag of SPELL_TEACHER_FLAGS) spellTeachers[flag] = Boolean(row?.[flag])
  return { spells, spellTeachers }
}

/**
 * Effective MAG — core + equipment + running buffs — which is the original's
 * `magmod`, the number every spell formula reads.
 * @param {Object} row  a User row carrying mag, magMod and the buff countdowns
 */
function getEffectiveMag(row) {
  return (row?.mag || 0) + (row?.magMod || 0) + getStatBuffBonuses(row).mag
}

/**
 * Everything a cast or a learn needs to decide, in one read.
 * @param {string} playerId
 */
async function getSpellState(playerId) {
  const row = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      sp: true,
      hp: true,
      hpMax: true,
      mp: true,
      mpMax: true,
      mag: true,
      magMod: true,
      ...BUFF_SELECT,
      ...SPELL_SELECT,
    },
  })
  if (!row) return null
  const { spells, spellTeachers } = projectSpellState(row)
  return {
    sp: row.sp,
    hp: row.hp,
    hpMax: row.hpMax,
    mp: row.mp,
    mpMax: row.mpMax,
    effectiveMag: getEffectiveMag(row),
    spells,
    spellTeachers,
  }
}

/**
 * Spend SP on a spell. `mode: 'one'` raises it a single level; `mode: 'max'`
 * keeps going until the cap or the SP runs out, exactly like the original's
 * "+1" and "MAX" buttons.
 *
 * Each level is its own guarded write (`sp >= cost AND column = level`), so a
 * second submit racing this one finds the level already moved and stops with a
 * conflict rather than granting a free level.
 *
 * @param {string} playerId
 * @param {string} spellId
 * @param {{ mode?: 'one'|'max' }} [options]
 * @returns {Promise<{ success: boolean, message: string, spellId: string, levelsGained: number, newLevel: number, spSpent: number, maxLevel: number }>}
 */
async function learnSpell(playerId, spellId, { mode = 'one' } = {}) {
  const spell = getSpell(spellId)
  if (!spell) {
    return { success: false, message: 'Unknown spell.', spellId, levelsGained: 0, newLevel: 0, spSpent: 0, maxLevel: 0 }
  }

  const state = await getSpellState(playerId)
  if (!state) {
    return { success: false, message: 'Player not found.', spellId, levelsGained: 0, newLevel: 0, spSpent: 0, maxLevel: 0 }
  }

  const maxLevel = getSpellMaxLevel(spell, state.spellTeachers)
  let level = state.spells[spell.column] || 0
  let sp = state.sp

  if (maxLevel <= 0) {
    return {
      success: false,
      message: `You have not found anyone who can teach ${spell.name} yet.`,
      spellId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }
  if (level >= maxLevel) {
    return {
      success: false,
      message: `You have MAXED out your ${spell.name} spell! Search for more advanced teachers.`,
      spellId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }

  let levelsGained = 0
  let spSpent = 0
  let conflict = false

  while (level < maxLevel) {
    const cost = getNextLearnCost(spell, level, maxLevel)
    if (cost === null || sp < cost) break

    const applied = await prisma.user.updateMany({
      where: { id: playerId, sp: { gte: cost }, [spell.column]: level },
      data: { sp: { decrement: cost }, [spell.column]: { increment: 1 } },
    })
    if (applied.count === 0) {
      conflict = true
      break
    }

    level += 1
    sp -= cost
    spSpent += cost
    levelsGained += 1
    if (mode !== 'max') break
  }

  if (levelsGained === 0) {
    if (conflict) {
      return {
        success: false,
        message: 'Your Skill Points changed before that could be applied. Please try again.',
        spellId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
      }
    }
    const cost = getNextLearnCost(spell, level, maxLevel)
    return {
      success: false,
      message: `You don't have enough SP! ${spell.name} level ${level + 1} costs ${cost} SP and you have ${sp}.`,
      spellId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }

  const reachedMax = level >= maxLevel
  const message =
    `(You spend ${spSpent} SP) ${spell.name} is now level ${level}.` +
    (reachedMax ? ` ${spell.name} MAX! Search for more advanced teachers.` : '')

  return { success: true, message, spellId, levelsGained, newLevel: level, spSpent, maxLevel }
}

/**
 * The guarded flag write every teacher meeting comes down to: it matches only
 * while the flag is still false, so the crash-course message plays exactly
 * once per player however many arrivals, logins or turn-ins race for it.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {{ flag: string, message: string }} teacher
 * @returns {Promise<{ flag: string, message: string, spellTeachers: Record<string, boolean> }|null>}
 */
async function meetSpellTeacher(db, playerId, teacher) {
  const applied = await db.user.updateMany({
    where: { id: playerId, [teacher.flag]: false },
    data: { [teacher.flag]: true },
  })
  if (applied.count === 0) return null

  const row = await db.user.findUnique({ where: { id: playerId }, select: SPELL_SELECT })
  return { flag: teacher.flag, message: teacher.message, spellTeachers: projectSpellState(row).spellTeachers }
}

/**
 * Meeting a spell teacher by standing in their room — on arrival, on login,
 * or pulled in by a party leader. A teacher behind a quest (the Wizard's
 * Guild's initiation) stays silent until that quest is turned in; since the
 * turn-in happens inside the guild with no arrival after it, that moment is
 * covered by `unlockSpellTeachersForQuest`.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {string} roomId  The server's authoritative room.
 * @returns {Promise<{ flag: string, message: string, spellTeachers: Record<string, boolean> }|null>}
 */
async function unlockSpellTeacher(db, playerId, roomId) {
  const teacher = SPELL_TEACHER_ROOMS[roomId]
  if (!teacher) return null

  if (teacher.requiresMembership) {
    const { isMember } = require('./faction-service')
    if (!(await isMember(playerId, teacher.requiresMembership, db))) return null
  }

  return meetSpellTeacher(db, playerId, teacher)
}

/**
 * Meeting every spell teacher a just-completed quest unlocks (the Wizard's
 * Guild after the Kobold Master). Called by the quest service once the
 * completion has committed, so the guild's line follows the turn-in the way
 * the original's next page load did.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {string} questId  The quest that just completed.
 * @returns {Promise<Array<{ flag: string, message: string, spellTeachers: Record<string, boolean> }>>}
 */
async function unlockSpellTeachersForQuest(db, playerId, questId) {
  const { factionByMembershipQuest } = require('../../game-data/factions')
  const guild = factionByMembershipQuest(questId)
  if (!guild) return []
  const met = []
  for (const teacher of Object.values(SPELL_TEACHER_ROOMS)) {
    if (teacher.requiresMembership !== guild.id) continue
    const result = await meetSpellTeacher(db, playerId, teacher)
    if (result) met.push(result)
  }
  return met
}

/**
 * Cast a healing spell against the live row.
 *
 * The original refused Heal at full HP and never let it push HP past the max;
 * both hold here. The write is one guarded UPDATE: it only lands while the
 * player still has the MP, and it clamps HP to hpMax without ever *lowering*
 * an overcharged value (a fountain rest above max is left alone).
 *
 * @param {string} playerId
 * @param {import('../../game-data/spells').SpellDef} spell
 * @param {(a: number, b: number) => number} rand
 * @returns {Promise<{ success: true, level: number, cost: number, amount: number, rolls: number[], text: string, hp: number, mp: number, hpChange: number, mpChange: number } | { success: false, message: string }>}
 */
async function castHealSpell(playerId, spell, rand) {
  const state = await getSpellState(playerId)
  if (!state) return { success: false, message: 'Player not found.' }

  const level = state.spells[spell.column] || 0
  if (level < 1) return { success: false, message: `You don't know the ${spell.name} spell.` }

  const cost = spell.castCost(level, state.effectiveMag)
  if (state.hp >= state.hpMax) return { success: false, message: 'You already have full health.' }
  if (state.mp < cost) return { success: false, message: `You don't have enough MP to cast ${spell.name}. It costs ${cost} MP and you have ${state.mp}.` }

  const roll = rollSpell(spell, level, state.effectiveMag, rand)

  const rows = await prisma.$queryRawUnsafe(
    `WITH prev AS (SELECT hp AS prev_hp, mp AS prev_mp FROM "User" WHERE id = $1)
     UPDATE "User"
     SET hp = GREATEST(hp, LEAST("hpMax", hp + $2)),
         mp = mp - $3
     WHERE id = $1 AND mp >= $3
     RETURNING hp, mp, (SELECT prev_hp FROM prev) AS "prevHp", (SELECT prev_mp FROM prev) AS "prevMp"`,
    playerId,
    roll.amount,
    cost
  )
  const row = rows[0]
  if (!row) {
    return { success: false, message: `You don't have enough MP to cast ${spell.name}.` }
  }

  const hp = Number(row.hp)
  const mp = Number(row.mp)
  return {
    success: true,
    level,
    cost,
    amount: roll.amount,
    rolls: roll.rolls,
    text: roll.text,
    hp,
    mp,
    hpChange: hp - Number(row.prevHp),
    mpChange: mp - Number(row.prevMp),
  }
}

module.exports = {
  SPELL_SELECT,
  SPELLS,
  assertSpellSelectMatchesRegistry,
  projectSpellState,
  getEffectiveMag,
  getSpellState,
  learnSpell,
  unlockSpellTeacher,
  unlockSpellTeachersForQuest,
  castHealSpell,
}
