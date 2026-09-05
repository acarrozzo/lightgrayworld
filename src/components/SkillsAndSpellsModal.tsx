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
import {
  buildSkillbook,
  gearContextFromInventory,
  passiveSkillBonuses,
  skillTone,
  weaponFitReason,
  SKILL_GROUPS,
  type GearContext,
  type SkillbookEntry,
} from '@/lib/skillbook'

export type BookTab = 'skills' | 'spells'

interface SkillsAndSpellsModalProps {
  isOpen: boolean
  player: Player | null
  /** Using from the book: heals work anywhere, attack spells and strikes need a fight. */
  inBattle: boolean
  tab: BookTab
  onTabChange: (tab: BookTab) => void
  onClose: () => void
  onLearned: (updatedPlayer: Player) => void
  onCast: (spellId: string) => void
  onUseSkill: (skillId: string) => void
}

/**
 * The Skills and Spells pages of the original, as one book with two tabs.
 * Both spend the same SP: every skill or spell in its registry, grouped as the
 * original grouped them, with level/cap, the SP to learn the next level, the
 * MP to use, and where to find a better teacher. Learning is a PUT to
 * /api/user/skills or /api/user/spells (the server owns caps and costs);
 * using hands off to the game action pipeline.
 */
export default function SkillsAndSpellsModal({
  isOpen,
  player,
  inBattle,
  tab,
  onTabChange,
  onClose,
  onLearned,
  onCast,
  onUseSkill,
}: SkillsAndSpellsModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const inventory = useGameStore((state) => state.inventory)
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setNotice(null)
      setBusy(null)
    }
  }, [isOpen])

  useEffect(() => {
    setNotice(null)
  }, [tab])

  if (!mounted || !isOpen || !player) return null

  const sp = player.sp ?? 0
  const mag = effectiveMag(player)
  const mp = player.mp ?? 0
  const hp = player.hp ?? 0
  const hpMax = player.hpMax ?? 0
  const gear = gearContextFromInventory(inventory)
  const passives = passiveSkillBonuses(player, gear)

  const learn = async (kind: BookTab, id: string, name: string, mode: 'one' | 'max') => {
    if (busy) return
    setBusy(id)
    setNotice(null)
    const endpoint = kind === 'skills' ? '/api/user/skills' : '/api/user/spells'
    const body = kind === 'skills' ? { skillId: id, mode } : { spellId: id, mode }
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.player) onLearned(data.player as Player)
      if (!response.ok || data?.success === false) {
        setNotice({ tone: 'error', text: data?.message || `Could not learn ${name}.` })
      } else {
        setNotice({ tone: 'ok', text: data?.message || `${name} learned.` })
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : `Could not learn ${name}.` })
    } finally {
      setBusy(null)
    }
  }

  const castDisabledReason = (entry: SpellbookEntry): string | null => {
    if (!entry.castable) return null
    if (entry.def.kind === 'attack' && !inBattle) return 'Needs a target — cast it in a fight'
    if (entry.def.kind === 'heal' && hp >= hpMax) return 'Already at full health'
    if (mp < entry.castCost) return `Not enough MP (${entry.castCost} needed)`
    return null
  }

  const skillUseDisabledReason = (entry: SkillbookEntry): string | null => {
    if (!entry.usable) return null
    if (!inBattle) return 'Needs a target — use it in a fight'
    const fit = weaponFitReason(entry.def, gear)
    if (fit) return fit
    if (entry.castCost !== null && mp < entry.castCost) return `Not enough MP (${entry.castCost} needed)`
    return null
  }

  const passiveSummary = [
    passives.str > 0 ? `+${passives.str} STR` : null,
    passives.dex > 0 ? `+${passives.dex} DEX` : null,
    passives.def > 0 ? `+${passives.def} DEF` : null,
    passives.dodgeChance > 0 ? `${passives.dodgeChance}% dodge` : null,
  ].filter(Boolean)

  const tabButton = (id: BookTab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => onTabChange(id)}
      className={`h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        tab === id ? (id === 'skills' ? 'fill-stat-str' : 'fill-mood-arcane') : 'text-fg-muted hover:text-fg-primary hover:bg-surface-raised/60'
      }`}
    >
      {label}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-50 p-4 sm:p-6 lg:p-10">
      <div className="absolute inset-0 bg-surface-sunken/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-full bg-surface-panel/95 border border-line-subtle/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line-subtle/50">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-fg-bright">Skills &amp; Spells</h3>
            <p className="text-xs text-fg-secondary mt-0.5">
              {tab === 'skills'
                ? 'Spend SP on skills. Proficiencies and defenses work on their own; special attacks cost MP in a fight. Find better teachers to raise the caps.'
                : 'Spend SP to learn and upgrade spells. Spells consume MP to cast. Find better teachers to raise the caps.'}
            </p>
          </div>
          <div role="tablist" aria-label="Book" className="flex gap-1 p-1 rounded-xl bg-surface-sunken border border-line-subtle flex-shrink-0">
            {tabButton('skills', 'Skills')}
            {tabButton('spells', 'Spells')}
          </div>
          <button
            onClick={onClose}
            className="text-fg-secondary hover:text-fg-bright transition-colors p-1.5 rounded hover:bg-surface-raised flex-shrink-0"
            disabled={Boolean(busy)}
          >
            <span className="sr-only">Close</span>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="bg-surface-panel/70 border border-line-subtle rounded-2xl px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className={`text-xs uppercase tracking-[0.4em] mb-1 ${tab === 'skills' ? 'text-stat-str/80' : 'text-mood-arcane/80'}`}>Skill Points</p>
              <h4 className="text-3xl font-semibold text-fg-bright">{sp} SP</h4>
            </div>
            {tab === 'skills' ? (
              <div className="text-sm text-fg-secondary">
                {passiveSummary.length > 0 ? (
                  <>
                    Your skills add <span className="text-fg-bright font-semibold">{passiveSummary.join(' · ')}</span> right now
                  </>
                ) : (
                  'No passive bonus in force yet'
                )}
                {' · '}
                <span className="text-resource-mp font-semibold">{mp}/{player.mpMax ?? 0} MP</span>
              </div>
            ) : (
              <div className="text-sm text-fg-secondary">
                <span className="text-stat-mag font-semibold">{mag} MAG</span> drives every roll ·{' '}
                <span className="text-resource-mp font-semibold">{mp}/{player.mpMax ?? 0} MP</span>
              </div>
            )}
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

          {tab === 'skills'
            ? SKILL_GROUPS.map((group) => {
                const rows = buildSkillbook(player).filter((entry) => entry.def.group === group.id)
                if (rows.length === 0) return null
                return (
                  <section key={group.id} className="bg-surface-panel/70 border border-line-subtle rounded-2xl p-4 sm:p-6">
                    <div className="mb-3">
                      <h4 className="text-base font-semibold text-fg-bright">{group.name}</h4>
                      <p className="text-xs text-fg-secondary">{group.blurb}</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {rows.map((entry) => (
                        <SkillCard
                          key={entry.def.id}
                          entry={entry}
                          sp={sp}
                          gear={gear}
                          busy={busy === entry.def.id}
                          anyBusy={Boolean(busy)}
                          skillUseDisabledReason={skillUseDisabledReason(entry)}
                          onLearn={(mode) => learn('skills', entry.def.id, entry.def.name, mode)}
                          onUse={() => onUseSkill(entry.def.id)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })
            : SPELL_SCHOOLS.map((school) => {
                const rows = buildSpellbook(player).filter((entry) => entry.def.school === school.id)
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
                          busy={busy === entry.def.id}
                          anyBusy={Boolean(busy)}
                          castDisabledReason={castDisabledReason(entry)}
                          onLearn={(mode) => learn('spells', entry.def.id, entry.def.name, mode)}
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
            disabled={Boolean(busy)}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Shared learn controls: +1, Max, or the reason there is nothing to buy. */
function LearnControls({
  locked,
  atMax,
  level,
  maxLevel,
  nextLearnCost,
  canAfford,
  busy,
  anyBusy,
  fill,
  onLearn,
}: {
  locked: boolean
  atMax: boolean
  level: number
  maxLevel: number
  nextLearnCost: number | null
  canAfford: boolean
  busy: boolean
  anyBusy: boolean
  fill: string
  onLearn: (mode: 'one' | 'max') => void
}) {
  if (locked) return <span className="text-[11px] italic text-fg-disabled">Find a teacher to unlock</span>
  if (atMax) return <span className="text-[11px] italic text-resource-gold/80">Search for more advanced teachers</span>
  return (
    <>
      <button
        type="button"
        onClick={() => onLearn('one')}
        disabled={!canAfford || anyBusy}
        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${fill}`}
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
  )
}

interface SkillCardProps {
  entry: SkillbookEntry
  sp: number
  gear: GearContext
  busy: boolean
  anyBusy: boolean
  skillUseDisabledReason: string | null
  onLearn: (mode: 'one' | 'max') => void
  onUse: () => void
}

/** What a passive is doing right now, given what is in hand. */
function passiveStatus(entry: SkillbookEntry, gear: GearContext): string {
  const { def, level } = entry
  const lvl = Math.max(1, level)
  const holding = gear.weaponCategory === null ? null : gear.weaponCategory === 'RANGED' ? 'RANGED' : gear.isTwoHanded ? 'TWO_HANDED' : 'ONE_HANDED'
  const now = level >= 1 ? 'Now' : 'At level 1'
  switch (def.id) {
    case 'one-handed':
      return holding === 'ONE_HANDED' ? `${now}: +${lvl} STR with your one-handed weapon` : 'Counts while a one-handed weapon is in hand'
    case 'two-handed':
      return holding === 'TWO_HANDED' ? `${now}: +${lvl} STR with your two-handed weapon` : 'Counts while a two-handed weapon is in hand'
    case 'ranged':
      return holding === 'RANGED' ? `${now}: +${lvl} DEX with your ranged weapon` : 'Counts while a ranged weapon is in hand'
    case 'warcraft':
      return holding === 'RANGED' ? `${now}: +${lvl} DEX` : holding ? `${now}: +${lvl} STR` : 'Counts while any weapon is in hand'
    case 'toughness':
      return `${now}: +${lvl * 2} DEF`
    case 'block':
      return gear.hasShield ? `${now}: +${lvl * 3} DEF behind your shield` : 'Counts while a shield is equipped'
    case 'dodge':
      return `${now}: ${lvl}% chance to dodge an attack`
    default:
      return def.formula
  }
}

function SkillCard({ entry, sp, gear, busy, anyBusy, skillUseDisabledReason, onLearn, onUse }: SkillCardProps) {
  const { def, level, maxLevel, nextLearnCost, castCost, preview, usable, teachers } = entry
  const tone = skillTone(def.hue)
  const locked = maxLevel <= 0
  const atMax = !locked && level >= maxLevel
  const canAfford = nextLearnCost !== null && sp >= nextLearnCost
  const learned = level >= 1
  const notPorted = !def.implemented
  const isStrike = def.kind === 'strike'

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
            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-fg-disabled">{isStrike ? 'attack' : def.kind === 'passive' ? 'passive' : 'upgrade'}</span>
            {atMax && <span className="ml-1 text-[10px] uppercase tracking-wider text-resource-gold/80">max</span>}
          </p>
          {!locked && castCost !== null && (
            <span className="text-xs text-resource-mp tabular-nums whitespace-nowrap">{castCost} MP</span>
          )}
        </div>
        <p className="text-xs text-fg-secondary mt-0.5">{def.description}</p>

        {!locked && isStrike && preview && (
          <p className="text-[11px] text-fg-muted mt-1 tabular-nums">
            Adds {preview.min}–{preview.max} to the swing
            <span className="text-fg-disabled"> · {preview.text}</span>
            {level === 0 && <span className="text-fg-disabled"> at level 1</span>}
          </p>
        )}
        {!locked && def.kind === 'passive' && (
          <p className="text-[11px] text-fg-muted mt-1 tabular-nums">{passiveStatus(entry, gear)}</p>
        )}
        {(locked || def.kind === 'upgrade') && (
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
          <LearnControls
            locked={locked}
            atMax={atMax}
            level={level}
            maxLevel={maxLevel}
            nextLearnCost={nextLearnCost}
            canAfford={canAfford}
            busy={busy}
            anyBusy={anyBusy}
            fill={tone.fill}
            onLearn={onLearn}
          />

          {usable && (
            <button
              type="button"
              onClick={onUse}
              disabled={Boolean(skillUseDisabledReason) || anyBusy}
              title={skillUseDisabledReason ?? `${def.name} in this fight`}
              className="ml-auto px-2.5 py-1 rounded text-xs font-semibold fill-accent hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use
            </button>
          )}
          {learned && notPorted && (
            <span className="ml-auto text-[11px] italic text-fg-disabled">Not in play yet</span>
          )}
        </div>
      </div>
    </div>
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
          <LearnControls
            locked={locked}
            atMax={atMax}
            level={level}
            maxLevel={maxLevel}
            nextLearnCost={nextLearnCost}
            canAfford={canAfford}
            busy={busy}
            anyBusy={anyBusy}
            fill={tone.fill}
            onLearn={onLearn}
          />

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
