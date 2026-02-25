import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { withTransaction } from "../config/db.js";
import { asyncHandler } from "../utils/http.js";
import { normalizeText } from "../utils/security.js";
import { writeAuditLog } from "../middleware/audit.js";

export const transcriptionRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
      const taxpayerId = await getOrCreateTaxpayer(client, payload);
      const enslavedPersonId = await getOrCreateEnslavedPerson(client, payload);

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
          payload.page_id,
          payload.county_id,
          payload.district_id || null,
          taxpayerId,
          enslavedPersonId,
          payload.line_number || null,
          payload.sequence_on_page || null,
          payload.year || 1863
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
          payload.category_original || null,
          payload.age_original || null,
          payload.age_years || null,
          payload.value_original || null,
          payload.value_cents || null,
          payload.quantity_original || null,
          payload.remarks_original || null,
          payload.transcription_confidence || null,
          req.user?.id || null,
          payload.status || "draft"
        ]
      );

      return entry.rows[0];
    });

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
          t.name_original AS taxpayer_name_original,
          ep.name_original AS enslaved_name_original,
          ed.status,
          ed.transcription_confidence
        FROM tax_assessment_entries tae
        JOIN enslavement_details ed ON ed.entry_id = tae.id
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
          [row.page_id, row.sequence_on_page || null, normalizeText(row.enslaved_name_original)]
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
          county_id: row.county_id,
          district_id: row.district_id,
          taxpayer_name_original: row.taxpayer_name_original,
          taxpayer_name_normalized: row.taxpayer_name_normalized
        });
        const enslavedPersonId = await getOrCreateEnslavedPerson(client, {
          enslaved_name_original: row.enslaved_name_original,
          enslaved_name_normalized: row.enslaved_name_normalized,
          gender: row.gender,
          approx_birth_year: row.approx_birth_year
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
            row.page_id,
            row.county_id,
            row.district_id || null,
            taxpayerId,
            enslavedPersonId,
            row.line_number || null,
            row.sequence_on_page || null,
            row.year || 1863
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
            row.category_original || null,
            row.age_original || null,
            row.age_years || null,
            row.value_original || null,
            row.value_cents || null,
            row.quantity_original || null,
            row.remarks_original || null,
            row.transcription_confidence || null,
            req.user?.id || null,
            row.status || "draft"
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
