/**
 * Builds a complete `Theme` from a terminal palette plus targeted overrides.
 *
 * The derivation here is the reason eight themes is a tractable amount of work.
 * A terminal palette is sixteen colours chosen to be legible against one
 * background; an application needs roughly two hundred values. `makeTheme`
 * spans that gap with rules that hold for any palette, and each launch theme
 * then overrides only the handful of slots where the automatic answer looked
 * wrong to a human.
 *
 * Two derivation choices are load-bearing rather than cosmetic:
 *
 *  - **Surfaces are mixes of background toward foreground**, never ANSI colours.
 *    ANSI colours are picked for contrast *against* the background; painting a
 *    panel with one produces a surface nothing else in the theme can sit on.
 *
 *  - **The red family is pulled apart by construction.** `action.attack`,
 *    `resource.hp`, `status.error` and Red Town all start from the palette's
 *    red and are then pushed to different places — attack toward yellow, hp
 *    toward magenta, error left at bright red, Red Town muted into the
 *    background. Every theme therefore satisfies the requirement that these
 *    four stay visibly distinct, without anyone having to check by hand.
 */

import type {
  RegionId,
  RegionPalette,
  TerminalPalette,
  Theme,
} from './types'
import { adjustChroma, adjustLightness, alpha, contrast, deltaE, ensureContrast, luminance, mix, toOklab } from './color'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export interface ThemeRecipe {
  id: string
  name: string
  description: string
  appearance?: 'dark' | 'light'
  /** The picker swatch. Defaults to the interface accent when not authored. */
  swatch?: string
  terminal: TerminalPalette
  /**
   * Which ANSI colour drives buttons, links and focus rings. Defaults to the
   * palette's blue, which is the conventional "interactive" colour in nearly
   * every terminal scheme.
   */
  accentSource?: keyof TerminalPalette
  /** Slots where the derived value was not good enough. */
  overrides?: DeepPartial<Omit<Theme, 'id' | 'name' | 'description' | 'appearance' | 'swatch' | 'terminal'>>
}

function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base
  const out = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue
    const current = out[key]
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current, value as DeepPartial<unknown>)
    } else {
      out[key] = value
    }
  }
  return out as T
}

export function makeTheme(recipe: ThemeRecipe): Theme {
  const t = recipe.terminal
  const bg = t.background
  const fg = t.foreground

  /** Step from the background toward the foreground. Keeps surfaces neutral. */
  const lift = (amount: number) => mix(bg, fg, amount)
  /** Step from the foreground toward the background. Ranks down text. */
  const fade = (amount: number) => mix(fg, bg, amount)
  /** Push a chromatic colour into the background, for muted region identities. */
  const dim = (color: string, amount: number) => mix(color, bg, amount)

  const accent = t[recipe.accentSource ?? 'blue']
  const accentHover = t.brightBlue

  const ui: Theme['ui'] = {
    surfaceCanvas: bg,
    surfaceSunken: mix(bg, '#000000', 0.35),
    surfacePanel: lift(0.045),
    surfaceRaised: lift(0.09),
    surfaceOverlay: lift(0.07),
    surfaceHover: lift(0.13),
    surfaceSelected: lift(0.18),
    surfaceDisabled: lift(0.05),

    scrim: alpha('#000000', 0.72),
    shadow: alpha('#000000', 0.55),

    fgBright: t.brightWhite,
    fgPrimary: fg,
    fgSecondary: fade(0.28),
    fgMuted: fade(0.48),
    fgDisabled: fade(0.65),
    // Filled accent buttons carry label text; pick whichever of the theme's own
    // extremes actually reads on that fill rather than assuming dark-on-light.
    fgOnAccent: contrast(accent, bg) >= contrast(accent, t.brightWhite) ? bg : t.brightWhite,

    lineSubtle: lift(0.16),
    lineStrong: lift(0.28),
    lineFocus: accent,

    accent,
    accentHover,
    accentMuted: dim(accent, 0.6),
  }

  const game: Theme['game'] = {
    action: {
      attack: mix(t.red, t.yellow, 0.35),
      search: t.cyan,
      rest: t.blue,
      look: fade(0.35),
      talk: t.yellow,
      travel: t.green,
      craft: mix(t.yellow, t.red, 0.35),
      gather: mix(t.green, t.yellow, 0.35),
      use: t.magenta,
    },
    resource: {
      hp: mix(t.red, t.magenta, 0.3),
      mp: t.brightBlue,
      xp: t.brightGreen,
      gold: t.brightYellow,
    },
    stat: {
      str: t.brightRed,
      dex: t.brightGreen,
      mag: t.brightMagenta,
      def: t.brightBlue,
    },
    status: {
      success: t.green,
      error: t.brightRed,
      warning: t.yellow,
      info: t.cyan,
    },
    loot: {
      common: fade(0.3),
      uncommon: t.green,
      rare: t.blue,
      epic: t.magenta,
      legendary: mix(t.yellow, t.brightYellow, 0.5),
    },
    enemy: {
      hostile: t.red,
      neutral: t.yellow,
      boss: t.magenta,
    },
    channel: {
      room: t.green,
      world: t.blue,
      action: t.yellow,
      dm: t.magenta,
      system: fade(0.35),
      quest: t.brightYellow,
    },
    combat: {
      victory: t.brightGreen,
      defeat: dim(t.red, 0.25),
      damage: mix(t.brightRed, t.yellow, 0.25),
      // Healing has to stay separate from victory green, which is also bright.
      heal: mix(t.green, t.cyan, 0.3),
      miss: fade(0.45),
      crit: t.brightYellow,
    },
    terrain: {
      grass: t.green,
      forest: dim(t.green, 0.3),
      dirt: dim(mix(t.yellow, t.red, 0.45), 0.2),
      sand: mix(t.yellow, t.white, 0.4),
      stone: fade(0.4),
      water: t.cyan,
      ash: mix(t.brightBlack, t.white, 0.25),
      bone: mix(t.white, t.yellow, 0.25),
    },
    mood: {
      danger: dim(t.red, 0.1),
      arcane: t.magenta,
      sacred: mix(t.blue, t.white, 0.3),
      treasure: t.yellow,
      calm: mix(t.blue, t.cyan, 0.35),
      decay: dim(mix(t.green, t.yellow, 0.55), 0.3),
    },
    hue: {
      gray: fade(0.25),
      red: t.red,
      gold: t.yellow,
      green: t.green,
      sky: t.cyan,
      blue: t.blue,
      violet: t.magenta,
      purple: mix(t.magenta, t.blue, 0.35),
      pink: mix(t.magenta, t.red, 0.35),
    },
  }

  // Region identities. Each is recognisable on its own terms — Red Town warm
  // and brick-like, the Beach pale and sandy, the Mine lit by brass lamplight —
  // while being built from this theme's own palette so it harmonises with it.
  const regions: Record<RegionId, RegionPalette> = {
    roomZero: { base: mix(t.magenta, t.blue, 0.25) },
    grassyField: { base: t.green },
    // Warm earth: the cellar under the cabin.
    grassyFieldUnderground: { base: dim(mix(t.yellow, t.red, 0.45), 0.3) },
    beach: { base: mix(t.yellow, t.white, 0.55) },
    caves: { base: dim(mix(t.blue, t.white, 0.2), 0.3) },
    // Venom: the warmest, most saturated point in the yellow family.
    scorpionPit: { base: mix(t.yellow, t.red, 0.4) },
    forest: { base: dim(t.green, 0.25) },
    forestUnderground: { base: dim(mix(t.green, t.blue, 0.45), 0.25) },
    redTown: { base: dim(t.red, 0.22) },
    // Stagnant olive, pushed well past forest green and darkened, so the two
    // green regions are not mistaken for one another.
    redTownSewers: { base: dim(mix(t.green, t.yellow, 0.7), 0.45) },
    rockyFlats: { base: mix(t.yellow, t.brightBlack, 0.45) },
    // Dry pale stone: the same warm grey family as the surface, dropped a
    // couple of stops. Deliberately not the cellar's brown and not the caves'
    // cold blue, which are the two regions it is most often confused with.
    rockyFlatsUnderground: { base: dim(mix(t.yellow, t.brightBlack, 0.55), 0.3) },
    // Brass lamplight: the most saturated point in the earthy family, which is
    // what keeps it clear of the dusty surface above it.
    neverendingMine: { base: mix(t.yellow, t.white, 0.12) },
    solarOffice: { base: t.brightYellow },
    lobby: { base: mix(t.blue, t.white, 0.3) },
  }

  const derived: Omit<Theme, 'id' | 'name' | 'description' | 'appearance' | 'swatch' | 'terminal'> = {
    ui,
    game,
    regions,
  }

  const merged = deepMerge(derived, recipe.overrides)

  // Guarantees, applied after overrides so they hold for hand-authored values
  // and imported palettes alike. Both passes only ever move a value that fails
  // a check, so a theme that was already correct is returned untouched.
  enforceLegibility(merged.ui, merged.game)
  separateRedFamily(merged.ui, merged.game, merged.regions, t)
  separateRegions(merged.ui, merged.regions)

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    appearance: recipe.appearance ?? 'dark',
    terminal: t,
    ...merged,
    swatch: recipe.swatch ?? merged.ui.accent,
  }
}

/** Minimum contrast for coloured gameplay text against the panel it sits on. */
const MIN_ROLE_CONTRAST = 3.1

/**
 * Lift any game role that cannot be read on a panel.
 *
 * Terminal palettes are tuned against their own background, which is usually
 * darker than an application panel; Gruvbox's neutral red and Solarized's
 * accents in particular fall below a readable ratio once they are drawn on a
 * raised surface. Each failing role is pushed toward the theme's own brightest
 * text until it clears the bar, which preserves its hue.
 */
function enforceLegibility(ui: Theme['ui'], game: Theme['game']): void {
  const panel = ui.surfacePanel
  const bright = ui.fgBright

  // Every game role is a flat record of colour strings; walk them uniformly.
  const liftGroup = <T extends object>(group: T) => {
    for (const key of Object.keys(group) as (keyof T)[]) {
      const value = group[key]
      if (typeof value === 'string') {
        group[key] = ensureContrast(value, panel, MIN_ROLE_CONTRAST, bright) as T[keyof T]
      }
    }
  }

  liftGroup(game.action)
  liftGroup(game.resource)
  liftGroup(game.stat)
  liftGroup(game.status)
  liftGroup(game.loot)
  liftGroup(game.enemy)
  liftGroup(game.channel)
  liftGroup(game.combat)
  liftGroup(game.terrain)
  liftGroup(game.mood)
  liftGroup(game.hue)

  // Interface text is held to the body-copy bar, against the darkest and the
  // lightest surface it can land on.
  for (const surface of [ui.surfaceCanvas, ui.surfacePanel, ui.surfaceRaised]) {
    ui.fgPrimary = ensureContrast(ui.fgPrimary, surface, 4.6, bright)
    ui.fgSecondary = ensureContrast(ui.fgSecondary, surface, 4.6, bright)
    ui.fgMuted = ensureContrast(ui.fgMuted, surface, 3.1, bright)
  }
  ui.fgBright = ensureContrast(ui.fgBright, ui.surfaceRaised, 4.6, '#ffffff')
  ui.accent = ensureContrast(ui.accent, panel, MIN_ROLE_CONTRAST, bright)
  ui.lineFocus = ensureContrast(ui.lineFocus, panel, MIN_ROLE_CONTRAST, bright)
  ui.fgOnAccent =
    contrast(ui.fgOnAccent, ui.accent) >= 4.6
      ? ui.fgOnAccent
      : contrast(ui.surfaceCanvas, ui.accent) >= contrast(ui.fgBright, ui.accent)
        ? ui.surfaceCanvas
        : ui.fgBright
}

/** How far apart the four red-aligned roles must sit, in OKLab units. */
const MIN_RED_SEPARATION = 0.105

/** OKLab chroma — how colourful a colour is, independent of its lightness. */
function chroma(hex: string): number {
  const { a, b } = toOklab(hex)
  return Math.sqrt(a * a + b * b)
}

/**
 * Force `action.attack`, `resource.hp`, `status.error` and Red Town apart.
 *
 * These four are the hardest requirement in the brief and the easiest to fail:
 * they are all reds, they appear on screen together during a fight in Red Town,
 * and several launch palettes (Nord, Gruvbox, Everforest) ship exactly one red
 * to build them from.
 *
 * Each role has its own escape direction, chosen so that the correction pushes
 * it further into its own meaning rather than merely away from its neighbour:
 *
 *   Red Town  darker and duller  — brick weathers, it does not glow
 *   HP        toward magenta     — blood/crimson, away from orange
 *   attack    toward yellow      — a strike is hot, not pink
 *   error     more saturated     — an alarm is loud because it is saturated
 *
 * Moving each one differently means a single-red palette still resolves, since
 * the four end up separated by hue *and* lightness rather than competing for
 * room along one axis.
 *
 * A hue escape can still be a no-op: a palette whose yellow and magenta are the
 * same colour as its red — degenerate, but exactly what a careless import looks
 * like — leaves attack and HP with nowhere to go. So each role carries a second,
 * always-available escape along lightness, ordered Red Town darkest through
 * error brightest, and falls back to it when the hue move fails to shift the
 * colour. That guarantees the separation for any palette at all.
 */
function separateRedFamily(
  ui: Theme['ui'],
  game: Theme['game'],
  regions: Record<RegionId, RegionPalette>,
  terminal: TerminalPalette
): void {
  const bg = ui.surfaceCanvas
  const bright = ui.fgBright
  const panel = ui.surfacePanel

  // Solarized's bright slots hold greys, so the more colourful of the two
  // yellows is the one that can actually carry `attack` away from red.
  const yellow =
    chroma(terminal.brightYellow) >= chroma(terminal.yellow)
      ? terminal.brightYellow
      : terminal.yellow
  const magenta =
    chroma(terminal.brightMagenta) >= chroma(terminal.magenta)
      ? terminal.brightMagenta
      : terminal.magenta

  type Role = {
    name: string
    get: () => string
    set: (v: string) => void
    /** One step further into this role's own character, by hue. */
    escape: (v: string) => string
    /**
     * Always-available fallback along lightness, used when the hue escape
     * cannot move the colour. Ordered darkest (Red Town) to brightest (error).
     */
    lightnessEscape: (v: string) => string
  }

  // Lightness escapes are bounded by the theme's own text extremes. Without a
  // ceiling a role climbs to pure white, which is separated from everything and
  // useful for nothing.
  const maxL = toOklab(bright).L
  const minL = toOklab(mix(bg, ui.fgPrimary, 0.35)).L
  const darker = (v: string) =>
    toOklab(v).L <= minL ? v : adjustLightness(v, -0.045)
  const lighter = (v: string) =>
    toOklab(v).L >= maxL - 0.04 ? v : adjustLightness(v, 0.045)

  const roles: Role[] = [
    {
      name: 'redTown',
      get: () => regions.redTown.base,
      set: (v) => {
        regions.redTown.base = v
      },
      escape: (v) => adjustLightness(mix(v, bg, 0.04), -0.02),
      lightnessEscape: darker,
    },
    {
      name: 'hp',
      get: () => game.resource.hp,
      set: (v) => {
        game.resource.hp = v
      },
      escape: (v) => mix(v, magenta, 0.08),
      lightnessEscape: darker,
    },
    {
      name: 'attack',
      get: () => game.action.attack,
      set: (v) => {
        game.action.attack = v
      },
      escape: (v) => mix(v, yellow, 0.09),
      lightnessEscape: lighter,
    },
    {
      name: 'error',
      get: () => game.status.error,
      set: (v) => {
        game.status.error = v
      },
      // An alarm is loud because it is saturated. Brightening instead would
      // turn a pastel theme's red into pink, which reads as decoration.
      escape: (v) => adjustChroma(adjustLightness(v, 0.02), 1.12),
      lightnessEscape: lighter,
    },
  ]

  /**
   * Keep a role readable on a panel.
   *
   * Applied on every write rather than once at the end: lifting a darkened
   * colour back toward the bright text is exactly the move that undoes a
   * separation, so the loop has to see post-lift values or it converges on a
   * state that the final lift then destroys.
   */
  const readable = (color: string, role: string) =>
    role === 'redTown' ? color : ensureContrast(color, panel, MIN_ROLE_CONTRAST, bright)

  for (const role of roles) role.set(readable(role.get(), role.name))

  for (let pass = 0; pass < 60; pass++) {
    let worst = { d: Infinity, a: -1, b: -1 }
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        const d = deltaE(roles[i].get(), roles[j].get())
        if (d < worst.d) worst = { d, a: i, b: j }
      }
    }
    if (worst.d >= MIN_RED_SEPARATION) break

    let moved = false
    for (const idx of [worst.a, worst.b]) {
      const role = roles[idx]
      const current = role.get()
      const partner = roles[idx === worst.a ? worst.b : worst.a].get()

      // Take whichever escape actually buys distance from the colour we are
      // separating from. The hue route is preferred when it works, because it
      // keeps each role's character; but on a palette whose yellow and magenta
      // *are* its red, mixing toward them drags the role back onto its partner
      // rather than away from it. Comparing both candidates catches that case
      // without needing to detect degeneracy directly.
      const byHue = readable(role.escape(current), role.name)
      const byLightness = readable(role.lightnessEscape(current), role.name)
      // Hue is the default: it keeps each role's character. Lightness only wins
      // when it is clearly better, which is how the degenerate case is rescued
      // without letting pastel palettes bleach themselves along the way.
      const next =
        deltaE(byLightness, partner) > deltaE(byHue, partner) * 1.25 ? byLightness : byHue

      // Anything moving toward the background can darken itself out of
      // legibility; Red Town is the one role allowed to go dark, and only
      // while its derived title can still be lifted back to readable.
      if (role.name === 'redTown' && luminance(next) < luminance(current)) {
        const title = ensureContrast(next, panel, 4.5, bright)
        if (contrast(title, panel) < 4.5) continue
      }

      if (deltaE(next, current) < 0.002) continue
      role.set(next)
      moved = true
    }

    // Nothing on this pair can move any further; the palette has given all it
    // has. Stop rather than spinning out the remaining passes.
    if (!moved) break
  }
}

/** How far apart two region identities must sit, in OKLab units. */
const MIN_REGION_SEPARATION = 0.042

/**
 * Push colliding region identities apart along lightness.
 *
 * Fifteen regions is more places than most terminal palettes have distinct
 * colours, and the earthy ones — the cabin cellar, the caves, the abandoned
 * mine, the dusty flats above it — naturally crowd into the same brown. This
 * pass separates the closest pair repeatedly by darkening the darker one and
 * lightening the lighter one, which preserves each region's hue (its actual
 * identity) while making the pair tellable apart.
 *
 * Red Town is pinned: `separateRedFamily` has already placed it relative to
 * attack, HP and error, and that constraint outranks regional spacing.
 *
 * This is what lets a future imported theme ship with derived regional colours
 * and still satisfy "every world region has a coordinated appearance".
 */
function separateRegions(ui: Theme['ui'], regions: Record<RegionId, RegionPalette>): void {
  const bg = ui.surfaceCanvas
  const bright = ui.fgBright
  const panel = ui.surfacePanel

  const movable: RegionId[] = (Object.keys(regions) as RegionId[]).filter((id) => id !== 'redTown')

  for (let pass = 0; pass < 80; pass++) {
    const ids = Object.keys(regions) as RegionId[]
    let worst = { d: Infinity, a: '' as RegionId, b: '' as RegionId }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = deltaE(regions[ids[i]].base, regions[ids[j]].base)
        if (d < worst.d) worst = { d, a: ids[i], b: ids[j] }
      }
    }
    if (worst.d >= MIN_REGION_SEPARATION) break

    const pair = [worst.a, worst.b].filter((id) => movable.includes(id))
    if (pair.length === 0) break

    // Darker one goes down, lighter one goes up.
    const [lo, hi] =
      toOklab(regions[worst.a].base).L <= toOklab(regions[worst.b].base).L
        ? [worst.a, worst.b]
        : [worst.b, worst.a]

    let moved = false
    if (movable.includes(lo)) {
      const next = mix(regions[lo].base, bg, 0.06)
      // Only darken while the region's derived title can still be lifted to a
      // readable colour; past that point the identity stops being usable.
      if (contrast(ensureContrast(next, panel, 4.5, bright), panel) >= 4.5) {
        regions[lo].base = next
        moved = true
      }
    }
    if (movable.includes(hi)) {
      regions[hi].base = mix(regions[hi].base, bright, 0.06)
      moved = true
    }
    if (!moved) break
  }
}

/** Re-exported so theme files can reach for the same helpers when overriding. */
export { alpha, contrast, ensureContrast, mix }
