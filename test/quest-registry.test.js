/**
 * Quest registry and giver invariants.
 *
 * Standing is a count derived from QuestProgress rows; a quest opens when its
 * giver is met and its `after` list is done; a giver is revealed by one rule.
 * These are the facts the journal, the NPC card, the Pillar's capstones and
 * the reconcile pass all lean on, so they are pinned here against a fake
 * database — no Postgres needed.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const registry = require(path.join(ROOT, 'src/lib/game-data/quest-registry.js'))
const { FACTIONS, getFaction, factionByMembershipQuest, listLiveFactions } = require(path.join(ROOT, 'src/lib/game-data/factions.js'))
const questService = require(path.join(ROOT, 'src/lib/game-engine/services/quest-service.js'))

const done = (...ids) => ids.map((questId) => ({ questId, completed: true }))

test('every quest belongs to exactly one giver, and every giver to a live faction or none', () => {
  const seen = new Map()
  for (const giverId of registry.GIVER_IDS) {
    const giver = registry.getGiver(giverId)
    assert.ok(giver.quests.length > 0, `${giverId} has quests`)
    for (const questId of giver.quests) {
      assert.equal(seen.get(questId), undefined, `${questId} listed twice`)
      seen.set(questId, giverId)
      assert.equal(registry.getQuestDef(questId).giverId, giverId)
    }
    if (giver.faction !== null) {
      const faction = getFaction(giver.faction)
      assert.ok(faction && !faction.placeholder, `${giverId} speaks for a live faction`)
    }
  }
  assert.equal(seen.size, Object.keys(registry.QUESTS).length)
})

test('standing is quests done out of quests the faction has, with the title only at max', () => {
  const grassy = registry.listFactionQuestIds('grassy-field')
  assert.ok(grassy.includes('quest_oldman_001') && grassy.includes('quest_freddie_001'))

  const none = registry.factionStanding('grassy-field', [])
  assert.deepEqual([none.done, none.total, none.complete, none.title], [0, grassy.length, false, null])

  const one = registry.factionStanding('grassy-field', done('quest_oldman_001'))
  assert.deepEqual([one.done, one.complete, one.title], [1, false, null])

  const all = registry.factionStanding('grassy-field', done(...grassy))
  assert.deepEqual([all.done, all.complete, all.title], [grassy.length, true, 'Grassy Field Savior'])

  // A guild quest does not move its town.
  const townAfterGuild = registry.factionStanding('red-town', done('quest_warriorsguild_000'))
  assert.equal(townAfterGuild.done, 0)

  // A placeholder faction has nothing to count and is never complete.
  const mountains = registry.factionStanding('mountains', [])
  assert.deepEqual([mountains.total, mountains.complete], [0, false])
})

test('titles are earned one per completed faction, in world order', () => {
  const forest = registry.listFactionQuestIds('forest')
  const wizards = registry.listFactionQuestIds('wizards-guild')
  assert.deepEqual(registry.earnedTitles(done(...wizards, ...forest)), ['Forest Savior', 'Powerful Wizard'])
  assert.deepEqual(registry.earnedTitles([]), [])
})

test('a guild is its membership quest, given by one of its own givers', () => {
  for (const faction of FACTIONS.filter((f) => f.kind === 'guild')) {
    const quest = registry.getQuestDef(faction.membershipQuest)
    assert.ok(quest, `${faction.id} membership quest exists`)
    assert.equal(registry.getGiver(quest.giverId).faction, faction.id)
    assert.equal(factionByMembershipQuest(faction.membershipQuest).id, faction.id)
  }
  assert.equal(factionByMembershipQuest('quest_oldman_001'), null)
  assert.ok(listLiveFactions().every((f) => !f.placeholder))
})

test("a quest opens only when every quest in its `after` list is done", () => {
  assert.equal(registry.isQuestOpen('quest_oldman_001', new Set()), true, 'first quest opens on meeting')
  assert.equal(registry.isQuestOpen('quest_oldman_002', new Set()), false, 'Rat Problem waits for the flower')
  assert.equal(registry.isQuestOpen('quest_oldman_002', new Set(['quest_oldman_001'])), true)
  assert.equal(registry.isQuestOpen('quest_oldman_004', new Set(['quest_oldman_001'])), false, 'Blueberry Jam waits for the rats')
  assert.equal(registry.isQuestOpen('quest_oldman_004', new Set(['quest_oldman_001', 'quest_oldman_002'])), true)
  assert.equal(registry.isQuestOpen('no_such_quest', new Set()), false)
})

test('reveal rules read completed quests, met givers, discovered regions and flags', () => {
  const ctx = (over = {}) => ({ done: new Set(), met: new Set(), discoveredTeleports: [], flags: {}, ...over })
  assert.equal(registry.isGiverRevealed(registry.getGiver('old_man'), ctx()), true)
  assert.equal(registry.isGiverRevealed(registry.getGiver('young_soldier'), ctx()), false)
  assert.equal(registry.isGiverRevealed(registry.getGiver('young_soldier'), ctx({ met: new Set(['old_man']) })), true)
  assert.equal(registry.isGiverRevealed(registry.getGiver('freddie'), ctx({ done: new Set(['quest_jacklumber_000']) })), true)
  assert.equal(registry.isGiverRevealed(registry.getGiver('red_guard_captain'), ctx({ discoveredTeleports: ['forest'] })), true)
  assert.equal(registry.isGiverRevealed(registry.getGiver('red_guard_captain'), ctx({ discoveredTeleports: ['ocean'] })), false)
  assert.equal(registry.isGiverRevealed(registry.getGiver('grand_quest_pillar'), ctx({ done: new Set(['quest_jacklumber_000']) })), true)
})

test('the Pillar capstones name every live faction between them and reward the original amounts', () => {
  const pillar = registry.getGiver('grand_quest_pillar')
  assert.equal(pillar.faction, null, 'the Pillar counts toward nothing')
  const named = new Set()
  for (const questId of pillar.quests) {
    const quest = registry.getQuestDef(questId)
    const req = quest.requirements.find((r) => r.type === 'factionsComplete')
    assert.ok(req, `${questId} requires factionsComplete`)
    req.factionIds.forEach((id) => named.add(id))
  }
  for (const faction of listLiveFactions()) assert.ok(named.has(faction.id), `${faction.id} has a capstone`)
  const gq1 = registry.getQuestDef('quest_grand_grassy_field')
  assert.deepEqual(gq1.rewards, [{ type: 'xp', amount: 200 }, { type: 'currency', amount: 5000 }])
})

/** A two-table fake: QuestProgress and GiverMet rows for one player. */
function fakeDb({ quests = [], met = [] } = {}) {
  const rows = quests.map((q) => ({ id: q.questId, userId: 'p1', ...q }))
  const metRows = met.map((giverId) => ({ userId: 'p1', giverId }))
  return {
    rows,
    metRows,
    questProgress: {
      findMany: async ({ where, select }) => {
        let out = rows.filter((r) => r.userId === where.userId)
        if (where.questId?.in) out = out.filter((r) => where.questId.in.includes(r.questId))
        if (where.completed !== undefined) out = out.filter((r) => r.completed === where.completed)
        return out.map((r) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])) : r))
      },
      findUnique: async ({ where }) => rows.find((r) => r.questId === where.userId_questId.questId) ?? null,
      createMany: async ({ data }) => {
        let count = 0
        for (const row of data) {
          if (rows.some((r) => r.questId === row.questId)) continue
          rows.push({ ...row })
          count += 1
        }
        return { count }
      },
    },
    giverMet: {
      findUnique: async ({ where }) => metRows.find((r) => r.giverId === where.userId_giverId.giverId) ?? null,
      findMany: async () => metRows.map((r) => ({ giverId: r.giverId })),
      createMany: async ({ data }) => {
        let count = 0
        for (const row of data) {
          if (metRows.some((r) => r.giverId === row.giverId)) continue
          metRows.push({ ...row })
          count += 1
        }
        return { count }
      },
    },
  }
}

test('meeting a giver records it once and opens only the quests that are open', async () => {
  const db = fakeDb()
  const first = await questService.meetGiver('p1', 'old_man', db)
  assert.equal(first.alreadyMet, false)
  assert.deepEqual(first.openedQuestIds, ['quest_oldman_001'], 'the flower first; the rats wait behind it')

  const again = await questService.meetGiver('p1', 'old_man', db)
  assert.equal(again.alreadyMet, true)
  assert.deepEqual(again.openedQuestIds, [], 'a second meeting opens nothing new')
  assert.equal(db.metRows.length, 1)

  const jack = await questService.meetGiver('p1', 'jack_lumber', db)
  assert.deepEqual(jack.openedQuestIds, ['quest_jacklumber_001', 'quest_jacklumber_002', 'quest_jacklumber_000'], 'a set with no ordering opens whole')
})

test('completing a quest opens its dependents on the next pass, and only those', async () => {
  const db = fakeDb({ quests: [{ questId: 'quest_oldman_001', completed: true }], met: ['old_man'] })
  assert.deepEqual(await questService.openQuestsForGiver('p1', 'old_man', db), ['quest_oldman_002'])
  db.rows.find((r) => r.questId === 'quest_oldman_002').completed = true
  assert.deepEqual(await questService.openQuestsForGiver('p1', 'old_man', db), ['quest_oldman_003', 'quest_oldman_004'])
  assert.deepEqual(await questService.openQuestsForGiver('p1', 'old_man', db), [], 'idempotent')
})

test('reconcile infers a met giver from a row of their quests and opens what they are owed', async () => {
  // An account from before GiverMet: rows for the Old Man's first two quests, no meeting recorded.
  const db = fakeDb({ quests: [{ questId: 'quest_oldman_001', completed: true }, { questId: 'quest_oldman_002', completed: true }] })
  const opened = await questService.reconcileQuestState('p1', db)
  assert.deepEqual(db.metRows.map((r) => r.giverId), ['old_man'])
  assert.deepEqual(opened.sort(), ['quest_oldman_003', 'quest_oldman_004'])
})
