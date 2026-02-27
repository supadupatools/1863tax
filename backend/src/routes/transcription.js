import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { withTransaction } from "../config/db.js";
import { asyncHandler } from "../utils/http.js";
import { normalizeText } from "../utils/security.js";
import { writeAuditLog } from "../middleware/audit.js";

export const transcriptionRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function getPageContext(client, pageId) {
  const result = await client.query(
    `
    SELECT
      p.id,
      p.county_id,
      p.district_id,
      p.page_number_label,
      p.image_url,
      si.label AS source_item_label,
      s.title AS source_title,
      r.name AS repository_name,
      r.location AS repository_location
    FROM pages p
    JOIN source_items si ON si.id = p.source_item_id
    JOIN sources s ON s.id = si.source_id
    JOIN repositories r ON r.id = s.repository_id
    WHERE p.id = $1
    LIMIT 1
    `,
    [pageId]
  );

  return result.rows[0] || null;
}

function requirePayloadFields(payload, requiredFields) {
  const missing = requiredFields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  return missing;
}

async function validateAndResolveEntryPayload(client, payload) {
  const pageId = Number(payload.page_id || 0);
  if (!pageId) {
    return { error: { error: "page_id_required" } };
  }

  const missing = requirePayloadFields(payload, [
    "taxpayer_name_original",
    "enslaved_name_original"
  ]);
  if (missing.length) {
    return { error: { error: "missing_required_fields", missing } };
  }

  const page = await getPageContext(client, pageId);
  if (!page) {
    return { error: { error: "page_not_found", page_id: pageId } };
  }

  if (payload.county_id && Number(payload.county_id) !== Number(page.county_id)) {
    return {
      error: {
        error: "county_mismatch_with_page",
        page_county_id: Number(page.county_id)
      }
    };
  }
  if (
    payload.district_id &&
    page.district_id &&
    Number(payload.district_id) !== Number(page.district_id)
  ) {
    return {
      error: {
        error: "district_mismatch_with_page",
        page_district_id: Number(page.district_id)
      }
    };
  }

  return {
    resolved: {
      ...payload,
      page_id: pageId,
      county_id: payload.county_id ? Number(payload.county_id) : Number(page.county_id),
      district_id: payload.district_id
        ? Number(payload.district_id)
        : (page.district_id ? Number(page.district_id) : null)
    },
    page
  };
}

async function getOrCreateTaxpayer(client, payload) {
  if (payload.taxpayer_id) return payload.taxpayer_id;

  const nameOriginal = payload.taxpayer_name_original || "Unknown";
  const nameNormalized = payload.taxpayer_name_normalized || normalizeText(nameOriginal);

  const existing = await client.query(
    `
    SELECT id FROM taxpayers
    WHERE county_id = $1
      AND COALESCE(district_id, -1) = COALESCE($2, -1)
      AND name_normalized = $3
    LIMIT 1
    `,
    [payload.county_id, payload.district_id || null, nameNormalized]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO taxpayers (county_id, district_id, name_original, name_normalized)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [payload.county_id, payload.district_id || null, nameOriginal, nameNormalized]
  );

  return inserted.rows[0].id;
}

async function getOrCreateEnslavedPerson(client, payload) {
  if (payload.enslaved_person_id) return payload.enslaved_person_id;

  const nameOriginal = payload.enslaved_name_original || "Unknown";
  const nameNormalized = payload.enslaved_name_normalized || normalizeText(nameOriginal);

  const existing = await client.query(
    `SELECT id FROM enslaved_people WHERE name_normalized = $1 LIMIT 1`,
    [nameNormalized]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO enslaved_people (
      name_original,
      name_normalized,
      gender,
      approx_birth_year,
      notes
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [
      nameOriginal,
      nameNormalized,
      payload.gender || null,
      payload.approx_birth_year || null,
      payload.enslaved_notes || null
    ]
  );

  return inserted.rows[0].id;
}

transcriptionRouter.post(
  "/entries",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const created = await withTransaction(async (client) => {
      const validated = await validateAndResolveEntryPayload(client, payload);
      if (validated.error) return { error: validated.error };
      const resolvedPayload = validated.resolved;

      const taxpayerId = await getOrCreateTaxpayer(client, resolvedPayload);
      const enslavedPersonId = await getOrCreateEnslavedPerson(client, resolvedPayload);

      const entry = await client.query(
        `
        INSERT INTO tax_assessment_entries (
          page_id,
          county_id,
          district_id,
          taxpayer_id,
          enslaved_person_id,
          line_number,
          sequence_on_page,
          year
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          resolvedPayload.page_id,
          resolvedPayload.county_id,
          resolvedPayload.district_id || null,
          taxpayerId,
          enslavedPersonId,
          resolvedPayload.line_number || null,
          resolvedPayload.sequence_on_page || null,
          resolvedPayload.year || 1863
        ]
      );

      await client.query(
        `
        INSERT INTO enslavement_details (
          entry_id,
          category_original,
          age_original,
          age_years,
          value_original,
          value_cents,
          quantity_original,
          remarks_original,
          transcription_confidence,
          transcriber_user_id,
          reviewed_by_user_id,
          status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11)
        `,
        [
          entry.rows[0].id,
          resolvedPayload.category_original || null,
          resolvedPayload.age_original || null,
          resolvedPayload.age_years || null,
          resolvedPayload.value_original || null,
          resolvedPayload.value_cents || null,
          resolvedPayload.quantity_original || null,
          resolvedPayload.remarks_original || null,
          resolvedPayload.transcription_confidence || null,
          req.user?.id || null,
          resolvedPayload.status || "draft"
        ]
      );

      return entry.rows[0];
    });

    if (created?.error) {
      return res.status(400).json(created.error);
    }

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "create",
      tableName: "tax_assessment_entries",
      recordId: created.id,
      oldData: null,
      newData: created,
      requestMeta: { ip: req.ip }
    });

    return res.status(201).json(created);
  })
);

transcriptionRouter.put(
  "/entries/:id",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const updated = await withTransaction(async (client) => {
      const existingEntry = await client.query(
        `SELECT * FROM tax_assessment_entries WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (!existingEntry.rows[0]) return null;

      const taxpayerId = await getOrCreateTaxpayer(client, {
        ...payload,
        county_id: payload.county_id || existingEntry.rows[0].county_id,
        district_id: payload.district_id ?? existingEntry.rows[0].district_id
      });
      const enslavedPersonId = await getOrCreateEnslavedPerson(client, payload);

      const entry = await client.query(
        `
        UPDATE tax_assessment_entries
        SET
          page_id = COALESCE($1, page_id),
          county_id = COALESCE($2, county_id),
          district_id = COALESCE($3, district_id),
          taxpayer_id = COALESCE($4, taxpayer_id),
          enslaved_person_id = COALESCE($5, enslaved_person_id),
          line_number = COALESCE($6, line_number),
          sequence_on_page = COALESCE($7, sequence_on_page),
          year = COALESCE($8, year),
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
        `,
        [
          payload.page_id || null,
          payload.county_id || null,
          payload.district_id || null,
          taxpayerId || null,
          enslavedPersonId || null,
          payload.line_number || null,
          payload.sequence_on_page || null,
          payload.year || null,
          req.params.id
        ]
      );

      await client.query(
        `
        UPDATE enslavement_details
        SET
          category_original = COALESCE($1, category_original),
          age_original = COALESCE($2, age_original),
          age_years = COALESCE($3, age_years),
          value_original = COALESCE($4, value_original),
          value_cents = COALESCE($5, value_cents),
          quantity_original = COALESCE($6, quantity_original),
          remarks_original = COALESCE($7, remarks_original),
          transcription_confidence = COALESCE($8, transcription_confidence),
          status = COALESCE($9, status),
          updated_at = NOW()
        WHERE entry_id = $10
        `,
        [
          payload.category_original || null,
          payload.age_original || null,
          payload.age_years || null,
          payload.value_original || null,
          payload.value_cents || null,
          payload.quantity_original || null,
          payload.remarks_original || null,
          payload.transcription_confidence || null,
          payload.status || null,
          req.params.id
        ]
      );

      return { old: existingEntry.rows[0], entry: entry.rows[0] };
    });

    if (!updated) return res.status(404).json({ error: "not_found" });

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "update",
      tableName: "tax_assessment_entries",
      recordId: req.params.id,
      oldData: updated.old,
      newData: updated.entry,
      requestMeta: { ip: req.ip }
    });

    return res.json(updated.entry);
  })
);

transcriptionRouter.post(
  "/entries/:id/submit",
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT * FROM enslavement_details WHERE entry_id = $1 LIMIT 1",
        [req.params.id]
      );
      if (!current.rows[0]) return null;

      const updated = await client.query(
        `
        UPDATE enslavement_details
        SET status = 'pending_review', updated_at = NOW()
        WHERE entry_id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      return { old: current.rows[0], new: updated.rows[0] };
    });

    if (!result) return res.status(404).json({ error: "not_found" });

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "submit_for_review",
      tableName: "enslavement_details",
      recordId: req.params.id,
      oldData: result.old,
      newData: result.new,
      requestMeta: { ip: req.ip }
    });

    return res.json(result.new);
  })
);

transcriptionRouter.get(
  "/entries/by-page/:pageId",
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (client) => {
      const rows = await client.query(
        `
        SELECT
          tae.id,
          tae.page_id,
          tae.sequence_on_page,
          tae.line_number,
          tae.year,
          p.page_number_label,
          p.image_url,
          si.label AS source_item_label,
          s.title AS source_title,
          r.name AS repository_name,
          r.location AS repository_location,
          t.name_original AS taxpayer_name_original,
          ep.name_original AS enslaved_name_original,
          ed.status,
          ed.transcription_confidence
        FROM tax_assessment_entries tae
        JOIN enslavement_details ed ON ed.entry_id = tae.id
        JOIN pages p ON p.id = tae.page_id
        JOIN source_items si ON si.id = p.source_item_id
        JOIN sources s ON s.id = si.source_id
        JOIN repositories r ON r.id = s.repository_id
        JOIN taxpayers t ON t.id = tae.taxpayer_id
        JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
        WHERE tae.page_id = $1
        ORDER BY tae.sequence_on_page NULLS LAST, tae.id
        `,
        [req.params.pageId]
      );
      return rows.rows;
    });
    res.json(result);
  })
);

transcriptionRouter.post(
  "/bulk-import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const format = req.body?.format || "csv";
    if (!req.file) {
      return res.status(400).json({ error: "file_required" });
    }

    let rows;
    if (format === "json") {
      rows = JSON.parse(req.file.buffer.toString("utf8"));
    } else {
      rows = parse(req.file.buffer.toString("utf8"), {
        columns: true,
        skip_empty_lines: true
      });
    }

    const dedupeWarnings = [];
    let imported = 0;

    await withTransaction(async (client) => {
      for (const row of rows) {
        const validated = await validateAndResolveEntryPayload(client, row);
        if (validated.error) {
          dedupeWarnings.push({
            row,
            warning: "invalid_row",
            details: validated.error
          });
          continue;
        }

        const resolvedRow = validated.resolved;

        const duplicate = await client.query(
          `
          SELECT tae.id
          FROM tax_assessment_entries tae
          JOIN enslaved_people ep ON ep.id = tae.enslaved_person_id
          WHERE tae.page_id = $1
            AND COALESCE(tae.sequence_on_page, -1) = COALESCE($2, -1)
            AND ep.name_normalized = $3
          LIMIT 1
          `,
          [
            resolvedRow.page_id,
            resolvedRow.sequence_on_page || null,
            normalizeText(resolvedRow.enslaved_name_original)
          ]
        );

        if (duplicate.rows[0]) {
          dedupeWarnings.push({
            row,
            existing_entry_id: duplicate.rows[0].id,
            warning: "possible_duplicate"
          });
          continue;
        }

        const taxpayerId = await getOrCreateTaxpayer(client, {
          county_id: resolvedRow.county_id,
          district_id: resolvedRow.district_id,
          taxpayer_name_original: resolvedRow.taxpayer_name_original,
          taxpayer_name_normalized: resolvedRow.taxpayer_name_normalized
        });
        const enslavedPersonId = await getOrCreateEnslavedPerson(client, {
          enslaved_name_original: resolvedRow.enslaved_name_original,
          enslaved_name_normalized: resolvedRow.enslaved_name_normalized,
          gender: resolvedRow.gender,
          approx_birth_year: resolvedRow.approx_birth_year
        });

        const entry = await client.query(
          `
          INSERT INTO tax_assessment_entries (
            page_id, county_id, district_id, taxpayer_id, enslaved_person_id,
            line_number, sequence_on_page, year
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id
          `,
          [
            resolvedRow.page_id,
            resolvedRow.county_id,
            resolvedRow.district_id || null,
            taxpayerId,
            enslavedPersonId,
            resolvedRow.line_number || null,
            resolvedRow.sequence_on_page || null,
            resolvedRow.year || 1863
          ]
        );

        await client.query(
          `
          INSERT INTO enslavement_details (
            entry_id, category_original, age_original, age_years, value_original,
            value_cents, quantity_original, remarks_original, transcription_confidence,
            transcriber_user_id, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            entry.rows[0].id,
            resolvedRow.category_original || null,
            resolvedRow.age_original || null,
            resolvedRow.age_years || null,
            resolvedRow.value_original || null,
            resolvedRow.value_cents || null,
            resolvedRow.quantity_original || null,
            resolvedRow.remarks_original || null,
            resolvedRow.transcription_confidence || null,
            req.user?.id || null,
            resolvedRow.status || "draft"
          ]
        );

        imported += 1;
      }
    });

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "bulk_import",
      tableName: "tax_assessment_entries",
      recordId: null,
      oldData: null,
      newData: { imported, rows: rows.length, dedupeWarnings: dedupeWarnings.length },
      requestMeta: { ip: req.ip }
    });

    return res.json({ imported, dedupeWarnings });
  })
);

export default transcriptionRouter;
