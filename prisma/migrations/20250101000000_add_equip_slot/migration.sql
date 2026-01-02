-- CreateEnum
CREATE TYPE "EquipSlot" AS ENUM ('MAIN_HAND', 'OFF_HAND', 'HEAD', 'BODY', 'HANDS', 'FEET');

-- AlterTable
ALTER TABLE "ItemTemplate" ADD COLUMN     "equipSlot" "EquipSlot";

