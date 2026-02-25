# Architecture Overview

## Goals
- Preserve historical fidelity by storing exact text in `*_original` fields.
- Support researcher-friendly matching through normalized fields and fuzzy/full-text search.
- Guarantee citation provenance to repository/source/item/page/image.
- Separate public discovery from editorial workflows.

## Components
- `backend/migrations/001_init.sql`
  - Full PostgreSQL schema and indexes.
- `backend/src/server.js`
  - Express app and route wiring.
- `backend/src/routes/public.js`
  - Public search and detail endpoints (approved entries only).
- `backend/src/routes/admin.js`
  - Source manager CRUD.
- `backend/src/routes/transcription.js`
  - Entry creation/editing, submit for review, bulk import.
- `backend/src/routes/review.js`
  - Review queue and approve/reject decisions.
- `backend/src/middleware/auth.js`
  - Role enforcement (`admin`, `transcriber`, `reviewer`, `public`).
- `backend/src/middleware/audit.js`
  - Audit logging for create/update/delete/review/import actions.
- `web/public`
  - Public search UI.
- `web/admin`
  - Admin portal.

## Search Strategy
- Full-text (`GIN`) index on:
  - `enslaved_people.name_tokens`
  - `taxpayers.name_tokens`
- Trigram (`pg_trgm`) index on:
  - `enslaved_people.name_normalized`
  - `taxpayers.name_normalized`
- Ranking combines exact match boosts, `ts_rank_cd`, and trigram similarity.

## Access Control
- Public endpoints expose only records where `enslavement_details.status = 'approved'`.
- Admin endpoints require role `admin`.
- Transcription endpoints require `admin` or `transcriber`.
- Review endpoints require `admin` or `reviewer`.

## Auditability
All edits and workflow state changes are written to `audit_log` with:
- actor
- action
- table/record
- before/after JSON snapshots
- request metadata
