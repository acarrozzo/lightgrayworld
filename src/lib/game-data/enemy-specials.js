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
// To add a special later (heal, steal, multi-hit…): add an entry here and
// slot its id into SPECIAL_PRIORITY. Damage-shaped specials implement
// `rollDamage`; specials that do something other than raw damage need a
// resolution hook in battle-calculator, but the selection step stays the same.
//
// Two such hooks exist. `bypassesDefense: true` is the original's "pure"
// damage, where the number the enemy rolls is the number you take and your DEF
// never enters the arithmetic; battle-calculator reports the block as 0 on
// those turns so the formula the player reads stays honest. `applies:
// 'poison'` is an ordinary hit that also leaves poison behind (`rollPoison`);
// it is only offered while the player can actually be poisoned, which is what
// made it fire on every hit in the original rather than at random.

const ENEMY_SPECIALS = {
  power: {
    id: 'power',
    name: 'Power Attack',
    label: 'Power',
    rule: 'Power Attack: 1 in 3 attacks rolls ATT three times and sums them.',
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
  crit: {
    id: 'crit',
    name: 'Critical Attack',
    label: 'Crit',
    rule: 'Critical Attack: 1 in 10 attacks rolls ATT ten times and sums them.',
    // 1/10 — `$enemycritattack = rand(1, 10); ... == 1`.
    chance: 1 / 10,
    // Ten independent ATT rolls summed, blocked once. Averages 5x ATT, which is
    // why it is rare: a critical from Red Beard or a Stone Assassin ends most
    // fights that were already going badly.
    rollDamage: (enemy, rand) => {
      const rolls = Array.from({ length: 10 }, () => rand(0, enemy.att))
      return { rolls, raw: rolls.reduce((sum, r) => sum + r, 0) }
    },
  },
  rage: {
    id: 'rage',
    name: 'Rage',
    label: 'Rage',
    rule: 'Rage: 1 in 5 attacks lands 2 to 4 hits at full ATT. Your DEF does not block them.',
    // 1/5 — `$enemyrage = rand(1, 5); ... == 1`.
    chance: 1 / 5,
    // A 2-to-4 hit combo at FULL attack each, with no roll and no block. The
    // Minotaur's whole reputation: `$edamagetotal = $enemyatt * $rageCombo`.
    bypassesDefense: true,
    rollDamage: (enemy, rand) => {
      const hits = rand(2, 4)
      const rolls = Array.from({ length: hits }, () => enemy.att)
      return { rolls, raw: enemy.att * hits }
    },
  },
  bite: {
    id: 'bite',
    name: 'Bite',
    label: 'Bite',
    rule: 'Bite: 1 in 5 attacks hits twice at full ATT. Your DEF does not block it.',
    // 1/5 — `$enemybite = rand(1, 5); ... == 1`.
    chance: 1 / 5,
    // Two hits at full attack, pure. Rats, skeevers and the War Turtle all carry
    // it, and it is what makes an ordinary-looking mine rat dangerous.
    bypassesDefense: true,
    rollDamage: (enemy) => ({ rolls: [enemy.att, enemy.att], raw: enemy.att * 2 }),
  },
  poison: {
    id: 'poison',
    name: 'Poison Attack',
    label: 'Poison',
    rule: 'Poison: while you are not already poisoned, every hit leaves rand(1, your level ÷ 2) poison. Each click it burns for one less until it is gone.',
    // Not a proc: the original's `ePoison` branch ran on every attack while
    // `poisonyou < 1` — declared at chance 1 and filtered by `canPoison`.
    chance: 1,
    applies: 'poison',
    // The hit itself is an ordinary rand(0, ATT), blocked as usual.
    rollDamage: (enemy, rand) => {
      const r = rand(0, enemy.att)
      return { rolls: [r], raw: r }
    },
    // ePoison 1: rand(1, lvl / 2), lvl being the PLAYER's level.
    rollPoison: (level, rand) => rand(1, Math.max(1, Math.floor((Number(level) || 1) / 2))),
  },
  venom: {
    id: 'venom',
    name: 'Venom Attack',
    label: 'Venom',
    rule: 'Venom: while you are not already poisoned, every hit leaves rand(1, your level) poison. Each click it burns for one less until it is gone.',
    chance: 1,
    applies: 'poison',
    rollDamage: (enemy, rand) => {
      const r = rand(0, enemy.att)
      return { rolls: [r], raw: r }
    },
    // ePoison 2: rand(1, lvl).
    rollPoison: (level, rand) => rand(1, Math.max(1, Math.floor(Number(level) || 1))),
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind Attack',
    label: 'Whirlwind',
    rule: 'Whirlwind: 1 in 4 attacks rolls ATT six times and sums them.',
    // 1/4 — `$enemywhirlwindattack = rand(1, 4); ... == 1`. King Blade and the
    // Silver Titan: six ATT rolls, blocked once, like a crit with fewer swings.
    chance: 1 / 4,
    rollDamage: (enemy, rand) => {
      const rolls = Array.from({ length: 6 }, () => rand(0, enemy.att))
      return { rolls, raw: rolls.reduce((sum, r) => sum + r, 0) }
    },
  },
  dragonfire: {
    id: 'dragonfire',
    name: 'Firebreath',
    label: 'Firebreath',
    rule: 'Firebreath: 1 in 4 attacks is 3 to 5 gouts of flame at full ATT. Your DEF does not block them.',
    // 1/4 — `$enemydragonfire = rand(1, 4); ... == 1`. The Dragon's whole
    // reputation: `$edamagetotal = $enemyatt * rand(3, 5)`, pure. The original
    // comment also promised "catch on fire, burn forever, cure with water" and
    // never wrote it; the breath is what shipped.
    chance: 1 / 4,
    bypassesDefense: true,
    rollDamage: (enemy, rand) => {
      const gouts = rand(3, 5)
      const rolls = Array.from({ length: gouts }, () => enemy.att)
      return { rolls, raw: enemy.att * gouts }
    },
  },
  petrify: {
    id: 'petrify',
    name: 'Petrifying Gaze',
    label: 'Petrify',
    rule: 'Petrify: 1 in 5 attacks turns you to stone for 1 to 2 turns. Stone cannot swing, cast, drink or run; it keeps attacking you.',
    // The Despair's Gorgon and Medusa (2026-10-02, Anthony's call: 1–2 turns).
    // The hit itself is an ordinary rand(0, ATT); it is what follows that
    // hurts. Only offered while the player is not already stone.
    chance: 1 / 5,
    applies: 'petrify',
    rollDamage: (enemy, rand) => {
      const r = rand(0, enemy.att)
      return { rolls: [r], raw: r }
    },
    rollPetrify: (rand) => rand(1, 2),
  },
  pure: {
    id: 'pure',
    name: 'Pure Attack',
    label: 'Pure',
    rule: 'Pure Attack: every attack deals full ATT. Your DEF never blocks it.',
    // Not a proc: the original's `ePureA` is a standing property that replaced
    // the damage line on EVERY attack (`$edamagetotal = $enemyatt`). Declared
    // here at chance 1 so it flows through the same selection step as the rest.
    chance: 1,
    bypassesDefense: true,
    rollDamage: (enemy) => ({ rolls: [enemy.att], raw: enemy.att }),
  },
}

// Order specials are considered in when an enemy carries more than one.
// Earlier entries win the attack. Later perks slot in here rather than into
// combat's control flow.
// This is the original's own if/else order in battle.php: whirlwind, then
// firebreath, then crit, then rage, then power, then bite, with the standing
// pure modifier last so a Cyclops that also rolled something rarer still shows
// the rarer thing.
const SPECIAL_PRIORITY = ['whirlwind', 'dragonfire', 'crit', 'rage', 'power', 'bite', 'poison', 'venom', 'petrify', 'pure']

// --- Standing behaviours ------------------------------------------------------
//
// Not procs: properties an enemy has on every turn, read straight off its
// definition. They were the original's `eMulti`, `eDoubleHit`/`eTripleHit`
// and `eDodge` session flags (battle.php), plus three the Despair added.
//
//   multiHitChance  0–1   After each hit lands, this chance of another full
//                         hit, rolled again after every extra one (the
//                         original's `while` loop: eMulti N = N×10%).
//   extraHits       1|2   Hits that always follow the first — eDoubleHit is
//                         one extra, eTripleHit two.
//   dodgeChance     0–1   The enemy steps out of the player's attack entirely:
//                         nothing lands, and a spell or strike that would have
//                         cost MP costs nothing (eDodge N = N×10%).
//   absorbsHp       bool  Every point of damage it deals heals it, up to its
//                         own full HP.
//   meltsMelee      bool  A melee swing (and the strike riding it) does half
//                         damage: the magma takes the blow and the blade.
//
//   packChance      0–1   Pack animal (wolf, coyote): this chance, once a turn,
//                         that another of the pack joins in with one extra hit
//                         rolled at twice the ATT.
//   heals           bool  The original's eHeal: while hurt, 1 turn in 4 it
//                         heals rand(1, ATT) instead of attacking.
//   steals          bool  eSteal: 1 turn in 5 it lifts rand(1, ATT) gold. The
//                         theft rides on top of the attack (2026-10-03,
//                         Anthony's call); the original stole instead of hitting.
//   pureDefense     bool  ePureD: it blocks with its full DEF every time
//                         instead of rolling rand(0, DEF).
//   blockChance     0–1   eBlock ("block all damage, 1/5 chance", declared in
//                         the original and never written): the attack lands on
//                         its guard and does nothing. Rolled with Dodge, before
//                         anything is charged.
//   hpDrain         1|2   eDrainHP: every turn it drains rand(1, its level ÷ 2)
//                         (1) or rand(1, its level) (2) HP, unblockable, and
//                         heals itself by as much.
//   mpDrain         1|2   eDrainMP: the same roll, taken from the player's MP.
//   resurrectChance 0–1   eResurrect: when it dies, this chance it stands
//                         back up at full HP. Rolled on every death.
//
// Chains of extra hits are capped so a lucky run cannot loop forever.
const MAX_EXTRA_HITS = 6
const HEAL_CHANCE_DENOMINATOR = 4
const STEAL_CHANCE_DENOMINATOR = 5

/** rand(1, level ÷ 2) for tier 1, rand(1, level) for tier 2 — the ENEMY's level. */
function rollDrain(enemy, tier, rand) {
  const level = Math.max(1, Math.floor(Number(enemy?.level) || 1))
  return rand(1, tier >= 2 ? level : Math.max(1, Math.floor(level / 2)))
}

/** The standing behaviours an enemy definition declares, with safe defaults. */
function getEnemyBehaviours(enemy) {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    multiHitChance: Math.min(1, Math.max(0, n(enemy?.multiHitChance))),
    extraHits: Math.min(MAX_EXTRA_HITS, Math.max(0, Math.floor(n(enemy?.extraHits)))),
    dodgeChance: Math.min(1, Math.max(0, n(enemy?.dodgeChance))),
    absorbsHp: enemy?.absorbsHp === true,
    meltsMelee: enemy?.meltsMelee === true,
    packChance: Math.min(1, Math.max(0, n(enemy?.packChance))),
    heals: enemy?.heals === true,
    steals: enemy?.steals === true,
    pureDefense: enemy?.pureDefense === true,
    blockChance: Math.min(1, Math.max(0, n(enemy?.blockChance))),
    hpDrain: Math.min(2, Math.max(0, Math.floor(n(enemy?.hpDrain)))),
    mpDrain: Math.min(2, Math.max(0, Math.floor(n(enemy?.mpDrain)))),
    resurrectChance: Math.min(1, Math.max(0, n(enemy?.resurrectChance))),
  }
}

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
 * `canPoison` is whether poison could take hold right now (not already
 * poisoned, not immune); a poison special is never offered otherwise, so a
 * poisoned player sees ordinary hits until the poison runs out. `canPetrify`
 * is the same for stone: not offered while the player is already stone.
 */
function selectEnemySpecial(enemy, rand, { canPoison = true, canPetrify = true } = {}) {
  const owned = getEnemySpecialIds(enemy)
  if (owned.length === 0) return null

  for (const id of SPECIAL_PRIORITY) {
    if (!owned.includes(id)) continue
    const special = ENEMY_SPECIALS[id]
    if (special.applies === 'poison' && !canPoison) continue
    if (special.applies === 'petrify' && !canPetrify) continue
    // rand(1, N) === 1 for a 1/N chance — same shape as the original's rolls.
    if (rand(1, Math.round(1 / special.chance)) === 1) return special
  }
  return null
}

module.exports = {
  ENEMY_SPECIALS,
  SPECIAL_PRIORITY,
  MAX_EXTRA_HITS,
  HEAL_CHANCE_DENOMINATOR,
  STEAL_CHANCE_DENOMINATOR,
  rollDrain,
  getEnemyBehaviours,
  getEnemySpecialIds,
  hasSpecial,
  selectEnemySpecial,
}
