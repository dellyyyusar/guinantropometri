import { describe, expect, it } from 'vitest'
import {
  childGroupKey,
  childGroupKeyFromRow,
  normalizeDate,
  normalizeGender,
  normalizeImportRow,
  normalizeMethod,
  normalizeNumber,
} from './import-normalize'

describe('normalizeGender', () => {
  it('menerima singkatan, kata penuh, dan istilah Inggris', () => {
    for (const value of ['L', 'l', 'Laki-laki', 'LK', 'M', 'male', '1']) {
      expect(normalizeGender(value)).toBe('L')
    }
    for (const value of ['P', 'p', 'Perempuan', 'PR', 'F', 'female', '2']) {
      expect(normalizeGender(value)).toBe('P')
    }
  })

  it('mengembalikan null untuk nilai tak dikenal', () => {
    expect(normalizeGender('X')).toBeNull()
    expect(normalizeGender(null)).toBeNull()
  })
})

describe('normalizeMethod', () => {
  it('menerima istilah Indonesia dan Inggris', () => {
    expect(normalizeMethod('BERDIRI')).toBe('STANDING')
    expect(normalizeMethod('standing')).toBe('STANDING')
    expect(normalizeMethod('Berbaring')).toBe('LYING')
    expect(normalizeMethod('terlentang')).toBe('LYING')
  })

  it('mengembalikan null untuk nilai tak dikenal', () => {
    expect(normalizeMethod('duduk')).toBeNull()
  })
})

describe('normalizeDate', () => {
  it('Date diurai memakai waktu LOKAL, tidak bergeser satu hari', () => {
    // Excel menyerahkan tengah malam waktu lokal. toISOString() akan
    // memundurkannya sehari di zona UTC+7 — ini yang harus dicegah.
    const date = new Date(2026, 0, 14)
    expect(normalizeDate(date)).toBe('2026-01-14')
  })

  it('menerima ISO, format Indonesia, dan slash', () => {
    expect(normalizeDate('2026-01-14')).toBe('2026-01-14')
    expect(normalizeDate('2026-01-14T00:00:00.000Z')).toBe('2026-01-14')
    expect(normalizeDate('14/01/2026')).toBe('2026-01-14')
    expect(normalizeDate('1-2-2026')).toBe('2026-02-01')
    expect(normalizeDate('14.01.2026')).toBe('2026-01-14')
  })

  it('menerima nomor seri Excel', () => {
    // 46036 = 14 Januari 2026 pada sistem tanggal 1900.
    expect(normalizeDate(46036)).toBe('2026-01-14')
  })

  it('mengembalikan null untuk sel kosong atau tak terbaca', () => {
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate(null)).toBeNull()
    expect(normalizeDate('bukan tanggal')).toBeNull()
  })
})

describe('normalizeNumber', () => {
  it('menerima titik maupun koma desimal', () => {
    expect(normalizeNumber('6.8')).toBe(6.8)
    expect(normalizeNumber('6,8')).toBe(6.8)
    expect(normalizeNumber(6.8)).toBe(6.8)
  })

  it('menghapus pemisah ribuan bergaya Indonesia', () => {
    expect(normalizeNumber('1.234')).toBe(1234)
  })

  it('mengembalikan null bukan 0 untuk sel kosong', () => {
    expect(normalizeNumber('')).toBeNull()
    expect(normalizeNumber(null)).toBeNull()
    expect(normalizeNumber('abc')).toBeNull()
  })
})

describe('normalizeImportRow', () => {
  it('memetakan judul berbahasa Indonesia apa adanya', () => {
    const result = normalizeImportRow({
      Nama: 'LIA',
      'Jenis Kelamin': 'P',
      'Tanggal Lahir': '2026-01-14',
      'Tanggal Ukur': '2026-10-14',
      BB: 6.8,
      'PB/TB': 61,
      'Cara Ukur': 'LYING',
    })
    expect(result).toEqual({
      data: {
        nama: 'LIA',
        jenisKelamin: 'P',
        tanggalLahir: '2026-01-14',
        tanggalUkur: '2026-10-14',
        bb: 6.8,
        pbTb: 61,
        caraUkur: 'LYING',
        kodeAnak: undefined,
      },
    })
  })

  it('tahan terhadap judul yang berspasi, berhuruf besar, dan bersinonim', () => {
    const result = normalizeImportRow({
      'nama anak ': 'LIA',
      jk: 'P',
      'tgl lahir': '14/01/2026',
      'TANGGAL PENGUKURAN': '14/10/2026',
      'berat badan': '6,8',
      tinggi_badan: '61',
      cara_pengukuran: 'berbaring',
    })
    expect(result).toMatchObject({
      data: {
        nama: 'LIA',
        jenisKelamin: 'P',
        tanggalLahir: '2026-01-14',
        tanggalUkur: '2026-10-14',
        bb: 6.8,
        pbTb: 61,
        caraUkur: 'LYING',
      },
    })
  })

  it('baris kosong dilewati, bukan dianggap data rusak', () => {
    expect(normalizeImportRow({ Nama: '', 'Jenis Kelamin': null, BB: null })).toEqual({ empty: true })
    expect(normalizeImportRow({})).toEqual({ empty: true })
  })

  it('kolom asing diabaikan tanpa menggagalkan baris', () => {
    const result = normalizeImportRow({ Nama: 'LIA', Catatan: 'apa saja', Keterangan: 'x' })
    expect(result).toEqual({
      data: {
        nama: 'LIA',
        jenisKelamin: '',
        tanggalLahir: '',
        tanggalUkur: '',
        bb: null,
        pbTb: null,
        caraUkur: '',
        kodeAnak: undefined,
      },
    })
  })

  it('nilai tak dikenal diteruskan apa adanya supaya zod yang menolak dengan pesan jelas', () => {
    const result = normalizeImportRow({ Nama: 'LIA', 'Jenis Kelamin': 'X', 'Cara Ukur': 'duduk' })
    expect(result).toMatchObject({ data: { jenisKelamin: 'X', caraUkur: 'DUDUK' } })
  })
})

describe('kunci pengelompokan anak', () => {
  it('kunci dari baris impor sama dengan kunci dari baris tabel children', () => {
    // Kalau kedua rumus ini berbeda, impor akan membuat anak duplikat.
    const fromImport = childGroupKey({ nama: '  Lia ', jenisKelamin: 'P', tanggalLahir: '2026-01-14' })
    const fromRow = childGroupKeyFromRow({ name: 'lia', gender: 'P', dateOfBirth: '2026-01-14' })
    expect(fromImport).toBe(fromRow)
  })

  it('nama dibandingkan tanpa memandang huruf besar-kecil dan spasi tepi', () => {
    expect(childGroupKey({ nama: 'LIA', jenisKelamin: 'P', tanggalLahir: '2026-01-14' })).toBe(
      childGroupKey({ nama: 'lia', jenisKelamin: 'P', tanggalLahir: '2026-01-14' }),
    )
  })

  it('jenis kelamin atau tanggal lahir berbeda menghasilkan kunci berbeda', () => {
    const a = childGroupKey({ nama: 'LIA', jenisKelamin: 'P', tanggalLahir: '2026-01-14' })
    const b = childGroupKey({ nama: 'LIA', jenisKelamin: 'L', tanggalLahir: '2026-01-14' })
    const c = childGroupKey({ nama: 'LIA', jenisKelamin: 'P', tanggalLahir: '2026-01-15' })
    expect(new Set([a, b, c]).size).toBe(3)
  })
})
