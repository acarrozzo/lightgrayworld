/**
 * The rules of the game screen's tabs, in one place.
 *
 * Explore is home: the room and the compass. Every other tab is a page that
 * takes the left column on a wide screen and the whole page on a phone.
 * Action is not a tab: it is Explore's own utility, a layer over the compass.
 *
 * This module only decides *which* tab is showing and whether Action is open.
 * It is pure so the table below can be tested; GameInterface owns the state
 * and applies each tab's "opens on its main page" reset when a tab opens.
 *
 * | Event                   | Tabs                                   | Action  |
 * |-------------------------|----------------------------------------|---------|
 * | Select a tab            | Opens it; the open tab's own tile goes | Closes  |
 * |                         | home to Explore                        |         |
 * | Toggle Action           | Goes to Explore                        | Toggles |
 * | You change room         | Stay as they are                       | Closes  |
 * | A fight starts, wide    | Stay as they are                       | Stays   |
 * | A fight starts, phone   | Go to Explore — except World, since    | Closes  |
 * |                         | teleport is the way out of a fight     |         |
 * | You die                 | Go to Explore                          | Closes  |
 * | Escape                  | Action closes first, then the tab      |         |
 */

/** Feed is a tab only on a phone; a wide screen has it as the right-hand panel. */
export type TabId = 'explore' | 'char' | 'inv' | 'world' | 'quests' | 'players' | 'feed' | 'settings'

export interface TabState {
  tab: TabId
  /** The Action layer is over the compass. Only ever true on Explore. */
  actionOpen: boolean
}

export type TabEvent =
  | { type: 'select'; tab: TabId }
  | { type: 'toggleAction' }
  | { type: 'roomChanged' }
  | { type: 'fightStarted'; phone: boolean }
  | { type: 'died' }
  | { type: 'escape' }

export const HOME: TabState = { tab: 'explore', actionOpen: false }

export function reduceTabs(state: TabState, event: TabEvent): TabState {
  switch (event.type) {
    case 'select':
      // The open tab's tile is also its way home; Explore's tile always is.
      if (event.tab === 'explore' || event.tab === state.tab) return HOME
      return { tab: event.tab, actionOpen: false }
    case 'toggleAction':
      return { tab: 'explore', actionOpen: state.tab === 'explore' ? !state.actionOpen : true }
    case 'roomChanged':
      return state.actionOpen ? { ...state, actionOpen: false } : state
    case 'fightStarted':
      if (!event.phone) return state
      return state.tab === 'world' ? { tab: 'world', actionOpen: false } : HOME
    case 'died':
      return HOME
    case 'escape':
      if (state.actionOpen) return { ...state, actionOpen: false }
      return HOME
  }
}

/** Whether Escape has anything of the tabs' to close. */
export function escapeCloses(state: TabState): boolean {
  return state.actionOpen || state.tab !== 'explore'
}
