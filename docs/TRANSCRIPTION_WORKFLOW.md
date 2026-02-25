# Transcription Workflow

## 1) Source Ingestion
1. Create `repositories` record.
2. Create `sources` linked to repository and county.
3. Create `source_items` (book/roll/volume sections).
4. Create `pages` with page labels and image URLs.

## 2) Transcription Entry
In Admin Portal > Transcription Workspace:
1. Select `page_id`, `county_id`, optional `district_id`.
2. Enter taxpayer as-written + normalized.
3. Enter enslaved name as-written + normalized.
4. Enter line and sequence values when present.
5. Enter observed attributes exactly as written:
   - age/category/value/remarks
6. Set confidence and save as `draft`.

## 3) Submit for Review
- Use `POST /api/transcriptions/entries/:id/submit`.
- Status changes to `pending_review`.

## 4) Review
In Admin Portal > Review Queue:
1. Reviewer inspects row + source image context.
2. Reviewer approves or rejects.
3. `approved` records are now visible to public search.

## 5) Public Access
- Public users can search only `approved` entries.
- Detail view includes citation chain and source image link.
