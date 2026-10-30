/**
 * Clear Signal — a colorblind-safe theme, built on the Okabe–Ito palette.
 *
 * The game speaks in red against green: HP and XP, STR and DEX, Attack and
 * Rest, error and success. About one man in twelve sees those pairs as one
 * color. Okabe & Ito's eight colors (https://jfly.uni-koeln.de/color/) were
 * chosen to stay apart under every common form of color blindness, so the
 * roles here start from them: vermillion where the game says red, a bluish
 * green where it says green, sky and true blue for the cool roles, orange-gold
 * and yellow for the warm ones, reddish purple for the rare and the alarm.
 *
 * Three rules do the work:
 *
 *  - **Reds lean orange and greens lean blue.** Red-green color blindness
 *    collapses that axis, so the pairs are pushed apart on the one it keeps
 *    (yellow against blue): a red reads as a dark amber, a green as a gray-blue.
 *  - **Pairs differ in lightness too.** Where two roles appear side by side
 *    (STR and DEX, MP and XP, uncommon and rare) one is clearly lighter, so
 *    they part even in the rare blue-yellow blindness.
 *  - **The alarm is crimson, not orange.** Every orange is already taken by
 *    attack, HP and the enemy's bar, and an orange error would read as one
 *    more of them; crimson stays apart from success green under all three.
 *
 * The stats keep their fixed hues (STR red, DEX green, MAG blue, DEF gold);
 * the vermillion and teal sit at the edges of those bands, not outside them.
 * The factory's red-family pass still nudges HP and the alarm apart after this
 * recipe. `test/theme.test.ts` simulates protanopia, deuteranopia and
 * tritanopia on the built theme and holds the role pairs apart, so the claim
 * in the name is checked rather than hoped.
 */

import { makeTheme } from '../factory'

// Okabe–Ito, lifted where needed to read on a dark ground, plus the few
// steps the game needs between them (four reds, two blues).
const VERMILLION = '#e04a2e'
const ORANGE_RED = '#f5821f'
const ALARM = '#d0457a'
const ORANGE = '#e69f00'
const YELLOW = '#f0e442'
const BLUISH_GREEN = '#3dd1b0'
const SKY = '#56b4e9'
const BLUE = '#3f7fe0'
const PURPLE = '#cc79a7'

export const clearSignal = makeTheme({
  id: 'clear-signal',
  name: 'Clear Signal',
  description: 'Colorblind-safe. Built on the Okabe–Ito colors, so no meaning rests on red against green.',
  swatch: YELLOW,
  accentSource: 'yellow',

  terminal: {
    background: '#0e1217',
    foreground: '#e8ecf1',
    cursor: YELLOW,
    selectionBackground: '#2a3340',
    selectionForeground: '#ffffff',

    black: '#1b2129',
    red: VERMILLION,
    green: BLUISH_GREEN,
    yellow: YELLOW,
    blue: BLUE,
    magenta: PURPLE,
    cyan: SKY,
    white: '#c8ced8',

    brightBlack: '#5c6676',
    brightRed: '#f47a45',
    brightGreen: '#3fd0a6',
    brightYellow: '#f6ec7a',
    brightBlue: '#7cadf2',
    brightMagenta: '#e09cc2',
    brightCyan: '#8fd0f5',
    brightWhite: '#ffffff',
  },

  overrides: {
    game: {
      action: {
        attack: ORANGE_RED,
        search: SKY,
        rest: BLUE,
        talk: YELLOW,
        travel: BLUISH_GREEN,
        craft: ORANGE,
        gather: '#9cc96b',
        use: PURPLE,
      },
      resource: { hp: VERMILLION, mp: BLUE, xp: BLUISH_GREEN, gold: YELLOW, foe: '#ff9a3d' },
      stat: { str: VERMILLION, dex: BLUISH_GREEN, mag: BLUE, def: ORANGE },
      status: { success: BLUISH_GREEN, error: ALARM, warning: YELLOW, info: SKY },
      loot: { uncommon: BLUISH_GREEN, rare: BLUE, epic: PURPLE, legendary: YELLOW },
      enemy: { hostile: VERMILLION, neutral: '#a3acb9', boss: PURPLE },
      combat: { victory: BLUISH_GREEN, defeat: '#a24a2c', damage: ORANGE_RED, heal: SKY, crit: YELLOW },
    },
  },
})
