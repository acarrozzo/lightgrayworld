/**
 * The rules of the game screen's tabs, in one place.
 *
 * Explore is home: the room and the compass. Every other tab is a page that
 * takes the left column on a wide screen and the whole page on a phone.
 * Actions — attack, strikes, spells and items, the original's bag box and
 * spell box — is a tab like the rest, hidden until there is something to use.
 *
 * This module only decides *which* tab is showing. It is pure so the table
 * below can be tested; GameInterface owns the state and applies each tab's
 * "opens on its main page" reset when a tab opens.
 *
 * | Event                   | Tabs                                            |
 * |-------------------------|-------------------------------------------------|
 * | Select a tab            | Opens it; the open tab's own tile goes home     |
 * |                         | to Explore                                      |
 * | You change room         | Stay as they are                                |
 * | A fight starts, wide    | Stay as they are                                |
 * | A fight starts, phone   | Go to Explore (the battle card carries the deck |
 * |                         | and Retreat; Actions would be its twin)         |
 * | You die                 | Go to Explore                                   |
 * | Escape                  | Goes home                                       |
 */

/** Feed is a tab only on a phone; a wide screen has it as the right-hand panel. */
export type TabId = 'explore' | 'actions' | 'char' | 'inv' | 'world' | 'quests' | 'players' | 'feed' | 'settings'

export interface TabState {
  tab: TabId
}

export type TabEvent =
  | { type: 'select'; tab: TabId }
  | { type: 'roomChanged' }
  | { type: 'fightStarted'; phone: boolean }
  | { type: 'died' }
  | { type: 'escape' }

export const HOME: TabState = { tab: 'explore' }

export function reduceTabs(state: TabState, event: TabEvent): TabState {
  switch (event.type) {
    case 'select':
      // The open tab's tile is also its way home; Explore's tile always is.
      if (event.tab === 'explore' || event.tab === state.tab) return HOME
      return { tab: event.tab }
    case 'roomChanged':
      return state
    case 'fightStarted':
      return event.phone ? HOME : state
    case 'died':
      return HOME
    case 'escape':
      return HOME
  }
}

/** Whether Escape has anything of the tabs' to close. */
export function escapeCloses(state: TabState): boolean {
  return state.tab !== 'explore'
}
