-- CreateTable
CREATE TABLE "PlayerRoomEnemy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "enemySlugs" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerRoomEnemy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerRoomEnemy_userId_idx" ON "PlayerRoomEnemy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRoomEnemy_userId_roomId_key" ON "PlayerRoomEnemy"("userId", "roomId");

-- AddForeignKey
ALTER TABLE "PlayerRoomEnemy" ADD CONSTRAINT "PlayerRoomEnemy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
