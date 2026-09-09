import type { PartySnapshot } from '@/lib/socket'

/**
 * Who takes over when this player walks out of their party.
 *
 * The authority is `partyStore.departAlone` on the server; this mirrors it so a
 * confirmation can say what is about to happen before it happens. Keep the two
 * in step: the rule is that the longest-standing member takes over, and that a
 * leader with fewer than two members behind them takes the party with them,
 * because one person left alone is not a party.
 *
 * `members` arrives in join order — the server builds it from a Map, which
 * preserves insertion — so the successor is simply the first.
 */
export type PartyDeparture =
  | { kind: 'none' }
  | { kind: 'member' }
  | { kind: 'handoff'; successorName: string }
  | { kind: 'disband' }

export function describePartyDeparture(party: PartySnapshot | null, playerId: string | null | undefined): PartyDeparture {
  if (!party || !playerId) return { kind: 'none' }
  if (party.leaderId !== playerId) return { kind: 'member' }

  const successor = party.members.length >= 2 ? party.members[0] : null
  return successor ? { kind: 'handoff', successorName: successor.username } : { kind: 'disband' }
}

/** The sentence a confirmation shows for `departure`, or null when there is nothing to warn about. */
export function partyDepartureWarning(departure: PartyDeparture): string | null {
  switch (departure.kind) {
    case 'handoff':
      return `You will leave your party behind and travel alone. ${departure.successorName} will lead them.`
    case 'disband':
      return 'You will leave your party behind and travel alone. With nobody left to lead, the party will disband.'
    case 'member':
      return 'You will leave your party and travel alone.'
    default:
      return null
  }
}
