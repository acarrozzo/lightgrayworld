import test from 'node:test'
import assert from 'node:assert/strict'
import { decideFeedFollow, newEntriesSince, FOLLOW_THRESHOLD_PX } from '../src/components/feed/feedFollow'
import type { WorldFeedEntry } from '../src/store/worldFeedStore'

const CAP = 500

const entry = (id: number, type: WorldFeedEntry['type'] = 'room', eventType?: string): WorldFeedEntry => ({
  id: `e${id}`,
  ts: id,
  type,
  message: `line ${id}`,
  ...(eventType ? { eventType } : {}),
})

const feedOf = (from: number, to: number, type?: WorldFeedEntry['type']) => {
  const out: WorldFeedEntry[] = []
  for (let i = from; i <= to; i += 1) out.push(entry(i, type))
  return out
}

test('new entries are found by id when the capped store keeps the same length', () => {
  const prev = feedOf(1, CAP)
  const next = [...prev.slice(1), entry(CAP + 1)]
  assert.equal(prev.length, next.length)
  const fresh = newEntriesSince(prev, next)
  assert.deepEqual(fresh.map((e) => e.id), ['e501'])
})

test('a burst at the cap reports every new line', () => {
  const prev = feedOf(1, CAP)
  const next = [...prev.slice(3), entry(CAP + 1), entry(CAP + 2), entry(CAP + 3)]
  assert.deepEqual(newEntriesSince(prev, next).map((e) => e.id), ['e501', 'e502', 'e503'])
})

test('a cleared or replaced feed treats everything as new', () => {
  assert.equal(newEntriesSince(feedOf(1, 5), feedOf(10, 12)).length, 3)
  assert.equal(newEntriesSince([], feedOf(1, 3)).length, 3)
  assert.equal(newEntriesSince(feedOf(1, 3), []).length, 0)
})

test('an unchanged array (link added to an entry, no append) does nothing', () => {
  const prev = feedOf(1, 10)
  const next = prev.map((e) => ({ ...e }))
  const d = decideFeedFollow(prev, next, 0)
  assert.equal(d.follow, false)
  assert.equal(d.unreadChat, 0)
})

test('near the bottom follows other players\' lines at the cap', () => {
  const prev = feedOf(1, CAP)
  const next = [...prev.slice(1), entry(CAP + 1, 'world')]
  assert.equal(decideFeedFollow(prev, next, FOLLOW_THRESHOLD_PX - 1).follow, true)
  assert.equal(decideFeedFollow(prev, next, FOLLOW_THRESHOLD_PX).follow, false)
})

test('your own action follows even when scrolled up', () => {
  const prev = feedOf(1, 10)
  const next = [...prev, entry(11, 'action')]
  const d = decideFeedFollow(prev, next, 2000)
  assert.equal(d.follow, true)
  assert.equal(d.unreadChat, 0)
})

test('scrolled up, only chat lines count as unread', () => {
  const prev = feedOf(1, 10)
  const next = [...prev, entry(11, 'world'), entry(12, 'party'), entry(13, 'room', 'room-enter'), entry(14, 'room')]
  const d = decideFeedFollow(prev, next, 2000)
  assert.equal(d.follow, false)
  assert.equal(d.unreadChat, 3)
})

test('an unmeasured list (first paint) follows', () => {
  assert.equal(decideFeedFollow([], feedOf(1, 3), null).follow, true)
})
