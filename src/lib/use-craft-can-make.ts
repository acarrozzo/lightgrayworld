'use client'

import { createBooleanDeviceSetting } from './device-setting'

/**
 * The crafting sheet's "Can make" chip: hide every recipe the bag can't pay
 * for right now. Off by default so the sheet doubles as a recipe book.
 */
export const useCraftCanMakeSetting = createBooleanDeviceSetting('lg:craft-can-make')
