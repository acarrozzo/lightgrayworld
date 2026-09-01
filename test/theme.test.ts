/**
 * Terminal theme system.
 *
 * Covers the parts with real logic rather than the palettes themselves — the
 * palettes are checked by `npm run validate-themes`, which enforces contrast
 * and distinctness across all eight.
 *
 * What matters here:
 *  - room colours resolve to theme variables and never to a CSS class, which
 *    is the defect the whole migration exists to remove;
 *  - the legacy compatibility layer reads un-migrated rows correctly, including
 *    the slot-dependent greys;
 *  - region assignment matches the SQL backfill in the migration;
 *  - the factory's guarantees hold for a deliberately hostile palette.
 *
 * Run: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { getRegionForRoom } from '../src/lib/theme/regions'
import { legacyRoomColorToken, roomColor, ROOM_COLOR_TOKENS } from '../src/lib/theme/room-colors'
import { makeTheme } from '../src/lib/theme/factory'
import { themeToCssVars, resolveRegions } from '../src/lib/theme/tokens'
import { contrast, deltaE } from '../src/lib/theme/color'
import { THEMES, resolveTheme, DEFAULT_THEME_ID } from '../src/lib/theme/themes'
import { ROLE_CATALOG, DOCUMENTED_VARS } from '../src/lib/theme/role-catalog'

test('room colours resolve to CSS variables, never to class names', () => {
  const value = roomColor('terrain.dirt', 'rockyFlats', 'title')
  assert.match(value, /^var\(--terrain-dirt/)
  // The old bug: `text-${room.iconColor}` produced a class Tailwind never built.
  assert.doesNotMatch(value, /^(text|bg|border)-/)
})

test('a room with no override inherits its region, per slot', () => {
  assert.equal(roomColor(null, 'redTown', 'title'), 'var(--world-red-town-title)')
  assert.equal(roomColor(undefined, 'forest', 'icon'), 'var(--world-forest-icon)')
  assert.equal(roomColor('', 'beach', 'direction'), 'var(--world-beach-direction)')
})

test('an unknown region falls back rather than emitting a broken variable', () => {
  assert.equal(roomColor(null, 'atlantis', 'title'), 'var(--world-grassy-field-title)')
  assert.equal(roomColor(null, null, 'title'), 'var(--world-grassy-field-title)')
})

test('an unrecognised override falls back to the region', () => {
  assert.equal(roomColor('chartreuse', 'caves', 'icon'), 'var(--world-caves-icon)')
})

test('every token in the vocabulary resolves to a variable the themes define', () => {
  const defined = new Set(Object.keys(themeToCssVars(THEMES[0])))
  for (const [token, varName] of Object.entries(ROOM_COLOR_TOKENS)) {
    assert.ok(defined.has(varName), `${token} -> ${varName} is not defined by any theme`)
  }
})

test('legacy greys read differently by slot', () => {
  // A grey room name is plain text; a grey room icon is stone.
  assert.equal(legacyRoomColorToken('gray-400', 'title'), 'text.primary')
  assert.equal(legacyRoomColorToken('gray-400', 'subtitle'), 'text.muted')
  assert.equal(legacyRoomColorToken('gray-400', 'icon'), 'terrain.stone')
  assert.equal(legacyRoomColorToken('gray-600', 'icon'), 'terrain.ash')
})

test('legacy reds mean danger, not Red Town', () => {
  // 002 is a redberry patch, 012b a scorpion pit, 111j an ogress fire altar.
  for (const shade of ['red-400', 'red-500', 'red-800', 'red-900']) {
    assert.equal(legacyRoomColorToken(shade, 'title'), 'mood.danger')
  }
})

test('the already-semantic legacy tokens survive', () => {
  assert.equal(legacyRoomColorToken('forest', 'title'), 'terrain.forest')
  assert.equal(legacyRoomColorToken('grass', 'title'), 'terrain.grass')
  assert.equal(legacyRoomColorToken('dirt', 'direction'), 'terrain.dirt')
  assert.equal(legacyRoomColorToken('sand', 'icon'), 'terrain.sand')
})

test('legacy values carrying an opacity suffix still map', () => {
  assert.equal(legacyRoomColorToken('pink-400/70', 'icon'), 'mood.arcane')
})

test('an already-migrated value passes through untouched', () => {
  assert.equal(legacyRoomColorToken('mood.danger', 'title'), 'mood.danger')
})

test('region assignment matches the migration backfill', () => {
  const cases: [string, string][] = [
    ['000', 'roomZero'],
    ['999', 'lobby'],
    ['088', 'solarOffice'],
    ['001', 'grassyField'],
    ['017', 'beach'],
    ['009', 'caves'],
    ['028e', 'caves'],
    ['012', 'grassyField'], // above the pit, still open air
    ['012b', 'scorpionPit'],
    ['003b', 'grassyFieldUnderground'],
    ['101', 'forest'],
    ['111c', 'forestUnderground'],
    ['115k', 'forestUnderground'],
    ['210', 'redTown'],
    ['232', 'redTown'], // above ground, despite the 232 prefix
    ['232mm', 'redTown'], // the Thieve's Den entrance is above ground too
    ['232q', 'redTownSewers'],
    ['215', 'forest'], // Red Town id, but the tower stands in the forest
    ['303', 'rockyFlats'],
    ['315b', 'rockyFlatsUnderground'],
    ['321b', 'rockyFlatsUnderground'],
    ['311-00', 'rockyFlatsUnderground'], // the mine head, still Rocky Flats rock
    ['311-01', 'neverendingMine'],
    ['311-30', 'neverendingMine'],
  ]
  for (const [roomId, expected] of cases) {
    assert.equal(getRegionForRoom(roomId), expected, `room ${roomId}`)
  }
})

test('an unknown room id gets the default region', () => {
  assert.equal(getRegionForRoom('zzz'), 'grassyField')
  assert.equal(getRegionForRoom(null), 'grassyField')
})

test('resolveTheme falls back to Light Gray for an unknown id', () => {
  assert.equal(resolveTheme('no-such-theme').id, DEFAULT_THEME_ID)
  assert.equal(resolveTheme(null).id, DEFAULT_THEME_ID)
  assert.equal(resolveTheme('dracula').id, 'dracula')
})

test('every theme emits the same variable set', () => {
  const expected = Object.keys(themeToCssVars(THEMES[0])).sort()
  for (const theme of THEMES) {
    assert.deepEqual(
      Object.keys(themeToCssVars(theme)).sort(),
      expected,
      `${theme.id} defines a different set of variables`
    )
  }
})

test('the factory rescues a hostile single-colour palette', () => {
  // Every ANSI slot is the same red: the worst case a real import could hit,
  // and the one where attack/HP/error/Red Town would otherwise collapse.
  const flat = '#aa2222'
  const hostile = makeTheme({
    id: 'hostile',
    name: 'Hostile',
    description: 'A deliberately degenerate palette.',
    terminal: {
      background: '#101010',
      foreground: '#c0c0c0',
      cursor: flat,
      selectionBackground: '#303030',
      selectionForeground: '#e0e0e0',
      black: flat, red: flat, green: flat, yellow: flat,
      blue: flat, magenta: flat, cyan: flat, white: flat,
      brightBlack: flat, brightRed: flat, brightGreen: flat, brightYellow: flat,
      brightBlue: flat, brightMagenta: flat, brightCyan: flat, brightWhite: '#f0f0f0',
    },
  })

  const regions = resolveRegions(hostile)
  const family: [string, string][] = [
    ['attack', hostile.game.action.attack],
    ['hp', hostile.game.resource.hp],
    ['error', hostile.game.status.error],
    ['redTown', regions.redTown.base],
  ]

  for (let i = 0; i < family.length; i++) {
    for (let j = i + 1; j < family.length; j++) {
      const d = deltaE(family[i][1], family[j][1])
      assert.ok(
        d >= 0.1,
        `${family[i][0]} and ${family[j][0]} collapsed (ΔE ${d.toFixed(3)})`
      )
    }
  }

  // And the lifted values stay readable on a panel.
  for (const [name, color] of family.slice(0, 3)) {
    const ratio = contrast(color, hostile.ui.surfacePanel)
    assert.ok(ratio >= 3, `${name} is unreadable at ${ratio.toFixed(2)}:1`)
  }
})

test('region derivation fills every slot', () => {
  for (const theme of THEMES) {
    const regions = resolveRegions(theme)
    for (const [id, palette] of Object.entries(regions)) {
      for (const slot of ['base', 'title', 'subtitle', 'icon', 'direction', 'accent', 'tint']) {
        const value = (palette as Record<string, string>)[slot]
        assert.match(value, /^#[0-9a-fA-F]{6,8}$/, `${theme.id}/${id}/${slot} is ${value}`)
      }
    }
  }
})

test('the role catalog documents every role a theme defines', () => {
  const documented = new Set(DOCUMENTED_VARS)
  const emitted = Object.keys(themeToCssVars(THEMES[0]))

  // Regions and the terminal layer are documented structurally by the World
  // Tool page (a region has fifteen instances of the same seven slots, and the
  // ANSI table is shown whole), so they are not expected in the role catalog.
  const roleVars = emitted.filter(
    (v) => !v.startsWith('--world-') && !v.startsWith('--ansi-') && !v.startsWith('--term-')
  )

  const undocumented = roleVars.filter((v) => !documented.has(v))
  assert.deepEqual(undocumented, [], `these roles have no entry in ROLE_CATALOG: ${undocumented}`)
})

test('the role catalog documents nothing a theme does not define', () => {
  const emitted = new Set(Object.keys(themeToCssVars(THEMES[0])))
  const stale = DOCUMENTED_VARS.filter((v) => !emitted.has(v))
  assert.deepEqual(stale, [], `ROLE_CATALOG documents variables no theme emits: ${stale}`)
})

test('every catalog token matches its CSS variable', () => {
  for (const group of ROLE_CATALOG) {
    for (const r of group.roles) {
      assert.match(r.cssVar, /^--[a-z-]+$/, `${r.token} has a malformed variable`)
      assert.ok(r.meaning.length > 0, `${r.token} has no meaning`)
      assert.ok(r.usedFor.length > 0, `${r.token} has no usage`)
    }
  }
})
