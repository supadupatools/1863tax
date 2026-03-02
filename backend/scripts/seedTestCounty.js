import { pool, withTransaction } from "../src/config/db.js";

const SEED_MARKER = "[seed:test-county]";
const COUNTY_NAME = "Test County";
const STATE = "NC";

const DISTRICTS = [
  {
    name: "Upper Test District",
    type: "Captain's District",
    notes: `${SEED_MARKER} Northern district used for UI testing`
  },
  {
    name: "Lower Test District",
    type: "Captain's District",
    notes: `${SEED_MARKER} Southern district used for UI testing`
  }
];

const SOURCES = [
  {
    title: "1863 Tax Assessment Roll for Test County",
    format: "Ledger Book",
    call_number: "TC-1863-BOX-1",
    microfilm_roll: "MF-TEST-07",
    citation_preferred: "Raeford Research, Test County 1863 Tax Assessment Roll, 1863.",
    rights: "For design and QA use inside the project only.",
    item_label: "Volume A",
    date_range: "1863",
    pages: [
      {
        district_name: "Upper Test District",
        page_number_label: "Page 12",
        image_url: "/src/public/images/C.016.94101_0051.jpg",
        image_thumbnail_url: "/src/public/images/C.016.94101_0051 copy.jpeg",
        captured_at: "1863-07-14T10:15:00Z",
        notes: `${SEED_MARKER} Ledger page with clustered household entries`,
        entries: [
          {
            line_number: "14",
            sequence_on_page: 1,
            taxpayer_name_original: "Josiah Carter",
            taxpayer_name_normalized: "josiah carter",
            taxpayer_notes: `${SEED_MARKER} Plantation account holder with multiple assessed people`,
            enslaved_name_original: "Harriet",
            enslaved_name_normalized: "harriet",
            gender: "female",
            approx_birth_year: 1845,
            enslaved_notes: `${SEED_MARKER} Adult woman listed in taxable property schedule`,
            category_original: "1 Female",
            age_original: "18",
            age_years: 18,
            value_original: "$900",
            value_cents: 90000,
            quantity_original: "1",
            remarks_original: "Recorded beside main dwelling tract; notation suggests field and domestic labor.",
            transcription_confidence: 0.9812,
            status: "approved"
          },
          {
            line_number: "15",
            sequence_on_page: 2,
            taxpayer_name_original: "Josiah Carter",
            taxpayer_name_normalized: "josiah carter",
            taxpayer_notes: `${SEED_MARKER} Plantation account holder with multiple assessed people`,
            enslaved_name_original: "Elias",
            enslaved_name_normalized: "elias",
            gender: "male",
            approx_birth_year: 1849,
            enslaved_notes: `${SEED_MARKER} Teenage male named in same household cluster`,
            category_original: "1 Boy",
            age_original: "14",
            age_years: 14,
            value_original: "$650",
            value_cents: 65000,
            quantity_original: "1",
            remarks_original: "Adjacent to Harriet entry; grouped under same taxpayer with lower assessed value.",
            transcription_confidence: 0.9575,
            status: "approved"
          },
          {
            line_number: "16",
            sequence_on_page: 3,
            taxpayer_name_original: "Josiah Carter",
            taxpayer_name_normalized: "josiah carter",
            taxpayer_notes: `${SEED_MARKER} Plantation account holder with multiple assessed people`,
            enslaved_name_original: "Louisa Ann Carter",
            enslaved_name_normalized: "louisa ann carter",
            gender: "female",
            approx_birth_year: 1856,
            enslaved_notes: `${SEED_MARKER} Younger girl entered with extended family-style surname`,
            category_original: "1 Girl",
            age_original: "7",
            age_years: 7,
            value_original: "$320",
            value_cents: 32000,
            quantity_original: "1",
            remarks_original: "Surname copied in clerk hand; useful for long-name wrapping in results cards.",
            transcription_confidence: 0.9442,
            status: "approved"
          }
        ]
      },
      {
        district_name: "Lower Test District",
        page_number_label: "Page 13",
        image_url: "/src/public/images/8c35333u1.jpg",
        image_thumbnail_url: "/src/public/images/8b35942u.jpg",
        captured_at: "1863-07-14T10:20:00Z",
        notes: `${SEED_MARKER} Continuation page with mixed completeness for design QA`,
        entries: [
          {
            line_number: "3",
            sequence_on_page: 1,
            taxpayer_name_original: "Margaret McNair",
            taxpayer_name_normalized: "margaret mcnair",
            taxpayer_notes: `${SEED_MARKER} Estate listing under widow's account`,
            enslaved_name_original: "Dinah",
            enslaved_name_normalized: "dinah",
            gender: "female",
            approx_birth_year: 1833,
            enslaved_notes: `${SEED_MARKER} Adult woman with extended remark field`,
            category_original: "1 Woman",
            age_original: "30",
            age_years: 30,
            value_original: "$1,100",
            value_cents: 110000,
            quantity_original: "1",
            remarks_original: "Estate notation references inherited property and a secondary tract near the creek crossing.",
            transcription_confidence: 0.9431,
            status: "approved"
          },
          {
            line_number: "4",
            sequence_on_page: 2,
            taxpayer_name_original: "Thomas Blue",
            taxpayer_name_normalized: "thomas blue",
            taxpayer_notes: `${SEED_MARKER} Smallholder account with single named assessment`,
            enslaved_name_original: "Isaac",
            enslaved_name_normalized: "isaac",
            gender: "male",
            approx_birth_year: 1851,
            enslaved_notes: `${SEED_MARKER} Younger male record used for detail view testing`,
            category_original: "1 Boy",
            age_original: "12",
            age_years: 12,
            value_original: "$500",
            value_cents: 50000,
            quantity_original: "1",
            remarks_original: "Short annotation in margin, useful for testing compact and long result cards together.",
            transcription_confidence: 0.9184,
            status: "approved"
          },
          {
            line_number: "5",
            sequence_on_page: 3,
            taxpayer_name_original: "Margaret McNair",
            taxpayer_name_normalized: "margaret mcnair",
            taxpayer_notes: `${SEED_MARKER} Estate listing under widow's account`,
            enslaved_name_original: "Sabra Jane",
            enslaved_name_normalized: "sabra jane",
            gender: "female",
            approx_birth_year: 1847,
            enslaved_notes: `${SEED_MARKER} Entry with omitted value field`,
            category_original: "1 Girl",
            age_original: "16",
            age_years: 16,
            value_original: null,
            value_cents: null,
            quantity_original: "1",
            remarks_original: "No valuation copied on this line; useful for sparse field rendering.",
            transcription_confidence: 0.9025,
            status: "approved"
          }
        ]
      }
    ]
  },
  {
    title: "Supplementary District Abstract for Test County",
    format: "Bound Summary Volume",
    call_number: "TC-1863-BOX-2",
    microfilm_roll: "MF-TEST-09",
    citation_preferred: "Raeford Research, Test County Supplementary District Abstract, 1863.",
    rights: "For design and QA use inside the project only.",
    item_label: "Volume B",
    date_range: "Late Summer 1863",
    pages: [
      {
        district_name: "Upper Test District",
        page_number_label: "Abstract 2",
        image_url: "/src/public/images/Breakfast, Lunch and Dinner- 1939.jpg",
        image_thumbnail_url: "/src/public/images/Julia.jpg",
        captured_at: "1863-08-02T11:05:00Z",
        notes: `${SEED_MARKER} Summary abstract with longer names and repeated taxpayers`,
        entries: [
          {
            line_number: "21",
            sequence_on_page: 1,
            taxpayer_name_original: "Nathaniel Beauregard McAllister",
            taxpayer_name_normalized: "nathaniel beauregard mcallister",
            taxpayer_notes: `${SEED_MARKER} Long taxpayer name for layout stress testing`,
            enslaved_name_original: "Charlotte Henrietta Williamson",
            enslaved_name_normalized: "charlotte henrietta williamson",
            gender: "female",
            approx_birth_year: 1841,
            enslaved_notes: `${SEED_MARKER} Long named entry for wrapping and hierarchy checks`,
            category_original: "1 Woman",
            age_original: "22",
            age_years: 22,
            value_original: "$1,250",
            value_cents: 125000,
            quantity_original: "1",
            remarks_original: "Surname copied in full with no abbreviation, creating a useful long-line search result.",
            transcription_confidence: 0.9368,
            status: "approved"
          },
          {
            line_number: "22",
            sequence_on_page: 2,
            taxpayer_name_original: "Nathaniel Beauregard McAllister",
            taxpayer_name_normalized: "nathaniel beauregard mcallister",
            taxpayer_notes: `${SEED_MARKER} Long taxpayer name for layout stress testing`,
            enslaved_name_original: "William Henry",
            enslaved_name_normalized: "william henry",
            gender: "male",
            approx_birth_year: 1843,
            enslaved_notes: `${SEED_MARKER} Related entry under same taxpayer with shorter name`,
            category_original: "1 Man",
            age_original: "20",
            age_years: 20,
            value_original: "$1,180",
            value_cents: 118000,
            quantity_original: "1",
            remarks_original: "Same taxpayer cluster as Charlotte Henrietta Williamson.",
            transcription_confidence: 0.9244,
            status: "approved"
          }
        ]
      },
      {
        district_name: "Lower Test District",
        page_number_label: "Abstract 8",
        image_url: "/src/public/images/All Photos - 6815 of 7561.jpg",
        image_thumbnail_url: "/src/public/images/map example.jpg",
        captured_at: "1863-08-04T09:45:00Z",
        notes: `${SEED_MARKER} Summary page with sparse values and repeated lower-district household`,
        entries: [
          {
            line_number: "9",
            sequence_on_page: 1,
            taxpayer_name_original: "Rebecca McLaurin Estate",
            taxpayer_name_normalized: "rebecca mclaurin estate",
            taxpayer_notes: `${SEED_MARKER} Estate account with sparse copied fields`,
            enslaved_name_original: "Ben",
            enslaved_name_normalized: "ben",
            gender: "male",
            approx_birth_year: null,
            enslaved_notes: `${SEED_MARKER} Sparse record lacking exact age and quantity text`,
            category_original: "1 Man",
            age_original: null,
            age_years: null,
            value_original: "$700",
            value_cents: 70000,
            quantity_original: null,
            remarks_original: "Age not entered in copied abstract; useful for missing age display.",
            transcription_confidence: 0.8891,
            status: "approved"
          },
          {
            line_number: "10",
            sequence_on_page: 2,
            taxpayer_name_original: "Rebecca McLaurin Estate",
            taxpayer_name_normalized: "rebecca mclaurin estate",
            taxpayer_notes: `${SEED_MARKER} Estate account with sparse copied fields`,
            enslaved_name_original: "Milly",
            enslaved_name_normalized: "milly",
            gender: "female",
            approx_birth_year: 1838,
            enslaved_notes: `${SEED_MARKER} Related estate record with missing remarks`,
            category_original: "1 Woman",
            age_original: "25",
            age_years: 25,
            value_original: "$860",
            value_cents: 86000,
            quantity_original: "1",
            remarks_original: null,
            transcription_confidence: 0.9118,
            status: "approved"
          }
        ]
      },
      {
        district_name: "Lower Test District",
        page_number_label: "Abstract 11",
        image_url: "/src/public/images/Young Julia Imagined.png",
        image_thumbnail_url: "/src/public/images/rr-logo-cropped.png",
        captured_at: "1863-08-06T14:25:00Z",
        notes: `${SEED_MARKER} Single-page fixture with mixed-value children for age filtering`,
        entries: [
          {
            line_number: "1",
            sequence_on_page: 1,
            taxpayer_name_original: "Archibald Smith",
            taxpayer_name_normalized: "archibald smith",
            taxpayer_notes: `${SEED_MARKER} Taxpayer with mixed child and adult ages for filter testing`,
            enslaved_name_original: "Rose",
            enslaved_name_normalized: "rose",
            gender: "female",
            approx_birth_year: 1854,
            enslaved_notes: `${SEED_MARKER} Younger girl useful for age-range filter testing`,
            category_original: "1 Girl",
            age_original: "9",
            age_years: 9,
            value_original: "$275",
            value_cents: 27500,
            quantity_original: "1",
            remarks_original: "Short entry with low valuation for compact display.",
            transcription_confidence: 0.8964,
            status: "approved"
          },
          {
            line_number: "2",
            sequence_on_page: 2,
            taxpayer_name_original: "Archibald Smith",
            taxpayer_name_normalized: "archibald smith",
            taxpayer_notes: `${SEED_MARKER} Taxpayer with mixed child and adult ages for filter testing`,
            enslaved_name_original: "Scipio",
            enslaved_name_normalized: "scipio",
            gender: "male",
            approx_birth_year: 1834,
            enslaved_notes: `${SEED_MARKER} Adult male under same taxpayer for household grouping`,
            category_original: "1 Man",
            age_original: "29",
            age_years: 29,
            value_original: "$1,050",
            value_cents: 105000,
            quantity_original: "1",
            remarks_original: "Contrasts directly with Rose in age and valuation under same taxpayer.",
            transcription_confidence: 0.9316,
            status: "approved"
          }
        ]
      }
    ]
  }
];

async function upsertCounty(client) {
  const result = await client.query(
    `
      INSERT INTO counties (name, state, notes, enabled)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (name, state) DO UPDATE
      SET notes = EXCLUDED.notes,
          enabled = TRUE,
          updated_at = NOW()
      RETURNING id
    `,
    [COUNTY_NAME, STATE, `${SEED_MARKER} County fixture for public/admin UI testing`]
  );

  return result.rows[0].id;
}

async function upsertDistrict(client, countyId, district) {
  const result = await client.query(
    `
      INSERT INTO districts (county_id, name, type, notes, enabled)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (county_id, name) DO UPDATE
      SET type = EXCLUDED.type,
          notes = EXCLUDED.notes,
          enabled = TRUE,
          updated_at = NOW()
      RETURNING id
    `,
    [countyId, district.name, district.type, district.notes]
  );

  return result.rows[0].id;
}

async function clearExistingSeed(client) {
  await client.query(`DELETE FROM aliases WHERE notes = $1`, [SEED_MARKER]);

  await client.query(
    `
      DELETE FROM enslavement_details ed
      USING tax_assessment_entries tae, pages p, source_items si, sources s
      WHERE ed.entry_id = tae.id
        AND tae.page_id = p.id
        AND p.source_item_id = si.id
        AND si.source_id = s.id
        AND s.notes = $1
    `,
    [SEED_MARKER]
  );

  await client.query(
    `
      DELETE FROM tax_assessment_entries tae
      USING pages p, source_items si, sources s
      WHERE tae.page_id = p.id
        AND p.source_item_id = si.id
        AND si.source_id = s.id
        AND s.notes = $1
    `,
    [SEED_MARKER]
  );

  await client.query(
    `
      DELETE FROM pages p
      USING source_items si, sources s
      WHERE p.source_item_id = si.id
        AND si.source_id = s.id
        AND s.notes = $1
    `,
    [SEED_MARKER]
  );

  await client.query(
    `
      DELETE FROM source_items si
      USING sources s
      WHERE si.source_id = s.id
        AND s.notes = $1
    `,
    [SEED_MARKER]
  );

  await client.query(`DELETE FROM sources WHERE notes = $1`, [SEED_MARKER]);
  await client.query(`DELETE FROM repositories WHERE notes = $1`, [SEED_MARKER]);
  await client.query(`DELETE FROM taxpayers WHERE notes LIKE $1`, [`${SEED_MARKER}%`]);
  await client.query(`DELETE FROM enslaved_people WHERE notes LIKE $1`, [`${SEED_MARKER}%`]);
}

async function insertRepository(client) {
  const repositoryResult = await client.query(
    `
      INSERT INTO repositories (name, location, url, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [
      "Raeford Research Test Repository",
      "Fayetteville, North Carolina",
      "https://raefordresearch.com/test-county",
      SEED_MARKER
    ]
  );

  return repositoryResult.rows[0].id;
}

async function insertSource(client, { repositoryId, countyId, source }) {
  const sourceResult = await client.query(
    `
      INSERT INTO sources (
        repository_id, title, county_id, year, format, call_number,
        microfilm_roll, citation_preferred, rights, notes
      )
      VALUES ($1, $2, $3, 1863, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      repositoryId,
      source.title,
      countyId,
      source.format,
      source.call_number,
      source.microfilm_roll,
      source.citation_preferred,
      source.rights,
      SEED_MARKER
    ]
  );

  const sourceItemResult = await client.query(
    `
      INSERT INTO source_items (source_id, label, date_range, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [sourceResult.rows[0].id, source.item_label, source.date_range, SEED_MARKER]
  );

  return {
    sourceId: sourceResult.rows[0].id,
    sourceItemId: sourceItemResult.rows[0].id
  };
}

async function insertEntry(client, { countyId, districtId, pageId, entry }) {
  const taxpayerResult = await client.query(
    `
      INSERT INTO taxpayers (county_id, district_id, name_original, name_normalized, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      countyId,
      districtId,
      entry.taxpayer_name_original,
      entry.taxpayer_name_normalized,
      entry.taxpayer_notes
    ]
  );
  const taxpayerId = taxpayerResult.rows[0].id;

  const enslavedResult = await client.query(
    `
      INSERT INTO enslaved_people (name_original, name_normalized, gender, approx_birth_year, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      entry.enslaved_name_original,
      entry.enslaved_name_normalized,
      entry.gender,
      entry.approx_birth_year,
      entry.enslaved_notes
    ]
  );
  const enslavedPersonId = enslavedResult.rows[0].id;

  const entryResult = await client.query(
    `
      INSERT INTO tax_assessment_entries (
        page_id, county_id, district_id, taxpayer_id, enslaved_person_id,
        line_number, sequence_on_page, year
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1863)
      RETURNING id
    `,
    [
      pageId,
      countyId,
      districtId,
      taxpayerId,
      enslavedPersonId,
      entry.line_number,
      entry.sequence_on_page
    ]
  );
  const entryId = entryResult.rows[0].id;

  await client.query(
    `
      INSERT INTO enslavement_details (
        entry_id, category_original, age_original, age_years, value_original,
        value_cents, quantity_original, remarks_original, transcription_confidence, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      entryId,
      entry.category_original,
      entry.age_original,
      entry.age_years,
      entry.value_original,
      entry.value_cents,
      entry.quantity_original,
      entry.remarks_original,
      entry.transcription_confidence,
      entry.status
    ]
  );
}

async function run() {
  const summary = await withTransaction(async (client) => {
    await clearExistingSeed(client);

    const countyId = await upsertCounty(client);
    const districtIds = {};
    for (const district of DISTRICTS) {
      districtIds[district.name] = await upsertDistrict(client, countyId, district);
    }

    const repositoryId = await insertRepository(client);

    let sourceCount = 0;
    let pageCount = 0;
    let entryCount = 0;

    for (const source of SOURCES) {
      const { sourceItemId } = await insertSource(client, { repositoryId, countyId, source });
      sourceCount += 1;

      for (const page of source.pages) {
        const pageResult = await client.query(
          `
            INSERT INTO pages (
              source_item_id, county_id, district_id, page_number_label, image_url,
              image_thumbnail_url, captured_at, needs_review, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)
            RETURNING id
          `,
          [
            sourceItemId,
            countyId,
            districtIds[page.district_name],
            page.page_number_label,
            page.image_url,
            page.image_thumbnail_url,
            page.captured_at,
            page.notes
          ]
        );

        pageCount += 1;
        const pageId = pageResult.rows[0].id;

        for (const entry of page.entries) {
          await insertEntry(client, {
            countyId,
            districtId: districtIds[page.district_name],
            pageId,
            entry
          });
          entryCount += 1;
        }
      }
    }

    return {
      county: COUNTY_NAME,
      districts: Object.keys(districtIds).length,
      sources: sourceCount,
      pages: pageCount,
      entries: entryCount
    };
  });

  console.log(
    `Seed complete for ${summary.county}: ${summary.districts} districts, ${summary.sources} sources, ${summary.pages} pages, ${summary.entries} approved entries`
  );
  await pool.end();
}

run().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
