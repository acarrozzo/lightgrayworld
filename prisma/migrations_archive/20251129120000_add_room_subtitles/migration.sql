-- Create subtitle fields for Room
ALTER TABLE "Room"
ADD COLUMN "subtitle" TEXT NOT NULL DEFAULT 'This is it. The world is yours.',
ADD COLUMN "subtitlePosition" TEXT NOT NULL DEFAULT 'below';

