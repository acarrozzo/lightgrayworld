/**
 * Where each World Tool entity lives.
 *
 * Deliberately a plain module with no `'use client'`: every export of a client
 * module becomes a client reference, so a server component calling one of these
 * to build an href would fail at render. Keeping them here lets both sides use
 * the same targets.
 *
 * Entities are addressed by stable identity — an enemy or item slug, a room id —
 * never by display name, so renaming something never breaks a link.
 */

export function enemyHref(slug: string) {
  return `/enemies#${encodeURIComponent(slug)}`
}
export function itemHref(slug: string) {
  return `/items#${encodeURIComponent(slug)}`
}
export function roomHref(roomId: string) {
  return `/rooms?room=${encodeURIComponent(roomId)}`
}
export function roomDescHref(roomId: string) {
  return `/room-desc#${encodeURIComponent(roomId)}`
}
