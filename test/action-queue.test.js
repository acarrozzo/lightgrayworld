/**
 * Per-player action serialization.
 *
 * The queue's whole job is that one player's actions never overlap. The subtle
 * failure is the timeout: an in-flight promise cannot be cancelled, so answering
 * the caller early must NOT be treated as the action having stopped. Releasing
 * the lane on timeout let the player's retry run concurrently with the original
 * — and timeouts only happen when the database is slow, which is exactly when a
 * player retries.
 *
 * Pure in-memory; no database, no sockets.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const {
  PlayerActionQueue,
  DEFAULT_ACTION_TIMEOUT_MS,
} = require(path.join(ROOT, 'src/lib/game-engine/player-action-queue.js'))

const silent = { info() {}, warn() {}, error() {} }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const swallow = (p) => p.then(() => {}, () => {})

test('the exported default timeout is what the queue actually uses', () => {
  const q = new PlayerActionQueue({ logger: silent })
  assert.equal(q.timeoutMs, DEFAULT_ACTION_TIMEOUT_MS)
})

test('actions for one player run strictly one at a time', async () => {
  const q = new PlayerActionQueue({ logger: silent })
  const order = []
  let concurrent = 0
  let maxConcurrent = 0

  const task = (name) => async () => {
    concurrent++
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    await wait(10)
    order.push(name)
    concurrent--
  }

  await Promise.all([
    q.enqueueAction('p1', task('a')),
    q.enqueueAction('p1', task('b')),
    q.enqueueAction('p1', task('c')),
  ])

  assert.equal(maxConcurrent, 1, 'actions overlapped')
  assert.deepEqual(order, ['a', 'b', 'c'])
})

test('different players are not serialized against each other', async () => {
  const q = new PlayerActionQueue({ logger: silent })
  let concurrent = 0
  let maxConcurrent = 0
  const task = async () => {
    concurrent++
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    await wait(20)
    concurrent--
  }

  await Promise.all([q.enqueueAction('p1', task), q.enqueueAction('p2', task)])
  assert.equal(maxConcurrent, 2, 'one player blocked another')
})

test('a timed-out action rejects the caller with ACTION_TIMEOUT', async () => {
  const q = new PlayerActionQueue({ timeoutMs: 20, logger: silent })
  const err = await q.enqueueAction('p1', () => wait(80)).then(
    () => null,
    (e) => e
  )
  assert.ok(err, 'the caller was not rejected')
  assert.equal(err.code, 'ACTION_TIMEOUT')
  await wait(120) // let the orphan settle so the test ends clean
})

test('a timeout does NOT release the lane — the retry cannot overlap the original', async () => {
  const q = new PlayerActionQueue({ timeoutMs: 20, logger: silent })
  const running = []
  let slowFinished = false

  // Slow action: times out at 20ms but keeps running until 100ms.
  const slow = q.enqueueAction('p1', async () => {
    running.push('slow:start')
    await wait(100)
    slowFinished = true
    running.push('slow:end')
  })
  await swallow(slow)

  // The caller has been told it timed out. A player retrying right now must not
  // start executing while the original is still writing.
  assert.equal(slowFinished, false, 'precondition: the slow action is still running')

  let retryStarted = false
  const retry = q.enqueueAction('p1', async () => {
    retryStarted = true
    running.push('retry:start')
  })

  await wait(40) // still inside the slow action's runtime
  assert.equal(retryStarted, false, 'the retry began while the original was still in flight')

  await retry
  assert.equal(slowFinished, true, 'the retry ran before the original finished')
  assert.deepEqual(running, ['slow:start', 'slow:end', 'retry:start'])
})

test('the lane is released once the timed-out action finally settles', async () => {
  const q = new PlayerActionQueue({ timeoutMs: 20, logger: silent })
  await swallow(q.enqueueAction('p1', () => wait(60)))
  assert.equal(q.isPlayerBusy('p1'), true, 'lane freed while the action was in flight')

  await wait(80)
  assert.equal(q.isPlayerBusy('p1'), false, 'lane never freed after the action settled')

  // And the player can act again normally.
  const result = await q.enqueueAction('p1', async () => 'ok')
  assert.equal(result, 'ok')
})

test('an action that rejects after timing out does not crash the queue', async () => {
  const q = new PlayerActionQueue({ timeoutMs: 20, logger: silent })
  await swallow(
    q.enqueueAction('p1', async () => {
      await wait(60)
      throw new Error('late failure')
    })
  )
  await wait(80)
  assert.equal(q.isPlayerBusy('p1'), false)
  assert.equal(await q.enqueueAction('p1', async () => 'still works'), 'still works')
})

test('a full queue rejects rather than growing without bound', async () => {
  const q = new PlayerActionQueue({ maxQueueLength: 2, logger: silent })
  const blocker = q.enqueueAction('p1', () => wait(40))
  const queued = [
    swallow(q.enqueueAction('p1', async () => {})),
    swallow(q.enqueueAction('p1', async () => {})),
  ]

  const err = await q.enqueueAction('p1', async () => {}).then(
    () => null,
    (e) => e
  )
  assert.ok(err, 'the overflowing action was accepted')
  assert.equal(err.code, 'QUEUE_FULL')

  await blocker
  await Promise.all(queued)
})

test('clearPlayer rejects everything still waiting', async () => {
  const q = new PlayerActionQueue({ logger: silent })
  const blocker = q.enqueueAction('p1', () => wait(40))
  const pending = q.enqueueAction('p1', async () => 'never runs')

  q.clearPlayer('p1', { rejectPending: true })

  const err = await pending.then(
    () => null,
    (e) => e
  )
  assert.equal(err?.code, 'PLAYER_CLEARED')
  await blocker
})
