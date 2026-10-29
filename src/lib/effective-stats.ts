'use client'

import type { InventoryItem, Player } from '@/lib/game-state'
import { gearContextFromInventory, passiveSkillBonuses } from '@/lib/skillbook'

const { getStatBuffBonuses, getStatBuffSources } = require('@/lib/game-engine/services/buff-service') as {
  getStatBuffBonuses: (row: Record<string, number> | null | undefined) => { str: number; dex: number; mag: number; def: number }
  getStatBuffSources: (row: Record<string, number> | null | undefined) => Record<StatKey, BuffSource[]>
}

export type StatKey = 'str' | 'dex' | 'mag' | 'def'
export const STAT_KEYS: readonly StatKey[] = ['str', 'dex', 'mag', 'def']

/** One buff's share of a stat: "+12 Iron Skin, 40 clicks left". `clicks` is null for a standing aura. */
export interface BuffSource {
  field: string
  label: string
  amount: number
  clicks: number | null
}

export interface StatBreakdown {
  /** The core stat, spent with CP. */
  core: number
  /** Equipment — the derived *Mod column the server recomputes on every equip. */
  gear: number
  /** Running click-counted buffs and standing auras. */
  buff: number
  /** The buffs behind `buff`, one entry each, so a tooltip can name them. */
  buffSources: BuffSource[]
  /** Passive skills for what is in hand right now. */
  skill: number
  total: number
}

export type EffectiveStats = Record<StatKey, StatBreakdown>

/**
 * The four stats as combat rolls them (BattleState.applyStats): core, plus
 * equipment, plus any running buff or standing aura, plus the passive skills
 * for what is in hand. One formula for the header, the character panel and
 * anything else that shows a stat, so the number a player reads is the
 * number the next swing uses.
 */
export function effectiveStats(player: Player | null | undefined, inventory: InventoryItem[]): EffectiveStats {
  const buff = getStatBuffBonuses(player?.buffs ?? null)
  const sources = getStatBuffSources(player?.buffs ?? null)
  const skill = passiveSkillBonuses(player, gearContextFromInventory(inventory), { str: player?.strMod ?? 0, dex: player?.dexMod ?? 0 })
  const build = (key: StatKey): StatBreakdown => {
    const core = player?.[key] ?? 0
    const gear = player?.[`${key}Mod` as `${StatKey}Mod`] ?? 0
    const buffPart = buff[key]
    const skillPart = key === 'mag' ? 0 : skill[key]
    return { core, gear, buff: buffPart, buffSources: sources[key] ?? [], skill: skillPart, total: core + gear + buffPart + skillPart }
  }
  return { str: build('str'), dex: build('dex'), mag: build('mag'), def: build('def') }
}

/**
 * "STR 61 = 20 core + 8 gear + 30 Strength (87 clicks) + 3 skill", for a
 * tooltip. Each running buff is named with the clicks it has left, so the
 * player can tell a capsule from Iron Skin and see which one is about to go.
 */
export function describeStat(label: string, breakdown: StatBreakdown): string {
  const parts = [`${breakdown.core} core`]
  if (breakdown.gear) parts.push(`${breakdown.gear > 0 ? '+' : ''}${breakdown.gear} gear`)
  if (breakdown.buffSources.length > 0) {
    for (const source of breakdown.buffSources) {
      parts.push(`+${source.amount} ${source.label}${source.clicks !== null ? ` (${source.clicks} click${source.clicks === 1 ? '' : 's'})` : ''}`)
    }
  } else if (breakdown.buff) {
    parts.push(`+${breakdown.buff} buff`)
  }
  if (breakdown.skill) parts.push(`+${breakdown.skill} skill`)
  return `${label} ${breakdown.total} = ${parts.join(' ')}`
}
