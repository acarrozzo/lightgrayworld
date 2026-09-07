// Enemy traits — the tags the battle HUD shows next to an enemy.
//
// The original's HUD (hud.php) drew a row of small coloured "buffBox" tags
// under the enemy's eATT/eDEF: Pow, Bite, Crit, Rage, Pure A for perks, then
// Flying, Range, Mag for how it attacks, and Str Imm / Dex Imm / Mag Imm for
// what it shrugs off. This module derives that same row from a modern enemy
// definition so the battle panel, the room card and (later) the World Tool
// read one list instead of each re-deriving it from flags.
//
// Shared by client and server (CommonJS, like crafting-recipes.js). Purely a
// projection of static enemy data: nothing here changes during a fight.
//
// `tone` is a semantic colour role, not a colour: the UI maps it to theme
// classes. 'crit' for perks (matching the crit tone the damage number already
// uses when one fires), 'sky' for Flying, and the stat the tag concerns for
// attack type and immunities (DEX for ranged, MAG for magic, STR for melee).

const { ENEMY_SPECIALS, SPECIAL_PRIORITY, getEnemySpecialIds } = require('./enemy-specials')

/**
 * @typedef {'crit' | 'sky' | 'str' | 'dex' | 'mag'} EnemyTraitTone
 * @typedef {{ id: string, label: string, title: string, tone: EnemyTraitTone }} EnemyTrait
 */

/**
 * The trait tags for an enemy definition, in HUD order: perks first (in the
 * order they resolve), then Flying, then attack type, then immunities.
 * Tolerates a partial enemy shape (the room card gets the full definition,
 * but anything missing simply produces no tag).
 * @returns {EnemyTrait[]}
 */
function getEnemyTraits(enemy) {
  if (!enemy) return []
  const traits = []

  const owned = getEnemySpecialIds(enemy)
  for (const id of SPECIAL_PRIORITY) {
    if (!owned.includes(id)) continue
    const special = ENEMY_SPECIALS[id]
    traits.push({ id, label: special.label ?? special.name, title: special.rule ?? special.name, tone: 'crit' })
  }

  if (enemy.isFlying) {
    traits.push({
      id: 'flying',
      label: 'Flying',
      title: 'Flying: melee weapons cannot reach it. Use a ranged weapon, a spell, or a magic strike.',
      tone: 'sky',
    })
  }

  if (enemy.damageType === 'RANGED') {
    traits.push({ id: 'ranged', label: 'Ranged', title: 'Ranged attacker: its attacks are blocked by your DEX, not your DEF.', tone: 'dex' })
  } else if (enemy.damageType === 'MAGIC') {
    traits.push({ id: 'magic', label: 'Magic', title: 'Magic attacker: its attacks are blocked by your MAG, not your DEF.', tone: 'mag' })
  }

  if (enemy.isMeleeImmune) {
    traits.push({ id: 'immune-melee', label: 'No Melee', title: 'Immune to melee: swords, clubs and fists do nothing to it.', tone: 'str' })
  }
  if (enemy.isRangedImmune) {
    traits.push({ id: 'immune-ranged', label: 'No Ranged', title: 'Immune to ranged: arrows and bolts do nothing to it.', tone: 'dex' })
  }
  if (enemy.isMagicImmune) {
    traits.push({ id: 'immune-magic', label: 'No Magic', title: 'Immune to magic: spells and magic strikes do nothing to it.', tone: 'mag' })
  }

  return traits
}

module.exports = { getEnemyTraits }
