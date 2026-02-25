CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'transcriber', 'reviewer', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counties (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'NC',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, state)
);

CREATE TABLE IF NOT EXISTS districts (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(county_id, name)
);

CREATE TABLE IF NOT EXISTS repositories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  county_id BIGINT REFERENCES counties(id) ON DELETE SET NULL,
  year INT,
  format TEXT,
  call_number TEXT,
  microfilm_roll TEXT,
  citation_preferred TEXT,
  rights TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_items (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  date_range TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, label)
);

CREATE TABLE IF NOT EXISTS pages (
  id BIGSERIAL PRIMARY KEY,
  source_item_id BIGINT NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  county_id BIGINT REFERENCES counties(id) ON DELETE SET NULL,
  district_id BIGINT REFERENCES districts(id) ON DELETE SET NULL,
  page_number_label TEXT,
  image_url TEXT NOT NULL,
  image_thumbnail_url TEXT,
  captured_at TIMESTAMPTZ,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxpayers (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT REFERENCES counties(id) ON DELETE SET NULL,
  district_id BIGINT REFERENCES districts(id) ON DELETE SET NULL,
  name_original TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  name_tokens TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', unaccent(COALESCE(name_normalized, '') || ' ' || COALESCE(name_original, '')))
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enslaved_people (
  id BIGSERIAL PRIMARY KEY,
  name_original TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  name_tokens TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', unaccent(COALESCE(name_normalized, '') || ' ' || COALESCE(name_original, '')))
  ) STORED,
  gender TEXT,
  approx_birth_year INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_assessment_entries (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,
  county_id BIGINT NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  district_id BIGINT REFERENCES districts(id) ON DELETE SET NULL,
  taxpayer_id BIGINT NOT NULL REFERENCES taxpayers(id) ON DELETE RESTRICT,
  enslaved_person_id BIGINT NOT NULL REFERENCES enslaved_people(id) ON DELETE RESTRICT,
  line_number TEXT,
  sequence_on_page INT,
  year INT NOT NULL DEFAULT 1863,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enslavement_details (
  entry_id BIGINT PRIMARY KEY REFERENCES tax_assessment_entries(id) ON DELETE CASCADE,
  category_original TEXT,
  age_original TEXT,
  age_years INT,
  value_original TEXT,
  value_cents BIGINT,
  quantity_original TEXT,
  remarks_original TEXT,
  transcription_confidence NUMERIC(5,4),
  transcriber_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  request_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_districts_county_id ON districts(county_id);
CREATE INDEX IF NOT EXISTS idx_sources_repository_id ON sources(repository_id);
CREATE INDEX IF NOT EXISTS idx_sources_county_id ON sources(county_id);
CREATE INDEX IF NOT EXISTS idx_source_items_source_id ON source_items(source_id);
CREATE INDEX IF NOT EXISTS idx_pages_source_item_id ON pages(source_item_id);
CREATE INDEX IF NOT EXISTS idx_pages_county_id ON pages(county_id);
CREATE INDEX IF NOT EXISTS idx_pages_district_id ON pages(district_id);
CREATE INDEX IF NOT EXISTS idx_taxpayers_county_district ON taxpayers(county_id, district_id);
CREATE INDEX IF NOT EXISTS idx_enslaved_people_name_tokens ON enslaved_people USING GIN(name_tokens);
CREATE INDEX IF NOT EXISTS idx_taxpayers_name_tokens ON taxpayers USING GIN(name_tokens);
CREATE INDEX IF NOT EXISTS idx_enslaved_people_name_norm_trgm ON enslaved_people USING GIN(name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_taxpayers_name_norm_trgm ON taxpayers USING GIN(name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tae_page_id ON tax_assessment_entries(page_id);
CREATE INDEX IF NOT EXISTS idx_tae_county_district_year ON tax_assessment_entries(county_id, district_id, year);
CREATE INDEX IF NOT EXISTS idx_tae_sequence ON tax_assessment_entries(sequence_on_page);
CREATE INDEX IF NOT EXISTS idx_enslavement_status ON enslavement_details(status);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_users',
    'counties',
    'districts',
    'repositories',
    'sources',
    'source_items',
    'pages',
    'taxpayers',
    'enslaved_people',
    'tax_assessment_entries',
    'enslavement_details'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at_%I ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_touch_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t, t);
  END LOOP;
END $$;

-- Helpful function for consistent citations in APIs or SQL clients.
CREATE OR REPLACE VIEW v_entry_citation_chain AS
SELECT
  tae.id AS entry_id,
  r.id AS repository_id,
  r.name AS repository_name,
  r.location AS repository_location,
  r.url AS repository_url,
  s.id AS source_id,
  s.title AS source_title,
  s.citation_preferred,
  si.id AS source_item_id,
  si.label AS source_item_label,
  p.id AS page_id,
  p.page_number_label,
  p.image_url,
  p.image_thumbnail_url
FROM tax_assessment_entries tae
JOIN pages p ON p.id = tae.page_id
JOIN source_items si ON si.id = p.source_item_id
JOIN sources s ON s.id = si.source_id
JOIN repositories r ON r.id = s.repository_id;
