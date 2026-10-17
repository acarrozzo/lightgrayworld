-- AlterTable
ALTER TABLE "User" ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "WorldFeedEvent" ADD COLUMN     "detail" TEXT;

-- The Grand Quest Pillar's giver is now the Guardian Angel who stands beside it.
-- Players who had found the Pillar have met the Angel.
UPDATE "GiverMet" SET "giverId" = 'guardian_angel' WHERE "giverId" = 'grand_quest_pillar';
