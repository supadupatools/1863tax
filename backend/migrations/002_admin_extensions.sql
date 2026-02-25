ALTER TABLE counties
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS aliases (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('taxpayer', 'enslaved_person')),
  entity_id BIGINT NOT NULL,
  alias_original TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, alias_normalized)
);

CREATE INDEX IF NOT EXISTS idx_aliases_entity ON aliases(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_aliases_alias_norm_trgm ON aliases USING GIN(alias_normalized gin_trgm_ops);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_updated_at_aliases'
  ) THEN
    CREATE TRIGGER trg_touch_updated_at_aliases
    BEFORE UPDATE ON aliases
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;
