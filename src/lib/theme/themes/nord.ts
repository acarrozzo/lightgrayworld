/**
 * Nord — https://www.nordtheme.com
 *
 * Nord's published ANSI table repeats its normal colours in the bright slots,
 * so the roles that read from brights (`stat.*`, `status.error`, `resource.xp`)
 * would otherwise land on the exact values used by `enemy.*` and `status.*`.
 * The terminal layer stays faithful — it is the exportable one — and the game
 * roles are lifted onto Nord's own extended aurora/frost palette instead.
 */

import { makeTheme } from '../factory'

export const nord = makeTheme({
  id: 'nord',
  name: 'Nord',
  description: 'Arctic, north-bluish. Cool frost over a slate night.',
  // Frost cyan.
  swatch: '#88c0d0',

  terminal: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    selectionBackground: '#434c5e',
    selectionForeground: '#eceff4',

    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',

    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },

  overrides: {
    ui: {
      surfaceSunken: '#272c36',
      surfacePanel: '#353c4a',
      surfaceRaised: '#3b4252',
      surfaceOverlay: '#39404e',
      surfaceHover: '#434c5e',
      surfaceSelected: '#4c566a',
      lineSubtle: '#3f4859',
      lineStrong: '#535d70',
      fgSecondary: '#c3ccda',
      fgMuted: '#94a1b5',
      fgDisabled: '#6b7689',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      accentMuted: '#3f5561',
      lineFocus: '#88c0d0',
      fgOnAccent: '#2e3440',
    },
    game: {
      // nord12 (#d08770) is Nord's orange; the palette has no ANSI slot for it,
      // but it is the right colour for attack and keeps that role clear of both
      // aurora red (hp/error) and Red Town's brick.
      action: { attack: '#d08770', craft: '#d08770', rest: '#81a1c1', search: '#88c0d0' },
      resource: { hp: '#bf616a', mp: '#81a1c1', xp: '#a3be8c', gold: '#ebcb8b' },
      stat: { str: '#d08770', dex: '#a3be8c', mag: '#b48ead', def: '#81a1c1' },
      status: { success: '#a3be8c', error: '#bf616a', warning: '#ebcb8b', info: '#88c0d0' },
      loot: { common: '#94a1b5', uncommon: '#a3be8c', rare: '#81a1c1', epic: '#b48ead', legendary: '#ebcb8b' },
      combat: { victory: '#a3be8c', defeat: '#8a4a52', damage: '#d08770', heal: '#8fbcbb', crit: '#ebcb8b' },
      terrain: { dirt: '#a17e63', wood: '#8f6a4e', sand: '#e0d3ae', stone: '#8b94a5', ash: '#6b7689', bone: '#dfd8bd' },
      hue: { gray: '#94a1b5', red: '#bf616a', gold: '#ebcb8b', green: '#a3be8c', sky: '#88c0d0', blue: '#81a1c1', violet: '#b48ead', purple: '#a48bbd', pink: '#c98a9c' },
    },
    regions: {
      redTown: { base: '#b06a63' },
      grassyField: { base: '#a3be8c' },
      forest: { base: '#7a9668' },
      beach: { base: '#e0d3ae' },
      caves: { base: '#6c7a92' },
      scorpionPit: { base: '#d0a071' },
      rockyFlats: { base: '#a89a7d' },
      grassyFieldUnderground: { base: '#8a7561' },
      solarOffice: { base: '#ebcb8b' },
      lobby: { base: '#a3b8d0' },
    },
  },
})
