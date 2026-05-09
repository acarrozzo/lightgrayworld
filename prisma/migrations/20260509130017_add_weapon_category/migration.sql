-- CreateEnum
CREATE TYPE "WeaponCategory" AS ENUM ('MELEE', 'RANGED');

-- AlterTable
ALTER TABLE "ItemTemplate" ADD COLUMN     "weaponCategory" "WeaponCategory";
