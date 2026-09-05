/**
 * Light Gray RPG Classic — the original game's colours, verbatim.
 *
 * Every value here is lifted from the reference game's stylesheet
 * (`assets/scss/_vars.scss`, "cool gray override" block, and the compiled
 * `css/lg.css`). The original was a cool slate ramp on a near-black blue
 * ground, one gold for everything that mattered, and one red doing several
 * jobs at once. Reproducing that is the point: this is the theme the id
 * `light-gray` has always meant, so an account that never chose a theme sees
 * the game it remembers.
 *
 * Surfaces follow the original's own elevation order rather than its class
 * names. `body` #07141d is the canvas; `.nav`/`.tops`/`.user-card` #111F2B is
 * sunken; `.menu`, the pop-up windows (`.levelWin`, `.questWin`, `.battlewin`,
 * `.fbox`) and `#map` #20303F are the panel; `.box`, `.subMenu`, `.descrip`
 * and `.battleBlock` #344456 are raised; `article`/`.panel` #425266 and
 * `.bar` #546378 are the hover and selected states. Text is `body` #EBEEF3,
 * captions the `#compass span` #8C97AB, timestamps #66748A.
 *
 * The one red. `$red` #D66976 was the attack tab, the HP bar, the action menu
 * and Red Town's titles alike, with `$dead` #EA4659 for death and damage. That
 * is kept — `separateReds: false` — because pulling those apart would make
 * this something other than the original. Every other theme keeps the
 * separation guarantee.
 *
 * Gold is the interface accent because gold *was* the interface: equip, buy,
 * eat, drink and activate buttons, the active menu icon, quest highlights and
 * the `.rare` badge were all `$gold` #EFB045 with slate text on top.
 */

import { makeTheme } from '../factory'

export const lightGray = makeTheme({
  id: 'light-gray',
  name: 'Light Gray RPG Classic',
  description: 'The original. Cool slate, one gold, one red — exactly as it was.',
  // The original's `.panel` slate — the colour most of its screen was.
  swatch: '#425266',
  separateReds: false,
  // `.btn` was the role colour with white text and `text-shadow: 0 0 4px
  // rgba(0,0,0,.6)` — gold stayed gold. Deepening would make it bronze.
  fills: 'flat',
  accentSource: 'yellow',

  terminal: {
    background: '#07141d',
    foreground: '#ebeef3',
    cursor: '#efb045',
    selectionBackground: '#344456',
    selectionForeground: '#f6f7f9',

    black: '#111f2b',
    red: '#d66976',
    green: '#6ebc75',
    yellow: '#efb045',
    blue: '#569acf',
    magenta: '#9287d0',
    cyan: '#0eb3f5',
    white: '#c5cbd8',

    brightBlack: '#546378',
    brightRed: '#ff7d8e',
    brightGreen: '#7ebe63',
    brightYellow: '#ffe183',
    brightBlue: '#70b9ed',
    brightMagenta: '#bda0ef',
    brightCyan: '#bee3ff',
    brightWhite: '#f6f7f9',
  },

  overrides: {
    ui: {
      surfaceCanvas: '#07141d',
      surfaceSunken: '#111f2b',
      surfacePanel: '#20303f',
      surfaceRaised: '#344456',
      surfaceOverlay: '#20303f',
      surfaceHover: '#425266',
      surfaceSelected: '#546378',
      surfaceDisabled: '#111f2b',

      fgBright: '#f6f7f9',
      fgPrimary: '#ebeef3',
      fgSecondary: '#c5cbd8',
      fgMuted: '#8c97ab',
      fgDisabled: '#66748a',

      lineSubtle: '#344456',
      lineStrong: '#425266',

      accent: '#efb045',
      accentHover: '#ffe183',
      accentMuted: '#4a4030',
      lineFocus: '#efb045',
      // `.rare`, `.goldchestopen`, `.lvlBox`: slate on gold.
      fgOnAccent: '#20303f',
    },

    game: {
      // The battle tabs: actions red, dex green, magic blue, bag gold.
      action: {
        attack: '#d66976',
        search: '#efb045',
        rest: '#6ebc75',
        look: '#569acf',
        talk: '#bda0ef',
        travel: '#7ebe63',
        // `_vars.scss`: "dark green #4F6C42 - crafting button".
        craft: '#4f6c42',
        gather: '#bd9486',
        use: '#0eb3f5',
      },
      // `hud.php`: HP redBG, MP blueBG, XP greenBG.
      resource: { hp: '#d66976', mp: '#569acf', xp: '#6ebc75', gold: '#efb045' },
      stat: { str: '#d66976', dex: '#6ebc75', mag: '#9287d0', def: '#569acf' },
      status: { success: '#6ebc75', error: '#ea4659', warning: '#efb045', info: '#569acf' },
      // `.rare` was gold on slate; enchanted items were pink.
      loot: {
        common: '#c5cbd8',
        uncommon: '#6ebc75',
        rare: '#efb045',
        epic: '#9287d0',
        legendary: '#ff9eff',
      },
      enemy: { hostile: '#d66976', neutral: '#8c97ab', boss: '#b20000' },
      channel: {
        room: '#6ebc75',
        world: '#569acf',
        action: '#d66976',
        dm: '#9287d0',
        system: '#8c97ab',
        quest: '#efb045',
      },
      combat: {
        victory: '#6ebc75',
        defeat: '#ea4659',
        damage: '#d66976',
        heal: '#7ebe63',
        miss: '#66748a',
        crit: '#ffff00',
      },
      // The `.greenfield`, `.forest`, `.dirt`, `.sand`, `.swamp` classes.
      terrain: {
        grass: '#7ebe63',
        forest: '#46ac4d',
        dirt: '#937774',
        wood: '#8f7772', // the original's `$brown`
        sand: '#ffcb39',
        stone: '#8c97ab',
        water: '#0eb3f5',
        ash: '#546378',
        bone: '#c5cbd8',
      },
      mood: {
        danger: '#d66976',
        arcane: '#9287d0',
        sacred: '#bee3ff',
        treasure: '#efb045',
        calm: '#569acf',
        decay: '#96a172',
      },
      hue: {
        gray: '#8c97ab',
        red: '#d66976',
        gold: '#efb045',
        green: '#6ebc75',
        sky: '#0eb3f5',
        blue: '#569acf',
        violet: '#9287d0',
        purple: '#9d80cf',
        pink: '#ff9eff',
      },
    },

    // Built from the original's terrain and colour classes: greenfield,
    // forest, dirt, sand, swamp, savannah, brown, redbrown, ocean, purple.
    regions: {
      roomZero: { base: '#9287d0' },
      grassyField: { base: '#7ebe63' },
      grassyFieldUnderground: { base: '#937774' },
      beach: { base: '#ffcb39' },
      caves: { base: '#66748a' },
      scorpionPit: { base: '#de6e1d' },
      forest: { base: '#46ac4d' },
      forestUnderground: { base: '#4f6c42' },
      // The same red as everything else, on purpose.
      redTown: { base: '#d66976' },
      redTownSewers: { base: '#96a172' },
      rockyFlats: { base: '#b1bd62' },
      rockyFlatsUnderground: { base: '#8f7772' },
      neverendingMine: { base: '#e5a812' },
      // The original's `.ocean` blue, and the darker water beneath it.
      ocean: { base: '#3aa0e0' },
      underwater: { base: '#2c6fa8' },
      // The original's `.darkgreen`, `.darkergray` and `.dgreen`: the Dark
      // Forest floor, the Keep's stone, and the guild's lighter canopy.
      darkForest: { base: '#2f7d32' },
      darkKeep: { base: '#7d8288' },
      rangersGuild: { base: '#5fb36a' },
      solarOffice: { base: '#efb045' },
      lobby: { base: '#0eb3f5' },
    },
  },
})
