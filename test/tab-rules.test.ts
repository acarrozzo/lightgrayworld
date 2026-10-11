import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME, escapeCloses, reduceTabs, type TabId, type TabState } from '../src/lib/tab-rules'

const on = (tab: TabId): TabState => ({ tab })
const EVERY_TAB: TabId[] = ['actions', 'char', 'inv', 'world', 'quests', 'players', 'feed', 'settings']

test('selecting a tab opens it, and its own tile goes home', () => {
  for (const tab of EVERY_TAB) {
    assert.deepEqual(reduceTabs(HOME, { type: 'select', tab }), on(tab))
    assert.deepEqual(reduceTabs(on(tab), { type: 'select', tab }), HOME)
  }
  assert.deepEqual(reduceTabs(on('quests'), { type: 'select', tab: 'explore' }), HOME)
  assert.deepEqual(reduceTabs(on('quests'), { type: 'select', tab: 'inv' }), on('inv'))
  assert.deepEqual(reduceTabs(on('inv'), { type: 'select', tab: 'actions' }), on('actions'))
})

test('changing room leaves every tab open, Actions included', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'roomChanged' }), on(tab))
  assert.deepEqual(reduceTabs(HOME, { type: 'roomChanged' }), HOME)
})

test('a fight starting changes nothing on a wide screen', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'fightStarted', phone: false }), on(tab))
})

test('a fight starting on a phone returns to Explore from every tab', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'fightStarted', phone: true }), HOME)
})

test('dying closes everything', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'died' }), HOME)
})

test('Escape closes the tab, then has nothing left', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'escape' }), HOME)
  assert.equal(escapeCloses(on('actions')), true)
  assert.equal(escapeCloses(on('quests')), true)
  assert.equal(escapeCloses(HOME), false)
})
