import express from "express";
import { query } from "../config/db.js";
import { asyncHandler } from "../utils/http.js";
import { writeAuditLog } from "../middleware/audit.js";
import { hashPassword } from "../utils/security.js";

export const adminRouter = express.Router();

const tableConfig = {
  counties: ["name", "state", "notes", "enabled"],
  districts: ["county_id", "name", "type", "notes", "enabled"],
  repositories: ["name", "location", "url", "notes"],
  sources: [
    "repository_id",
    "title",
    "county_id",
    "year",
    "format",
    "call_number",
    "microfilm_roll",
    "citation_preferred",
    "rights",
    "notes"
  ],
  source_items: ["source_id", "label", "date_range", "notes"],
  pages: [
    "source_item_id",
    "county_id",
    "district_id",
    "page_number_label",
    "image_url",
    "image_thumbnail_url",
    "captured_at",
    "needs_review",
    "notes"
  ],
  taxpayers: ["county_id", "district_id", "name_original", "name_normalized", "notes"],
  enslaved_people: [
    "name_original",
    "name_normalized",
    "gender",
    "approx_birth_year",
    "notes"
  ],
  aliases: ["entity_type", "entity_id", "alias_original", "alias_normalized", "notes"],
  app_users: ["email", "display_name", "role", "is_active"]
};

adminRouter.get(
  "/dashboard/stats",
  asyncHandler(async (_req, res) => {
    const [pages, draftEntries, awaiting, approved, missingDistrict, missingThumb, missingCitation] =
      await Promise.all([
        query("SELECT COUNT(*)::INT AS count FROM pages"),
        query(
          `SELECT COUNT(*)::INT AS count
           FROM enslavement_details
           WHERE status = 'draft'`
        ),
        query(
          `SELECT COUNT(*)::INT AS count
           FROM enslavement_details
           WHERE status IN ('pending_review', 'needs_review')`
        ),
        query(
          `SELECT COUNT(*)::INT AS count
           FROM enslavement_details
           WHERE status = 'approved'`
        ),
        query("SELECT COUNT(*)::INT AS count FROM pages WHERE district_id IS NULL"),
        query("SELECT COUNT(*)::INT AS count FROM pages WHERE image_thumbnail_url IS NULL"),
        query(
          `SELECT COUNT(*)::INT AS count
           FROM sources
           WHERE citation_preferred IS NULL OR btrim(citation_preferred) = ''`
        )
      ]);

    res.json({
      pages_scanned: pages.rows[0].count,
      entries_draft: draftEntries.rows[0].count,
      awaiting_review: awaiting.rows[0].count,
      approved_public: approved.rows[0].count,
      alerts: {
        missing_district_mapping: missingDistrict.rows[0].count,
        pages_without_thumbnails: missingThumb.rows[0].count,
        sources_missing_citations: missingCitation.rows[0].count
      }
    });
  })
);

adminRouter.get(
  "/transcription-queue",
  asyncHandler(async (req, res) => {
    const countyId = req.query.county_id || null;
    const districtId = req.query.district_id || null;
    const status = req.query.status || null;

    const result = await query(
      `
      SELECT
        p.id AS page_id,
        p.page_number_label,
        c.name AS county_name,
        d.name AS district_name,
        COALESCE(COUNT(tae.id), 0)::INT AS draft_entries,
        MAX(tae.updated_at) AS last_activity
      FROM pages p
      LEFT JOIN counties c ON c.id = p.county_id
      LEFT JOIN districts d ON d.id = p.district_id
      LEFT JOIN tax_assessment_entries tae ON tae.page_id = p.id
      LEFT JOIN enslavement_details ed ON ed.entry_id = tae.id
      WHERE ($1::BIGINT IS NULL OR p.county_id = $1)
        AND ($2::BIGINT IS NULL OR p.district_id = $2)
        AND ($3::TEXT IS NULL OR ed.status = $3)
      GROUP BY p.id, p.page_number_label, c.name, d.name
      ORDER BY MAX(p.updated_at) DESC
      LIMIT 250
      `,
      [countyId, districtId, status]
    );

    res.json(result.rows);
  })
);

adminRouter.get(
  "/my-drafts",
  asyncHandler(async (req, res) => {
    const result = await query(
      `
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
        AND ($1::BIGINT IS NULL OR ed.transcriber_user_id = $1)
      ORDER BY tae.updated_at DESC
      LIMIT 250
      `,
      [req.user?.id || null]
    );

    res.json(result.rows);
  })
);

adminRouter.get(
  "/audit-log",
  asyncHandler(async (req, res) => {
    const userId = req.query.user_id || null;
    const entity = req.query.entity || null;
    const since = req.query.since || null;
    const result = await query(
      `
      SELECT
        al.id,
        al.created_at,
        al.actor_user_id,
        u.email AS actor_email,
        al.action,
        al.table_name,
        al.record_id,
        al.old_data,
        al.new_data
      FROM audit_log al
      LEFT JOIN app_users u ON u.id = al.actor_user_id
      WHERE ($1::BIGINT IS NULL OR al.actor_user_id = $1)
        AND ($2::TEXT IS NULL OR al.table_name = $2)
        AND ($3::TIMESTAMPTZ IS NULL OR al.created_at >= $3)
      ORDER BY al.created_at DESC
      LIMIT 500
      `,
      [userId, entity, since]
    );
    res.json(result.rows);
  })
);

adminRouter.get(
  "/lookup/counties",
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT * FROM counties ORDER BY name");
    res.json(rows.rows);
  })
);

adminRouter.get(
  "/lookup/districts",
  asyncHandler(async (req, res) => {
    const countyId = req.query.county_id || null;
    const rows = countyId
      ? await query("SELECT * FROM districts WHERE county_id = $1 ORDER BY name", [countyId])
      : await query("SELECT * FROM districts ORDER BY name");
    res.json(rows.rows);
  })
);

adminRouter.post(
  "/users/invite",
  asyncHandler(async (req, res) => {
    const { email, role = "transcriber", display_name = "" } = req.body || {};
    if (!email) return res.status(400).json({ error: "email_required" });
    if (!["admin", "transcriber", "reviewer", "public"].includes(role)) {
      return res.status(400).json({ error: "invalid_role" });
    }

    const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}`;
    const created = await query(
      `
      INSERT INTO app_users (email, password_hash, display_name, role, is_active)
      VALUES ($1,$2,$3,$4,TRUE)
      ON CONFLICT (email) DO UPDATE
      SET role = EXCLUDED.role, display_name = EXCLUDED.display_name, is_active = TRUE, updated_at = NOW()
      RETURNING id, email, display_name, role, is_active
      `,
      [email.toLowerCase().trim(), hashPassword(tempPassword), display_name, role]
    );

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "invite_user",
      tableName: "app_users",
      recordId: created.rows[0].id,
      oldData: null,
      newData: created.rows[0],
      requestMeta: { ip: req.ip }
    });

    return res.status(201).json({
      user: created.rows[0],
      temporary_password: tempPassword
    });
  })
);

adminRouter.get(
  "/:table",
  asyncHandler(async (req, res) => {
    const cols = tableConfig[req.params.table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });

    const result =
      req.params.table === "app_users"
        ? await query(
          `SELECT id, email, display_name, role, is_active, created_at, updated_at
             FROM app_users
             ORDER BY id DESC
             LIMIT 200`
        )
        : await query(`SELECT * FROM ${req.params.table} ORDER BY id DESC LIMIT 200`);
    return res.json(result.rows);
  })
);

adminRouter.post(
  "/:table",
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    const cols = tableConfig[table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });
    if (table === "app_users") {
      return res.status(400).json({ error: "disable_user_instead_of_delete" });
    }
    if (table === "app_users") {
      return res.status(400).json({ error: "use_invite_endpoint_for_users" });
    }

    const payload = req.body || {};
    const selectedCols = cols.filter((c) => payload[c] !== undefined);
    if (!selectedCols.length) {
      return res.status(400).json({ error: "no_fields_provided" });
    }

    const values = selectedCols.map((c) => payload[c]);
    const placeholders = selectedCols.map((_, idx) => `$${idx + 1}`);

    const insert = await query(
      `INSERT INTO ${table} (${selectedCols.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      values
    );

    const created = insert.rows[0];

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "create",
      tableName: table,
      recordId: created.id,
      oldData: null,
      newData: created,
      requestMeta: { ip: req.ip }
    });

    return res.status(201).json(created);
  })
);

adminRouter.put(
  "/:table/:id",
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    const cols = tableConfig[table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });
    if (table === "app_users") {
      const payload = req.body || {};
      const allowed = ["display_name", "role", "is_active"];
      const selectedCols = allowed.filter((c) => payload[c] !== undefined);
      if (!selectedCols.length) {
        return res.status(400).json({ error: "no_fields_provided" });
      }

      const existingResult = await query(
        `SELECT id, email, display_name, role, is_active FROM app_users WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      const existing = existingResult.rows[0];
      if (!existing) return res.status(404).json({ error: "not_found" });

      const updates = selectedCols.map((c, idx) => `${c} = $${idx + 1}`);
      const values = selectedCols.map((c) => payload[c]);
      values.push(req.params.id);
      const updatedResult = await query(
        `UPDATE app_users SET ${updates.join(",")}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, email, display_name, role, is_active`,
        values
      );

      await writeAuditLog({
        actorUserId: req.user?.id,
        action: "update",
        tableName: table,
        recordId: req.params.id,
        oldData: existing,
        newData: updatedResult.rows[0],
        requestMeta: { ip: req.ip }
      });

      return res.json(updatedResult.rows[0]);
    }

    const existingResult = await query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: "not_found" });

    const payload = req.body || {};
    const selectedCols = cols.filter((c) => payload[c] !== undefined);
    if (!selectedCols.length) {
      return res.status(400).json({ error: "no_fields_provided" });
    }

    const updates = selectedCols.map((c, idx) => `${c} = $${idx + 1}`);
    const values = selectedCols.map((c) => payload[c]);
    values.push(req.params.id);

    const updatedResult = await query(
      `UPDATE ${table} SET ${updates.join(",")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );

    const updated = updatedResult.rows[0];

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "update",
      tableName: table,
      recordId: req.params.id,
      oldData: existing,
      newData: updated,
      requestMeta: { ip: req.ip }
    });

    return res.json(updated);
  })
);

adminRouter.delete(
  "/:table/:id",
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    const cols = tableConfig[table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });

    const existingResult = await query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: "not_found" });

    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);

    await writeAuditLog({
      actorUserId: req.user?.id,
      action: "delete",
      tableName: table,
      recordId: req.params.id,
      oldData: existing,
      newData: null,
      requestMeta: { ip: req.ip }
    });

    return res.status(204).send();
  })
);

export default adminRouter;
