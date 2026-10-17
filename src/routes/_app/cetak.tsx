import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { exportRowsFn } from '~/api/exports'
import { Alert, Button, Card } from '~/components/ui'
import { EXPORT_COLUMNS } from '~/services/exports'
import { exportFiltersSchema } from '~/validators/schemas'
import { formatDateShort } from '~/lib/format'

export const Route = createFileRoute('/_app/cetak')({
  validateSearch: exportFiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => exportRowsFn({ data: deps }),
  component: PrintPage,
})

function PrintPage() {
  const result = Route.useLoaderData()

  // Dialog cetak dibuka otomatis; pengguna memilih "Simpan sebagai PDF".
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  if (!result.ok) {
    return <Alert tone="attention" title="Gagal memuat data" children={result.message} />
  }

  const rows = result.data

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Halaman Cetak</h1>
          <p className="mt-0.5 text-xs text-muted">
            Pilih &ldquo;Simpan sebagai PDF&rdquo; pada dialog cetak.
          </p>
        </div>
        <Button onClick={() => window.print()}>Cetak / Simpan PDF</Button>
      </div>

      <Card className="p-5 print:border-0">
        <header className="mb-4 border-b border-line pb-3">
          <h2 className="text-base font-semibold">
            Laporan Status Antropometri Anak
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Standar Antropometri Anak - Permenkes RI Nomor 2 Tahun 2020 (WHO Child Growth Standards
            2006)
          </p>
          <p className="mt-1 text-[11px] text-faint">
            Dicetak: {new Date().toLocaleString('id-ID')} · {rows.length} baris pengukuran
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {EXPORT_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="border border-line bg-line-soft/60 px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {EXPORT_COLUMNS.map((column) => (
                    <td key={column.key} className="border border-line px-2 py-1 tnum whitespace-nowrap">
                      {formatCell(column.key, row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="mt-4 border-t border-line pt-3 text-[10px] leading-relaxed text-muted">
          <p>
            Hasil aplikasi merupakan alat bantu berdasarkan standar antropometri dan bukan pengganti
            penilaian tenaga kesehatan. Kategori &ldquo;perlu perhatian lebih lanjut&rdquo; bukan
            diagnosis medis.
          </p>
        </footer>
      </Card>
    </div>
  )
}

function formatCell(key: string, value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '-'
  if (key.startsWith('tanggal')) return formatDateShort(String(value))
  return String(value)
}
