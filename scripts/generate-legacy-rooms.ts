/**
 * Snapshot the original game's room descriptions into committed JSON.
 *
 * The `/room-desc` World Tool page shows the original game and the recreation
 * side by side, so the original's text has to be readable at runtime. The
 * reference copy is deliberately git-ignored and must never be edited, and it
 * is absent from any deploy — so this script parses it once into
 * `src/lib/game-data/legacy-rooms.json`, which is committed and read by the
 * page. Re-run it only if the frozen reference ever changes.
 *
 *   npm run generate-legacy-rooms
 *
 * The original keeps room descriptions in three places, and they do not
 * overlap:
 *
 *   roomdesc/NNN.php     49 rooms — the Grassy Field and its caves, written as
 *                        PHP `echo` blocks with live gameplay conditionals.
 *   room-desc-extra.php  336 rooms — plain `$_SESSION['descNNN'] = <<<HTML`
 *                        heredocs, one per room.
 *   room-desc.php        2 rooms (030, 101) — the same heredocs, inline.
 *
 * Everything is scraped from the markup the player actually saw: an <h3> is the
 * room title, <h4> the subtitle, <p> the description, and each submit button or
 * input is a command. A command that names a compass direction is an exit;
 * anything else is a room action.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REFERENCE_DIR = join(
  process.cwd(),
  'lg-DO NOT EDIT - ORIGINAL LG RPG GAME - FOR REFERENCE ONLY'
)
const OUT_FILE = join(process.cwd(), 'src', 'lib', 'game-data', 'legacy-rooms.json')

/** Command values that move the player rather than doing something in the room. */
const DIRECTIONS = new Set([
  'north', 'northeast', 'east', 'southeast', 'south',
  'southwest', 'west', 'northwest', 'up', 'down',
])

export type LegacyRoom = {
  roomId: string
  title: string | null
  titleColor: string | null
  subtitle: string | null
  description: string
  /** Non-movement commands, in the order the buttons appeared. */
  actions: { command: string; label: string }[]
  /** Movement commands, normalised to full direction names. */
  exits: string[]
  /** `data-link` anchors — the panels a room opened (quests, shop, spells…). */
  links: { target: string; label: string }[]
  icon: string | null
  dangerLevel: number | null
  source: string
}

// --- small HTML helpers -----------------------------------------------------

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
}

/**
 * Remove PHP that the original resolved at runtime but that is just noise here.
 *
 * The `roomdesc/*.php` files build markup by concatenation, so a label reads
 * `Read Sign '.$btnIcon.'` in the source; heredocs interpolate bare `$icon`
 * straight into the markup. Neither is text the player ever saw.
 */
function stripPhpArtifacts(s: string): string {
  return s
    // '.$var.' and '. $var['key'] .' concatenation joints
    .replace(/'\s*\.\s*\$[A-Za-z_]\w*(?:\[[^\]]*\])*\s*\.\s*'/g, ' ')
    // a trailing/leading half-joint left at the end of a string literal
    .replace(/'\s*\.\s*\$[A-Za-z_]\w*(?:\[[^\]]*\])*/g, ' ')
    .replace(/\$[A-Za-z_]\w*(?:\[[^\]]*\])*\s*\.\s*'/g, ' ')
    // a bare interpolated variable, e.g. `<span>$icon</span>`
    .replace(/\$[A-Za-z_]\w*(?:\[[^\]]*\])*/g, ' ')
}

/** Strip tags and collapse whitespace — the text a player read. */
function text(html: string): string {
  return stripPhpArtifacts(decode(html.replace(/<[^>]*>/g, ' ')))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Drop `//` line comments so commented-out markup is never scraped as real. */
function stripLineComments(php: string): string {
  return php
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

function firstMatch(html: string, re: RegExp): RegExpMatchArray | null {
  return html.match(re)
}

// --- the parser ------------------------------------------------------------

function parseRoomHtml(roomId: string, html: string, source: string): LegacyRoom {
  const h3 = firstMatch(html, /<h3([^>]*)>([\s\S]*?)<\/h3>/i)
  const h4 = firstMatch(html, /<h4([^>]*)>([\s\S]*?)<\/h4>/i)
  const titleColor = h3 ? (h3[1].match(/class\s*=\s*"([^"]*)"/i)?.[1]?.trim() || null) : null

  // Every <p> a player saw, in order. Rooms often carry a second paragraph of
  // instructions inside the form, and it is part of the description they read.
  //
  // The closing tag is optional on purpose: a fair number of rooms open a <p>
  // and never close it (606, and others), letting the browser end it at the
  // next block. Requiring </p> silently dropped those descriptions entirely.
  const paragraphs: string[] = []
  const P_END = /<\/p>|<form\b|<\/div>|<div\b|<button\b|<input\b|<h[1-6]\b|<a\b/i
  for (const m of html.matchAll(/<p\b[^>]*>/gi)) {
    const rest = html.slice((m.index ?? 0) + m[0].length)
    const end = rest.search(P_END)
    const t = text(end === -1 ? rest : rest.slice(0, end))
    if (t) paragraphs.push(t)
  }

  const actions: { command: string; label: string }[] = []
  const exits: string[] = []
  const seenCommand = new Set<string>()

  const addCommand = (rawCommand: string, rawLabel: string) => {
    const command = decode(rawCommand).trim()
    if (!command) return
    const key = command.toLowerCase()
    if (seenCommand.has(key)) return
    seenCommand.add(key)
    if (DIRECTIONS.has(key)) {
      exits.push(key)
      return
    }
    const label = text(rawLabel) || command
    actions.push({ command, label })
  }

  // <button ... value="rest">Rest</button>
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const value = m[1].match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1]
    if (value != null) addCommand(value, m[2])
  }
  // <input type="submit" value="pick flower" /> — the label IS the value here.
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1]
    if (!/type\s*=\s*"submit"/i.test(attrs)) continue
    const value = attrs.match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1]
    if (value != null) addCommand(value, value)
  }

  // <a href data-link="quests" class="btn goldBG">Quests</a>
  // Deduped by target: a few rooms link the same panel twice, which is a
  // duplicate button in the original, not two different destinations.
  const links: { target: string; label: string }[] = []
  const seenLink = new Set<string>()
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const target = m[1].match(/\bdata-link2?\s*=\s*"([^"]*)"/i)?.[1]?.trim()
    if (!target || seenLink.has(target.toLowerCase())) continue
    seenLink.add(target.toLowerCase())
    links.push({ target, label: text(m[2]) || target })
  }

  return {
    roomId,
    title: h3 ? text(h3[2]) || null : null,
    titleColor,
    subtitle: h4 ? text(h4[2]) || null : null,
    description: paragraphs.join('\n\n'),
    actions,
    exits,
    links,
    icon: null,
    dangerLevel: null,
    source,
  }
}

/**
 * `$_SESSION['dangerLVL'] = "3";` inside a room's `if ($roomID=='NNN')` block.
 * Read separately from the markup because it is game state, not display.
 */
function dangerLevelsFrom(php: string): Map<string, number> {
  const out = new Map<string, number>()
  const re = /if\s*\(\s*\$roomID\s*==\s*'([^']+)'\s*\)\s*\{([\s\S]*?)\}/g
  for (const m of php.matchAll(re)) {
    const lvl = m[2].match(/\$_SESSION\['dangerLVL'\]\s*=\s*"?(\d+)"?/)
    if (lvl) out.set(m[1], Number(lvl[1]))
  }
  return out
}

/** `img/svg/npc/npc-wizard.svg` -> `npc/npc-wizard`. */
function iconName(path: string): string {
  return path.replace(/^img\/svg\//, '').replace(/\.svg$/, '')
}

/**
 * Heredoc rooms, from `room-desc-extra.php` and `room-desc.php`.
 *
 * Scanned in file order so that `$icon = file_get_contents(...)` assignments
 * bind to the rooms that follow them, which is exactly how PHP interpolated
 * `$icon` into each heredoc at runtime.
 */
function parseHeredocFile(php: string, source: string): LegacyRoom[] {
  const clean = stripLineComments(php)
  const dangers = dangerLevelsFrom(clean)
  const rooms: LegacyRoom[] = []

  const token = /\$_SESSION\['desc([^']+)'\]\s*=\s*<<<(?:"?)HTML(?:"?)\r?\n([\s\S]*?)\r?\nHTML;/g
  const icons = /\$icon\s*=\s*file_get_contents\(\s*"([^"]+)"\s*\)/g

  // Index every $icon assignment by offset, then for each heredoc take the
  // closest one before it.
  const iconAt: { at: number; name: string }[] = []
  for (const m of clean.matchAll(icons)) iconAt.push({ at: m.index ?? 0, name: iconName(m[1]) })

  for (const m of clean.matchAll(token)) {
    const roomId = m[1]
    const room = parseRoomHtml(roomId, m[2], source)
    const at = m.index ?? 0
    let icon: string | null = null
    for (const i of iconAt) {
      if (i.at < at) icon = i.name
      else break
    }
    room.icon = icon
    room.dangerLevel = dangers.get(roomId) ?? null
    rooms.push(room)
  }
  return rooms
}

/** The 49 `roomdesc/NNN.php` files, whose markup lives inside `echo` strings. */
function parseRoomDescDir(dir: string): LegacyRoom[] {
  const rooms: LegacyRoom[] = []
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.php')) continue
    const roomId = file.replace(/\.php$/, '')
    const raw = readFileSync(join(dir, file), 'utf8')
    const clean = stripLineComments(raw)
    // The tags survive intact inside the PHP string literals, so the same
    // markup scrape works; only the comments had to go first.
    const room = parseRoomHtml(roomId, clean, `roomdesc/${file}`)
    room.icon = clean.match(/\$icon\s*=\s*file_get_contents\(\s*"([^"]+)"\s*\)/)
      ? iconName(clean.match(/\$icon\s*=\s*file_get_contents\(\s*"([^"]+)"\s*\)/)![1])
      : null
    room.dangerLevel =
      dangerLevelsFrom(clean).get(roomId) ??
      (clean.match(/\$_SESSION\['dangerLVL'\]\s*=\s*"?(\d+)"?/)
        ? Number(clean.match(/\$_SESSION\['dangerLVL'\]\s*=\s*"?(\d+)"?/)![1])
        : null)
    rooms.push(room)
  }
  return rooms
}

// --- run -------------------------------------------------------------------

function main() {
  if (!existsSync(REFERENCE_DIR)) {
    console.error(
      `Reference game not found at:\n  ${REFERENCE_DIR}\n\n` +
        'It is git-ignored on purpose. Restore your local copy (or check it out from ' +
        'commit 4f68a0d) and re-run. The committed JSON is left untouched.'
    )
    process.exit(1)
  }

  const byId = new Map<string, LegacyRoom>()
  const add = (rooms: LegacyRoom[]) => {
    for (const r of rooms) byId.set(r.roomId, r)
  }

  // Same precedence the original applied: roomdesc/* is loaded first, then
  // room-desc.php's own heredocs, then room-desc-extra.php overrides both.
  add(parseRoomDescDir(join(REFERENCE_DIR, 'roomdesc')))
  add(parseHeredocFile(readFileSync(join(REFERENCE_DIR, 'room-desc.php'), 'utf8'), 'room-desc.php'))
  add(
    parseHeredocFile(
      readFileSync(join(REFERENCE_DIR, 'room-desc-extra.php'), 'utf8'),
      'room-desc-extra.php'
    )
  )

  const rooms = Array.from(byId.values()).sort((a, b) =>
    a.roomId.localeCompare(b.roomId, undefined, { numeric: true })
  )

  const missingTitle = rooms.filter((r) => !r.title).map((r) => r.roomId)
  const missingDesc = rooms.filter((r) => !r.description).map((r) => r.roomId)

  writeFileSync(OUT_FILE, JSON.stringify({ rooms }, null, 2) + '\n', 'utf8')

  console.log(`Wrote ${rooms.length} legacy rooms to ${OUT_FILE.replace(process.cwd() + '/', '')}`)
  const bySource = new Map<string, number>()
  for (const r of rooms) {
    const key = r.source.startsWith('roomdesc/') ? 'roomdesc/*.php' : r.source
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
  }
  for (const [src, n] of bySource) console.log(`  ${n.toString().padStart(4)}  ${src}`)
  if (missingTitle.length) console.log(`  no <h3> title: ${missingTitle.join(', ')}`)
  if (missingDesc.length) console.log(`  no <p> description: ${missingDesc.join(', ')}`)
}

main()
