/**
 * Catppuccin Mocha — https://catppuccin.com
 *
 * Mocha repeats its normal colours in the bright slots, so — as with Nord — the
 * terminal layer stays faithful and the game roles are re-pointed at the named
 * colours the palette actually ships (peach, maroon, mauve, sapphire, sky,
 * teal, lavender), which is where Mocha keeps its variety.
 */

import { makeTheme } from '../factory'

export const catppuccinMocha = makeTheme({
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  description: 'Soft pastels on warm plum. Gentle, and very hard to dislike.',
  // Mocha pink — keeps it out of the blue/purple pile.
  swatch: '#f5c2e7',

  terminal: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#585b70',
    selectionForeground: '#cdd6f4',

    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',

    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },

  overrides: {
    ui: {
      surfaceCanvas: '#1e1e2e',
      surfaceSunken: '#181825',
      surfacePanel: '#282839',
      surfaceRaised: '#313244',
      surfaceOverlay: '#2b2b3d',
      surfaceHover: '#45475a',
      surfaceSelected: '#585b70',
      surfaceDisabled: '#282839',
      fgBright: '#f5f5fa',
      fgPrimary: '#cdd6f4',
      fgSecondary: '#bac2de',
      fgMuted: '#9399b2',
      fgDisabled: '#6c7086',
      lineSubtle: '#313244',
      lineStrong: '#4d4f66',
      accent: '#89b4fa',
      accentHover: '#b4befe',
      accentMuted: '#3a4a69',
      lineFocus: '#b4befe',
      fgOnAccent: '#1e1e2e',
    },
    game: {
      action: { attack: '#fab387', search: '#94e2d5', rest: '#89b4fa', talk: '#f9e2af', craft: '#eba0ac', gather: '#a6e3a1', use: '#cba6f7' },
      resource: { hp: '#f38ba8', mp: '#89b4fa', xp: '#a6e3a1', gold: '#f9e2af' },
      stat: { str: '#fab387', dex: '#a6e3a1', mag: '#cba6f7', def: '#89b4fa' },
      status: { success: '#a6e3a1', error: '#f38ba8', warning: '#fab387', info: '#89dceb' },
      loot: { common: '#9399b2', uncommon: '#a6e3a1', rare: '#89b4fa', epic: '#cba6f7', legendary: '#f9e2af' },
      enemy: { hostile: '#eba0ac', neutral: '#f9e2af', boss: '#cba6f7' },
      channel: { room: '#a6e3a1', world: '#89b4fa', action: '#f9e2af', dm: '#f5c2e7', system: '#9399b2', quest: '#fab387' },
      combat: { victory: '#a6e3a1', defeat: '#a4506a', damage: '#fab387', heal: '#94e2d5', miss: '#7f849c', crit: '#f9e2af' },
      terrain: { grass: '#a6e3a1', forest: '#6a9e73', dirt: '#b08968', sand: '#f2dfc4', stone: '#9399b2', water: '#89dceb', ash: '#6c7086', bone: '#e8e0cc' },
      hue: { gray: '#9399b2', red: '#f38ba8', gold: '#f9e2af', green: '#a6e3a1', sky: '#89dceb', blue: '#89b4fa', violet: '#cba6f7', purple: '#b4a1f0', pink: '#f5c2e7' },
    },
    regions: {
      redTown: { base: '#d9788f' },
      grassyField: { base: '#a6e3a1' },
      forest: { base: '#7bb583' },
      beach: { base: '#f2dfc4' },
      caves: { base: '#7a80a3' },
      scorpionPit: { base: '#f9c98f' },
      rockyFlats: { base: '#b0a68d' },
      grassyFieldUnderground: { base: '#96775c' },
      solarOffice: { base: '#f9e2af' },
      lobby: { base: '#89dceb' },
      roomZero: { base: '#cba6f7' },
    },
  },
})
