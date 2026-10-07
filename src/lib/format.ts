const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/**
 * Tanggal disimpan sebagai string 'YYYY-MM-DD' (tanpa zona waktu), jadi
 * diformat manual — `new Date('2026-01-14')` akan di-parse sebagai UTC dan
 * bisa tampil sebagai 13 Januari di zona barat.
 */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match === null) return value
  const [, y, m, d] = match as unknown as [string, string, string, string]
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`
}

export function formatDateShort(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match === null) return value
  const [, y, m, d] = match as unknown as [string, string, string, string]
  return `${d}/${m}/${y}`
}

export function formatDayName(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match === null) return ''
  const [, y, m, d] = match as unknown as [string, string, string, string]
  return DAYS_ID[new Date(Number(y), Number(m) - 1, Number(d)).getDay()] ?? ''
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Bulan penuh menjadi "3 tahun 2 bulan" / "9 bulan" / "12 hari". */
export function formatMonths(totalMonths: number | null | undefined): string {
  if (totalMonths === null || totalMonths === undefined) return '—'
  const months = Math.floor(totalMonths)
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${months} bulan`
  if (rest === 0) return `${years} tahun`
  return `${years} tahun ${rest} bulan`
}

export function formatGender(gender: 'L' | 'P' | null | undefined): string {
  if (gender === 'L') return 'Laki-laki'
  if (gender === 'P') return 'Perempuan'
  return '—'
}

export function formatMethod(method: 'STANDING' | 'LYING' | null | undefined): string {
  if (method === 'STANDING') return 'Berdiri'
  if (method === 'LYING') return 'Berbaring'
  return '—'
}

export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
