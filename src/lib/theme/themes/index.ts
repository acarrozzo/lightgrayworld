import type { Theme } from '../types'
import { lightGray } from './light-gray'
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
 * Light Gray RPG is first and is the default for every account that has not
 * chosen otherwise. The rest run warm-and-muted to cool-and-vivid — Gruvbox,
 * Nord and Everforest are the restrained earthy end nearest the house palette;
 * Dracula, Solarized, Tokyo Night and Catppuccin are the more saturated ones.
 */
export const THEMES: Theme[] = [
  lightGray,
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

export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && value in THEMES_BY_ID
}

/** The requested theme, or Light Gray RPG when the id is unknown or missing. */
export function resolveTheme(id: string | null | undefined): Theme {
  return (id && THEMES_BY_ID[id]) || THEMES_BY_ID[DEFAULT_THEME_ID]
}

export { lightGray, dracula, nord, gruvboxDark, solarizedDark, tokyoNight, catppuccinMocha, everforestDark }
