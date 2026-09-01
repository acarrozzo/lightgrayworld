/**
 * Gruvbox Dark — https://github.com/morhetz/gruvbox
 *
 * Retro groove: warm, low-saturation, high-contrast. Gruvbox already reads as
 * earthy, so the regional derivation needs less correction here than anywhere
 * else — the world palette and the theme palette want the same things.
 */

import { makeTheme } from '../factory'

export const gruvboxDark = makeTheme({
  id: 'gruvbox-dark',
  name: 'Gruvbox Dark',
  description: 'Retro groove. Warm earth tones over charcoal.',
  // Gruvbox orange, the most Gruvbox colour there is.
  swatch: '#fe8019',

  terminal: {
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    selectionBackground: '#504945',
    selectionForeground: '#ebdbb2',

    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',

    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2',
  },

  overrides: {
    ui: {
      surfaceSunken: '#1d2021',
      surfacePanel: '#32302f',
      surfaceRaised: '#3c3836',
      surfaceOverlay: '#38342f',
      surfaceHover: '#504945',
      surfaceSelected: '#5a524c',
      lineSubtle: '#3c3836',
      lineStrong: '#665c54',
      fgSecondary: '#d5c4a1',
      fgMuted: '#a89984',
      fgDisabled: '#7c6f64',
      accent: '#83a598',
      accentHover: '#8ec07c',
      accentMuted: '#3f5049',
      lineFocus: '#83a598',
      fgOnAccent: '#1d2021',
    },
    game: {
      // Gruvbox orange (#d65d0e / #fe8019) is the natural attack colour and
      // keeps that role away from the palette's very saturated reds.
      action: { attack: '#fe8019', craft: '#d65d0e', talk: '#d79921' },
      resource: { hp: '#cc241d', mp: '#83a598', xp: '#b8bb26', gold: '#fabd2f' },
      status: { warning: '#fabd2f' },
      combat: { damage: '#fe8019', defeat: '#9d0006', heal: '#8ec07c' },
      terrain: { dirt: '#a1682d', sand: '#d5c4a1', stone: '#928374', ash: '#7c6f64', bone: '#ebdbb2' },
    },
    regions: {
      redTown: { base: '#c14a3a' },
      grassyField: { base: '#98971a' },
      forest: { base: '#79740e' },
      beach: { base: '#d5c4a1' },
      caves: { base: '#7c8377' },
      scorpionPit: { base: '#d79921' },
      rockyFlats: { base: '#a89984' },
      grassyFieldUnderground: { base: '#8a6a45' },
      solarOffice: { base: '#fabd2f' },
      lobby: { base: '#83a598' },
      roomZero: { base: '#d3869b' },
    },
  },
})
