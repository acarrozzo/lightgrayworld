/**
 * The World tab's map as one surface you zoom: the world's nine regions laid
 * out three by three, each square the region's own sheet of art, and every
 * sheet a square you can zoom into. This module is the part of it with no
 * pixels — which sheet a square shows on which level, which rooms sit where
 * on a sheet, which pins a sheet carries, and the zoom/pan arithmetic — so the
 * component stays a drawing and this stays testable.
 *
 * Geometry is in the art's own units: every sheet is an 800×800 image and a
 * room is a 100×100 cell at its authored top-left corner (room-map-positions).
 * The world is the same idea one level up: the 3×3 grid is drawn on a square
 * stage, so a region's square is exactly a third of it and zooming it ×3 puts
 * its sheet at ×1 — the hand-off from world to sheet is seamless.
 *
 * Pan is kept as a fraction of the stage's side so nothing here needs to know
 * how big the screen is.
 */
import { MAP_CELL_SIZE, MAP_IMAGE_SIZE, ROOM_MAP_COORDS } from '../components/game-interface/room-map-positions'

const { WORLD_REGIONS, VIP_REGIONS, MAP_SHEETS, TELEPORT_HUBS, getMapIdForRoom } = require('./game-data/world-map') as {
  WORLD_REGIONS: AtlasRegion[]
  VIP_REGIONS: AtlasRegion[]
  MAP_SHEETS: AtlasSheet[]
  TELEPORT_HUBS: Array<{ roomId: string; regionId: string; name: string; isSubHub: boolean; unlockedByMembership?: string | null }>
  getMapIdForRoom: (roomId: string) => string
}
const { BOSS_TELEPORTS, getTeleportDestination, isTeleportDestinationOpen } = require('./game-data/teleport-destinations') as {
  BOSS_TELEPORTS: Array<{ slug: string; roomId: string; name: string; level: number; cost: number }>
  getTeleportDestination: (roomId: string) => { roomId: string; name: string; description?: string; cost: number; bossSlug?: string } | null
  isTeleportDestinationOpen: (destination: unknown, discovered: string[], killed: Iterable<string>, memberships: Iterable<string>) => boolean
}

export interface AtlasRegion {
  id: string
  name: string
  color?: string
  hub?: { roomId: string; name: string }
  alwaysOpen?: boolean
}

export interface AtlasSheet {
  id: string
  title: string
  src: string
  region: string
  /** Surface, Underground, Sewers, Mine, Underwater, Upper Level, The Despair. */
  level: string
  /** The User column that records the sheet as found. */
  flag: string
}

/** Which layer of the world the zoomed-out view shows: the original's "Swap level". */
export type AtlasLevel = 'surface' | 'below'

/** Zoomed out to the nine regions, or into one sheet. */
export type AtlasDepth = 'world' | 'sheet'

export const ATLAS_GRID: AtlasRegion[] = WORLD_REGIONS
export const ATLAS_VIP: AtlasRegion[] = VIP_REGIONS
export const ATLAS_SHEETS: AtlasSheet[] = MAP_SHEETS

const SHEETS_BY_ID = new Map(MAP_SHEETS.map((sheet) => [sheet.id, sheet]))
const REGIONS_BY_ID = new Map([...WORLD_REGIONS, ...VIP_REGIONS].map((region) => [region.id, region]))

export const getAtlasSheet = (sheetId: string): AtlasSheet | null => SHEETS_BY_ID.get(sheetId) ?? null
export const getAtlasRegion = (regionId: string): AtlasRegion | null => REGIONS_BY_ID.get(regionId) ?? null
export const regionOfSheet = (sheetId: string): string | null => SHEETS_BY_ID.get(sheetId)?.region ?? null
export const isVipRegion = (regionId: string | null | undefined): boolean => !!regionId && VIP_REGIONS.some((r) => r.id === regionId)
export const sheetForRoom = (roomId: string): string => getMapIdForRoom(roomId)

/**
 * How deep a sheet sits, for ordering a region's levels top to bottom: the
 * Dark Forest's tree tops above its surface, the mine and the Despair below
 * the undergrounds they open from.
 */
const DEPTH: Record<string, number> = {
  'Upper Level': -1,
  Surface: 0,
  Underground: 1,
  Sewers: 1,
  Underwater: 1,
  Mine: 2,
  'The Despair': 2,
}
export const sheetDepth = (sheetId: string): number => DEPTH[SHEETS_BY_ID.get(sheetId)?.level ?? 'Surface'] ?? 1

/** The world layer a sheet belongs to: its surface, or what lies off it. */
export const levelOfSheet = (sheetId: string): AtlasLevel => (sheetDepth(sheetId) === 0 ? 'surface' : 'below')

/**
 * A region's sheets the player has found, top to bottom. These are the only
 * levels the level control offers, so it never hints at a mine not yet found.
 */
export function foundLevels(regionId: string, foundMapIds: readonly string[]): string[] {
  return MAP_SHEETS.filter((sheet) => sheet.region === regionId && foundMapIds.includes(sheet.id))
    .map((sheet) => sheet.id)
    .sort((a, b) => sheetDepth(a) - sheetDepth(b))
}

export type RegionTile = { state: 'open'; sheetId: string } | { state: 'locked' } | { state: 'none' }

/**
 * What a region's square shows on a layer. Below, a region with lower sheets
 * shows `preferSheetId` when it is one of them (the sheet under the player's
 * feet, or the one just zoomed out of), else the nearest found below the
 * surface (the mine sits under the underground, the tree tops last). A region
 * with sheets but none on this layer says so ("Nothing below"); a region with
 * nothing found, or no sheets at all, is "Not found yet" — no artwork, no
 * spoilers.
 */
export function regionTile(regionId: string, level: AtlasLevel, foundMapIds: readonly string[], preferSheetId: string | null): RegionTile {
  const sheets = MAP_SHEETS.filter((sheet) => sheet.region === regionId)
  if (sheets.length === 0) return { state: 'locked' }
  const layer = sheets
    .filter((sheet) => (level === 'surface' ? sheetDepth(sheet.id) === 0 : sheetDepth(sheet.id) !== 0))
    .sort((a, b) => rankBelow(sheetDepth(a.id)) - rankBelow(sheetDepth(b.id)))
  if (layer.length === 0) return { state: 'none' }
  const found = layer.filter((sheet) => foundMapIds.includes(sheet.id))
  if (found.length === 0) return { state: 'locked' }
  const preferred = found.find((sheet) => sheet.id === preferSheetId)
  return { state: 'open', sheetId: (preferred ?? found[0]).id }
}
/** Below the surface first, deepest last; above the surface after all of them. */
const rankBelow = (depth: number) => (depth < 0 ? 10 - depth : depth)

/**
 * Sheet ids a player has found, from the flags on their row, plus the sheet
 * under their feet (the arrival unlock is written a beat after the move, and
 * the compass already shows that artwork anyway). In world order.
 */
export function foundSheetIds(flags: object | null | undefined, currentRoomId?: string | null): string[] {
  const row = (flags ?? {}) as Record<string, unknown>
  const here = currentRoomId ? getMapIdForRoom(currentRoomId) : null
  return MAP_SHEETS.filter((sheet) => sheet.id === here || !!row[sheet.flag]).map((sheet) => sheet.id)
}

/** The region square under a point of the world stage, as a 0..1 fraction. */
export function tileIndexAt(fx: number, fy: number): number | null {
  if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return null
  return Math.floor(fy * 3) * 3 + Math.floor(fx * 3)
}

export type AtlasDirection = 'up' | 'down' | 'left' | 'right'

/**
 * The region square beside this one on the 3×3, or null past the world's
 * edge: up from the Grassy Field is the Mountains, left is the Blue Ocean.
 */
export function neighbourIndex(index: number, dir: AtlasDirection): number | null {
  const col = (index % 3) + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)
  const row = Math.floor(index / 3) + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0)
  if (col < 0 || col > 2 || row < 0 || row > 2) return null
  return row * 3 + col
}

/** Where a point of a sheet sits on the world stage, given the region's square. */
export function worldPointFor(index: number, sheetFx: number, sheetFy: number): { x: number; y: number } {
  const col = index % 3
  const row = Math.floor(index / 3)
  return { x: (col + sheetFx) / 3, y: (row + sheetFy) / 3 }
}

// --- Rooms on a sheet ---------------------------------------------------------

export interface AtlasRoom {
  id: string
  /** Top-left of the room's cell, in art pixels. */
  x: number
  y: number
}

/**
 * Sheets drawn as a single tile in the middle rather than a plan: the
 * Plane of Rebirth, the Solar Office and the Neverending Mine (whose thirty
 * levels share one picture). The centre cell stands for whichever room of
 * the sheet you are in, or the sheet's only room.
 */
const CENTRED_SHEET_ROOM: Record<string, string | null> = { lobby: '999', 'solar-office': '088', 'neverending-mine': null }
const CENTRE = (MAP_IMAGE_SIZE - MAP_CELL_SIZE) / 2

const roomsCache = new Map<string, AtlasRoom[]>()

/** Every room with an authored cell on this sheet. */
export function roomsOnSheet(sheetId: string): AtlasRoom[] {
  const cached = roomsCache.get(sheetId)
  if (cached) return cached
  const rooms = Object.entries(ROOM_MAP_COORDS)
    .filter(([id]) => getMapIdForRoom(id) === sheetId)
    .map(([id, { x, y }]) => ({ id, x, y }))
  roomsCache.set(sheetId, rooms)
  return rooms
}

/** A room's cell on its sheet, or null when it has no place drawn. */
export function roomCell(sheetId: string, roomId: string, hereRoomId?: string | null): AtlasRoom | null {
  const authored = ROOM_MAP_COORDS[roomId]
  if (authored && getMapIdForRoom(roomId) === sheetId) return { id: roomId, x: authored.x, y: authored.y }
  if (sheetId in CENTRED_SHEET_ROOM && getMapIdForRoom(roomId) === sheetId) {
    const only = CENTRED_SHEET_ROOM[sheetId]
    if (roomId === only || roomId === hereRoomId) return { id: roomId, x: CENTRE, y: CENTRE }
  }
  return null
}

/** The room whose cell holds this point of the sheet (art pixels), or null. */
export function roomAt(sheetId: string, u: number, v: number, hereRoomId?: string | null): string | null {
  const inCell = (x: number, y: number) => u >= x && u < x + MAP_CELL_SIZE && v >= y && v < y + MAP_CELL_SIZE
  const hit = roomsOnSheet(sheetId).find((room) => inCell(room.x, room.y))
  if (hit) return hit.id
  if (sheetId in CENTRED_SHEET_ROOM && inCell(CENTRE, CENTRE)) {
    const here = hereRoomId && getMapIdForRoom(hereRoomId) === sheetId ? hereRoomId : null
    return here ?? CENTRED_SHEET_ROOM[sheetId] ?? null
  }
  return null
}

/** A cell's centre as a 0..1 fraction of the sheet. */
export const cellCentre = (cell: AtlasRoom) => ({
  x: (cell.x + MAP_CELL_SIZE / 2) / MAP_IMAGE_SIZE,
  y: (cell.y + MAP_CELL_SIZE / 2) / MAP_IMAGE_SIZE,
})
export const CELL_FRACTION = MAP_CELL_SIZE / MAP_IMAGE_SIZE
export const ART_SIZE = MAP_IMAGE_SIZE

// --- Teleport landings --------------------------------------------------------

export interface TeleportContext {
  discoveredTeleports: string[]
  /** Enemy slugs the player has killed at least once. */
  killedSlugs: string[]
  /** Faction ids of the guilds the player belongs to. */
  memberships: string[]
}

export interface AtlasLanding {
  roomId: string
  kind: 'landing' | 'boss'
  /** "Grand Square", "Warrior's Guild", "Master Thief". */
  name: string
  cost: number
  /** Bosses only. */
  level?: number
  /** A guild hall, open by membership. */
  guild?: boolean
}

/**
 * The open teleport behind a room, by the same rule the server applies
 * (`isTeleportDestinationOpen`): a hub you have found, a guild hall you
 * belong to, a VIP room, or the lair of a boss you have beaten.
 */
export function openLandingAt(roomId: string, ctx: TeleportContext): AtlasLanding | null {
  const destination = getTeleportDestination(roomId)
  if (!destination || !isTeleportDestinationOpen(destination, ctx.discoveredTeleports, ctx.killedSlugs, ctx.memberships)) return null
  if (destination.bossSlug) {
    const boss = BOSS_TELEPORTS.find((entry) => entry.slug === destination.bossSlug)
    return { roomId, kind: 'boss', name: boss?.name ?? destination.name, cost: destination.cost, level: boss?.level }
  }
  const hub = TELEPORT_HUBS.find((entry) => entry.roomId === roomId)
  return { roomId, kind: 'landing', name: hub?.name ?? destination.description ?? destination.name, cost: destination.cost, guild: !!hub?.unlockedByMembership }
}

/** Every open landing and beaten lair drawn on a sheet, in that order. */
export function landingsOnSheet(sheetId: string, ctx: TeleportContext): AtlasLanding[] {
  const rooms = new Set<string>()
  for (const hub of TELEPORT_HUBS) if (getMapIdForRoom(hub.roomId) === sheetId) rooms.add(hub.roomId)
  for (const boss of BOSS_TELEPORTS) if (getMapIdForRoom(boss.roomId) === sheetId) rooms.add(boss.roomId)
  const open = Array.from(rooms)
    .map((roomId) => openLandingAt(roomId, ctx))
    .filter((landing): landing is AtlasLanding => !!landing)
  return [...open.filter((l) => l.kind === 'landing'), ...open.filter((l) => l.kind === 'boss').sort((a, b) => (a.level ?? 0) - (b.level ?? 0))]
}

// --- Zoom and pan -------------------------------------------------------------

export interface AtlasCamera {
  /** 1 fits the stage. */
  z: number
  /** Offset of the art's centre from the stage's, as a fraction of the stage side. */
  px: number
  py: number
}

export const ZOOM_STEPS = [1, 1.6, 2.4, 3.2] as const
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]
/** How close in "Here" brings your room. */
export const HERE_ZOOM = 2.4
export const FIT: AtlasCamera = { z: 1, px: 0, py: 0 }

/** Keep the art covering the stage: no panning past its edges. */
export function clampCamera(cam: AtlasCamera): AtlasCamera {
  const z = Math.min(MAX_ZOOM, Math.max(1, cam.z))
  const lim = (z - 1) / 2
  // `|| 0` folds -0 into 0, so a camera at rest compares equal to FIT.
  return { z, px: Math.max(-lim, Math.min(lim, cam.px)) || 0, py: Math.max(-lim, Math.min(lim, cam.py)) || 0 }
}

/**
 * Zoom to `z` keeping one point of the art still: `focal` is that point as a
 * 0..1 fraction of the art, or the stage's centre when omitted.
 */
export function zoomCamera(cam: AtlasCamera, z: number, focal?: { x: number; y: number }): AtlasCamera {
  const nz = Math.min(MAX_ZOOM, Math.max(1, z))
  if (focal) {
    return clampCamera({ z: nz, px: (focal.x - 0.5) * (cam.z - nz) + cam.px, py: (focal.y - 0.5) * (cam.z - nz) + cam.py })
  }
  return clampCamera({ z: nz, px: (cam.px * nz) / cam.z, py: (cam.py * nz) / cam.z })
}

/** Centre a point of the art (0..1) at zoom `z`, as near as the edges allow. */
export function centreOn(point: { x: number; y: number }, z: number): AtlasCamera {
  return clampCamera({ z, px: -(point.x - 0.5) * z, py: -(point.y - 0.5) * z })
}

/** The next zoom step in or out from wherever the camera is. */
export function stepZoom(z: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((step) => step > z + 0.01) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((step) => step < z - 0.01) ?? 1
}

/** The camera that puts one region's square exactly over the stage: ×3, centred on it. */
export function tileCamera(index: number): AtlasCamera {
  const col = index % 3
  const row = Math.floor(index / 3)
  return clampCamera({ z: 3, px: -((col + 0.5) / 3 - 0.5) * 3, py: -((row + 0.5) / 3 - 0.5) * 3 })
}

/** A point of the art (0..1) under a screen point, given the art's on-screen box. */
export function artPointAt(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }) {
  return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height }
}
