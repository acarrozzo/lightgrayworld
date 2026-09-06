'use client'

import React from 'react'
import Icon from './Icon'

interface Reward {
  type: 'xp' | 'currency' | string
  amount?: number
  name?: string
  quantity?: number
  highlighted?: boolean
}

interface LevelUp {
  leveled: boolean
  newLevel: number
}

export interface NewQuestEntry {
  title: string
  objective: string | null
}

export interface QuestStanding {
  factionId: string
  name: string
  done: number
  total: number
  complete: boolean
  title: string | null
}

export interface QuestCompleteData {
  /** Null when meeting a giver: meeting someone is not a completed piece of work. */
  questTitle: string | null
  rewards: Reward[]
  levelUp: LevelUp | null
  newQuestTitles: (string | NewQuestEntry)[]
  /** Standing with the giver's faction after this turn-in; absent for the Pillar. */
  standing?: QuestStanding | null
  /** This turn-in was a guild's initiation. */
  becameMember?: boolean
}

interface Props {
  data: QuestCompleteData
}

export default function QuestCompleteRewards({ data }: Props) {
  const { rewards, levelUp, newQuestTitles, standing, becameMember } = data

  const xpReward = rewards.find(r => r.type === 'xp')
  const currencyReward = rewards.find(r => r.type === 'currency')
  // Featured (highlighted) items render first with special styling.
  const itemRewards = rewards
    .filter(r => r.type === 'item')
    .sort((a, b) => (b.highlighted ? 1 : 0) - (a.highlighted ? 1 : 0))

  // An intro quest pays nothing and only opens the giver's set, so the trophy
  // heading stays out of the way and the New Quests list carries the moment.
  const hasRewards = !!xpReward || !!currencyReward || itemRewards.length > 0 || !!levelUp
  const hasContent = hasRewards || newQuestTitles.length > 0 || !!standing

  if (!hasContent) return null

  return (
    <div className="mt-2 border-t border-line-subtle/60 pt-4 pb-2">
      {data.questTitle && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-status-success mb-0.5">Quest Completed</p>
          <p className="text-sm font-semibold text-fg-primary">{data.questTitle}</p>
        </div>
      )}
      {hasRewards && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <Icon name="trophy" size={16} className="text-status-warning" />
          <span className="text-xs font-semibold uppercase tracking-wider text-status-warning">
            Rewards
          </span>
        </div>
      )}

      <div className="space-y-2">
        {levelUp && (
          <div className="flex items-center justify-center gap-3 rounded-md bg-status-warning/10 border border-status-warning/30 px-3 py-2">
            <Icon name="character" size={20} className="text-status-warning shrink-0" />
            <span className="text-sm font-semibold text-status-warning">
              Level Up! You are now level {levelUp.newLevel}.
            </span>
          </div>
        )}

        {xpReward && (
          <div className="flex items-center justify-center gap-3 rounded-md bg-surface-raised/60 px-3 py-2">
            <Icon name="attack" size={20} className="text-resource-mp shrink-0" />
            <span className="text-sm text-fg-bright">
              <span className="font-semibold text-resource-mp">+{xpReward.amount} XP</span>
            </span>
          </div>
        )}

        {currencyReward && (
          <div className="flex items-center justify-center gap-3 rounded-md bg-surface-raised/60 px-3 py-2">
            <Icon name="chest" size={20} className="text-status-warning shrink-0" />
            <span className="text-sm text-fg-bright">
              <span className="font-semibold text-status-warning">+{currencyReward.amount} Gold</span>
            </span>
          </div>
        )}

        {itemRewards.map((item, i) =>
          item.highlighted ? (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-resource-gold/60 bg-gradient-to-b from-resource-gold/20 to-resource-gold/10 px-3 py-2.5 shadow-[0_0_12px_color-mix(in_srgb,var(--resource-gold)_35%,transparent)]"
            >
              <div className="flex items-center gap-1.5">
                <Icon name="trophy" size={14} className="text-resource-gold" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-resource-gold">Rare Find</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Icon name="inv" size={20} className="text-resource-gold shrink-0" />
                <span className="text-sm font-bold text-resource-gold">
                  {item.name || 'Item'}{item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-center justify-center gap-3 rounded-md bg-surface-raised/60 px-3 py-2">
              <Icon name="inv" size={20} className="text-status-success shrink-0" />
              <span className="text-sm font-semibold text-status-success">
                {item.name || 'Item'}{item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}
              </span>
            </div>
          )
        )}

        {standing && (
          <div className={`mt-1 rounded-md px-3 py-2 ${standing.complete ? 'border border-resource-gold/60 bg-resource-gold/10' : 'bg-surface-raised/60'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{standing.name}</span>
              <span className={`text-xs font-bold tabular-nums ${standing.complete ? 'text-resource-gold' : 'text-fg-bright'}`}>
                {standing.done}/{standing.total}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-panel/60">
              <div
                className={`h-full rounded-full ${standing.complete ? 'bg-resource-gold' : 'bg-resource-mp'}`}
                style={{ width: `${standing.total > 0 ? Math.round((standing.done / standing.total) * 100) : 0}%` }}
              />
            </div>
            {becameMember && (
              <div className="mt-1.5 text-center text-xs text-status-success">You are now a member of the {standing.name}.</div>
            )}
            {standing.complete && standing.title && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <Icon name="trophy" size={14} className="text-resource-gold" />
                <span className="text-sm font-bold text-resource-gold">{standing.title}</span>
              </div>
            )}
          </div>
        )}

        {newQuestTitles.length > 0 && (
          <div className="mt-1 rounded-md bg-surface-raised/60 px-3 py-2">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <Icon name="inv" size={16} className="text-stat-mag shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-stat-mag">
                New {newQuestTitles.length === 1 ? 'Quest' : 'Quests'}
              </span>
            </div>
            <ul className="space-y-1.5">
              {newQuestTitles.map((entry, i) => {
                const title = typeof entry === 'string' ? entry : entry.title
                const objective = typeof entry === 'string' ? null : entry.objective
                return (
                  <li key={i} className="text-center">
                    <div className="text-sm text-stat-mag">{title}</div>
                    {objective && (
                      <div className="text-xs text-stat-mag/60 mt-0.5">{objective}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
