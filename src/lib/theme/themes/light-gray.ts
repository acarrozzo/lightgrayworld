/**
 * Light Gray RPG — the default and canonical theme.
 *
 * The game's original look. Its surfaces are the exact greys the application
 * used before it was themed: Tailwind's `gray` ramp, which is not neutral but
 * carries a distinct blue cast (`gray-950` is #030712 — six times as much blue
 * as red). That cast is the theme's character rather than an accident, and
 * restoring it verbatim is what makes this theme *the original* instead of an
 * approximation of it.
 *
 * An earlier pass replaced these with hand-picked neutrals, which removed the
 * blue and — less deliberately — compressed the elevation ladder to under half
 * its range, so panels stopped separating from the page and hover states went
 * flat. The values below are lifted straight from the pre-theming source.
 *
 * For the same palette on a true-neutral, darker ground, see Light Gray Dark.
 */

import { makeTheme } from '../factory'
import { LIGHT_GRAY_ANSI, LIGHT_GRAY_GAME, LIGHT_GRAY_REGIONS } from './light-gray-shared'

export const lightGray = makeTheme({
  id: 'light-gray',
  name: 'Light Gray RPG',
  description: 'The house palette. Cool slate greys, earthy world, bright steel.',
  // Cool slate grey — the blue cast that defines this variant.
  swatch: '#6b7280',

  terminal: {
    ...LIGHT_GRAY_ANSI,
    background: '#030712',
    selectionBackground: '#2f3a3f',
  },

  overrides: {
    ui: {
      // Tailwind's gray ramp, exactly as the game used it:
      //   gray-950 canvas · gray-900 panel · gray-800 raised
      //   gray-700 hover/subtle line · gray-600 selected/strong line
      surfaceCanvas: '#030712',
      surfaceSunken: '#01040a',
      surfacePanel: '#111827',
      surfaceRaised: '#1f2937',
      surfaceOverlay: '#161f31',
      surfaceHover: '#374151',
      surfaceSelected: '#4b5563',
      surfaceDisabled: '#111827',

      fgBright: '#ffffff',
      fgPrimary: '#d1d5db',
      fgSecondary: '#9ca3af',
      fgMuted: '#6b7280',
      fgDisabled: '#4b5563',

      lineSubtle: '#374151',
      lineStrong: '#4b5563',

      // Steel blue, deliberately cooler and quieter than the gold used for
      // rewards, so interface chrome never reads as a prize.
      accent: '#7b96b0',
      accentHover: '#9ab3c9',
      accentMuted: '#2c3a49',
      lineFocus: '#9ab3c9',
      fgOnAccent: '#030712',
    },

    game: LIGHT_GRAY_GAME,
    regions: LIGHT_GRAY_REGIONS,
  },
})
