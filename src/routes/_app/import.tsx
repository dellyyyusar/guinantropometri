import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { commitImportFn, previewImportFn } from '~/api/imports'
import { OverallBadge, formatZ } from '~/components/status-badge'
import { Alert, Button, Card, CardHeader, Badge, Spinner } from '~/components/ui'
import { DEFAULT_CHILD_FILTERS } from '~/lib/search-defaults'
import { IMPORT_HEADERS } from '~/services/import-normalize'
import type { ImportPreview } from '~/services/import'

export const Route = createFileRoute('/_app/import')({
  component: ImportPage,
})

type Payload = { rows: { raw: Record<string, unknown>; lineNumber: number }[] }

export function ImportPage() {
  const preview = useServerFn(previewImportFn)
  const commit = useServerFn(commitImportFn)
  const router = useRouter()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [payload, setPayload] = useState<Payload | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [previewResult, setPreviewResult] = useState<ImportPreview | null>(null)
  const [commitResult, setCommitResult] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<'parse' | 'commit' | null>(null)

  async function handleFile(file: File) {
    setBusy('parse')
    setMessage(null)
    setPreviewResult(null)
    setCommitResult(null)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      // cellDates: true supaya kolom tanggal menjadi Date, bukan nomor seri mentah.
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = sheetName === undefined ? undefined : workbook.Sheets[sheetName]
      if (sheet === undefined) {
        setMessage('Berkas tidak berisi lembar kerja.')
        return
      }

      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
      if (raw.length === 0) {
        setMessage('Berkas tidak berisi baris data.')
        return
      }

      // Baris ke-N di Excel memperhitungkan baris judul, jadi +2 saat pelaporan.
      const rows = raw.map((entry, index) => ({ raw: entry, lineNumber: index + 2 }))
      setPayload({ rows })

      const result = await preview({ data: { rows } })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setPreviewResult(result.data)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Berkas tidak dapat dibaca: ${error.message}`
          : 'Berkas tidak dapat dibaca.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function handleCommit() {
    if (payload === null) return
    setBusy('commit')
    setMessage(null)
    try {
      const result = await commit({ data: payload })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      const { childrenCreated, measurementsCreated, rowsSkipped } = result.data
      setCommitResult(
        `Selesai. ${measurementsCreated} pengukuran tersimpan, ${childrenCreated} anak baru dibuat, ${rowsSkipped} baris dilewati.`,
      )
      setPreviewResult(null)
      setPayload(null)
      await router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      [...IMPORT_HEADERS],
      ['LIA', 'P', '2026-01-14', '2026-10-14', 6.8, 61, 'LYING'],
    ])
    sheet['!cols'] = IMPORT_HEADERS.map(() => ({ wch: 16 }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Impor')
    XLSX.writeFile(book, 'template-impor-antropometri.xlsx')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Impor Excel</h1>
        <p className="mt-0.5 text-xs text-muted">
          Data dari berkas divalidasi dan dihitung terlebih dahulu, lalu ditampilkan untuk
          dikonfirmasi. Tidak ada baris yang masuk database sebelum Anda menyetujuinya.
        </p>
      </header>

      {message !== null ? <Alert tone="attention" title={message} /> : null}
      {commitResult !== null ? (
        <Alert tone="normal" title="Impor berhasil">
          {commitResult}{' '}
          <button className="underline" onClick={() => navigate({ to: '/children', search: DEFAULT_CHILD_FILTERS })}>
            Lihat data anak
          </button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="1. Pilih berkas"
          description={`Kolom yang dikenali: ${IMPORT_HEADERS.join(', ')}.`}
          action={
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              Unduh Template
            </Button>
          }
        />
        <div className="space-y-3 p-4">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="block w-full cursor-pointer rounded-md border border-line bg-card p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-dark"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) void handleFile(file)
            }}
          />
          <p className="text-xs text-faint">
            Kolom tanggal menerima format <span className="font-mono">2026-10-14</span>,{' '}
            <span className="font-mono">14/10/2026</span>, atau tanggal asli Excel. Jenis kelamin
            menerima L/P. Cara ukur menerima BERDIRI/BERBARING atau STANDING/LYING.
          </p>
          {busy === 'parse' ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Membaca dan memvalidasi {fileName}â€¦
            </p>
          ) : null}
        </div>
      </Card>

      {previewResult !== null ? (
        <Card>
          <CardHeader
            title="2. Pratinjau dan konfirmasi"
            description={`${previewResult.okCount} baris siap disimpan, ${previewResult.errorCount} baris bermasalah.`}
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-head">Baris</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Nama</th>
                  <th className="table-head">Tanggal Ukur</th>
                  <th className="table-head">Umur</th>
                  <th className="table-head text-right">BB</th>
                  <th className="table-head text-right">PB/TB</th>
                  <th className="table-head">BB/U</th>
                  <th className="table-head">PB/TB/U</th>
                  <th className="table-head">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.rows.map((row) => (
                  <tr key={row.lineNumber} className={row.status === 'error' ? 'bg-attention-soft/40' : undefined}>
                    <td className="table-cell tnum text-muted">{row.lineNumber}</td>
                    <td className="table-cell">
                      {row.status === 'ok' ? (
                        <Badge tone="normal">Siap</Badge>
                      ) : (
                        <Badge tone="attention">Bermasalah</Badge>
                      )}
                    </td>
                    <td className="table-cell">{row.summary?.nama ?? 'â€”'}</td>
                    <td className="table-cell tnum">{row.summary?.tanggalUkur ?? 'â€”'}</td>
                    <td className="table-cell tnum">{row.summary?.umur ?? 'â€”'}</td>
                    <td className="table-cell text-right tnum">{row.summary?.bb ?? 'â€”'}</td>
                    <td className="table-cell text-right tnum">{row.summary?.pbTb ?? 'â€”'}</td>
                    <td className="table-cell">
                      {row.summary === undefined ? (
                        <span className="text-faint">â€”</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="tnum text-xs text-muted">{formatZ(row.summary.zBbU)}</span>
                          <OverallBadge status={row.summary.statusBbU} />
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      {row.summary === undefined ? (
                        <span className="text-faint">â€”</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="tnum text-xs text-muted">{formatZ(row.summary.zPbTbU)}</span>
                          <OverallBadge status={row.summary.statusPbTbU} />
                        </div>
                      )}
                    </td>
                    <td className="table-cell max-w-72 whitespace-normal">
                      {row.errors.length > 0 ? (
                        <ul className="list-inside list-disc text-[11px] text-attention">
                          {row.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                      {row.warnings.length > 0 ? (
                        <ul className="list-inside list-disc text-[11px] text-risk">
                          {row.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                      {row.errors.length === 0 && row.warnings.length === 0 ? (
                        <span className="text-faint">â€”</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <p className="text-xs text-muted">
              Baris bermasalah akan dilewati. Baris siap disimpan dihitung ulang di server sebelum
              ditulis.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewResult(null)
                  setPayload(null)
                  if (fileInput.current !== null) fileInput.current.value = ''
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleCommit}
                loading={busy === 'commit'}
                disabled={previewResult.okCount === 0}
              >
                Simpan {previewResult.okCount} Baris
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {previewResult === null && commitResult === null ? (
        <Card>
          <CardHeader title="Cara kerja impor" />
          <ol className="list-inside list-decimal space-y-1.5 p-4 text-xs text-muted">
            <li>Berkas dibaca di peramban Anda; isinya dikirim ke server untuk divalidasi.</li>
            <li>
              Server menghitung umur, koreksi PB/TB, IMT, dan keempat z-score memakai tabel
              Permenkes 2/2020 yang sama dengan input manual.
            </li>
            <li>Baris dengan validation error tidak dapat masuk database; peringatan klinis tetap boleh disimpan.</li>
            <li>Anak dengan nama, jenis kelamin, dan tanggal lahir yang sama digabung sebagai satu anak.</li>
          </ol>
        </Card>
      ) : null}
    </div>
  )
}
