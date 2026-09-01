/**
 * Light Gray Dark — the house palette on a true-neutral, darker ground.
 *
 * Same ANSI colours, same game roles, same world regions as Light Gray RPG;
 * only the ground changes. Two differences from the original, both deliberate:
 *
 *  - **No blue cast.** Tailwind's greys lean cool; these are neutral, so the
 *    frame recedes and the world's own colours carry the screen.
 *  - **Genuinely darker.** The canvas sits near black, roughly half the
 *    original's lightness, with the panel lifted further above it — so the
 *    elevation ladder is wider than the original's rather than merely shifted,
 *    and cards read as sitting on the page rather than tinted into it.
 */

import { makeTheme } from '../factory'
import { LIGHT_GRAY_ANSI, LIGHT_GRAY_GAME, LIGHT_GRAY_REGIONS } from './light-gray-shared'

export const lightGrayDark = makeTheme({
  id: 'light-gray-dark',
  name: 'Light Gray Dark',
  description: 'The house palette, neutral and near black. Quiet frame, loud world.',
  // Neutral and much darker, which is the whole difference from its sibling.
  swatch: '#2e2e2e',

  terminal: {
    ...LIGHT_GRAY_ANSI,
    background: '#030303',
    selectionBackground: '#2f3a3f',
  },

  overrides: {
    ui: {
      surfaceCanvas: '#030303',
      surfaceSunken: '#000000',
      surfacePanel: '#141414',
      surfaceRaised: '#232323',
      surfaceOverlay: '#1b1b1b',
      surfaceHover: '#3b3b3b',
      surfaceSelected: '#4f4f4f',
      surfaceDisabled: '#141414',

      fgBright: '#f5f5f5',
      fgPrimary: '#d4d4d4',
      fgSecondary: '#a3a3a3',
      fgMuted: '#7a7a7a',
      fgDisabled: '#525252',

      lineSubtle: '#292929',
      lineStrong: '#454545',

      accent: '#7b96b0',
      accentHover: '#9ab3c9',
      accentMuted: '#2b3640',
      lineFocus: '#9ab3c9',
      fgOnAccent: '#030303',
    },

    game: LIGHT_GRAY_GAME,
    regions: LIGHT_GRAY_REGIONS,
  },
})
