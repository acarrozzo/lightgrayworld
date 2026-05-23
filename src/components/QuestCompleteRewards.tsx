'use client'

import React from 'react'
import Icon from './Icon'

interface Reward {
  type: 'xp' | 'currency' | string
  amount?: number
  name?: string
}

interface LevelUp {
  leveled: boolean
  newLevel: number
}

export interface NewQuestEntry {
  title: string
  objective: string | null
}

export interface QuestCompleteData {
  questTitle: string
  rewards: Reward[]
  levelUp: LevelUp | null
  newQuestTitles: (string | NewQuestEntry)[]
}

interface Props {
  data: QuestCompleteData
}

export default function QuestCompleteRewards({ data }: Props) {
  const { rewards, levelUp, newQuestTitles } = data

  const xpReward = rewards.find(r => r.type === 'xp')
  const currencyReward = rewards.find(r => r.type === 'currency')
  const itemRewards = rewards.filter(r => r.type === 'item')

  const hasContent =
    xpReward || currencyReward || itemRewards.length > 0 || levelUp || newQuestTitles.length > 0

  if (!hasContent) return null

  return (
    <div className="mt-2 border-t border-gray-700/60 pt-4 pb-2">
      {data.questTitle && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-0.5">Quest Completed</p>
          <p className="text-sm font-semibold text-gray-300">{data.questTitle}</p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <Icon name="trophy" size={16} className="text-yellow-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
          Rewards
        </span>
      </div>

      <div className="space-y-2">
        {levelUp && (
          <div className="flex items-center gap-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
            <Icon name="character" size={20} className="text-yellow-400 shrink-0" />
            <span className="text-sm font-semibold text-yellow-300">
              Level Up! You are now level {levelUp.newLevel}.
            </span>
          </div>
        )}

        {xpReward && (
          <div className="flex items-center gap-3 rounded-md bg-gray-800/60 px-3 py-2">
            <Icon name="attack" size={20} className="text-blue-400 shrink-0" />
            <span className="text-sm text-gray-200">
              <span className="font-semibold text-blue-300">+{xpReward.amount} XP</span>
            </span>
          </div>
        )}

        {currencyReward && (
          <div className="flex items-center gap-3 rounded-md bg-gray-800/60 px-3 py-2">
            <Icon name="chest" size={20} className="text-yellow-400 shrink-0" />
            <span className="text-sm text-gray-200">
              <span className="font-semibold text-yellow-300">+{currencyReward.amount} Gold</span>
            </span>
          </div>
        )}

        {itemRewards.map((item, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md bg-gray-800/60 px-3 py-2">
            <Icon name="inv" size={20} className="text-green-400 shrink-0" />
            <span className="text-sm font-semibold text-green-300">{item.name || 'Item'}</span>
          </div>
        ))}

        {newQuestTitles.length > 0 && (
          <div className="mt-1 rounded-md bg-gray-800/60 px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name="inv" size={16} className="text-purple-400 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                New {newQuestTitles.length === 1 ? 'Quest' : 'Quests'}
              </span>
            </div>
            <ul className="space-y-1.5 pl-1">
              {newQuestTitles.map((entry, i) => {
                const title = typeof entry === 'string' ? entry : entry.title
                const objective = typeof entry === 'string' ? null : entry.objective
                return (
                  <li key={i}>
                    <div className="text-sm text-purple-200">{title}</div>
                    {objective && (
                      <div className="text-xs text-purple-300/60 mt-0.5">{objective}</div>
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
