/**
 * The layers `DeckContent` can draw: the World and Inv tabs, which have their
 * own layer components, and Action, which is not a tab but a button of the
 * Explore view. The other tabs (Char, Quests, Players, Settings) are panels
 * GameInterface wraps in the same frame.
 */
export type DeckTab = 'world' | 'inv' | 'action'
