-- CreateTable
CREATE TABLE "PartyChatMessage" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyChatMessage_partyId_timestamp_idx" ON "PartyChatMessage"("partyId", "timestamp");

-- AddForeignKey
ALTER TABLE "PartyChatMessage" ADD CONSTRAINT "PartyChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
