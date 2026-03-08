-- Add missing columns to achievement_progress
ALTER TABLE "achievement_progress" ADD COLUMN IF NOT EXISTS "uniqueUsers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "achievement_progress" ADD COLUMN IF NOT EXISTS "validatedCount" INTEGER DEFAULT 0;
ALTER TABLE "achievement_progress" ADD COLUMN IF NOT EXISTS "firstDate" TIMESTAMP(3);
ALTER TABLE "achievement_progress" ADD COLUMN IF NOT EXISTS "daySpan" INTEGER DEFAULT 0;

-- Rename or ensure last_updated column exists
ALTER TABLE "achievement_progress" ADD COLUMN IF NOT EXISTS "last_updated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
