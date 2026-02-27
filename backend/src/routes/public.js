import express from "express";
import { asyncHandler, parseIntOrNull } from "../utils/http.js";
import { query } from "../config/db.js";
import { getPublicEntryDetail, searchPublicEntries } from "../services/searchService.js";

export const publicRouter = express.Router();

publicRouter.get(
  "/filters",
  asyncHandler(async (req, res) => {
    const countyId = parseIntOrNull(req.query.county_id);

    const countiesResult = await query(
      "SELECT id, name FROM counties WHERE enabled = TRUE ORDER BY name ASC"
    );
    const districtsResult = await query(
      `
        SELECT id, county_id, name
        FROM districts
        WHERE enabled = TRUE
          AND ($1::BIGINT IS NULL OR county_id = $1)
        ORDER BY name ASC
      `,
      [countyId]
    );

    return res.json({
      counties: countiesResult.rows,
      districts: districtsResult.rows
    });
  })
);

publicRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const name = (req.query.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "name_required" });
    }

    const entries = await searchPublicEntries({
      name,
      countyId: parseIntOrNull(req.query.county_id),
      districtId: parseIntOrNull(req.query.district_id),
      year: parseIntOrNull(req.query.year) || 1863,
      taxpayer: req.query.taxpayer_name || null,
      mode: req.query.match_mode || "fuzzy",
      limit: Math.min(parseIntOrNull(req.query.limit) || 50, 100),
      offset: parseIntOrNull(req.query.offset) || 0
    });

    return res.json({ count: entries.length, entries });
  })
);

publicRouter.get(
  "/entries/:id",
  asyncHandler(async (req, res) => {
    const detail = await getPublicEntryDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ entry: detail });
  })
);

export default publicRouter;
