import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import type { Gender, Indicator, NewAnthropometricReference } from './schema'

export const SOURCE_DOCUMENT =
  'Peraturan Menteri Kesehatan RI Nomor 2 Tahun 2020 tentang Standar Antropometri Anak ' +
  '(lampiran, tabel diadopsi dari WHO Child Growth Standards 2006)'

type IndexKind = 'age' | 'length'

type SourceSpec = {
  indicator: Indicator
  gender: Gender
  file: string
  /** Nama kolom kunci di XLSX: "Month" untuk indeks umur, "Length"/"Height" untuk indeks panjang. */
  keyColumn: string
  indexKind: IndexKind
  sourceTable: string
  /** Jumlah baris yang wajib ada. Seed gagal keras kalau tidak cocok. */
  expectedRows: number
}

export const REFERENCE_SOURCES: readonly SourceSpec[] = [
  { indicator: 'BB_U', gender: 'L', file: 'wfa_boys_0-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 1 - BB/U Laki-laki 0-60 bulan', expectedRows: 61 },
  { indicator: 'PB_U', gender: 'L', file: 'lhfa_boys_0-to-2-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 2 - PB/U Laki-laki 0-24 bulan', expectedRows: 25 },
  { indicator: 'TB_U', gender: 'L', file: 'lhfa_boys_2-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 3 - TB/U Laki-laki 24-60 bulan', expectedRows: 37 },
  { indicator: 'BB_PB', gender: 'L', file: 'wfl_boys_0-to-2-years_zscores.xlsx', keyColumn: 'Length', indexKind: 'length', sourceTable: 'Tabel 4 - BB/PB Laki-laki 45-110 cm', expectedRows: 131 },
  { indicator: 'BB_TB', gender: 'L', file: 'wfh_boys_2-to-5-years_zscores.xlsx', keyColumn: 'Height', indexKind: 'length', sourceTable: 'Tabel 5 - BB/TB Laki-laki 65-120 cm', expectedRows: 111 },
  { indicator: 'IMT_U_PB', gender: 'L', file: 'bmi_boys_0-to-2-years_zcores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 6 - IMT/U Laki-laki 0-24 bulan', expectedRows: 25 },
  { indicator: 'IMT_U_TB', gender: 'L', file: 'bmi_boys_2-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 7 - IMT/U Laki-laki 24-60 bulan', expectedRows: 37 },

  { indicator: 'BB_U', gender: 'P', file: 'wfa_girls_0-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 8 - BB/U Perempuan 0-60 bulan', expectedRows: 61 },
  { indicator: 'PB_U', gender: 'P', file: 'lhfa_girls_0-to-2-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 9 - PB/U Perempuan 0-24 bulan', expectedRows: 25 },
  { indicator: 'TB_U', gender: 'P', file: 'lhfa_girls_2-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 10 - TB/U Perempuan 24-60 bulan', expectedRows: 37 },
  { indicator: 'BB_PB', gender: 'P', file: 'wfl_girls_0-to-2-years_zscores.xlsx', keyColumn: 'Length', indexKind: 'length', sourceTable: 'Tabel 11 - BB/PB Perempuan 45-110 cm', expectedRows: 131 },
  { indicator: 'BB_TB', gender: 'P', file: 'wfh_girls_2-to-5-years_zscores.xlsx', keyColumn: 'Height', indexKind: 'length', sourceTable: 'Tabel 12 - BB/TB Perempuan 65-120 cm', expectedRows: 111 },
  { indicator: 'IMT_U_PB', gender: 'P', file: 'bmi_girls_0-to-2-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 13 - IMT/U Perempuan 0-24 bulan', expectedRows: 25 },
  { indicator: 'IMT_U_TB', gender: 'P', file: 'bmi_girls_2-to-5-years_zscores.xlsx', keyColumn: 'Month', indexKind: 'age', sourceTable: 'Tabel 14 - IMT/U Perempuan 24-60 bulan', expectedRows: 37 },
]

/** Penanda "tidak berlaku" untuk kolom kunci yang tidak dipakai. Lihat komentar di schema.ts. */
export const NOT_APPLICABLE = -1

const SD_COLUMNS = {
  minus3Sd: 'SD3neg',
  minus2Sd: 'SD2neg',
  minus1Sd: 'SD1neg',
  median: 'SD0',
  plus1Sd: 'SD1',
  plus2Sd: 'SD2',
  plus3Sd: 'SD3',
} as const

function num(row: Record<string, unknown>, column: string, where: string): number {
  const raw = row[column]
  const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : Number(raw)
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    throw new Error(`Kolom "${column}" tidak valid pada ${where} (nilai: ${JSON.stringify(raw)})`)
  }
  return value
}

function readSheet(dir: string, spec: SourceSpec): Record<string, unknown>[] {
  const path = resolve(dir, spec.file)
  let buffer: Buffer
  try {
    buffer = readFileSync(path)
  } catch {
    throw new Error(`File referensi tidak ditemukan: ${path}`)
  }
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName === undefined ? undefined : workbook.Sheets[sheetName]
  if (sheet === undefined) {
    throw new Error(`Sheet kosong pada ${path}`)
  }
  // Header WHO tidak konsisten: ada yang berspasi ("M       "). Selalu di-trim.
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null }).map((row) => {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) cleaned[key.trim()] = value
    return cleaned
  })
}

/** Baris siap-seed: kunci indeks dan parameter LMS wajib terisi eksplisit. */
export type ReferenceSeedRow = Omit<
  NewAnthropometricReference,
  'ageMonth' | 'measurementCm' | 'l' | 'm' | 's'
> & {
  ageMonth: number
  measurementCm: number
  l: number | null
  m: number | null
  s: number | null
}

function readSource(dir: string, spec: SourceSpec): ReferenceSeedRow[] {
  const rows = readSheet(dir, spec)
  if (rows.length !== spec.expectedRows) {
    throw new Error(
      `${spec.file}: jumlah baris ${rows.length}, seharusnya ${spec.expectedRows}. ` +
        'File referensi rusak atau bukan versi WHO/Permenkes yang diharapkan.',
    )
  }

  return rows.map((row, i) => {
    const where = `${spec.file} baris ${i + 1}`
    const key = num(row, spec.keyColumn, where)
    const indexedByAge = spec.indexKind === 'age'

    const cutpoints = Object.fromEntries(
      Object.entries(SD_COLUMNS).map(([field, column]) => [field, num(row, column, where)]),
    ) as Record<keyof typeof SD_COLUMNS, number>

    if (
      !(
        cutpoints.minus3Sd < cutpoints.minus2Sd &&
        cutpoints.minus2Sd < cutpoints.minus1Sd &&
        cutpoints.minus1Sd < cutpoints.median &&
        cutpoints.median < cutpoints.plus1Sd &&
        cutpoints.plus1Sd < cutpoints.plus2Sd &&
        cutpoints.plus2Sd < cutpoints.plus3Sd
      )
    ) {
      throw new Error(`${where}: cutpoint SD tidak monoton naik - ${JSON.stringify(cutpoints)}`)
    }

    return {
      indicator: spec.indicator,
      gender: spec.gender,
      ageMonth: indexedByAge ? key : NOT_APPLICABLE,
      measurementCm: indexedByAge ? NOT_APPLICABLE : key,
      ...cutpoints,
      l: num(row, 'L', where),
      m: num(row, 'M', where),
      s: num(row, 'S', where),
      sourceTable: spec.sourceTable,
      sourceDocument: SOURCE_DOCUMENT,
    }
  })
}

/**
 * Baca seluruh 14 tabel referensi dari XLSX WHO resmi.
 * Melempar error kalau ada file hilang, jumlah baris salah, atau cutpoint tidak monoton.
 */
export function loadReferenceRows(dir: string): ReferenceSeedRow[] {
  return REFERENCE_SOURCES.flatMap((spec) => readSource(dir, spec))
}

export function assertReferenceRowsComplete(rows: ReferenceSeedRow[]): void {
  const expectedTotal = REFERENCE_SOURCES.reduce((sum, s) => sum + s.expectedRows, 0)
  if (rows.length !== expectedTotal) {
    throw new Error(`Total baris referensi ${rows.length}, seharusnya ${expectedTotal}`)
  }
  const unique = new Set(
    rows.map((r) => `${r.indicator}|${r.gender}|${r.ageMonth}|${r.measurementCm}`),
  )
  if (unique.size !== rows.length) {
    throw new Error('Ada kunci referensi duplikat (indicator+gender+age_month+measurement_cm)')
  }
}
