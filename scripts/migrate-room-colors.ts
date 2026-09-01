/**
 * One-shot migration of the authored room colours in prisma/seed.ts.
 *
 * Rewrites `nameColor`, `subtitleColor`, `iconColor` and `directionColors` from
 * raw Tailwind fragments to semantic tokens, and stamps each room with the
 * `region` it belongs to. Idempotent: values already in token form are left
 * alone, and a room that already has a `region` is not given a second one.
 *
 * Run once, review the diff, commit. Kept in the tree because the same mapping
 * has to be applied to live rows (see the SQL in the matching migration), and
 * having both derive from `legacyRoomColorToken` is what stops them diverging.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { legacyRoomColorToken, type RoomColorSlot } from '../src/lib/theme/room-colors'
import { getRegionForRoom } from '../src/lib/theme/regions'

const SEED = join(process.cwd(), 'prisma/seed.ts')
const source = readFileSync(SEED, 'utf8')

const SLOT_BY_FIELD: Record<string, RoomColorSlot> = {
  nameColor: 'title',
  subtitleColor: 'subtitle',
  iconColor: 'icon',
}

let rewritten = 0
let regioned = 0
const unmapped = new Map<string, number>()

function tokenFor(value: string, slot: RoomColorSlot): string | null {
  const token = legacyRoomColorToken(value, slot)
  if (!token) {
    unmapped.set(`${slot}:${value}`, (unmapped.get(`${slot}:${value}`) ?? 0) + 1)
    return null
  }
  return token
}

/**
 * Split the seed into room objects so every edit is scoped to one room and its
 * own id, which is what the region stamp needs.
 */
const ROOM_BLOCK = /(\{\s*\n\s*roomId: '([A-Za-z0-9_-]+)',)([\s\S]*?)(\n\s*\},?\n)/g

const output = source.replace(ROOM_BLOCK, (match, head, roomId, body, tail) => {
  let next: string = body

  // Colour fields.
  for (const [field, slot] of Object.entries(SLOT_BY_FIELD)) {
    const re = new RegExp(`(${field}: ')([^']*)(')`, 'g')
    next = next.replace(re, (whole, prefix, value, suffix) => {
      const token = tokenFor(value, slot)
      if (!token || token === value) return whole
      rewritten++
      return `${prefix}${token}${suffix}`
    })
  }

  // directionColors is an object literal of direction -> value.
  next = next.replace(/(directionColors: \{)([^}]*)(\})/g, (whole, open, inner, close) => {
    const mapped = inner.replace(/'([^']*)'/g, (q: string, value: string) => {
      const token = tokenFor(value, 'direction')
      if (!token || token === value) return q
      rewritten++
      return `'${token}'`
    })
    return `${open}${mapped}${close}`
  })

  // Region stamp, placed immediately after roomId so it reads as identity.
  let newHead: string = head
  if (!/\n\s*region: '/.test(body)) {
    const indent = /\n(\s*)roomId:/.exec(head)?.[1] ?? '      '
    newHead = `${head}\n${indent}region: '${getRegionForRoom(roomId)}',`
    regioned++
  }

  return `${newHead}${next}${tail}`
})

writeFileSync(SEED, output, 'utf8')

console.log(`migrate-room-colors: rewrote ${rewritten} colour values, stamped ${regioned} regions`)
if (unmapped.size > 0) {
  console.log('\nValues with no mapping (left as-is, will fall back to the region palette):')
  for (const [key, count] of [...unmapped].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key} x${count}`)
  }
}
