'use client'

import { useEffect, useRef, useState } from 'react'
import type { EnemyTrait } from '@/lib/socket'

// The enemy's tag row — the original HUD's coloured "buffBox" strip (Pow,
// Bite, Crit, Rage, Flying, Mag Imm…) under the enemy's stats. Shown on the
// room card before you engage and in the battle header while you fight.
//
// Each trait carries a semantic tone rather than a colour; this is the one
// place tones become theme classes. Perks share the crit tone the damage
// number already uses when one fires, so the tag that lights up (`activeId`)
// reads as the same event.
//
// Each tag explains itself on demand. A native `title` only shows after the
// browser's hover delay and never on touch, so the rule is a small popover of
// our own: it opens on hover or on tap, and closes on leave, outside tap, or
// Escape. One popover at a time across the row.

const TONE_CLASSES: Record<EnemyTrait['tone'], string> = {
  crit: 'text-combat-crit border-combat-crit/50 bg-combat-crit/10',
  poison: 'text-hue-green border-hue-green/50 bg-hue-green/10',
  sky: 'text-hue-sky border-hue-sky/50 bg-hue-sky/10',
  str: 'text-stat-str border-stat-str/50 bg-stat-str/10',
  dex: 'text-stat-dex border-stat-dex/50 bg-stat-dex/10',
  mag: 'text-stat-mag border-stat-mag/50 bg-stat-mag/10',
}

const TONE_TEXT: Record<EnemyTrait['tone'], string> = {
  crit: 'text-combat-crit',
  poison: 'text-hue-green',
  sky: 'text-hue-sky',
  str: 'text-stat-str',
  dex: 'text-stat-dex',
  mag: 'text-stat-mag',
}

interface EnemyTraitTagsProps {
  traits: EnemyTrait[]
  /** The trait that fired this turn (a special's id): its tag glows. */
  activeId?: string | null
  /** Which edge the rule popover hangs from: the row's start or its end. */
  align?: 'start' | 'end'
  className?: string
}

export default function EnemyTraitTags({ traits, activeId = null, align = 'start', className }: EnemyTraitTagsProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rowRef = useRef<HTMLSpanElement>(null)

  // A tap elsewhere, or Escape, closes an open rule.
  useEffect(() => {
    if (!openId) return
    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpenId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openId])

  if (traits.length === 0) return null

  const open = traits.find((t) => t.id === openId) ?? null

  return (
    <span ref={rowRef} className={`relative inline-flex flex-wrap items-center gap-1 ${className ?? ''}`}>
      {traits.map((trait) => {
        const active = activeId === trait.id
        const isOpen = openId === trait.id
        return (
          <button
            key={trait.id}
            type="button"
            aria-label={`${trait.label}: ${trait.title}`}
            aria-expanded={isOpen}
            onClick={() => setOpenId(isOpen ? null : trait.id)}
            onMouseEnter={() => setOpenId(trait.id)}
            onMouseLeave={() => setOpenId((cur) => (cur === trait.id ? null : cur))}
            className={`inline-flex items-center rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wider leading-none whitespace-nowrap cursor-help transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${TONE_CLASSES[trait.tone]} ${active ? 'border-combat-crit bg-combat-crit/25 animate-pulse' : ''} ${isOpen && !active ? 'brightness-125' : ''}`}
            style={active ? { textShadow: '0 0 10px color-mix(in srgb, var(--combat-crit) 60%, transparent)', boxShadow: '0 0 10px color-mix(in srgb, var(--combat-crit) 45%, transparent)' } : undefined}
          >
            {trait.label}
          </button>
        )
      })}

      {open && (
        <span
          role="tooltip"
          className={`absolute top-full mt-1.5 z-30 w-56 max-w-[70vw] rounded-md border border-line-strong/70 bg-surface-panel px-2.5 py-2 text-left shadow-lg shadow-shadow/40 normal-case tracking-normal ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          <span className={`block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${TONE_TEXT[open.tone]}`}>{open.label}</span>
          <span className="block text-[11px] leading-snug text-fg-secondary">{open.title}</span>
        </span>
      )}
    </span>
  )
}
