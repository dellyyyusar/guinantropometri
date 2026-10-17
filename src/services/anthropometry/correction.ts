import type { MeasurementMethod } from '~/db/schema'

/**
 * Selisih panjang badan terlentang vs tinggi badan berdiri, sesuai Permenkes 2/2020.
 * Anak <= 24 bulan dirujuk ke tabel PB (terlentang); > 24 bulan ke tabel TB (berdiri).
 */
export const LENGTH_HEIGHT_OFFSET_CM = 0.7

export type CorrectedLengthHeight = {
  /** Nilai setelah koreksi, yang dibandingkan ke tabel referensi. */
  correctedLengthHeightCm: number
  /** 'PB' bila dirujuk ke tabel panjang badan (<= 24 bln), 'TB' bila ke tabel tinggi badan. */
  kind: 'PB' | 'TB'
  /** Koreksi yang ditambahkan ke hasil ukur mentah (0, +0.7, atau -0.7). */
  appliedCm: number
}

/**
 * Koreksi PB/TB berdasarkan umur dan cara ukur (Permenkes 2/2020):
 *
 *   umur <= 24 bulan, diukur berdiri    -> PB koreksi = hasil ukur + 0.7
 *   umur <= 24 bulan, diukur berbaring  -> PB koreksi = hasil ukur
 *   umur  > 24 bulan, diukur berbaring  -> TB koreksi = hasil ukur - 0.7
 *   umur  > 24 bulan, diukur berdiri    -> TB koreksi = hasil ukur
 */
export function correctLengthHeight(input: {
  rawLengthHeightCm: number
  measurementMethod: MeasurementMethod
  completedMonths: number
}): CorrectedLengthHeight {
  const { rawLengthHeightCm, measurementMethod, completedMonths } = input
  const infant = completedMonths <= 24

  let appliedCm = 0
  if (infant && measurementMethod === 'STANDING') appliedCm = LENGTH_HEIGHT_OFFSET_CM
  if (!infant && measurementMethod === 'LYING') appliedCm = -LENGTH_HEIGHT_OFFSET_CM

  return {
    correctedLengthHeightCm: round2(rawLengthHeightCm + appliedCm),
    kind: infant ? 'PB' : 'TB',
    appliedCm,
  }
}

/**
 * Pembulatan 2 desimal, half-away-from-zero.
 *
 * Epsilon diperlukan: nilai yang secara matematis tepat di tengah (mis. z = -1.625)
 * bisa tersimpan sebagai -1.6249999999999996 akibat aritmetika floating point,
 * sehingga Math.round polos menghasilkan -1.62 atau -1.63 tergantung debu bit.
 * Dengan epsilon hasilnya deterministik - penting karena status gizi dibaca dari
 * angka yang sudah dibulatkan ini.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return value
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 100 + 1e-9)) / 100
  return rounded === 0 ? 0 : rounded
}
