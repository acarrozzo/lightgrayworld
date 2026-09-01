/**
 * Codemod: chromatic Tailwind utilities -> semantic theme utilities.
 *
 * The companion to migrate-color-classes.mjs, which handled the neutral scale.
 * Chromatic colours could not be done there because the same class means
 * different things in different places: `text-red-400` is the STR stat in the
 * header, the melee damage number in the battle panel, and an error in a feed
 * message. So the rules here are ordered and mostly per-file.
 *
 * Three tiers, applied in order:
 *
 *   1. GLOBAL   — idioms that mean one thing everywhere. Indigo was this
 *                 application's interface accent in every file that used it.
 *   2. PER_FILE — the semantic files, where a colour's meaning is local.
 *   3. FAMILY   — a last-resort map by colour family, for the tail of small
 *                 files whose colour use follows the obvious convention.
 *
 * Run once; the result is committed. Re-running is a no-op because the source
 * classes no longer exist.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Replace whole utility tokens only, preserving variants and `/opacity`. */
function rewrite(source, pairs) {
  let out = source
  let count = 0
  for (const [from, to] of pairs) {
    const re = new RegExp(
      `(^|[\\s"'\`{(\\[])((?:[a-z-]+:)*)${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s"'\`})\\]]|/)`,
      'g'
    )
    out = out.replace(re, (_m, lead, variants) => {
      count++
      return `${lead}${variants}${to}`
    })
  }
  return [out, count]
}

/** Indigo was the interface accent everywhere it appeared. */
const GLOBAL = [
  ['bg-indigo-700', 'bg-accent'],
  ['bg-indigo-600', 'bg-accent'],
  ['bg-indigo-500', 'bg-accent-hover'],
  ['bg-indigo-400', 'bg-accent-hover'],
  ['bg-indigo-950', 'bg-accent-muted'],
  ['bg-indigo-900', 'bg-accent-muted'],
  ['text-indigo-700', 'text-accent'],
  ['text-indigo-600', 'text-accent'],
  ['text-indigo-500', 'text-accent'],
  ['text-indigo-400', 'text-accent'],
  ['text-indigo-300', 'text-accent-hover'],
  ['text-indigo-200', 'text-accent-hover'],
  ['text-indigo-50', 'text-fg-bright'],
  ['border-indigo-600', 'border-accent'],
  ['border-indigo-500', 'border-accent'],
  ['border-indigo-400', 'border-accent-hover'],
  ['border-indigo-300', 'border-accent-hover'],
  ['ring-indigo-500', 'ring-line-focus'],
  ['ring-indigo-400', 'ring-line-focus'],
  ['ring-indigo-300', 'ring-line-focus'],
  ['from-indigo-500', 'from-accent'],
  ['from-indigo-400', 'from-accent-hover'],
  ['to-indigo-600', 'to-accent'],
  ['to-indigo-500', 'to-accent-hover'],
  ['shadow-indigo-950', 'shadow-shadow'],
  ['shadow-indigo-900', 'shadow-shadow'],
]

/** The four core stats, wherever a file spells them out. */
const STATS = [
  ['text-red-400', 'text-stat-str'],
  ['text-emerald-400', 'text-stat-dex'],
  ['text-green-400', 'text-stat-dex'],
  ['text-sky-400', 'text-stat-mag'],
  ['text-blue-400', 'text-stat-mag'],
  ['text-amber-400', 'text-stat-def'],
  ['text-yellow-400', 'text-stat-def'],
  ['text-red-800', 'text-fg-disabled'],
]

const PER_FILE = {
  'src/components/GameHeader.tsx': [
    // Vitals bars.
    ['from-red-600', 'from-resource-hp'], ['to-red-400', 'to-resource-hp'],
    ['from-sky-600', 'from-resource-mp'], ['to-sky-400', 'to-resource-mp'],
    ['from-emerald-600', 'from-resource-xp'], ['to-emerald-400', 'to-resource-xp'],
    // Connection indicator.
    ['bg-emerald-400', 'bg-status-success'], ['bg-red-500', 'bg-status-error'],
    ...STATS,
  ],

  'src/components/game-interface/panels/CharPanel.tsx': [
    ['from-rose-500', 'from-resource-hp'], ['via-red-500', 'via-resource-hp'], ['to-rose-600', 'to-resource-hp'],
    ['from-sky-500', 'from-resource-mp'], ['via-blue-500', 'via-resource-mp'], ['to-indigo-500', 'to-resource-mp'],
    ['from-green-500', 'from-resource-xp'], ['via-emerald-500', 'via-resource-xp'], ['to-green-600', 'to-resource-xp'],
    // Overheal / overcharge readouts, and the "spend a point" pulse.
    ['text-yellow-400', 'text-resource-gold'],
    ['bg-yellow-400', 'bg-resource-gold'], ['hover:bg-yellow-300', 'hover:bg-resource-gold'],
    ['text-green-400', 'text-resource-xp'],
    ...STATS,
  ],

  'src/components/game-interface/panels/BattlePanel.tsx': [
    // Victory side reads green, defeat side reads red; both are combat
    // outcomes rather than success/error messages.
    ['border-green-500', 'border-combat-victory'], ['border-green-700', 'border-combat-victory'],
    ['border-green-800', 'border-combat-victory'], ['border-green-900', 'border-combat-victory'],
    ['hover:text-green-300', 'hover:text-combat-victory'],
    ['border-red-800', 'border-combat-defeat'], ['border-red-900', 'border-combat-defeat'],
    ['hover:text-red-300', 'hover:text-combat-defeat'],
    ['text-red-200', 'text-combat-defeat'],
    // Damage numbers: the player's ranged and melee strikes, and the enemy's.
    ['text-green-400', 'text-combat-heal'], ['text-green-600', 'text-combat-heal'],
    ['text-green-800', 'text-combat-heal'], ['text-green-300', 'text-combat-victory'],
    ['text-red-400', 'text-combat-damage'], ['text-red-700', 'text-combat-damage'],
    ['text-red-800', 'text-combat-damage'], ['text-red-300', 'text-combat-damage'],
    ['text-red-900', 'text-combat-defeat'],
    ['text-orange-400', 'text-combat-crit'],
    ['text-red-500', 'text-enemy-hostile'],
    // Rewards column.
    ['text-purple-300', 'text-loot-epic'], ['text-purple-200', 'text-loot-epic'],
    ['text-amber-200', 'text-loot-legendary'],
    ['text-yellow-300', 'text-resource-gold'], ['border-yellow-900', 'border-resource-gold'],
    // Vitals inside the battle frame.
    ['bg-red-500', 'bg-resource-hp'], ['bg-blue-500', 'bg-resource-mp'],
    ['text-blue-400', 'text-resource-mp'], ['text-blue-300', 'text-resource-mp'],
    ['text-yellow-400', 'text-stat-def'], ['bg-yellow-400', 'bg-resource-xp'],
    ['to-red-700', 'to-combat-defeat'], ['to-green-700', 'to-combat-victory'],
  ],

  'src/components/game-interface/panels/FeedPanel.tsx': [
    // Feed channels.
    ['text-emerald-300', 'text-channel-room'], ['text-emerald-200', 'text-channel-room'],
    ['bg-emerald-500', 'bg-channel-room'],
    ['text-blue-300', 'text-channel-world'],
    ['text-purple-300', 'text-channel-dm'], ['text-purple-200', 'text-channel-dm'],
    ['text-purple-400', 'text-channel-dm'], ['bg-purple-500', 'bg-channel-dm'],
    ['text-violet-300', 'text-channel-dm'],
    ['text-amber-300', 'text-channel-action'], ['border-amber-400', 'border-channel-action'],
    ['border-amber-500', 'border-channel-action'], ['bg-amber-500', 'bg-channel-action'],
    ['hover:border-amber-300', 'hover:border-channel-action'],
    ['text-red-200', 'text-status-error'], ['text-red-300', 'text-status-error'],
    ['text-red-400', 'text-status-error'],
    ['text-green-300', 'text-status-success'], ['text-green-200', 'text-status-success'],
  ],

  'src/components/RoomBox.tsx': [
    // The room's own attack affordance and enemy chips.
    ['from-red-600', 'from-action-attack'], ['to-red-700', 'to-action-attack'],
    ['hover:from-red-500', 'hover:from-action-attack'], ['hover:to-red-600', 'hover:to-action-attack'],
    ['border-red-700', 'border-action-attack'], ['border-red-800', 'border-action-attack'],
    ['bg-red-950', 'bg-action-attack'], ['bg-red-900', 'bg-action-attack'],
    ['shadow-red-950', 'shadow-shadow'],
    ['text-red-400', 'text-enemy-hostile'], ['text-red-200', 'text-enemy-hostile'],
    ['text-green-400', 'text-terrain-grass'], ['text-amber-400', 'text-resource-gold'],
    ['text-blue-400', 'text-status-info'],
    ['bg-green-500', 'bg-action-gather'], ['hover:bg-green-500', 'hover:bg-action-gather'],
    ['border-green-600', 'border-action-gather'], ['hover:border-green-500', 'hover:border-action-gather'],
    ['bg-blue-400', 'bg-action-look'], ['hover:bg-blue-400', 'hover:bg-action-look'],
    ['border-blue-500', 'border-action-look'], ['hover:border-blue-400', 'hover:border-action-look'],
    ['hover:border-amber-300', 'hover:border-resource-gold'],
  ],
}

/**
 * Last resort, by colour family.
 *
 * Only reaches files with no per-file rules — small ones whose colour use
 * follows the obvious convention (green for good, red for bad, amber for gold).
 */
const FAMILY = {
  rose: 'resource-hp',
  red: 'status-error',
  orange: 'action-attack',
  amber: 'resource-gold',
  yellow: 'status-warning',
  lime: 'status-success',
  green: 'status-success',
  emerald: 'status-success',
  teal: 'action-search',
  cyan: 'action-search',
  sky: 'status-info',
  blue: 'resource-mp',
  indigo: 'accent',
  violet: 'stat-mag',
  purple: 'stat-mag',
  fuchsia: 'loot-epic',
  pink: 'hue-pink',
}

const PREFIXES = ['bg', 'text', 'border', 'ring', 'from', 'to', 'via', 'fill', 'stroke', 'divide', 'placeholder', 'shadow', 'decoration', 'outline', 'accent', 'caret']

function familyPairs() {
  const pairs = []
  for (const prefix of PREFIXES) {
    for (const [family, token] of Object.entries(FAMILY)) {
      for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        pairs.push([`${prefix}-${family}-${shade}`, `${prefix}-${token}`])
      }
    }
  }
  return pairs
}

const EXCLUDE = [/^src\/lib\/room-actions\.ts$/, /^src\/lib\/theme\//, /^prisma\//, /^scripts\//, /^src\/app\/generated-themes\.css$/]

const files = execSync(
  "git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.js' 'src/**/*.jsx' 'src/**/*.css'",
  { encoding: 'utf8' }
).split('\n').filter(Boolean).filter((f) => !EXCLUDE.some((re) => re.test(f)))

const FAMILY_PAIRS = familyPairs()
let total = 0
let changed = 0
const byTier = { global: 0, perFile: 0, family: 0 }

for (const file of files) {
  const original = readFileSync(file, 'utf8')
  let next = original
  let n

  ;[next, n] = rewrite(next, GLOBAL); byTier.global += n; total += n
  if (PER_FILE[file]) { ;[next, n] = rewrite(next, PER_FILE[file]); byTier.perFile += n; total += n }
  ;[next, n] = rewrite(next, FAMILY_PAIRS); byTier.family += n; total += n

  if (next !== original) { writeFileSync(file, next, 'utf8'); changed++ }
}

console.log(`migrate-chromatic-classes: ${total} replacements across ${changed} files`)
console.log(`  global ${byTier.global} | per-file ${byTier.perFile} | family fallback ${byTier.family}`)
