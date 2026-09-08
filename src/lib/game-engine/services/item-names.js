/**
 * Item naming helpers shared by the feed-writing services (room pickups and
 * drops, room supplies, gathers).
 */

/**
 * A regular English plural of an item name: berry → berries, box → boxes,
 * arrow → arrows. Irregular names supply their own `plural` where they are
 * defined rather than growing a dictionary here.
 */
function pluralizeItemName(name) {
  if (!name) return name
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/i.test(name)) return name + 'es'
  return name + 's'
}

/** "a Hatchet" / "3 Hatchets" */
function countedName(name, quantity) {
  return quantity === 1 ? `a ${name}` : `${quantity} ${pluralizeItemName(name)}`
}

module.exports = { pluralizeItemName, countedName }
