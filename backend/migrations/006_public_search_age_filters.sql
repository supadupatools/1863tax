SET search_path TO archive1863, public;

DROP FUNCTION IF EXISTS public.public_search_entries(TEXT, BIGINT, BIGINT, INT, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.public_search_entries(
  p_name TEXT,
  p_county_id BIGINT DEFAULT NULL,
  p_district_id BIGINT DEFAULT NULL,
  p_year INT DEFAULT 1863,
  p_taxpayer TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT 'fuzzy',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_age_min INT DEFAULT NULL,
  p_age_max INT DEFAULT NULL
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
    AND (p_age_min IS NULL OR ed.age_years >= p_age_min)
    AND (p_age_max IS NULL OR ed.age_years <= p_age_max)
    AND (
      p_taxpayer IS NULL
      OR t.name_original ILIKE '%' || p_taxpayer || '%'
      OR t.name_normalized ILIKE '%' || lower(p_taxpayer) || '%'
    )
  ORDER BY rank_score DESC, tae.sequence_on_page NULLS LAST, tae.id DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 200)
  OFFSET COALESCE(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.public_search_entries(TEXT, BIGINT, BIGINT, INT, TEXT, TEXT, INT, INT, INT, INT) TO anon, authenticated;
