/**
 * What the two Light Gray themes have in common.
 *
 * They are one palette shown on two grounds: the original's blue-tinted greys,
 * and a true-neutral darker set. Everything that carries meaning — the ANSI
 * palette, the game roles, the world regions — is identical between them, so a
 * player switching between the two sees the same world in a different light
 * rather than a different world.
 *
 * Only surfaces, text ranks and borders differ, and those live in each theme.
 */

import type { GameRoles, RegionId, RegionPalette, TerminalPalette } from '../types'

/**
 * The house ANSI palette.
 *
 * Earthy rather than neon, and written to be usable in a real shell — this is
 * the layer a future iTerm2/kitty/Alacritty/WezTerm export would carry. The
 * `background` differs per variant and is supplied by each theme.
 */
export const LIGHT_GRAY_ANSI: Omit<TerminalPalette, 'background' | 'selectionBackground'> = {
  foreground: '#d0d0d0',
  cursor: '#e8bf72',
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
}

/** Gameplay meaning. Identical in both variants. */
export const LIGHT_GRAY_GAME: Partial<GameRoles> = {
  action: {
    attack: '#e08340',
    search: '#6a9490',
    rest: '#7f9ec4',
    look: '#9a9a9a',
    talk: '#c9a86a',
    travel: '#8fae6b',
    craft: '#c07a4a',
    gather: '#96b06a',
    use: '#9b8fb5',
  },
  resource: { hp: '#cc4a63', mp: '#5f8fd4', xp: '#8fc46a', gold: '#e8bf72' },
  stat: { str: '#d97a5a', dex: '#8fbf7a', mag: '#9b8fd4', def: '#7fa3c9' },
  status: { success: '#84b869', error: '#e2564e', warning: '#dba03f', info: '#7ba3c9' },
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
    miss: '#8a8a8a',
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
}

/**
 * World identities. Earthy and atmospheric, identical in both variants.
 *
 * Room Zero is the one colour belonging to no landscape — it is the strange
 * liminal antechamber. Red Town is brick and terracotta: clearly red-family,
 * but desaturated far enough from `action.attack` and `status.error` to never
 * be mistaken for either.
 */
export const LIGHT_GRAY_REGIONS: Record<RegionId, RegionPalette> = {
  roomZero: { base: '#9b8fb5' },
  grassyField: { base: '#8fae5c' },
  grassyFieldUnderground: { base: '#7a6a52' },
  beach: { base: '#cbb07a' },
  caves: { base: '#6a707a' },
  scorpionPit: { base: '#bd7a2e' },
  forest: { base: '#5f8a52' },
  forestUnderground: { base: '#4a6350' },
  redTown: { base: '#a35a48' },
  redTownSewers: { base: '#6a7a52' },
  rockyFlats: { base: '#9e8a6a' },
  rockyFlatsUnderground: { base: '#8a8478' },
  neverendingMine: { base: '#b5934a' },
  solarOffice: { base: '#d9b84a' },
  lobby: { base: '#7a8fa3' },
}
