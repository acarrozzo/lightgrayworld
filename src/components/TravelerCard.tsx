'use client'

import { useState } from 'react'
import type { TravelerView } from '@/lib/types/room'

interface TravelerCardProps {
  traveler: TravelerView
  onAction: (action: string | { type: string; data?: any }) => void | Promise<void>
  isInBattle?: boolean
  isLoadingRoom?: boolean
}

/**
 * Someone passing through: the bunny, Sherman, Wendell's cart. Shares the
 * enemy card's shape so the room panel reads as one list of who is here.
 *
 * The traveler's own actions sit on the right and wrap under the name on a
 * narrow screen. Attacking one that can be fought is deliberately not a front
 * button: it lives behind a small "more" toggle, so the field's bunny is
 * something you watch first and hunt only on purpose. The description opens on
 * tap, because hover is not a thing on a phone.
 */
export default function TravelerCard({ traveler, onAction, isInBattle = false, isLoadingRoom = false }: TravelerCardProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const fullName = traveler.title ? `${traveler.name} ${traveler.title}` : traveler.name
  const enemy = traveler.enemy

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-subtle/30 bg-surface-raised/30 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setDescOpen((open) => !open)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-expanded={descOpen}
        title={descOpen ? 'Hide description' : 'Show description'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG silhouette, same as the enemy card */}
        <img
          src={traveler.iconFile}
          alt={traveler.name}
          className="w-12 h-12 shrink-0 object-contain brightness-0 invert"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate text-fg-bright">{fullName}</span>
            <span className="text-[10px] text-fg-muted bg-surface-raised/60 px-1 rounded shrink-0">
              {traveler.kind === 'creature' ? 'passing through' : 'traveler'}
            </span>
          </span>
          {enemy ? (
            <span className="flex items-center gap-2.5 text-xs mt-0.5">
              <span className="text-fg-bright font-bold text-sm">Lv. {enemy.level}</span>
              <span className="text-fg-disabled">·</span>
              <span className="text-fg-muted">HP <span className="font-semibold text-terrain-grass">{enemy.hp}</span></span>
              <span className="text-fg-muted">ATT <span className="font-semibold text-enemy-hostile">{enemy.att}</span></span>
              <span className="text-fg-muted">DEF <span className="font-semibold text-resource-gold">{enemy.def}</span></span>
            </span>
          ) : (
            <span className="block text-xs text-fg-muted mt-0.5 truncate">{traveler.description}</span>
          )}
        </span>
      </button>

      <div className="flex basis-full items-center justify-end gap-1.5 sm:basis-auto">
        {traveler.actions.map((a) => (
          <button
            key={a.action}
            onClick={() => onAction(a.action)}
            disabled={isLoadingRoom}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 shadow-sm active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${a.className || 'fill-accent'}`}
          >
            {a.label}
          </button>
        ))}
        {enemy && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title="More"
              className="px-2 py-1.5 text-xs font-bold rounded-md border border-line-subtle/40 bg-surface-raised/60 text-fg-muted hover:text-fg-bright transition-colors"
            >
              •••
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] rounded-md border border-line-subtle/40 bg-surface-panel p-1 shadow-lg"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false)
                    onAction({ type: 'start_battle', data: { enemySlug: enemy.slug } })
                  }}
                  disabled={isInBattle || isLoadingRoom}
                  title={isInBattle ? 'You are already in combat' : `Attack the ${enemy.name}`}
                  className="w-full px-3 py-1.5 text-left text-xs font-semibold fill-action-attack rounded disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Attack the {enemy.name}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {descOpen && (
        <p className="basis-full text-xs leading-relaxed text-fg-secondary">{traveler.description}</p>
      )}
    </div>
  )
}
