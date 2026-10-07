import { round2 } from './correction'

export type ZScoreMethod = 'piecewise_interpolation' | 'lms'

export type ZScoreResult = {
  /**
   * Nilai Z dibulatkan 2 desimal, atau null bila tidak dapat dihitung.
   * TIDAK pernah di-fallback ke 0, +3, atau -3 saat referensi hilang — lihat referenceFound.
   */
  zScore: number | null
  method: ZScoreMethod
  referenceFound: boolean
}

export type SdCutpoints = {
  minus3Sd: number
  minus2Sd: number
  minus1Sd: number
  median: number
  plus1Sd: number
  plus2Sd: number
  plus3Sd: number
}

export type LmsParameters = { l: number; m: number; s: number }

export const DEFAULT_ZSCORE_METHOD: ZScoreMethod = 'piecewise_interpolation'

/** Nilai Z di luar rentang tabel tetap diekstrapolasi, tidak dipatok ke +3/-3. */
function finalize(z: number, method: ZScoreMethod): ZScoreResult {
  if (!Number.isFinite(z)) {
    return { zScore: null, method, referenceFound: true }
  }
  return { zScore: round2(z), method, referenceFound: true }
}

/**
 * Z-score dengan interpolasi sepotong-sepotong atas 7 cutpoint SD Permenkes.
 *
 * Di dalam rentang: interpolasi linear pada segmen yang memuat nilai.
 * Di luar -3SD / +3SD: ekstrapolasi linear memakai kemiringan segmen terluar,
 * sehingga status tetap bisa membedakan "Z > +3" dari "Z = +3".
 */
export function interpolateZScore(value: number, cut: SdCutpoints): number | null {
  const stops: readonly (readonly [z: number, x: number])[] = [
    [-3, cut.minus3Sd],
    [-2, cut.minus2Sd],
    [-1, cut.minus1Sd],
    [0, cut.median],
    [1, cut.plus1Sd],
    [2, cut.plus2Sd],
    [3, cut.plus3Sd],
  ]

  if (value < cut.minus3Sd) {
    const [z0, x0] = stops[0]!
    const [z1, x1] = stops[1]!
    const slope = (z1 - z0) / (x1 - x0)
    return Number.isFinite(slope) ? z0 + (value - x0) * slope : null
  }
  if (value > cut.plus3Sd) {
    const [z0, x0] = stops[5]!
    const [z1, x1] = stops[6]!
    const slope = (z1 - z0) / (x1 - x0)
    return Number.isFinite(slope) ? z0 + (value - x0) * slope : null
  }

  for (let i = 0; i < stops.length - 1; i += 1) {
    const [zLow, xLow] = stops[i]!
    const [zHigh, xHigh] = stops[i + 1]!
    if (value >= xLow && value <= xHigh) {
      if (xHigh === xLow) return zLow
      return zLow + ((value - xLow) / (xHigh - xLow)) * (zHigh - zLow)
    }
  }
  return null
}

/** Z-score metode LMS WHO. L=0 memakai bentuk logaritmik. */
export function lmsZScore(value: number, lms: LmsParameters): number | null {
  const { l, m, s } = lms
  if (value <= 0 || m <= 0 || s <= 0) return null
  const z =
    Math.abs(l) < 1e-9 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s)
  return Number.isFinite(z) ? z : null
}

export function calculateZScore(input: {
  value: number
  minus3: number
  minus2: number
  minus1: number
  median: number
  plus1: number
  plus2: number
  plus3: number
  lms?: LmsParameters | null
  method?: ZScoreMethod
}): ZScoreResult {
  const method = input.method ?? DEFAULT_ZSCORE_METHOD

  if (!Number.isFinite(input.value)) {
    return { zScore: null, method, referenceFound: true }
  }

  if (method === 'lms') {
    const z = input.lms ? lmsZScore(input.value, input.lms) : null
    return z === null
      ? { zScore: null, method, referenceFound: true }
      : finalize(z, method)
  }

  const z = interpolateZScore(input.value, {
    minus3Sd: input.minus3,
    minus2Sd: input.minus2,
    minus1Sd: input.minus1,
    median: input.median,
    plus1Sd: input.plus1,
    plus2Sd: input.plus2,
    plus3Sd: input.plus3,
  })
  return z === null ? { zScore: null, method, referenceFound: true } : finalize(z, method)
}

/** Referensi tidak ditemukan: zScore null, TANPA fallback angka apa pun. */
export function missingReference(method: ZScoreMethod = DEFAULT_ZSCORE_METHOD): ZScoreResult {
  return { zScore: null, method, referenceFound: false }
}
