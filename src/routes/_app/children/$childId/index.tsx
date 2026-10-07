import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { chartSeriesFn } from '~/api/dashboard'
import { deleteChildFn, getChildFn } from '~/api/children'
import { deleteMeasurementFn } from '~/api/measurements'
import { GrowthChart, type ChildPoint } from '~/charts/growth-chart'
import { OverallBadge, StatusBadge, formatNumber, formatZ } from '~/components/status-badge'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal } from '~/components/ui'
import { formatDate, formatGender, formatMethod, todayIso } from '~/lib/format'
import { DEFAULT_CHILD_FILTERS } from '~/lib/search-defaults'
import { calculateAge } from '~/services/anthropometry'

export const Route = createFileRoute('/_app/children/$childId/')({
  loader: async ({ params }) => {
    const childId = Number(params.childId)
    const result = await getChildFn({ data: { childId } })
    if (!result.ok) throw notFound()

    const gender = result.data.child.gender
    const [wfa, lhfa, wfl, bmia] = await Promise.all([
      chartSeriesFn({ data: { key: 'WFA', gender } }),
      chartSeriesFn({ data: { key: 'LHFA', gender } }),
      chartSeriesFn({ data: { key: 'WFL', gender } }),
      chartSeriesFn({ data: { key: 'BMIA', gender } }),
    ])

    return {
      ...result.data,
      series: {
        wfa: wfa.ok ? wfa.data : [],
        lhfa: lhfa.ok ? lhfa.data : [],
        wfl: wfl.ok ? wfl.data : [],
        bmia: bmia.ok ? bmia.data : [],
      },
    }
  },
  component: ChildDetailPage,
})

function pointsBy(
  measurements: { x: number; y: number | null }[],
): ChildPoint[] {
  return measurements.filter((point) => point.y !== null && Number.isFinite(point.x))
}

function ChildDetailPage() {
  const { child, measurements, series } = Route.useLoaderData()
  const router = useRouter()
  const removeChild = useServerFn(deleteChildFn)
  const removeMeasurement = useServerFn(deleteMeasurementFn)
  const [confirmDelete, setConfirmDelete] = useState<'child' | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Umur hari ini dihitung dari tanggal lahir, bukan disimpan.
  let currentAge = 'â€”'
  try {
    const age = calculateAge(child.dateOfBirth, todayIso())
    currentAge = `${age.years} tahun ${age.months} bulan`
  } catch {
    currentAge = 'â€”'
  }

  // Riwayat terbaru di atas; grafik tetap memakai urutan menaik dari loader.
  const history = [...measurements].reverse()

  const wfaPoints = pointsBy(measurements.map((m) => ({ x: m.ageTotalMonths, y: m.weightKg })))
  const lhfaPoints = pointsBy(
    measurements.map((m) => ({ x: m.ageTotalMonths, y: m.correctedLengthHeightCm })),
  )
  const wflPoints = pointsBy(
    measurements.map((m) => ({ x: m.correctedLengthHeightCm ?? 0, y: m.weightKg })),
  )
  const bmiaPoints = pointsBy(measurements.map((m) => ({ x: m.ageTotalMonths, y: m.bmi })))

  const latest = measurements.at(-1)

  async function handleDelete() {
    if (confirmDelete === null) return
    setBusy(true)
    setError(null)
    try {
      if (confirmDelete === 'child') {
        const result = await removeChild({ data: { childId: child.id } })
        if (!result.ok) {
          setError(result.message)
          return
        }
        await router.invalidate()
        await router.navigate({ to: '/children', search: DEFAULT_CHILD_FILTERS })
      } else {
        const result = await removeMeasurement({ data: { measurementId: confirmDelete } })
        if (!result.ok) {
          setError(result.message)
          return
        }
        setConfirmDelete(null)
        await router.invalidate()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{child.name}</h1>
            {latest?.result !== null && latest?.result !== undefined ? (
              <OverallBadge status={latest.result.overallStatus} />
            ) : (
              <OverallBadge status={null} />
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted">{child.childCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/children/$childId/measurements/new" params={{ childId: String(child.id) }}>
            <Button>Tambah Pengukuran</Button>
          </Link>
          <Link to="/children/$childId/edit" params={{ childId: String(child.id) }}>
            <Button variant="secondary">Ubah Data</Button>
          </Link>
          <Button variant="danger" onClick={() => setConfirmDelete('child')}>
            Hapus Anak
          </Button>
        </div>
      </header>

      {error !== null ? <Alert tone="attention" title={error} /> : null}

      <Card>
        <CardHeader title="Identitas anak" />
        <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Item label="Jenis Kelamin" value={formatGender(child.gender)} />
          <Item label="Tanggal Lahir" value={formatDate(child.dateOfBirth)} />
          <Item label="Umur Saat Ini" value={currentAge} />
          <Item label="Jumlah Pengukuran" value={String(measurements.length)} />
          <Item
            label="Berat Lahir"
            value={child.birthWeight === null ? 'â€”' : `${formatNumber(child.birthWeight, 3)} kg`}
          />
          <Item
            label="Panjang Lahir"
            value={child.birthLength === null ? 'â€”' : `${formatNumber(child.birthLength, 2)} cm`}
          />
          <Item label="Nama Ibu" value={child.motherName ?? 'â€”'} />
          <Item label="Nama Ayah" value={child.fatherName ?? 'â€”'} />
          {child.address !== null ? <Item label="Alamat" value={child.address} className="sm:col-span-2" /> : null}
          {child.notes !== null ? <Item label="Catatan" value={child.notes} className="sm:col-span-2" /> : null}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Riwayat Pengukuran"
          description="Perbandingan dengan pengukuran sebelumnya ditampilkan di bawah tiap nilai."
        />
        {history.length === 0 ? (
          <EmptyState
            title="Belum ada pengukuran"
            description="Catat pengukuran pertama untuk melihat status antropometri dan grafik pertumbuhan."
            action={
              <Link to="/children/$childId/measurements/new" params={{ childId: String(child.id) }}>
                <Button>Tambah Pengukuran</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-head">Tanggal</th>
                  <th className="table-head">Umur</th>
                  <th className="table-head">Cara Ukur</th>
                  <th className="table-head text-right">BB (kg)</th>
                  <th className="table-head text-right">PB/TB (cm)</th>
                  <th className="table-head text-right">IMT</th>
                  <th className="table-head">BB/U</th>
                  <th className="table-head">PB/TB/U</th>
                  <th className="table-head">BB/PB atau BB/TB</th>
                  <th className="table-head">IMT/U</th>
                  <th className="table-head text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => {
                  const previous = history[index + 1]
                  const result = entry.result
                  return (
                    <tr key={entry.id} className="hover:bg-line-soft/40">
                      <td className="table-cell tnum">{formatDate(entry.measurementDate)}</td>
                      <td className="table-cell tnum">
                        {entry.ageYear > 0 ? `${entry.ageYear} th ` : ''}
                        {entry.ageMonth} bln {entry.ageDay} hr
                      </td>
                      <td className="table-cell text-xs text-muted">
                        {formatMethod(entry.measurementMethod)}
                        {entry.correctedLengthHeightCm !== null &&
                        entry.rawLengthHeightCm !== null &&
                        entry.correctedLengthHeightCm !== entry.rawLengthHeightCm ? (
                          <span className="ml-1 text-[10px]">
                            (koreksi{' '}
                            {entry.correctedLengthHeightCm > entry.rawLengthHeightCm ? '+' : ''}
                            {(entry.correctedLengthHeightCm - entry.rawLengthHeightCm).toFixed(1)})
                          </span>
                        ) : null}
                      </td>
                      <td className="table-cell text-right tnum">
                        <div>{formatNumber(entry.weightKg, 3)}</div>
                        <Delta
                          current={entry.weightKg}
                          previous={previous?.weightKg ?? null}
                          unit="kg"
                          digits={2}
                        />
                      </td>
                      <td className="table-cell text-right tnum">
                        <div>{entry.correctedLengthHeightCm === null ? 'â€”' : formatNumber(entry.correctedLengthHeightCm, 2)}</div>
                        <Delta
                          current={entry.correctedLengthHeightCm}
                          previous={previous?.correctedLengthHeightCm ?? null}
                          unit="cm"
                          digits={1}
                        />
                      </td>
                      <td className="table-cell text-right tnum">{formatNumber(entry.bmi, 2)}</td>
                      <td className="table-cell">
                        {result === null ? (
                          <span className="text-faint">â€”</span>
                        ) : (
                          <ZCell z={result.weightForAgeZ} status={result.weightForAgeStatus} />
                        )}
                      </td>
                      <td className="table-cell">
                        {result === null ? (
                          <span className="text-faint">â€”</span>
                        ) : (
                          <ZCell z={result.lengthHeightForAgeZ} status={result.lengthHeightForAgeStatus} />
                        )}
                      </td>
                      <td className="table-cell">
                        {result === null ? (
                          <span className="text-faint">â€”</span>
                        ) : (
                          <ZCell
                            z={result.weightForLengthHeightZ}
                            status={result.weightForLengthHeightStatus}
                          />
                        )}
                      </td>
                      <td className="table-cell">
                        {result === null ? (
                          <span className="text-faint">â€”</span>
                        ) : (
                          <ZCell z={result.bmiForAgeZ} status={result.bmiForAgeStatus} />
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(entry.id)}
                          aria-label={`Hapus pengukuran ${entry.measurementDate}`}
                        >
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Grafik pertumbuhan</h2>
          <p className="mt-0.5 text-xs text-muted">
            Garis merah adalah data anak; pita abu-abu adalah rentang standar Permenkes 2/2020.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <GrowthChart
            title="Berat Badan menurut Umur (BB/U)"
            xLabel="Umur (bulan)"
            yLabel="BB (kg)"
            series={series.wfa}
            points={wfaPoints}
            formatY={(v) => v.toFixed(0)}
          />
          <GrowthChart
            title="Panjang/Tinggi Badan menurut Umur (PB/U atau TB/U)"
            xLabel="Umur (bulan)"
            yLabel="PB/TB (cm)"
            series={series.lhfa}
            points={lhfaPoints}
            formatY={(v) => v.toFixed(0)}
          />
          <GrowthChart
            title="Berat Badan menurut Panjang/Tinggi (BB/PB atau BB/TB)"
            xLabel="Panjang/tinggi (cm)"
            yLabel="BB (kg)"
            series={series.wfl}
            points={wflPoints}
            formatY={(v) => v.toFixed(0)}
          />
          <GrowthChart
            title="Indeks Massa Tubuh menurut Umur (IMT/U)"
            xLabel="Umur (bulan)"
            yLabel="IMT"
            series={series.bmia}
            points={bmiaPoints}
            formatY={(v) => v.toFixed(0)}
          />
        </div>
      </section>

      <Modal
        open={confirmDelete !== null}
        title={confirmDelete === 'child' ? 'Hapus data anak?' : 'Hapus pengukuran?'}
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>
              Ya, hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {confirmDelete === 'child'
            ? `Seluruh riwayat pengukuran ${child.name} ikut terhapus. Tindakan ini tercatat di audit log dan tidak dapat dibatalkan.`
            : 'Pengukuran ini akan dihapus beserta hasil perhitungannya. Tindakan ini tercatat di audit log.'}
        </p>
      </Modal>
    </div>
  )
}

function Item({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}

function ZCell({ z, status }: { z: number | null; status: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="tnum text-xs text-muted">{formatZ(z)}</span>
      <StatusBadge status={status} />
    </div>
  )
}

/**
 * Selisih terhadap pengukuran sebelumnya.
 * Kenaikan yang tidak wajar diberi warna agar mudah terlihat saat memindai tabel.
 */
function Delta({
  current,
  previous,
  unit,
  digits,
}: {
  current: number | null
  previous: number | null
  unit: string
  digits: number
}) {
  if (current === null || previous === null) return null
  const delta = current - previous
  if (Math.abs(delta) < 0.0005) {
    return <div className="text-[10px] text-faint">tetap</div>
  }
  const extreme = Math.abs(delta) > (unit === 'kg' ? 2 : 5)
  return (
    <div className="text-[10px]">
      <Badge tone={extreme ? 'risk' : delta < 0 ? 'attention' : 'neutral'}>
        {delta > 0 ? '+' : ''}
        {delta.toFixed(digits)} {unit}
      </Badge>
    </div>
  )
}
