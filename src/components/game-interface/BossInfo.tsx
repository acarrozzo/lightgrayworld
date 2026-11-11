'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import Icon from '@/components/Icon'
import { rosterEnemy } from '@/lib/kill-list'
import { formatRestMinutes, restMinutesForSlug } from '@/lib/boss-rest-client'
import { resolveItemIcon } from '@/lib/item-actions'
import { useIsWide } from '@/components/world-tool/useIsWide'
import SubTabButton from './SubTabButton'

/** A player on a board, as the player card wants them. */
export interface BoardPlayer {
  id: string
  username: string
  level: number
}

interface BossInfoProps {
  /** The boss this page is about. */
  slug: string
  name: string
  /** Open a player's card from their name on a board. */
  onOpenPlayer?: (player: BoardPlayer) => void
}

/**
 * A fold's open state: the viewer's choice once they have made one, else the
 * viewport's — open on desktop, shut on a phone (5 Nov 2026, "default to the
 * inside boxes being expanded on desktop").
 */
function useFold(): [boolean, () => void] {
  const wide = useIsWide()
  const [choice, setChoice] = useState<boolean | null>(null)
  const open = choice ?? wide
  return [open, () => setChoice(!open)]
}

interface BoardRow {
  id: string
  playerId: string
  username: string
  level: number | null
  xp: number | null
  turns: number
  maxHit: number
  party: boolean
  at: string
  isYou: boolean
}

/** A recent fight: a board row plus the fight's numbers and haul. */
interface FightRow extends BoardRow {
  dealt: number
  taken: number
  xpEarned: number
  goldEarned: number
  drops: string[]
}

interface KillsRow {
  playerId: string
  username: string
  kills: number
  isYou: boolean
}

interface LairBoardData {
  success: boolean
  enemy: { slug: string; name: string }
  totals: { kills: number; players: number }
  recent: FightRow[]
  boards: {
    firstToWin: BoardRow[]
    fewestTurns: BoardRow[]
    biggestHit: BoardRow[]
    mostKills: KillsRow[]
  }
  yours: { kills: number; rankByLevel: number | null; rankByTurns: number | null } | null
}

type Tab = 'enemy' | 'leaderboard'

/**
 * Boss Info (5 Nov 2026), opened inside the boss's box in the room card
 * rather than a sheet ("the info to expand in the enemy container"). Two
 * tabs: the enemy's own page first, then the Leaderboard.
 */
export default function BossInfo({ slug, name, onOpenPlayer }: BossInfoProps) {
  const [tab, setTab] = useState<Tab>('enemy')
  return (
    <div className="basis-full border-t border-line-subtle/40 pt-2.5" aria-label={`${name} info`}>
      {/* The same buttons as the deck's sub-tab rows, in the enemy's red. */}
      <div className="mb-2 flex items-center gap-1.5" role="tablist">
        <SubTabButton active={tab === 'enemy'} color="red" ariaPressed={tab === 'enemy'} onClick={() => setTab('enemy')}>Enemy</SubTabButton>
        <SubTabButton active={tab === 'leaderboard'} color="red" ariaPressed={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>Leaderboard</SubTabButton>
      </div>
      {tab === 'enemy' ? <EnemyPage slug={slug} name={name} /> : <Leaderboard slug={slug} name={name} onOpenPlayer={onOpenPlayer} />}
    </div>
  )
}

/**
 * The Leaderboard: four boards, each showing its leader with a Top 5 that
 * unfolds, then everyone's recent fights behind their own fold. Read from the
 * Battle Log rows the bestiary's "First to win" board reads, so nothing new
 * is stored. Players are named, never "You": the viewer's own rows are gold.
 */
function Leaderboard({ slug, name, onOpenPlayer }: BossInfoProps) {
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const username = useGameStore((s) => s.player?.username)
  const [data, setData] = useState<LairBoardData | null>(null)
  const [failed, setFailed] = useState(false)
  const [recentOpen, toggleRecent] = useFold()

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    fetch(`/api/enemies/${encodeURIComponent(slug)}/board`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((json: LairBoardData) => {
        if (cancelled) return
        if (!json?.success) setFailed(true)
        else setData(json)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, getAuthHeaders])

  return (
    <div aria-label={`${name} leaderboard`}>
      {failed && <p className="text-xs text-status-error">Could not load the board. Try again in a moment.</p>}
      {!data && !failed && <p className="py-2 text-center text-xs text-fg-muted">…</p>}

      {data && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-fg-muted">
            <span>
              {data.totals.kills.toLocaleString()} kill{data.totals.kills === 1 ? '' : 's'} by {data.totals.players} player{data.totals.players === 1 ? '' : 's'}
            </span>
            {data.yours && (
              <span className="ml-auto">
                <span className="font-semibold text-resource-gold">{username ?? 'you'}</span>
                {' · '}{data.yours.kills.toLocaleString()} kill{data.yours.kills === 1 ? '' : 's'}
                {data.yours.rankByLevel != null && <> · #{data.yours.rankByLevel} first to win</>}
                {data.yours.rankByTurns != null && <> · #{data.yours.rankByTurns} fewest turns</>}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5 @md:grid-cols-2">
            <Board
              label="First to win"
              onOpenPlayer={onOpenPlayer}
              hint="lowest level, then lowest XP"
              rows={data.boards.firstToWin}
              detail={(r) => `L${r.level ?? '?'} · ${r.xp != null ? `${r.xp.toLocaleString()} XP` : '— XP'} · ${day(r.at)}`}
            />
            <Board
              label="Fewest turns"
              onOpenPlayer={onOpenPlayer}
              rows={data.boards.fewestTurns}
              detail={(r) => `${r.turns} turn${r.turns === 1 ? '' : 's'} · L${r.level ?? '?'} · ${day(r.at)}`}
            />
            <Board
              label="Biggest hit"
              onOpenPlayer={onOpenPlayer}
              rows={data.boards.biggestHit}
              detail={(r) => `${r.maxHit.toLocaleString()} dmg · L${r.level ?? '?'} · ${day(r.at)}`}
            />
            <Board
              label="Most kills"
              onOpenPlayer={onOpenPlayer}
              rows={data.boards.mostKills}
              detail={(r) => `${r.kills.toLocaleString()} kill${r.kills === 1 ? '' : 's'}`}
            />
          </div>

          <div className="rounded-lg bg-surface-sunken px-2.5 py-1.5">
            <button
              type="button"
              onClick={toggleRecent}
              aria-expanded={recentOpen}
              className="flex w-full items-center gap-1.5 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-fg-muted hover:text-fg-primary"
            >
              <span>Recent fights</span>
              <span className="ml-auto text-[10px] font-semibold normal-case tracking-normal">{data.recent.length}</span>
              <Chevron open={recentOpen} />
            </button>
            {recentOpen && (
              data.recent.length === 0 ? (
                <p className="py-1.5 text-[11px] text-fg-muted">Nobody has beaten the {name} yet.</p>
              ) : (
                <ul className="mt-1 max-h-64 divide-y divide-line-subtle/40 overflow-y-auto">
                  {data.recent.map((row) => (
                    <li key={row.id} className="py-1.5 text-[12px]">
                      <div className="flex items-center gap-2">
                        <Name row={row} onOpenPlayer={onOpenPlayer} />
                        {row.level != null && <span className="text-[11px] tabular-nums text-fg-muted">L{row.level}</span>}
                        {row.party && <span className="rounded border border-line-strong/60 px-1 text-[9px] font-bold uppercase tracking-[0.06em] text-fg-secondary">party</span>}
                        <span className="ml-auto text-[11px] tabular-nums text-fg-disabled">{ago(row.at)}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] tabular-nums text-fg-muted">
                        <span>{row.turns} turn{row.turns === 1 ? '' : 's'}</span>
                        <span title="Damage dealt and taken">{row.dealt.toLocaleString()} dealt · {row.taken.toLocaleString()} taken</span>
                        {row.maxHit > 0 && <span title="Biggest single hit">best hit {row.maxHit.toLocaleString()}</span>}
                        {row.xpEarned > 0 && <span className="text-status-success">+{row.xpEarned.toLocaleString()} XP</span>}
                        {row.goldEarned > 0 && <span className="text-resource-gold">+{row.goldEarned.toLocaleString()} gold</span>}
                        {row.drops.length > 0 && <span className="text-fg-primary">{row.drops.join(', ')}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface RecordDrop {
  slug: string
  name: string
  icon: string | null
  qty: string
  chance: string
  had: boolean
}

interface EnemyRecord {
  success: boolean
  enemy: { slug: string; description: string; traits: string[]; drops: RecordDrop[] }
  record: {
    kills: number
    firstKillAt: string | null
    firstKillLevel: number | null
    fastestWin: number | null
    biggestHit: number
    killedYou: number
    fled: number
  }
}

/**
 * The enemy's own page, the bestiary card's facts in the room: what it is
 * (the registry's numbers and tags, its description and traits), your record
 * against it, and its drops — only those that have reached you, the rest a
 * count, by the bestiary's rule. The record route answers before a first
 * kill too, with zeros.
 */
function EnemyPage({ slug, name }: BossInfoProps) {
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  // A kill or a chest open may have brought a drop: fetch the record again.
  const kills = useGameStore((s) => s.killList.find((k) => k.monster === slug)?.kills ?? 0)
  const chestOpened = useGameStore((s) => s.currentRoom?.bossRest?.slug === slug && s.currentRoom.bossRest.chest?.opened === true)
  const [data, setData] = useState<EnemyRecord | null>(null)
  const [failed, setFailed] = useState(false)
  const enemy = rosterEnemy(slug)
  const restMinutes = restMinutesForSlug(slug)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    fetch(`/api/enemies/${encodeURIComponent(slug)}/record`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((json: EnemyRecord) => {
        if (cancelled) return
        if (!json?.success) setFailed(true)
        else setData(json)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, getAuthHeaders, kills, chestOpened])

  const recordKills = data?.record.kills ?? kills
  const found = data?.enemy.drops.filter((drop) => drop.had).length ?? 0

  return (
    <div className="space-y-2" aria-label={`About the ${name}`}>
      <div className="flex items-start gap-2.5">
        {enemy && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-subtle/60 bg-surface-raised/60" aria-hidden="true">
            <Icon name={enemy.icon} size={30} className="text-mood-danger" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] text-fg-muted">
            {enemy ? <>Lv. {enemy.level} · {enemy.zone} · {enemy.hp} HP · ATT {enemy.att} · DEF {enemy.def}</> : name}
          </p>
          <div className="flex flex-wrap gap-1">
            {enemy?.rank && <Tag tone="text-mood-danger border-mood-danger/60">{enemy.rank === 'boss' ? 'Boss' : 'Mini-boss'}</Tag>}
            {enemy && <Tag>{enemy.damageType === 'MAGIC' ? 'Magic' : enemy.damageType === 'RANGED' ? 'Ranged' : 'Melee'}</Tag>}
            {enemy?.isAggressive ? <Tag>Aggressive</Tag> : enemy ? <Tag>Neutral</Tag> : null}
            {enemy?.isFlying && <Tag>Flying</Tag>}
            {enemy?.lair && <Tag tone="text-hue-sky border-hue-sky/50">Lair · teleport open</Tag>}
            {restMinutes > 0 && <Tag tone="text-status-info border-status-info/50">Cooldown {formatRestMinutes(restMinutes)}</Tag>}
            {data?.enemy.traits.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
          {data?.enemy.description && <p className="text-[12px] leading-snug text-fg-secondary">{data.enemy.description}</p>}
        </div>
      </div>

      {failed && <p className="text-xs text-status-error">Could not load its record. Try again in a moment.</p>}
      {!data && !failed && <p className="py-1 text-center text-xs text-fg-muted">…</p>}

      {data && (
        <div className="grid grid-cols-1 gap-1.5 @md:grid-cols-2">
          <div className="rounded-lg bg-surface-sunken px-2.5 py-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-fg-muted">Your record</p>
              <span className="ml-auto text-[13px] font-bold tabular-nums text-resource-gold">
                {recordKills.toLocaleString()} <span className="text-[10px] font-medium text-fg-muted">kill{recordKills === 1 ? '' : 's'}</span>
              </span>
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
              <Fact label="First kill" value={data.record.firstKillAt ? `${day(data.record.firstKillAt)}${data.record.firstKillLevel ? ` · L${data.record.firstKillLevel}` : ''}` : '—'} />
              <Fact label="Fastest win" value={data.record.fastestWin ? `${data.record.fastestWin} turn${data.record.fastestWin === 1 ? '' : 's'}` : '—'} />
              <Fact label="Biggest hit" value={data.record.biggestHit > 0 ? data.record.biggestHit.toLocaleString() : '—'} />
              <Fact label="Killed you" value={data.record.killedYou.toLocaleString()} tone={data.record.killedYou > 0 ? 'text-status-error' : undefined} />
              <Fact label="Fled" value={data.record.fled.toLocaleString()} />
            </dl>
          </div>
          {/* The drops as a checklist (5 Nov 2026, "a mini achievement"):
              every drop named, a green check once it has reached you. The
              bestiary card keeps its rule of naming only what you have seen;
              a boss's page shows the whole list so there is something to
              collect toward. */}
          <div className="rounded-lg bg-surface-sunken px-2.5 py-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-fg-muted">Drops</p>
              {data.enemy.drops.length > 0 && (
                <span className={`ml-auto text-[10px] font-semibold tabular-nums ${found === data.enemy.drops.length ? 'text-status-success' : 'text-fg-muted'}`}>
                  {found} of {data.enemy.drops.length} found{found === data.enemy.drops.length ? ' ✓' : ''}
                </span>
              )}
            </div>
            {data.enemy.drops.length === 0 ? (
              <p className="py-1 text-[11px] text-fg-muted">It drops nothing but the gold.</p>
            ) : (
              <ul className="mt-0.5 divide-y divide-line-subtle/40">
                {data.enemy.drops.map((drop, i) => (
                  <li
                    key={`${drop.slug}-${i}`}
                    className={`flex min-h-[24px] items-center gap-1.5 text-[11.5px] ${drop.had ? '' : 'opacity-60'}`}
                    title={drop.had ? `${drop.name}: found` : `${drop.name}: not found yet`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${drop.had ? 'border-status-success bg-status-success/20 text-status-success' : 'border-line-strong/60'}`}
                      aria-hidden="true"
                    >
                      {drop.had && (
                        <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </span>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                      {/* Most items carry no metadata icon; the slug finds it, as on the victory card. */}
                      <Icon name={resolveItemIcon(drop.icon ? { icon: drop.icon } : null, drop.slug)} size={14} className={drop.had ? 'text-status-success' : 'text-fg-secondary'} />
                    </span>
                    <span className={`truncate ${drop.had ? 'font-medium text-status-success' : 'text-fg-primary'}`}>
                      {drop.name}{drop.qty}
                      <span className="sr-only">{drop.had ? ', found' : ', not found yet'}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-fg-muted">{drop.chance}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={`ml-auto text-right font-medium ${tone ?? 'text-fg-bright'}`}>{value}</dd>
    </div>
  )
}

function Tag({ children, tone = 'text-fg-secondary border-line-strong/60' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`rounded-[3px] border px-1.5 text-[9px] font-bold uppercase tracking-[0.06em] leading-[16px] ${tone}`}>{children}</span>
}

interface NamedRow {
  playerId: string
  username: string
  isYou: boolean
}

/** One board: its leader, and the Top 5 behind a fold. */
function Board<R extends NamedRow>({
  label,
  hint,
  rows,
  detail,
  onOpenPlayer,
}: {
  label: string
  hint?: string
  rows: R[]
  detail: (row: R) => string
  onOpenPlayer?: (player: BoardPlayer) => void
}) {
  const [open, toggle] = useFold()
  const leader = rows[0]
  const canExpand = rows.length > 1
  return (
    <div className="rounded-lg bg-surface-sunken px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => canExpand && toggle()}
        disabled={!canExpand}
        aria-expanded={canExpand ? open && canExpand : undefined}
        title={canExpand ? (open ? 'Show the leader only' : `Show the top ${rows.length}`) : hint}
        className="flex w-full items-center gap-1.5 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-fg-muted enabled:hover:text-fg-primary"
      >
        <span>{label}</span>
        {hint && <span className="hidden font-normal normal-case tracking-normal text-fg-disabled @md:inline">{hint}</span>}
        {canExpand && (
          <>
            <span className="ml-auto text-[10px] font-semibold normal-case tracking-normal">Top {rows.length}</span>
            <Chevron open={open} />
          </>
        )}
      </button>
      {!leader ? (
        <p className="text-[11px] text-fg-muted">—</p>
      ) : open && canExpand ? (
        <ol className="mt-1 space-y-0.5">
          {rows.map((row, i) => (
            <li key={row.playerId} className="flex items-baseline gap-1.5 text-[12px]">
              <span className="w-3 shrink-0 text-[10px] font-bold tabular-nums text-fg-disabled">{i + 1}</span>
              <Name row={row} onOpenPlayer={onOpenPlayer} />
              <span className="ml-auto text-right text-[11px] tabular-nums text-fg-muted">{detail(row)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-baseline gap-1.5 text-[13px]">
          <Name row={leader} className="font-semibold" onOpenPlayer={onOpenPlayer} />
          <span className="ml-auto text-right text-[11px] tabular-nums text-fg-muted">{detail(leader)}</span>
        </div>
      )}
    </div>
  )
}

/** The player's name, gold when it is the viewer's own; a button that opens their card. */
function Name({ row, className = 'font-medium', onOpenPlayer }: { row: NamedRow; className?: string; onOpenPlayer?: (player: BoardPlayer) => void }) {
  const tone = `truncate ${className} ${row.isYou ? 'text-resource-gold' : 'text-fg-bright'}`
  if (!onOpenPlayer) return <span className={tone}>{row.username}</span>
  return (
    <button
      type="button"
      onClick={() => onOpenPlayer({ id: row.playerId, username: row.username, level: 'level' in row && typeof row.level === 'number' ? row.level : 0 })}
      title={`Open ${row.username}'s card`}
      className={`${tone} rounded text-left hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
    >
      {row.username}
    </button>
  )
}

/** A chevron that points down when the thing is folded and up when it is open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
