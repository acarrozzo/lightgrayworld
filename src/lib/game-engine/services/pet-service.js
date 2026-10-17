/**
 * Pets, the server half: which pet is along, and what it says on arrival.
 *
 * `User.activePet` is the durable truth (a pet slug, or null). It is set from
 * the bag through `use_item` with "take along" / "leave home" and checked
 * against the bag here: you can only take along a pet you hold. The call is
 * free, costs no turn and provokes nothing, which the room state honours by
 * returning before its turn resolution.
 *
 * What the pet has already said is process-local and per player, reset on
 * restart: a repeated line after a redeploy is no loss, and it keeps the
 * table out of the database.
 */
const { prisma } = require('../../db-client')
const { getPet, isPetMetadata, pickPetLine } = require('../../game-data/pets')
const { getMapIdForRoom } = require('../../game-data/world-map')

/** playerId -> Set of line keys this pet has said to them (see pets.js). */
const saidLines = new Map()

/**
 * Take a pet along (`slug`) or leave it home (`null`). Returns
 * `{ success, activePet, pet, message }`; a refusal names why.
 */
async function setActivePet(playerId, slug) {
  if (slug === null || slug === undefined) {
    await prisma.user.update({ where: { id: playerId }, data: { activePet: null } })
    return { success: true, activePet: null, pet: null }
  }
  const pet = getPet(slug)
  if (!pet) return { success: false, message: 'That is not a pet.' }
  const held = await prisma.playerItem.findFirst({
    where: { playerId, ItemTemplate: { slug } },
    select: { id: true, ItemTemplate: { select: { metadata: true } } },
  })
  if (!held || !isPetMetadata(held.ItemTemplate?.metadata)) {
    return { success: false, message: `You do not have a ${pet.name}.` }
  }
  await prisma.user.update({ where: { id: playerId }, data: { activePet: slug } })
  return { success: true, activePet: slug, pet }
}

/** The active pet's slug for a player, from the row. */
async function getActivePet(playerId) {
  const row = await prisma.user.findUnique({ where: { id: playerId }, select: { activePet: true } })
  return row?.activePet ?? null
}

/**
 * The line the player's pet says on arriving in `roomId`, or null when it
 * keeps quiet. Remembers what it has said so nothing repeats until the pet
 * has said everything the place could offer.
 */
function petLineOnArrival(playerId, activePetSlug, roomId, rand = Math.random) {
  const pet = getPet(activePetSlug)
  if (!pet || !roomId) return null
  let said = saidLines.get(playerId)
  if (!said) {
    said = new Set()
    saidLines.set(playerId, said)
  }
  const picked = pickPetLine(pet, { roomId, sheetId: getMapIdForRoom(roomId) }, said, rand)
  if (!picked) return null
  said.add(picked.key)
  return picked.line
}

/** Forget what a player's pet has said: for tests, or a player gone for good. */
function forgetPetLines(playerId) {
  saidLines.delete(playerId)
}

module.exports = {
  setActivePet,
  getActivePet,
  petLineOnArrival,
  forgetPetLines,
}
