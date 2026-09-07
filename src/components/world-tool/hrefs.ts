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

/**
 * A quest and a quest giver share the Quests page but are separate anchors:
 * a giver is the section, each of its quests a card inside it. Ids come from
 * the quest registry, so both survive a retitling.
 */
export function questHref(questId: string) {
  return `/quests#${encodeURIComponent(questId)}`
}
export function questGiverHref(giverId: string) {
  return `/quests#${encodeURIComponent(giverId)}`
}

/**
 * The reference pages that are server-rendered tables rather than client
 * lists. Their rows carry `data-anchor` too, so a hit from the rail's search
 * lands on the row and flashes it like everywhere else.
 */
export function skillHref(skillId: string) {
  return `/skills#${encodeURIComponent(skillId)}`
}
export function spellHref(spellId: string) {
  return `/spells#${encodeURIComponent(spellId)}`
}
export function recipeHref(recipeId: string) {
  return `/crafting#${encodeURIComponent(recipeId)}`
}
/** A shop is keyed by the room it stands in. */
export function shopHref(roomId: string) {
  return `/shops#${encodeURIComponent(roomId)}`
}
