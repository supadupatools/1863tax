# 1863 North Carolina Tax Assessment Archive

Web-based archive for the **1863 NC Tax Assessment / Slave Name Tax Lists**, focused on helping researchers find enslaved individuals named in surviving county records.

## Stack
- Backend: Node.js (Express) + PostgreSQL
- Search: PostgreSQL `tsvector` + `pg_trgm` similarity
- Public UI: `web/public`
- Admin UI: `web/admin`

## Quick Start
1. Copy env file:
   - `cp backend/.env.example backend/.env`
2. Install dependencies:
   - `cd backend && npm install`
3. Run migrations:
   - `npm run migrate`
4. Seed admin account:
   - `npm run seed:admin`
5. Start server:
   - `npm run dev`
6. Open:
   - Public: `http://localhost:3002/`
   - Admin: `http://localhost:3002/admin/`

## API Summary
- Public:
  - `GET /api/public/search`
  - `GET /api/public/entries/:id`
- Auth:
  - `POST /api/auth/login`
- Admin source manager (admin only):
  - `GET/POST/PUT/DELETE /api/admin/:table`
- Transcription workspace (admin/transcriber):
  - `POST /api/transcriptions/entries`
  - `PUT /api/transcriptions/entries/:id`
  - `POST /api/transcriptions/entries/:id/submit`
  - `POST /api/transcriptions/bulk-import`
- Review queue (admin/reviewer):
  - `GET /api/review/queue`
  - `POST /api/review/entries/:id/decision`

## Tests
From `backend/`:
- `npm test`

Includes tests for:
- search ranking behavior
- RBAC access control

## Docs
- `docs/ARCHITECTURE.md`
- `docs/TRANSCRIPTION_WORKFLOW.md`
- `docs/ADD_COUNTY_SOURCE.md`
