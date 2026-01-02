-- AlterEnum: Add EQUIPMENT to ItemType enum (keeping WEAPON)
-- Add EQUIPMENT to the enum
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'EQUIPMENT';

