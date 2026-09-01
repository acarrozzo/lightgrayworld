/**
 * Solarized Dark — https://ethanschoonover.com/solarized
 *
 * Solarized is the awkward import. Its published bright slots hold the base
 * greys (base01/base00/base0/base1) rather than brighter chromatic colours, so
 * the derivation would resolve `resource.xp`, `stat.dex` and half the combat
 * roles to shades of grey. The terminal layer keeps the real table — that is
 * what makes it Solarized in a shell — and every role that reads from a bright
 * slot is re-pointed at Solarized's actual accent colours instead.
 *
 * The interface also promotes base1 (#93a1a1) to primary text: base0, the
 * documented foreground, sits at roughly 5.5:1 on base03 and is fine for body
 * copy but leaves nothing above it for headings.
 */

import { makeTheme } from '../factory'

export const solarizedDark = makeTheme({
  id: 'solarized-dark',
  name: 'Solarized Dark',
  description: 'Precision colour on deep cyan-black. Low glare, high care.',

  terminal: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    selectionBackground: '#073642',
    selectionForeground: '#93a1a1',

    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',

    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },

  overrides: {
    ui: {
      surfaceSunken: '#00212b',
      surfacePanel: '#073642',
      surfaceRaised: '#0d4451',
      surfaceOverlay: '#0a3d49',
      surfaceHover: '#14505e',
      surfaceSelected: '#1a5b6a',
      surfaceDisabled: '#073642',
      fgBright: '#fdf6e3',
      fgPrimary: '#93a1a1',
      fgSecondary: '#839496',
      fgMuted: '#657b83',
      fgDisabled: '#586e75',
      lineSubtle: '#0e4553',
      lineStrong: '#20606f',
      accent: '#3d9ae0',
      accentHover: '#4ba7e8',
      accentMuted: '#0f4a6b',
      lineFocus: '#3d9ae0',
      fgOnAccent: '#002b36',
    },
    game: {
      action: { attack: '#cb4b16', search: '#2aa198', rest: '#268bd2', look: '#839496', talk: '#b58900', travel: '#859900', craft: '#cb4b16', gather: '#9aa300', use: '#6c71c4' },
      resource: { hp: '#dc322f', mp: '#268bd2', xp: '#859900', gold: '#b58900' },
      stat: { str: '#cb4b16', dex: '#859900', mag: '#6c71c4', def: '#268bd2' },
      status: { success: '#859900', error: '#dc322f', warning: '#b58900', info: '#2aa198' },
      loot: { common: '#839496', uncommon: '#859900', rare: '#268bd2', epic: '#6c71c4', legendary: '#b58900' },
      enemy: { hostile: '#dc322f', neutral: '#b58900', boss: '#d33682' },
      channel: { room: '#859900', world: '#268bd2', action: '#b58900', dm: '#d33682', system: '#657b83', quest: '#cb4b16' },
      combat: { victory: '#859900', defeat: '#a02622', damage: '#cb4b16', heal: '#2aa198', miss: '#657b83', crit: '#b58900' },
      terrain: { grass: '#859900', forest: '#5f6f16', dirt: '#8a6a2a', sand: '#c9bb92', stone: '#657b83', water: '#2aa198', ash: '#4a5f66', bone: '#c4bda3' },
      hue: { gray: '#839496', red: '#dc322f', gold: '#b58900', green: '#859900', sky: '#2aa198', blue: '#268bd2', violet: '#6c71c4', purple: '#9b4fb8', pink: '#d33682' },
    },
    regions: {
      redTown: { base: '#b5433c' },
      grassyField: { base: '#859900' },
      forest: { base: '#5f7a12' },
      beach: { base: '#c9bb92' },
      caves: { base: '#4a6b75' },
      scorpionPit: { base: '#b58900' },
      rockyFlats: { base: '#96906d' },
      grassyFieldUnderground: { base: '#7d6432' },
      solarOffice: { base: '#d5b117' },
      lobby: { base: '#4b9cc9' },
      roomZero: { base: '#6c71c4' },
    },
  },
})
