/**
 * Light Gray Modern — the game as it looked themed with Tailwind.
 *
 * Before the theme system, the modern client was coloured straight from
 * Tailwind's palette: `gray-950` through `gray-700` for surfaces, and a hue
 * per role chosen as each component was written. This theme is that look,
 * reconstructed from the pre-theming source (commit b12ae9c) rather than from
 * a tidier mapping — so it restores what actually shipped: red attack, amber
 * search, green rest and blue look buttons; indigo primary buttons and chat;
 * red, sky and emerald vitals bars; `yellow-400` gold; amber quests; purple
 * travel lines in the feed.
 *
 * Every value is an exact Tailwind v4 palette stop, named in the comment
 * beside it, so the theme can be read as a Tailwind config.
 */

import { makeTheme } from '../factory'

export const lightGrayModern = makeTheme({
  id: 'light-gray-modern',
  name: 'Light Gray Modern',
  description: 'The Tailwind years. Cool gray surfaces, indigo chrome, palette-stop colours.',
  // indigo-500: the primary-button colour that defined the period.
  swatch: '#6366f1',
  // The Tailwind-era client used red-500 for attack and HP and red-400 for
  // errors, and forcing them apart turns attack orange and error pink — neither
  // of which is a Tailwind stop. Fidelity to the period wins, as it does for
  // Classic.
  separateReds: false,

  terminal: {
    background: '#030712', // gray-950
    foreground: '#d1d5db', // gray-300
    cursor: '#818cf8', // indigo-400
    selectionBackground: '#374151', // gray-700
    selectionForeground: '#f9fafb', // gray-50

    black: '#1f2937', // gray-800
    red: '#ef4444', // red-500
    green: '#22c55e', // green-500
    yellow: '#eab308', // yellow-500
    blue: '#3b82f6', // blue-500
    magenta: '#a855f7', // purple-500
    cyan: '#06b6d4', // cyan-500
    white: '#d1d5db', // gray-300

    brightBlack: '#4b5563', // gray-600
    brightRed: '#f87171', // red-400
    brightGreen: '#4ade80', // green-400
    brightYellow: '#facc15', // yellow-400
    brightBlue: '#60a5fa', // blue-400
    brightMagenta: '#c084fc', // purple-400
    brightCyan: '#22d3ee', // cyan-400
    brightWhite: '#f9fafb', // gray-50
  },

  overrides: {
    ui: {
      // gray-950 canvas · gray-900 panel · gray-800 raised · gray-700 hover ·
      // gray-600 selected, exactly as the components used them.
      surfaceCanvas: '#030712',
      surfaceSunken: '#01040a',
      surfacePanel: '#111827',
      surfaceRaised: '#1f2937',
      surfaceOverlay: '#161f31',
      surfaceHover: '#374151',
      surfaceSelected: '#4b5563',
      surfaceDisabled: '#111827',

      fgBright: '#ffffff',
      fgPrimary: '#d1d5db', // gray-300
      fgSecondary: '#9ca3af', // gray-400
      fgMuted: '#6b7280', // gray-500
      fgDisabled: '#4b5563', // gray-600

      lineSubtle: '#374151', // gray-700
      lineStrong: '#4b5563', // gray-600

      // Primary buttons ran `from-indigo-500 to-indigo-600`; focus rings were
      // `ring-indigo-500`.
      accent: '#6366f1', // indigo-500
      accentHover: '#818cf8', // indigo-400
      accentMuted: '#312e81', // indigo-900
      lineFocus: '#6366f1',
      fgOnAccent: '#ffffff',
    },

    game: {
      // BasicActionButtons: red / amber / green / blue gradients.
      action: {
        attack: '#ef4444', // red-500
        search: '#f59e0b', // amber-500
        rest: '#22c55e', // green-500
        look: '#3b82f6', // blue-500
        talk: '#38bdf8', // sky-400
        travel: '#c084fc', // purple-400 — the feed's room-enter/exit colour
        craft: '#f97316', // orange-500
        gather: '#84cc16', // lime-500
        use: '#a855f7', // purple-500
      },
      // Header bars: from-red-600 to-red-400, sky, emerald; gold text-yellow-400.
      resource: {
        hp: '#ef4444', // red-500
        mp: '#0ea5e9', // sky-500
        xp: '#10b981', // emerald-500
        gold: '#facc15', // yellow-400
      },
      // CharPanel: STR red-400, DEX emerald-400, MAG sky-400, DEF amber-400.
      stat: {
        str: '#f87171',
        dex: '#34d399',
        mag: '#38bdf8',
        def: '#fbbf24',
      },
      status: {
        success: '#4ade80', // green-400
        error: '#f87171', // red-400
        warning: '#facc15', // yellow-400
        info: '#60a5fa', // blue-400
      },
      loot: {
        common: '#d1d5db', // gray-300
        uncommon: '#4ade80', // green-400
        rare: '#60a5fa', // blue-400
        epic: '#c084fc', // purple-400
        legendary: '#fbbf24', // amber-400
      },
      enemy: {
        hostile: '#f87171', // red-400
        neutral: '#facc15', // yellow-400
        boss: '#a855f7', // purple-500
      },
      // FeedPanel: emerald room, indigo chat/DM, amber quests, purple travel.
      channel: {
        room: '#6ee7b7', // emerald-300
        world: '#60a5fa', // blue-400
        action: '#fbbf24', // amber-400
        dm: '#a5b4fc', // indigo-300
        system: '#9ca3af', // gray-400
        quest: '#fcd34d', // amber-300
      },
      // BattlePanel: red-300/green-300 lines, yellow-400 numbers.
      combat: {
        victory: '#86efac', // green-300
        defeat: '#ef4444', // red-500
        damage: '#fca5a5', // red-300
        heal: '#34d399', // emerald-400
        miss: '#6b7280', // gray-500
        crit: '#fde047', // yellow-300
      },
      terrain: {
        grass: '#22c55e', // green-500
        forest: '#15803d', // green-700
        dirt: '#b45309', // amber-700
        wood: '#92400e', // amber-800
        sand: '#fde68a', // amber-200
        stone: '#a8a29e', // stone-400
        water: '#06b6d4', // cyan-500
        ash: '#6b7280', // gray-500
        bone: '#e7e5e4', // stone-200
      },
      mood: {
        danger: '#ef4444', // red-500
        arcane: '#a855f7', // purple-500
        sacred: '#bae6fd', // sky-200
        treasure: '#facc15', // yellow-400
        calm: '#60a5fa', // blue-400
        decay: '#4d7c0f', // lime-700
      },
      hue: {
        gray: '#9ca3af', // gray-400
        red: '#f87171', // red-400
        gold: '#fbbf24', // amber-400
        green: '#4ade80', // green-400
        sky: '#38bdf8', // sky-400
        blue: '#60a5fa', // blue-400
        violet: '#a78bfa', // violet-400
        purple: '#c084fc', // purple-400
        pink: '#f472b6', // pink-400
      },
    },

    regions: {
      roomZero: { base: '#a78bfa' }, // violet-400
      grassyField: { base: '#22c55e' }, // green-500
      grassyFieldUnderground: { base: '#92400e' }, // amber-800
      beach: { base: '#fde047' }, // yellow-300
      caves: { base: '#94a3b8' }, // slate-400
      scorpionPit: { base: '#f97316' }, // orange-500
      forest: { base: '#15803d' }, // green-700
      forestUnderground: { base: '#115e59' }, // teal-800
      redTown: { base: '#b91c1c' }, // red-700
      redTownSewers: { base: '#3f6212' }, // lime-800
      rockyFlats: { base: '#78716c' }, // stone-500
      rockyFlatsUnderground: { base: '#57534e' }, // stone-600
      neverendingMine: { base: '#d97706' }, // amber-600
      ocean: { base: '#0ea5e9' }, // sky-500
      underwater: { base: '#1d4ed8' }, // blue-700
      darkForest: { base: '#15803d' }, // green-700
      darkKeep: { base: '#64748b' }, // slate-500
      rangersGuild: { base: '#4ade80' }, // green-400
      solarOffice: { base: '#facc15' }, // yellow-400
      lobby: { base: '#7dd3fc' }, // sky-300
    },
  },
})
