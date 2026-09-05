/**
 * Skills — the single source of truth shared by the server (learning, the
 * passive stat bonuses, the strike bonuses in combat) and the client (the
 * Skills tab of the book, the battle Skills list, the World Tool).
 *
 * Authored as plain JS with JSDoc, like spells.js, so the CommonJS game engine
 * can `require()` it and the TypeScript client imports it via allowJs. Every
 * function is pure and takes its randomness as an argument; the server is the
 * only place a roll actually happens.
 *
 * Fidelity notes (from the original's skills.php, skills-spells-calculator.php,
 * stats.php, hud.php, function-magic.php and battle.php):
 *   - A skill's level lives in its own User column (`oneHanded`, `slice`, ...).
 *     Level 0 means unlearned. Learning costs SP equal to the *next* level.
 *   - The cap on each skill is set by the best teacher met — a boolean flag on
 *     the User row that a room sets on arrival. Nothing is ever un-taught.
 *   - Passives fold into the stats the fight rolls: One Handed / Two Handed add
 *     +lvl STR while that kind of weapon is in hand, Ranged adds +lvl DEX with
 *     a ranged weapon, Warcraft adds to whichever, Toughness adds +2·lvl DEF,
 *     Block adds +3·lvl DEF with a shield, Dodge is a lvl% chance to take
 *     nothing from an enemy swing. The ×2 and ×3 are what the original's code
 *     did (its own Skills page text said +1 and +2; the code was chosen).
 *   - Strikes are a normal weapon swing plus a bonus roll, for MP: Slice (1h),
 *     Smash (2h) and Aim (ranged) add rand(1, lvl) for lvl MP; Magic Strike
 *     adds rand(0, ceil(mag × lvl / 20) + 1) magic to any swing for 2·lvl MP,
 *     reaches flying enemies (projectile magic) and fizzles on magic-immune
 *     ones — the swing still lands, the magic and its MP do not.
 *   - The "Pro" proficiencies (One Handed Pro, ...) have no User columns and
 *     their only teacher (the Master Trainer) is not ported; they are left out
 *     until both exist. Multi Arrow and Bolt Upgrade are listed as not ported.
 *
 * @typedef {'offense'|'attack'|'defense'|'upgrade'} SkillGroup
 * @typedef {'passive'|'strike'|'upgrade'} SkillKind
 * @typedef {'ONE_HANDED'|'TWO_HANDED'|'RANGED'|'ANY'} SkillWeapon
 *
 * @typedef {Object} SkillTeacherTier
 * @property {string} flag  User boolean column that marks the teacher as met.
 * @property {number} max   Cap this teacher raises the skill to.
 *
 * @typedef {Object} GearContext
 * @property {'MELEE'|'RANGED'|null} weaponCategory  null when unarmed.
 * @property {boolean} isTwoHanded
 * @property {boolean} hasShield
 *
 * @typedef {Object} SkillBonusRoll
 * @property {number} amount   The bonus added to the swing.
 * @property {number[]} rolls
 * @property {number} max      The top of the range it was rolled from.
 * @property {string} text     Readable breakdown, e.g. "rand(1, 3) = 2".
 *
 * @typedef {Object} SkillBonusPreview
 * @property {number} min
 * @property {number} max
 * @property {string} text
 *
 * @typedef {Object} SkillDef
 * @property {string} id            Stable slug (`magic-strike`).
 * @property {string} column        User column holding the level (`magicStrike`).
 * @property {string} name
 * @property {SkillGroup} group
 * @property {SkillKind} kind
 * @property {boolean} implemented  Whether the engine applies it today.
 * @property {string} icon
 * @property {string} [attackIcon]  Icon shown on a strike in battle.
 * @property {string} hue           Decorative hue token name.
 * @property {string} description   The original's Skills page text.
 * @property {string} formula       What it does, in the original's notation.
 * @property {SkillTeacherTier[]} teachers  Lowest tier first.
 * @property {(level: number) => number} learnCost  SP to go from level-1 to level.
 * @property {SkillWeapon} [weapon]  Strikes: the weapon kind they need.
 * @property {boolean} [magic]       Strikes: the bonus is magic (immunity, flying).
 * @property {(level: number) => number} [castCost]  Strikes: MP per use.
 * @property {(level: number, mag: number, rand: (a: number, b: number) => number) => SkillBonusRoll} [bonus]
 * @property {(level: number, mag: number) => SkillBonusPreview} [preview]
 */

/** Teacher flags, best last, as the original checked them. */
const SKILL_TEACHERS = {
  // The original taught in its training area (003c); this version stands the
  // Young Soldier in his own yard, room 007, east of the Grassy Field.
  youngSoldierFlag: { name: 'Young Soldier', roomId: '007' },
  jackLumberFlag: { name: 'Jack Lumber', roomId: '024' },
  travelingWarriorFlag: { name: 'Traveling Warrior', roomId: '106' },
  hunterBillFlag: { name: 'Hunter Bill', roomId: '118' },
  warriorSkillFlag: { name: "Warrior's Guild", roomId: '226' },
  masterTrainerFlag: { name: 'Master Trainer', roomId: '610' },
  rangerSkillFlag: { name: "Ranger's Guild", roomId: '515d' },
  starCitySkillsFlag: { name: 'Star City', roomId: '701' },
}

/**
 * Rooms whose arrival introduces a teacher, with the original's feed line.
 * The Warrior's Guild only teaches once its initiation (the Ogre Lieutenant)
 * has been turned in — the original's `quest19 >= 2`. The Master Trainer,
 * Ranger's Guild and Star City rooms are not ported yet, so their flags stay
 * false and their tiers show as "find a teacher".
 *
 * @type {Record<string, { flag: string, message: string, requiresCompletedQuest?: string }>}
 */
const SKILL_TEACHER_ROOMS = {
  '007': {
    flag: 'youngSoldierFlag',
    message: 'The Young Soldier shows you the basics. You can now learn the One Handed, Two Handed and Toughness skills!',
  },
  '024': {
    flag: 'jackLumberFlag',
    message: 'Jack Lumber shows you how to hold a bow. You can now learn the Ranged skill!',
  },
  '106': {
    flag: 'travelingWarriorFlag',
    message: 'You can now learn new skills from the Traveling Warrior!',
  },
  '118': {
    flag: 'hunterBillFlag',
    message: 'You can now learn new skills from Hunter Bill!',
  },
  '226': {
    flag: 'warriorSkillFlag',
    requiresCompletedQuest: 'quest_warriorsguild_000',
    message: "You can now learn new skills from the Warrior's Guild!",
  },
}

const SKILL_GROUPS = [
  { id: 'offense', name: 'Offense', blurb: 'Weapon proficiencies. Each level is another point of STR or DEX while that weapon is in hand.' },
  { id: 'attack', name: 'Special Attacks', blurb: 'Spend MP on a swing to add extra damage. The enemy still answers.' },
  { id: 'defense', name: 'Defense', blurb: 'Take less. Toughness always, Block behind a shield, Dodge by luck.' },
  { id: 'upgrade', name: 'Upgrades', blurb: "Ranged extras taught at the Ranger's Guild." },
]

const nextLevelCost = (level) => level

/** rand(1, lvl) — Slice, Smash and Aim. */
function flatBonusRoll(level, _mag, rand) {
  const r = rand(1, Math.max(1, level))
  return { amount: r, rolls: [r], max: level, text: `rand(1, ${level}) = ${r}` }
}

function flatBonusPreview(level) {
  return { min: 1, max: Math.max(1, level), text: `rand(1, ${level})` }
}

/** The top of Magic Strike's roll: ceil(mag × lvl / 20) + 1, never below 1. */
function magicStrikeMax(level, mag) {
  return Math.ceil(Math.max(0, mag) * (level / 20)) + 1
}

/** @type {SkillDef[]} */
const SKILLS = [
  // ==================== OFFENSE (passive) ====================
  {
    id: 'one-handed',
    column: 'oneHanded',
    name: 'One Handed',
    group: 'offense',
    kind: 'passive',
    implemented: true,
    icon: 'sword1',
    hue: 'red',
    description: 'Increases damage done with all one handed weapons. Each point in the skill is another point higher for STR.',
    formula: '+lvl STR while a one-handed weapon is equipped',
    teachers: [
      { flag: 'youngSoldierFlag', max: 5 },
      { flag: 'travelingWarriorFlag', max: 10 },
      { flag: 'warriorSkillFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'two-handed',
    column: 'twoHanded',
    name: 'Two Handed',
    group: 'offense',
    kind: 'passive',
    implemented: true,
    icon: 'axe1',
    hue: 'red',
    description: 'Increases damage done with all two handed weapons. Each point in the skill is another point higher for STR.',
    formula: '+lvl STR while a two-handed weapon is equipped',
    teachers: [
      { flag: 'youngSoldierFlag', max: 5 },
      { flag: 'travelingWarriorFlag', max: 10 },
      { flag: 'warriorSkillFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'ranged',
    column: 'ranged',
    name: 'Ranged',
    group: 'offense',
    kind: 'passive',
    implemented: true,
    icon: 'bowarrow',
    hue: 'green',
    description: 'Increases damage done with all ranged weapons. Each point in the skill is another point higher for DEX.',
    formula: '+lvl DEX while a ranged weapon is equipped',
    teachers: [
      { flag: 'jackLumberFlag', max: 5 },
      { flag: 'hunterBillFlag', max: 15 },
      { flag: 'rangerSkillFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'warcraft',
    column: 'warcraft',
    name: 'Warcraft',
    group: 'offense',
    kind: 'passive',
    implemented: true,
    icon: 'warcraft',
    hue: 'gold',
    description: 'Increases damage done with all 1h, 2h or ranged weapons. Each point in the skill is another point higher for STR or DEX.',
    formula: '+lvl STR with a melee weapon, +lvl DEX with a ranged one',
    teachers: [
      { flag: 'masterTrainerFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },

  // ==================== SPECIAL ATTACKS (strikes) ====================
  {
    id: 'slice',
    column: 'slice',
    name: 'Slice',
    group: 'attack',
    kind: 'strike',
    implemented: true,
    icon: 'slice',
    attackIcon: 'slice2',
    hue: 'red',
    weapon: 'ONE_HANDED',
    magic: false,
    description: 'Adds extra damage to your ONE HANDED attacks. Adds (1 – skill lvl) extra damage to your 1h attack damage.',
    formula: 'swing + rand(1, lvl), for lvl MP',
    teachers: [
      { flag: 'travelingWarriorFlag', max: 5 },
      { flag: 'warriorSkillFlag', max: 10 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level,
    bonus: flatBonusRoll,
    preview: flatBonusPreview,
  },
  {
    id: 'smash',
    column: 'smash',
    name: 'Smash',
    group: 'attack',
    kind: 'strike',
    implemented: true,
    icon: 'smash',
    attackIcon: 'smash2',
    hue: 'red',
    weapon: 'TWO_HANDED',
    magic: false,
    description: 'Adds extra damage to your TWO HANDED attacks. Adds (1 – skill lvl) extra damage to your 2h attack damage.',
    formula: 'swing + rand(1, lvl), for lvl MP',
    teachers: [
      { flag: 'travelingWarriorFlag', max: 5 },
      { flag: 'warriorSkillFlag', max: 10 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level,
    bonus: flatBonusRoll,
    preview: flatBonusPreview,
  },
  {
    id: 'aim',
    column: 'aim',
    name: 'Aim',
    group: 'attack',
    kind: 'strike',
    implemented: true,
    icon: 'aim',
    attackIcon: 'aim2',
    hue: 'green',
    weapon: 'RANGED',
    magic: false,
    description: 'Adds extra damage to your RANGED attacks. Adds (1 – skill lvl) extra damage to your ranged damage.',
    formula: 'shot + rand(1, lvl), for lvl MP',
    teachers: [
      { flag: 'hunterBillFlag', max: 5 },
      { flag: 'rangerSkillFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level,
    bonus: flatBonusRoll,
    preview: flatBonusPreview,
  },
  {
    id: 'magic-strike',
    column: 'magicStrike',
    name: 'Magic Strike',
    group: 'attack',
    kind: 'strike',
    implemented: true,
    icon: 'magicstrike',
    attackIcon: 'magicstrike',
    hue: 'blue',
    weapon: 'ANY',
    magic: true,
    description: 'Adds some magic damage to your normal STR attacks. Adds (lvl × 5% MAG) damage.',
    formula: 'swing + rand(0, ceil(mag × lvl / 20) + 1), for 2·lvl MP',
    teachers: [
      { flag: 'warriorSkillFlag', max: 10 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level * 2,
    bonus(level, mag, rand) {
      const max = magicStrikeMax(level, mag)
      const r = rand(0, max)
      return { amount: r, rolls: [r], max, text: `rand(0, ${max}) = ${r}` }
    },
    preview(level, mag) {
      const max = magicStrikeMax(level, mag)
      return { min: 0, max, text: `rand(0, ceil(${Math.max(0, mag)} × ${level} / 20) + 1)` }
    },
  },

  // ==================== DEFENSE (passive) ====================
  {
    id: 'toughness',
    column: 'toughness',
    name: 'Toughness',
    group: 'defense',
    kind: 'passive',
    implemented: true,
    icon: 'toughness',
    hue: 'gold',
    description: 'Increases Defense. Each point in the skill is another 2 points added to DEF.',
    formula: '+2·lvl DEF',
    teachers: [
      { flag: 'youngSoldierFlag', max: 5 },
      { flag: 'travelingWarriorFlag', max: 10 },
      { flag: 'warriorSkillFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'block',
    column: 'block',
    name: 'Block',
    group: 'defense',
    kind: 'passive',
    implemented: true,
    icon: 'block',
    hue: 'gold',
    description: 'Increases Defense with shields. When a shield is equipped each point in the skill is another 3 points added to DEF.',
    formula: '+3·lvl DEF while a shield is equipped',
    teachers: [
      { flag: 'warriorSkillFlag', max: 10 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'dodge',
    column: 'dodge',
    name: 'Dodge',
    group: 'defense',
    kind: 'passive',
    implemented: true,
    icon: 'dodge',
    hue: 'purple',
    description: "Skill LVL % chance to dodge an enemy's attack.",
    formula: 'lvl% chance an enemy attack does nothing',
    teachers: [
      { flag: 'hunterBillFlag', max: 5 },
      { flag: 'rangerSkillFlag', max: 10 },
    ],
    learnCost: nextLevelCost,
  },

  // ==================== UPGRADES ====================
  {
    id: 'multi-arrow',
    column: 'multiArrow',
    name: 'Multi Arrow',
    group: 'upgrade',
    kind: 'upgrade',
    implemented: false,
    icon: 'multiarrow',
    hue: 'green',
    description: 'A chance to loose a second arrow with every bow shot.',
    formula: 'rand(0, lvl) ≥ rand(1, 100): a second shot',
    teachers: [
      { flag: 'rangerSkillFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
  {
    id: 'bolt-upgrade',
    column: 'boltUpgrade',
    name: 'Bolt Upgrade',
    group: 'upgrade',
    kind: 'upgrade',
    implemented: false,
    icon: 'boltupgrade',
    hue: 'green',
    description: 'Adds extra damage to crossbow bolts.',
    formula: '+rand(1, lvl) with a crossbow',
    teachers: [
      { flag: 'rangerSkillFlag', max: 20 },
      { flag: 'starCitySkillsFlag', max: 25 },
    ],
    learnCost: nextLevelCost,
  },
]

/** Every User column that holds a skill level. */
const SKILL_COLUMNS = SKILLS.map((s) => s.column)

/** Every User column that marks a skill teacher as met. */
const SKILL_TEACHER_FLAGS = Object.keys(SKILL_TEACHERS)

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
const BY_COLUMN = new Map(SKILLS.map((s) => [s.column, s]))

/** @param {string} id @returns {SkillDef|null} */
function getSkill(id) {
  return BY_ID.get(id) || null
}

/** @param {string} column @returns {SkillDef|null} */
function getSkillByColumn(column) {
  return BY_COLUMN.get(column) || null
}

/**
 * Resolve a typed command ("slice", "magic strike", "use smash") to a strike
 * skill. Only strikes answer: a passive is not something you do, and a typed
 * "block" or "dodge" must stay free for room actions.
 * @param {string} input
 * @returns {SkillDef|null}
 */
function findSkillByCommand(input) {
  if (typeof input !== 'string') return null
  const text = input.trim().toLowerCase().replace(/^use\s+/, '').replace(/\s+/g, ' ')
  if (!text) return null
  for (const skill of SKILLS) {
    if (skill.kind !== 'strike') continue
    if (skill.id === text || skill.id.replace(/-/g, ' ') === text || skill.id.replace(/-/g, '') === text || skill.name.toLowerCase() === text) {
      return skill
    }
  }
  return null
}

/**
 * The highest level a skill can be trained to given the teachers the player
 * has met. 0 means no teacher yet — the original's "skill not available yet".
 * @param {SkillDef} skill
 * @param {Record<string, boolean>} flags
 */
function getSkillMaxLevel(skill, flags) {
  let max = 0
  for (const tier of skill.teachers) {
    if (flags && flags[tier.flag] && tier.max > max) max = tier.max
  }
  return max
}

/**
 * SP needed to raise a skill from `level` to `level + 1`, or null at the cap
 * (or with no teacher at all).
 * @param {SkillDef} skill
 * @param {number} level
 * @param {number} maxLevel
 */
function getNextLearnCost(skill, level, maxLevel) {
  if (maxLevel <= 0 || level >= maxLevel) return null
  return skill.learnCost(level + 1)
}

/** A skill the engine can fire as a strike today. @param {SkillDef} skill */
function isStrikeSkill(skill) {
  return Boolean(skill && skill.implemented && skill.kind === 'strike' && typeof skill.bonus === 'function')
}

/**
 * Whether an off-hand item counts as a shield for Block. The original kept a
 * list of shield names; here it is the slug — every shield and the buckler —
 * so an orb or an off-hand dagger does not count.
 * @param {{ slug?: string, equipSlot?: string|null }|null|undefined} template
 */
function isShieldItem(template) {
  if (!template || template.equipSlot !== 'OFF_HAND') return false
  const slug = String(template.slug || '').toLowerCase()
  return /shield/.test(slug) || slug === 'buckler'
}

/**
 * Which of the three weapon kinds the player is holding, for skill fit and the
 * proficiency bonuses. Fists are none of them, as in the original (weapontype 0).
 * @param {GearContext} gear
 * @returns {'ONE_HANDED'|'TWO_HANDED'|'RANGED'|null}
 */
function weaponKind(gear) {
  if (!gear || !gear.weaponCategory) return null
  if (gear.weaponCategory === 'RANGED') return 'RANGED'
  return gear.isTwoHanded ? 'TWO_HANDED' : 'ONE_HANDED'
}

/** @param {SkillDef} skill @param {GearContext} gear */
function weaponFits(skill, gear) {
  if (!skill.weapon || skill.weapon === 'ANY') return true
  return weaponKind(gear) === skill.weapon
}

/** Why a strike cannot be used with what is in hand, or null when it can. @param {SkillDef} skill @param {GearContext} gear */
function weaponFitReason(skill, gear) {
  if (weaponFits(skill, gear)) return null
  if (skill.weapon === 'ONE_HANDED') return 'Needs a one-handed weapon'
  if (skill.weapon === 'TWO_HANDED') return 'Needs a two-handed weapon'
  if (skill.weapon === 'RANGED') return 'Needs a ranged weapon'
  return 'Needs a weapon'
}

/**
 * What the passives add right now, given what is in hand. This is the
 * original's stats.php folding, computed live instead of written into the
 * strMod/dexMod/defMod columns, so learning a level counts on the next swing.
 *
 * @param {Record<string, number>} levels  Skill levels keyed by User column.
 * @param {GearContext} gear
 * @returns {{ str: number, dex: number, def: number, dodgeChance: number, parts: { skillId: string, stat: 'str'|'dex'|'def'|'dodge', amount: number }[] }}
 */
function getPassiveSkillBonuses(levels, gear) {
  const lv = (column) => Math.max(0, Number(levels?.[column] || 0))
  const kind = weaponKind(gear)
  const parts = []
  let str = 0
  let dex = 0
  let def = 0

  if (kind === 'ONE_HANDED' && lv('oneHanded') > 0) {
    str += lv('oneHanded')
    parts.push({ skillId: 'one-handed', stat: 'str', amount: lv('oneHanded') })
  }
  if (kind === 'TWO_HANDED' && lv('twoHanded') > 0) {
    str += lv('twoHanded')
    parts.push({ skillId: 'two-handed', stat: 'str', amount: lv('twoHanded') })
  }
  if (kind === 'RANGED' && lv('ranged') > 0) {
    dex += lv('ranged')
    parts.push({ skillId: 'ranged', stat: 'dex', amount: lv('ranged') })
  }
  if (lv('warcraft') > 0) {
    if (kind === 'RANGED') {
      dex += lv('warcraft')
      parts.push({ skillId: 'warcraft', stat: 'dex', amount: lv('warcraft') })
    } else if (kind) {
      str += lv('warcraft')
      parts.push({ skillId: 'warcraft', stat: 'str', amount: lv('warcraft') })
    }
  }
  if (lv('toughness') > 0) {
    def += lv('toughness') * 2
    parts.push({ skillId: 'toughness', stat: 'def', amount: lv('toughness') * 2 })
  }
  if (gear?.hasShield && lv('block') > 0) {
    def += lv('block') * 3
    parts.push({ skillId: 'block', stat: 'def', amount: lv('block') * 3 })
  }
  const dodgeChance = Math.min(100, lv('dodge'))
  if (dodgeChance > 0) parts.push({ skillId: 'dodge', stat: 'dodge', amount: dodgeChance })

  return { str, dex, def, dodgeChance, parts }
}

/**
 * Roll a strike's bonus at a level. `mag` only matters to Magic Strike.
 * @param {SkillDef} skill
 * @param {number} level
 * @param {number} mag
 * @param {(a: number, b: number) => number} rand
 * @returns {SkillBonusRoll}
 */
function rollSkillBonus(skill, level, mag, rand) {
  if (typeof skill.bonus !== 'function') {
    throw new Error(`rollSkillBonus: ${skill.id} has no bonus`)
  }
  return skill.bonus(level, mag, rand)
}

/**
 * Min/max of a strike's bonus at a level, for the book and the battle list.
 * @param {SkillDef} skill
 * @param {number} level
 * @param {number} mag
 * @returns {SkillBonusPreview|null}
 */
function previewSkillBonus(skill, level, mag) {
  if (typeof skill.preview !== 'function') return null
  return skill.preview(level, mag)
}

/** The teacher ladder as readable entries. @param {SkillDef} skill */
function describeTeachers(skill) {
  return skill.teachers.map((tier) => {
    const teacher = SKILL_TEACHERS[tier.flag]
    return { flag: tier.flag, max: tier.max, name: teacher ? teacher.name : tier.flag, roomId: teacher ? teacher.roomId : null }
  })
}

module.exports = {
  SKILLS,
  SKILL_GROUPS,
  SKILL_COLUMNS,
  SKILL_TEACHERS,
  SKILL_TEACHER_FLAGS,
  SKILL_TEACHER_ROOMS,
  getSkill,
  getSkillByColumn,
  findSkillByCommand,
  getSkillMaxLevel,
  getNextLearnCost,
  isStrikeSkill,
  isShieldItem,
  weaponKind,
  weaponFits,
  weaponFitReason,
  getPassiveSkillBonuses,
  rollSkillBonus,
  previewSkillBonus,
  describeTeachers,
}
