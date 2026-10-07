import type { ImportRow } from '~/validators/schemas'

/**
 * Normalisasi baris Excel — MURNI, tanpa akses database.
 *
 * Dipisah dari services/import.ts supaya berkas ini boleh ikut ke bundel browser:
 * peramban memakainya untuk membaca .xlsx sebelum mengirimkannya ke server,
 * sementara server memakai fungsi yang sama persis saat memvalidasi dan menyimpan.
 * Satu sumber kebenaran, dan tidak ada mysql2 yang ikut ter-bundle ke klien.
 */

/**
 * Judul kolom template impor. Diterima case-insensitive dan spasi/underscore diabaikan,
 * supaya file yang diedit petugas tidak gagal hanya karena "Tanggal Lahir " berspasi.
 */
export const IMPORT_HEADERS = [
  'Nama',
  'Jenis Kelamin',
  'Tanggal Lahir',
  'Tanggal Ukur',
  'BB',
  'PB/TB',
  'Cara Ukur',
] as const

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  nama: 'nama',
  namaanak: 'nama',
  jeniskelamin: 'jenisKelamin',
  jk: 'jenisKelamin',
  gender: 'jenisKelamin',
  tanggallahir: 'tanggalLahir',
  tgllahir: 'tanggalLahir',
  tglahir: 'tanggalLahir',
  lahir: 'tanggalLahir',
  tanggalukur: 'tanggalUkur',
  tglukur: 'tanggalUkur',
  tanggalpengukuran: 'tanggalUkur',
  bb: 'bb',
  bbkg: 'bb',
  berat: 'bb',
  beratbadan: 'bb',
  pbtb: 'pbTb',
  pb: 'pbTb',
  tb: 'pbTb',
  panjangbadan: 'pbTb',
  tinggibadan: 'pbTb',
  caraukur: 'caraUkur',
  carapengukuran: 'caraUkur',
  metode: 'caraUkur',
  kodeanak: 'kodeAnak',
  kode: 'kodeAnak',
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_\-./\\]/g, '')
}

export function normalizeGender(value: unknown): 'L' | 'P' | null {
  const text = String(value ?? '').trim().toLowerCase()
  if (['l', 'laki-laki', 'laki', 'lk', 'm', 'male', '1'].includes(text)) return 'L'
  if (['p', 'perempuan', 'pr', 'f', 'female', '2'].includes(text)) return 'P'
  return null
}

export function normalizeMethod(value: unknown): 'STANDING' | 'LYING' | null {
  const text = String(value ?? '').trim().toLowerCase()
  if (['standing', 'berdiri', 's', 'tegak'].includes(text)) return 'STANDING'
  if (['lying', 'berbaring', 'terlentang', 'l', 'recumbent'].includes(text)) return 'LYING'
  return null
}

/**
 * Ubah apa pun menjadi 'YYYY-MM-DD'.
 *
 * Date diurai memakai getter LOKAL, bukan toISOString(): berkas Excel dibaca
 * sebagai tengah malam waktu lokal, dan toISOString() di zona UTC+7 akan
 * memundurkannya satu hari.
 */
export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const text = String(value ?? '').trim()
  if (text === '') return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso !== null) return iso[0]

  // Excel menyimpan tanggal sebagai nomor seri; xlsx biasanya sudah mengonversinya,
  // tapi kolom bertipe teks bisa lolos sebagai angka.
  const serial = Number(text)
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const ms = Math.round((serial - 25569) * 86_400_000)
    const date = new Date(ms)
    return date.toISOString().slice(0, 10)
  }

  const indo = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text)
  if (indo !== null) {
    const [, d, m, y] = indo as unknown as [string, string, string, string]
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim().replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/** Kunci pengelompokan anak pada impor: nama + jenis kelamin + tanggal lahir. */
export function childGroupKey(row: Pick<ImportRow, 'nama' | 'jenisKelamin' | 'tanggalLahir'>): string {
  return `${row.nama.trim().toLowerCase()}|${row.jenisKelamin}|${row.tanggalLahir}`
}

/**
 * Kunci yang sama untuk baris tabel `children`.
 * WAJIB memakai rumus yang identik dengan childGroupKey, kalau tidak anak yang
 * sudah ada akan terduplikasi saat impor.
 */
export function childGroupKeyFromRow(row: {
  name: string
  gender: 'L' | 'P'
  dateOfBirth: string
}): string {
  return `${row.name.trim().toLowerCase()}|${row.gender}|${row.dateOfBirth}`
}

export type NormalizedRow = { data: Record<string, unknown> } | { empty: true }

/** Ubah baris mentah hasil `XLSX.utils.sheet_to_json` menjadi bentuk yang bisa divalidasi zod. */
export function normalizeImportRow(raw: Record<string, unknown>): NormalizedRow {
  const mapped: Record<string, unknown> = {}
  let hasContent = false

  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[normalizeKey(key)]
    if (field === undefined) continue
    if (value !== null && value !== undefined && String(value).trim() !== '') hasContent = true
    mapped[field] = value
  }

  if (!hasContent) return { empty: true }

  return {
    data: {
      nama: mapped.nama === undefined ? '' : String(mapped.nama).trim(),
      jenisKelamin:
        normalizeGender(mapped.jenisKelamin) ??
        String(mapped.jenisKelamin ?? '').trim().toUpperCase(),
      tanggalLahir: normalizeDate(mapped.tanggalLahir) ?? '',
      tanggalUkur: normalizeDate(mapped.tanggalUkur) ?? '',
      bb: normalizeNumber(mapped.bb),
      pbTb: normalizeNumber(mapped.pbTb),
      caraUkur:
        normalizeMethod(mapped.caraUkur) ?? String(mapped.caraUkur ?? '').trim().toUpperCase(),
      kodeAnak: mapped.kodeAnak === undefined ? undefined : String(mapped.kodeAnak).trim(),
    },
  }
}
