import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUser } from '~/auth/session'
import { buildExportRows, exportFilename, toCsv, toXlsx } from '~/services/exports'
import { exportFiltersSchema } from '~/validators/schemas'

/**
 * Endpoint unduhan berkas. Sengaja route terpisah (bukan server function)
 * karena responsnya berupa berkas biner, bukan JSON.
 *
 * Route ini tidak berada di bawah layout /_app, jadi otentikasinya diperiksa
 * di sini: tanpa sesi yang sah, permintaan langsung ditolak 401 dan tidak
 * ada satu baris data pun yang dibangun.
 */
export const Route = createFileRoute('/unduh')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser()
        if (user === null) {
          return new Response('Silakan masuk terlebih dahulu.', {
            status: 401,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }

        const url = new URL(request.url)
        const parsed = exportFiltersSchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) {
          return new Response('Parameter ekspor tidak valid.', {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }

        const filters = parsed.data
        if (filters.format === 'pdf') {
          return new Response(
            'Untuk PDF gunakan halaman cetak (/cetak) lalu simpan sebagai PDF.',
            { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
          )
        }

        const rows = await buildExportRows(filters)
        if (rows.length === 0) {
          return new Response('Tidak ada data yang cocok dengan filter ekspor.', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }

        const filename = exportFilename(filters.format, filters.scope)

        if (filters.format === 'csv') {
          return new Response(toCsv(rows), {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Cache-Control': 'no-store',
            },
          })
        }

        const bytes = toXlsx(rows)
        return new Response(bytes as unknown as BodyInit, {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
