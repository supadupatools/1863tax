import { query, pool } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/utils/security.js";

async function run() {
  const email = env.adminEmail.toLowerCase().trim();
  const passwordHash = hashPassword(env.adminPassword);

  await query(
    `
    INSERT INTO app_users (email, password_hash, display_name, role)
    VALUES ($1, $2, 'System Admin', 'admin')
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        updated_at = NOW()
    `,
    [email, passwordHash]
  );

  const countyResult = await query(
    `
    INSERT INTO counties (name, state, notes)
    VALUES ('Sample County', 'NC', 'Replace with surviving NC counties')
    ON CONFLICT (name, state) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id
    `
  );

  const countyId = countyResult.rows[0].id;

  await query(
    `
    INSERT INTO districts (county_id, name, type, notes)
    VALUES ($1, 'Sample District', 'District', 'Seed district for testing')
    ON CONFLICT (county_id, name) DO NOTHING
    `,
    [countyId]
  );

  await query(
    `
    INSERT INTO repositories (name, location, url, notes)
    VALUES ('North Carolina State Archives', 'Raleigh, NC', 'https://archives.ncdcr.gov', 'Seed repository')
    ON CONFLICT DO NOTHING
    `
  );

  console.log("Seed complete: admin user + base lookup rows");
  await pool.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
