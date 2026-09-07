/**
 * Rooms the World Atlas leaves off its maps, and so every other World Tool
 * view treats as not-a-place: the void, the dead-end placeholder, and the
 * Plane of Rebirth, which is reached by dying rather than by walking.
 *
 * Shared so the atlas, its count on the home page and the search index agree
 * about what a "room" is.
 */
export const ATLAS_EXCLUDED_ROOMS: string[] = ['000', '999', '088']
