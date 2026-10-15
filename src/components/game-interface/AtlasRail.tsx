'use client'

import { Crown, Globe, Sparkles } from 'lucide-react'
import {
  ATLAS_GRID,
  ATLAS_VIP,
  foundLevels,
  getAtlasRegion,
  getAtlasSheet,
  isVipRegion,
  landingsOnSheet,
  regionOfSheet,
  regionTile,
  sheetForRoom,
  type TeleportContext,
} from '@/lib/world-atlas'
import type { AtlasCommand, AtlasView } from './WorldAtlas'

interface AtlasRailProps {
  view: AtlasView
  currentRoomId?: string
  foundMapIds: string[]
  teleport: TeleportContext
  playerMp: number
  blockedReason: string | null
  onCommand: (command: AtlasCommand) => void
  onTeleport: (roomId: string) => void
}

const HEADING_BASE = 'mb-1.5 font-mono text-[10px] uppercase tracking-widest'
const HEADING = `${HEADING_BASE} text-fg-muted`
const ROW_BUTTON =
  'flex h-8 w-full items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/**
 * The left rail of the full-screen map, where there is width for it: the
 * world in miniature (one square per region, its surface art once found),
 * the open region's levels, what on this sheet you can teleport to, and the
 * VIP rooms. Everything here is a way to move the map or a teleport; the map
 * beside it stays the one place things are drawn.
 */
export default function AtlasRail({ view, currentRoomId, foundMapIds, teleport, playerMp, blockedReason, onCommand, onTeleport }: AtlasRailProps) {
  const hereSheet = currentRoomId ? sheetForRoom(currentRoomId) : null
  const hereRegion = hereSheet ? regionOfSheet(hereSheet) : null
  const regionId = regionOfSheet(view.sheetId)
  const region = regionId ? getAtlasRegion(regionId) : null
  const onSheet = view.depth === 'sheet'
  const landings = onSheet ? landingsOnSheet(view.sheetId, teleport) : []
  const levels = onSheet && regionId && !isVipRegion(regionId) ? foundLevels(regionId, foundMapIds) : []
  const vip = ATLAS_VIP.filter((r) => foundMapIds.includes(r.id))

  return (
    <aside className="flex w-[252px] flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-line-subtle/60 bg-surface-sunken/70 p-3" aria-label="Places">
      <section>
        <div className="flex items-center justify-between">
          <h2 className={HEADING}>World</h2>
          <button
            type="button"
            onClick={() => onCommand({ type: 'world', level: view.level })}
            disabled={!onSheet}
            className="mb-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-hue-sky hover:bg-surface-raised/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:text-fg-disabled disabled:hover:bg-transparent"
          >
            <Globe size={12} aria-hidden="true" />
            Zoom out
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {ATLAS_GRID.map((r) => {
            const tile = regionTile(r.id, 'surface', foundMapIds, null)
            const found = foundLevels(r.id, foundMapIds).length > 0
            const isCurrent = onSheet && r.id === regionId
            const art = tile.state === 'open' ? getAtlasSheet(tile.sheetId) : null
            return (
              <button
                key={r.id}
                type="button"
                disabled={!found}
                onClick={() => onCommand({ type: 'region', regionId: r.id })}
                aria-label={found ? r.name : `${r.name}: not found yet`}
                aria-pressed={isCurrent}
                title={found ? r.name : `${r.name}: not found yet`}
                className={`relative aspect-square overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                  found ? 'bg-surface-raised hover:brightness-110' : 'cursor-not-allowed border border-dashed border-line-strong/70'
                } ${isCurrent ? 'ring-2 ring-hue-sky ring-offset-2 ring-offset-surface-sunken' : ''}`}
              >
                {art ? (
                  <img src={art.src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center px-0.5 text-center text-[9px] leading-tight text-fg-disabled">{found ? r.name : '?'}</span>
                )}
                {r.id === hereRegion && (
                  <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-line-subtle bg-resource-gold" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* The region's levels, when it has more than one found; on the world, the layer. */}
      {onSheet ? (
        levels.length > 1 && (
          <section>
            <h2 className={HEADING}>{region?.name}</h2>
            <div className="flex flex-col gap-1">
              {levels.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onCommand({ type: 'sheet', sheetId: id })}
                  aria-pressed={id === view.sheetId}
                  className={`${ROW_BUTTON} ${id === view.sheetId ? 'border-hue-sky bg-hue-sky/10 text-hue-sky' : 'border-line-strong text-fg-secondary hover:bg-surface-raised/50'}`}
                >
                  {getAtlasSheet(id)?.level}
                  {id === hereSheet && <span className="text-[10px] text-resource-gold">● you</span>}
                </button>
              ))}
            </div>
          </section>
        )
      ) : (
        <section>
          <h2 className={HEADING}>Level</h2>
          <div className="flex flex-col gap-1">
            {(['surface', 'below'] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => onCommand({ type: 'level', level: lv })}
                aria-pressed={view.level === lv}
                className={`${ROW_BUTTON} ${view.level === lv ? 'border-hue-sky bg-hue-sky/10 text-hue-sky' : 'border-line-strong text-fg-secondary hover:bg-surface-raised/50'}`}
              >
                {lv === 'surface' ? 'Surface' : 'Below'}
              </button>
            ))}
          </div>
        </section>
      )}

      {onSheet && (
        <section>
          <h2 className={HEADING}>On this sheet</h2>
          {landings.length === 0 ? (
            <p className="text-[11px] text-fg-muted">No landing you can teleport to.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {landings.map((landing) => {
                const isHere = landing.roomId === currentRoomId
                const reason = isHere ? 'Here' : blockedReason ?? (playerMp < landing.cost ? 'Not enough MP' : null)
                return (
                  <li key={landing.roomId} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-raised/40">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${landing.kind === 'boss' ? 'fill-hue-purple' : 'fill-resource-mp'}`} aria-hidden="true">
                      {landing.kind === 'boss' ? <Crown size={12} /> : <Sparkles size={12} />}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCommand({ type: 'focus', roomId: landing.roomId })}
                      className="min-w-0 flex-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                      title="Show it on the map"
                    >
                      <span className="block truncate text-xs text-fg-primary">
                        {landing.name}
                        {landing.kind === 'boss' && <span className="ml-1.5 font-mono text-[10px] text-resource-gold">L{landing.level}</span>}
                      </span>
                      <span className="block text-[10.5px] tabular-nums text-fg-muted">
                        #{landing.roomId} · {landing.cost} MP
                      </span>
                    </button>
                    {isHere ? (
                      <span className="shrink-0 px-1 text-[10.5px] text-resource-gold">Here</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!!reason}
                        onClick={() => onTeleport(landing.roomId)}
                        title={reason ?? `Teleport · ${landing.cost} MP`}
                        className="h-7 shrink-0 rounded-md border border-fg-bright/20 fill-resource-mp px-2 text-[11px] font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Teleport
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {vip.length > 0 && (
        <section>
          <h2 className={`${HEADING_BASE} text-resource-gold/80`}>VIP</h2>
          <div className="flex flex-col gap-0.5">
            {vip.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onCommand({ type: 'sheet', sheetId: r.id })}
                aria-pressed={onSheet && view.sheetId === r.id}
                className={`flex h-8 items-center justify-between rounded-lg px-2 text-left text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                  onSheet && view.sheetId === r.id ? 'bg-hue-sky/10 text-hue-sky' : 'text-fg-secondary hover:bg-surface-raised/50'
                }`}
              >
                {r.name}
                {hereSheet === r.id && <span className="text-[10px] text-resource-gold">● you</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
