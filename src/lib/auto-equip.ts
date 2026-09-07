'use client'

import { createBooleanDeviceSetting } from './device-setting'

/**
 * The MAX row on the character panel: the original's `max 1h / 2h / dex / mag`
 * buttons. Each chip sends one `auto_equip` action; the server plans and
 * applies the whole loadout (services/auto-equip-service.js). Only the mode
 * ids and the labels live here.
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
