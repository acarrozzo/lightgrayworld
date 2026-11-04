'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { PlayerAvatar } from '@/components/player/PlayerRow'
import { KILL_TIERS, toneStyle, type KillBox, type KillRow } from '@/lib/kill-list'
import { RareChip } from './KillListTab'

interface RecordDrop {
  slug: string
  name: string
  icon: string | null
  qty: string
  chance: string
  had: boolean
}

interface FellRow {
  id: string
  playerId: string
  username: string
  uIcon: string | null
  uIconColor: string | null
  level: number
  xp: number | null
  turns: number
  at: string
  isYou: boolean
}

interface EnemyRecord {
  enemy: { slug: string; description: string; traits: string[]; drops: RecordDrop[] }
  record: {
    kills: number
    firstKillAt: string | null
    firstKillLevel: number | null
    fastestWin: number | null
    biggestHit: number
    killedYou: number
    fled: number
    tiers: { at: number; reachedAt: string | null }[]
  }
  firstToFell: FellRow[]
  yours: { id: string; level: number; xp: number | null; turns: number; at: string } | null
}

/** Where this card sits among the killed enemies on the list, and its neighbors. */
export interface CardNav {
  index: number
  count: number
  prev: { slug: string; name: string } | null
  next: { slug: string; name: string } | null
}

interface BestiaryCardProps {
  row: KillRow
  box: KillBox
  getAuthHeaders: () => Record<string, string>
  onBack: () => void
  /** Open a won fight from the board, turn by turn. */
  onWatch: (battleId: string) => void
  nav?: CardNav
  /** Step to another killed enemy's card. */
  onSelect?: (slug: string) => void
}

const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—')

function Tag({ children, tone = 'text-fg-secondary border-line-strong/60' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`rounded-[3px] border px-1.5 text-[9px] font-bold uppercase tracking-[0.06em] leading-[16px] ${tone}`}>{children}</span>
}

/**
 * One felled enemy's page: what it is, your record against it, its drops
 * marked by whether you have ever held them, and the one board the Kill
 * List keeps — who felled it earliest in a character's life. Opens from a
 * killed row; an unkilled enemy has no card, as it has no color on the list.
 * Everything but the header comes from the record route on open.
 */
export default function BestiaryCard({ row, box, getAuthHeaders, onBack, onWatch, nav, onSelect }: BestiaryCardProps) {
  const { enemy } = row
  const [data, setData] = useState<EnemyRecord | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    fetch(`/api/enemies/${encodeURIComponent(enemy.slug)}/record`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setData(json)
        else setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [enemy.slug, getAuthHeaders])

  const kills = data?.record.kills ?? row.kills

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded px-1 py-1 text-[12px] text-fg-muted hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          ‹ Kill list
        </button>
        <span className="ml-auto truncate text-[11px] text-fg-muted">
          <span style={toneStyle(box.area.tone)}>{box.area.name}</span> · {box.killed} of {box.total}
        </span>
        {nav && onSelect && (
          <span className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Other killed enemies">
            <NavButton label="‹" title={nav.prev ? `Previous: ${nav.prev.name} (←)` : 'First on the list'} disabled={!nav.prev} onClick={() => nav.prev && onSelect(nav.prev.slug)} />
            <span className="px-1 text-[10px] tabular-nums text-fg-disabled">{nav.index + 1} of {nav.count}</span>
            <NavButton label="›" title={nav.next ? `Next: ${nav.next.name} (→)` : 'Last on the list'} disabled={!nav.next} onClick={() => nav.next && onSelect(nav.next.slug)} />
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-line-subtle/60 bg-surface-raised/60" aria-hidden="true">
          <Icon name={enemy.icon} size={40} className={enemy.rank ? 'text-mood-danger' : 'text-fg-primary'} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h2 className="flex items-center gap-2 text-2xl font-bold leading-tight text-fg-bright" style={toneStyle(enemy.nameTone)}>
            {enemy.rare && <RareChip />}
            <span className="truncate">{enemy.name}</span>
          </h2>
          <p className="text-[11px] text-fg-muted">
            lvl {enemy.level} · <span style={toneStyle(box.area.tone)}>{box.area.name}</span> · {enemy.zone}
          </p>
          <div className="flex flex-wrap gap-1">
            {enemy.rank && <Tag tone="text-mood-danger border-mood-danger/60">{enemy.rank === 'boss' ? 'Boss' : 'Mini-boss'}</Tag>}
            {enemy.rare && <Tag tone="text-resource-gold border-resource-gold/60">Rare</Tag>}
            <Tag>{enemy.damageType === 'MAGIC' ? 'Magic' : enemy.damageType === 'RANGED' ? 'Ranged' : 'Melee'}</Tag>
            {enemy.isAggressive && <Tag>Aggressive</Tag>}
            {enemy.isFlying && <Tag>Flying</Tag>}
            {enemy.lair && <Tag tone="text-hue-sky border-hue-sky/50">Lair · teleport open</Tag>}
            {data?.enemy.traits.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
          {data?.enemy.description && <p className="text-[12px] leading-snug text-fg-secondary">{data.enemy.description}</p>}
        </div>
      </div>

      {failed && <p className="text-sm text-status-error">Could not load the record. Try again in a moment.</p>}

      {/* Your record */}
      <section className="space-y-2.5 rounded-xl border border-line-subtle/60 bg-surface-panel/60 p-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-fg-muted">Your record</h3>
          <span className="ml-auto text-2xl font-bold leading-none tabular-nums text-resource-gold">
            {kills.toLocaleString()} <span className="text-[11px] font-medium text-fg-muted">kill{kills === 1 ? '' : 's'}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 @[28rem]:grid-cols-4">
          <Stat label="First kill" value={data ? `${fmtDay(data.record.firstKillAt)}${data.record.firstKillLevel ? ` · Lv ${data.record.firstKillLevel}` : ''}` : '…'} small />
          <Stat label="Fastest win" value={data ? (data.record.fastestWin ?? '—') : '…'} unit={data?.record.fastestWin ? 'turns' : undefined} />
          <Stat label="Biggest hit" value={data ? data.record.biggestHit : '…'} tone="text-resource-gold" />
          <Stat label="Killed you" value={data ? data.record.killedYou : '…'} tone={data && data.record.killedYou > 0 ? 'text-status-error' : 'text-fg-bright'} />
        </div>
        <div className="space-y-1 border-t border-line-subtle/40 pt-2">
          {KILL_TIERS.map((tier) => {
            const reached = kills >= tier
            const reachedAt = data?.record.tiers.find((t) => t.at === tier)?.reachedAt ?? null
            const pct = Math.min(100, Math.round((kills / tier) * 100))
            return (
              <div key={tier} className="flex items-center gap-2 text-[11px] tabular-nums">
                <span className={`w-11 text-right ${reached ? 'font-bold text-resource-gold' : 'text-fg-secondary'}`}>{tier.toLocaleString()}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
                  <span className="block h-full rounded-full bg-resource-gold" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-24 text-fg-muted">{reached ? `✓ ${reachedAt ? fmtDay(reachedAt) : 'reached'}` : `${kills.toLocaleString()} of ${tier.toLocaleString()}`}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Drops: only what has reached this character. The rest stays a count,
          so the card says there is more to find without saying what. */}
      <section className="rounded-xl border border-line-subtle/60 bg-surface-panel/60 p-3">
        <div className="mb-1 flex items-baseline gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-fg-muted">Drops</h3>
          <span className="ml-auto text-[10px] text-fg-muted">what has reached you</span>
        </div>
        {!data ? (
          <p className="py-2 text-[12px] text-fg-muted">…</p>
        ) : data.enemy.drops.length === 0 ? (
          <p className="py-2 text-[12px] text-fg-muted">It drops nothing but the gold.</p>
        ) : (
          (() => {
            const had = data.enemy.drops.filter((drop) => drop.had)
            const unseen = data.enemy.drops.length - had.length
            return (
              <>
                {had.length === 0 ? (
                  <p className="py-2 text-[12px] text-fg-muted">Nothing it drops has reached you yet.</p>
                ) : (
                  <ul className="divide-y divide-line-subtle/40">
                    {had.map((drop, i) => (
                      <li key={`${drop.slug}-${i}`} className="flex min-h-[30px] items-center gap-2 text-[12px]">
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
                          {drop.icon ? <Icon name={drop.icon} size={16} className="text-fg-secondary" /> : <span className="h-3 w-3 rounded-[3px] bg-surface-raised" />}
                        </span>
                        <span className="truncate text-fg-primary">{drop.name}{drop.qty}</span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-fg-muted">{drop.chance}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {unseen > 0 && (
                  <p className={`text-[11px] text-fg-disabled ${had.length > 0 ? 'mt-1.5 border-t border-line-subtle/40 pt-1.5' : ''}`}>
                    {unseen} more it can drop that you have not seen.
                  </p>
                )}
              </>
            )
          })()
        )}
      </section>

      {/* First to fell */}
      <section className="rounded-xl border border-line-subtle/60 bg-surface-panel/60 p-3">
        <div className="mb-1.5 flex items-baseline gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-fg-muted">First to fell</h3>
          <span className="ml-auto text-[10px] text-fg-muted">lowest level at the kill, then lowest XP</span>
        </div>
        {!data ? (
          <p className="py-2 text-[12px] text-fg-muted">…</p>
        ) : data.firstToFell.length === 0 ? (
          <p className="py-2 text-[12px] text-fg-muted">No fight on record yet. The next win over it goes on the board.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-[12px] tabular-nums">
              <thead>
                <tr className="text-left text-[9px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
                  <th className="w-5 pb-1 font-semibold">#</th>
                  <th className="pb-1 font-semibold">Player</th>
                  <th className="w-10 pb-1 font-semibold">Lv</th>
                  <th className="w-14 pb-1 font-semibold">XP</th>
                  <th className="w-12 pb-1 font-semibold">Turns</th>
                  <th className="w-14 pb-1 font-semibold">When</th>
                  <th className="w-16 pb-1" />
                </tr>
              </thead>
              <tbody>
                {data.firstToFell.map((fell, i) => (
                  <tr key={fell.id} className={`border-t border-line-subtle/40 ${fell.isYou ? 'bg-accent/10' : ''}`}>
                    <td className="py-1.5 font-bold text-fg-muted">{i + 1}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <PlayerAvatar uIcon={fell.uIcon} uIconColor={fell.uIconColor} />
                        <span className={`truncate font-medium ${fell.isYou ? 'text-resource-gold' : 'text-fg-bright'}`}>{fell.username}{fell.isYou ? ' · you' : ''}</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-fg-secondary">{fell.level}</td>
                    <td className="py-1.5 text-fg-secondary">{fell.xp ?? '—'}</td>
                    <td className="py-1.5 text-fg-secondary">{fell.turns}</td>
                    <td className="py-1.5 text-fg-secondary">{fmtDay(fell.at)}</td>
                    <td className="py-1.5 text-right">
                      <button type="button" onClick={() => onWatch(fell.id)} className="text-[11px] font-bold text-hue-sky hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded">
                        ▶ Watch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.yours && !data.firstToFell.some((f) => f.isYou) && (
          <p className="mt-2 flex items-center gap-2 text-[11px] text-fg-secondary">
            <span>Your earliest: Lv {data.yours.level}{data.yours.xp !== null ? ` · ${data.yours.xp} XP` : ''} · {data.yours.turns} turns · {fmtDay(data.yours.at)}</span>
            <button type="button" onClick={() => onWatch(data.yours!.id)} className="text-[11px] font-bold text-hue-sky hover:underline underline-offset-2">▶ Watch</button>
          </p>
        )}
        <p className="mt-2 text-[10px] text-fg-disabled">Grinding cannot move you up this board. Only a kill made earlier in a character&apos;s life can.</p>
      </section>
    </div>
  )
}

function NavButton({ label, title, disabled, onClick }: { label: string; title: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-7 w-7 items-center justify-center rounded border border-line-subtle/60 text-[14px] leading-none text-fg-secondary hover:border-line-strong hover:text-fg-bright disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {label}
    </button>
  )
}

function Stat({ label, value, unit, tone = 'text-fg-bright', small = false }: { label: string; value: string | number; unit?: string; tone?: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-fg-muted">{label}</span>
      <span className={`font-bold tabular-nums ${small ? 'text-[12px]' : 'text-base'} ${tone}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-medium text-fg-muted">{unit}</span>}
      </span>
    </div>
  )
}
