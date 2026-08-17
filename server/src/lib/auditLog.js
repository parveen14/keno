import { query } from './db.js';

export async function writeAuditLog({ tableName, recordId, action, changedBy, oldData, newData }) {
  await query(
    `INSERT INTO audit_log (table_name, record_id, action, changed_by, old_data, new_data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tableName, recordId, action, changedBy ?? null, oldData ?? null, newData ?? null]
  );
}
