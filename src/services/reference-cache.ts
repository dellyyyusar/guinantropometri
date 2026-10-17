import { getDb } from '~/db'
import { anthropometricReference, type Gender, type Indicator } from '~/db/schema'
import { AppError } from '~/lib/errors'
import {
  buildReferenceIndex,
  getReferenceSeries,
  type ReferenceIndex,
} from '~/services/anthropometry'

/**
 * Seluruh tabel referensi (854 baris) dimuat sekali per proses lalu dipakai ulang.
 * Ukurannya kecil dan isinya tidak pernah berubah di luar `pnpm db:seed`.
 *
 * ponytail: cache seumur proses. Bila seed dijalankan ulang tanpa restart,
 * panggil invalidateReferenceCache() - atau restart server, mana yang lebih mudah.
 */
let cache: ReferenceIndex | undefined

export function invalidateReferenceCache(): void {
  cache = undefined
}

export async function getReferenceIndex(): Promise<ReferenceIndex> {
  if (cache !== undefined) return cache

  const rows = await getDb().select().from(anthropometricReference)
  if (rows.length === 0) {
    throw new AppError(
      'REFERENCE_EMPTY',
      'Tabel referensi antropometri kosong. Jalankan `pnpm db:seed` terlebih dahulu.',
    )
  }

  cache = buildReferenceIndex(rows)
  return cache
}

export type ChartPoint = {
  /** Umur dalam bulan, atau panjang/tinggi dalam cm untuk BB/PB dan BB/TB. */
  x: number
  minus3: number
  minus2: number
  minus1: number
  median: number
  plus1: number
  plus2: number
  plus3: number
}

/** Pita -3SD..+3SD untuk grafik pertumbuhan, mengikuti jenis kelamin anak. */
export async function getChartSeries(indicator: Indicator, gender: Gender): Promise<ChartPoint[]> {
  const index = await getReferenceIndex()
  return toPoints(getReferenceSeries(index, indicator, gender))
}

function toPoints(rows: ReturnType<typeof getReferenceSeries>): ChartPoint[] {
  return rows.map((row) => ({
    x: row.ageMonth >= 0 ? row.ageMonth : row.measurementCm,
    minus3: row.minus3Sd,
    minus2: row.minus2Sd,
    minus1: row.minus1Sd,
    median: row.median,
    plus1: row.plus1Sd,
    plus2: row.plus2Sd,
    plus3: row.plus3Sd,
  }))
}

/** Kunci seri grafik yang ditampilkan aplikasi (bukan kode tabel mentah). */
export const CHART_SERIES_KEYS = ['WFA', 'LHFA', 'WFL', 'BMIA'] as const
export type ChartSeriesKey = (typeof CHART_SERIES_KEYS)[number]

/**
 * Susun satu kurva utuh 0-60 bulan dari dua tabel Permenkes.
 *
 * PB/U hanya sampai 24 bulan dan TB/U mulai 24 bulan. Pada bulan ke-24 keduanya
 * ada tapi beda 0.7 cm (berbaring vs berdiri), jadi bulan 24 diambil dari tabel
 * TB/U dan bulan 0-23 dari tabel PB/U supaya tidak ada titik ganda.
 * Aturan yang sama dipakai untuk IMT/U.
 */
export async function getChartSeriesCombined(
  key: ChartSeriesKey,
  gender: Gender,
): Promise<ChartPoint[]> {
  const index = await getReferenceIndex()

  switch (key) {
    case 'WFA':
      return toPoints(getReferenceSeries(index, 'BB_U', gender))
    case 'WFL':
      return toPoints(getReferenceSeries(index, 'BB_TB', gender))
    case 'LHFA': {
      const infant = getReferenceSeries(index, 'PB_U', gender).filter((r) => r.ageMonth <= 23)
      const child = getReferenceSeries(index, 'TB_U', gender)
      return toPoints([...infant, ...child])
    }
    case 'BMIA': {
      const infant = getReferenceSeries(index, 'IMT_U_PB', gender).filter((r) => r.ageMonth <= 23)
      const child = getReferenceSeries(index, 'IMT_U_TB', gender)
      return toPoints([...infant, ...child])
    }
  }
}
