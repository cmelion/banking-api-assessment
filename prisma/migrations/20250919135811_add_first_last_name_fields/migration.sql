/*
  Migration to add firstName and lastName fields.
  This migration safely handles existing data by splitting the name field.
*/

-- Step 1: Add new columns with temporary default values
ALTER TABLE "public"."users" ADD COLUMN "first_name" TEXT DEFAULT '';
ALTER TABLE "public"."users" ADD COLUMN "last_name" TEXT DEFAULT '';

-- Step 2: Update existing records by splitting the name field
UPDATE "public"."users"
SET
  "first_name" = CASE
    WHEN position(' ' IN name) > 0 THEN split_part(name, ' ', 1)
    ELSE name
  END,
  "last_name" = CASE
    WHEN position(' ' IN name) > 0 THEN substring(name FROM position(' ' IN name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL;

-- Step 3: Make columns NOT NULL after data migration
ALTER TABLE "public"."users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "public"."users" ALTER COLUMN "last_name" SET NOT NULL;

-- Step 4: Remove default constraints
ALTER TABLE "public"."users" ALTER COLUMN "first_name" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "last_name" DROP DEFAULT;

-- Step 5: Make name column nullable for backward compatibility
ALTER TABLE "public"."users" ALTER COLUMN "name" DROP NOT NULL;
