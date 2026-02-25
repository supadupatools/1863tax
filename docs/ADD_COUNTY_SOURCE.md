# Add a New County / Source Collection

## Prerequisites
- Migration has been applied.
- Admin user can authenticate in `/admin`.

## Steps
1. Add county:
   - Table: `counties`
   - Fields: `name`, `state`, `notes`
2. Add district(s):
   - Table: `districts`
   - Fields: `county_id`, `name`, `type`, `notes`
3. Add repository:
   - Table: `repositories`
   - Fields: `name`, `location`, `url`
4. Add source:
   - Table: `sources`
   - Include `repository_id`, `county_id`, `title`, `year`, citation metadata.
5. Add source item:
   - Table: `source_items`
   - Fields: `source_id`, `label`, `date_range`
6. Add pages/images:
   - Table: `pages`
   - Set `source_item_id`, `county_id`, `district_id`, `page_number_label`, `image_url`, `image_thumbnail_url`
7. Add transcriptions:
   - Use Transcription Workspace or bulk import endpoint.
8. Submit and review:
   - Draft -> Pending -> Approved.

## Citation Integrity Checklist
Each public record should resolve:
- repository name/location/url
- source title
- source item label
- page label
- image URL/thumbnail

## Data Quality Checklist
- Preserve exact spelling in `*_original`.
- Use normalized values only for search support.
- Keep line/sequence fields when available for image alignment.
