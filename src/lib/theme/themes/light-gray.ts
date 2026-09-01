/**
 * Light Gray RPG — the default and canonical theme.
 *
 * A restrained neutral-gray terminal scheme. The chrome stays quiet: surfaces
 * are true neutral (no blue cast), the interface accent is a muted steel blue,
 * and nothing in the frame competes with the room text. Colour is spent where
 * the game needs it — the ANSI palette is earthy rather than neon, and the
 * combat and reward roles are the brightest things on screen precisely because
 * everything around them is not.
 *
 * The terminal layer is a complete, valid 16-colour palette in its own right:
 * this is the theme intended to be exported to iTerm2, Windows Terminal, kitty,
 * Alacritty and WezTerm later, so its ANSI colours are chosen to be usable in a
 * real shell, not merely to feed the interface.
 */

import { makeTheme } from '../factory'

export const lightGray = makeTheme({
  id: 'light-gray',
  name: 'Light Gray RPG',
  description: 'The house palette. Neutral gray, earthy world, bright steel.',

  terminal: {
    background: '#0e0e0e',
    foreground: '#d0d0d0',
    cursor: '#e8bf72',
    selectionBackground: '#2f3a3f',
    selectionForeground: '#ededed',

    black: '#1a1a1a',
    red: '#b8574d',
    green: '#7a9557',
    yellow: '#c8994a',
    blue: '#5f7f9e',
    magenta: '#9b7096',
    cyan: '#6a9490',
    white: '#b8b8b8',

    brightBlack: '#4a4a4a',
    brightRed: '#e07a6d',
    brightGreen: '#a3c47a',
    brightYellow: '#e8bf72',
    brightBlue: '#8aacc8',
    brightMagenta: '#c39dbd',
    brightCyan: '#96bdb8',
    brightWhite: '#ededed',
  },

  overrides: {
    ui: {
      // Authored rather than derived so the grays stay perfectly neutral. The
      // derivation mixes toward the foreground, which carries a faint warmth.
      surfaceCanvas: '#0b0b0c',
      surfaceSunken: '#080809',
      surfacePanel: '#161617',
      surfaceRaised: '#1e1e20',
      surfaceOverlay: '#1a1a1c',
      surfaceHover: '#252528',
      surfaceSelected: '#2b2b2f',
      surfaceDisabled: '#161617',

      fgBright: '#f2f2f2',
      fgPrimary: '#d4d4d4',
      fgSecondary: '#a3a3a3',
      fgMuted: '#7a7a7a',
      fgDisabled: '#4f4f4f',

      lineSubtle: '#2a2a2c',
      lineStrong: '#3d3d40',

      // Steel blue, deliberately cooler and quieter than the gold used for
      // rewards, so interface chrome never reads as a prize.
      accent: '#7b96b0',
      accentHover: '#9ab3c9',
      accentMuted: '#3a4854',
      lineFocus: '#9ab3c9',
      fgOnAccent: '#0b0b0c',
    },

    game: {
      action: {
        attack: '#e08340',
        rest: '#7f9ec4',
        look: '#9a9a9a',
        talk: '#c9a86a',
        craft: '#c07a4a',
      },
      resource: {
        hp: '#cc4a63',
        mp: '#5f8fd4',
        xp: '#8fc46a',
        gold: '#e8bf72',
      },
      stat: {
        str: '#d97a5a',
        dex: '#8fbf7a',
        mag: '#9b8fd4',
        def: '#7fa3c9',
      },
      status: {
        success: '#84b869',
        error: '#e2564e',
        warning: '#dba03f',
        info: '#7ba3c9',
      },
      loot: {
        common: '#a3a3a3',
        uncommon: '#84b869',
        rare: '#6fa3d9',
        epic: '#a98fd4',
        legendary: '#e8b04a',
      },
      combat: {
        victory: '#a3c47a',
        defeat: '#b04a52',
        damage: '#e8896a',
        heal: '#7fc48a',
        crit: '#f0c24a',
      },
      terrain: {
        grass: '#7fa055',
        forest: '#5c7a4a',
        dirt: '#8a6a4a',
        sand: '#c4a878',
        stone: '#8a8a86',
        water: '#5a8a9e',
        ash: '#6a6a6e',
        bone: '#c9c0a8',
      },
      mood: {
        danger: '#b8564a',
        arcane: '#9b7ec4',
        sacred: '#9ab8d4',
        treasure: '#d4a84a',
        calm: '#6f9aae',
        decay: '#7a8a52',
      },
      hue: {
        gray: '#9a9a9a',
        red: '#d4645a',
        gold: '#dba64a',
        green: '#84b869',
        sky: '#6fb0d9',
        blue: '#6f92d9',
        violet: '#9b8fd4',
        purple: '#b06fd4',
        pink: '#d46f9e',
      },
    },

    regions: {
      // Room Zero is the strange liminal antechamber, so it gets the one colour
      // in the theme that belongs to no landscape.
      roomZero: { base: '#9b8fb5' },
      grassyField: { base: '#8fae5c' },
      grassyFieldUnderground: { base: '#7a6a52' },
      beach: { base: '#cbb07a' },
      caves: { base: '#6a707a' },
      scorpionPit: { base: '#bd7a2e' },
      forest: { base: '#5f8a52' },
      forestUnderground: { base: '#4a6350' },
      // Brick and terracotta: warm and clearly red-family, but desaturated far
      // enough from `action.attack` and `status.error` to never be mistaken for
      // either. Every theme keeps this separation.
      redTown: { base: '#a35a48' },
      redTownSewers: { base: '#6a7a52' },
      rockyFlats: { base: '#9e8a6a' },
      rockyFlatsUnderground: { base: '#8a8478' },
      // Lit by the miners' lamps rather than by daylight.
      neverendingMine: { base: '#b5934a' },
      solarOffice: { base: '#d9b84a' },
      lobby: { base: '#7a8fa3' },
    },
  },
})
