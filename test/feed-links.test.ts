import test from 'node:test'
import assert from 'node:assert/strict'
import { findMentionedItem } from '../src/lib/feed-links'

const bag = [
  { id: 'a', name: 'Shovel' },
  { id: 'b', name: 'Ring' },
  { id: 'c', name: 'Iron Ring' },
  { id: 'd', name: 'Key' },
  { id: 'e', name: 'Welcome Book' },
]
const word = (message: string) => {
  const hit = findMentionedItem(message, bag)
  return hit ? { id: hit.itemId, text: message.slice(hit.start, hit.end) } : null
}

test('finds the carried item a message names, whatever its case', () => {
  assert.deepEqual(word('You pick up a shovel.'), { id: 'a', text: 'shovel' })
  assert.deepEqual(word('You read the Welcome Book.'), { id: 'e', text: 'Welcome Book' })
})

test('the longest name wins, and only whole words count', () => {
  assert.deepEqual(word('You put on the iron ring.'), { id: 'c', text: 'iron ring' })
  assert.equal(word('A monkey laughs at you.'), null)
  assert.equal(word('You are bringing nothing.'), null)
})

test('a plural still points at the item', () => {
  assert.deepEqual(word('You found two shovels!'), { id: 'a', text: 'shovels' })
})

test('nothing carried, nothing named, or no message: no link', () => {
  assert.equal(findMentionedItem('You pick up a shovel.', []), null)
  assert.equal(word('You rest for a while.'), null)
  assert.equal(findMentionedItem(undefined, bag), null)
})
