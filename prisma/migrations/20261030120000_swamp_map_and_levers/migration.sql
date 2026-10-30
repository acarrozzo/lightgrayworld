-- AlterTable
ALTER TABLE "User" ADD COLUMN     "swampMap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "megalodonLeverFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dragonNestLeverFlag" BOOLEAN NOT NULL DEFAULT false;
