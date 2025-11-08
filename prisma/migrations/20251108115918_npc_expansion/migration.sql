/*
  Warnings:

  - Added the required column `updatedAt` to the `NPC` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NPCDisposition" AS ENUM ('FRIENDLY', 'HOSTILE');

-- CreateEnum
CREATE TYPE "NPCMobility" AS ENUM ('STATIONARY', 'PATROL', 'WANDER');

-- CreateEnum
CREATE TYPE "NPCState" AS ENUM ('IDLE', 'PATROL', 'WANDER', 'NOTICE', 'PURSUE', 'ENGAGE', 'FLEE', 'RETURN_HOME', 'DEAD');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'COOLING_DOWN');

-- AlterTable
ALTER TABLE "NPC" ADD COLUMN     "attackSpeedTicks" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "canBeAttacked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "definitionId" TEXT,
ADD COLUMN     "dialogueTree" JSONB,
ADD COLUMN     "disposition" "NPCDisposition" NOT NULL DEFAULT 'HOSTILE',
ADD COLUMN     "homeRoom" TEXT,
ADD COLUMN     "leashDistance" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "leashTimeMs" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN     "lootTable" JSONB,
ADD COLUMN     "maxAlive" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mobility" "NPCMobility" NOT NULL DEFAULT 'STATIONARY',
ADD COLUMN     "mobilityPath" JSONB,
ADD COLUMN     "persistent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "questHooks" JSONB,
ADD COLUMN     "resistances" JSONB,
ADD COLUMN     "respawnSeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "spawnWeight" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stats" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vendorCatalog" JSONB;

-- CreateTable
CREATE TABLE "NPCDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "disposition" "NPCDisposition" NOT NULL DEFAULT 'HOSTILE',
    "canBeAttacked" BOOLEAN NOT NULL DEFAULT true,
    "mobility" "NPCMobility" NOT NULL DEFAULT 'STATIONARY',
    "mobilityConfig" JSONB,
    "stats" JSONB,
    "attackSpeedTicks" INTEGER NOT NULL DEFAULT 10,
    "resistances" JSONB,
    "leashDistance" INTEGER NOT NULL DEFAULT 6,
    "leashTimeMs" INTEGER NOT NULL DEFAULT 20000,
    "dialogueTree" JSONB,
    "questHooks" JSONB,
    "vendorCatalog" JSONB,
    "lootTable" JSONB,
    "respawnSeconds" INTEGER NOT NULL DEFAULT 60,
    "services" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NPCDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPCInstance" (
    "id" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "definitionId" TEXT,
    "spawnKey" TEXT,
    "currentRoom" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "hpMax" INTEGER NOT NULL,
    "state" "NPCState" NOT NULL DEFAULT 'IDLE',
    "targetId" TEXT,
    "threat" JSONB,
    "cooldowns" JSONB,
    "isSpawned" BOOLEAN NOT NULL DEFAULT true,
    "lastSpawnedAt" TIMESTAMP(3),
    "lastDespawnedAt" TIMESTAMP(3),
    "nextRespawnAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "NPCInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "giverNpcId" TEXT,
    "targetNpcId" TEXT,
    "requiredItem" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "rewardItems" JSONB,
    "rewardCurrency" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "cooldownSeconds" INTEGER,
    "completionFlag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestInstance" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "QuestInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInventory" (
    "id" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER,
    "restockSeconds" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "VendorInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NPCDefinition_key_key" ON "NPCDefinition"("key");

-- CreateIndex
CREATE INDEX "NPCDefinition_key_idx" ON "NPCDefinition"("key");

-- CreateIndex
CREATE INDEX "NPCInstance_npcId_idx" ON "NPCInstance"("npcId");

-- CreateIndex
CREATE INDEX "NPCInstance_definitionId_idx" ON "NPCInstance"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "NPCInstance_npcId_spawnKey_key" ON "NPCInstance"("npcId", "spawnKey");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_slug_key" ON "Quest"("slug");

-- CreateIndex
CREATE INDEX "Quest_giverNpcId_idx" ON "Quest"("giverNpcId");

-- CreateIndex
CREATE INDEX "Quest_targetNpcId_idx" ON "Quest"("targetNpcId");

-- CreateIndex
CREATE INDEX "QuestInstance_userId_idx" ON "QuestInstance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestInstance_questId_userId_key" ON "QuestInstance"("questId", "userId");

-- CreateIndex
CREATE INDEX "VendorInventory_npcId_idx" ON "VendorInventory"("npcId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInventory_npcId_itemName_key" ON "VendorInventory"("npcId", "itemName");

-- CreateIndex
CREATE INDEX "NPC_roomId_idx" ON "NPC"("roomId");

-- CreateIndex
CREATE INDEX "NPC_definitionId_idx" ON "NPC"("definitionId");

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPC" ADD CONSTRAINT "NPC_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "NPCDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPCInstance" ADD CONSTRAINT "NPCInstance_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "NPC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPCInstance" ADD CONSTRAINT "NPCInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "NPCDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_giverNpcId_fkey" FOREIGN KEY ("giverNpcId") REFERENCES "NPC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_targetNpcId_fkey" FOREIGN KEY ("targetNpcId") REFERENCES "NPC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestInstance" ADD CONSTRAINT "QuestInstance_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestInstance" ADD CONSTRAINT "QuestInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInventory" ADD CONSTRAINT "VendorInventory_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "NPC"("id") ON DELETE CASCADE ON UPDATE CASCADE;
