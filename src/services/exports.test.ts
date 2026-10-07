import { describe, expect, it } from 'vitest'
import { EXPORT_COLUMNS, exportFilename, toCsv, type ExportRow } from './exports'

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  const base = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.key, null])) as ExportRow
  return { ...base, ...overrides }
}

describe('toCsv', () => {
  it('menyisipkan BOM UTF-8 supaya Excel membaca huruf beraksen dengan benar', () => {
    expect(toCsv([]).startsWith('\uFEFF')).toBe(true)
  })

  it('header memakai judul kolom dan pemisah titik-koma', () => {
    const csv = toCsv([])
    const header = csv.replace('\uFEFF', '').split('\r\n')[0]
    expect(header).toBe(EXPORT_COLUMNS.map((c) => c.header).join(';'))
  })

  it('mengutip nilai yang memuat pemisah, kutip, atau baris baru', () => {
    const csv = toCsv([row({ namaAnak: 'Lia; si "Kecil"\nbaris dua' })])
    expect(csv).toContain('"Lia; si ""Kecil""\nbaris dua"')
  })

  it('nilai null menjadi sel kosong, bukan tulisan "null"', () => {
    const csv = toCsv([row({ namaAnak: 'Lia' })])
    const line = csv.replace('\uFEFF', '').split('\r\n')[1]!
    expect(line).not.toContain('null')
    expect(line.startsWith(';Lia;')).toBe(true)
  })

  it('angka nol tetap tertulis sebagai 0', () => {
    const csv = toCsv([row({ zBbU: 0 })])
    expect(csv).toContain(';0;')
  })

  it('diakhiri satu baris baru supaya file tidak menyatu saat digabung', () => {
    expect(toCsv([row({ namaAnak: 'Lia' })]).endsWith('\r\n')).toBe(true)
  })
})

describe('exportFilename', () => {
  it('memuat cakupan dan ekstensi', () => {
    const name = exportFilename('xlsx', 'all')
    expect(name).toMatch(/^antropometri-all-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})
