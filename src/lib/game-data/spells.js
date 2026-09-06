/**
 * Spells — the single source of truth shared by the server (learning, casting,
 * combat rolls) and the client (spellbook, battle Spells tab, World Tool).
 *
 * Authored as plain JS with JSDoc, like crafting-recipes.js, so the CommonJS
 * game engine can `require()` it and the TypeScript client imports it via
 * allowJs. Nothing here touches the database: every function is pure and takes
 * its randomness as an argument, so the formulas are testable and the server
 * remains the only place a roll actually happens.
 *
 * Fidelity notes (from the original's skills-spells-calculator.php,
 * function-magic.php and battle.php):
 *   - A spell's level lives in its own User column (`magicMissile`, `fireball`,
 *     `heal`, ...). Level 0 means unlearned.
 *   - Learning costs SP equal to the *next* level (1 SP for level 1, 2 for
 *     level 2, ...). "Pro" spells (Atomic Blast) cost (next level × 5).
 *   - The cap on each spell is set by the best teacher the player has met —
 *     a boolean flag on the User row that a room sets on arrival. Meeting a
 *     better teacher raises the cap; nothing is ever un-taught.
 *   - Attack spells use the player's effective MAG (core + equipment + buffs),
 *     which is the original's `magmod`. They are blocked by rand(0, enemy DEF)
 *     like any strike, they reach flying enemies, and they do nothing to
 *     magic-immune enemies.
 *
 * `implemented` marks which spell kinds the engine can cast today. Unimplemented
 * spells are still listed — with their teachers — so the spellbook and World
 * Tool show what is coming, exactly as the original's Spells tab showed every
 * spell greyed out until you found its teacher. None of them is learnable until
 * its teacher room is wired up (see SPELL_TEACHER_ROOMS).
 *
 * @typedef {'destruction'|'restoration'|'alteration'} SpellSchool
 * @typedef {'attack'|'heal'|'buff'} SpellKind
 *
 * @typedef {Object} SpellTeacherTier
 * @property {string} flag  User boolean column that marks the teacher as met.
 * @property {number} max   Cap this teacher raises the spell to.
 *
 * @typedef {Object} SpellRoll
 * @property {number} amount   The rolled damage or healing.
 * @property {number[]} rolls  The individual random rolls behind it.
 * @property {string} text     Readable breakdown, e.g. "1 + 2 + 4 = 7".
 *
 * @typedef {Object} SpellPreview
 * @property {number} min
 * @property {number} max
 * @property {string} text  Readable formula with the player's numbers filled in.
 *
 * @typedef {Object} SpellDef
 * @property {string} id            Stable slug (`magic-missile`).
 * @property {string} column        User column holding the level (`magicMissile`).
 * @property {string} name
 * @property {SpellSchool} school
 * @property {SpellKind} kind
 * @property {boolean} implemented  Whether the engine can cast it today.
 * @property {string} icon          Spellbook / button icon.
 * @property {string} [attackIcon]  Icon shown on the strike in battle.
 * @property {string} hue           Decorative hue token name (`blue`, `red`, ...).
 * @property {string} description
 * @property {string} formula       Formula in the original's notation, for reference views.
 * @property {SpellTeacherTier[]} teachers  Lowest tier first.
 * @property {(level: number) => number} learnCost  SP to go from level-1 to level.
 * @property {(level: number, mag: number) => number} castCost  MP to cast at a level.
 * @property {(level: number, mag: number, rand: (a: number, b: number) => number) => SpellRoll} [roll]
 * @property {(level: number, mag: number) => SpellPreview} [preview]
 */

/** Teacher flags, in the order the original checked them (best first). */
const SPELL_TEACHERS = {
  pajamaShamanFlag: { name: 'Pajama Shaman', roomId: '021' },
  travelingWizardFlag: { name: 'Traveling Wizard', roomId: '105' },
  wizardSkillFlag: { name: "Wizard's Guild", roomId: '225' },
  starCitySpellsFlag: { name: 'Star City', roomId: '701' },
}

/**
 * Rooms whose arrival introduces a teacher, with the original's feed line.
 * The original set `travelingwizardFlag` on any arrival in 105, and
 * `wizardskillFlag` on entering the guild interior (225b), which only members
 * could reach — here the guild is one room, so the flag waits on the
 * initiation quest (the Kobold Master) being turned in. Star City (701) is
 * not ported yet, so its flag stays false and its tier shows as
 * "find a teacher".
 *
 * @type {Record<string, { flag: string, message: string, requiresMembership?: string }>}
 */
const SPELL_TEACHER_ROOMS = {
  '021': {
    flag: 'pajamaShamanFlag',
    message:
      'The Pajama Shaman gives you a crash course in Magic! You can now learn the Magic Missile, Fireball and Heal spells.',
  },
  '105': {
    flag: 'travelingWizardFlag',
    message: 'You can now learn new spells from the Traveling Wizard!',
  },
  '225': {
    flag: 'wizardSkillFlag',
    requiresMembership: 'wizards-guild',
    message: "You can now learn new spells from the Wizard's Guild!",
  },
}

const nextLevelCost = (level) => level
const proLevelCost = (level) => level * 5

/**
 * The original's "lvl + (rand(1,mag) × (1 + 5% × lvl))" family (Fireball,
 * Poison Dart). One random roll, scaled by the spell level, rounded up.
 */
function scaledBoltRoll(level, mag, rand) {
  const r = rand(1, Math.max(1, mag))
  const mod = 1 + level * 0.05
  const add = Math.ceil(r * mod)
  const amount = level + add
  return { amount, rolls: [r], text: `${level} + (${r} × ${mod.toFixed(2)}) = ${amount}` }
}

function scaledBoltPreview(level, mag) {
  const mod = 1 + level * 0.05
  const min = level + Math.ceil(1 * mod)
  const max = level + Math.ceil(Math.max(1, mag) * mod)
  return { min, max, text: `${level} + (rand(1, ${mag}) × ${mod.toFixed(2)})` }
}

/** @type {SpellDef[]} */
const SPELLS = [
  // ==================== DESTRUCTION ====================
  {
    id: 'magic-missile',
    column: 'magicMissile',
    name: 'Magic Missile',
    school: 'destruction',
    kind: 'attack',
    implemented: true,
    icon: 'magicmissile',
    attackIcon: 'magicmissile2',
    hue: 'blue',
    description: 'A weak projectile to cast at an enemy.',
    formula: '1 + lvl + rand(0, mag)',
    teachers: [
      { flag: 'pajamaShamanFlag', max: 1 },
      { flag: 'travelingWizardFlag', max: 2 },
      { flag: 'wizardSkillFlag', max: 3 },
      { flag: 'starCitySpellsFlag', max: 5 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level * 2,
    roll(level, mag, rand) {
      const r = rand(0, Math.max(0, mag))
      const amount = 1 + level + r
      return { amount, rolls: [r], text: `1 + ${level} + ${r} = ${amount}` }
    },
    preview(level, mag) {
      return { min: 1 + level, max: 1 + level + Math.max(0, mag), text: `1 + ${level} + rand(0, ${mag})` }
    },
  },
  {
    id: 'fireball',
    column: 'fireball',
    name: 'Fireball',
    school: 'destruction',
    kind: 'attack',
    implemented: true,
    icon: 'fireball',
    attackIcon: 'fireball2',
    hue: 'red',
    description: 'Throw a fireball at your enemies.',
    formula: 'lvl + (rand(1, mag) × (1 + 5% × lvl))',
    teachers: [
      { flag: 'pajamaShamanFlag', max: 3 },
      { flag: 'travelingWizardFlag', max: 5 },
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => 5 + level * 2,
    roll: scaledBoltRoll,
    preview: scaledBoltPreview,
  },
  {
    id: 'poison-dart',
    column: 'poisonDart',
    name: 'Poison Dart',
    school: 'destruction',
    kind: 'attack',
    // The dart's damage is the Fireball family, but its poison-over-time is a
    // status effect the engine does not have yet.
    implemented: false,
    icon: 'poisondart',
    attackIcon: 'poisondart2',
    hue: 'green',
    description: 'Launch a Poison Dart at your enemies to do damage over time.',
    formula: 'lvl + (rand(1, mag) × (1 + 5% × lvl)), then poison rand(1, lvl × 2) per turn',
    teachers: [
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => 5 + level * 3,
    roll: scaledBoltRoll,
    preview: scaledBoltPreview,
  },
  {
    id: 'atomic-blast',
    column: 'atomicBlast',
    name: 'Atomic Blast',
    school: 'destruction',
    kind: 'attack',
    implemented: true,
    icon: 'atomicblast',
    attackIcon: 'atomicblast2',
    hue: 'pink',
    description: 'PRO SPELL: Atomic Blast causes devastating damage but is expensive to cast.',
    formula: 'mag + lvl × rand(0, mag)',
    teachers: [
      { flag: 'wizardSkillFlag', max: 5 },
      { flag: 'starCitySpellsFlag', max: 7 },
    ],
    learnCost: proLevelCost,
    castCost: (level, mag) => 100 * level + Math.max(0, mag),
    roll(level, mag, rand) {
      const rolls = []
      let amount = Math.max(0, mag)
      for (let i = 0; i < level; i += 1) {
        const r = rand(0, Math.max(0, mag))
        rolls.push(r)
        amount += r
      }
      return { amount, rolls, text: `${Math.max(0, mag)} + ${rolls.join(' + ')} = ${amount}` }
    },
    preview(level, mag) {
      const m = Math.max(0, mag)
      return { min: m, max: m + level * m, text: `${m} + ${level} × rand(0, ${m})` }
    },
  },

  // ==================== RESTORATION ====================
  {
    id: 'heal',
    column: 'heal',
    name: 'Heal',
    school: 'restoration',
    kind: 'heal',
    implemented: true,
    icon: 'heal',
    hue: 'red',
    description: 'Heal your HP at any time.',
    formula: '(lvl + 1) rolls of rand(1, mag)',
    teachers: [
      { flag: 'pajamaShamanFlag', max: 3 },
      { flag: 'travelingWizardFlag', max: 5 },
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level * 2,
    roll(level, mag, rand) {
      const rolls = []
      let amount = 0
      for (let i = 0; i <= level; i += 1) {
        const r = rand(1, Math.max(1, mag))
        rolls.push(r)
        amount += r
      }
      return { amount, rolls, text: `${rolls.join(' + ')} = ${amount}` }
    },
    preview(level, mag) {
      const count = level + 1
      return { min: count, max: count * Math.max(1, mag), text: `${count} × rand(1, ${mag})` }
    },
  },
  {
    id: 'regenerate',
    column: 'regenerate',
    name: 'Regenerate',
    school: 'restoration',
    kind: 'buff',
    implemented: false,
    icon: 'regenerate',
    hue: 'green',
    description: 'Regenerate health over time.',
    formula: 'rand(lvl, lvl × 2) HP per click for rand(mag core, mag) clicks',
    teachers: [
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => 20 * level,
  },
  {
    id: 'antidote',
    column: 'antidote',
    name: 'Antidote',
    school: 'restoration',
    kind: 'buff',
    implemented: false,
    icon: 'antidote',
    hue: 'green',
    description: 'Cure yourself of poison and become immune for a short time.',
    formula: 'cures poison; immune for a short time',
    teachers: [
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => level * 2,
  },

  // ==================== ALTERATION ====================
  {
    id: 'magic-armor',
    column: 'magicArmor',
    name: 'Magic Armor',
    school: 'alteration',
    kind: 'buff',
    implemented: false,
    icon: 'magicarmor',
    hue: 'blue',
    description: 'Magic Armor protects you by absorbing damage.',
    formula: 'absorbs lvl rolls of rand(1, mag) damage',
    teachers: [
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => 10 * level,
  },
  {
    id: 'iron-skin',
    column: 'ironSkin',
    name: 'Iron Skin',
    school: 'alteration',
    kind: 'buff',
    implemented: false,
    icon: 'ironskin',
    hue: 'gold',
    description: 'Increase defense with Iron Skin.',
    formula: '+rand(lvl × 2, lvl × 4) DEF for rand(mag core, mag) clicks',
    teachers: [
      { flag: 'wizardSkillFlag', max: 10 },
      { flag: 'starCitySpellsFlag', max: 15 },
    ],
    learnCost: nextLevelCost,
    castCost: (level) => 10 * level,
  },
  {
    id: 'wings',
    column: 'wings',
    name: 'Wings',
    school: 'alteration',
    kind: 'buff',
    implemented: false,
    icon: 'wings',
    hue: 'sky',
    description: 'Wings give you the ability to fly.',
    formula: 'fly for lvl × 20 clicks',
    teachers: [{ flag: 'wizardSkillFlag', max: 5 }],
    learnCost: nextLevelCost,
    castCost: (level) => level * 10,
  },
  {
    id: 'gills',
    column: 'gills',
    name: 'Gills',
    school: 'alteration',
    kind: 'buff',
    implemented: false,
    icon: 'gills',
    hue: 'blue',
    description: 'Gills allow you to breathe underwater.',
    formula: 'breathe water for lvl × 20 clicks',
    teachers: [{ flag: 'wizardSkillFlag', max: 5 }],
    learnCost: nextLevelCost,
    castCost: (level) => level * 10,
  },
]

const SPELL_SCHOOLS = [
  { id: 'destruction', name: 'Destruction', blurb: 'Attack enemies with powerful Destruction magic.' },
  { id: 'restoration', name: 'Restoration', blurb: 'Support your character with a variety of healing spells.' },
  { id: 'alteration', name: 'Alteration', blurb: 'Manipulate yourself and the world around you to your advantage.' },
]

/** Every User column that holds a spell level. */
const SPELL_COLUMNS = SPELLS.map((s) => s.column)

/** Every User column that marks a spell teacher as met. */
const SPELL_TEACHER_FLAGS = Object.keys(SPELL_TEACHERS)

const BY_ID = new Map(SPELLS.map((s) => [s.id, s]))
const BY_COLUMN = new Map(SPELLS.map((s) => [s.column, s]))

/** @param {string} id @returns {SpellDef|null} */
function getSpell(id) {
  return BY_ID.get(id) || null
}

/** @param {string} column @returns {SpellDef|null} */
function getSpellByColumn(column) {
  return BY_COLUMN.get(column) || null
}

/**
 * Resolve a typed command ("cast fireball", "fireball", "cast magic missile")
 * to a spell. Case-insensitive; accepts the display name or the slug.
 * @param {string} input
 * @returns {SpellDef|null}
 */
function findSpellByCommand(input) {
  if (typeof input !== 'string') return null
  const text = input.trim().toLowerCase().replace(/^cast\s+/, '').replace(/\s+/g, ' ')
  if (!text) return null
  for (const spell of SPELLS) {
    if (spell.id === text || spell.id.replace(/-/g, ' ') === text || spell.name.toLowerCase() === text) {
      return spell
    }
  }
  return null
}

/**
 * The highest level a spell can be trained to given the teachers the player
 * has met. 0 means no teacher yet — the original's "skill not available yet".
 * @param {SpellDef} spell
 * @param {Record<string, boolean>} flags  User teacher flags.
 */
function getSpellMaxLevel(spell, flags) {
  let max = 0
  for (const tier of spell.teachers) {
    if (flags && flags[tier.flag] && tier.max > max) max = tier.max
  }
  return max
}

/**
 * SP needed to raise a spell from `level` to `level + 1`, or null at the cap
 * (or with no teacher at all).
 * @param {SpellDef} spell
 * @param {number} level
 * @param {number} maxLevel
 */
function getNextLearnCost(spell, level, maxLevel) {
  if (maxLevel <= 0 || level >= maxLevel) return null
  return spell.learnCost(level + 1)
}

/**
 * Whether the engine can cast this spell at all today — its kind has a handler.
 * Learnable-but-unimplemented spells cannot occur yet (their teachers are not
 * wired), but the check keeps a future data change from reaching a handler
 * that does not exist.
 * @param {SpellDef} spell
 */
function isCastable(spell) {
  return Boolean(spell.implemented && (spell.kind === 'attack' || spell.kind === 'heal'))
}

/**
 * Roll a spell's effect at a level with the player's effective MAG.
 * @param {SpellDef} spell
 * @param {number} level
 * @param {number} mag
 * @param {(a: number, b: number) => number} rand
 * @returns {SpellRoll}
 */
function rollSpell(spell, level, mag, rand) {
  if (typeof spell.roll !== 'function') {
    throw new Error(`rollSpell: ${spell.id} has no roll`)
  }
  return spell.roll(level, mag, rand)
}

/**
 * Min/max preview of a spell at a level, for the spellbook and battle tab.
 * @param {SpellDef} spell
 * @param {number} level
 * @param {number} mag
 * @returns {SpellPreview|null}
 */
function previewSpell(spell, level, mag) {
  if (typeof spell.preview !== 'function') return null
  return spell.preview(level, mag)
}

/**
 * The teacher ladder as readable text ("Pajama Shaman 3 · Traveling Wizard 5").
 * @param {SpellDef} spell
 */
function describeTeachers(spell) {
  return spell.teachers.map((tier) => {
    const teacher = SPELL_TEACHERS[tier.flag]
    return { flag: tier.flag, max: tier.max, name: teacher ? teacher.name : tier.flag, roomId: teacher ? teacher.roomId : null }
  })
}

module.exports = {
  SPELLS,
  SPELL_SCHOOLS,
  SPELL_COLUMNS,
  SPELL_TEACHERS,
  SPELL_TEACHER_FLAGS,
  SPELL_TEACHER_ROOMS,
  getSpell,
  getSpellByColumn,
  findSpellByCommand,
  getSpellMaxLevel,
  getNextLearnCost,
  isCastable,
  rollSpell,
  previewSpell,
  describeTeachers,
}
