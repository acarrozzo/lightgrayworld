import type { Theme } from '../types'
import { lightGray } from './light-gray'
import { lightGrayModern } from './light-gray-modern'
import { lightGrayDark } from './light-gray-dark'
import { dracula } from './dracula'
import { nord } from './nord'
import { gruvboxDark } from './gruvbox-dark'
import { solarizedDark } from './solarized-dark'
import { tokyoNight } from './tokyo-night'
import { catppuccinMocha } from './catppuccin-mocha'
import { everforestDark } from './everforest-dark'

/**
 * Launch themes, in the order they are offered everywhere.
 *
 * This array is the single ordering authority: the login dots, the Settings
 * list, the Color Lab, the World Tool matrix columns and the generated
 * stylesheet all map over it, so changing the order here changes it everywhere
 * at once.
 *
 * The three Light Grays come first. Classic is the default for every account
 * that has not chosen otherwise — the id `light-gray` points at the original
 * game's own colours, so a player who never touched the picker sees the game
 * as it was. Modern is the Tailwind-era look of the rewrite; Dark is the house
 * palette on a neutral near-black ground. The rest run warm-and-muted to
 * cool-and-vivid — Gruvbox, Nord and Everforest are the restrained earthy end;
 * Dracula, Solarized, Tokyo Night and Catppuccin are the more saturated ones.
 */
export const THEMES: Theme[] = [
  lightGray,
  lightGrayModern,
  lightGrayDark,
  gruvboxDark,
  nord,
  everforestDark,
  dracula,
  solarizedDark,
  tokyoNight,
  catppuccinMocha,
]

export const DEFAULT_THEME_ID = lightGray.id

export const THEMES_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
)

export const THEME_IDS: string[] = THEMES.map((t) => t.id)

/**
 * Whether `value` names a registered theme.
 *
 * Own keys only: `THEMES_BY_ID` is a plain object, so a bare `in` check would
 * also accept `'constructor'` and `'toString'`, and the API route would store
 * them on the account.
 */
export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEMES_BY_ID, value)
}

/** The requested theme, or Light Gray RPG when the id is unknown or missing. */
export function resolveTheme(id: string | null | undefined): Theme {
  return isThemeId(id) ? THEMES_BY_ID[id] : THEMES_BY_ID[DEFAULT_THEME_ID]
}

export { lightGray, lightGrayModern, lightGrayDark, dracula, nord, gruvboxDark, solarizedDark, tokyoNight, catppuccinMocha, everforestDark }
