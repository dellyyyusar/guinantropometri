import { describe, expect, it } from 'vitest'
import { calculateAge, formatAge } from './age'
import { calculateBmi } from './bmi'
import { LENGTH_HEIGHT_OFFSET_CM, correctLengthHeight, round2 } from './correction'
import {
  getBmiForAgeStatus,
  getLengthHeightForAgeStatus,
  getOverallStatus,
  getWeightForAgeStatus,
  getWeightForLengthHeightStatus,
} from './status'
import { calculateZScore, interpolateZScore, lmsZScore } from './zscore'

describe('calculateAge', () => {
  it('umur 0 bulan', () => {
    const age = calculateAge('2026-01-14', '2026-01-14')
    expect(age).toMatchObject({ years: 0, months: 0, days: 0, completedMonths: 0, outOfRange: false })
    expect(formatAge(age)).toBe('0 hari')
  })

  it('umur 9 bulan (contoh LIA: lahir 14-01-2026, ukur 14-10-2026)', () => {
    const age = calculateAge('2026-01-14', '2026-10-14')
    expect(age).toMatchObject({ years: 0, months: 9, days: 0, completedMonths: 9, outOfRange: false })
    expect(formatAge(age)).toBe('9 bulan 0 hari')
  })

  it('umur 24 bulan', () => {
    const age = calculateAge('2024-05-10', '2026-05-10')
    expect(age).toMatchObject({ years: 2, months: 0, days: 0, completedMonths: 24, outOfRange: false })
  })

  it('umur 60 bulan tepat masih di dalam rentang', () => {
    const age = calculateAge('2021-03-01', '2026-03-01')
    expect(age).toMatchObject({ years: 5, months: 0, days: 0, completedMonths: 60, outOfRange: false })
  })

  it('usia > 60 bulan ditandai outOfRange', () => {
    const age = calculateAge('2021-01-01', '2026-03-01')
    expect(age.completedMonths).toBe(62)
    expect(age.outOfRange).toBe(true)
    expect(age.totalMonths).toBeGreaterThan(60)
  })

  it('tanggal lahir > tanggal ukur melempar error', () => {
    expect(() => calculateAge('2026-10-14', '2026-01-14')).toThrow(RangeError)
  })

  it('tanggal lahir 31 Januari di-clamp ke akhir bulan yang lebih pendek', () => {
    const age = calculateAge('2026-01-31', '2026-03-01')
    expect(age).toMatchObject({ years: 0, months: 1, days: 1, completedMonths: 1 })
  })

  it('sehari sebelum ulang bulan tidak membulatkan ke atas', () => {
    const age = calculateAge('2026-01-14', '2026-10-13')
    expect(age).toMatchObject({ completedMonths: 8, days: 29 })
  })

  it('tanggal kabisat 29 Februari', () => {
    const age = calculateAge('2024-02-29', '2025-02-28')
    expect(age.completedMonths).toBe(12)
  })

  it('format tanggal tidak valid ditolak', () => {
    expect(() => calculateAge('14-01-2026', '2026-10-14')).toThrow(/YYYY-MM-DD/)
    expect(() => calculateAge('2026-02-30', '2026-10-14')).toThrow(/Tanggal tidak valid/)
  })
})

describe('correctLengthHeight', () => {
  it('standing pada usia <= 24 bulan: +0.7 cm, dirujuk sebagai PB', () => {
    const r = correctLengthHeight({ rawLengthHeightCm: 60, measurementMethod: 'STANDING', completedMonths: 9 })
    expect(r.correctedLengthHeightCm).toBeCloseTo(60 + LENGTH_HEIGHT_OFFSET_CM, 10)
    expect(r.appliedCm).toBe(0.7)
    expect(r.kind).toBe('PB')
  })

  it('lying pada usia <= 24 bulan: tanpa koreksi', () => {
    const r = correctLengthHeight({ rawLengthHeightCm: 61, measurementMethod: 'LYING', completedMonths: 9 })
    expect(r.correctedLengthHeightCm).toBe(61)
    expect(r.appliedCm).toBe(0)
    expect(r.kind).toBe('PB')
  })

  it('lying pada usia > 24 bulan: -0.7 cm, dirujuk sebagai TB', () => {
    const r = correctLengthHeight({ rawLengthHeightCm: 95, measurementMethod: 'LYING', completedMonths: 36 })
    expect(r.correctedLengthHeightCm).toBeCloseTo(95 - LENGTH_HEIGHT_OFFSET_CM, 10)
    expect(r.appliedCm).toBe(-0.7)
    expect(r.kind).toBe('TB')
  })

  it('standing pada usia > 24 bulan: tanpa koreksi', () => {
    const r = correctLengthHeight({ rawLengthHeightCm: 95, measurementMethod: 'STANDING', completedMonths: 36 })
    expect(r.correctedLengthHeightCm).toBe(95)
    expect(r.kind).toBe('TB')
  })

  it('tepat 24 bulan masuk cabang bayi (<= 24)', () => {
    const r = correctLengthHeight({ rawLengthHeightCm: 87, measurementMethod: 'STANDING', completedMonths: 24 })
    expect(r.correctedLengthHeightCm).toBeCloseTo(87.7, 10)
    expect(r.kind).toBe('PB')
  })
})

describe('calculateBmi', () => {
  it('6.8 kg / 61 cm -> 18.27', () => {
    expect(calculateBmi(6.8, 61)).toBe(18.27)
  })

  it('mengembalikan null untuk input tidak valid', () => {
    expect(calculateBmi(0, 61)).toBeNull()
    expect(calculateBmi(-6, 61)).toBeNull()
    expect(calculateBmi(6.8, 0)).toBeNull()
    expect(calculateBmi(Number.NaN, 61)).toBeNull()
  })
})

const CUT = {
  minus3: 2.1,
  minus2: 2.5,
  minus1: 2.9,
  median: 3.3,
  plus1: 3.9,
  plus2: 4.4,
  plus3: 5.0,
}

describe('calculateZScore (piecewise interpolation)', () => {
  it('tepat di median -> 0', () => {
    expect(calculateZScore({ value: 3.3, ...CUT })).toEqual({
      zScore: 0,
      method: 'piecewise_interpolation',
      referenceFound: true,
    })
  })

  it('tepat di tiap cutpoint SD', () => {
    expect(calculateZScore({ value: 2.1, ...CUT }).zScore).toBe(-3)
    expect(calculateZScore({ value: 2.5, ...CUT }).zScore).toBe(-2)
    expect(calculateZScore({ value: 2.9, ...CUT }).zScore).toBe(-1)
    expect(calculateZScore({ value: 3.9, ...CUT }).zScore).toBe(1)
    expect(calculateZScore({ value: 4.4, ...CUT }).zScore).toBe(2)
    expect(calculateZScore({ value: 5.0, ...CUT }).zScore).toBe(3)
  })

  it('interpolasi di dalam segmen', () => {
    expect(calculateZScore({ value: 2.3, ...CUT }).zScore).toBeCloseTo(-2.5, 10)
    expect(calculateZScore({ value: 4.15, ...CUT }).zScore).toBeCloseTo(1.5, 10)
  })

  it('nilai di atas +3SD diekstrapolasi, TIDAK dipatok ke +3', () => {
    const z = calculateZScore({ value: 6.0, ...CUT }).zScore
    expect(z).not.toBeNull()
    expect(z!).toBeGreaterThan(3)
    expect(z!).toBeCloseTo(4.67, 2)
  })

  it('nilai di bawah -3SD diekstrapolasi, TIDAK dipatok ke -3', () => {
    const z = calculateZScore({ value: 1.5, ...CUT }).zScore
    expect(z!).toBeLessThan(-3)
    expect(z!).toBeCloseTo(-4.5, 2)
  })

  it('input tidak hingga -> null, bukan 0', () => {
    expect(calculateZScore({ value: Number.NaN, ...CUT }).zScore).toBeNull()
    expect(calculateZScore({ value: Number.POSITIVE_INFINITY, ...CUT }).zScore).toBeNull()
  })

  it('pembulatan half-away-from-zero deterministik meski ada debu floating point', () => {
    // 6.8 kg pada BB/U perempuan bulan 9 menghasilkan z matematis tepat -1.625,
    // yang di memori bisa menjadi -1.6249999999999996. Harus selalu -1.63.
    const cut = { minus3: 5.8, minus2: 6.5, minus1: 7.3, median: 8.2, plus1: 9.3, plus2: 10.5, plus3: 12 }
    expect(calculateZScore({ value: 6.8, ...cut }).zScore).toBe(-1.63)
    expect(round2(-1.625)).toBe(-1.63)
    expect(round2(1.625)).toBe(1.63)
    expect(round2(-0.004)).toBe(0)
  })

  it('segmen degeneratif tidak menghasilkan NaN', () => {
    const flat = {
      minus3Sd: 5, minus2Sd: 5, minus1Sd: 5, median: 5, plus1Sd: 5, plus2Sd: 5, plus3Sd: 5,
    }
    expect(interpolateZScore(5, flat)).toBe(-3)
    expect(interpolateZScore(4, flat)).toBeNull()
    expect(interpolateZScore(6, flat)).toBeNull()
  })
})

describe('lmsZScore', () => {
  it('L != 0 memakai bentuk pangkat', () => {
    // LMS BB/U laki-laki bulan ke-0 (WHO): nilai tepat di M -> z = 0
    expect(lmsZScore(3.3464, { l: 0.3487, m: 3.3464, s: 0.14602 })).toBeCloseTo(0, 10)
    expect(lmsZScore(4.4, { l: 0.3487, m: 3.3464, s: 0.14602 })!).toBeCloseTo(2, 1)
  })

  it('L == 0 memakai bentuk logaritmik', () => {
    const z = lmsZScore(10 * Math.exp(0.2), { l: 0, m: 10, s: 0.1 })
    expect(z!).toBeCloseTo(2, 10)
  })

  it('input tidak valid -> null', () => {
    expect(lmsZScore(0, { l: 0.3, m: 10, s: 0.1 })).toBeNull()
    expect(lmsZScore(-1, { l: 0.3, m: 10, s: 0.1 })).toBeNull()
    expect(lmsZScore(10, { l: 0.3, m: 0, s: 0.1 })).toBeNull()
    expect(lmsZScore(10, { l: 0.3, m: 10, s: 0 })).toBeNull()
  })

  it('method lms bisa dipilih lewat calculateZScore', () => {
    const r = calculateZScore({ value: 3.3464, ...CUT, lms: { l: 0.3487, m: 3.3464, s: 0.14602 }, method: 'lms' })
    expect(r.method).toBe('lms')
    expect(r.zScore).toBe(0)
  })
})

describe('getWeightForAgeStatus (BB/U)', () => {
  it('Z < -3', () => expect(getWeightForAgeStatus(-3.01)).toBe('Berat badan sangat kurang'))
  it('Z = -3', () => expect(getWeightForAgeStatus(-3)).toBe('Berat badan kurang'))
  it('-3 < Z < -2', () => expect(getWeightForAgeStatus(-2.5)).toBe('Berat badan kurang'))
  it('Z = -2', () => expect(getWeightForAgeStatus(-2)).toBe('Berat badan normal'))
  it('-2 < Z < +1', () => expect(getWeightForAgeStatus(0.5)).toBe('Berat badan normal'))
  it('Z = +1', () => expect(getWeightForAgeStatus(1)).toBe('Berat badan normal'))
  it('Z > +1', () => expect(getWeightForAgeStatus(1.01)).toBe('Risiko berat badan lebih'))
  it('Z > +3 tetap "Risiko berat badan lebih"', () =>
    expect(getWeightForAgeStatus(4.2)).toBe('Risiko berat badan lebih'))
  it('Z null', () => expect(getWeightForAgeStatus(null)).toBe('Data tidak dapat dihitung'))
  it('Z null karena referensi hilang', () =>
    expect(getWeightForAgeStatus(null, { referenceFound: false })).toBe('Referensi tidak tersedia'))
})

describe('getLengthHeightForAgeStatus (PB/U, TB/U)', () => {
  it('Z < -3', () => expect(getLengthHeightForAgeStatus(-3.5)).toBe('Sangat pendek'))
  it('Z = -3', () => expect(getLengthHeightForAgeStatus(-3)).toBe('Pendek'))
  it('-3 < Z < -2', () => expect(getLengthHeightForAgeStatus(-2.1)).toBe('Pendek'))
  it('Z = -2', () => expect(getLengthHeightForAgeStatus(-2)).toBe('Normal'))
  it('-2 < Z < +3', () => expect(getLengthHeightForAgeStatus(0)).toBe('Normal'))
  it('Z = +3', () => expect(getLengthHeightForAgeStatus(3)).toBe('Normal'))
  it('Z > +3', () => expect(getLengthHeightForAgeStatus(3.01)).toBe('Tinggi'))
})

describe('getWeightForLengthHeightStatus (BB/PB, BB/TB) dan getBmiForAgeStatus (IMT/U)', () => {
  for (const fn of [getWeightForLengthHeightStatus, getBmiForAgeStatus]) {
    it(`${fn.name}: Z < -3`, () => expect(fn(-3.01)).toBe('Gizi buruk'))
    it(`${fn.name}: Z = -3`, () => expect(fn(-3)).toBe('Gizi kurang'))
    it(`${fn.name}: -3 < Z < -2`, () => expect(fn(-2.5)).toBe('Gizi kurang'))
    it(`${fn.name}: Z = -2`, () => expect(fn(-2)).toBe('Gizi baik'))
    it(`${fn.name}: -2 < Z < +1`, () => expect(fn(0)).toBe('Gizi baik'))
    it(`${fn.name}: Z = +1`, () => expect(fn(1)).toBe('Gizi baik'))
    it(`${fn.name}: +1 < Z <= +2`, () => {
      expect(fn(1.01)).toBe('Berisiko gizi lebih')
      expect(fn(2)).toBe('Berisiko gizi lebih')
    })
    it(`${fn.name}: +2 < Z <= +3`, () => {
      expect(fn(2.01)).toBe('Gizi lebih')
      expect(fn(3)).toBe('Gizi lebih')
    })
    it(`${fn.name}: Z > +3`, () => expect(fn(3.01)).toBe('Obesitas'))
  }
})

describe('getOverallStatus', () => {
  it('semua normal', () =>
    expect(getOverallStatus(['Berat badan normal', 'Normal', 'Gizi baik', 'Gizi baik'])).toBe('Normal'))
  it('ada yang perlu perhatian menang atas risiko', () =>
    expect(getOverallStatus(['Berat badan normal', 'Pendek', 'Berisiko gizi lebih', 'Gizi baik'])).toBe(
      'Perlu perhatian lebih lanjut',
    ))
  it('risiko saja', () =>
    expect(getOverallStatus(['Berat badan normal', 'Normal', 'Berisiko gizi lebih', 'Gizi baik'])).toBe('Risiko'))
  it('ada indeks yang tidak bisa dihitung', () =>
    expect(getOverallStatus(['Berat badan normal', 'Data tidak dapat dihitung', null, 'Gizi baik'])).toBe(
      'Data tidak lengkap',
    ))
  it('tidak ada data sama sekali', () => expect(getOverallStatus([])).toBe('Data tidak lengkap'))
})
