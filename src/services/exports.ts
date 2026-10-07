import { and, eq, gte, lte } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { getDb } from '~/db'
import { anthropometricResults, children, measurements } from '~/db/schema'
import { AppError } from '~/lib/errors'
import type { ExportFilters } from '~/validators/schemas'

export const EXPORT_COLUMNS = [
  { key: 'kodeAnak', header: 'Kode Anak' },
  { key: 'namaAnak', header: 'Nama Anak' },
  { key: 'jenisKelamin', header: 'JK' },
  { key: 'tanggalLahir', header: 'Tanggal Lahir' },
  { key: 'tanggalUkur', header: 'Tanggal Ukur' },
  { key: 'umur', header: 'Umur' },
  { key: 'bb', header: 'BB (kg)' },
  { key: 'pbTbMentah', header: 'PB/TB Ukur (cm)' },
  { key: 'caraUkur', header: 'Cara Ukur' },
  { key: 'pbTbKoreksi', header: 'PB/TB Koreksi (cm)' },
  { key: 'imt', header: 'IMT' },
  { key: 'zBbU', header: 'Z BB/U' },
  { key: 'statusBbU', header: 'Status BB/U' },
  { key: 'zPbTbU', header: 'Z PB/U atau TB/U' },
  { key: 'statusPbTbU', header: 'Status PB/U atau TB/U' },
  { key: 'zBbPbTb', header: 'Z BB/PB atau BB/TB' },
  { key: 'statusBbPbTb', header: 'Status BB/PB atau BB/TB' },
  { key: 'zImtU', header: 'Z IMT/U' },
  { key: 'statusImtU', header: 'Status IMT/U' },
  { key: 'statusKeseluruhan', header: 'Status Keseluruhan' },
  { key: 'versiPerhitungan', header: 'Versi Perhitungan' },
] as const

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number]['key'], string | number | null>

function formatUmur(year: number, month: number, day: number): string {
  if (year === 0 && month === 0) return `${day} hari`
  if (year === 0) return `${month} bln ${day} hr`
  return `${year} th ${month} bln`
}

export async function buildExportRows(filters: ExportFilters): Promise<ExportRow[]> {
  const db = getDb()

  const conditions = []
  if (filters.scope === 'child') {
    if (filters.childId === undefined) {
      throw new AppError('CHILD_ID_REQUIRED', 'Pilih anak terlebih dahulu untuk ekspor per anak.')
    }
    conditions.push(eq(children.id, filters.childId))
  }
  if (filters.from !== undefined) conditions.push(gte(measurements.measurementDate, filters.from))
  if (filters.to !== undefined) conditions.push(lte(measurements.measurementDate, filters.to))
  if (filters.status !== undefined && filters.status !== '') {
    conditions.push(eq(anthropometricResults.overallStatus, filters.status))
  }

  const rows = await db
    .select({ child: children, measurement: measurements, result: anthropometricResults })
    .from(measurements)
    .innerJoin(children, eq(children.id, measurements.childId))
    .leftJoin(anthropometricResults, eq(anthropometricResults.measurementId, measurements.id))
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(children.childCode, measurements.measurementDate, measurements.id)

  return rows.map(({ child, measurement, result }) => ({
    kodeAnak: child.childCode,
    namaAnak: child.name,
    jenisKelamin: child.gender,
    tanggalLahir: child.dateOfBirth,
    tanggalUkur: measurement.measurementDate,
    umur: formatUmur(measurement.ageYear, measurement.ageMonth, measurement.ageDay),
    bb: measurement.weightKg,
    pbTbMentah: measurement.rawLengthHeightCm,
    caraUkur: measurement.measurementMethod === 'LYING' ? 'Berbaring' : 'Berdiri',
    pbTbKoreksi: measurement.correctedLengthHeightCm,
    imt: measurement.bmi,
    zBbU: result?.weightForAgeZ ?? null,
    statusBbU: result?.weightForAgeStatus ?? null,
    zPbTbU: result?.lengthHeightForAgeZ ?? null,
    statusPbTbU: result?.lengthHeightForAgeStatus ?? null,
    zBbPbTb: result?.weightForLengthHeightZ ?? null,
    statusBbPbTb: result?.weightForLengthHeightStatus ?? null,
    zImtU: result?.bmiForAgeZ ?? null,
    statusImtU: result?.bmiForAgeStatus ?? null,
    statusKeseluruhan: result?.overallStatus ?? null,
    versiPerhitungan: result?.calculationVersion ?? null,
  }))
}

function cellText(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * CSV dengan BOM UTF-8. Tanpa BOM, Excel di Windows membaca teks Indonesia
 * (é, dan terutama pemisah titik-koma) sebagai ANSI dan isinya jadi rusak.
 */
export function toCsv(rows: readonly ExportRow[]): string {
  const escape = (value: string): string =>
    /[",;\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

  const lines = [EXPORT_COLUMNS.map((c) => escape(c.header)).join(';')]
  for (const row of rows) {
    lines.push(EXPORT_COLUMNS.map((c) => escape(cellText(row[c.key]))).join(';'))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function toXlsx(rows: readonly ExportRow[]): Uint8Array {
  const data = rows.map((row) => {
    const record: Record<string, string | number> = {}
    for (const column of EXPORT_COLUMNS) {
      const value = row[column.key]
      record[column.header] = value === null ? '' : value
    }
    return record
  })

  const sheet = XLSX.utils.json_to_sheet(data, { header: EXPORT_COLUMNS.map((c) => c.header) })
  sheet['!cols'] = EXPORT_COLUMNS.map((c) => ({ wch: Math.max(10, c.header.length + 2) }))

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Antropometri')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

export function exportFilename(format: string, scope: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `antropometri-${scope}-${stamp}.${format}`
}
