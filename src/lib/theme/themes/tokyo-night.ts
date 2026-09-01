/**
 * Tokyo Night — https://github.com/enkia/tokyo-night-vscode-theme
 *
 * Neon over deep navy. Its bright slots are real and varied, and it carries a
 * true orange (#ff9e64) in the bright-yellow position, which lands `attack`
 * somewhere genuinely distinct from its pink-red without any help.
 */

import { makeTheme } from '../factory'

export const tokyoNight = makeTheme({
  id: 'tokyo-night',
  name: 'Tokyo Night',
  description: 'Neon signage over deep navy. Cool, electric, late.',

  terminal: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selectionBackground: '#33467c',
    selectionForeground: '#c0caf5',

    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',

    brightBlack: '#414868',
    brightRed: '#ff7a93',
    brightGreen: '#b9f27c',
    brightYellow: '#ff9e64',
    brightBlue: '#7da6ff',
    brightMagenta: '#bb9af7',
    brightCyan: '#0db9d7',
    brightWhite: '#c0caf5',
  },

  overrides: {
    ui: {
      surfaceSunken: '#16161e',
      surfacePanel: '#1f2335',
      surfaceRaised: '#24283b',
      surfaceOverlay: '#222436',
      surfaceHover: '#2f334d',
      surfaceSelected: '#33467c',
      lineSubtle: '#292e42',
      lineStrong: '#414868',
      fgBright: '#d5dcff',
      fgSecondary: '#a9b1d6',
      fgMuted: '#787c99',
      fgDisabled: '#565f89',
      accent: '#7aa2f7',
      accentHover: '#89b4ff',
      accentMuted: '#2c3d63',
      lineFocus: '#7aa2f7',
      fgOnAccent: '#1a1b26',
    },
    game: {
      action: { attack: '#ff9e64', craft: '#ff9e64', search: '#7dcfff' },
      resource: { hp: '#f7768e', mp: '#7aa2f7', xp: '#9ece6a', gold: '#e0af68' },
      stat: { str: '#ff9e64', dex: '#9ece6a', mag: '#bb9af7', def: '#7aa2f7' },
      status: { warning: '#e0af68', info: '#7dcfff' },
      combat: { defeat: '#8c3a52', damage: '#ff9e64', heal: '#73daca', crit: '#e0af68' },
      terrain: { dirt: '#a1743f', sand: '#dcc79a', stone: '#787c99', ash: '#565f89', bone: '#d6cfae' },
    },
    regions: {
      redTown: { base: '#d16a7e' },
      grassyField: { base: '#9ece6a' },
      forest: { base: '#73a355' },
      beach: { base: '#dcc79a' },
      caves: { base: '#6b7396' },
      scorpionPit: { base: '#e0af68' },
      rockyFlats: { base: '#9d9478' },
      grassyFieldUnderground: { base: '#84674a' },
      solarOffice: { base: '#ffc777' },
      lobby: { base: '#7dcfff' },
      roomZero: { base: '#bb9af7' },
    },
  },
})
