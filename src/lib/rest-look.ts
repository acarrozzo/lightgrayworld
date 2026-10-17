import type { Player } from '@/lib/game-state'
import { isRestSettled, restSettledMessage, type RoomRest } from '@/lib/game-data/room-rests'

/**
 * How a rest button reads for this player right now: open, grey with a check
 * when resting would raise nothing (the supply pill's "you already have
 * this"), or locked when the fire is a guild's and the player is not in it.
 *
 * Read from the live store, so the button flips the moment a hit lands or a
 * spell is cast. The server re-derives the same answer from the database in
 * applyRest (room-state.js) and refuses the click for free, so a store that is
 * behind costs a polite line, never a turn or a lost overcharge.
 */
export type RestLook = { kind: 'open' } | { kind: 'settled' | 'locked'; title: string }

/**
 * @param rest The room's rest (game-data/room-rests.js), or null for the plain Rest.
 * @param isMemberOf Null while the quests have not hydrated: a members-only
 *   fire reads open until they do, and the server still turns a non-member away.
 */
export function restLook(
  player: Player | null | undefined,
  rest: RoomRest | null,
  isMemberOf: ((guildId: string) => boolean) | null
): RestLook {
  if (rest?.requiresMembership && isMemberOf && !isMemberOf(rest.requiresMembership)) {
    return { kind: 'locked', title: rest.lockedMessage ?? 'Members only.' }
  }
  if (!player || !isRestSettled(player, rest, player.buffs)) return { kind: 'open' }
  return { kind: 'settled', title: restSettledMessage(player, rest) }
}
