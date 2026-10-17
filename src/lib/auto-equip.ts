'use client'

import { createBooleanDeviceSetting } from './device-setting'
import { effectiveStats, STAT_KEYS, type StatKey } from './effective-stats'
import type { InventoryItem, Player } from './game-state'

/**
 * The MAX row on the character panel: the original's `max 1h / 2h / dex / mag`
 * buttons. Each chip sends one `auto_equip` action; the server plans and
 * applies the whole loadout (services/auto-equip-service.js). The mode ids,
 * the labels, and the hover flyout's preview live here; it runs the same
 * planner the server does (game-data/auto-equip-plan.js) on the store's
 * rows, and is only ever a preview.
 */
export type AutoEquipMode = 'str1h' | 'str2h' | 'dex' | 'mag' | 'def'

export interface AutoEquipModeDef {
  id: AutoEquipMode
  label: string
  title: string
  /** Chip colour: the stat the mode maximises, in the same roles Core Stats use. */
  className: string
}

const STR_CHIP = 'text-stat-str border-stat-str/50 bg-stat-str/10 hover:bg-stat-str/25'
const DEX_CHIP = 'text-stat-dex border-stat-dex/50 bg-stat-dex/10 hover:bg-stat-dex/25'
const MAG_CHIP = 'text-stat-mag border-stat-mag/50 bg-stat-mag/10 hover:bg-stat-mag/25'
const DEF_CHIP = 'text-stat-def border-stat-def/50 bg-stat-def/10 hover:bg-stat-def/25'

export const AUTO_EQUIP_MODES: readonly AutoEquipModeDef[] = [
  { id: 'str1h', label: '1H', title: 'Best one-handed weapon, off-hand item and gear for STR', className: STR_CHIP },
  { id: 'str2h', label: '2H', title: 'Best two-handed weapon and gear for STR', className: STR_CHIP },
  { id: 'dex', label: 'DEX', title: 'Best ranged weapon and gear for DEX', className: DEX_CHIP },
  { id: 'mag', label: 'MAG', title: 'Best weapon and gear for MAG', className: MAG_CHIP },
  { id: 'def', label: 'DEF', title: 'Best shield, armor and gear for DEF', className: DEF_CHIP },
]

/**
 * Whether auto-equip passes over items that carry a negative stat. Off by
 * default, as the original included them. A per-device convenience kept in
 * localStorage and sent along with each request; the server only trusts the
 * flag, never the loadout.
 */
export const useAutoEquipSkipNegatives = createBooleanDeviceSetting('lg:auto-equip-skip-negatives')

const planner = require('@/lib/game-data/auto-equip-plan') as {
  MODES: Record<AutoEquipMode, { stat: StatKey }>
  planAutoEquip: (
    inventory: InventoryItem[],
    options: { mode: AutoEquipMode; skipNegatives?: boolean; skillLevels?: Record<string, number> | null; base?: number }
  ) => {
    stat: StatKey
    changes: unknown[]
    before: number
    after: number
    deltas: Record<StatKey, number>
  }
}

/** What one MAX chip would do if pressed now. */
export interface AutoEquipPreview {
  stat: StatKey
  changed: boolean
  /** The target stat as the header shows it, now and after. */
  before: number
  after: number
  /** Every stat as the header shows it now. */
  current: Record<StatKey, number>
  /** The change to every stat, passives included: a MAX for STR that takes a shield off costs DEF. */
  deltas: Record<StatKey, number>
  /** How many slots would change. */
  swaps: number
}

/**
 * Plan a mode on the client, from the store's player and bag. `base` is the
 * part of the stat no gear touches (core plus buffs), so `before` is the
 * header's number.
 */
export function previewAutoEquip(player: Player | null | undefined, inventory: InventoryItem[], mode: AutoEquipMode, skipNegatives: boolean): AutoEquipPreview {
  const { stat: key } = planner.MODES[mode]
  const stats = effectiveStats(player, inventory)
  const plan = planner.planAutoEquip(inventory, { mode, skipNegatives, skillLevels: player?.skills ?? null, base: stats[key].core + stats[key].buff })
  return {
    stat: plan.stat,
    changed: plan.changes.length > 0,
    before: plan.before,
    after: plan.after,
    current: { str: stats.str.total, dex: stats.dex.total, mag: stats.mag.total, def: stats.def.total },
    deltas: plan.deltas,
    swaps: plan.changes.length,
  }
}

/**
 * The flyout's rows: the stat being maximized first, then any other stat the
 * swap moves, each from where it is to where it would land.
 */
export function previewRows(preview: AutoEquipPreview): Array<{ stat: StatKey; from: number; to: number; delta: number }> {
  const keys = [preview.stat, ...STAT_KEYS.filter((key) => key !== preview.stat && preview.deltas[key] !== 0)]
  return keys.map((key) => ({ stat: key, from: preview.current[key], to: preview.current[key] + preview.deltas[key], delta: preview.deltas[key] }))
}
