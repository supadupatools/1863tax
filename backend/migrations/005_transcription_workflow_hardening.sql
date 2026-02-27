SET search_path TO archive1863, public;

DROP VIEW IF EXISTS v_entries_by_page;

CREATE OR REPLACE VIEW v_entries_by_page AS
SELECT
  tae.id,
  tae.page_id,
  tae.sequence_on_page,
  tae.line_number,
  tae.year,
  p.page_number_label,
  p.image_url,
  c.name AS county_name,
  d.name AS district_name,
  si.label AS source_item_label,
  s.title AS source_title,
  r.name AS repository_name,
  r.location AS repository_location,
  t.name_original AS taxpayer_name_original,
  ep.name_original AS enslaved_name_original,
  ed.status,
  ed.transcription_confidence,
  tae.updated_at
FROM tax_assessment_entries tae
JOIN enslavement_details ed ON ed.entry_id = tae.id
JOIN taxpayers t ON t.id = tae.taxpayer_id
JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
JOIN pages p ON p.id = tae.page_id
LEFT JOIN counties c ON c.id = tae.county_id
LEFT JOIN districts d ON d.id = tae.district_id
JOIN source_items si ON si.id = p.source_item_id
JOIN sources s ON s.id = si.source_id
JOIN repositories r ON r.id = s.repository_id;

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
  v_page_id BIGINT;
  v_page_county_id BIGINT;
  v_page_district_id BIGINT;
  v_county_id BIGINT;
  v_district_id BIGINT;
  v_name_taxpayer_original TEXT;
  v_name_enslaved_original TEXT;
  v_taxpayer_norm TEXT;
  v_enslaved_norm TEXT;
BEGIN
  IF NOT archive1863.can_transcribe() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_page_id := NULLIF(p_payload->>'page_id', '')::BIGINT;
  IF v_page_id IS NULL THEN
    RAISE EXCEPTION 'page_id_required';
  END IF;

  v_name_taxpayer_original := NULLIF(p_payload->>'taxpayer_name_original', '');
  v_name_enslaved_original := NULLIF(p_payload->>'enslaved_name_original', '');
  IF v_name_taxpayer_original IS NULL OR v_name_enslaved_original IS NULL THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;

  SELECT p.county_id, p.district_id
  INTO v_page_county_id, v_page_district_id
  FROM archive1863.pages p
  WHERE p.id = v_page_id
  LIMIT 1;

  IF v_page_county_id IS NULL THEN
    RAISE EXCEPTION 'page_not_found';
  END IF;

  v_county_id := COALESCE(NULLIF(p_payload->>'county_id', '')::BIGINT, v_page_county_id);
  v_district_id := COALESCE(NULLIF(p_payload->>'district_id', '')::BIGINT, v_page_district_id);

  IF v_county_id <> v_page_county_id THEN
    RAISE EXCEPTION 'county_mismatch_with_page';
  END IF;

  v_taxpayer_norm := COALESCE(NULLIF(p_payload->>'taxpayer_name_normalized', ''), lower(v_name_taxpayer_original));
  v_enslaved_norm := COALESCE(NULLIF(p_payload->>'enslaved_name_normalized', ''), lower(v_name_enslaved_original));

  INSERT INTO archive1863.taxpayers (county_id, district_id, name_original, name_normalized, notes)
  VALUES (
    v_county_id,
    v_district_id,
    v_name_taxpayer_original,
    v_taxpayer_norm,
    NULL
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_taxpayer_id
  FROM archive1863.taxpayers
  WHERE COALESCE(county_id, -1) = COALESCE(v_county_id, -1)
    AND COALESCE(district_id, -1) = COALESCE(v_district_id, -1)
    AND name_normalized = v_taxpayer_norm
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO archive1863.enslaved_people (name_original, name_normalized, gender, approx_birth_year, notes)
  VALUES (
    v_name_enslaved_original,
    v_enslaved_norm,
    NULLIF(p_payload->>'gender', ''),
    NULLIF(p_payload->>'approx_birth_year', '')::INT,
    NULL
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_enslaved_person_id
  FROM archive1863.enslaved_people
  WHERE name_normalized = v_enslaved_norm
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO archive1863.tax_assessment_entries (
    page_id, county_id, district_id, taxpayer_id, enslaved_person_id,
    line_number, sequence_on_page, year
  ) VALUES (
    v_page_id,
    v_county_id,
    v_district_id,
    v_taxpayer_id,
    v_enslaved_person_id,
    NULLIF(p_payload->>'line_number', ''),
    NULLIF(p_payload->>'sequence_on_page', '')::INT,
    COALESCE(NULLIF(p_payload->>'year', '')::INT, 1863)
  ) RETURNING id INTO v_entry_id;

  INSERT INTO archive1863.enslavement_details (
    entry_id, category_original, age_original, age_years, value_original,
    value_cents, quantity_original, remarks_original, transcription_confidence,
    transcriber_user_id, status
  ) VALUES (
    v_entry_id,
    NULLIF(p_payload->>'category_original', ''),
    NULLIF(p_payload->>'age_original', ''),
    NULLIF(p_payload->>'age_years', '')::INT,
    NULLIF(p_payload->>'value_original', ''),
    NULLIF(p_payload->>'value_cents', '')::BIGINT,
    NULLIF(p_payload->>'quantity_original', ''),
    NULLIF(p_payload->>'remarks_original', ''),
    COALESCE(NULLIF(p_payload->>'transcription_confidence', '')::NUMERIC, 0.80),
    NULL,
    COALESCE(NULLIF(p_payload->>'status', ''), 'draft')
  );

  SELECT to_jsonb(t) INTO v_result
  FROM archive1863.tax_assessment_entries t
  WHERE t.id = v_entry_id;

  RETURN v_result;
END;
$$;
