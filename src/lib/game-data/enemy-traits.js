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
  if (b.packChance > 0) {
    traits.push({
      id: 'pack',
      label: 'Pack',
      title: `Pack: a ${pct(b.packChance)} chance each turn that another of the pack joins in — one extra hit rolled at twice its ATT.`,
      tone: 'crit',
    })
  }
  if (b.heals) {
    traits.push({ id: 'heal', label: 'Heal', title: 'Heal: while hurt, 1 turn in 4 it heals rand(1, ATT) instead of attacking.', tone: 'poison' })
  }
  if (b.steals) {
    traits.push({ id: 'steal', label: 'Steal', title: 'Steal: 1 turn in 5 it pickpockets rand(1, ATT) gold on top of its attack.', tone: 'dex' })
  }
  if (b.hpDrain > 0) {
    traits.push({
      id: 'hp-drain',
      label: 'HP Drain',
      title: `HP Drain: every turn it drains up to ${b.hpDrain >= 2 ? 'its level' : 'half its level'} in HP. Nothing blocks it, and it heals by as much.`,
      tone: 'poison',
    })
  }
  if (b.mpDrain > 0) {
    traits.push({
      id: 'mp-drain',
      label: 'MP Drain',
      title: `MP Drain: every turn it drains up to ${b.mpDrain >= 2 ? 'its level' : 'half its level'} in MP.`,
      tone: 'mag',
    })
  }
  if (b.pureDefense) {
    traits.push({ id: 'pure-defense', label: 'Pure Def', title: 'Pure Defense: it blocks with its full DEF every time. An attack that rolls under its DEF does nothing.', tone: 'str' })
  }
  if (b.blockChance > 0) {
    traits.push({
      id: 'enemy-block',
      label: `Block ${pct(b.blockChance)}`,
      title: `Block: a ${pct(b.blockChance)} chance it blocks your whole attack. A spell or strike it blocks costs no MP.`,
      tone: 'str',
    })
  }
  if (b.resurrectChance > 0) {
    traits.push({
      id: 'resurrect',
      label: `Resurrect ${pct(b.resurrectChance)}`,
      title: `Resurrect: a ${pct(b.resurrectChance)} chance, every time it dies, that it stands back up at full HP.`,
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

// --- The perk catalog ---------------------------------------------------------
//
// One entry per kind of trait, for the World Tool's Enemy Perks page: what it
// is in general, rather than what it is on one enemy. The proc perks describe
// themselves from ENEMY_SPECIALS; the standing behaviours are described here,
// keyed by the same trait ids `getEnemyTraits` emits, so the page can find
// every carrier by asking each enemy for its traits.

const PERK_GROUPS = [
  { id: 'attack', label: 'Attack perks', blurb: 'What can replace or reshape one of its hits. At most one fires per hit, checked in the order listed.' },
  { id: 'hits', label: 'Extra hits', blurb: 'Hits after the first. Every extra hit rolls the attack perks again and is blocked on its own.' },
  { id: 'defence', label: 'Defences', blurb: 'What your attacks have to get past.' },
  { id: 'sustain', label: 'Sustain and theft', blurb: 'What it takes from you or gives back to itself.' },
  { id: 'type', label: 'Attack type', blurb: 'Which of your stats blocks its ordinary hits.' },
]

const STANDING_PERKS = [
  { id: 'extra-hits', group: 'hits', name: 'Double / Triple Hit', when: 'every turn',
    rule: 'Every attack is two or three hits. Each hit rolls its own perks and meets its own block.',
    answer: 'DEF works on every hit. Watch what else it carries: each hit can crit, bite or poison.' },
  { id: 'multi-hit', group: 'hits', name: 'Multi-hit', when: 'chance after each hit',
    rule: 'After each hit, a chance of another, and another after that, up to six extra hits in a turn.',
    answer: 'Plan for the long chain, not the average: a 70% multi lands four or more hits about a third of the time.' },
  { id: 'pack', group: 'hits', name: 'Pack', when: 'chance each turn',
    rule: 'Another of the pack joins in: one extra plain hit rolled at twice its ATT.',
    answer: 'DEF blocks the pack hit like any other; it never carries a perk.' },
  { id: 'enemy-dodge', group: 'defence', name: 'Dodge', when: 'chance per attack',
    rule: 'Your whole attack misses. A spell or strike it dodges costs no MP, and a dodged shot spends no ammo.',
    answer: 'Nothing beats it; expect the fight to run 1 ÷ (1 − chance) times as long.' },
  { id: 'enemy-block', group: 'defence', name: 'Block', when: 'chance per attack',
    rule: 'It blocks your whole attack. Nothing is spent, as with a dodge.',
    answer: 'Nothing beats it; a 20% blocker takes a quarter longer to kill.' },
  { id: 'pure-defense', group: 'defence', name: 'Pure Defense', when: 'every attack',
    rule: 'It blocks with its full DEF every time instead of rolling. An attack that rolls under its DEF does nothing.',
    answer: 'A gear check: your attack stat must clear its DEF. At 1.5 times its DEF you deal about a quarter of normal damage.' },
  { id: 'resurrect', group: 'defence', name: 'Resurrect', when: 'chance on death',
    rule: 'Every time it dies it may stand back up at full HP. Rewards come with the death that sticks.',
    answer: 'Keep enough HP and MP in hand to fight it twice.' },
  { id: 'melt', group: 'defence', name: 'Melt', when: 'every melee blow',
    rule: 'A melee swing, and the strike riding it, does half damage. Ranged weapons and spells are unaffected.',
    answer: 'Bring a bow or a spell.' },
  { id: 'flying', group: 'defence', name: 'Flying', when: 'always',
    rule: 'Melee weapons and their strikes cannot reach it unless you are flying too.',
    answer: 'A ranged weapon, a spell, the Wings buff or a flying mount.' },
  { id: 'immune-melee', group: 'defence', name: 'Immune to melee', when: 'always',
    rule: 'Swords, clubs and fists do nothing to it.', answer: 'A ranged weapon or a spell.' },
  { id: 'immune-ranged', group: 'defence', name: 'Immune to ranged', when: 'always',
    rule: 'Arrows, bolts and thrown weapons do nothing to it.', answer: 'A melee weapon or a spell.' },
  { id: 'immune-magic', group: 'defence', name: 'Immune to magic', when: 'always',
    rule: 'Spells and the magic of a Magic Strike do nothing to it, and cost nothing.', answer: 'A weapon.' },
  { id: 'heal', group: 'sustain', name: 'Heal', when: '1 in 4 turns while hurt',
    rule: 'It heals rand(1, ATT) instead of attacking that turn.',
    answer: 'Out-damage it: the heal averages an eighth of its ATT per turn, and each one is a turn it does not hit you.' },
  { id: 'steal', group: 'sustain', name: 'Steal', when: '1 in 5 turns',
    rule: 'It pickpockets rand(1, ATT) gold on top of its attack, up to what you carry.',
    answer: 'Bank or spend your gold before the fight. Stolen gold does not come back with the kill.' },
  { id: 'absorb', group: 'sustain', name: 'HP Absorb', when: 'every turn',
    rule: 'Every point of damage it deals heals it, up to full.',
    answer: 'DEF does double duty: what you block it cannot drink.' },
  { id: 'hp-drain', group: 'sustain', name: 'HP Drain', when: 'every turn',
    rule: 'It drains up to its level in HP (half its level at tier 1). Nothing blocks the drain, and it heals by as much.',
    answer: 'A steady tax on top of its hits; Magic Armor absorbs it.' },
  { id: 'mp-drain', group: 'sustain', name: 'MP Drain', when: 'every turn',
    rule: 'It drains up to half its level in MP (its full level at tier 2).',
    answer: 'Cast early, or bring blue potions; a long fight leaves a caster dry.' },
  { id: 'ranged', group: 'type', name: 'Ranged attacker', when: 'always',
    rule: 'Its attacks are blocked by your DEX, not your DEF.', answer: 'DEX.' },
  { id: 'magic', group: 'type', name: 'Magic attacker', when: 'always',
    rule: 'Its attacks are blocked by your MAG, not your DEF.', answer: 'MAG.' },
]

// The original's perk icons (img/svg/eBite.svg …), carried over into the sprite
// sheet. A perk the original never drew has none.
const PERK_ICONS = {
  power: 'ePow', crit: 'eCrit', rage: 'eRage', bite: 'eBite', poison: 'ePoison', venom: 'ePoison',
  whirlwind: 'eWhirlwind', dragonfire: 'eDragonfire', pure: 'ePureA', divine: 'ePureA', petrify: 'eye',
  'enemy-dodge': 'eDodge', 'enemy-block': 'block', heal: 'eHeal', steal: 'eSteal',
  ranged: 'eDex', magic: 'eMag', flying: 'wings', resurrect: 'skull', melt: 'fire',
}

const chanceText = (chance) => (chance >= 1 ? 'every attack' : `1 in ${Math.round(1 / chance)}`)

/**
 * Every kind of enemy perk, in page order: the attack perks in the order they
 * resolve, then the standing behaviours by group.
 * `chance` is the proc chance (0–1) where the perk has one fixed for every
 * carrier, else null; `icon` is a sprite id or null.
 * @returns {{ id: string, group: string, name: string, when: string, chance: number | null, icon: string | null, grade: string | null, rule: string, answer: string }[]}
 */
function getEnemyPerkCatalog() {
  const attack = SPECIAL_PRIORITY.map((id) => {
    const s = ENEMY_SPECIALS[id]
    const when = s.windUp
      ? `${chanceText(s.chance)} turns, lands the turn after`
      : s.onlyBelowHalfHp
        ? `${chanceText(s.chance)} once below half HP`
        : s.applies === 'poison'
          ? 'every hit while you are not poisoned'
          : chanceText(s.chance)
    return {
      id,
      group: 'attack',
      name: s.name,
      when,
      chance: s.chance,
      icon: PERK_ICONS[id] || null,
      grade: s.grade || null,
      // The rule strings lead with their own name for the battle HUD's tooltip.
      rule: s.rule.replace(/^[^:]+:\s*/, ''),
      answer: s.answer || '',
    }
  })
  return [...attack, ...STANDING_PERKS.map((p) => ({ grade: null, chance: null, icon: PERK_ICONS[p.id] || null, ...p }))]
}

module.exports = { getEnemyTraits, getEnemyPerkCatalog, PERK_GROUPS }
