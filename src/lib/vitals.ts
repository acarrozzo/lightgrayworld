/**
 * The arithmetic behind every vitals bar, in one place.
 *
 * `VitalBar` draws from these; the party's squad reading, the header's regen
 * float and the battle HUD all ask the same questions of a current/max pair,
 * and used to answer them each in their own way. The thresholds are the
 * party's: a teammate is "hurt" at a quarter, and so are you.
 */

import { LOW_HP_FRACTION } from '@/lib/party/squad'

/** Under a tenth the bar pulses. Rest, or leave. */
export const CRITICAL_HP_FRACTION = 0.1

export type VitalState = 'empty' | 'critical' | 'low' | 'ok' | 'over'

/** The fill, 0–100, with over-max clamped to a full bar. */
export function vitalPct(current: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.max(0, Math.min(100, (current / max) * 100))
}

/** How much of `amount` would actually land, with the bar's ceiling in the way. */
export function healThatLands(current: number, max: number, amount: number): number {
  if (amount <= 0 || current >= max) return 0
  return Math.min(max, current + amount) - current
}

/** The part of the bar a hovered restorer would add, as a share past the current fill. */
export function previewPct(current: number, max: number, amount: number): number {
  if (!(max > 0)) return 0
  return (healThatLands(current, max, amount) / max) * 100
}

/** What the number means right now, for the fill to say in colour. */
export function vitalState(current: number, max: number): VitalState {
  if (!(max > 0) || current <= 0) return 'empty'
  if (current > max) return 'over'
  const share = current / max
  if (share <= CRITICAL_HP_FRACTION) return 'critical'
  if (share <= LOW_HP_FRACTION) return 'low'
  return 'ok'
}

/** How far past the ceiling the number is, or 0. The "+8" after a Glory HP. */
export function vitalOverflow(current: number, max: number): number {
  return current > max ? current - max : 0
}

/** "42/60", the one way the number is written. */
export function formatVital(current: number, max: number): string {
  return `${Math.max(0, Math.min(current, max))}/${max}`
}
