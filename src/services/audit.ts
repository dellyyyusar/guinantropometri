import { getDb, type Db } from '~/db'
import { auditLogs, type AuditAction } from '~/db/schema'

/** Db atau transaction: keduanya punya .insert dengan bentuk yang sama. */
export type DbExecutor = Pick<Db, 'insert'>

export type AuditEntry = {
  userId: number | null
  entity: 'child' | 'measurement' | 'user' | 'import'
  entityId: number | string
  action: AuditAction
  oldData?: unknown
  newData?: unknown
}

/**
 * Tulis jejak audit: siapa, kapan, entity apa, data sebelum dan sesudah.
 * `executor` boleh transaction supaya audit ikut rollback bila perubahan gagal.
 */
export async function writeAuditLog(entry: AuditEntry, executor: DbExecutor = getDb()): Promise<void> {
  await executor.insert(auditLogs).values({
    userId: entry.userId,
    entity: entry.entity,
    entityId: String(entry.entityId),
    action: entry.action,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
  })
}
