// Enemy specials (perks)
//
// An enemy opts into a special by listing its id in `specials` on the enemy
// definition, e.g. `specials: ['power']`. The proc chance and damage rule live
// here, not on the enemy — so balance changes touch one place and every enemy
// carrying the perk behaves identically.
//
// Exactly ONE special resolves per enemy attack. `selectEnemySpecial` walks
// SPECIAL_PRIORITY, rolls each special the enemy actually has, and returns the
// first that procs. That keeps combat resolution table-driven instead of the
// long if/else chain the original grew into (battle.php), where adding a perk
// meant threading a new branch through the whole enemy-attack block and the
// ordering between perks was implicit in the source order.
//
// To add a special later (bite, rage, crit, heal, poison…): add an entry here
// and slot its id into SPECIAL_PRIORITY. Damage-shaped specials implement
// `rollDamage`; specials that do something other than raw damage will need a
// resolution hook in battle-calculator, but the selection step stays the same.

const ENEMY_SPECIALS = {
  power: {
    id: 'power',
    name: 'Power Attack',
    // 1/3 — the original's `$enemypowerattack = rand(1, 3); ... == 1`.
    chance: 1 / 3,
    // Three independent ATT rolls summed. NOT `normal damage x3`: each roll is
    // its own rand(0, att), so a Power Attack averages 1.5x ATT rather than
    // tripling whatever the enemy would otherwise have rolled.
    // The caller subtracts the player's single defense roll from `raw`.
    rollDamage: (enemy, rand) => {
      const rolls = [rand(0, enemy.att), rand(0, enemy.att), rand(0, enemy.att)]
      return { rolls, raw: rolls[0] + rolls[1] + rolls[2] }
    },
  },
}

// Order specials are considered in when an enemy carries more than one.
// Earlier entries win the attack. Later perks slot in here rather than into
// combat's control flow.
const SPECIAL_PRIORITY = ['power']

/**
 * The special ids an enemy definition declares, filtered to ones that exist.
 * Tolerates a missing/!array `specials` field so untouched enemies are unaffected.
 */
function getEnemySpecialIds(enemy) {
  if (!enemy || !Array.isArray(enemy.specials)) return []
  return enemy.specials.filter((id) => Object.hasOwn(ENEMY_SPECIALS, id))
}

function hasSpecial(enemy, id) {
  return getEnemySpecialIds(enemy).includes(id)
}

/**
 * Pick the one special this enemy attack uses, or null for a normal attack.
 * `rand` is injected so combat owns the RNG (and tests can make it deterministic).
 */
function selectEnemySpecial(enemy, rand) {
  const owned = getEnemySpecialIds(enemy)
  if (owned.length === 0) return null

  for (const id of SPECIAL_PRIORITY) {
    if (!owned.includes(id)) continue
    const special = ENEMY_SPECIALS[id]
    // rand(1, N) === 1 for a 1/N chance — same shape as the original's rolls.
    if (rand(1, Math.round(1 / special.chance)) === 1) return special
  }
  return null
}

module.exports = {
  ENEMY_SPECIALS,
  SPECIAL_PRIORITY,
  getEnemySpecialIds,
  hasSpecial,
  selectEnemySpecial,
}
