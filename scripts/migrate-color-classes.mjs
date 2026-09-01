/**
 * Codemod: raw Tailwind colour utilities -> semantic theme utilities.
 *
 * Handles the neutral scale only. Those ~1,400 usages are mechanical — a
 * a mid-grey background is a raised surface wherever it appears — so a table keyed on
 * the utility prefix gets them right, and getting them out of the way leaves a
 * reviewable number of chromatic decisions to make by hand.
 *
 * Chromatic colours are deliberately NOT touched here. `text-red-400` might be
 * attack, error, HP or damage depending on what it labels, and a codemod that
 * guessed would bake the wrong meaning into hundreds of call sites.
 *
 * Variants (`hover:`, `sm:`, `group-hover:`, `data-[x]:`) and opacity modifiers
 * (`/40`) are preserved: only the colour core of each utility is rewritten.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Utility prefix -> shade -> replacement colour name. */
const MAP = {
  text: {
    white: 'fg-bright', 'gray-50': 'fg-bright', 'gray-100': 'fg-bright', 'gray-200': 'fg-bright',
    'gray-300': 'fg-primary',
    'gray-400': 'fg-secondary', 'neutral-400': 'fg-secondary', 'slate-400': 'fg-secondary',
    'gray-500': 'fg-muted',
    'gray-600': 'fg-disabled', 'gray-700': 'fg-disabled', 'gray-800': 'fg-disabled',
    'gray-900': 'fg-disabled',
    black: 'fg-on-accent',
  },
  bg: {
    'gray-950': 'surface-canvas', 'gray-900': 'surface-panel', 'gray-800': 'surface-raised',
    'gray-700': 'surface-hover', 'gray-600': 'surface-selected', 'gray-500': 'surface-selected',
    'slate-500': 'surface-selected', 'slate-700': 'surface-hover', 'stone-500': 'surface-selected',
    'stone-400': 'surface-selected',
    'gray-400': 'fg-disabled', 'gray-300': 'fg-muted', 'gray-200': 'fg-secondary',
    'gray-100': 'fg-primary', 'gray-50': 'fg-bright',
    white: 'fg-bright', black: 'surface-sunken',
  },
  border: {
    'gray-950': 'line-subtle', 'gray-900': 'line-subtle', 'gray-800': 'line-subtle',
    'gray-700': 'line-subtle',
    'gray-600': 'line-strong', 'gray-500': 'line-strong', 'gray-400': 'line-strong',
    'slate-500': 'line-strong', 'slate-600': 'line-strong', 'slate-700': 'line-subtle',
    white: 'fg-bright',
  },
  ring: {
    'gray-500': 'line-strong', 'gray-600': 'line-strong', 'gray-700': 'line-subtle',
    white: 'fg-bright',
  },
  'ring-offset': {
    'gray-900': 'surface-canvas', 'gray-950': 'surface-canvas', 'gray-800': 'surface-panel',
  },
  divide: { 'gray-800': 'line-subtle', 'gray-700': 'line-subtle', white: 'fg-bright' },
  placeholder: { 'gray-500': 'fg-muted', 'gray-600': 'fg-disabled' },
  from: {
    'gray-950': 'surface-canvas', 'gray-900': 'surface-panel', 'gray-800': 'surface-raised',
    'gray-700': 'surface-hover', 'gray-600': 'surface-selected',
  },
  to: {
    'gray-950': 'surface-canvas', 'gray-900': 'surface-panel', 'gray-800': 'surface-raised',
    'gray-700': 'surface-hover', 'gray-600': 'surface-selected',
  },
  via: {
    'gray-950': 'surface-canvas', 'gray-900': 'surface-panel', 'gray-800': 'surface-raised',
    'gray-700': 'surface-hover', 'gray-600': 'surface-selected',
  },
  fill: { 'gray-400': 'fg-secondary', 'gray-500': 'fg-muted', white: 'fg-bright' },
  stroke: { 'gray-400': 'fg-secondary', 'gray-500': 'fg-muted', white: 'fg-bright' },
  accent: { 'gray-500': 'fg-muted' },
}

// The theme module names legacy colours in string literals on purpose, and the
// seed's room colours are already migrated to tokens.
const EXCLUDE = [
  /^src\/lib\/theme\//,
  /^prisma\//,
  /^src\/app\/generated-themes\.css$/,
  /^scripts\//,
]

const files = execSync(
  "git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.js' 'src/**/*.jsx' 'src/**/*.css'",
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean)
  .filter((f) => !EXCLUDE.some((re) => re.test(f)))

// Longest prefixes first so `ring-offset-` wins over `ring-`.
const PREFIXES = Object.keys(MAP).sort((a, b) => b.length - a.length)

let totalReplacements = 0
let filesChanged = 0
const perColor = new Map()

for (const file of files) {
  const original = readFileSync(file, 'utf8')
  let next = original
  let fileCount = 0

  for (const prefix of PREFIXES) {
    for (const [shade, replacement] of Object.entries(MAP[prefix])) {
      // Match the utility only when it stands alone: preceded by a boundary
      // that is not another `-` (so `ring-offset-gray-900` is never chewed by
      // the `ring-` rule) and followed by end, whitespace, quote, or `/opacity`.
      const re = new RegExp(
        `(^|[\\s"'\\\`{(\\[:])((?:[a-z-]+:)*)(${prefix})-(${shade.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})(?=$|[\\s"'\\\`})\\]]|/)`,
        'g'
      )
      next = next.replace(re, (_m, lead, variants, p, s) => {
        fileCount++
        perColor.set(`${p}-${s}`, (perColor.get(`${p}-${s}`) ?? 0) + 1)
        return `${lead}${variants}${p}-${replacement}`
      })
    }
  }

  if (next !== original) {
    writeFileSync(file, next, 'utf8')
    filesChanged++
    totalReplacements += fileCount
  }
}

console.log(`migrate-color-classes: ${totalReplacements} replacements across ${filesChanged} files\n`)
const top = [...perColor].sort((a, b) => b[1] - a[1])
for (const [name, count] of top.slice(0, 25)) console.log(`  ${String(count).padStart(4)}  ${name}`)
if (top.length > 25) console.log(`  ... and ${top.length - 25} more`)
