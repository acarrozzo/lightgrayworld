'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Player, useGameStore } from '@/lib/game-state'
import Icon from './Icon'
import {
  buildSpellbook,
  effectiveMag,
  spellTone,
  SPELL_SCHOOLS,
  type SpellbookEntry,
} from '@/lib/spellbook'

interface SpellbookModalProps {
  isOpen: boolean
  player: Player | null
  /** Casting from the book: heals work anywhere, attack spells need a fight. */
  inBattle: boolean
  onClose: () => void
  onLearned: (updatedPlayer: Player) => void
  onCast: (spellId: string) => void
}

/**
 * The Spells tab of the original, as a modal: every spell in the registry,
 * grouped by school, with level/cap, the SP to learn the next level, the MP to
 * cast, and where to find a better teacher. Learning is a PUT to
 * /api/user/spells (the server owns caps and costs); casting hands off to the
 * game action pipeline.
 */
export default function SpellbookModal({ isOpen, player, inBattle, onClose, onLearned, onCast }: SpellbookModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const [mounted, setMounted] = useState(false)
  const [busySpell, setBusySpell] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setNotice(null)
      setBusySpell(null)
    }
  }, [isOpen])

  if (!mounted || !isOpen || !player) return null

  const entries = buildSpellbook(player)
  const sp = player.sp ?? 0
  const mag = effectiveMag(player)
  const mp = player.mp ?? 0
  const hp = player.hp ?? 0
  const hpMax = player.hpMax ?? 0

  const learn = async (entry: SpellbookEntry, mode: 'one' | 'max') => {
    if (busySpell) return
    setBusySpell(entry.def.id)
    setNotice(null)
    try {
      const response = await fetch('/api/user/spells', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ spellId: entry.def.id, mode }),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.player) onLearned(data.player as Player)
      if (!response.ok || data?.success === false) {
        setNotice({ tone: 'error', text: data?.message || 'Could not learn that spell.' })
      } else {
        setNotice({ tone: 'ok', text: data?.message || `${entry.def.name} learned.` })
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not learn that spell.' })
    } finally {
      setBusySpell(null)
    }
  }

  const castDisabledReason = (entry: SpellbookEntry): string | null => {
    if (!entry.castable) return null
    if (entry.def.kind === 'attack' && !inBattle) return 'Needs a target — cast it in a fight'
    if (entry.def.kind === 'heal' && hp >= hpMax) return 'Already at full health'
    if (mp < entry.castCost) return `Not enough MP (${entry.castCost} needed)`
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 p-4 sm:p-6 lg:p-10">
      <div className="absolute inset-0 bg-surface-sunken/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-full bg-surface-panel/95 border border-line-subtle/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-subtle/50">
          <div>
            <h3 className="text-lg font-semibold text-fg-bright">Spellbook</h3>
            <p className="text-xs text-fg-secondary mt-0.5">
              Spend SP to learn and upgrade spells. Spells consume MP to cast. Find better teachers to raise the caps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-fg-secondary hover:text-fg-bright transition-colors p-1.5 rounded hover:bg-surface-raised"
            disabled={Boolean(busySpell)}
          >
            <span className="sr-only">Close</span>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="bg-surface-panel/70 border border-line-subtle rounded-2xl px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-mood-arcane/80 mb-1">Skill Points</p>
              <h4 className="text-3xl font-semibold text-fg-bright">{sp} SP</h4>
            </div>
            <div className="text-sm text-fg-secondary">
              <span className="text-stat-mag font-semibold">{mag} MAG</span> drives every roll ·{' '}
              <span className="text-resource-mp font-semibold">{mp}/{player.mpMax ?? 0} MP</span>
            </div>
          </div>

          {notice && (
            <div
              className={`rounded-2xl p-4 border ${
                notice.tone === 'ok'
                  ? 'bg-status-success/20 border-status-success/50'
                  : 'bg-status-error/30 border-status-error/50'
              }`}
            >
              <p className={`text-sm ${notice.tone === 'ok' ? 'text-status-success' : 'text-status-error'}`}>{notice.text}</p>
            </div>
          )}

          {SPELL_SCHOOLS.map((school) => {
            const rows = entries.filter((entry) => entry.def.school === school.id)
            if (rows.length === 0) return null
            return (
              <section key={school.id} className="bg-surface-panel/70 border border-line-subtle rounded-2xl p-4 sm:p-6">
                <div className="mb-3">
                  <h4 className="text-base font-semibold text-fg-bright">{school.name}</h4>
                  <p className="text-xs text-fg-secondary">{school.blurb}</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {rows.map((entry) => (
                    <SpellCard
                      key={entry.def.id}
                      entry={entry}
                      sp={sp}
                      busy={busySpell === entry.def.id}
                      anyBusy={Boolean(busySpell)}
                      castDisabledReason={castDisabledReason(entry)}
                      onLearn={(mode) => learn(entry, mode)}
                      onCast={() => onCast(entry.def.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-line-subtle/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm font-medium text-fg-primary hover:text-fg-bright hover:bg-surface-raised transition-colors"
            disabled={Boolean(busySpell)}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface SpellCardProps {
  entry: SpellbookEntry
  sp: number
  busy: boolean
  anyBusy: boolean
  castDisabledReason: string | null
  onLearn: (mode: 'one' | 'max') => void
  onCast: () => void
}

function SpellCard({ entry, sp, busy, anyBusy, castDisabledReason, onLearn, onCast }: SpellCardProps) {
  const { def, level, maxLevel, nextLearnCost, castCost, preview, castable, teachers } = entry
  const tone = spellTone(def.hue)
  const locked = maxLevel <= 0
  const atMax = !locked && level >= maxLevel
  const canAfford = nextLearnCost !== null && sp >= nextLearnCost
  const learned = level >= 1
  const comingSoon = learned && !def.implemented

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex gap-3 ${
        locked ? 'border-line-subtle/60 bg-surface-panel/40 opacity-70' : `${tone.border}/40 bg-surface-panel/80`
      }`}
    >
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
        <Icon name={def.icon} size={40} className={locked ? 'text-fg-disabled' : tone.text} />
        <span className={`text-xs font-bold tabular-nums ${atMax ? 'text-resource-gold' : locked ? 'text-fg-disabled' : tone.text}`}>
          {locked ? '—' : `${level}/${maxLevel}`}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-semibold ${atMax ? 'text-resource-gold' : locked ? 'text-fg-secondary' : 'text-fg-bright'}`}>
            {def.name}
            {atMax && <span className="ml-1 text-[10px] uppercase tracking-wider text-resource-gold/80">max</span>}
          </p>
          {!locked && (
            <span className="text-xs text-resource-mp tabular-nums whitespace-nowrap">{castCost} MP</span>
          )}
        </div>
        <p className="text-xs text-fg-secondary mt-0.5">{def.description}</p>

        {!locked && preview && (
          <p className="text-[11px] text-fg-muted mt-1 tabular-nums">
            {def.kind === 'heal' ? 'Heals' : 'Hits'} {preview.min}–{preview.max}
            <span className="text-fg-disabled"> · {preview.text}</span>
            {level === 0 && <span className="text-fg-disabled"> at level 1</span>}
          </p>
        )}
        {locked && (
          <p className="text-[11px] text-fg-muted mt-1">{def.formula}</p>
        )}

        <p className="text-[11px] text-fg-muted mt-1">
          <span className="text-fg-disabled">Teachers: </span>
          {teachers.map((t, i) => (
            <span key={t.flag}>
              {i > 0 && <span className="text-fg-disabled"> · </span>}
              <span className={t.met ? 'text-status-success' : 'text-fg-muted'}>
                {t.name} <span className="tabular-nums">{t.max}</span>
              </span>
            </span>
          ))}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {locked ? (
            <span className="text-[11px] italic text-fg-disabled">Find a teacher to unlock</span>
          ) : atMax ? (
            <span className="text-[11px] italic text-resource-gold/80">Search for more advanced teachers</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onLearn('one')}
                disabled={!canAfford || anyBusy}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tone.fill}`}
                title={nextLearnCost !== null ? `${nextLearnCost} SP` : undefined}
              >
                {busy ? '…' : `+1 (${nextLearnCost} SP)`}
              </button>
              {maxLevel - level > 1 && (
                <button
                  type="button"
                  onClick={() => onLearn('max')}
                  disabled={!canAfford || anyBusy}
                  className="px-2.5 py-1 rounded text-xs font-semibold border border-line-subtle text-fg-primary hover:bg-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Max
                </button>
              )}
            </>
          )}

          {castable && (
            <button
              type="button"
              onClick={onCast}
              disabled={Boolean(castDisabledReason) || anyBusy}
              title={castDisabledReason ?? `Cast ${def.name}`}
              className="ml-auto px-2.5 py-1 rounded text-xs font-semibold fill-accent hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cast
            </button>
          )}
          {comingSoon && (
            <span className="ml-auto text-[11px] italic text-fg-disabled">Not castable yet</span>
          )}
        </div>
      </div>
    </div>
  )
}
