/**
 * Single source of truth for shop pricing, shared by the client (display) and
 * the buy/sell API routes (authoritative charge) so they can never drift.
 *
 * - Buy price is a markup over the item's base value.
 * - Sell value is a fraction of the item's base value.
 */
export const BUY_PRICE_MULTIPLIER = 1
export const SELL_VALUE_RATIO = 0.1

/** Gold cost to buy one unit of an item with the given base value. */
export const getBuyPrice = (value: number): number =>
  Math.floor(value * BUY_PRICE_MULTIPLIER)

/** Gold received for selling one unit of an item with the given base value. */
export const getSellValue = (value: number): number =>
  Math.floor(value * SELL_VALUE_RATIO)
