import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartPoint } from '~/services/reference-cache'
import { Card, CardHeader } from '~/components/ui'

export type ChildPoint = { x: number; y: number | null; label?: string }

export type ChartRow = ChartPoint & { span2: number; span3: number; child: number | null }

function interpolateAt(series: readonly ChartPoint[], x: number): ChartPoint | null {
  if (series.length === 0) return null
  const first = series[0]!
  const last = series[series.length - 1]!
  if (x < first.x || x > last.x) return null

  for (let i = 0; i < series.length - 1; i += 1) {
    const a = series[i]!
    const b = series[i + 1]!
    if (x >= a.x && x <= b.x) {
      const span = b.x - a.x
      const t = span === 0 ? 0 : (x - a.x) / span
      return {
        x,
        minus3: a.minus3 + (b.minus3 - a.minus3) * t,
        minus2: a.minus2 + (b.minus2 - a.minus2) * t,
        minus1: a.minus1 + (b.minus1 - a.minus1) * t,
        median: a.median + (b.median - a.median) * t,
        plus1: a.plus1 + (b.plus1 - a.plus1) * t,
        plus2: a.plus2 + (b.plus2 - a.plus2) * t,
        plus3: a.plus3 + (b.plus3 - a.plus3) * t,
      }
    }
  }
  return null
}

/**
 * Gabungkan pita referensi dan titik data anak jadi satu array terurut.
 *
 * Titik anak hampir tidak pernah jatuh persis di baris referensi (umur bisa
 * 9 bulan 12 hari, panjang 61.3 cm), jadi pita diinterpolasi pada x tersebut.
 * Tanpa ini pita -3SD..+3SD akan berlubang di setiap titik data anak.
 */
export function mergeChartRows(
  series: readonly ChartPoint[],
  points: readonly ChildPoint[],
): ChartRow[] {
  const rows = new Map<number, ChartRow>()

  const put = (x: number, base: ChartPoint): ChartRow => {
    const existing = rows.get(x)
    if (existing !== undefined) return existing
    const row: ChartRow = {
      ...base,
      span2: base.plus2 - base.minus2,
      span3: base.plus3 - base.minus3,
      child: null,
    }
    rows.set(x, row)
    return row
  }

  for (const point of series) put(point.x, point)
  for (const point of points) {
    const base = series.find((p) => p.x === point.x) ?? interpolateAt(series, point.x)
    if (base === null) continue
    put(point.x, base).child = point.y
  }

  return [...rows.values()].sort((a, b) => a.x - b.x)
}

const AXIS = { stroke: '#dfe3e0' } as const
const TICK = { fill: '#5d6b68', fontSize: 11 } as const

export function GrowthChart({
  title,
  description,
  xLabel,
  yLabel,
  series,
  points,
  formatY = (value: number) => value.toFixed(1),
  formatX = (value: number) => String(value),
}: {
  title: string
  description?: string
  xLabel: string
  yLabel: string
  series: readonly ChartPoint[]
  points: readonly ChildPoint[]
  formatY?: (value: number) => string
  formatX?: (value: number) => string
}) {
  const rows = mergeChartRows(series, points)

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-2 pt-3 pb-1">
        {rows.length === 0 ? (
          <p className="px-2 py-10 text-center text-xs text-muted">
            Referensi untuk grafik ini tidak tersedia.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatX}
                tick={TICK}
                axisLine={AXIS}
                tickLine={false}
                label={{ value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11, fill: '#5d6b68' }}
              />
              <YAxis
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatY}
                tick={TICK}
                axisLine={false}
                tickLine={false}
                width={44}
                label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5d6b68' }}
              />
              <Tooltip
                formatter={(value, name) => [formatY(Number(value)), String(name)]}
                labelFormatter={(label) => `${xLabel}: ${formatX(Number(label))}`}
                contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#dfe3e0' }}
              />

              <Area dataKey="minus3" stackId="band3" stroke="none" fill="transparent" name="_b3" legendType="none" />
              <Area dataKey="span3" stackId="band3" stroke="none" fill="#0e5f57" fillOpacity={0.07} name="-3SD s/d +3SD" />
              <Area dataKey="minus2" stackId="band2" stroke="none" fill="transparent" name="_b2" legendType="none" />
              <Area dataKey="span2" stackId="band2" stroke="none" fill="#0e5f57" fillOpacity={0.09} name="-2SD s/d +2SD" />

              <Line dataKey="plus3" stroke="#b6bfbc" strokeWidth={1} strokeDasharray="3 3" dot={false} name="+3SD" />
              <Line dataKey="minus3" stroke="#b6bfbc" strokeWidth={1} strokeDasharray="3 3" dot={false} name="-3SD" />
              <Line dataKey="plus2" stroke="#8b9794" strokeWidth={1} strokeDasharray="4 3" dot={false} name="+2SD" />
              <Line dataKey="minus2" stroke="#8b9794" strokeWidth={1} strokeDasharray="4 3" dot={false} name="-2SD" />
              <Line dataKey="median" stroke="#0e5f57" strokeWidth={2} dot={false} name="Median" />
              <Line
                dataKey="child"
                stroke="#a51d1d"
                strokeWidth={2}
                dot={{ r: 3, fill: '#a51d1d', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                name="Data anak"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartLegend />
    </Card>
  )
}

function ChartLegend() {
  const items = [
    { label: 'Data anak', className: 'bg-attention' },
    { label: 'Median', className: 'bg-primary' },
    { label: '±2SD', className: 'bg-[#8b9794]' },
    { label: '±3SD', className: 'bg-[#b6bfbc]' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className={`size-2 rounded-full ${item.className}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
