import { query } from "../config/db.js";

export async function writeAuditLog({
  actorUserId,
  action,
  tableName,
  recordId,
  oldData,
  newData,
  requestMeta
}) {
  await query(
    `
    INSERT INTO audit_log (
      actor_user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      request_meta
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      actorUserId || null,
      action,
      tableName,
      recordId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      requestMeta ? JSON.stringify(requestMeta) : null
    ]
  );
}
