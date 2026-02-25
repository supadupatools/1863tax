import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : false
});

pool.on("connect", async (client) => {
  await client.query("SET search_path TO archive1863, public");
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
