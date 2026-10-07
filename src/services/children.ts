import { and, count, eq, like, or, sql } from 'drizzle-orm'
import { getDb, sqlAll } from '~/db'
import { anthropometricResults, children, measurements, type Child, type Gender, type AnthropometricResult, type Measurement } from '~/db/schema'
import { AppError, ValidationError } from '~/lib/errors'
import { writeAuditLog } from './audit'
import type { ChildFilters, ChildInput } from '~/validators/schemas'

export const PAGE_SIZE = 20

export type ChildSummary = {
  id: number
  childCode: string
  name: string
  gender: Gender
  dateOfBirth: string
  latestMeasurementDate: string | null
  latestAgeMonths: number | null
  latestOverallStatus: string | null
}

export type ChildListResult = {
  rows: ChildSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** LIKE wildcard di input pengguna harus di-escape supaya "%" tidak jadi pencocok sembarang. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function buildWhere(filters: ChildFilters) {
  const conditions = []
  const q = filters.q.trim()
  if (q !== '') {
    const pattern = `%${escapeLike(q)}%`
    conditions.push(or(like(children.name, pattern), like(children.childCode, pattern)))
  }
  if (filters.gender !== 'ALL') conditions.push(eq(children.gender, filters.gender))
  return conditions.length === 0 ? undefined : and(...conditions)
}

/**
 * Status pengukuran terakhir per anak.
 * ROW_NUMBER() dipakai karena MAX(measurement_date) bisa seri bila satu anak
 * diukur dua kali pada tanggal yang sama â€” tanpa tie-break barisnya ganda.
 */
type LatestInfo = Pick<ChildSummary, 'latestMeasurementDate' | 'latestAgeMonths' | 'latestOverallStatus'>

async function latestPerChild(childIds: number[]): Promise<Map<number, LatestInfo>> {
  if (childIds.length === 0) return new Map()

  const ids = sql.join(
    childIds.map((id) => sql`${id}`),
    sql`, `,
  )

  const rows = await sqlAll<{
    child_id: number
    measurement_date: string
    age_total_months: string
    overall_status: string
  }>(sql`
    WITH ranked AS (
      SELECT
        m.child_id,
        m.measurement_date,
        m.age_total_months,
        r.overall_status,
        ROW_NUMBER() OVER (
          PARTITION BY m.child_id
          ORDER BY m.measurement_date DESC, m.id DESC
        ) AS rn
      FROM ${measurements} m
      INNER JOIN ${anthropometricResults} r ON r.measurement_id = m.id
      WHERE m.child_id IN (${ids})
    )
    SELECT child_id, measurement_date, age_total_months, overall_status
    FROM ranked
    WHERE rn = 1
  `)

  return new Map<number, LatestInfo>(
    rows.map((row) => [
      row.child_id,
      {
        latestMeasurementDate: row.measurement_date,
        latestAgeMonths: Number(row.age_total_months),
        latestOverallStatus: row.overall_status,
      },
    ]),
  )
}

export async function listChildren(filters: ChildFilters): Promise<ChildListResult> {
  const db = getDb()
  const where = buildWhere(filters)

  const [totalRow] = await db.select({ value: count() }).from(children).where(where)
  const total = totalRow?.value ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, totalPages)

  const rows = await db
    .select({
      id: children.id,
      childCode: children.childCode,
      name: children.name,
      gender: children.gender,
      dateOfBirth: children.dateOfBirth,
    })
    .from(children)
    .where(where)
    .orderBy(children.name, children.id)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const latest = await latestPerChild(rows.map((r) => r.id))

  return {
    rows: rows.map((row) => {
      const extra = latest.get(row.id)
      return {
        ...row,
        latestMeasurementDate: extra?.latestMeasurementDate ?? null,
        latestAgeMonths: extra?.latestAgeMonths ?? null,
        latestOverallStatus: extra?.latestOverallStatus ?? null,
      }
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
  }
}

export type ChildDetail = {
  child: Child
  measurements: MeasurementWithResult[]
}

export type MeasurementWithResult = {
  measurement: Measurement
  result: AnthropometricResult | null
}

export async function getChildDetail(childId: number): Promise<ChildDetail> {
  const db = getDb()

  const [child] = await db.select().from(children).where(eq(children.id, childId)).limit(1)
  if (child === undefined) throw new AppError('CHILD_NOT_FOUND', 'Data anak tidak ditemukan.')

  const rows = await db
    .select({ measurement: measurements, result: anthropometricResults })
    .from(measurements)
    .leftJoin(anthropometricResults, eq(anthropometricResults.measurementId, measurements.id))
    .where(eq(measurements.childId, childId))
    .orderBy(measurements.measurementDate, measurements.id)

  return { child, measurements: rows }
}

/** Kode anak usulan untuk form "Tambah Anak". */
export async function suggestChildCode(): Promise<string> {
  const [row] = await getDb()
    .select({ maxId: sql<number>`COALESCE(MAX(${children.id}), 0)` })
    .from(children)
  return `ANK-${String(Number(row?.maxId ?? 0) + 1).padStart(5, '0')}`
}

export type ChildOption = { id: number; childCode: string; name: string; gender: Gender }

/** Daftar ringkas seluruh anak, urut kode. Dipakai dropdown filter dan ekspor. */
export async function listChildOptions(): Promise<ChildOption[]> {
  return getDb()
    .select({
      id: children.id,
      childCode: children.childCode,
      name: children.name,
      gender: children.gender,
    })
    .from(children)
    .orderBy(children.childCode, children.id)
}

export async function createChild(input: ChildInput, userId: number): Promise<Child> {
  const db = getDb()

  const duplicate = await db
    .select({ id: children.id })
    .from(children)
    .where(eq(children.childCode, input.childCode))
    .limit(1)
  if (duplicate.length > 0) {
    throw new ValidationError(`Kode anak "${input.childCode}" sudah dipakai.`, {
      childCode: 'Kode anak sudah dipakai',
    })
  }

  const [inserted] = await db.insert(children).values({ ...input, createdBy: userId, updatedBy: userId }).$returningId()
  const id = inserted?.id
  if (id === undefined) throw new AppError('INSERT_FAILED', 'Gagal menyimpan data anak.')

  const [child] = await db.select().from(children).where(eq(children.id, id)).limit(1)
  if (child === undefined) throw new AppError('INSERT_FAILED', 'Gagal membaca ulang data anak.')

  await writeAuditLog({ userId, entity: 'child', entityId: id, action: 'CREATE', newData: child })
  return child
}

export async function updateChild(childId: number, input: ChildInput, userId: number): Promise<Child> {
  const db = getDb()

  const [before] = await db.select().from(children).where(eq(children.id, childId)).limit(1)
  if (before === undefined) throw new AppError('CHILD_NOT_FOUND', 'Data anak tidak ditemukan.')

  const clash = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.childCode, input.childCode), sql`${children.id} <> ${childId}`))
    .limit(1)
  if (clash.length > 0) {
    throw new ValidationError(`Kode anak "${input.childCode}" sudah dipakai anak lain.`, {
      childCode: 'Kode anak sudah dipakai',
    })
  }

  await db.update(children).set({ ...input, updatedBy: userId }).where(eq(children.id, childId))
  const [after] = await db.select().from(children).where(eq(children.id, childId)).limit(1)
  if (after === undefined) throw new AppError('UPDATE_FAILED', 'Gagal memperbarui data anak.')

  await writeAuditLog({
    userId,
    entity: 'child',
    entityId: childId,
    action: 'UPDATE',
    oldData: before,
    newData: after,
  })
  return after
}

export async function deleteChild(childId: number, userId: number): Promise<void> {
  const db = getDb()

  const [before] = await db.select().from(children).where(eq(children.id, childId)).limit(1)
  if (before === undefined) throw new AppError('CHILD_NOT_FOUND', 'Data anak tidak ditemukan.')

  // FK ON DELETE CASCADE ikut menghapus measurements + anthropometric_results.
  await db.transaction(async (tx) => {
    await tx.delete(children).where(eq(children.id, childId))
    await writeAuditLog({ userId, entity: 'child', entityId: childId, action: 'DELETE', oldData: before }, tx)
  })
}
