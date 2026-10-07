export const STATUS_REFERENCE_MISSING = 'Referensi tidak tersedia'
export const STATUS_UNCOMPUTABLE = 'Data tidak dapat dihitung'

/**
 * Nilai Z dibulatkan ke 2 desimal, jadi batas inklusif "z <= 1" diimplementasikan
 * sebagai "z < 1 + HALF_STEP". Ini membuat klasifikasi tetap benar meski z belum dibulatkan.
 */
const HALF_STEP = 0.005

type Band = { from: number; to: number; label: string }

function classify(z: number, bands: readonly Band[]): string {
  for (const band of bands) {
    if (z >= band.from && z < band.to) return band.label
  }
  // Tidak tercapai selama bands menutup -Infinity..Infinity; jaga-jaga agar tidak undefined.
  return bands[bands.length - 1]!.label
}

type StatusOptions = { referenceFound?: boolean }

function nullStatus(options: StatusOptions | undefined): string {
  return options?.referenceFound === false ? STATUS_REFERENCE_MISSING : STATUS_UNCOMPUTABLE
}

const WEIGHT_FOR_AGE_BANDS: readonly Band[] = [
  { from: Number.NEGATIVE_INFINITY, to: -3, label: 'Berat badan sangat kurang' },
  { from: -3, to: -2, label: 'Berat badan kurang' },
  { from: -2, to: 1 + HALF_STEP, label: 'Berat badan normal' },
  { from: 1 + HALF_STEP, to: Number.POSITIVE_INFINITY, label: 'Risiko berat badan lebih' },
]

const LENGTH_HEIGHT_FOR_AGE_BANDS: readonly Band[] = [
  { from: Number.NEGATIVE_INFINITY, to: -3, label: 'Sangat pendek' },
  { from: -3, to: -2, label: 'Pendek' },
  { from: -2, to: 3 + HALF_STEP, label: 'Normal' },
  { from: 3 + HALF_STEP, to: Number.POSITIVE_INFINITY, label: 'Tinggi' },
]

const WEIGHT_FOR_LENGTH_HEIGHT_BANDS: readonly Band[] = [
  { from: Number.NEGATIVE_INFINITY, to: -3, label: 'Gizi buruk' },
  { from: -3, to: -2, label: 'Gizi kurang' },
  { from: -2, to: 1 + HALF_STEP, label: 'Gizi baik' },
  { from: 1 + HALF_STEP, to: 2 + HALF_STEP, label: 'Berisiko gizi lebih' },
  { from: 2 + HALF_STEP, to: 3 + HALF_STEP, label: 'Gizi lebih' },
  { from: 3 + HALF_STEP, to: Number.POSITIVE_INFINITY, label: 'Obesitas' },
]

export function getWeightForAgeStatus(z: number | null, options?: StatusOptions): string {
  if (z === null) return nullStatus(options)
  return classify(z, WEIGHT_FOR_AGE_BANDS)
}

export function getLengthHeightForAgeStatus(z: number | null, options?: StatusOptions): string {
  if (z === null) return nullStatus(options)
  return classify(z, LENGTH_HEIGHT_FOR_AGE_BANDS)
}

export function getWeightForLengthHeightStatus(z: number | null, options?: StatusOptions): string {
  if (z === null) return nullStatus(options)
  return classify(z, WEIGHT_FOR_LENGTH_HEIGHT_BANDS)
}

/** IMT/U memakai kategori yang sama dengan BB/PB atau BB/TB (Permenkes 2/2020). */
export function getBmiForAgeStatus(z: number | null, options?: StatusOptions): string {
  if (z === null) return nullStatus(options)
  return classify(z, WEIGHT_FOR_LENGTH_HEIGHT_BANDS)
}

export const OVERALL_NORMAL = 'Normal'
export const OVERALL_RISK = 'Risiko'
export const OVERALL_ATTENTION = 'Perlu perhatian lebih lanjut'
export const OVERALL_INCOMPLETE = 'Data tidak lengkap'
export const OVERALL_NO_REFERENCE = 'Referensi tidak tersedia'

export const RISK_LABELS = new Set(['Risiko berat badan lebih', 'Berisiko gizi lebih', 'Tinggi'])

export const ATTENTION_LABELS = new Set([
  'Berat badan sangat kurang',
  'Berat badan kurang',
  'Sangat pendek',
  'Pendek',
  'Gizi buruk',
  'Gizi kurang',
  'Gizi lebih',
  'Obesitas',
])

export const NORMAL_LABELS = new Set(['Berat badan normal', 'Normal', 'Gizi baik'])

/**
 * Ringkasan status gabungan keempat indeks.
 *
 * Sengaja memakai kalimat "Perlu perhatian lebih lanjut", bukan nama penyakit:
 * aplikasi ini alat bantu pencatatan, bukan alat diagnosis.
 */
export function getOverallStatus(statuses: readonly (string | null)[]): string {
  const known = statuses.filter((s): s is string => s !== null && s !== STATUS_UNCOMPUTABLE)
  if (known.length === 0) return OVERALL_INCOMPLETE

  if (known.some((s) => ATTENTION_LABELS.has(s))) return OVERALL_ATTENTION
  if (known.some((s) => RISK_LABELS.has(s))) return OVERALL_RISK
  if (known.length < statuses.length) return OVERALL_INCOMPLETE
  if (known.some((s) => s === STATUS_REFERENCE_MISSING)) return OVERALL_NO_REFERENCE
  return OVERALL_NORMAL
}
