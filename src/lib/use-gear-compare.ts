'use client'

import { createBooleanDeviceSetting } from './device-setting'

/**
 * Whether inventory, shop and crafting rows show the "what changes if I equip
 * this" box. Off by default; toggled from the sort flyout and the crafting
 * sheet. A per-device convenience kept in localStorage, never anything the
 * server cares about.
 */
export const useGearCompareSetting = createBooleanDeviceSetting('lg:gear-compare')
