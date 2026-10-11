import test from 'node:test'
import assert from 'node:assert/strict'
import { announcementsFor, earnedUnlocks, freshTabs, hiddenTabs, resolveUnlocks, type UnlockFacts, type UnlockId } from '../src/lib/unlocks'

const NEW_CHARACTER: UnlockFacts = {
  level: 1,
  itemCount: 0,
  consumableCount: 0,
  craftingCount: 0,
  miscCount: 0,
  questCount: 0,
  giversMet: 0,
  hasMapOrTeleport: false,
  othersSeen: false,
  sp: 0,
  hasSkillTeacher: false,
  hasSpellTeacher: false,
  hasLearnedSkill: false,
  hasLearnedSpell: false,
  hasAbility: false,
  kills: 0,
  deaths: 0,
}
const facts = (over: Partial<UnlockFacts>): UnlockFacts => ({ ...NEW_CHARACTER, ...over })

test('a new character has earned nothing: only Explore and Char show', () => {
  assert.deepEqual(earnedUnlocks(NEW_CHARACTER), [])
  const { open } = resolveUnlocks([], NEW_CHARACTER)
  assert.deepEqual([...hiddenTabs(open)].sort(), ['actions', 'inv', 'players', 'quests', 'world'])
})

test('each tab arrives with the first thing that gives it a purpose', () => {
  assert.ok(earnedUnlocks(facts({ itemCount: 1 })).includes('tab:inv'))
  assert.ok(earnedUnlocks(facts({ questCount: 1 })).includes('tab:quests'))
  assert.ok(earnedUnlocks(facts({ giversMet: 1 })).includes('tab:quests'))
  assert.ok(earnedUnlocks(facts({ hasMapOrTeleport: true })).includes('tab:world'))
  assert.ok(earnedUnlocks(facts({ othersSeen: true })).includes('tab:players'))
  assert.ok(earnedUnlocks(facts({ kills: 1 })).includes('quests:kill-list'))
  assert.ok(earnedUnlocks(facts({ deaths: 1 })).includes('quests:battle-log'))
})

test('a book waits for a skill point and a teacher to spend it with', () => {
  assert.ok(!earnedUnlocks(facts({ hasSkillTeacher: true })).includes('char:skills'))
  assert.ok(!earnedUnlocks(facts({ sp: 3 })).includes('char:skills'))
  assert.ok(earnedUnlocks(facts({ hasSkillTeacher: true, sp: 1 })).includes('char:skills'))
  assert.ok(!earnedUnlocks(facts({ hasSkillTeacher: true, sp: 1 })).includes('char:spells'))
  assert.ok(earnedUnlocks(facts({ hasSpellTeacher: true, sp: 1 })).includes('char:spells'))
  // Something already learned keeps its book open with no points left.
  assert.ok(earnedUnlocks(facts({ hasLearnedSkill: true })).includes('char:skills'))
  assert.ok(earnedUnlocks(facts({ hasLearnedSpell: true })).includes('char:spells'))
})

test('a character who has died always has World: teleport is the only way out of the Plane of Rebirth', () => {
  assert.ok(earnedUnlocks(facts({ deaths: 1 })).includes('tab:world'))
})

test('Actions waits for something to use; a map alone opens World, not Actions', () => {
  assert.ok(!earnedUnlocks(facts({ hasMapOrTeleport: true })).includes('tab:actions'))
  assert.ok(!earnedUnlocks(facts({ deaths: 1 })).includes('tab:actions'))
  assert.ok(!earnedUnlocks(facts({ itemCount: 3 })).includes('tab:actions'))
  assert.ok(earnedUnlocks(facts({ consumableCount: 1 })).includes('tab:actions'))
  assert.ok(earnedUnlocks(facts({ hasAbility: true })).includes('tab:actions'))
})

test('a solo player is not locked out of Players forever', () => {
  assert.ok(!earnedUnlocks(facts({ level: 4 })).includes('tab:players'))
  assert.ok(earnedUnlocks(facts({ level: 5 })).includes('tab:players'))
})

test('what was unlocked stays unlocked when the fact goes away', () => {
  const latched: UnlockId[] = ['tab:inv', 'inv:consumables']
  const { open, arrived } = resolveUnlocks(latched, NEW_CHARACTER)
  assert.ok(open.has('tab:inv') && open.has('inv:consumables'))
  assert.deepEqual(arrived, [])
})

test('only what is new is reported as arrived, a tab before its sub-tabs', () => {
  const { arrived } = resolveUnlocks(['tab:inv'], facts({ itemCount: 2, consumableCount: 1, craftingCount: 1 }))
  assert.deepEqual(arrived, ['tab:actions', 'inv:consumables', 'inv:crafting'])
})

test('a sub-tab arriving with its own tab does not speak twice', () => {
  const lines = announcementsFor(['tab:inv', 'inv:consumables', 'tab:actions']).map((def) => def.id)
  assert.deepEqual(lines, ['tab:inv', 'tab:actions'])
  // On its own, later, it does.
  assert.deepEqual(announcementsFor(['inv:crafting']).map((def) => def.id), ['inv:crafting'])
  // The battle log rides with the kill list and never has a line of its own.
  assert.deepEqual(announcementsFor(['quests:kill-list', 'quests:battle-log']).map((def) => def.id), ['quests:kill-list'])
})

test('a fresh sub-tab lights its parent tab', () => {
  assert.deepEqual([...freshTabs(new Set<UnlockId>(['char:spells', 'inv:misc']))].sort(), ['char', 'inv'])
})
