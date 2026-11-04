'use client'

import { useEffect, useState } from 'react'
import FightLedger from '@/components/FightLedger'
import { PlayerAvatar } from '@/components/player/PlayerRow'
import { asLedgerTurns, type LedgerTurn } from '@/lib/fight-ledger'
import { rosterEnemy, toneStyle } from '@/lib/kill-list'

interface ReplayPayload {
  battle: {
    id: string
    enemySlug: string
    enemyName: string
    turnsCount: number
    totalDamageDealt: number
    totalDamageReceived: number
    maxSingleHit: number
    xpEarned: number
    goldEarned: number
    itemsDropped: string[]
    multiplayerBonus: boolean
    turns: unknown
    playerLevel: number | null
    playerXp: number | null
    snapshot: { hp?: number | null; hpMax?: number | null; str?: number; def?: number; dex?: number; mag?: number; loadout?: string[] } | null
    createdAt: string
  }
  player: { id: string; username: string; level: number; uIcon: string | null; uIconColor: string | null }
  enemy: { slug: string; name: string; level: number; hp: number; att: number; def: number; rank: string | null; damageType: string | null; icon: string | null } | null
}

interface FightReplayProps {
  battleId: string
  backLabel: string
  getAuthHeaders: () => Record<string, string>
  onBack: () => void
  onOpenPlayerProfile?: (player: { id: string; username: string; level: number; uIcon?: string | null; uIconColor?: string | null }) => void
}

/**
 * Another player's win, turn by turn, as the server resolved it. The
 * bestiary's "First to fell" board opens it: both sides as the fight began
 * (the player from the row's snapshot, the enemy from the registry), the
 * fight's totals, every turn in the same ledger the Battle Log uses, and
 * the rewards. Nothing here can be edited; a lost or abandoned fight is
 * never shown — the route serves wins alone.
 */
export default function FightReplay({ battleId, backLabel, getAuthHeaders, onBack, onOpenPlayerProfile }: FightReplayProps) {
  const [data, setData] = useState<ReplayPayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    fetch(`/api/battles/${encodeURIComponent(battleId)}`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setData(json)
        else setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [battleId, getAuthHeaders])

  const back = (
    <button type="button" onClick={onBack} className="rounded px-1 py-1 text-[12px] text-fg-muted hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
      ‹ {backLabel}
    </button>
  )

  if (failed) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-status-error">That fight is not on record.</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-fg-muted">Loading the fight...</p>
      </div>
    )
  }

  const { battle, player, enemy } = data
  const turns: LedgerTurn[] = asLedgerTurns(battle.turns)
  const snap = battle.snapshot ?? {}
  const lastHp = turns.length > 0 ? turns[turns.length - 1].hp.you : null
  const roster = rosterEnemy(battle.enemySlug)
  const date = new Date(battle.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const rankLabel = enemy?.rank === 'boss' ? 'Boss' : enemy?.rank === 'miniboss' ? 'Mini-boss' : null
  const typeLabel = enemy?.damageType === 'MAGIC' ? 'Magic' : enemy?.damageType === 'RANGED' ? 'Ranged' : enemy?.damageType ? 'Melee' : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {back}
        <span className="ml-auto text-[11px] text-fg-muted">{date} · {battle.turnsCount} turns</span>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-line-subtle/60 bg-surface-panel/60 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-status-success">
            <PlayerAvatar uIcon={player.uIcon} uIconColor={player.uIconColor} />
            <span className="truncate">{player.username}</span>
          </span>
          <span className="flex flex-wrap gap-x-2 text-[10px] text-fg-muted tabular-nums">
            <span>Lv <b className="font-semibold text-fg-secondary">{battle.playerLevel ?? '?'}</b></span>
            {battle.playerXp !== null && <span>XP <b className="font-semibold text-fg-secondary">{battle.playerXp.toLocaleString()}</b></span>}
            {typeof snap.hp === 'number' && <span>HP <b className="font-semibold text-fg-secondary">{snap.hp}{typeof snap.hpMax === 'number' ? ` / ${snap.hpMax}` : ''}</b></span>}
          </span>
          {typeof snap.str === 'number' && (
            <span className="flex flex-wrap gap-x-2 text-[10px] text-fg-muted tabular-nums">
              <span>STR <b className="font-semibold text-fg-secondary">{snap.str}</b></span>
              <span>DEF <b className="font-semibold text-fg-secondary">{snap.def}</b></span>
              <span>DEX <b className="font-semibold text-fg-secondary">{snap.dex}</b></span>
              <span>MAG <b className="font-semibold text-fg-secondary">{snap.mag}</b></span>
            </span>
          )}
          {snap.loadout && snap.loadout.length > 0 && <span className="text-[10px] text-fg-disabled">{snap.loadout.join(' · ')}</span>}
        </div>
        <span className="self-center text-[10px] text-fg-disabled">vs</span>
        <div className="flex min-w-0 flex-1 flex-col items-end gap-1 text-right">
          <span className="truncate text-[13px] font-bold text-mood-danger" style={toneStyle(roster?.nameTone)}>{battle.enemyName}</span>
          {enemy && (
            <>
              <span className="flex flex-wrap justify-end gap-x-2 text-[10px] text-fg-muted tabular-nums">
                <span>Lv <b className="font-semibold text-fg-secondary">{enemy.level}</b></span>
                <span>HP <b className="font-semibold text-fg-secondary">{enemy.hp}</b></span>
              </span>
              <span className="flex flex-wrap justify-end gap-x-2 text-[10px] text-fg-muted tabular-nums">
                <span>ATT <b className="font-semibold text-fg-secondary">{enemy.att}</b></span>
                <span>DEF <b className="font-semibold text-fg-secondary">{enemy.def}</b></span>
              </span>
              {(rankLabel || typeLabel) && <span className="text-[10px] text-fg-disabled">{[rankLabel, typeLabel].filter(Boolean).join(' · ')}</span>}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] text-fg-muted">
        <Chip label="Dealt" value={battle.totalDamageDealt} />
        <Chip label="Took" value={battle.totalDamageReceived} />
        <Chip label="Best hit" value={battle.maxSingleHit} tone="text-resource-gold" />
        {lastHp !== null && <Chip label="Won with" value={`${lastHp} HP`} tone="text-resource-hp" className="ml-auto" />}
      </div>

      <div className="rounded-xl border border-line-subtle/60 bg-surface-panel/60">
        <FightLedger turns={turns} enemyName={battle.enemyName} compact className="py-1" emptyText="No turn record for this fight (it predates the ledger)." />
        <div className="space-y-1 border-t border-line-subtle/40 px-3 py-2.5 text-[11px] text-fg-secondary">
          <span className="block font-bold text-status-success">Victory</span>
          <span className="block">
            <span className="text-status-success">+{battle.xpEarned} XP</span> · <span className="text-resource-gold">+{battle.goldEarned} gold</span>
            {battle.itemsDropped.length > 0 && <> · {battle.itemsDropped.join(' · ')}</>}
            {battle.multiplayerBonus && <span className="text-resource-mp"> · group</span>}
          </span>
          <span className="block pt-1 text-[10px] text-fg-disabled">This is the fight as the server resolved it, turn by turn. Nothing here can be edited.</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-line-strong/60 text-[12px] font-semibold text-fg-secondary hover:bg-surface-raised/40 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          Back to the {battle.enemyName}
        </button>
        {onOpenPlayerProfile && (
          <button
            type="button"
            onClick={() => onOpenPlayerProfile({ id: player.id, username: player.username, level: player.level, uIcon: player.uIcon, uIconColor: player.uIconColor })}
            className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-line-strong/60 text-[12px] font-semibold text-fg-secondary hover:bg-surface-raised/40 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {player.username}&apos;s profile
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value, tone = 'text-fg-secondary', className = '' }: { label: string; value: string | number; tone?: string; className?: string }) {
  return (
    <span className={`rounded border border-line-subtle/60 bg-surface-panel/60 px-1.5 py-0.5 tabular-nums ${className}`}>
      {label} <b className={`font-semibold ${tone}`}>{value}</b>
    </span>
  )
}
