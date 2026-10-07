import type { Gender, Indicator } from '~/db/schema'
import type { SdCutpoints } from './zscore'

export type ReferenceRow = SdCutpoints & {
  indicator: Indicator
  gender: Gender
  ageMonth: number
  measurementCm: number
  l: number | null
  m: number | null
  s: number | null
  sourceTable: string
  sourceDocument: string
}

export type ReferenceIndex = Map<string, readonly ReferenceRow[]>

export const NOT_APPLICABLE = -1

function keyOf(indicator: Indicator, gender: Gender): string {
  return `${indicator}|${gender}`
}

/** Kelompokkan baris referensi per (indicator, gender), terurut naik menurut kunci indeksnya. */
export function buildReferenceIndex(rows: readonly ReferenceRow[]): ReferenceIndex {
  const index: ReferenceIndex = new Map()
  for (const row of rows) {
    const key = keyOf(row.indicator, row.gender)
    const bucket = index.get(key)
    if (bucket === undefined) {
      index.set(key, [row])
    } else {
      ;(bucket as ReferenceRow[]).push(row)
    }
  }
  for (const [key, bucket] of index) {
    index.set(
      key,
      [...bucket].sort((a, b) => (a.ageMonth !== NOT_APPLICABLE ? a.ageMonth : a.measurementCm) - (b.ageMonth !== NOT_APPLICABLE ? b.ageMonth : b.measurementCm)),
    )
  }
  return index
}

function series(index: ReferenceIndex, indicator: Indicator, gender: Gender): readonly ReferenceRow[] {
  return index.get(keyOf(indicator, gender)) ?? []
}

/**
 * Lookup tabel ber-indeks umur (BB/U, PB/U, TB/U, IMT/U).
 * Pencarian persis pada bulan penuh; tabel Permenkes memang per bulan, tanpa interpolasi,
 * supaya hasilnya bisa dicek ulang langsung ke baris tabel tercetak.
 */
export function lookupByAgeMonth(
  index: ReferenceIndex,
  indicator: Indicator,
  gender: Gender,
  month: number,
): ReferenceRow | null {
  return series(index, indicator, gender).find((r) => r.ageMonth === month) ?? null
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Lookup tabel ber-indeks panjang/tinggi (BB/PB, BB/TB).
 *
 * Tabel melangkah 0.5 cm sementara alat ukur membaca 0.1 cm, jadi nilai di antara
 * dua baris diinterpolasi linear pada ketujuh cutpoint. Di luar rentang tabel
 * hasilnya null (bukan dipatok ke baris terdekat) agar status tidak mengarang.
 */
export function lookupByLengthHeight(
  index: ReferenceIndex,
  indicator: Indicator,
  gender: Gender,
  cm: number,
): ReferenceRow | null {
  if (!Number.isFinite(cm)) return null
  const rows = series(index, indicator, gender)
  if (rows.length === 0) return null

  const first = rows[0]!
  const last = rows[rows.length - 1]!
  if (cm < first.measurementCm || cm > last.measurementCm) return null

  let lower = first
  let upper = last
  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = rows[i]!
    const b = rows[i + 1]!
    if (cm >= a.measurementCm && cm <= b.measurementCm) {
      lower = a
      upper = b
      break
    }
  }

  const span = upper.measurementCm - lower.measurementCm
  const t = span === 0 ? 0 : (cm - lower.measurementCm) / span

  const lms =
    lower.l !== null && lower.m !== null && lower.s !== null &&
    upper.l !== null && upper.m !== null && upper.s !== null
      ? { l: mix(lower.l, upper.l, t), m: mix(lower.m, upper.m, t), s: mix(lower.s, upper.s, t) }
      : { l: null, m: null, s: null }

  return {
    indicator,
    gender,
    ageMonth: NOT_APPLICABLE,
    measurementCm: cm,
    minus3Sd: mix(lower.minus3Sd, upper.minus3Sd, t),
    minus2Sd: mix(lower.minus2Sd, upper.minus2Sd, t),
    minus1Sd: mix(lower.minus1Sd, upper.minus1Sd, t),
    median: mix(lower.median, upper.median, t),
    plus1Sd: mix(lower.plus1Sd, upper.plus1Sd, t),
    plus2Sd: mix(lower.plus2Sd, upper.plus2Sd, t),
    plus3Sd: mix(lower.plus3Sd, upper.plus3Sd, t),
    l: lms.l,
    m: lms.m,
    s: lms.s,
    sourceTable: lower.sourceTable,
    sourceDocument: lower.sourceDocument,
  }
}

/** Seluruh baris satu tabel, untuk menggambar pita -3SD..+3SD pada grafik pertumbuhan. */
export function getReferenceSeries(
  index: ReferenceIndex,
  indicator: Indicator,
  gender: Gender,
): readonly ReferenceRow[] {
  return series(index, indicator, gender)
}
