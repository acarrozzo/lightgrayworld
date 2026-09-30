'use client'

import { Map as MapIcon, Shield, Sparkles, Swords, type LucideIcon } from 'lucide-react'

const { TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations')

/** What a dock tile opens: the two World tabs, the Gear layer, the Action layer. */
export type DockLayer = 'map' | 'teleport' | 'gear' | 'action'

interface DockProps {
  /** A row under the D-pad (desktop) or a column beside it (the phone strip). */
  variant: 'row' | 'column'
  /** The layer that is open right now, so its tile reads pressed. */
  active?: DockLayer | null
  onOpen: (layer: DockLayer) => void
  teleportDisabled?: boolean
  mapTitle?: string | null
  className?: string
}

const TILES: Array<{ id: DockLayer; label: string; icon: LucideIcon; fill: string }> = [
  { id: 'map', label: 'Map', icon: MapIcon, fill: 'fill-hue-sky' },
  { id: 'teleport', label: 'Tele', icon: Sparkles, fill: 'fill-resource-mp' },
  { id: 'gear', label: 'Gear', icon: Shield, fill: 'fill-hue-green' },
  { id: 'action', label: 'Action', icon: Swords, fill: 'fill-action-attack' },
]

/**
 * The dock: Map, Teleport, Gear and Action as four labelled tiles, each filled in
 * the colour of what it opens so the tile and its layer agree without the
 * label doing the work. Every tile opens a view; none of them moves the
 * player, which is what keeps them apart from the D-pad's exits.
 */
export default function Dock({ variant, active = null, onOpen, teleportDisabled = false, mapTitle = null, className = '' }: DockProps) {
  const isRow = variant === 'row'
  const titleFor = (id: DockLayer) => {
    switch (id) {
      case 'map': return mapTitle ? `Map — ${mapTitle}` : 'Map'
      case 'teleport': return `Teleport — ${TELEPORT_MP_COST} MP`
      case 'gear': return 'Gear — what you are wearing'
      case 'action': return 'Action — attack, strikes, spells and items'
    }
  }
  return (
    <div className={`${isRow ? 'flex items-center justify-center gap-2' : 'flex flex-col items-center gap-1.5'} ${className}`} role="toolbar" aria-label="Map, Teleport, Gear and Action">
      {TILES.map(({ id, label, icon: TileIcon, fill }) => {
        const isActive = active === id
        const disabled = id === 'teleport' && teleportDisabled
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={titleFor(id)}
            title={titleFor(id)}
            className={`${fill} flex flex-col items-center justify-center font-semibold uppercase tracking-widest border border-fg-bright/10 shadow-sm shadow-shadow transition-all duration-200 hover:brightness-110 hover:border-fg-bright/20 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              isRow ? 'w-16 h-12 rounded-lg gap-1 text-[9px]' : 'w-11 h-10 rounded-md gap-0.5 text-[7px]'
            } ${isActive ? 'ring-2 ring-line-focus brightness-110' : ''}`}
          >
            <TileIcon className={isRow ? 'h-[18px] w-[18px]' : 'h-[15px] w-[15px]'} strokeWidth={2.2} aria-hidden="true" />
            <span aria-hidden="true">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
