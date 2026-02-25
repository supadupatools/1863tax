import { query } from "../config/db.js";
import { normalizeText } from "../utils/security.js";

function buildMatchPredicate(mode) {
  if (mode === "exact") {
    return `(
      ep.name_normalized = $1
      OR ep.name_original = $2
    )`;
  }

  if (mode === "partial") {
    return `(
      ep.name_normalized ILIKE '%' || $1 || '%'
      OR ep.name_original ILIKE '%' || $2 || '%'
    )`;
  }

  return `(
    ep.name_tokens @@ websearch_to_tsquery('simple', $2)
    OR similarity(ep.name_normalized, $1) > 0.3
    OR ep.name_original ILIKE '%' || $2 || '%'
  )`;
}

export async function searchPublicEntries({
  name,
  countyId,
  districtId,
  year = 1863,
  taxpayer,
  mode = "fuzzy",
  limit = 50,
  offset = 0
}) {
  const normalizedName = normalizeText(name);
  const rawName = String(name || "").trim();
  const normalizedTaxpayer = normalizeText(taxpayer || "");
  const matchPredicate = buildMatchPredicate(mode);

  const sql = `
    SELECT
      tae.id,
      tae.year,
      tae.line_number,
      tae.sequence_on_page,
      c.id AS county_id,
      c.name AS county_name,
      d.id AS district_id,
      d.name AS district_name,
      ep.id AS enslaved_person_id,
      ep.name_original AS enslaved_name_original,
      ep.name_normalized AS enslaved_name_normalized,
      t.id AS taxpayer_id,
      t.name_original AS taxpayer_name_original,
      t.name_normalized AS taxpayer_name_normalized,
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
      si.id AS source_item_id,
      si.label AS source_item_label,
      s.id AS source_id,
      s.title AS source_title,
      s.citation_preferred,
      r.id AS repository_id,
      r.name AS repository_name,
      r.location AS repository_location,
      r.url AS repository_url,
      (
        CASE WHEN ep.name_normalized = $1 THEN 10 ELSE 0 END
        + CASE WHEN ep.name_original = $2 THEN 8 ELSE 0 END
        + COALESCE(ts_rank_cd(ep.name_tokens, websearch_to_tsquery('simple', $2)), 0)
        + similarity(ep.name_normalized, $1)
      ) AS rank_score
    FROM tax_assessment_entries tae
    JOIN enslavement_details ed ON ed.entry_id = tae.id
    JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
    JOIN taxpayers t ON t.id = tae.taxpayer_id
    JOIN pages p ON p.id = tae.page_id
    JOIN source_items si ON si.id = p.source_item_id
    JOIN sources s ON s.id = si.source_id
    JOIN repositories r ON r.id = s.repository_id
    JOIN counties c ON c.id = tae.county_id
    LEFT JOIN districts d ON d.id = tae.district_id
    WHERE ed.status = 'approved'
      AND ${matchPredicate}
      AND ($3::INT IS NULL OR tae.county_id = $3)
      AND ($4::INT IS NULL OR tae.district_id = $4)
      AND ($5::INT IS NULL OR tae.year = $5)
      AND (
        $6::TEXT IS NULL
        OR t.name_normalized ILIKE '%' || $6 || '%'
        OR t.name_original ILIKE '%' || $7 || '%'
      )
    ORDER BY rank_score DESC, tae.sequence_on_page NULLS LAST, tae.id DESC
    LIMIT $8 OFFSET $9
  `;

  const values = [
    normalizedName,
    rawName,
    countyId || null,
    districtId || null,
    year || null,
    normalizedTaxpayer || null,
    taxpayer || null,
    limit,
    offset
  ];

  const result = await query(sql, values);
  return result.rows;
}

export async function getPublicEntryDetail(entryId) {
  const result = await query(
    `
    SELECT
      tae.id,
      tae.year,
      tae.line_number,
      tae.sequence_on_page,
      tae.county_id,
      c.name AS county_name,
      tae.district_id,
      d.name AS district_name,
      ep.id AS enslaved_person_id,
      ep.name_original AS enslaved_name_original,
      ep.name_normalized AS enslaved_name_normalized,
      ep.gender,
      ep.approx_birth_year,
      ep.notes AS enslaved_notes,
      t.id AS taxpayer_id,
      t.name_original AS taxpayer_name_original,
      t.name_normalized AS taxpayer_name_normalized,
      t.notes AS taxpayer_notes,
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
      p.notes AS page_notes,
      si.id AS source_item_id,
      si.label AS source_item_label,
      si.date_range AS source_item_date_range,
      s.id AS source_id,
      s.title AS source_title,
      s.citation_preferred,
      s.call_number,
      s.microfilm_roll,
      s.format,
      s.rights,
      r.id AS repository_id,
      r.name AS repository_name,
      r.location AS repository_location,
      r.url AS repository_url
    FROM tax_assessment_entries tae
    JOIN enslavement_details ed ON ed.entry_id = tae.id
    JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
    JOIN taxpayers t ON t.id = tae.taxpayer_id
    JOIN pages p ON p.id = tae.page_id
    JOIN source_items si ON si.id = p.source_item_id
    JOIN sources s ON s.id = si.source_id
    JOIN repositories r ON r.id = s.repository_id
    JOIN counties c ON c.id = tae.county_id
    LEFT JOIN districts d ON d.id = tae.district_id
    WHERE tae.id = $1
      AND ed.status = 'approved'
    LIMIT 1
    `,
    [entryId]
  );

  return result.rows[0] || null;
}
