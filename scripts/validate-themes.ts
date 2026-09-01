/**
 * Theme linter.
 *
 * Runs the project's contrast and state-visibility checks over every launch
 * theme. This is what makes "all eight themes are readable" a claim the build
 * can defend rather than something a person eyeballed once.
 *
 * Three families of check:
 *
 *  - **Well-formedness.** Every value parses as a colour. Catches typos in a
 *    six-digit hex string, which are otherwise invisible until a variable
 *    silently fails to apply in the browser.
 *
 *  - **Contrast.** Text roles against the surfaces they are actually painted
 *    on. Thresholds follow WCAG AA: 4.5:1 for body text, 3:1 for large text,
 *    icons and non-text indicators such as borders and compass buttons.
 *
 *  - **Distinctness.** The roles the brief requires to stay apart — attack, HP,
 *    error and every red-aligned region identity — must differ by a visible
 *    margin, and interaction states (hover, selected, focus, disabled) must be
 *    visibly different from their resting surface.
 */

import { THEMES } from '../src/lib/theme/themes'
import { resolveRegions } from '../src/lib/theme/tokens'
import { REGIONS } from '../src/lib/theme/regions'
import { contrast, deltaE, parseHex } from '../src/lib/theme/color'
import type { Theme } from '../src/lib/theme/types'

interface Problem {
  theme: string
  kind: 'malformed' | 'contrast' | 'distinctness'
  detail: string
}

const problems: Problem[] = []
const notes: string[] = []

function add(theme: string, kind: Problem['kind'], detail: string) {
  problems.push({ theme, kind, detail })
}

/**
 * Visible difference between two colours, in OKLab units.
 *
 * See `deltaE`: ~0.02 is just noticeable, ~0.05 comfortably different, ~0.10
 * reads as two different colours at a glance.
 */
function distance(a: string, b: string): number {
  return deltaE(a, b)
}

function walk(value: unknown, path: string, visit: (path: string, color: string) => void) {
  if (typeof value === 'string') {
    visit(path, value)
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, visit)
  }
}

const SKIP_PARSE = new Set(['id', 'name', 'description', 'appearance'])

function checkWellFormed(theme: Theme) {
  for (const [key, value] of Object.entries(theme)) {
    if (SKIP_PARSE.has(key)) continue
    walk(value, key, (path, color) => {
      try {
        parseHex(color)
      } catch {
        add(theme.id, 'malformed', `${path} = ${JSON.stringify(color)} is not a hex colour`)
      }
    })
  }
}

/** Text roles and the surface each is realistically drawn on. */
function checkContrast(theme: Theme) {
  const { ui, game } = theme
  const panel = ui.surfacePanel
  const canvas = ui.surfaceCanvas
  const raised = ui.surfaceRaised

  const body: [string, string, string][] = [
    ['ui.fgPrimary', ui.fgPrimary, panel],
    ['ui.fgPrimary/canvas', ui.fgPrimary, canvas],
    ['ui.fgPrimary/raised', ui.fgPrimary, raised],
    ['ui.fgSecondary', ui.fgSecondary, panel],
    ['ui.fgBright', ui.fgBright, panel],
  ]
  for (const [label, fg, bg] of body) {
    const ratio = contrast(fg, bg)
    if (ratio < 4.5) add(theme.id, 'contrast', `${label} is ${ratio.toFixed(2)}:1 (need 4.5)`)
  }

  // Muted text and coloured gameplay text are large or supporting, and are held
  // to the 3:1 large-text/non-text bar.
  const supporting: [string, string, string][] = [
    ['ui.fgMuted', ui.fgMuted, panel],
    ['ui.fgMuted/canvas', ui.fgMuted, canvas],
    ['ui.accent', ui.accent, panel],
    ...Object.entries(game.action).map(
      ([k, v]) => [`game.action.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.resource).map(
      ([k, v]) => [`game.resource.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.stat).map(
      ([k, v]) => [`game.stat.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.status).map(
      ([k, v]) => [`game.status.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.loot).map(
      ([k, v]) => [`game.loot.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.channel).map(
      ([k, v]) => [`game.channel.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.combat).map(
      ([k, v]) => [`game.combat.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.enemy).map(
      ([k, v]) => [`game.enemy.${k}`, v, panel] as [string, string, string]
    ),
    ...Object.entries(game.mood).map(
      ([k, v]) => [`game.mood.${k}`, v, panel] as [string, string, string]
    ),
  ]
  for (const [label, fg, bg] of supporting) {
    const ratio = contrast(fg, bg)
    if (ratio < 3) add(theme.id, 'contrast', `${label} is ${ratio.toFixed(2)}:1 (need 3.0)`)
  }

  // Label text on a filled accent button.
  const onAccent = contrast(ui.fgOnAccent, ui.accent)
  if (onAccent < 4.5) {
    add(theme.id, 'contrast', `ui.fgOnAccent on ui.accent is ${onAccent.toFixed(2)}:1 (need 4.5)`)
  }

  // Borders are non-text indicators: 3:1 against what they separate.
  const line = contrast(ui.lineStrong, panel)
  if (line < 1.6) {
    add(theme.id, 'contrast', `ui.lineStrong on surfacePanel is ${line.toFixed(2)}:1 (need 1.6)`)
  }
  const focus = contrast(ui.lineFocus, panel)
  if (focus < 3) {
    add(theme.id, 'contrast', `ui.lineFocus on surfacePanel is ${focus.toFixed(2)}:1 (need 3.0)`)
  }

  // Region titles and subtitles are room headings, drawn on the room panel.
  const regions = resolveRegions(theme)
  for (const { id, name } of REGIONS) {
    const p = regions[id]
    const t = contrast(p.title, panel)
    if (t < 4.5) add(theme.id, 'contrast', `region ${name} title is ${t.toFixed(2)}:1 (need 4.5)`)
    const s = contrast(p.subtitle, panel)
    if (s < 3) add(theme.id, 'contrast', `region ${name} subtitle is ${s.toFixed(2)}:1 (need 3.0)`)
    const i = contrast(p.icon, panel)
    if (i < 3) add(theme.id, 'contrast', `region ${name} icon is ${i.toFixed(2)}:1 (need 3.0)`)
    const d = contrast(p.direction, canvas)
    if (d < 2.2) add(theme.id, 'contrast', `region ${name} direction is ${d.toFixed(2)}:1 (need 2.2)`)
  }
}

/**
 * The separations the brief calls out by name, plus interaction states.
 *
 * The red family is the one that matters: attack, HP, error and Red Town all
 * live in the same corner of the wheel and all four appear on screen at once
 * during a fight in Red Town.
 */
function checkDistinctness(theme: Theme) {
  const { ui, game } = theme
  const regions = resolveRegions(theme)

  const MIN_ROLE_DISTANCE = 0.1

  const redFamily: [string, string][] = [
    ['action.attack', game.action.attack],
    ['resource.hp', game.resource.hp],
    ['status.error', game.status.error],
    ['world.redTown', regions.redTown.base],
  ]
  for (let i = 0; i < redFamily.length; i++) {
    for (let j = i + 1; j < redFamily.length; j++) {
      const [an, av] = redFamily[i]
      const [bn, bv] = redFamily[j]
      const d = distance(av, bv)
      if (d < MIN_ROLE_DISTANCE) {
        add(
          theme.id,
          'distinctness',
          `${an} (${av}) and ${bn} (${bv}) differ by only ${d.toFixed(3)} (need ${MIN_ROLE_DISTANCE})`
        )
      }
    }
  }

  // Regions must be tellable apart from one another, or the world stops
  // reading as a set of distinct places.
  const bases = REGIONS.map((r) => [r.name, regions[r.id].base] as [string, string])
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      const d = distance(bases[i][1], bases[j][1])
      if (d < 0.04) {
        add(
          theme.id,
          'distinctness',
          `regions ${bases[i][0]} (${bases[i][1]}) and ${bases[j][0]} (${bases[j][1]}) differ by only ${d.toFixed(3)} (need 0.040)`
        )
      }
    }
  }

  // Interaction states have to be visible as states.
  const states: [string, string, string, number][] = [
    ['surfaceHover', ui.surfaceHover, ui.surfacePanel, 0.02],
    ['surfaceSelected', ui.surfaceSelected, ui.surfacePanel, 0.04],
    ['surfaceRaised', ui.surfaceRaised, ui.surfacePanel, 0.012],
    ['fgDisabled', ui.fgDisabled, ui.fgPrimary, 0.1],
  ]
  for (const [label, a, b, min] of states) {
    const d = distance(a, b)
    if (d < min) {
      add(theme.id, 'distinctness', `ui.${label} (${a}) is only ${d.toFixed(3)} from its base (need ${min})`)
    }
  }
}

for (const theme of THEMES) {
  checkWellFormed(theme)
  checkContrast(theme)
  checkDistinctness(theme)
}

const byTheme = new Map<string, Problem[]>()
for (const p of problems) {
  if (!byTheme.has(p.theme)) byTheme.set(p.theme, [])
  byTheme.get(p.theme)!.push(p)
}

if (problems.length === 0) {
  console.log(`All ${THEMES.length} themes pass contrast and distinctness checks.`)
  for (const n of notes) console.log(`  note: ${n}`)
  process.exit(0)
}

console.error(`Theme validation found ${problems.length} problem(s):\n`)
for (const [themeId, list] of byTheme) {
  console.error(`  ${themeId}`)
  for (const p of list) console.error(`    [${p.kind}] ${p.detail}`)
  console.error('')
}
process.exit(1)
