-- The Swamp's two levers are one pass each, held in session state
-- (lever-state.js) like the Grotto door, not on the player row.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "megalodonLeverFlag",
DROP COLUMN "dragonNestLeverFlag";
