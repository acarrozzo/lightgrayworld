export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import WorldToolNav from '@/components/WorldToolNav'
import { resolveItemIcon } from '@/lib/item-actions'
import RoomAtlas, {
  type MapId,
  type RoomNode,
  type RoomEdge,
  type ExitInfo,
  type EnemySpawn,
  type RoomActionInfo,
  type SecretInfo,
} from './RoomAtlas'

export const metadata = {
  title: 'World Atlas — Light Gray RPG',
  description:
    'Every room in Light Gray RPG as an interactive node graph — enemies and spawn logic, NPCs, loot, actions, gates, and secrets.',
}

// This page is PUBLIC BY DESIGN, spoilers and all.
//
// It has no auth check and lists every hidden exit, reveal condition and gate in
// the game — including passages a player is meant to find by searching. That is
// a deliberate decision, not an oversight: the Atlas is a developer's wiki, and
// being able to read the whole world at a glance is the point of it. If it ever
// needs to stop spoiling secrets, the fix is to gate the `secrets` layer behind
// a session rather than to trim what the page derives.
//
// All room data is pulled live from its canonical sources so this page never
// drifts: the Room rows live in the database, while the dynamic layers
// (spawn tables, loot, gates, reveals, room actions) live in the game engine.
/* eslint-disable @typescript-eslint/no-var-requires */
const { ROOM_ENEMIES } = require('@/lib/game-data/room-enemies') as {
  ROOM_ENEMIES: Record<string, RoomEnemyConfig>
}
const { ROOM_LOOT } = require('@/lib/game-engine/config/room-loot') as {
  ROOM_LOOT: { roomId: string; slug: string; quantity?: number; autoRespawn?: boolean }[]
}
const { ROOM_GATES } = require('@/lib/game-engine/room-gates') as {
  ROOM_GATES: Record<string, Record<string, GateDef>>
}
const { REVEAL_DEFINITIONS } = require('@/lib/game-engine/search-reveal-state') as {
  REVEAL_DEFINITIONS: Record<string, RevealDef>
}
const { ROOM_ACTIONS } = require('@/lib/game-engine/room-action-handlers') as {
  ROOM_ACTIONS: Record<string, Record<string, unknown>>
}
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: EnemyDef[] }
const { isCraftingRoom, getCraftingStation } = require('@/lib/game-data/crafting-recipes') as {
  isCraftingRoom: (roomId: string) => boolean
  getCraftingStation: (roomId: string) => { label: string } | null
}
/* eslint-enable @typescript-eslint/no-var-requires */

type RoomEnemyConfig = {
  probabilistic?: boolean
  spawnChance?: number
  // Static rooms use string[]; probabilistic rooms use { slug, weight }[]
  enemies: (string | { slug: string; weight: number })[]
}
type GateDef = {
  message?: string
  silent?: boolean
  /** The exit is masked from the client until it is opened. */
  hidden?: boolean
  /** The exit is opened by a mechanism the player throws, not a search. */
  lever?: boolean
  onPass?: unknown
  modalContent?: { title?: string }
}
type RevealDef = { direction: string; toRoom: string; chance?: number; stateNote?: string }
type EnemyDef = { slug: string; name: string; level?: number; icon?: string | null }

// The ten exit columns on the Room model, in compass order. `up`/`down` are
// vertical (non-Euclidean) links and are flagged as such on their edges.
const DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
] as const
type Direction = (typeof DIRECTIONS)[number]
const VERTICAL = new Set<Direction>(['up', 'down'])

// The world is presented as cardinal-grid maps that mirror the in-game map
// backgrounds, one tab per region. Overworld ("Grassy Field") plus its three
// undergrounds — the Cabin Basement (003b*), the Scorpion Pit (the deep scorpion
// dungeon) and the Bat Cave (028*) — then the Forest and its lairs, then Red Town
// and the sewers beneath it, then the Rocky Flats with the Abandoned Mine, the
// chamber under the Stone Grotto, and the Neverending Mine's own shaft, then the
// Blue Ocean and everything under it, then the Dark Forest and its upper level.
// A region's surface entrance stays on the surface tab
// (the bat-cave mouth 028, the Back Alley sewer 232), so links between maps become
// portal markers. Mirrors getMapIdForRoom in components/game-interface/utils.ts.
const SCORPION_DUNGEON = ['012b', '012c', '012d', '012e', '012f', '012g', '012h']
const FOREST_UNDERGROUND = [
  '111a', '111b', '111c', '111d', '111e', '111f', '111g', '111h', '111i', '111j', '111k',
  '115a', '115b', '115c', '115d', '115e', '115f', '115g', '115h', '115i', '115j', '115k',
]
const RED_TOWN_SEWERS = [
  '232a', '232b', '232c', '232d', '232e', '232f', '232g', '232h', '232i', '232j',
  '232k', '232l', '232m', '232n', '232o', '232p', '232q', '232r', '232s', '232t',
  '232u', '232v', '232w', '232x', '232y', '232z',
]
// Isolated special rooms that don't belong to any map.
const EXCLUDED = new Set(['000', '999', '088'])
const ROCKY_FLATS_UNDERGROUND = ['315a', '315b', '315c', '315d', '321b']
const UNDER_THE_OCEAN = [
  '480', '481', '482', '483', '484', '485', '486', '487', '488', '489',
  '490', '491', '492', '493', '494', '495', '496', '497', '498', '499',
]
// The Dark Forest's one sheet that sits above the surface rather than below
// it: the Ranger's Guild in the tree tops and the Keep's second floor.
const DARK_FOREST_UPPER = ['515a', '515b', '515c', '515d', '515e', '516e', '516f', '516g', '516h']
const mapOf = (roomId: string): MapId => {
  if (roomId.startsWith('003b')) return 'cabin_basement'
  if (SCORPION_DUNGEON.includes(roomId)) return 'scorpion_pit'
  if (roomId.startsWith('028') && roomId !== '028') return 'bat_cave'
  if (FOREST_UNDERGROUND.includes(roomId)) return 'forest_underground'
  if (RED_TOWN_SEWERS.includes(roomId)) return 'red_town_sewers'
  // The Red Guard Captain's lookout tower belongs to the Forest map even though
  // its room ID sits in the Red Town block.
  if (roomId === '215') return 'forest'
  // The Neverending Mine: Level 0 is the mine head, drawn on the Rocky Flats
  // Underground sheet; every level below it is on the mine's own single tile.
  if (roomId === '311-00') return 'rocky_flats_underground'
  if (roomId.startsWith('311-')) return 'neverending_mine'
  if (ROCKY_FLATS_UNDERGROUND.includes(roomId)) return 'rocky_flats_underground'
  if (roomId.startsWith('3')) return 'rocky_flats'
  if (UNDER_THE_OCEAN.includes(roomId)) return 'under_the_ocean'
  if (roomId.startsWith('4')) return 'blue_ocean'
  if (DARK_FOREST_UPPER.includes(roomId)) return 'dark_forest_upper'
  if (roomId.startsWith('5')) return 'dark_forest'
  if (roomId.startsWith('2')) return 'red_town'
  if (roomId.startsWith('1')) return 'forest'
  return 'overworld'
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function RoomsPage() {
  // 1. Rooms (with their NPCs and ground items) straight from the DB.
  const rooms = await prisma.room.findMany({
    include: {
      npcs: true,
      items: { include: { ItemTemplate: { select: { slug: true, name: true, metadata: true } } } },
    },
    orderBy: { roomId: 'asc' },
  })

  // 2. Resolve names/icons for every slug referenced by the engine config.
  const enemyBySlug = new Map(ENEMIES.map((e) => [e.slug, e]))
  const lootSlugs = Array.from(new Set(ROOM_LOOT.map((l) => l.slug)))
  const lootTemplates = lootSlugs.length
    ? await prisma.itemTemplate.findMany({
        where: { slug: { in: lootSlugs } },
        select: { slug: true, name: true, metadata: true },
      })
    : []
  const lootBySlug = new Map(lootTemplates.map((t) => [t.slug, t]))

  // 3. Quest givers grouped by the room they stand in (richer than the bare DB
  //    NPC rows — carries an icon and a count of quests offered).
  const giverData = require('@/lib/game-data/quest-givers.json') as Record<
    string,
    { roomId: string; name: string; icon: string; quests: string[] }
  >
  const giversByRoom = new Map<string, Map<string, { name: string; icon: string; questCount: number }>>()
  for (const [giverId, g] of Object.entries(giverData)) {
    if (!g?.roomId) continue
    if (!giversByRoom.has(g.roomId)) giversByRoom.set(g.roomId, new Map())
    giversByRoom.get(g.roomId)!.set(giverId, { name: g.name, icon: g.icon, questCount: g.quests.length })
  }

  // Build a roomId -> exits map up front so we can detect one-way exits
  // (a link whose destination doesn't link back to the source).
  const exitsByRoom = new Map<string, { direction: Direction; to: string }[]>()
  for (const room of rooms) {
    if (EXCLUDED.has(room.roomId)) continue
    const list: { direction: Direction; to: string }[] = []
    for (const dir of DIRECTIONS) {
      const to = (room as Record<string, unknown>)[dir] as string | null
      if (to && !EXCLUDED.has(to)) list.push({ direction: dir, to })
    }
    exitsByRoom.set(room.roomId, list)
  }
  const linksBack = (from: string, to: string) =>
    (exitsByRoom.get(to) ?? []).some((e) => e.to === from)

  const nodes: RoomNode[] = []
  const edges: RoomEdge[] = []

  for (const room of rooms) {
    if (EXCLUDED.has(room.roomId)) continue
    const gates = ROOM_GATES[room.roomId] ?? {}
    const reveal = REVEAL_DEFINITIONS[room.roomId]

    // --- Exits (with gate / hidden / lever / one-way annotations) ---
    const exits: ExitInfo[] = []
    const seenDirs = new Set<string>()
    for (const { direction, to } of exitsByRoom.get(room.roomId) ?? []) {
      seenDirs.add(direction)
      const gate = gates[direction]
      // Hidden = the client never sees this exit until it is opened, whether by a
      // search reveal or by a lever. `gate.lever` is declared, not inferred from
      // `onPass` — a one-shot pass (Freddie's toll) also spends itself on the way
      // through without being a mechanism the player throws.
      const hidden = (!!reveal && reveal.direction === direction) || !!gate?.hidden
      const lever = !!gate?.lever
      const exit: ExitInfo = {
        direction,
        to,
        gated: !!gate,
        gateMessage: gate?.message,
        silent: !!gate?.silent,
        hidden,
        lever,
        oneWay: !linksBack(room.roomId, to),
      }
      exits.push(exit)
      edges.push({
        from: room.roomId,
        to,
        direction,
        gated: !!gate,
        hidden,
        lever,
        vertical: VERTICAL.has(direction),
      })
    }
    // A reveal definition can point at an exit the DB doesn't list yet — surface it.
    if (reveal && !seenDirs.has(reveal.direction)) {
      exits.push({
        direction: reveal.direction,
        to: reveal.toRoom,
        gated: true,
        hidden: true,
        silent: true,
      })
      edges.push({ from: room.roomId, to: reveal.toRoom, direction: reveal.direction, hidden: true })
    }

    // --- Enemies & spawn logic ---
    const cfg = ROOM_ENEMIES[room.roomId]
    let enemyInfo: RoomNode['enemies'] = null
    if (cfg) {
      if (cfg.probabilistic) {
        const total = (cfg.enemies as { slug: string; weight: number }[]).reduce(
          (s, e) => s + e.weight,
          0
        )
        const spawns: EnemySpawn[] = (cfg.enemies as { slug: string; weight: number }[]).map((e) => {
          const def = enemyBySlug.get(e.slug)
          return {
            slug: e.slug,
            name: def?.name ?? prettifySlug(e.slug),
            level: def?.level,
            icon: def?.icon ?? null,
            weight: e.weight,
            chancePct: total > 0 ? Math.round((e.weight / total) * 100) : undefined,
          }
        })
        enemyInfo = {
          mode: 'probabilistic',
          spawnChancePct: Math.round((cfg.spawnChance ?? 0) * 100),
          enemies: spawns,
        }
      } else {
        const spawns: EnemySpawn[] = (cfg.enemies as string[]).map((slug) => {
          const def = enemyBySlug.get(slug)
          return {
            slug,
            name: def?.name ?? prettifySlug(slug),
            level: def?.level,
            icon: def?.icon ?? null,
          }
        })
        enemyInfo = { mode: 'static', enemies: spawns }
      }
    }

    // --- Items / loot (config-driven, resolved to DB names + icons) ---
    const items = ROOM_LOOT.filter((l) => l.roomId === room.roomId).map((l) => {
      const t = lootBySlug.get(l.slug)
      const meta = (t?.metadata as { icon?: string } | null) ?? null
      return {
        slug: l.slug,
        name: t?.name ?? prettifySlug(l.slug),
        icon: resolveItemIcon(meta, l.slug),
        quantity: l.quantity ?? 1,
        autoRespawn: l.autoRespawn !== false,
      }
    })

    // --- NPCs (DB rows + quest givers, deduped by name) ---
    const npcByName = new Map<string, RoomNode['npcs'][number]>()
    for (const n of room.npcs) {
      npcByName.set(n.name, { name: n.name, type: n.type })
    }
    for (const g of giversByRoom.get(room.roomId)?.values() ?? []) {
      npcByName.set(g.name, {
        name: g.name,
        icon: g.icon,
        type: 'quest-giver',
        questCount: g.questCount,
      })
    }
    const npcs = Array.from(npcByName.values())

    // --- Room-specific actions (introspected; functions become "custom") ---
    const actions: RoomActionInfo[] = []
    const actionDefs = ROOM_ACTIONS[room.roomId] ?? {}
    for (const [name, def] of Object.entries(actionDefs)) {
      if (typeof def === 'string') {
        actions.push({ name, kind: 'message', detail: def })
      } else if (typeof def === 'function') {
        actions.push({ name, kind: 'custom' })
      } else if (def && typeof def === 'object') {
        const d = def as Record<string, unknown>
        if (Array.isArray(d.effects)) {
          const detail = (d.effects as { type?: string; itemSlug?: string; quantity?: number }[])
            .map((e) =>
              e.type === 'grantItem'
                ? `grants ${e.quantity ?? 1}× ${prettifySlug(e.itemSlug ?? '')}` +
                  (typeof d.cooldownMs === 'number' ? ` (every ${Math.round((d.cooldownMs as number) / 60000)}m)` : '')
                : e.type ?? 'effect'
            )
            .join(', ')
          actions.push({ name, kind: 'effect', detail })
        } else {
          const mc = d.modalContent as { message?: string } | undefined
          actions.push({ name, kind: 'modal', detail: (d.message as string) ?? mc?.message })
        }
      }
    }

    // --- Secrets (reveals, levers, gates) ---
    const secrets: SecretInfo[] = []
    if (reveal) {
      const chance =
        reveal.chance != null && reveal.chance < 1
          ? ` (${Math.round(reveal.chance * 100)}% chance per search)`
          : ' (always reveals)'
      secrets.push({
        kind: 'reveal',
        text: `Searching reveals a hidden exit ${reveal.direction} → room ${reveal.toRoom}${chance}.`,
      })
    }
    for (const [direction, gate] of Object.entries(gates)) {
      if (gate.onPass) {
        secrets.push({ kind: 'lever', text: `The ${direction} exit is unlocked by a lever mechanism.` })
      }
      secrets.push({
        kind: 'gate',
        text: `${direction.toUpperCase()}: ${gate.message ?? 'Gated passage.'}`,
      })
    }

    nodes.push({
      roomId: room.roomId,
      map: mapOf(room.roomId),
      name: room.name,
      subtitle: room.subtitle,
      description: room.description,
      dangerLevel: room.dangerLevel,
      isSafe: room.isSafe,
      hasFire: room.hasFire,
      // Derived from the crafting station table, the same one the crafting
      // action and the sheet use, rather than the seed's `hasCraftingTable`
      // column — which is read by nothing else and had already drifted,
      // marking rooms 021 and 024 as having no crafting table when both craft.
      hasCraftingTable: isCraftingRoom(room.roomId),
      craftingStation: getCraftingStation(room.roomId)?.label ?? null,
      hasSearch: room.hasSearch,
      icon: room.icon,
      region: room.region,
      iconColor: room.iconColor,
      nameColor: room.nameColor,
      exits,
      enemies: enemyInfo,
      items,
      npcs,
      actions,
      secrets,
    })
  }

  return (
    <div className="flex min-h-screen flex-col fill-surface-canvas">
      <WorldToolNav active="rooms" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-fg-bright">World Atlas</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {nodes.length} rooms laid out across {new Set(nodes.map((n) => n.map)).size} map sheets,
            oriented by their compass exits. Click a room to inspect its enemies, loot, NPCs,
            actions, gates, and secrets.
          </p>
        </header>
        <RoomAtlas nodes={nodes} edges={edges} />
      </div>
    </div>
  )
}
