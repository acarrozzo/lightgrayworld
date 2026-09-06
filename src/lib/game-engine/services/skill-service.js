/**
 * Skill progression.
 *
 * The registry (game-data/skills.js) says what a skill *is*; this service is
 * where it meets the User row: which levels the player holds, which teachers
 * they have met, and spending SP. What a skill *does* in a fight lives with
 * the rest of combat — the passives in battle-state.js, the strikes in
 * battle-calculator.js / battle-action-handlers.js.
 *
 * Every write here is a guarded conditional update, the same shape the spell
 * service uses: the pre-read only produces a friendly message, the WHERE
 * clause is what stops two clicks from spending the same points.
 */
const { prisma } = require('../../db-client')
const {
  SKILLS,
  SKILL_COLUMNS,
  SKILL_TEACHER_FLAGS,
  SKILL_TEACHER_ROOMS,
  getSkill,
  getSkillMaxLevel,
  getNextLearnCost,
} = require('../../game-data/skills')
const { BUFF_SELECT, getStatBuffBonuses } = require('./buff-service')

/**
 * Prisma `select` covering every skill level and teacher flag.
 *
 * Written out rather than derived from the registry so TypeScript sees literal
 * keys (see SPELL_SELECT for why). `assertSkillSelectMatchesRegistry` fails
 * loudly at load if a skill or teacher is added to one and not the other.
 */
const SKILL_SELECT = /** @type {const} */ ({
  oneHanded: true,
  twoHanded: true,
  ranged: true,
  warcraft: true,
  slice: true,
  smash: true,
  aim: true,
  magicStrike: true,
  toughness: true,
  block: true,
  dodge: true,
  multiArrow: true,
  boltUpgrade: true,
  youngSoldierFlag: true,
  jackLumberFlag: true,
  travelingWarriorFlag: true,
  hunterBillFlag: true,
  warriorSkillFlag: true,
  masterTrainerFlag: true,
  rangerSkillFlag: true,
  starCitySkillsFlag: true,
})

function assertSkillSelectMatchesRegistry() {
  const expected = [...SKILL_COLUMNS, ...SKILL_TEACHER_FLAGS].sort()
  const actual = Object.keys(SKILL_SELECT).sort()
  if (expected.join(',') !== actual.join(',')) {
    throw new Error(
      `SKILL_SELECT is out of step with game-data/skills.js: expected [${expected.join(', ')}], got [${actual.join(', ')}]`
    )
  }
}
assertSkillSelectMatchesRegistry()

/**
 * The client-facing projection of a User row's skill state. Both maps are
 * keyed by the User column, which is also how the registry refers to them.
 * @param {Object|null|undefined} row
 * @returns {{ skills: Record<string, number>, skillTeachers: Record<string, boolean> }}
 */
function projectSkillState(row) {
  /** @type {Record<string, number>} */
  const skills = {}
  for (const column of SKILL_COLUMNS) skills[column] = Number(row?.[column] ?? 0)
  /** @type {Record<string, boolean>} */
  const skillTeachers = {}
  for (const flag of SKILL_TEACHER_FLAGS) skillTeachers[flag] = Boolean(row?.[flag])
  return { skills, skillTeachers }
}

/**
 * Everything a strike or a learn needs to decide, in one read.
 * @param {string} playerId
 */
async function getSkillState(playerId) {
  const row = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      sp: true,
      mp: true,
      mpMax: true,
      mag: true,
      magMod: true,
      ...BUFF_SELECT,
      ...SKILL_SELECT,
    },
  })
  if (!row) return null
  const { skills, skillTeachers } = projectSkillState(row)
  return {
    sp: row.sp,
    mp: row.mp,
    mpMax: row.mpMax,
    // Effective MAG, the number Magic Strike reads (the original's magmod).
    effectiveMag: (row.mag || 0) + (row.magMod || 0) + getStatBuffBonuses(row).mag,
    skills,
    skillTeachers,
  }
}

/**
 * Spend SP on a skill. `mode: 'one'` raises it a single level; `mode: 'max'`
 * keeps going until the cap or the SP runs out, like the original's "+1" and
 * "MAX" buttons.
 *
 * Each level is its own guarded write (`sp >= cost AND column = level`), so a
 * second submit racing this one finds the level already moved and stops with a
 * conflict rather than granting a free level.
 *
 * @param {string} playerId
 * @param {string} skillId
 * @param {{ mode?: 'one'|'max' }} [options]
 * @returns {Promise<{ success: boolean, message: string, skillId: string, levelsGained: number, newLevel: number, spSpent: number, maxLevel: number }>}
 */
async function learnSkill(playerId, skillId, { mode = 'one' } = {}) {
  const skill = getSkill(skillId)
  if (!skill) {
    return { success: false, message: 'Unknown skill.', skillId, levelsGained: 0, newLevel: 0, spSpent: 0, maxLevel: 0 }
  }

  const state = await getSkillState(playerId)
  if (!state) {
    return { success: false, message: 'Player not found.', skillId, levelsGained: 0, newLevel: 0, spSpent: 0, maxLevel: 0 }
  }

  const maxLevel = getSkillMaxLevel(skill, state.skillTeachers)
  let level = state.skills[skill.column] || 0
  let sp = state.sp

  if (maxLevel <= 0) {
    return {
      success: false,
      message: `You have not found anyone who can teach ${skill.name} yet.`,
      skillId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }
  if (level >= maxLevel) {
    return {
      success: false,
      message: `You have MAXED out your ${skill.name} skill! Search for more advanced teachers.`,
      skillId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }

  let levelsGained = 0
  let spSpent = 0
  let conflict = false

  while (level < maxLevel) {
    const cost = getNextLearnCost(skill, level, maxLevel)
    if (cost === null || sp < cost) break

    const applied = await prisma.user.updateMany({
      where: { id: playerId, sp: { gte: cost }, [skill.column]: level },
      data: { sp: { decrement: cost }, [skill.column]: { increment: 1 } },
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
        skillId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
      }
    }
    const cost = getNextLearnCost(skill, level, maxLevel)
    return {
      success: false,
      message: `You don't have enough SP! ${skill.name} level ${level + 1} costs ${cost} SP and you have ${sp}.`,
      skillId, levelsGained: 0, newLevel: level, spSpent: 0, maxLevel,
    }
  }

  const reachedMax = level >= maxLevel
  const message =
    `(You spend ${spSpent} SP) ${skill.name} is now level ${level}.` +
    (reachedMax ? ` ${skill.name} MAX! Search for more advanced teachers.` : '')

  return { success: true, message, skillId, levelsGained, newLevel: level, spSpent, maxLevel }
}

/**
 * The guarded flag write every teacher meeting comes down to: it matches only
 * while the flag is still false, so the message plays exactly once per player
 * however many arrivals, logins or turn-ins race for it.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {{ flag: string, message: string }} teacher
 * @returns {Promise<{ flag: string, message: string, skillTeachers: Record<string, boolean> }|null>}
 */
async function meetSkillTeacher(db, playerId, teacher) {
  const applied = await db.user.updateMany({
    where: { id: playerId, [teacher.flag]: false },
    data: { [teacher.flag]: true },
  })
  if (applied.count === 0) return null

  const row = await db.user.findUnique({ where: { id: playerId }, select: SKILL_SELECT })
  return { flag: teacher.flag, message: teacher.message, skillTeachers: projectSkillState(row).skillTeachers }
}

/**
 * Meeting a skill teacher by standing in their room — on arrival, on login,
 * or pulled in by a party leader. A teacher behind a quest (the Warrior's
 * Guild's initiation) stays silent until that quest is turned in; since the
 * turn-in happens inside the guild with no arrival after it, that moment is
 * covered by `unlockSkillTeachersForQuest`.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {string} roomId  The server's authoritative room.
 * @returns {Promise<{ flag: string, message: string, skillTeachers: Record<string, boolean> }|null>}
 */
async function unlockSkillTeacher(db, playerId, roomId) {
  const teacher = SKILL_TEACHER_ROOMS[roomId]
  if (!teacher) return null

  if (teacher.requiresCompletedQuest) {
    const progress = await db.questProgress.findUnique({
      where: { userId_questId: { userId: playerId, questId: teacher.requiresCompletedQuest } },
      select: { completed: true },
    })
    if (!progress?.completed) return null
  }

  return meetSkillTeacher(db, playerId, teacher)
}

/**
 * Meeting every skill teacher a just-completed quest unlocks. The quest
 * service calls this once the completion has committed, so the guild's "you
 * can now learn" line follows its "then you're one of us" — the original
 * checked the flag on the very next page load in the guild, which is the same
 * moment. The quest is the whole condition: it is only turned in at the guild.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} playerId
 * @param {string} questId  The quest that just completed.
 * @returns {Promise<Array<{ flag: string, message: string, skillTeachers: Record<string, boolean> }>>}
 */
async function unlockSkillTeachersForQuest(db, playerId, questId) {
  const met = []
  for (const teacher of Object.values(SKILL_TEACHER_ROOMS)) {
    if (teacher.requiresCompletedQuest !== questId) continue
    const result = await meetSkillTeacher(db, playerId, teacher)
    if (result) met.push(result)
  }
  return met
}

module.exports = {
  SKILL_SELECT,
  SKILLS,
  assertSkillSelectMatchesRegistry,
  projectSkillState,
  getSkillState,
  learnSkill,
  unlockSkillTeacher,
  unlockSkillTeachersForQuest,
}
