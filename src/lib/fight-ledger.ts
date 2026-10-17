/**
 * The fight ledger, as the client reads it.
 *
 * One row per resolved turn, authored only by the server
 * (`game-engine/fight-ledger.js` is the projection; this file mirrors its
 * shape and adds the words the UI puts on a row). The same rows are drawn in
 * three places by one component (`components/FightLedger.tsx`): the Turn chip's
 * sheet during a fight, the Battle Log tab's expanded card after it, and the
 * World Tool's player page. Keep the two shape definitions in step.
 */

export type LedgerFx =
  | { k: 'poison' | 'stone' | 'absorb' | 'drainHp' | 'drainMp' | 'steal' | 'armor' | 'heal'; n: number }
  | { k: 'rise' }

export type LedgerMiss = 'flying' | 'immune-melee' | 'immune-ranged' | 'immune-magic' | 'dodged' | 'blocked'

export interface LedgerYou {
  kind: 'strike' | 'skill' | 'spell' | 'support' | 'stone' | 'none'
  name: string | null
  verb: string | null
  dmg: number
  raw: number | null
  bonus: number | null
  block: number | null
  cost: number | null
  calc: string | null
  miss: LedgerMiss | null
  melted: boolean
  helpers: { name: string; dmg: number }[]
  effect: string | null
}

export interface LedgerFoe {
  kind: 'hit' | 'special' | 'heal' | 'windup' | 'none'
  name: string | null
  dmg: number
  raw: number | null
  block: number | null
  rolls: number[]
  hits: { dmg: number; name: string | null; dodged: boolean; pack: boolean }[]
  dodged: boolean
  fx: LedgerFx[]
}

export interface LedgerTurn {
  t: number
  you: LedgerYou
  foe: LedgerFoe
  hp: { you: number; foe: number }
  mp: number | null
}

/** A row from the wire or the database, checked just enough to draw safely. */
export function isLedgerTurn(value: unknown): value is LedgerTurn {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<LedgerTurn>
  return typeof row.t === 'number' && !!row.you && !!row.foe && !!row.hp
}

export function asLedgerTurns(value: unknown): LedgerTurn[] {
  return Array.isArray(value) ? value.filter(isLedgerTurn) : []
}

/** Why your swing came to nothing, in the card's own words. */
export function missLabel(miss: LedgerMiss): string {
  switch (miss) {
    case 'flying':
      return 'out of reach'
    case 'immune-melee':
      return 'cannot be cut'
    case 'immune-ranged':
      return 'cannot be shot'
    case 'immune-magic':
      return 'immune to magic'
    case 'dodged':
      return 'dodged'
    case 'blocked':
      return 'blocked'
  }
}

/** The eyebrow for a support turn: what kind of thing the turn was spent on. */
export function supportLabel(verb: string | null): string {
  switch (verb) {
    case 'equip_item':
      return 'Equipped'
    case 'unequip_item':
      return 'Unequipped'
    case 'auto_equip':
      return 'Auto-equipped'
    case 'cast_spell':
      return 'Cast'
    case 'search':
      return 'Searched'
    case 'rest':
      return 'Rested'
    case 'pickup_item':
      return 'Picked up'
    case 'drop_item':
      return 'Dropped'
    case 'take_supply':
      return 'Took'
    case 'room_action':
      return 'Did'
    default:
      return 'Used'
  }
}

/** One effect, as a short phrase. */
export function fxLabel(fx: LedgerFx): string {
  switch (fx.k) {
    case 'poison':
      return `poisoned ${fx.n}`
    case 'stone':
      return `stone ${fx.n} turn${fx.n === 1 ? '' : 's'}`
    case 'absorb':
      return `absorbs ${fx.n} HP`
    case 'drainHp':
      return `drains ${fx.n} HP`
    case 'drainMp':
      return `drains ${fx.n} MP`
    case 'steal':
      return `steals ${fx.n} gold`
    case 'armor':
      return `Magic Armor took ${fx.n}`
    case 'heal':
      return `recovers ${fx.n} HP`
    case 'rise':
      return 'rises again'
  }
}

/**
 * The arithmetic under your hit, the way the readout prints it:
 * "9 − 2", "(8 + 4) − 1", "(8 + 4) − 1 ÷ 2", or the spell's own breakdown.
 */
export function youCalc(you: LedgerYou): string | null {
  if (you.calc) return you.calc
  if (you.raw === null) return null
  const roll = you.bonus !== null ? `(${you.raw} + ${you.bonus})` : String(you.raw)
  const blocked = you.block !== null ? ` − ${you.block}` : ''
  const melted = you.melted ? ' ÷ 2' : ''
  return `${roll}${blocked}${melted}`
}

/** The arithmetic under the enemy's first hit: "5 − 2", or its special's rolls "3 + 2 + 1". */
export function foeCalc(foe: LedgerFoe): string | null {
  if (foe.rolls.length > 1) return foe.rolls.join(' + ')
  if (foe.raw === null) return null
  return foe.block !== null ? `${foe.raw} − ${foe.block}` : String(foe.raw)
}

/** Every row's HP after, summed up for a card: the lowest you fell to. */
export function lowestHp(turns: LedgerTurn[]): number | null {
  if (turns.length === 0) return null
  return turns.reduce((low, row) => Math.min(low, row.hp.you), Infinity)
}
