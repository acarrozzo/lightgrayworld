/**
 * Teacher unlock invariants.
 *
 * A teacher is met by standing in their room, and a guild's teacher is met
 * the moment its initiation quest completes — the turn-in happens inside the
 * guild, so no arrival follows it. Every meeting is one guarded flag write,
 * so it happens exactly once however the player got there. Runs against a
 * fake User row, no database.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { unlockSkillTeacher, unlockSkillTeachersForQuest } = require(path.join(ROOT, 'src/lib/game-engine/services/skill-service.js'))
const { unlockSpellTeacher, unlockSpellTeachersForQuest } = require(path.join(ROOT, 'src/lib/game-engine/services/spell-service.js'))

/** A one-row User table with the guarded update the services rely on. */
function fakeDb({ completedQuests = [], flags = {} } = {}) {
  const row = { ...flags }
  const writes = []
  return {
    row,
    writes,
    questProgress: {
      findUnique: async ({ where }) =>
        completedQuests.includes(where.userId_questId.questId) ? { completed: true } : null,
    },
    user: {
      updateMany: async ({ where, data }) => {
        const [flag] = Object.keys(data)
        writes.push(flag)
        if (row[flag]) return { count: 0 } // the WHERE `[flag]: false` matched nothing
        row[flag] = true
        return { count: 1 }
      },
      findUnique: async () => ({ ...row }),
    },
  }
}

test("the Warrior's Guild stays silent before the initiation and teaches after it", async () => {
  const before = fakeDb()
  assert.equal(await unlockSkillTeacher(before, 'p1', '226'), null)
  assert.deepEqual(before.writes, [], 'no flag write before the quest')

  const after = fakeDb({ completedQuests: ['quest_warriorsguild_000'] })
  const met = await unlockSkillTeacher(after, 'p1', '226')
  assert.equal(met.flag, 'warriorSkillFlag')
  assert.equal(met.skillTeachers.warriorSkillFlag, true)
})

test('turning the initiation in meets the guild teacher with no arrival, exactly once', async () => {
  const db = fakeDb()
  const met = await unlockSkillTeachersForQuest(db, 'p1', 'quest_warriorsguild_000')
  assert.equal(met.length, 1)
  assert.equal(met[0].flag, 'warriorSkillFlag')
  assert.match(met[0].message, /Warrior's Guild/)
  assert.equal(met[0].skillTeachers.warriorSkillFlag, true)

  // A second completion (or the arrival that follows) finds the flag set.
  assert.deepEqual(await unlockSkillTeachersForQuest(db, 'p1', 'quest_warriorsguild_000'), [])
  assert.equal(await unlockSkillTeacher(fakeDb({ completedQuests: ['quest_warriorsguild_000'], flags: db.row }), 'p1', '226'), null)
})

test('a quest that gates no teacher meets nobody', async () => {
  const db = fakeDb()
  assert.deepEqual(await unlockSkillTeachersForQuest(db, 'p1', 'quest_oldman_000'), [])
  assert.deepEqual(await unlockSpellTeachersForQuest(db, 'p1', 'quest_oldman_000'), [])
  assert.deepEqual(db.writes, [])
})

test('the Ranger Skills room teaches on entry, and only once', async () => {
  const db = fakeDb()
  const met = await unlockSkillTeacher(db, 'p1', '515d')
  assert.equal(met.flag, 'rangerSkillFlag')
  assert.equal(met.skillTeachers.rangerSkillFlag, true)
  assert.equal(await unlockSkillTeacher(db, 'p1', '515d'), null)
})

test("the Wizard's Guild mirrors the warriors: silent until the Kobold Master, met on the turn-in", async () => {
  assert.equal(await unlockSpellTeacher(fakeDb(), 'p1', '225'), null)
  const db = fakeDb()
  const met = await unlockSpellTeachersForQuest(db, 'p1', 'quest_wizardsguild_000')
  assert.equal(met.length, 1)
  assert.equal(met[0].flag, 'wizardSkillFlag')
  assert.equal(met[0].spellTeachers.wizardSkillFlag, true)
  assert.equal(await unlockSpellTeacher(db, 'p1', '225'), null, 'the arrival after the turn-in has nothing left to do')
})
