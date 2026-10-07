import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { chartSeriesFn, dashboardFn } from '~/api/dashboard'
import { GrowthChart } from '~/charts/growth-chart'
import { Alert, Badge, Button, Card, CardHeader, StatCard } from '~/components/ui'
import { formatNumber } from '~/components/status-badge'
import {
  OVERALL_ATTENTION,
  OVERALL_INCOMPLETE,
  OVERALL_NO_REFERENCE,
  OVERALL_NORMAL,
  OVERALL_RISK,
} from '~/services/anthropometry'

const searchSchema = z.object({
  gender: z.enum(['L', 'P']).catch('L'),
})

export const Route = createFileRoute('/_app/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ gender: search.gender }),
  loader: async ({ deps }) => {
    const [dashboard, wfa, lhfa, wfl, bmia] = await Promise.all([
      dashboardFn(),
      chartSeriesFn({ data: { key: 'WFA', gender: deps.gender } }),
      chartSeriesFn({ data: { key: 'LHFA', gender: deps.gender } }),
      chartSeriesFn({ data: { key: 'WFL', gender: deps.gender } }),
      chartSeriesFn({ data: { key: 'BMIA', gender: deps.gender } }),
    ])
    return { dashboard, series: { wfa, lhfa, wfl, bmia } }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboard, series } = Route.useLoaderData()
  const { gender } = Route.useSearch()
  const navigate = Route.useNavigate()

  if (!dashboard.ok) {
    return <Alert tone="attention" title="Gagal memuat dashboard" children={dashboard.message} />
  }

  const { stats, trend } = dashboard.data
  const seriesData = {
    wfa: series.wfa.ok ? series.wfa.data : [],
    lhfa: series.lhfa.ok ? series.lhfa.data : [],
    wfl: series.wfl.ok ? series.wfl.data : [],
    bmia: series.bmia.ok ? series.bmia.data : [],
  }

  const labelJk = gender === 'L' ? 'Laki-laki' : 'Perempuan'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted">
            Ringkasan pemantauan pertumbuhan anak 0-60 bulan.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Anak" value={stats.totalChildren} hint={`${stats.neverMeasured} belum diukur`} />
        <StatCard
          label="Pengukuran Bulan Ini"
          value={stats.measurementsThisMonth}
          hint={`${trend.at(-1)?.count ?? 0} bulan terakhir`}
        />
        <StatCard label="Status Normal" value={stats.normal} tone="normal" hint="Status terakhir per anak" />
        <StatCard
          label="Perlu Perhatian"
          value={stats.attention}
          tone="attention"
          hint={`${stats.risk} berisiko, ${stats.other} data tidak lengkap`}
        />
      </div>

      <Card>
        <CardHeader
          title="Ringkasan status antropometri"
          description="Dihitung dari pengukuran terakhir setiap anak."
        />
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Badge tone="normal">
            Normal: {stats.normal}
          </Badge>
          <Badge tone="risk">
            {OVERALL_RISK}: {stats.risk}
          </Badge>
          <Badge tone="attention">
            {OVERALL_ATTENTION}: {stats.attention}
          </Badge>
          <Badge tone="neutral">
            {OVERALL_INCOMPLETE} / {OVERALL_NO_REFERENCE}: {stats.other}
          </Badge>
          <Badge tone="neutral">Belum diukur: {stats.neverMeasured}</Badge>
        </div>
        <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
          Anak dengan status {OVERALL_ATTENTION} sebaiknya dirujuk untuk penilaian tenaga kesehatan
          lebih lanjut.
        </p>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Kurva pertumbuhan standar</h2>
            <p className="mt-0.5 text-xs text-muted">
              Pita -3SD sampai +3SD, jenis kelamin {labelJk}.
            </p>
          </div>
          <div className="flex gap-1 rounded-md border border-line bg-card p-1" role="group" aria-label="Jenis kelamin">
            {(['L', 'P'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={gender === value ? 'primary' : 'ghost'}
                aria-pressed={gender === value}
                onClick={() => navigate({ search: (prev) => ({ ...prev, gender: value }) })}
              >
                {value === 'L' ? 'Laki-laki' : 'Perempuan'}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <GrowthChart
            title="Berat Badan menurut Umur (BB/U)"
            xLabel="Umur (bulan)"
            yLabel="BB (kg)"
            series={seriesData.wfa}
            points={[]}
            formatY={(v) => formatNumber(v, 1)}
          />
          <GrowthChart
            title="Panjang/Tinggi Badan menurut Umur (PB/U atau TB/U)"
            xLabel="Umur (bulan)"
            yLabel="PB/TB (cm)"
            series={seriesData.lhfa}
            points={[]}
            formatY={(v) => formatNumber(v, 0)}
          />
          <GrowthChart
            title="Berat Badan menurut Panjang/Tinggi (BB/PB atau BB/TB)"
            xLabel="Panjang/tinggi (cm)"
            yLabel="BB (kg)"
            series={seriesData.wfl}
            points={[]}
            formatY={(v) => formatNumber(v, 1)}
          />
          <GrowthChart
            title="Indeks Massa Tubuh menurut Umur (IMT/U)"
            xLabel="Umur (bulan)"
            yLabel="IMT"
            series={seriesData.bmia}
            points={[]}
            formatY={(v) => formatNumber(v, 0)}
          />
        </div>
      </section>
    </div>
  )
}
