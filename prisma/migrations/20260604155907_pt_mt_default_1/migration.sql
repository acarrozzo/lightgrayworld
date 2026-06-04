-- AlterTable
ALTER TABLE "User" ALTER COLUMN "physicalTraining" SET DEFAULT 1,
ALTER COLUMN "mentalTraining" SET DEFAULT 1;

-- Backfill existing users with value 0 to 1
UPDATE "User" SET "physicalTraining" = 1 WHERE "physicalTraining" = 0;
UPDATE "User" SET "mentalTraining" = 1 WHERE "mentalTraining" = 0;
