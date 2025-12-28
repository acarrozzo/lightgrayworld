-- CreateTable
CREATE TABLE "WorldFeedEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldFeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorldFeedEvent_timestamp_idx" ON "WorldFeedEvent"("timestamp");

-- CreateIndex
CREATE INDEX "WorldFeedEvent_eventType_idx" ON "WorldFeedEvent"("eventType");

-- AddForeignKey
ALTER TABLE "WorldFeedEvent" ADD CONSTRAINT "WorldFeedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
