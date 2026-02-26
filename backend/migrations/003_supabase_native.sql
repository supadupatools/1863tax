SET search_path TO archive1863, public;

CREATE TABLE IF NOT EXISTS user_profiles (
  auth_user_id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'transcriber', 'reviewer', 'public')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_touch_updated_at_user_profiles ON user_profiles;
CREATE TRIGGER trg_touch_updated_at_user_profiles
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION archive1863.current_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT COALESCE(
    (
      SELECT up.role
      FROM archive1863.user_profiles up
      WHERE up.auth_user_id = auth.uid()
        AND up.is_active = TRUE
      LIMIT 1
    ),
    'public'
  );
$$;

CREATE OR REPLACE FUNCTION archive1863.current_user_active()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM archive1863.user_profiles up
    WHERE up.auth_user_id = auth.uid()
      AND up.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION archive1863.can_transcribe()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT archive1863.current_role() IN ('admin', 'transcriber');
$$;

CREATE OR REPLACE FUNCTION archive1863.can_review()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT archive1863.current_role() IN ('admin', 'reviewer');
$$;

CREATE OR REPLACE FUNCTION archive1863.can_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT archive1863.current_role() = 'admin';
$$;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enslaved_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_assessment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enslavement_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
CREATE POLICY user_profiles_self_select ON user_profiles
FOR SELECT
USING (auth.uid() = auth_user_id OR archive1863.can_admin());

DROP POLICY IF EXISTS user_profiles_self_update ON user_profiles;
CREATE POLICY user_profiles_self_update ON user_profiles
FOR UPDATE
USING (auth.uid() = auth_user_id OR archive1863.can_admin())
WITH CHECK (auth.uid() = auth_user_id OR archive1863.can_admin());

DROP POLICY IF EXISTS user_profiles_admin_insert ON user_profiles;
CREATE POLICY user_profiles_admin_insert ON user_profiles
FOR INSERT
WITH CHECK (archive1863.can_admin());

DROP POLICY IF EXISTS user_profiles_admin_delete ON user_profiles;
CREATE POLICY user_profiles_admin_delete ON user_profiles
FOR DELETE
USING (archive1863.can_admin());

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'counties', 'districts', 'repositories', 'sources', 'source_items', 'pages',
    'taxpayers', 'enslaved_people', 'tax_assessment_entries', 'enslavement_details',
    'aliases', 'audit_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_all ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_admin_all ON %I FOR ALL USING (archive1863.can_admin()) WITH CHECK (archive1863.can_admin())',
      t,
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS taxpayers_transcriber_rw ON taxpayers;
CREATE POLICY taxpayers_transcriber_rw ON taxpayers
FOR ALL
USING (archive1863.can_transcribe())
WITH CHECK (archive1863.can_transcribe());

DROP POLICY IF EXISTS enslaved_people_transcriber_rw ON enslaved_people;
CREATE POLICY enslaved_people_transcriber_rw ON enslaved_people
FOR ALL
USING (archive1863.can_transcribe())
WITH CHECK (archive1863.can_transcribe());

DROP POLICY IF EXISTS entries_transcriber_rw ON tax_assessment_entries;
CREATE POLICY entries_transcriber_rw ON tax_assessment_entries
FOR ALL
USING (archive1863.can_transcribe())
WITH CHECK (archive1863.can_transcribe());

DROP POLICY IF EXISTS details_transcriber_rw ON enslavement_details;
CREATE POLICY details_transcriber_rw ON enslavement_details
FOR ALL
USING (archive1863.can_transcribe())
WITH CHECK (archive1863.can_transcribe());

DROP POLICY IF EXISTS reviewer_select_details ON enslavement_details;
CREATE POLICY reviewer_select_details ON enslavement_details
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_update_details ON enslavement_details;
CREATE POLICY reviewer_update_details ON enslavement_details
FOR UPDATE
USING (archive1863.can_review())
WITH CHECK (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_entries ON tax_assessment_entries;
CREATE POLICY reviewer_read_entries ON tax_assessment_entries
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_taxpayers ON taxpayers;
CREATE POLICY reviewer_read_taxpayers ON taxpayers
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_enslaved_people ON enslaved_people;
CREATE POLICY reviewer_read_enslaved_people ON enslaved_people
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_pages ON pages;
CREATE POLICY reviewer_read_pages ON pages
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_sources ON sources;
CREATE POLICY reviewer_read_sources ON sources
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_source_items ON source_items;
CREATE POLICY reviewer_read_source_items ON source_items
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_repositories ON repositories;
CREATE POLICY reviewer_read_repositories ON repositories
FOR SELECT
USING (archive1863.can_review());

DROP POLICY IF EXISTS reviewer_read_counties ON counties;
CREATE POLICY reviewer_read_counties ON counties
FOR SELECT
USING (archive1863.can_review() OR archive1863.can_transcribe());

DROP POLICY IF EXISTS reviewer_read_districts ON districts;
CREATE POLICY reviewer_read_districts ON districts
FOR SELECT
USING (archive1863.can_review() OR archive1863.can_transcribe());

CREATE OR REPLACE VIEW v_review_queue AS
SELECT
  tae.id,
  tae.page_id,
  tae.county_id,
  tae.district_id,
  tae.line_number,
  tae.sequence_on_page,
  tae.year,
  tae.updated_at,
  c.name AS county_name,
  d.name AS district_name,
  ep.name_original AS enslaved_name_original,
  ep.name_normalized AS enslaved_name_normalized,
  t.name_original AS taxpayer_name_original,
  t.name_normalized AS taxpayer_name_normalized,
  ed.status,
  ed.transcription_confidence,
  ed.remarks_original,
  p.page_number_label,
  p.image_thumbnail_url
FROM tax_assessment_entries tae
JOIN enslavement_details ed ON ed.entry_id = tae.id
JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
JOIN taxpayers t ON t.id = tae.taxpayer_id
JOIN pages p ON p.id = tae.page_id
JOIN counties c ON c.id = tae.county_id
LEFT JOIN districts d ON d.id = tae.district_id;

CREATE OR REPLACE VIEW v_entries_by_page AS
SELECT
  tae.id,
  tae.page_id,
  tae.sequence_on_page,
  tae.line_number,
  tae.year,
  t.name_original AS taxpayer_name_original,
  ep.name_original AS enslaved_name_original,
  ed.status,
  ed.transcription_confidence,
  tae.updated_at
FROM tax_assessment_entries tae
JOIN enslavement_details ed ON ed.entry_id = tae.id
JOIN taxpayers t ON t.id = tae.taxpayer_id
JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id;

CREATE OR REPLACE VIEW v_my_drafts AS
SELECT
  tae.id,
  tae.page_id,
  p.page_number_label,
  c.name AS county_name,
  d.name AS district_name,
  tae.sequence_on_page,
  ep.name_original AS enslaved_name_original,
  t.name_original AS taxpayer_name_original,
  ed.status,
  tae.updated_at
FROM tax_assessment_entries tae
JOIN enslavement_details ed ON ed.entry_id = tae.id
JOIN pages p ON p.id = tae.page_id
JOIN counties c ON c.id = tae.county_id
LEFT JOIN districts d ON d.id = tae.district_id
JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
JOIN taxpayers t ON t.id = tae.taxpayer_id
WHERE ed.status = 'draft'
  AND ed.transcriber_user_id::text = auth.uid()::text;

CREATE OR REPLACE VIEW v_transcription_queue AS
SELECT
  p.id AS page_id,
  p.page_number_label,
  p.county_id,
  p.district_id,
  c.name AS county_name,
  d.name AS district_name,
  MAX(ed.status) AS entry_status,
  COALESCE(COUNT(tae.id), 0)::INT AS draft_entries,
  MAX(tae.updated_at) AS last_activity,
  p.image_url
FROM pages p
LEFT JOIN tax_assessment_entries tae ON tae.page_id = p.id
LEFT JOIN enslavement_details ed ON ed.entry_id = tae.id
LEFT JOIN counties c ON c.id = p.county_id
LEFT JOIN districts d ON d.id = p.district_id
GROUP BY p.id, p.page_number_label, p.county_id, p.district_id, c.name, d.name, p.image_url;

CREATE OR REPLACE FUNCTION public.create_transcription_entry(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
DECLARE
  v_taxpayer_id BIGINT;
  v_enslaved_person_id BIGINT;
  v_entry_id BIGINT;
  v_result JSONB;
BEGIN
  IF NOT archive1863.can_transcribe() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO archive1863.taxpayers (county_id, district_id, name_original, name_normalized, notes)
  VALUES (
    NULLIF(p_payload->>'county_id','')::BIGINT,
    NULLIF(p_payload->>'district_id','')::BIGINT,
    COALESCE(NULLIF(p_payload->>'taxpayer_name_original',''), 'Unknown'),
    COALESCE(NULLIF(p_payload->>'taxpayer_name_normalized',''), lower(COALESCE(NULLIF(p_payload->>'taxpayer_name_original',''), 'unknown'))),
    NULL
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_taxpayer_id
  FROM archive1863.taxpayers
  WHERE name_normalized = COALESCE(NULLIF(p_payload->>'taxpayer_name_normalized',''), lower(COALESCE(NULLIF(p_payload->>'taxpayer_name_original',''), 'unknown')))
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO archive1863.enslaved_people (name_original, name_normalized, gender, approx_birth_year, notes)
  VALUES (
    COALESCE(NULLIF(p_payload->>'enslaved_name_original',''), 'Unknown'),
    COALESCE(NULLIF(p_payload->>'enslaved_name_normalized',''), lower(COALESCE(NULLIF(p_payload->>'enslaved_name_original',''), 'unknown'))),
    NULLIF(p_payload->>'gender',''),
    NULLIF(p_payload->>'approx_birth_year','')::INT,
    NULL
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_enslaved_person_id
  FROM archive1863.enslaved_people
  WHERE name_normalized = COALESCE(NULLIF(p_payload->>'enslaved_name_normalized',''), lower(COALESCE(NULLIF(p_payload->>'enslaved_name_original',''), 'unknown')))
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO archive1863.tax_assessment_entries (
    page_id, county_id, district_id, taxpayer_id, enslaved_person_id,
    line_number, sequence_on_page, year
  ) VALUES (
    NULLIF(p_payload->>'page_id','')::BIGINT,
    NULLIF(p_payload->>'county_id','')::BIGINT,
    NULLIF(p_payload->>'district_id','')::BIGINT,
    v_taxpayer_id,
    v_enslaved_person_id,
    NULLIF(p_payload->>'line_number',''),
    NULLIF(p_payload->>'sequence_on_page','')::INT,
    COALESCE(NULLIF(p_payload->>'year','')::INT, 1863)
  ) RETURNING id INTO v_entry_id;

  INSERT INTO archive1863.enslavement_details (
    entry_id, category_original, age_original, age_years, value_original,
    value_cents, quantity_original, remarks_original, transcription_confidence,
    transcriber_user_id, status
  ) VALUES (
    v_entry_id,
    NULLIF(p_payload->>'category_original',''),
    NULLIF(p_payload->>'age_original',''),
    NULLIF(p_payload->>'age_years','')::INT,
    NULLIF(p_payload->>'value_original',''),
    NULLIF(p_payload->>'value_cents','')::BIGINT,
    NULLIF(p_payload->>'quantity_original',''),
    NULLIF(p_payload->>'remarks_original',''),
    COALESCE(NULLIF(p_payload->>'transcription_confidence','')::NUMERIC, 0.80),
    NULL,
    COALESCE(NULLIF(p_payload->>'status',''), 'draft')
  );

  SELECT to_jsonb(t) INTO v_result
  FROM archive1863.tax_assessment_entries t
  WHERE t.id = v_entry_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_search_entries(
  p_name TEXT,
  p_county_id BIGINT DEFAULT NULL,
  p_district_id BIGINT DEFAULT NULL,
  p_year INT DEFAULT 1863,
  p_taxpayer TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT 'fuzzy',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  id BIGINT,
  year INT,
  line_number TEXT,
  sequence_on_page INT,
  county_id BIGINT,
  county_name TEXT,
  district_id BIGINT,
  district_name TEXT,
  enslaved_name_original TEXT,
  enslaved_name_normalized TEXT,
  taxpayer_name_original TEXT,
  taxpayer_name_normalized TEXT,
  category_original TEXT,
  age_original TEXT,
  age_years INT,
  value_original TEXT,
  value_cents BIGINT,
  quantity_original TEXT,
  remarks_original TEXT,
  transcription_confidence NUMERIC,
  page_id BIGINT,
  page_number_label TEXT,
  image_url TEXT,
  image_thumbnail_url TEXT,
  source_item_label TEXT,
  source_title TEXT,
  citation_preferred TEXT,
  repository_name TEXT,
  repository_location TEXT,
  repository_url TEXT,
  rank_score NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT
    tae.id,
    tae.year,
    tae.line_number,
    tae.sequence_on_page,
    c.id AS county_id,
    c.name AS county_name,
    d.id AS district_id,
    d.name AS district_name,
    ep.name_original,
    ep.name_normalized,
    t.name_original,
    t.name_normalized,
    ed.category_original,
    ed.age_original,
    ed.age_years,
    ed.value_original,
    ed.value_cents,
    ed.quantity_original,
    ed.remarks_original,
    ed.transcription_confidence,
    p.id AS page_id,
    p.page_number_label,
    p.image_url,
    p.image_thumbnail_url,
    si.label AS source_item_label,
    s.title AS source_title,
    s.citation_preferred,
    r.name AS repository_name,
    r.location AS repository_location,
    r.url AS repository_url,
    (
      CASE WHEN lower(ep.name_normalized) = lower(p_name) THEN 10 ELSE 0 END
      + COALESCE(ts_rank_cd(ep.name_tokens, websearch_to_tsquery('simple', p_name)), 0)
      + similarity(ep.name_normalized, lower(p_name))
    ) AS rank_score
  FROM archive1863.tax_assessment_entries tae
  JOIN archive1863.enslavement_details ed ON ed.entry_id = tae.id
  JOIN archive1863.enslaved_people ep ON ep.id = tae.enslaved_person_id
  JOIN archive1863.taxpayers t ON t.id = tae.taxpayer_id
  JOIN archive1863.pages p ON p.id = tae.page_id
  JOIN archive1863.source_items si ON si.id = p.source_item_id
  JOIN archive1863.sources s ON s.id = si.source_id
  JOIN archive1863.repositories r ON r.id = s.repository_id
  JOIN archive1863.counties c ON c.id = tae.county_id
  LEFT JOIN archive1863.districts d ON d.id = tae.district_id
  WHERE ed.status = 'approved'
    AND (
      (p_mode = 'exact' AND (lower(ep.name_original) = lower(p_name) OR lower(ep.name_normalized) = lower(p_name)))
      OR (p_mode = 'partial' AND (ep.name_original ILIKE '%' || p_name || '%' OR ep.name_normalized ILIKE '%' || lower(p_name) || '%'))
      OR (p_mode = 'fuzzy' AND (
        ep.name_tokens @@ websearch_to_tsquery('simple', p_name)
        OR similarity(ep.name_normalized, lower(p_name)) > 0.3
        OR ep.name_original ILIKE '%' || p_name || '%'
      ))
    )
    AND (p_county_id IS NULL OR tae.county_id = p_county_id)
    AND (p_district_id IS NULL OR tae.district_id = p_district_id)
    AND (p_year IS NULL OR tae.year = p_year)
    AND (
      p_taxpayer IS NULL
      OR t.name_original ILIKE '%' || p_taxpayer || '%'
      OR t.name_normalized ILIKE '%' || lower(p_taxpayer) || '%'
    )
  ORDER BY rank_score DESC, tae.sequence_on_page NULLS LAST, tae.id DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 200)
  OFFSET COALESCE(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.public_get_entry_detail(p_entry_id BIGINT)
RETURNS TABLE(
  id BIGINT,
  year INT,
  line_number TEXT,
  sequence_on_page INT,
  county_name TEXT,
  district_name TEXT,
  enslaved_name_original TEXT,
  enslaved_name_normalized TEXT,
  taxpayer_name_original TEXT,
  taxpayer_name_normalized TEXT,
  category_original TEXT,
  age_original TEXT,
  age_years INT,
  value_original TEXT,
  value_cents BIGINT,
  quantity_original TEXT,
  remarks_original TEXT,
  transcription_confidence NUMERIC,
  page_number_label TEXT,
  image_url TEXT,
  image_thumbnail_url TEXT,
  source_item_label TEXT,
  source_title TEXT,
  citation_preferred TEXT,
  repository_name TEXT,
  repository_location TEXT,
  repository_url TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = archive1863, public
AS $$
  SELECT
    tae.id,
    tae.year,
    tae.line_number,
    tae.sequence_on_page,
    c.name,
    d.name,
    ep.name_original,
    ep.name_normalized,
    t.name_original,
    t.name_normalized,
    ed.category_original,
    ed.age_original,
    ed.age_years,
    ed.value_original,
    ed.value_cents,
    ed.quantity_original,
    ed.remarks_original,
    ed.transcription_confidence,
    p.page_number_label,
    p.image_url,
    p.image_thumbnail_url,
    si.label,
    s.title,
    s.citation_preferred,
    r.name,
    r.location,
    r.url
  FROM archive1863.tax_assessment_entries tae
  JOIN archive1863.enslavement_details ed ON ed.entry_id = tae.id
  JOIN archive1863.enslaved_people ep ON ep.id = tae.enslaved_person_id
  JOIN archive1863.taxpayers t ON t.id = tae.taxpayer_id
  JOIN archive1863.pages p ON p.id = tae.page_id
  JOIN archive1863.source_items si ON si.id = p.source_item_id
  JOIN archive1863.sources s ON s.id = si.source_id
  JOIN archive1863.repositories r ON r.id = s.repository_id
  JOIN archive1863.counties c ON c.id = tae.county_id
  LEFT JOIN archive1863.districts d ON d.id = tae.district_id
  WHERE tae.id = p_entry_id
    AND ed.status = 'approved'
  LIMIT 1;
$$;

GRANT USAGE ON SCHEMA archive1863 TO anon, authenticated;
GRANT SELECT ON archive1863.v_review_queue TO authenticated;
GRANT SELECT ON archive1863.v_entries_by_page TO authenticated;
GRANT SELECT ON archive1863.v_my_drafts TO authenticated;
GRANT SELECT ON archive1863.v_transcription_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transcription_entry(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_search_entries(TEXT,BIGINT,BIGINT,INT,TEXT,TEXT,INT,INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_entry_detail(BIGINT) TO anon, authenticated;
