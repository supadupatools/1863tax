import express from "express";
import { query } from "../config/db.js";
import { asyncHandler } from "../utils/http.js";
import { writeAuditLog } from "../middleware/audit.js";

export const adminRouter = express.Router();

const tableConfig = {
  counties: ["name", "state", "notes"],
  districts: ["county_id", "name", "type", "notes"],
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
  ]
};

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

adminRouter.get(
  "/:table",
  asyncHandler(async (req, res) => {
    const cols = tableConfig[req.params.table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });

    const result = await query(`SELECT * FROM ${req.params.table} ORDER BY id DESC LIMIT 200`);
    return res.json(result.rows);
  })
);

adminRouter.post(
  "/:table",
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    const cols = tableConfig[table];
    if (!cols) return res.status(404).json({ error: "unknown_table" });

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
