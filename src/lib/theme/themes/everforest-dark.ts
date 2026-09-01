/**
 * Everforest Dark (medium) — https://github.com/sainnhe/everforest
 *
 * A green-based forest scheme, which makes it the one theme where the world's
 * own greens have to work harder to stay apart from the interface. The Forest
 * and Grassy Field regions are pushed to different values by hand here rather
 * than left to derivation, so they do not collapse into the theme background.
 */

import { makeTheme } from '../factory'

export const everforestDark = makeTheme({
  id: 'everforest-dark',
  name: 'Everforest Dark',
  description: 'Soft green and warm stone. Comfortable, mossy, low contrast.',

  terminal: {
    background: '#2d353b',
    foreground: '#d3c6aa',
    cursor: '#d3c6aa',
    selectionBackground: '#475258',
    selectionForeground: '#d3c6aa',

    black: '#343f44',
    red: '#e67e80',
    green: '#a7c080',
    yellow: '#dbbc7f',
    blue: '#7fbbb3',
    magenta: '#d699b6',
    cyan: '#83c092',
    white: '#d3c6aa',

    brightBlack: '#868d80',
    brightRed: '#e67e80',
    brightGreen: '#a7c080',
    brightYellow: '#dbbc7f',
    brightBlue: '#7fbbb3',
    brightMagenta: '#d699b6',
    brightCyan: '#83c092',
    brightWhite: '#e8e0cc',
  },

  overrides: {
    ui: {
      surfaceSunken: '#232a2e',
      surfacePanel: '#343f44',
      surfaceRaised: '#3d484d',
      surfaceOverlay: '#39444a',
      surfaceHover: '#475258',
      surfaceSelected: '#4f585e',
      surfaceDisabled: '#343f44',
      fgBright: '#e8e0cc',
      fgSecondary: '#c0b399',
      fgMuted: '#9da9a0',
      fgDisabled: '#7a8478',
      lineSubtle: '#3d484d',
      lineStrong: '#56635f',
      accent: '#7fbbb3',
      accentHover: '#a7c080',
      accentMuted: '#3c5852',
      lineFocus: '#7fbbb3',
      fgOnAccent: '#2d353b',
    },
    game: {
      // Everforest's orange (#e69875) carries attack; leaving it on a mix of
      // the theme's soft red and yellow produced something too close to hp.
      action: { attack: '#e69875', craft: '#e69875', search: '#83c092', rest: '#7fbbb3', travel: '#a7c080' },
      resource: { hp: '#e67e80', mp: '#7fbbb3', xp: '#a7c080', gold: '#dbbc7f' },
      stat: { str: '#e69875', dex: '#a7c080', mag: '#d699b6', def: '#7fbbb3' },
      status: { success: '#a7c080', error: '#e67e80', warning: '#dbbc7f', info: '#7fbbb3' },
      loot: { common: '#9da9a0', uncommon: '#a7c080', rare: '#7fbbb3', epic: '#d699b6', legendary: '#dbbc7f' },
      enemy: { hostile: '#e67e80', neutral: '#dbbc7f', boss: '#d699b6' },
      channel: { room: '#a7c080', world: '#7fbbb3', action: '#dbbc7f', dm: '#d699b6', system: '#9da9a0', quest: '#e69875' },
      combat: { victory: '#a7c080', defeat: '#9e4f51', damage: '#e69875', heal: '#83c092', miss: '#868d80', crit: '#dbbc7f' },
      terrain: { grass: '#a7c080', forest: '#6d8a5c', dirt: '#a8845c', sand: '#dfd2ab', stone: '#9da9a0', water: '#7fbbb3', ash: '#7a8478', bone: '#ddd3b4' },
      hue: { gray: '#9da9a0', red: '#e67e80', gold: '#dbbc7f', green: '#a7c080', sky: '#83c092', blue: '#7fbbb3', violet: '#d699b6', purple: '#bf9ac4', pink: '#e0a0b4' },
    },
    regions: {
      // Grassy Field bright and open, Forest deeper and cooler: on a green
      // theme these two need real separation or the world flattens out.
      grassyField: { base: '#b5cf88' },
      forest: { base: '#6d8a5c' },
      forestUnderground: { base: '#4f6b57' },
      redTown: { base: '#c96f71' },
      beach: { base: '#dfd2ab' },
      caves: { base: '#728086' },
      scorpionPit: { base: '#dbbc7f' },
      rockyFlats: { base: '#a89a7c' },
      grassyFieldUnderground: { base: '#8f7355' },
      solarOffice: { base: '#e5c67f' },
      lobby: { base: '#8fb5c4' },
      roomZero: { base: '#c49ac4' },
    },
  },
})
