-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "characterClass" TEXT NOT NULL DEFAULT 'Scout',
    "characterRace" TEXT NOT NULL DEFAULT 'Human',
    "currentRoom" TEXT NOT NULL DEFAULT '001',
    "recallRoom" TEXT NOT NULL DEFAULT '001',
    "lastActive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "cp" INTEGER NOT NULL DEFAULT 0,
    "tp" INTEGER NOT NULL DEFAULT 0,
    "sp" INTEGER NOT NULL DEFAULT 0,
    "currency" INTEGER NOT NULL DEFAULT 7,
    "str" INTEGER NOT NULL DEFAULT 0,
    "dex" INTEGER NOT NULL DEFAULT 0,
    "mag" INTEGER NOT NULL DEFAULT 0,
    "def" INTEGER NOT NULL DEFAULT 0,
    "strMod" INTEGER NOT NULL DEFAULT 0,
    "dexMod" INTEGER NOT NULL DEFAULT 0,
    "magMod" INTEGER NOT NULL DEFAULT 0,
    "defMod" INTEGER NOT NULL DEFAULT 0,
    "physicalTraining" INTEGER NOT NULL DEFAULT 0,
    "mentalTraining" INTEGER NOT NULL DEFAULT 0,
    "oneHanded" INTEGER NOT NULL DEFAULT 0,
    "twoHanded" INTEGER NOT NULL DEFAULT 0,
    "ranged" INTEGER NOT NULL DEFAULT 0,
    "warcraft" INTEGER NOT NULL DEFAULT 0,
    "toughness" INTEGER NOT NULL DEFAULT 0,
    "block" INTEGER NOT NULL DEFAULT 0,
    "dodge" INTEGER NOT NULL DEFAULT 0,
    "slice" INTEGER NOT NULL DEFAULT 0,
    "smash" INTEGER NOT NULL DEFAULT 0,
    "aim" INTEGER NOT NULL DEFAULT 0,
    "magicStrike" INTEGER NOT NULL DEFAULT 0,
    "multiArrow" INTEGER NOT NULL DEFAULT 0,
    "boltUpgrade" INTEGER NOT NULL DEFAULT 0,
    "throwDagger" INTEGER NOT NULL DEFAULT 0,
    "crafting" INTEGER NOT NULL DEFAULT 0,
    "magicMissile" INTEGER NOT NULL DEFAULT 0,
    "fireball" INTEGER NOT NULL DEFAULT 0,
    "poisonDart" INTEGER NOT NULL DEFAULT 0,
    "magicArrow" INTEGER NOT NULL DEFAULT 0,
    "atomicBlast" INTEGER NOT NULL DEFAULT 0,
    "meteor" INTEGER NOT NULL DEFAULT 0,
    "heal" INTEGER NOT NULL DEFAULT 0,
    "regenerate" INTEGER NOT NULL DEFAULT 0,
    "antidote" INTEGER NOT NULL DEFAULT 0,
    "unlock" INTEGER NOT NULL DEFAULT 0,
    "ironSkin" INTEGER NOT NULL DEFAULT 0,
    "magicArmor" INTEGER NOT NULL DEFAULT 0,
    "wings" INTEGER NOT NULL DEFAULT 0,
    "gills" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 10,
    "hpMax" INTEGER NOT NULL DEFAULT 10,
    "mp" INTEGER NOT NULL DEFAULT 2,
    "mpMax" INTEGER NOT NULL DEFAULT 2,
    "inFight" BOOLEAN NOT NULL DEFAULT false,
    "endFight" BOOLEAN NOT NULL DEFAULT false,
    "weaponType" INTEGER NOT NULL DEFAULT 0,
    "uIcon" TEXT NOT NULL DEFAULT 'char-commander',
    "uIconWeapon" TEXT NOT NULL DEFAULT 'fists',
    "eIcon" TEXT NOT NULL DEFAULT 'question',
    "chest1" BOOLEAN NOT NULL DEFAULT false,
    "chest2" BOOLEAN NOT NULL DEFAULT false,
    "chest3" BOOLEAN NOT NULL DEFAULT false,
    "chest4" BOOLEAN NOT NULL DEFAULT false,
    "chest5" BOOLEAN NOT NULL DEFAULT false,
    "chest6" BOOLEAN NOT NULL DEFAULT false,
    "chest7" BOOLEAN NOT NULL DEFAULT false,
    "chest8" BOOLEAN NOT NULL DEFAULT false,
    "chest9" BOOLEAN NOT NULL DEFAULT false,
    "chest10" BOOLEAN NOT NULL DEFAULT false,
    "roomZeroMap" BOOLEAN NOT NULL DEFAULT false,
    "grassyFieldMap" BOOLEAN NOT NULL DEFAULT false,
    "grassyFieldUndergroundMap" BOOLEAN NOT NULL DEFAULT false,
    "forestMap" BOOLEAN NOT NULL DEFAULT false,
    "forestUndergroundMap" BOOLEAN NOT NULL DEFAULT false,
    "redTownMap" BOOLEAN NOT NULL DEFAULT false,
    "redTownSewersMap" BOOLEAN NOT NULL DEFAULT false,
    "rockyFlatsMap" BOOLEAN NOT NULL DEFAULT false,
    "neverEndingMineMap" BOOLEAN NOT NULL DEFAULT false,
    "oceanMap" BOOLEAN NOT NULL DEFAULT false,
    "darkForestMap" BOOLEAN NOT NULL DEFAULT false,
    "worldMapV1" BOOLEAN NOT NULL DEFAULT false,
    "worldMapV2" BOOLEAN NOT NULL DEFAULT false,
    "worldMapV3" BOOLEAN NOT NULL DEFAULT false,
    "worldMapV4" BOOLEAN NOT NULL DEFAULT false,
    "worldMapV5" BOOLEAN NOT NULL DEFAULT false,
    "worldMapFull" BOOLEAN NOT NULL DEFAULT false,
    "pajamaShamanFlag" BOOLEAN NOT NULL DEFAULT false,
    "youngSoldierFlag" BOOLEAN NOT NULL DEFAULT false,
    "jackLumberFlag" BOOLEAN NOT NULL DEFAULT false,
    "hunterBillFlag" BOOLEAN NOT NULL DEFAULT false,
    "travelingWarriorFlag" BOOLEAN NOT NULL DEFAULT false,
    "travelingWizardFlag" BOOLEAN NOT NULL DEFAULT false,
    "warriorSkillFlag" BOOLEAN NOT NULL DEFAULT false,
    "wizardSkillFlag" BOOLEAN NOT NULL DEFAULT false,
    "miningSkillFlag" BOOLEAN NOT NULL DEFAULT false,
    "rangerSkillFlag" BOOLEAN NOT NULL DEFAULT false,
    "masterTrainerFlag" BOOLEAN NOT NULL DEFAULT false,
    "starCitySkillsFlag" BOOLEAN NOT NULL DEFAULT false,
    "starCitySpellsFlag" BOOLEAN NOT NULL DEFAULT false,
    "dailyChestLast" INTEGER NOT NULL DEFAULT 0,
    "dailyChestNextAvailable" INTEGER NOT NULL DEFAULT 0,
    "dailyChestCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "User_currentRoom_fkey" FOREIGN KEY ("currentRoom") REFERENCES "Room" ("roomId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rightHand" TEXT NOT NULL DEFAULT 'fists',
    "leftHand" TEXT NOT NULL DEFAULT '- - -',
    "head" TEXT NOT NULL DEFAULT '- - -',
    "body" TEXT NOT NULL DEFAULT '- - -',
    "hands" TEXT NOT NULL DEFAULT '- - -',
    "feet" TEXT NOT NULL DEFAULT '- - -',
    "ring1" TEXT NOT NULL DEFAULT '- - -',
    "ring2" TEXT NOT NULL DEFAULT '- - -',
    "neck" TEXT NOT NULL DEFAULT '- - -',
    "artifact" TEXT NOT NULL DEFAULT '- - -',
    "tech" TEXT NOT NULL DEFAULT '- - -',
    "companion" TEXT NOT NULL DEFAULT '- - -',
    "pet" TEXT NOT NULL DEFAULT '- - -',
    "mount" TEXT NOT NULL DEFAULT '- - -',
    "robot" TEXT NOT NULL DEFAULT '- - -',
    "aura" TEXT NOT NULL DEFAULT '- - -',
    "arrows" INTEGER NOT NULL DEFAULT 0,
    "bolts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Equipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KillList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monster" TEXT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "KillList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lookDesc" TEXT,
    "dangerLevel" INTEGER NOT NULL DEFAULT 0,
    "isSafe" BOOLEAN NOT NULL DEFAULT true,
    "north" TEXT,
    "northeast" TEXT,
    "east" TEXT,
    "southeast" TEXT,
    "south" TEXT,
    "southwest" TEXT,
    "west" TEXT,
    "northwest" TEXT,
    "up" TEXT,
    "down" TEXT,
    "hasFire" BOOLEAN NOT NULL DEFAULT false,
    "hasCraftingTable" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "RoomItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RoomItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NPC" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "NPC_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "ActionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_userId_key" ON "Equipment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userId_itemName_key" ON "InventoryItem"("userId", "itemName");

-- CreateIndex
CREATE UNIQUE INDEX "KillList_userId_monster_key" ON "KillList"("userId", "monster");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_userId_questId_key" ON "QuestProgress"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE INDEX "ActionHistory_userId_timestamp_idx" ON "ActionHistory"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
