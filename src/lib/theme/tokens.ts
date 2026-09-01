/**
 * Flattening a `Theme` into the CSS custom properties the application reads.
 *
 * The variable names here are the stable contract. Components use them through
 * Tailwind utilities (`bg-surface-panel`, `text-fg-muted`, `text-action-attack`)
 * which are registered against these same variables in `globals.css`, or —
 * where the value is data-driven, like a room's authored colour — directly as
 * `style={{ color: 'var(--world-red-town)' }}`.
 *
 * Nothing outside this file needs to know how a value was produced: authored in
 * the theme, or derived from it.
 */

import type {
  RegionId,
  RegionPalette,
  ResolvedRegionPalette,
  Theme,
} from './types'
import { REGION_IDS } from './regions'
import { adjustLightness, alpha, contrast, deltaE, ensureContrast, mix } from './color'

/**
 * Roles that can end up as a filled surface behind a label.
 *
 * Each gets a companion `--on-<role>` holding the text colour that actually
 * reads on it. Text ranks and lines are excluded — a line is never a fill, and
 * pairing a text colour with itself is meaningless.
 */
const FILLABLE_PREFIXES = [
  // Surfaces are included because a neutral button is still a filled control
  // that needs a readable label — `.fill-surface-selected` is the plain grey
  // button, and it should be as safe as a coloured one.
  '--surface-',
  '--action-',
  '--resource-',
  '--stat-',
  '--status-',
  '--loot-',
  '--enemy-',
  '--channel-',
  '--combat-',
  '--terrain-',
  '--mood-',
  '--hue-',
  '--accent',
  '--world-',
]

/** `--world-red-town-tint` carries alpha and is a wash, never a fill. */
const NOT_FILLABLE = /-tint$/

export function isFillableVar(name: string): boolean {
  if (NOT_FILLABLE.test(name)) return false
  return FILLABLE_PREFIXES.some((p) => name.startsWith(p))
}

/** A generated companion (`--fill-*`, `--hover-*`, `--on-*`), not an authored role. */
export function isFillCompanion(name: string): boolean {
  return name.startsWith('--fill-') || name.startsWith('--hover-') || name.startsWith('--on-')
}

/**
 * Contrast a button label must clear against its own fill at rest.
 *
 * Deliberately above the 4.5 floor. Hover brightens the fill, which spends
 * contrast — so the resting state needs headroom, or the hover has nowhere to
 * go and the control ends up with no visible hover state at all.
 */
const LABEL_CONTRAST = 5.3

/** The floor the label must still clear once the fill has brightened. */
const LABEL_CONTRAST_HOVER = 4.5

/** How far a hover may brighten its fill, in OKLab lightness. */
const HOVER_LIFT = 0.055

/** Below this, the hover is not a state anybody can see. */
const MIN_HOVER_DELTA = 0.015

/**
 * Deepen a role colour until the theme's bright text reads on it.
 *
 * Buttons are light-on-dark, the way the rest of the interface is. Getting
 * there by flipping the *label* to dark on a pale fill technically passes
 * contrast but looks wrong beside every other control, so the fill moves
 * instead: a gold button becomes deep bronze rather than pale gold with black
 * text on it.
 *
 * Lightness only, in OKLab, so the hue and saturation survive the move — gold
 * stays gold. `mix(colour, background)` would drain the chroma on the way down
 * and land on a muddy brown.
 *
 * The role's own value is left alone. `--resource-gold` is still the bright
 * gold that reads as text on a dark panel; `--fill-resource-gold` is the
 * deepened version used behind a label. They are different jobs and they need
 * different values.
 */
function deepenForLabel(color: string, label: string, target: number): string {
  if (contrast(label, color) >= target) return color

  let current = color
  for (let step = 0; step < 40; step++) {
    current = adjustLightness(current, -0.025)
    if (contrast(label, current) >= target) return current
  }
  return current
}

/**
 * The text colour that reads on a given fill.
 *
 * The theme's bright text wherever the fill can be deepened to carry it, which
 * is nearly always. The dark end is the fallback for a fill that cannot go dark
 * enough — and pure black or white only if the theme's own extremes both fail.
 */
export function readableOn(
  fill: string,
  ui: Pick<Theme['ui'], 'surfaceCanvas' | 'fgBright'>
): string {
  for (const candidate of [ui.fgBright, ui.surfaceCanvas, '#ffffff', '#000000']) {
    if (contrast(candidate, fill) >= 4.5) return candidate
  }
  // Nothing clears the bar; take whichever is closest.
  return contrast(ui.fgBright, fill) >= contrast(ui.surfaceCanvas, fill)
    ? ui.fgBright
    : ui.surfaceCanvas
}

/** `grassyField` -> `grassy-field`, so CSS vars stay conventionally kebab-cased. */
export function regionVarName(region: RegionId): string {
  return region.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Fill in a region's unauthored slots from its identity colour.
 *
 * The derivation is what makes a fifteen-region world affordable across eight
 * themes: importing a terminal palette costs one colour per region, and the
 * launch themes then override only the slots where the automatic answer was
 * not good enough. Title and subtitle are pushed toward the theme's brightest
 * text until they clear a reading threshold, because a region's identity colour
 * is picked to be recognisable, not to be legible at body-text size.
 */
export function deriveRegionPalette(
  palette: RegionPalette,
  theme: Pick<Theme, 'ui'>
): ResolvedRegionPalette {
  const { base } = palette
  const { surfacePanel, surfaceCanvas, fgBright, fgMuted } = theme.ui

  const title = palette.title ?? ensureContrast(base, surfacePanel, 4.5, fgBright)
  const subtitle =
    palette.subtitle ?? ensureContrast(mix(title, fgMuted, 0.45), surfacePanel, 3.5, fgMuted)

  return {
    base,
    title,
    subtitle,
    icon: palette.icon ?? ensureContrast(base, surfacePanel, 3, fgBright),
    direction: palette.direction ?? ensureContrast(base, surfaceCanvas, 2.5, fgBright),
    accent: palette.accent ?? mix(base, fgBright, 0.25),
    tint: palette.tint ?? alpha(base, 0.1),
  }
}

/** Every region's palette for a theme, with derivation applied. */
export function resolveRegions(theme: Theme): Record<RegionId, ResolvedRegionPalette> {
  const out = {} as Record<RegionId, ResolvedRegionPalette>
  for (const id of REGION_IDS) {
    out[id] = deriveRegionPalette(theme.regions[id], theme)
  }
  return out
}

/**
 * The full variable set for a theme, as `{ '--surface-panel': '#161616', ... }`.
 *
 * Ordering is stable so generated CSS diffs stay readable.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const cached = CSS_VARS_CACHE.get(theme)
  if (cached) return cached
  const vars = computeCssVars(theme)
  CSS_VARS_CACHE.set(theme, vars)
  return vars
}

/**
 * Memo of `computeCssVars`, keyed by theme identity.
 *
 * Building the set costs a few milliseconds — the fill companions walk 165
 * roles through an OKLab search each — and the pickers ask for it during
 * render: the header dot on every vitals change, the Settings list once per
 * theme per render. Themes are built once at module load and never mutated,
 * so the answer never changes and object identity is a safe key.
 */
const CSS_VARS_CACHE = new WeakMap<Theme, Record<string, string>>()

function computeCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {}
  const { ui, game, terminal } = theme

  // --- Interface: surfaces -------------------------------------------------
  vars['--surface-canvas'] = ui.surfaceCanvas
  vars['--surface-sunken'] = ui.surfaceSunken
  vars['--surface-panel'] = ui.surfacePanel
  vars['--surface-raised'] = ui.surfaceRaised
  vars['--surface-overlay'] = ui.surfaceOverlay
  vars['--surface-hover'] = ui.surfaceHover
  vars['--surface-selected'] = ui.surfaceSelected
  vars['--surface-disabled'] = ui.surfaceDisabled
  vars['--scrim'] = ui.scrim
  vars['--shadow'] = ui.shadow

  // --- Interface: text -----------------------------------------------------
  vars['--fg-bright'] = ui.fgBright
  vars['--fg-primary'] = ui.fgPrimary
  vars['--fg-secondary'] = ui.fgSecondary
  vars['--fg-muted'] = ui.fgMuted
  vars['--fg-disabled'] = ui.fgDisabled
  vars['--fg-on-accent'] = ui.fgOnAccent

  // --- Interface: lines and emphasis ---------------------------------------
  vars['--line-subtle'] = ui.lineSubtle
  vars['--line-strong'] = ui.lineStrong
  vars['--line-focus'] = ui.lineFocus
  vars['--accent'] = ui.accent
  vars['--accent-hover'] = ui.accentHover
  vars['--accent-muted'] = ui.accentMuted

  // --- Game roles ----------------------------------------------------------
  for (const [k, v] of Object.entries(game.action)) vars[`--action-${k}`] = v
  for (const [k, v] of Object.entries(game.resource)) vars[`--resource-${k}`] = v
  for (const [k, v] of Object.entries(game.stat)) vars[`--stat-${k}`] = v
  for (const [k, v] of Object.entries(game.status)) vars[`--status-${k}`] = v
  for (const [k, v] of Object.entries(game.loot)) vars[`--loot-${k}`] = v
  for (const [k, v] of Object.entries(game.enemy)) vars[`--enemy-${k}`] = v
  for (const [k, v] of Object.entries(game.channel)) vars[`--channel-${k}`] = v
  for (const [k, v] of Object.entries(game.combat)) vars[`--combat-${k}`] = v
  for (const [k, v] of Object.entries(game.terrain)) vars[`--terrain-${k}`] = v
  for (const [k, v] of Object.entries(game.mood)) vars[`--mood-${k}`] = v
  for (const [k, v] of Object.entries(game.hue)) vars[`--hue-${k}`] = v

  // --- World regions -------------------------------------------------------
  const regions = resolveRegions(theme)
  for (const id of REGION_IDS) {
    const name = regionVarName(id)
    const p = regions[id]
    vars[`--world-${name}`] = p.base
    vars[`--world-${name}-title`] = p.title
    vars[`--world-${name}-subtitle`] = p.subtitle
    vars[`--world-${name}-icon`] = p.icon
    vars[`--world-${name}-direction`] = p.direction
    vars[`--world-${name}-accent`] = p.accent
    vars[`--world-${name}-tint`] = p.tint
  }

  // --- Terminal layer ------------------------------------------------------
  // Exposed as variables so the Color Lab can show the portable palette and a
  // future exporter can read it from the same place the app does.
  vars['--term-bg'] = terminal.background
  vars['--term-fg'] = terminal.foreground
  vars['--term-cursor'] = terminal.cursor
  vars['--term-selection-bg'] = terminal.selectionBackground
  vars['--term-selection-fg'] = terminal.selectionForeground

  const ansi: [string, string][] = [
    ['black', terminal.black],
    ['red', terminal.red],
    ['green', terminal.green],
    ['yellow', terminal.yellow],
    ['blue', terminal.blue],
    ['magenta', terminal.magenta],
    ['cyan', terminal.cyan],
    ['white', terminal.white],
    ['bright-black', terminal.brightBlack],
    ['bright-red', terminal.brightRed],
    ['bright-green', terminal.brightGreen],
    ['bright-yellow', terminal.brightYellow],
    ['bright-blue', terminal.brightBlue],
    ['bright-magenta', terminal.brightMagenta],
    ['bright-cyan', terminal.brightCyan],
    ['bright-white', terminal.brightWhite],
  ]
  for (const [name, value] of ansi) vars[`--ansi-${name}`] = value

  // --- Filled-control companions -------------------------------------------
  // Computed last, from the finished values, so an override or a legibility
  // pass earlier in the build is reflected here rather than shadowed by it.
  //
  // Three variables per fillable role:
  //   --fill-<role>   the background, deepened so the label reads on it
  //   --hover-<role>  the same, moved, so the hover state is visible
  //   --on-<role>     the label colour, always the theme's bright text
  //
  // The hover companion is `--hover-<role>` rather than `--fill-<role>-hover`
  // because the latter collides: the role `accent-hover` would generate
  // `--fill-accent-hover`, silently overwriting the hover of `accent`.
  //
  // Surfaces are exempt from deepening: a panel is already a background, and
  // darkening it would pull it out of the elevation ladder it belongs to.
  for (const [name, value] of Object.entries({ ...vars })) {
    if (!isFillableVar(name)) continue
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) continue

    const role = name.slice(2)
    const isSurface = name.startsWith('--surface-')

    const fill = isSurface ? value : deepenForLabel(value, ui.fgBright, LABEL_CONTRAST)
    const label = readableOn(fill, ui)

    // Hover brightens the fill toward the role it represents, in small steps,
    // stopping at the contrast floor — so the lift is as large as the palette
    // can afford rather than a fixed amount some themes cannot pay.
    let hover = ui.surfaceHover
    if (!isSurface) {
      hover = fill
      for (let step = 0; step < 8; step++) {
        const next = adjustLightness(hover, HOVER_LIFT / 4)
        if (contrast(label, next) < LABEL_CONTRAST_HOVER) break
        hover = next
      }

      // A few fills sit where brightening cannot buy a visible change without
      // spending the label's contrast. Those deepen instead: against a light
      // label that only raises contrast, and a control that darkens under the
      // pointer still reads as responding. A hover nobody can see does not.
      if (deltaE(fill, hover) < MIN_HOVER_DELTA) {
        hover = adjustLightness(fill, -HOVER_LIFT)
      }
    }

    vars[`--fill-${role}`] = fill
    vars[`--hover-${role}`] = hover
    vars[`--on-${role}`] = label
  }

  return vars
}
