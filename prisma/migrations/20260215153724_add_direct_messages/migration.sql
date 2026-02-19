-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectThread" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageSnippet" TEXT NOT NULL DEFAULT '',
    "userAUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "userBUnreadCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DirectThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_recipientId_createdAt_idx" ON "DirectMessage"("senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_readAt_createdAt_idx" ON "DirectMessage"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "DirectThread_userAId_lastMessageAt_idx" ON "DirectThread"("userAId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectThread_userBId_lastMessageAt_idx" ON "DirectThread"("userBId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectThread_userAId_userBId_key" ON "DirectThread"("userAId", "userBId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
