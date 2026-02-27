# Transcription Workflow

## 1) Source Ingestion
1. Create `repositories` record.
2. Create `sources` linked to repository and county.
3. Create `source_items` (book/roll/volume sections).
4. Create `pages` with page labels and image URLs.

## 2) Transcription Entry
In Admin Portal > Transcription Workspace:
1. Select a page from Queue or Pages and open it in Workspace.
2. Confirm page context before entry:
   - `page_number_label`
   - source chain: `repository -> source -> source_item -> page`
   - county/district
3. Page metadata is authoritative:
   - `page_id` is required
   - `county_id` / `district_id` should come from page metadata
2. Enter taxpayer as-written + normalized.
3. Enter enslaved name as-written + normalized.
4. Enter line and sequence values when present.
5. Enter observed attributes exactly as written:
   - age/category/value/remarks
6. Set confidence and save as `draft`.
7. Resolve QA warnings before submit:
   - possible duplicate sequence + names on same page
   - missing district (if page has no mapped district)

## 3) Submit for Review
- Use `POST /api/transcriptions/entries/:id/submit`.
- Status changes to `pending_review`.

## 3b) Bulk Import (Entries)
- Required fields per row:
  - `page_id`
  - `taxpayer_name_original`
  - `enslaved_name_original`
- Recommended fields:
  - `sequence_on_page`, `line_number`, `year`
  - `category_original`, `age_original`, `age_years`, `value_original`, `value_cents`, `remarks_original`
- Import validation:
  - page must exist
  - county/district must match page when supplied
  - duplicate row warnings emitted for same page + sequence + normalized name

## 4) Review
In Admin Portal > Review Queue:
1. Reviewer inspects row + source image context.
2. Reviewer approves or rejects.
3. `approved` records are now visible to public search.

## 5) Public Access
- Public users can search only `approved` entries.
- Detail view includes citation chain and source image link.
