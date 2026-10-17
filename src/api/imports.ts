import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from '~/auth/session'
import { guard, parseOrThrow } from '~/lib/api'
import { commitImport, loadExistingChildren, previewImportRows, type ImportRowInput } from '~/services/import'

const rawRowSchema = z.record(z.string(), z.unknown())

const importPayloadSchema = z.object({
  rows: z
    .array(z.object({ raw: rawRowSchema, lineNumber: z.number().int().positive() }))
    .min(1, 'File tidak berisi baris data.')
    .max(5000, 'Maksimal 5000 baris per impor.'),
})

function toInputs(payload: z.infer<typeof importPayloadSchema>): ImportRowInput[] {
  return payload.rows.map((row) => ({ raw: row.raw, lineNumber: row.lineNumber }))
}

/**
 * TAHAP 1: validasi + hitung, TANPA menulis ke database.
 * Hasilnya ditampilkan ke petugas untuk dikonfirmasi sebelum disimpan.
 */
export const previewImportFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(importPayloadSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      await requireUser()
      return previewImportRows(toInputs(data), await loadExistingChildren())
    }),
  )

/**
 * TAHAP 2: simpan baris yang sudah dikonfirmasi.
 * Validasi dan perhitungan diulang penuh di server - pratinjau klien tidak dipercaya.
 */
export const commitImportFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(importPayloadSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      const user = await requireUser()
      return commitImport(toInputs(data), user.id)
    }),
  )
