import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { childOptionsFn } from '~/api/children'
import { Alert, Button, Card, CardHeader, Field, Input, Select } from '~/components/ui'
import {
  OVERALL_ATTENTION,
  OVERALL_INCOMPLETE,
  OVERALL_NO_REFERENCE,
  OVERALL_NORMAL,
  OVERALL_RISK,
} from '~/services/anthropometry'
import { todayIso } from '~/lib/format'

export const Route = createFileRoute('/_app/export')({
  loader: async () => ({ children: await childOptionsFn() }),
  component: ExportPage,
})

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: OVERALL_NORMAL, label: OVERALL_NORMAL },
  { value: OVERALL_RISK, label: OVERALL_RISK },
  { value: OVERALL_ATTENTION, label: OVERALL_ATTENTION },
  { value: OVERALL_INCOMPLETE, label: OVERALL_INCOMPLETE },
  { value: OVERALL_NO_REFERENCE, label: OVERALL_NO_REFERENCE },
]

function ExportPage() {
  const { children } = Route.useLoaderData()
  const [scope, setScope] = useState<'all' | 'child'>('all')
  const [childId, setChildId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')

  const options = children.ok ? children.data : []

  function buildQuery(format: 'xlsx' | 'csv' | 'pdf'): string {
    const params = new URLSearchParams({ format, scope })
    if (scope === 'child' && childId !== '') params.set('childId', childId)
    if (from !== '') params.set('from', from)
    if (to !== '') params.set('to', to)
    if (status !== '') params.set('status', status)
    return params.toString()
  }

  const scopeInvalid = scope === 'child' && childId === ''

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Ekspor Data</h1>
        <p className="mt-0.5 text-xs text-muted">
          Unduh riwayat pengukuran beserta hasil perhitungannya untuk arsip atau pelaporan.
        </p>
      </header>

      {children.ok === false ? (
        <Alert tone="attention" title="Gagal memuat daftar anak" children={children.message} />
      ) : null}

      <Card>
        <CardHeader title="Filter ekspor" description="Biarkan kosong untuk mengekspor seluruh data." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Cakupan Data">
            <Select value={scope} onChange={(event) => setScope(event.target.value as 'all' | 'child')}>
              <option value="all">Semua anak</option>
              <option value="child">Satu anak</option>
            </Select>
          </Field>

          <Field
            label="Pilih Anak"
            error={scopeInvalid ? 'Pilih anak terlebih dahulu' : undefined}
          >
            <Select
              value={childId}
              disabled={scope !== 'child'}
              invalid={scopeInvalid}
              onChange={(event) => setChildId(event.target.value)}
            >
              <option value="">- pilih anak -</option>
              {options.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.childCode} · {child.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tanggal Ukur Dari" hint="Opsional">
            <Input type="date" max={to !== '' ? to : todayIso()} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>

          <Field label="Tanggal Ukur Sampai" hint="Opsional">
            <Input type="date" min={from !== '' ? from : undefined} max={todayIso()} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>

          <Field label="Status Antropometri" className="sm:col-span-2">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Format berkas" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <a
              href={scopeInvalid ? undefined : `/unduh?${buildQuery('xlsx')}`}
              className={scopeInvalid ? 'pointer-events-none opacity-50' : undefined}
            >
              <Button>Unduh Excel (.xlsx)</Button>
            </a>
            <a
              href={scopeInvalid ? undefined : `/unduh?${buildQuery('csv')}`}
              className={scopeInvalid ? 'pointer-events-none opacity-50' : undefined}
            >
              <Button variant="secondary">Unduh CSV (.csv)</Button>
            </a>
            <a
              href={scopeInvalid ? undefined : `/cetak?${buildQuery('pdf')}`}
              target="_blank"
              rel="noreferrer"
              className={scopeInvalid ? 'pointer-events-none opacity-50' : undefined}
            >
              <Button variant="secondary">Buka Halaman Cetak (PDF)</Button>
            </a>
          </div>
          <p className="text-xs text-muted">
            PDF dihasilkan lewat dialog cetak peramban: pada halaman cetak pilih tujuan
            &ldquo;Simpan sebagai PDF&rdquo;. Cara ini menghasilkan PDF vektor yang tajam dan tidak
            menambah dependensi pembuat PDF di server.
          </p>
          <p className="text-xs text-faint">
            CSV memakai pemisah titik-koma dan BOM UTF-8 supaya langsung terbaca benar di Microsoft
            Excel versi Indonesia.
          </p>
        </div>
      </Card>
    </div>
  )
}
