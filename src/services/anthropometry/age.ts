export const MAX_AGE_MONTHS = 60

const MS_PER_DAY = 86_400_000

/** Rata-rata hari per bulan, dipakai untuk mengubah sisa hari menjadi pecahan bulan. */
const AVG_DAYS_PER_MONTH = 30.4375

export type Age = {
  years: number
  months: number
  days: number
  /** Bulan penuh (0..N). Dipakai untuk lookup tabel referensi Permenkes. */
  completedMonths: number
  /** Bulan penuh + pecahan bulan dari sisa hari. Dipakai untuk validasi batas 0-60 bulan. */
  totalMonths: number
  totalDays: number
  /** true bila umur melewati batas tabel referensi (> 60 bulan). */
  outOfRange: boolean
}

type YMD = { y: number; m: number; d: number }

export function parseDateString(value: string): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) throw new Error(`Format tanggal tidak valid (harus YYYY-MM-DD): "${value}"`)
  const [, y, m, d] = match as unknown as [string, string, string, string]
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (month < 1 || month > 12) throw new Error(`Bulan tidak valid: "${value}"`)
  if (day < 1 || day > daysInMonth(year, month)) throw new Error(`Tanggal tidak valid: "${value}"`)
  return { y: year, m: month, d: day }
}

/** Jumlah hari pada bulan `month` (1-12) tahun `year`. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function toDate({ y, m, d }: YMD): Date {
  return new Date(y, m - 1, d)
}

/** 'YYYY-MM-DD' -> Date lokal tengah malam (tanpa pergeseran zona waktu). */
export function dateFromIso(value: string): Date {
  return toDate(parseDateString(value))
}

/** Tanggal lahir + n bulan, dengan clamp bila hari lahir melebihi jumlah hari bulan tujuan. */
function addMonthsClamped(birth: YMD, n: number): Date {
  const candidate = new Date(birth.y, birth.m - 1 + n, birth.d)
  if (candidate.getDate() !== birth.d) candidate.setDate(0)
  return candidate
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Hitung umur dari tanggal lahir ke tanggal pengukuran.
 *
 * Sengaja TIDAK memakai TODAY(): umur harus mengikuti tanggal pengukuran supaya
 * riwayat pengukuran lama tetap menghasilkan z-score yang sama saat dibuka lagi.
 *
 * Melempar error bila tanggal pengukuran sebelum tanggal lahir.
 */
export function calculateAge(dateOfBirth: string, measurementDate: string): Age {
  const birth = parseDateString(dateOfBirth)
  const measure = parseDateString(measurementDate)
  const birthTime = toDate(birth)
  const measureTime = toDate(measure)

  if (measureTime < birthTime) {
    throw new RangeError(
      `Tanggal pengukuran (${measurementDate}) lebih awal dari tanggal lahir (${dateOfBirth}).`,
    )
  }

  // Cari jumlah bulan penuh terbesar sehingga (lahir + n bulan) <= tanggal ukur.
  // Batas 240 bulan cukup untuk tampilan umur anak yang sudah lewat rentang standar.
  const MAX_LOOP_MONTHS = 240
  let completedMonths = 0
  while (completedMonths < MAX_LOOP_MONTHS && addMonthsClamped(birth, completedMonths + 1) <= measureTime) {
    completedMonths += 1
  }

  const anchor = addMonthsClamped(birth, completedMonths)
  const days = Math.round((measureTime.getTime() - anchor.getTime()) / MS_PER_DAY)
  const totalDays = Math.round((measureTime.getTime() - birthTime.getTime()) / MS_PER_DAY)
  const totalMonths = completedMonths + days / AVG_DAYS_PER_MONTH

  return {
    years: Math.floor(completedMonths / 12),
    months: completedMonths % 12,
    days,
    completedMonths,
    totalMonths,
    totalDays,
    outOfRange: totalMonths > MAX_AGE_MONTHS,
  }
}

/** true bila umur memakai tabel 0-24 bulan (PB / BB-PB / IMT-U 0-24). */
export function usesInfantTable(age: Age): boolean {
  return age.completedMonths <= 24
}

export function formatAge(age: Age): string {
  if (age.years === 0 && age.months === 0) return `${age.days} hari`
  if (age.years === 0) return `${age.months} bulan ${age.days} hari`
  return `${age.years} tahun ${age.months} bulan`
}
