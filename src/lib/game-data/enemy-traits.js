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
// uses when one fires), 'poison' for the poison perks, 'sky' for Flying, and
// the stat the tag concerns for attack type and immunities (DEX for ranged,
// MAG for magic, STR for melee).

const { ENEMY_SPECIALS, SPECIAL_PRIORITY, getEnemySpecialIds, getEnemyBehaviours } = require('./enemy-specials')

const pct = (chance) => `${Math.round(chance * 100)}%`

/**
 * @typedef {'crit' | 'poison' | 'sky' | 'str' | 'dex' | 'mag'} EnemyTraitTone
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
    traits.push({
      id,
      label: special.label ?? special.name,
      title: special.rule ?? special.name,
      tone: special.applies === 'poison' ? 'poison' : 'crit',
    })
  }

  // The standing behaviours, after the procs: how often it swings again, how
  // it slips your attacks, what it does with the damage it deals.
  const b = getEnemyBehaviours(enemy)
  if (b.extraHits > 0) {
    traits.push({
      id: 'extra-hits',
      label: b.extraHits >= 2 ? 'Triple Hit' : 'Double Hit',
      title: `${b.extraHits >= 2 ? 'Triple' : 'Double'} Hit: every attack is ${b.extraHits + 1} hits, each blocked on its own.`,
      tone: 'crit',
    })
  }
  if (b.multiHitChance > 0) {
    traits.push({
      id: 'multi-hit',
      label: `Multi ${pct(b.multiHitChance)}`,
      title: `Multi-hit: after each hit lands, a ${pct(b.multiHitChance)} chance it hits again — and again after that.`,
      tone: 'crit',
    })
  }
  if (b.dodgeChance > 0) {
    traits.push({
      id: 'enemy-dodge',
      label: `Dodge ${pct(b.dodgeChance)}`,
      title: `Dodge: a ${pct(b.dodgeChance)} chance your attack misses it entirely. A spell or strike it dodges costs no MP.`,
      tone: 'dex',
    })
  }
  if (b.absorbsHp) {
    traits.push({
      id: 'absorb',
      label: 'Absorb',
      title: 'HP Absorb: every point of damage it deals heals it, up to full.',
      tone: 'poison',
    })
  }
  if (b.meltsMelee) {
    traits.push({
      id: 'melt',
      label: 'Melt',
      title: 'Melt: a melee swing does half damage — the magma takes the blow and the blade with it. Ranged and magic are unaffected.',
      tone: 'str',
    })
  }

  if (enemy.isFlying) {
    traits.push({
      id: 'flying',
      label: 'Flying',
      title: 'Flying: melee weapons and their strikes cannot reach it unless you are flying too (wings or a flying mount). Otherwise use a ranged weapon or a spell.',
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
