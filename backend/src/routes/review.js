import express from "express";
import { query } from "../config/db.js";
import { asyncHandler } from "../utils/http.js";
import { writeAuditLog } from "../middleware/audit.js";

export const reviewRouter = express.Router();

reviewRouter.get(
  "/queue",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `
      SELECT
        tae.id,
        tae.year,
        tae.line_number,
        tae.sequence_on_page,
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
      LEFT JOIN districts d ON d.id = tae.district_id
      WHERE ed.status IN ('pending_review', 'rejected')
      ORDER BY tae.updated_at DESC
      LIMIT 200
      `
    );

    return res.json(result.rows);
  })
);

reviewRouter.post(
  "/entries/:id/decision",
  asyncHandler(async (req, res) => {
    const { decision, notes } = req.body || {};
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "decision_must_be_approved_or_rejected" });
    }

    const current = await query(
      "SELECT * FROM enslavement_details WHERE entry_id = $1 LIMIT 1",
      [req.params.id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: "not_found" });

    const updated = await query(
      `
      UPDATE enslavement_details
      SET
        status = $1,
        reviewed_by_user_id = $2,
        remarks_original = CASE
          WHEN $3::TEXT IS NULL OR $3 = '' THEN remarks_original
          ELSE CONCAT(COALESCE(remarks_original, ''), E'\n[Review Note] ', $3)
        END,
        updated_at = NOW()
      WHERE entry_id = $4
      RETURNING *
      `,
      [decision, req.user?.id || null, notes || null, req.params.id]
    );

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: `review_${decision}`,
      tableName: "enslavement_details",
      recordId: req.params.id,
      oldData: current.rows[0],
      newData: updated.rows[0],
      requestMeta: { ip: req.ip }
    });

    return res.json(updated.rows[0]);
  })
);

export default reviewRouter;
