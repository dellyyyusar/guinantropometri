import { describe, expect, it } from 'vitest'
import { mergeChartRows } from './growth-chart'
import type { ChartPoint } from '~/services/reference-cache'

const series: ChartPoint[] = [
  { x: 0, minus3: 2.1, minus2: 2.5, minus1: 2.9, median: 3.3, plus1: 3.9, plus2: 4.4, plus3: 5.0 },
  { x: 1, minus3: 2.9, minus2: 3.4, minus1: 3.9, median: 4.5, plus1: 5.1, plus2: 5.8, plus3: 6.6 },
  { x: 2, minus3: 3.8, minus2: 4.3, minus1: 4.9, median: 5.6, plus1: 6.3, plus2: 7.1, plus3: 8.0 },
]

describe('mergeChartRows', () => {
  it('tanpa data anak tetap menghasilkan baris referensi dengan span pita', () => {
    const rows = mergeChartRows(series, [])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ x: 0, span2: 4.4 - 2.5, span3: 5.0 - 2.1, child: null })
  })

  it('titik anak tepat di baris referensi menempel di baris itu', () => {
    const rows = mergeChartRows(series, [{ x: 1, y: 4.9 }])
    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.x === 1)?.child).toBe(4.9)
  })

  it('titik anak di antara dua baris menginterpolasi pita, bukan berlubang', () => {
    const rows = mergeChartRows(series, [{ x: 0.5, y: 3.9 }])
    expect(rows).toHaveLength(4)
    const inserted = rows.find((r) => r.x === 0.5)
    expect(inserted).toBeDefined()
    expect(inserted!.child).toBe(3.9)
    // Separuh jalan antara bulan 0 dan 1.
    expect(inserted!.median).toBeCloseTo((3.3 + 4.5) / 2, 10)
    expect(inserted!.minus3).toBeCloseTo((2.1 + 2.9) / 2, 10)
    expect(inserted!.span3).toBeCloseTo(inserted!.plus3 - inserted!.minus3, 10)
  })

  it('baris tetap terurut menaik walau data anak dimasukkan tidak berurutan', () => {
    const rows = mergeChartRows(series, [
      { x: 1.5, y: 6 },
      { x: 0.5, y: 3.9 },
    ])
    const xs = rows.map((r) => r.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('titik anak di luar rentang tabel dilewati, bukan dipaksakan ke ujung', () => {
    const rows = mergeChartRows(series, [
      { x: -5, y: 1 },
      { x: 99, y: 20 },
    ])
    expect(rows.every((r) => r.child === null)).toBe(true)
  })

  it('nilai anak null tidak membentuk titik', () => {
    const rows = mergeChartRows(series, [{ x: 1, y: null }])
    expect(rows.find((r) => r.x === 1)?.child).toBeNull()
  })

  it('referensi kosong tidak melempar', () => {
    expect(mergeChartRows([], [{ x: 3, y: 5 }])).toEqual([])
  })
})
