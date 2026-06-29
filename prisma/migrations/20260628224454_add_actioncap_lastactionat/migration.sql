-- AlterTable
ALTER TABLE "ActionCap" ADD COLUMN     "lastActionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "currency" SET DEFAULT 3,
ALTER COLUMN "mentalTraining" SET DEFAULT 0;
