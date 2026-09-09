// The party's hard limits, shared by both sides of the CommonJS/TypeScript seam.
//
// The server clamps, the client's input caps at the same number, and a mirror of
// a number is exactly the kind of thing that drifts — so there is one copy, in a
// module with no Node-only imports that the React components can import too.

const MAX_PARTY_SIZE = 6 // leader + 5
const MAX_PARTY_NAME = 24

module.exports = { MAX_PARTY_SIZE, MAX_PARTY_NAME }
