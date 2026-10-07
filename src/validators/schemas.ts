import { z } from 'zod'
import { GENDERS, MEASUREMENT_METHODS } from '~/db/schema'
import { parseDateString } from '~/services/anthropometry/age'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Tanggal kalender 'YYYY-MM-DD' yang benar-benar ada (menolak 2026-02-30). */
function isoDate(message: string) {
  return z
    .string()
    .regex(ISO_DATE, message)
    .refine(
      (value) => {
        try {
          parseDateString(value)
          return true
        } catch {
          return false
        }
      },
      { message: 'Tanggal tidak valid' },
    )
}

/**
 * Input kosong dari <input> tiba sebagai ''. Ubah jadi null SEBELUM koersi angka,
 * karena Number('') === 0 dan berat 0 kg akan lolos sebagai angka valid.
 */
function optionalNumber(min: number, max: number, label: string) {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.null().or(
      z
        .coerce.number({ error: `${label} harus angka` })
        .min(min, `${label} minimal ${min}`)
        .max(max, `${label} maksimal ${max}`),
    ),
  )
}

function requiredNumber(min: number, max: number, label: string) {
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? Number.NaN : value),
    z
      .coerce.number({ error: `${label} harus angka` })
      .min(min, `${label} minimal ${min}`)
      .max(max, `${label} maksimal ${max}`),
  )
}

function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(maxLength).nullish(),
  )
}

export const loginSchema = z.object({
  email: z.email('Format email tidak valid').max(190),
  password: z.string().min(1, 'Password wajib diisi').max(200),
})
export type LoginInput = z.infer<typeof loginSchema>

export const childSchema = z.object({
  childCode: z.string().trim().min(1, 'Kode anak wajib diisi').max(32, 'Kode anak maksimal 32 karakter'),
  name: z.string().trim().min(1, 'Nama anak wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  gender: z.enum(GENDERS, { error: 'Jenis kelamin wajib dipilih' }),
  dateOfBirth: isoDate('Tanggal lahir harus berformat YYYY-MM-DD'),
  birthWeight: optionalNumber(0.3, 9.999, 'Berat lahir'),
  birthLength: optionalNumber(20, 70, 'Panjang lahir'),
  motherName: optionalText(100),
  fatherName: optionalText(100),
  address: optionalText(255),
  notes: optionalText(2000),
})
export type ChildInput = z.infer<typeof childSchema>

export const measurementSchema = z.object({
  measurementDate: isoDate('Tanggal pengukuran harus berformat YYYY-MM-DD'),
  weightKg: requiredNumber(0.001, 99.999, 'Berat badan'),
  rawLengthHeightCm: optionalNumber(0.1, 250, 'Panjang/tinggi badan'),
  measurementMethod: z.enum(MEASUREMENT_METHODS, { error: 'Cara pengukuran wajib dipilih' }),
  notes: optionalText(2000),
})
export type MeasurementInputSchema = z.infer<typeof measurementSchema>

export const childFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  gender: z.enum(['ALL', 'L', 'P']).catch('ALL'),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
})
export type ChildFilters = z.infer<typeof childFiltersSchema>

export const exportFiltersSchema = z.object({
  format: z.enum(['xlsx', 'csv', 'pdf']).catch('xlsx'),
  scope: z.enum(['all', 'child']).catch('all'),
  childId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  status: z.string().trim().max(64).optional(),
})
export type ExportFilters = z.infer<typeof exportFiltersSchema>

export const importRowSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(100),
  jenisKelamin: z.enum(['L', 'P'], { error: 'Jenis kelamin harus L atau P' }),
  tanggalLahir: isoDate('Tanggal lahir harus berformat YYYY-MM-DD'),
  tanggalUkur: isoDate('Tanggal ukur harus berformat YYYY-MM-DD'),
  bb: requiredNumber(0.001, 99.999, 'BB'),
  pbTb: optionalNumber(0.1, 250, 'PB/TB'),
  caraUkur: z.enum(['STANDING', 'LYING'], { error: 'Cara ukur harus STANDING atau LYING' }),
  kodeAnak: z.string().trim().max(32).optional(),
})
export type ImportRow = z.infer<typeof importRowSchema>
