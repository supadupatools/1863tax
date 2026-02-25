-- DANGEROUS: full app reset for this project.
-- This removes all objects in archive1863 and all user tables/views/functions/sequences in public.

BEGIN;

DROP SCHEMA IF EXISTS archive1863 CASCADE;

DO $$
DECLARE
  obj RECORD;
BEGIN
  -- Drop views in public
  FOR obj IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', obj.table_name);
  END LOOP;

  -- Drop tables in public
  FOR obj IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', obj.tablename);
  END LOOP;

  -- Drop sequences in public
  FOR obj IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', obj.sequence_name);
  END LOOP;

  -- NOTE:
  -- Do not drop functions in public here because extension-owned functions
  -- (e.g., pg_trgm) can exist in public and cannot be dropped safely.
END $$;

COMMIT;

-- Recreate app schema for migrations
CREATE SCHEMA IF NOT EXISTS archive1863;
