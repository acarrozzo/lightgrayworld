-- AlterTable
ALTER TABLE "ItemTemplate" ADD COLUMN     "canSell" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canDrop" BOOLEAN NOT NULL DEFAULT true;

