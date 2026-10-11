/**
 * The layers `DeckContent` can draw: the World, Inv and Actions tabs, each
 * with its own layer component. The other tabs (Char, Quests, Players,
 * Settings) are panels GameInterface wraps in the same frame.
 */
export type DeckTab = 'world' | 'inv' | 'actions'
