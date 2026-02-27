import { pool, query } from "../src/config/db.js";

async function run() {
  const emailArg = process.argv[2];
  const roleArg = (process.argv[3] || "admin").trim().toLowerCase();
  const allowedRoles = new Set(["admin", "transcriber", "reviewer", "public"]);

  if (!emailArg) {
    throw new Error("usage: node scripts/grantSupabaseRole.js <email> [role]");
  }
  if (!allowedRoles.has(roleArg)) {
    throw new Error(`invalid role: ${roleArg}`);
  }

  const email = emailArg.trim().toLowerCase();

  const authUserResult = await query(
    `
    SELECT id, email
    FROM auth.users
    WHERE lower(email) = $1
    LIMIT 1
    `,
    [email]
  );

  if (!authUserResult.rows.length) {
    throw new Error(`no auth.users record found for ${email}`);
  }

  const authUser = authUserResult.rows[0];

  await query(
    `
    UPDATE archive1863.user_profiles
    SET auth_user_id = $1,
        role = $2,
        is_active = TRUE,
        updated_at = NOW()
    WHERE lower(email) = $3
    `,
    [authUser.id, roleArg, email]
  );

  await query(
    `
    INSERT INTO archive1863.user_profiles (auth_user_id, email, display_name, role, is_active)
    VALUES ($1, $2, $2, $3, TRUE)
    ON CONFLICT (auth_user_id) DO UPDATE
    SET email = EXCLUDED.email,
        role = EXCLUDED.role,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [authUser.id, email, roleArg]
  );

  console.log(`Granted role=${roleArg} for ${email} (${authUser.id})`);
}

run()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
