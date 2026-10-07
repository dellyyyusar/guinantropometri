import { createServerFn } from '@tanstack/react-start'
import { requireUser } from '~/auth/session'
import { guard, parseOrThrow } from '~/lib/api'
import { buildExportRows } from '~/services/exports'
import { exportFiltersSchema } from '~/validators/schemas'

/**
 * Baris data untuk halaman cetak/PDF.
 * Sumber datanya sama dengan ekspor Excel/CSV, jadi angka di ketiga format
 * tidak mungkin berbeda.
 */
export const exportRowsFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => parseOrThrow(exportFiltersSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      await requireUser()
      return buildExportRows(data)
    }),
  )
