'use client'

import { useEffect, useState } from 'react'
import { Player, useGameStore } from '@/lib/game-state'
import Icon from './Icon'
import { ScrollEnd } from './game-interface/LayerShell'
import {
  buildSpellbook,
  castBlockedReason,
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
  strikeBlockedReason,
  SKILL_GROUPS,
  type GearContext,
  type SkillbookEntry,
} from '@/lib/skillbook'

export type BookTab = 'skills' | 'spells'

interface SkillsAndSpellsBookProps {
  player: Player | null
  /** Using from the book: heals and buffs work anywhere, attack spells and strikes need something to hit. */
  inBattle: boolean
  /** An enemy stands in the room, so an attack spell or strike can open the fight. */
  hasTarget: boolean
  tab: BookTab
  /**
   * One entry to scroll to and ring on open — the character panel's rows and
   * the battle deck send the player here to read what they just tapped.
   */
  highlightId?: string | null
  onLearned: (updatedPlayer: Player) => void
  onCast: (spellId: string) => void
  onUseSkill: (skillId: string) => void
}

/**
 * The Skills and Spells pages of the original: the Char tab's Skill book and
 * Spell book. Both spend the same SP: every skill or spell in its registry,
 * grouped as the original grouped them, with level/cap, the SP to learn the
 * next level, the MP to use, and where to find a better teacher. Learning is
 * a PUT to /api/user/skills or /api/user/spells (the server owns caps and
 * costs); using hands off to the game action pipeline.
 */
export default function SkillsAndSpellsBook({
  player,
  inBattle,
  hasTarget,
  tab,
  highlightId = null,
  onLearned,
  onCast,
  onUseSkill,
}: SkillsAndSpellsBookProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const inventory = useGameStore((state) => state.inventory)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setNotice(null)
  }, [tab])

  // Bring the entry the player tapped into view. One frame late, so the list
  // it belongs to has rendered; a stale id simply matches nothing.
  useEffect(() => {
    if (!highlightId) return
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-book-entry="${CSS.escape(highlightId)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [highlightId, tab])

  if (!player) return null

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

  // The same refusals the server makes, shared with the battle deck and the
  // character panel. An attack spell or strike only needs something to hit —
  // out of a fight the engine opens one, as the original let you do.
  const situation = { inBattle, hasTarget, mp }
  const castDisabledReason = (entry: SpellbookEntry): string | null =>
    castBlockedReason(entry, { ...situation, hp, hpMax, buffs: player.buffs })

  const skillUseDisabledReason = (entry: SkillbookEntry): string | null =>
    strikeBlockedReason(entry, { ...situation, gear })

  const passiveSummary = [
    passives.str > 0 ? `+${passives.str} STR` : null,
    passives.dex > 0 ? `+${passives.dex} DEX` : null,
    passives.def > 0 ? `+${passives.def} DEF` : null,
    passives.dodgeChance > 0 ? `${passives.dodgeChance}% dodge` : null,
  ].filter(Boolean)

  // In the Char tab the cards follow the panel's width, not the window's.
  const cardGrid = 'grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3'
  const blurb =
    tab === 'skills'
      ? 'Proficiencies and defenses work on their own; special attacks cost MP in a fight. Better teachers raise the caps.'
      : 'Spells cost MP to cast. Better teachers raise the caps.'

  const pages = (
    <>
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
                    <div className={cardGrid}>
                      {rows.map((entry) => (
                        <SkillCard
                          key={entry.def.id}
                          entry={entry}
                          highlighted={entry.def.id === highlightId}
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
                    <div className={cardGrid}>
                      {rows.map((entry) => (
                        <SpellCard
                          key={entry.def.id}
                          entry={entry}
                          highlighted={entry.def.id === highlightId}
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
    </>
  )

  const accent = tab === 'skills' ? 'text-stat-str' : 'text-mood-arcane'

  return (
    <div className="@container">
      {/* What there is to spend, kept in view: scroll as far down the page as
          you like and the number that decides what you can learn comes with
          you. Opaque, so the cards pass under it cleanly. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-subtle/60 bg-surface-panel px-4 py-2 shadow-[0_4px_8px_-6px_var(--shadow)]">
        <p className="flex items-baseline gap-1.5">
          <span className={`text-xl font-black leading-none tabular-nums ${sp > 0 ? accent : 'text-fg-muted'}`}>{sp}</span>
          <span className={`text-[11px] font-bold uppercase tracking-wide ${sp > 0 ? accent : 'text-fg-muted'}`}>
            {sp === 1 ? 'Skill Point' : 'Skill Points'} to spend
          </span>
        </p>
        <p className="ml-auto flex items-baseline gap-2 text-[11px] tabular-nums text-fg-secondary">
          {tab === 'spells' && <span className="font-semibold text-stat-mag">{mag} MAG</span>}
          <span className="font-semibold text-resource-mp">{mp}/{player.mpMax ?? 0} MP</span>
        </p>
      </div>

      <div className="space-y-4 p-4">
        {/* One sentence on how the page works, then what it is doing for you now. */}
        <div className="space-y-1">
          <p className="text-xs leading-relaxed text-fg-secondary">{blurb}</p>
          <p className="text-xs text-fg-secondary">
            {tab === 'skills' ? (
              passiveSummary.length > 0 ? (
                <>
                  Right now your skills add <span className="font-semibold text-fg-bright">{passiveSummary.join(' · ')}</span>.
                </>
              ) : (
                'No passive bonus is in force yet.'
              )
            ) : (
              <>
                Every spell rolls on your <span className="font-semibold text-stat-mag">{mag} MAG</span>.
              </>
            )}
          </p>
        </div>
        {pages}
        <ScrollEnd />
      </div>
    </div>
  )
}


/** Shared learn controls: +1, Max, or the reason there is nothing to buy. */
function LearnControls({
  locked,
  lockedReason,
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
  lockedReason?: string | null
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
  if (locked) return <span className="text-[11px] italic text-fg-disabled">{lockedReason ?? 'Find a teacher to unlock'}</span>
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
  /** Tapped from somewhere else and ringed here. */
  highlighted?: boolean
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
    case 'one-handed-pro':
      return holding === 'ONE_HANDED' ? `${now}: +${lvl * 5}% of your gear-side STR` : 'Counts while a one-handed weapon is in hand'
    case 'two-handed-pro':
      return holding === 'TWO_HANDED' ? `${now}: +${lvl * 5}% of your gear-side STR` : 'Counts while a two-handed weapon is in hand'
    case 'ranged-pro':
      return holding === 'RANGED' ? `${now}: +${lvl * 5}% of your gear-side DEX` : 'Counts while a ranged weapon is in hand'
    default:
      return def.formula
  }
}

function SkillCard({ entry, highlighted = false, sp, gear, busy, anyBusy, skillUseDisabledReason, onLearn, onUse }: SkillCardProps) {
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
      data-book-entry={def.id}
      className={`rounded-xl border px-4 py-3 flex gap-3 transition-shadow ${
        locked ? 'border-line-subtle/60 bg-surface-panel/40 opacity-70' : `${tone.border}/40 bg-surface-panel/80`
      } ${highlighted ? 'ring-2 ring-line-focus' : ''}`}
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
            lockedReason={entry.lockedReason}
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
  /** Tapped from somewhere else and ringed here. */
  highlighted?: boolean
  sp: number
  busy: boolean
  anyBusy: boolean
  castDisabledReason: string | null
  onLearn: (mode: 'one' | 'max') => void
  onCast: () => void
}

function SpellCard({ entry, highlighted = false, sp, busy, anyBusy, castDisabledReason, onLearn, onCast }: SpellCardProps) {
  const { def, level, maxLevel, nextLearnCost, castCost, preview, castable, teachers } = entry
  const tone = spellTone(def.hue)
  const locked = maxLevel <= 0
  const atMax = !locked && level >= maxLevel
  const canAfford = nextLearnCost !== null && sp >= nextLearnCost
  const learned = level >= 1
  const comingSoon = learned && !def.implemented

  return (
    <div
      data-book-entry={def.id}
      className={`rounded-xl border px-4 py-3 flex gap-3 transition-shadow ${
        locked ? 'border-line-subtle/60 bg-surface-panel/40 opacity-70' : `${tone.border}/40 bg-surface-panel/80`
      } ${highlighted ? 'ring-2 ring-line-focus' : ''}`}
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
            {preview.label ?? (def.kind === 'heal' ? 'Heals' : 'Hits')} {preview.min === preview.max ? preview.min : `${preview.min}–${preview.max}`}
            <span className="text-fg-disabled"> {def.kind === 'buff' ? '' : '· '}{preview.text}</span>
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
