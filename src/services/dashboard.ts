import { count, gte, sql } from 'drizzle-orm'
import { getDb, sqlAll } from '~/db'
import { anthropometricResults, children, measurements } from '~/db/schema'
import { OVERALL_ATTENTION, OVERALL_NORMAL, OVERALL_RISK } from '~/services/anthropometry'

export type DashboardStats = {
  totalChildren: number
  measurementsThisMonth: number
  normal: number
  risk: number
  attention: number
  /** Anak yang status terakhirnya bukan normal/risiko/perhatian (data tidak lengkap, referensi hilang). */
  other: number
  /** Anak yang belum pernah diukur. */
  neverMeasured: number
}

export type StatusCount = { status: string; count: number }

/**
 * Distribusi status antropometri TERAKHIR per anak.
 * ROW_NUMBER() dengan tie-break `m.id DESC` supaya anak yang diukur dua kali
 * pada tanggal sama tetap dihitung sekali.
 */
export async function getLatestStatusCounts(): Promise<StatusCount[]> {
  return sqlAll<{ status: string; count: string }>(sql`
    WITH ranked AS (
      SELECT
        m.child_id,
        r.overall_status,
        ROW_NUMBER() OVER (
          PARTITION BY m.child_id
          ORDER BY m.measurement_date DESC, m.id DESC
        ) AS rn
      FROM ${measurements} m
      INNER JOIN ${anthropometricResults} r ON r.measurement_id = m.id
    )
    SELECT overall_status AS status, COUNT(*) AS count
    FROM ranked
    WHERE rn = 1
    GROUP BY overall_status
  `).then((rows) => rows.map((r) => ({ status: r.status, count: Number(r.count) })))
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb()

  const now = new Date()
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)

  const [[childRow], [monthRow]] = await Promise.all([
    db.select({ value: count() }).from(children),
    db
      .select({ value: count() })
      .from(measurements)
      .where(gte(measurements.measurementDate, firstOfMonth)),
  ])

  const statusCounts = await getLatestStatusCounts()
  const byStatus = new Map(statusCounts.map((s) => [s.status, s.count]))
  const measuredChildren = statusCounts.reduce((sum, s) => sum + s.count, 0)

  return {
    totalChildren: childRow?.value ?? 0,
    measurementsThisMonth: monthRow?.value ?? 0,
    normal: byStatus.get(OVERALL_NORMAL) ?? 0,
    risk: byStatus.get(OVERALL_RISK) ?? 0,
    attention: byStatus.get(OVERALL_ATTENTION) ?? 0,
    other: Math.max(
      0,
      measuredChildren -
        (byStatus.get(OVERALL_NORMAL) ?? 0) -
        (byStatus.get(OVERALL_RISK) ?? 0) -
        (byStatus.get(OVERALL_ATTENTION) ?? 0),
    ),
    neverMeasured: Math.max(0, (childRow?.value ?? 0) - measuredChildren),
  }
}

export type TrendPoint = { month: string; count: number }

/** Jumlah pengukuran per bulan untuk N bulan terakhir. */
export async function getMeasurementTrend(months = 12): Promise<TrendPoint[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)
  const sinceIso = since.toISOString().slice(0, 10)

  const rows = await sqlAll<{ month: string; count: string }>(sql`
    SELECT DATE_FORMAT(${measurements.measurementDate}, '%Y-%m') AS month, COUNT(*) AS count
    FROM ${measurements}
    WHERE ${measurements.measurementDate} >= ${sinceIso}
    GROUP BY month
    ORDER BY month
  `)
  return rows.map((r) => ({ month: r.month, count: Number(r.count) }))
}
