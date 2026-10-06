import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME, escapeCloses, reduceTabs, type TabId, type TabState } from '../src/lib/tab-rules'

const on = (tab: TabId, actionOpen = false): TabState => ({ tab, actionOpen })
const EVERY_TAB: TabId[] = ['char', 'inv', 'world', 'quests', 'players', 'feed', 'settings']

test('selecting a tab opens it, and its own tile goes home', () => {
  for (const tab of EVERY_TAB) {
    assert.deepEqual(reduceTabs(HOME, { type: 'select', tab }), on(tab))
    assert.deepEqual(reduceTabs(on(tab), { type: 'select', tab }), HOME)
  }
  assert.deepEqual(reduceTabs(on('quests'), { type: 'select', tab: 'explore' }), HOME)
  assert.deepEqual(reduceTabs(on('quests'), { type: 'select', tab: 'inv' }), on('inv'))
})

test('selecting a tab closes Action; Action is only ever over Explore', () => {
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'select', tab: 'char' }), on('char'))
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'select', tab: 'explore' }), HOME)
})

test('the Action button toggles on Explore and opens from any other tab', () => {
  assert.deepEqual(reduceTabs(HOME, { type: 'toggleAction' }), on('explore', true))
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'toggleAction' }), HOME)
  assert.deepEqual(reduceTabs(on('inv'), { type: 'toggleAction' }), on('explore', true))
})

test('changing room leaves every tab open and closes only Action', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'roomChanged' }), on(tab))
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'roomChanged' }), HOME)
})

test('a fight starting changes nothing on a wide screen', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'fightStarted', phone: false }), on(tab))
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'fightStarted', phone: false }), on('explore', true))
})

test('a fight starting on a phone returns to Explore from every tab', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'fightStarted', phone: true }), HOME)
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'fightStarted', phone: true }), HOME)
})

test('dying closes everything', () => {
  for (const tab of EVERY_TAB) assert.deepEqual(reduceTabs(on(tab), { type: 'died' }), HOME)
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'died' }), HOME)
})

test('Escape closes Action first, then the tab, then has nothing left', () => {
  assert.deepEqual(reduceTabs(on('explore', true), { type: 'escape' }), HOME)
  assert.deepEqual(reduceTabs(on('quests'), { type: 'escape' }), HOME)
  assert.equal(escapeCloses(on('explore', true)), true)
  assert.equal(escapeCloses(on('quests')), true)
  assert.equal(escapeCloses(HOME), false)
})
