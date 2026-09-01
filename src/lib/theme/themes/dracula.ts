/**
 * Dracula — https://draculatheme.com
 *
 * Dracula's ANSI "blue" slot holds its signature purple (#bd93f9), so the
 * interface accent lands on purple by simply following the usual rule. Its
 * bright set is genuinely brighter than its normals, so the derived roles need
 * very little correction.
 */

import { makeTheme } from '../factory'

export const dracula = makeTheme({
  id: 'dracula',
  name: 'Dracula',
  description: 'Purple and pink on deep indigo. The classic.',
  // Dracula purple.
  swatch: '#bd93f9',

  terminal: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    selectionForeground: '#f8f8f2',

    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',

    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },

  overrides: {
    ui: {
      surfaceSunken: '#21222c',
      surfacePanel: '#2f313d',
      surfaceRaised: '#383a48',
      surfaceOverlay: '#343643',
      surfaceHover: '#414356',
      surfaceSelected: '#44475a',
      lineSubtle: '#3d4051',
      lineStrong: '#565a70',
      fgSecondary: '#c9cbd6',
      fgMuted: '#8f93a8',
      fgDisabled: '#6272a4',
      accentMuted: '#4a4066',
      fgOnAccent: '#21222c',
    },
    game: {
      // Dracula's yellow is a pale wash; orange is what its own docs use for
      // "attack"-flavoured emphasis, so attack and craft are pulled warmer than
      // the default mix of red into that pale yellow would give.
      action: { attack: '#ffb86c', craft: '#ff9f5a', talk: '#f1fa8c' },
      resource: { hp: '#ff5c8a', gold: '#f1fa8c' },
      status: { warning: '#ffb86c' },
      combat: { crit: '#ffb86c', damage: '#ff8a6e' },
      terrain: { dirt: '#a17d5c', sand: '#e8dfa8', stone: '#8f93a8', bone: '#e6e4c8' },
    },
    regions: {
      redTown: { base: '#c56b6b' },
      beach: { base: '#e8dfa8' },
      rockyFlats: { base: '#a89b7a' },
      grassyFieldUnderground: { base: '#8a6e57' },
      caves: { base: '#7d84ad' },
      lobby: { base: '#9ab4e0' },
    },
  },
})
