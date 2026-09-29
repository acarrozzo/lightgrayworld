/**
 * The shortcut rail beside the D-pad: which of a room's actions earn a chip,
 * in what order, and what the bubble says. The rule is the decision here — a
 * sign is never primary, a shop always is, a harvest shows its timer — so it
 * is pinned against the real room table rather than a fixture.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyRoomAction, isShortcutAction, questIdsForNpc, type RoomAction } from '../src/lib/room-actions'
import { buildRoomShortcuts, formatShortCountdown, ROOM_SHORTCUT_CAP, type RoomShortcutInput } from '../src/lib/room-shortcuts'

const none = new Set<string>()
const act = (action: string, extra: Partial<RoomAction> = {}): RoomAction => ({ action, label: action, ...extra })

const player = { level: 5, hp: 10, hpMax: 10, mp: 5, mpMax: 5 } as unknown as RoomShortcutInput['player']

function input(roomId: string, over: Partial<RoomShortcutInput> = {}): RoomShortcutInput {
  return {
    roomId,
    enemy: null,
    isInBattle: false,
    gatherCooldowns: [],
    inventory: [],
    quests: [],
    killList: [],
    player,
    giversMet: [],
    goldChestOpened: false,
    ...over,
  }
}

test('classifies by what the entry already is', () => {
  assert.equal(classifyRoomAction(act('talk to old man', { questIds: ['q'] }), none), 'npc')
  assert.equal(classifyRoomAction(act('view shop'), none), 'shop')
  assert.equal(classifyRoomAction(act('view stables'), none), 'shop')
  assert.equal(classifyRoomAction(act('open gold chest'), none), 'chest')
  assert.equal(classifyRoomAction(act('open crafting'), none), 'craft')
  assert.equal(classifyRoomAction(act('rest at the fountain'), none), 'rest')
  assert.equal(classifyRoomAction(act('chop wood'), new Set(['chop wood'])), 'harvest')
  assert.equal(classifyRoomAction(act('read sign'), none), 'other')
  assert.equal(classifyRoomAction(act('examine pillar'), none), 'other')
  assert.equal(classifyRoomAction(act('rest'), none), 'other', 'the core verb is not a room shortcut')
})

test('the flag overrides the kind in both directions', () => {
  assert.equal(isShortcutAction(act('read sign'), 'other'), false)
  assert.equal(isShortcutAction(act('use boat', { shortcut: true }), 'other'), true)
  assert.equal(isShortcutAction(act('view shop', { shortcut: false }), 'shop'), false)
})

test("room 003: the Old Man, the tutorial fight and the fire, never the cabin", () => {
  const { shortcuts, hidden } = buildRoomShortcuts(input('003'))
  const labels = shortcuts.map((s) => s.label)
  assert.ok(labels.includes('Old Man'), labels.join(', '))
  assert.ok(labels.includes('Attack Dummy'), 'the authored flag pulls the dummy in')
  assert.ok(shortcuts.some((s) => s.kind === 'craft'), 'the crafting station is primary')
  assert.ok(!labels.includes('Examine Cabin'), 'examining is never primary')
  assert.equal(hidden, 0)
  assert.ok(shortcuts.length <= ROOM_SHORTCUT_CAP)
})

test('a present enemy is the first chip, with its level, and dims once the fight is on', () => {
  const enemy = { slug: 'squid', name: 'Squid', level: 13 }
  const idle = buildRoomShortcuts(input('003', { enemy })).shortcuts[0]
  assert.equal(idle.kind, 'attack')
  assert.equal(idle.label, 'Attack Squid')
  assert.deepEqual(idle.fire, { type: 'start_battle', data: { enemySlug: 'squid' } })
  assert.equal(idle.bubble?.text, '13')
  assert.equal(idle.disabled, false)

  const fighting = buildRoomShortcuts(input('003', { enemy, isInBattle: true })).shortcuts[0]
  assert.equal(fighting.disabled, true)
  assert.equal(fighting.reason, 'Already fighting')
})

test('an NPC chip counts the open quests the player holds', () => {
  const [firstQuest] = questIdsForNpc('old_man')
  assert.ok(firstQuest, 'the Old Man has quests')
  const quests = [{ id: 'row', questId: firstQuest, progress: 0, completed: false }] as RoomShortcutInput['quests']
  const npc = buildRoomShortcuts(input('003', { quests })).shortcuts.find((s) => s.kind === 'npc')
  assert.ok(npc)
  assert.equal(npc.bubble?.text, '1')
  assert.notEqual(npc.bubble?.tone, 'ready', 'nothing is ready with no progress')

  const quiet = buildRoomShortcuts(input('003')).shortcuts.find((s) => s.kind === 'npc')
  assert.equal(quiet?.bubble, null, 'no open quests, no bubble')
})

test('a harvest shows its batch when ready and its timer while regrowing', () => {
  const cooldown = { action: 'pick redberry', cooldownSeconds: 600, secondsRemaining: 0, quantity: 5, itemNamePlural: 'redberries' }
  const ready = buildRoomShortcuts(input('002', { gatherCooldowns: [cooldown] })).shortcuts.find((s) => s.kind === 'harvest')
  assert.ok(ready)
  assert.equal(ready.bubble?.text, '5')
  assert.equal(ready.disabled, false)

  const waiting = buildRoomShortcuts(input('002', { gatherCooldowns: [{ ...cooldown, secondsRemaining: 240 }] })).shortcuts.find((s) => s.kind === 'harvest')
  assert.ok(waiting)
  assert.equal(waiting.bubble?.text, '4m')
  assert.equal(waiting.bubble?.tone, 'wait')
  assert.equal(waiting.disabled, true)

  // The live tick wins over the table's figure.
  const ticked = buildRoomShortcuts(input('002', { gatherCooldowns: [{ ...cooldown, secondsRemaining: 240 }], gatherRemaining: { 'pick redberry': 0 } })).shortcuts.find((s) => s.kind === 'harvest')
  assert.equal(ticked?.disabled, false)
})

test('an opened gold chest stays on the rail but reads as done', () => {
  const chest = buildRoomShortcuts(input('001', { goldChestOpened: true })).shortcuts.find((s) => s.kind === 'chest')
  assert.ok(chest)
  assert.equal(chest.muted, true)
  assert.equal(chest.disabled, false)
})

test('short countdowns fit a bubble', () => {
  assert.equal(formatShortCountdown(38), '38s')
  assert.equal(formatShortCountdown(240), '4m')
  assert.equal(formatShortCountdown(3601), '2h')
})
