import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSlashPrefix,
  nextMode,
  chatSubFilterForMode,
  modeForChatSubFilter,
  channelOfEntry,
  MODES,
  CHANNEL_STYLES,
} from '../src/components/feed/feedChannels'

test('a slash prefix switches once a space follows it', () => {
  assert.deepEqual(parseSlashPrefix('/r hello'), { mode: 'room', rest: 'hello' })
  assert.deepEqual(parseSlashPrefix('/W '), { mode: 'world', rest: '' })
  assert.deepEqual(parseSlashPrefix('/party going east'), { mode: 'party', rest: 'going east' })
  assert.deepEqual(parseSlashPrefix('/a rest'), { mode: 'action', rest: 'rest' })
})

test('an unfinished or unknown prefix is left alone', () => {
  assert.equal(parseSlashPrefix('/r'), null)
  assert.equal(parseSlashPrefix('/rest'), null)
  assert.equal(parseSlashPrefix('/dm hopper hi'), null)
  assert.equal(parseSlashPrefix('rest'), null)
  assert.equal(parseSlashPrefix(' /r hi'), null)
})

test('a bare prefix counts on submit', () => {
  assert.deepEqual(parseSlashPrefix('/r', true), { mode: 'room', rest: '' })
  assert.equal(parseSlashPrefix('/rest', true), null)
})

test('Tab cycles round the menu order', () => {
  const order = MODES.map((m) => m.mode)
  let mode = order[0]
  const seen = [mode]
  for (let i = 0; i < order.length - 1; i += 1) {
    mode = nextMode(mode)
    seen.push(mode)
  }
  assert.deepEqual(seen, order)
  assert.equal(nextMode(order[order.length - 1]), order[0])
})

test('the composer and the Chat filter map both ways', () => {
  assert.equal(chatSubFilterForMode('world'), 'world-chat')
  assert.equal(chatSubFilterForMode('room'), 'room-chat')
  assert.equal(chatSubFilterForMode('party'), 'party-chat')
  assert.equal(chatSubFilterForMode('action'), null)
  assert.equal(modeForChatSubFilter('room-chat'), 'room')
  assert.equal(modeForChatSubFilter('all-chat'), null)
})

test('an entry speaks on one channel', () => {
  assert.equal(channelOfEntry({ type: 'world' }), 'world')
  assert.equal(channelOfEntry({ type: 'room' }), 'room')
  assert.equal(channelOfEntry({ type: 'party', eventType: 'fallen' }), 'party')
  assert.equal(channelOfEntry({ type: 'room', eventType: 'login' }), 'events')
  assert.equal(channelOfEntry({ type: 'room', eventType: 'room-enter' }), 'action')
  assert.equal(channelOfEntry({ type: 'action' }), 'action')
  assert.equal(channelOfEntry({ type: 'dm' }), 'dm')
})

test('every channel has its own colour', () => {
  const texts = Object.values(CHANNEL_STYLES).map((s) => s.text)
  assert.equal(new Set(texts).size, texts.length)
})
