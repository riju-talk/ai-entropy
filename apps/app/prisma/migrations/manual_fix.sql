-- Step 1: Create a system user if it doesn't exist
INSERT INTO "users" (id, email, "createdAt", "updatedAt")
VALUES ('system', 'system@entropy.local', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Step 2: Add creatorId column with default
ALTER TABLE "communities" 
ADD COLUMN IF NOT EXISTS "creatorId" TEXT DEFAULT 'system';

-- Step 3: Update existing communities to use the first user as creator
UPDATE "communities" 
SET "creatorId" = (SELECT id FROM "users" LIMIT 1)
WHERE "creatorId" = 'system';

-- Step 4: Handle Subject enum change for doubts
-- First, check what values exist
SELECT DISTINCT subject FROM "doubts";

-- Step 5: Convert existing subject values to new enum
-- (Adjust mapping based on what you find above)
ALTER TABLE "doubts" ALTER COLUMN subject TYPE TEXT;

-- Then recreate the enum
ALTER TABLE "doubts" 
ALTER COLUMN subject TYPE "Subject" 
USING CASE 
  WHEN subject = 'computer_science' THEN 'COMPUTER_SCIENCE'::Subject
  WHEN subject = 'mathematics' THEN 'MATHEMATICS'::Subject
  WHEN subject = 'physics' THEN 'PHYSICS'::Subject
  WHEN subject = 'chemistry' THEN 'CHEMISTRY'::Subject
  WHEN subject = 'biology' THEN 'BIOLOGY'::Subject
  WHEN subject = 'engineering' THEN 'ENGINEERING'::Subject
  ELSE 'OTHER'::Subject
END;
