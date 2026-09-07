'use client'

import type { InventoryItem, Player } from '@/lib/game-state'
import { gearContextFromInventory, passiveSkillBonuses } from '@/lib/skillbook'

const { getStatBuffBonuses } = require('@/lib/game-engine/services/buff-service') as {
  getStatBuffBonuses: (row: Record<string, number> | null | undefined) => { str: number; dex: number; mag: number; def: number }
}

export type StatKey = 'str' | 'dex' | 'mag' | 'def'
export const STAT_KEYS: readonly StatKey[] = ['str', 'dex', 'mag', 'def']

export interface StatBreakdown {
  /** The core stat, spent with CP. */
  core: number
  /** Equipment — the derived *Mod column the server recomputes on every equip. */
  gear: number
  /** Running click-counted buffs and standing auras. */
  buff: number
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
  const skill = passiveSkillBonuses(player, gearContextFromInventory(inventory))
  const build = (key: StatKey): StatBreakdown => {
    const core = player?.[key] ?? 0
    const gear = player?.[`${key}Mod` as `${StatKey}Mod`] ?? 0
    const buffPart = buff[key]
    const skillPart = key === 'mag' ? 0 : skill[key]
    return { core, gear, buff: buffPart, skill: skillPart, total: core + gear + buffPart + skillPart }
  }
  return { str: build('str'), dex: build('dex'), mag: build('mag'), def: build('def') }
}

/** "STR 31 = 20 core + 8 gear + 3 skill", for a tooltip. */
export function describeStat(label: string, breakdown: StatBreakdown): string {
  const parts = [`${breakdown.core} core`]
  if (breakdown.gear) parts.push(`${breakdown.gear > 0 ? '+' : ''}${breakdown.gear} gear`)
  if (breakdown.buff) parts.push(`+${breakdown.buff} buff`)
  if (breakdown.skill) parts.push(`+${breakdown.skill} skill`)
  return `${label} ${breakdown.total} = ${parts.join(' ')}`
}
