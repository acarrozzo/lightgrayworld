/**
 * The book doors of a teacher's room: "Skills" and "Spells" buttons derived
 * from the teacher tables, each hidden until that teacher's flag is set.
 * Presentation only — the buttons are client-side toggles that open the
 * Skills and Spells book full screen — so what is checked here is that the
 * door is where the teacher is, and never advertised before the lesson.
 *
 * Run: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { getRoomActions, isRoomActionVisible, type RoomAction } from '../src/lib/room-actions'

const SKILL_TEACHER_ROOMS = {
  '007': 'youngSoldierFlag',
  '024': 'jackLumberFlag',
  '106': 'travelingWarriorFlag',
  '118': 'hunterBillFlag',
  '226': 'warriorSkillFlag',
  '515d': 'rangerSkillFlag',
  '610': 'masterTrainerFlag',
  '701': 'starCitySkillsFlag',
}
const SPELL_TEACHER_ROOMS = {
  '021': 'pajamaShamanFlag',
  '105': 'travelingWizardFlag',
  '225': 'wizardSkillFlag',
  '701': 'starCitySpellsFlag',
}

const doorsOf = (roomId: string) => getRoomActions(roomId).filter((a) => a.action === 'open skillbook' || a.action === 'open spellbook')

test('every skill teacher’s room has a Skills door waiting on that teacher’s flag', () => {
  for (const [roomId, flag] of Object.entries(SKILL_TEACHER_ROOMS)) {
    const door = getRoomActions(roomId).find((a) => a.action === 'open skillbook')
    assert.ok(door, `room ${roomId} has a Skills door`)
    assert.equal(door.label, 'Skills')
    assert.equal(door.requiresTeacher, flag, `room ${roomId} waits on ${flag}`)
  }
})

test('every spell teacher’s room has a Spells door waiting on that teacher’s flag', () => {
  for (const [roomId, flag] of Object.entries(SPELL_TEACHER_ROOMS)) {
    const door = getRoomActions(roomId).find((a) => a.action === 'open spellbook')
    assert.ok(door, `room ${roomId} has a Spells door`)
    assert.equal(door.label, 'Spells')
    assert.equal(door.requiresTeacher, flag, `room ${roomId} waits on ${flag}`)
  }
})

test('Camp Hero has both doors, Skills first; a room with no teacher has none', () => {
  assert.deepEqual(doorsOf('701').map((a) => a.action), ['open skillbook', 'open spellbook'])
  assert.deepEqual(doorsOf('001'), [])
  assert.deepEqual(doorsOf('003'), [])
})

test('the doors come after the room’s own buttons', () => {
  const actions = getRoomActions('021').map((a) => a.action)
  assert.equal(actions[actions.length - 1], 'open spellbook')
  assert.ok(actions.includes('read sign'))
  assert.ok(actions.includes('open crafting'))
})

test('a door is hidden until its teacher is met, from either book’s flags', () => {
  const [door] = doorsOf('021')
  assert.equal(isRoomActionVisible(door, { quests: [] }), false)
  assert.equal(isRoomActionVisible(door, { spellTeachers: { pajamaShamanFlag: false }, quests: [] }), false)
  assert.equal(isRoomActionVisible(door, { spellTeachers: { pajamaShamanFlag: true }, quests: [] }), true)
  // Either book's flag map may carry the flag; the door does not care which.
  const [skills] = doorsOf('007')
  assert.equal(isRoomActionVisible(skills, { spellTeachers: { youngSoldierFlag: true }, quests: [] }), true)
  assert.equal(isRoomActionVisible(skills, { skillTeachers: { youngSoldierFlag: true }, quests: [] }), true)
  assert.equal(isRoomActionVisible(skills, { skillTeachers: {}, spellTeachers: {}, quests: [] }), false)
})

test('membership gating is unchanged and independent of the teacher gate', () => {
  const plain: RoomAction = { action: 'read sign', label: 'Read Sign' }
  assert.equal(isRoomActionVisible(plain, { quests: [] }), true)
  const members: RoomAction = { action: 'talk to armorer', label: 'Armorer', requiresMembership: 'warriors-guild' }
  assert.equal(isRoomActionVisible(members, { quests: [] }), false)
  const unknownGuild: RoomAction = { action: 'x', label: 'X', requiresMembership: 'no-such-guild' }
  assert.equal(isRoomActionVisible(unknownGuild, { quests: [] }), false)
})
