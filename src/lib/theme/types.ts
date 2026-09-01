/**
 * Terminal theme type definitions.
 *
 * A theme is three layers, deliberately kept separate:
 *
 *  1. `terminal` — the 16-colour ANSI palette plus background/foreground/cursor
 *     /selection. This is the portable layer: it is what a real terminal
 *     emulator understands, and what a future iTerm2/kitty/Alacritty/WezTerm
 *     exporter would read. Nothing in the application paints large surfaces
 *     straight from here; ANSI colours are chosen for contrast against a
 *     terminal background, not for use as panel fills.
 *
 *  2. `ui` — interface structure. Surfaces, text ranks, borders, focus.
 *     Usually derived from the terminal layer and then hand-corrected.
 *
 *  3. `game` — semantic meaning. `attack` is a distinct role from `hp`, which
 *     is distinct from `error`, which is distinct from Red Town, even when a
 *     given theme happens to resolve several of them to similar values. Keeping
 *     the roles separate is the point: a later theme can pull them apart
 *     without any component changing.
 *
 * Components reference roles, never raw colour names.
 */

/** Every colour value is a CSS colour string; authored themes use `#rrggbb`. */
export type Color = string

/**
 * The portable terminal layer: background/foreground/cursor/selection plus the
 * standard 8 + 8 bright ANSI colours, in the conventional order.
 */
export interface TerminalPalette {
  background: Color
  foreground: Color
  cursor: Color
  selectionBackground: Color
  selectionForeground: Color

  black: Color
  red: Color
  green: Color
  yellow: Color
  blue: Color
  magenta: Color
  cyan: Color
  white: Color

  brightBlack: Color
  brightRed: Color
  brightGreen: Color
  brightYellow: Color
  brightBlue: Color
  brightMagenta: Color
  brightCyan: Color
  brightWhite: Color
}

/**
 * Interface structure roles.
 *
 * Surfaces are ordered by elevation: `canvas` is the page behind everything,
 * `sunken` is a well cut into a panel (feed bodies, inputs), `panel` is the
 * standard card, `raised` is a control or a card on a card, `overlay` is a
 * modal. `hover`/`selected`/`disabled` are interaction states applied on top.
 */
export interface InterfaceRoles {
  surfaceCanvas: Color
  surfaceSunken: Color
  surfacePanel: Color
  surfaceRaised: Color
  surfaceOverlay: Color
  surfaceHover: Color
  surfaceSelected: Color
  surfaceDisabled: Color

  /** Full-viewport dim behind a modal. Authored with alpha. */
  scrim: Color
  /** Shadow colour for raised elements. Authored with alpha. */
  shadow: Color

  fgBright: Color
  fgPrimary: Color
  fgSecondary: Color
  fgMuted: Color
  fgDisabled: Color
  /** Text drawn on top of a filled `accent` surface. */
  fgOnAccent: Color

  lineSubtle: Color
  lineStrong: Color
  lineFocus: Color

  /** The interface's own emphasis colour: primary buttons, links, active rings. */
  accent: Color
  accentHover: Color
  accentMuted: Color
}

/**
 * Decorative hues.
 *
 * An escape hatch for colour that distinguishes without carrying gameplay
 * meaning — tab identity, chart-ish groupings, avatar defaults. Every theme
 * maps the nine names onto its own palette, so a component can ask for "the
 * violet one" and still land inside the selected theme. Do NOT use these where
 * a semantic role exists: an attack button is `action.attack`, not `hue.red`.
 */
export interface AccentHues {
  gray: Color
  red: Color
  gold: Color
  green: Color
  sky: Color
  blue: Color
  violet: Color
  purple: Color
  pink: Color
}

/** Player-initiated verbs. Each keeps its own role so themes can separate them. */
export interface ActionRoles {
  attack: Color
  search: Color
  rest: Color
  look: Color
  talk: Color
  travel: Color
  craft: Color
  gather: Color
  use: Color
}

/** Vitals and currencies. `hp` is deliberately distinct from `status.error`. */
export interface ResourceRoles {
  hp: Color
  mp: Color
  xp: Color
  gold: Color
}

/** The four core stats. */
export interface StatRoles {
  str: Color
  dex: Color
  mag: Color
  def: Color
}

/** Message and outcome severity. */
export interface StatusRoles {
  success: Color
  error: Color
  warning: Color
  info: Color
}

/** Item rarity ladder, common through legendary. */
export interface LootRoles {
  common: Color
  uncommon: Color
  rare: Color
  epic: Color
  legendary: Color
}

/** How an NPC or creature reads at a glance. */
export interface EnemyRoles {
  hostile: Color
  neutral: Color
  boss: Color
}

/** Feed and chat channels. */
export interface ChannelRoles {
  room: Color
  world: Color
  action: Color
  dm: Color
  system: Color
  quest: Color
}

/** Battle outcomes and numbers. `damage` is distinct from both `hp` and `error`. */
export interface CombatRoles {
  victory: Color
  defeat: Color
  damage: Color
  heal: Color
  miss: Color
  crit: Color
}

/**
 * Ground and material colours, used by per-room overrides.
 *
 * These are the semantic descendants of the original data's `grass`, `dirt`,
 * `sand` and `forest` tokens — the world data was already reaching for this
 * vocabulary before there was a theme system to hold it.
 */
export interface TerrainRoles {
  grass: Color
  forest: Color
  dirt: Color
  /** Cut and worked timber — signs, cabins, doors, chests. Warmer than dirt. */
  wood: Color
  sand: Color
  stone: Color
  water: Color
  ash: Color
  bone: Color
}

/**
 * Room atmosphere.
 *
 * The original world data already reached for this vocabulary — a bloody kobold
 * path, an ogress's fire altar, a wizard's guild, a treasure room — by spending
 * raw reds, purples and golds on room titles. These are the roles those colours
 * were standing in for.
 *
 * Deliberately separate from the roles they resemble: a dangerous *room* is not
 * the same thing as a hostile *enemy*, and colouring one with the other's token
 * would weld two unrelated meanings together the first time a theme wanted to
 * pull them apart.
 */
export interface MoodRoles {
  danger: Color
  arcane: Color
  sacred: Color
  treasure: Color
  calm: Color
  decay: Color
}

export interface GameRoles {
  action: ActionRoles
  resource: ResourceRoles
  stat: StatRoles
  status: StatusRoles
  loot: LootRoles
  enemy: EnemyRoles
  channel: ChannelRoles
  combat: CombatRoles
  terrain: TerrainRoles
  mood: MoodRoles
  hue: AccentHues
}

/**
 * One region's identity within one theme.
 *
 * Only `base` is required. The other slots are derived from `base` against the
 * theme's own surfaces and text (see `deriveRegionPalette`), so importing a new
 * terminal theme costs one colour per region rather than seven. Launch themes
 * then override individual slots where the derivation is not good enough.
 *
 * `tint` is the atmospheric panel wash and is expected to carry alpha.
 */
export interface RegionPalette {
  base: Color
  title?: Color
  subtitle?: Color
  icon?: Color
  direction?: Color
  accent?: Color
  tint?: Color
}

/** A region palette after derivation: every slot resolved. */
export type ResolvedRegionPalette = Required<RegionPalette>

export type RegionId =
  | 'roomZero'
  | 'grassyField'
  | 'grassyFieldUnderground'
  | 'beach'
  | 'caves'
  | 'scorpionPit'
  | 'forest'
  | 'forestUnderground'
  | 'redTown'
  | 'redTownSewers'
  | 'rockyFlats'
  | 'rockyFlatsUnderground'
  | 'neverendingMine'
  | 'solarOffice'
  | 'lobby'

export interface Theme {
  /** Stable identifier. Persisted on the user row and in local storage. */
  id: string
  /** Display name, shown in the selector. */
  name: string
  /** Short line shown under the name in the selector. */
  description: string
  /**
   * v1 ships dark themes only. The field exists so a light theme can be added
   * without a structural change — consumers that need to know (contrast
   * checks, derivation direction) read this rather than guessing from the
   * background's luminance.
   */
  appearance: 'dark' | 'light'
  /**
   * The single colour that stands for this theme in a picker.
   *
   * Authored rather than derived: the obvious candidate, `ui.accent`, resolves
   * to a blue or teal in six of the nine launch themes and is byte-identical
   * between the two Light Grays, which share a palette and differ only in
   * ground. A swatch has one job — tell nine themes apart at 16px — so it is
   * chosen for separation, not computed from something that was chosen for
   * another purpose.
   */
  swatch: Color
  /**
   * Whether the factory forced `action.attack`, `resource.hp`, `status.error`
   * and Red Town apart. True for every theme but Light Gray RPG Classic, whose
   * identity is that one red did all of those jobs; the validator reads this
   * to know which themes owe the separation guarantee.
   */
  separateReds: boolean
  /**
   * How a role is painted behind a label.
   *
   * `deepened` (the default) lowers the fill until the theme's bright text
   * reads on it at body-copy contrast — a gold button becomes bronze. `flat`
   * paints the role's own colour and relies on a dark text shadow under a
   * bright label, which is how the original game drew every button. Classic
   * uses `flat`, because bronze buttons are not the original's buttons.
   */
  fills: 'deepened' | 'flat'
  terminal: TerminalPalette
  ui: InterfaceRoles
  game: GameRoles
  regions: Record<RegionId, RegionPalette>
}
