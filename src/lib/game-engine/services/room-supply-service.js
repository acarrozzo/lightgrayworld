/**
 * Room supplies: the free, per-player things a room provides (config/room-supplies.js).
 *
 * Two questions, one answer each:
 *   - buildSupplyStatus: what this room offers this player right now — held
 *     count, the room's line, how many a take would give — shaped for the
 *     shelf in the room panel. Rides alongside the room payload the way the
 *     gather countdowns do.
 *   - takeSupply: the take itself. Server-authoritative: the room's cap and the
 *     bag's cap are both re-checked here, and the grant goes through the same
 *     inventory service every other grant uses.
 *
 * Nothing here is shared between players. A take never changes what the next
 * visitor sees, which is what makes "come back if you lose it" safe to say.
 */
const { prisma } = require('../../db-client')
const { getRoomSupplies, supplyCap } = require('../config/room-supplies')
const { getPlayerInventory, grantItemOnce } = require('./inventory-service')
const { pluralizeItemName } = require('./item-names')

/**
 * The feed's tally, in the original's bracket shape: "[ +38 arrows = 50 ]" for
 * a stack, "[ +1 polearm ]" for a single thing you now hold one of.
 */
function feedTally(collected, total, plural) {
  return total > 1 || collected !== total
    ? `[ +${collected} ${plural} = ${total} ]`
    : `[ +${collected} ${plural} ]`
}

function pluralFor(entry, template) {
  return entry.plural ?? pluralizeItemName(template.name)
}

/**
 * Batch-read the templates and held counts behind a room's supply list.
 */
async function loadSupplyContext(playerId, roomId) {
  const entries = getRoomSupplies(roomId)
  if (entries.length === 0) return { entries, templateBySlug: new Map(), heldByTemplateId: new Map() }

  const slugs = Array.from(new Set(entries.map((e) => e.slug)))
  const templates = await prisma.itemTemplate.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, description: true, type: true, max: true, equipSlot: true, metadata: true },
  })
  const templateBySlug = new Map(templates.map((t) => [t.slug, t]))

  const rows = await prisma.playerItem.findMany({
    where: { playerId, templateId: { in: templates.map((t) => t.id) } },
    select: { templateId: true, quantity: true },
  })
  const heldByTemplateId = new Map()
  for (const row of rows) {
    heldByTemplateId.set(row.templateId, (heldByTemplateId.get(row.templateId) ?? 0) + (row.quantity ?? 0))
  }

  return { entries, templateBySlug, heldByTemplateId }
}

/**
 * How many a take would hand over: up to the room's line, never past the bag.
 */
function availableFor(entry, template, held) {
  const cap = supplyCap(entry)
  const bagMax = template.max ?? Infinity
  return Math.max(0, Math.min(cap - held, bagMax - held))
}

/**
 * @returns {Promise<Array<{
 *   id: string, roomId: string, slug: string, name: string, description: string | null,
 *   type: string, equipSlot: string | null, metadata: unknown,
 *   mode: 'take' | 'topUp', cap: number, held: number, available: number,
 *   bagMax: number | null, takeLabel: string, plural: string,
 * }>>}
 */
async function buildSupplyStatus(playerId, roomId) {
  if (!playerId || !roomId) return []
  const { entries, templateBySlug, heldByTemplateId } = await loadSupplyContext(playerId, roomId)
  const rows = []
  for (const entry of entries) {
    const template = templateBySlug.get(entry.slug)
    if (!template) {
      console.warn(`[room-supplies] no template for "${entry.slug}" in room ${roomId}`)
      continue
    }
    const held = heldByTemplateId.get(template.id) ?? 0
    rows.push({
      id: `${roomId}:${entry.slug}`,
      roomId,
      slug: entry.slug,
      name: template.name,
      description: template.description ?? null,
      type: template.type,
      equipSlot: template.equipSlot ?? null,
      metadata: template.metadata ?? null,
      mode: entry.mode,
      cap: supplyCap(entry),
      held,
      available: availableFor(entry, template, held),
      bagMax: typeof template.max === 'number' ? template.max : null,
      takeLabel: entry.take ?? 'Take',
      plural: pluralFor(entry, template),
    })
  }
  return rows
}

/**
 * Take a supply. Returns the feed message and the refreshed inventory and
 * shelf; `success: false` with `outcome: 'info'` for the polite refusals (at
 * the line, bag full), and a plain failure for a slug the room does not offer.
 */
async function takeSupply(playerId, roomId, slug) {
  const entry = getRoomSupplies(roomId).find((e) => e.slug === slug)
  if (!entry) {
    return { success: false, outcome: 'failure', message: 'There is nothing like that to take here.' }
  }

  const template = await prisma.itemTemplate.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, max: true },
  })
  if (!template) {
    return { success: false, outcome: 'failure', message: 'That item is currently unavailable.' }
  }

  const heldRows = await prisma.playerItem.findMany({
    where: { playerId, templateId: template.id },
    select: { quantity: true },
  })
  const held = heldRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
  const cap = supplyCap(entry)
  const plural = pluralFor(entry, template)

  if (held >= cap) {
    const message = entry.full
      ? entry.full(held)
      : entry.mode === 'take'
        ? `You already have ${cap === 1 ? 'a' : cap} ${cap === 1 ? template.name : plural}. Come back here for another if you lose it.`
        : `You already have ${held} ${plural}. Come back if you run low.`
    return { success: false, outcome: 'info', message, held }
  }

  const quantity = availableFor(entry, template, held)
  if (quantity <= 0) {
    return {
      success: false,
      outcome: 'info',
      message: `Your bag cannot hold another ${template.name} (it holds ${template.max}).`,
      held,
    }
  }

  const granted = await grantItemOnce(playerId, slug, quantity)
  if (!granted.granted) {
    return { success: false, outcome: 'info', message: `You cannot carry another ${template.name} right now.`, held }
  }

  const total = held + quantity
  const prose = entry.message
    ? entry.message(quantity, total)
    : entry.mode === 'take'
      ? `You take ${cap === 1 ? 'a' : quantity} ${cap === 1 ? template.name : plural}.`
      : `You take ${quantity} ${plural}.`

  const [inventory, supplies] = await Promise.all([
    getPlayerInventory(playerId),
    buildSupplyStatus(playerId, roomId),
  ])

  return {
    success: true,
    outcome: 'success',
    message: `${prose} ${feedTally(quantity, total, plural)}`,
    quantity,
    total,
    inventory,
    supplies,
  }
}

module.exports = { buildSupplyStatus, takeSupply, feedTally }
