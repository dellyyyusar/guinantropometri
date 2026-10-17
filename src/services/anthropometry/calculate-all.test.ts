import { beforeAll, describe, expect, it } from 'vitest'
import type { Gender, Indicator } from '~/db/schema'
import { assertReferenceRowsComplete, loadReferenceRows } from '~/db/reference-source'
import {
  ANOMALY_WARNING_MESSAGE,
  AnthropometryService,
  CALCULATION_VERSION,
  buildReferenceIndex,
  calculateAll,
  getReferenceSeries,
  lookupByAgeMonth,
  lookupByLengthHeight,
  type MeasurementInput,
  type ReferenceIndex,
} from './index'

const DATA_DIR = './data/raw'

let index: ReferenceIndex

beforeAll(() => {
  const rows = loadReferenceRows(DATA_DIR)
  assertReferenceRowsComplete(rows)
  index = buildReferenceIndex(rows)
})

const lia: MeasurementInput = {
  dateOfBirth: '2026-01-14',
  measurementDate: '2026-10-14',
  weightKg: 6.8,
  rawLengthHeightCm: 61,
  measurementMethod: 'LYING',
  gender: 'P',
}

describe('tabel referensi Permenkes 2/2020', () => {
  it('14 tabel lengkap dengan jumlah baris yang benar', () => {
    const expected: readonly (readonly [Indicator, Gender, number])[] = [
      ['BB_U', 'L', 61], ['PB_U', 'L', 25], ['TB_U', 'L', 37], ['BB_PB', 'L', 131],
      ['BB_TB', 'L', 111], ['IMT_U_PB', 'L', 25], ['IMT_U_TB', 'L', 37],
      ['BB_U', 'P', 61], ['PB_U', 'P', 25], ['TB_U', 'P', 37], ['BB_PB', 'P', 131],
      ['BB_TB', 'P', 111], ['IMT_U_PB', 'P', 25], ['IMT_U_TB', 'P', 37],
    ]
    for (const [indicator, gender, count] of expected) {
      expect(getReferenceSeries(index, indicator, gender), `${indicator} ${gender}`).toHaveLength(count)
    }
  })

  it('nilai BB/U perempuan bulan ke-9 cocok dengan tabel tercetak', () => {
    const row = lookupByAgeMonth(index, 'BB_U', 'P', 9)
    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      minus3Sd: 5.8, minus2Sd: 6.5, minus1Sd: 7.3, median: 8.2, plus1Sd: 9.3, plus2Sd: 10.5, plus3Sd: 12,
      sourceTable: 'Tabel 8 - BB/U Perempuan 0-60 bulan',
    })
    expect(row!.sourceDocument).toContain('Nomor 2 Tahun 2020')
  })

  it('PB/U dan TB/U bulan ke-24 berbeda 0.7 cm (koreksi berbaring/berdiri)', () => {
    expect(lookupByAgeMonth(index, 'PB_U', 'L', 24)!.median).toBe(87.8)
    expect(lookupByAgeMonth(index, 'TB_U', 'L', 24)!.median).toBe(87.1)
  })

  it('BB/PB diinterpolasi antar baris 0.5 cm', () => {
    const exact = lookupByLengthHeight(index, 'BB_PB', 'P', 61)!
    const mid = lookupByLengthHeight(index, 'BB_PB', 'P', 61.25)!
    expect(exact.median).toBe(6.1)
    expect(mid.median).toBeCloseTo((6.1 + 6.3) / 2, 10)
  })

  it('di luar rentang tabel mengembalikan null, bukan baris terdekat', () => {
    expect(lookupByLengthHeight(index, 'BB_PB', 'L', 120)).toBeNull()
    expect(lookupByLengthHeight(index, 'BB_PB', 'L', 44.5)).toBeNull()
    expect(lookupByAgeMonth(index, 'BB_U', 'L', 61)).toBeNull()
    expect(lookupByAgeMonth(index, 'TB_U', 'L', 23)).toBeNull()
  })
})

describe('calculateAll - kasus LIA (P, lahir 14-01-2026, ukur 14-10-2026, BB 6.8, PB 61, berbaring)', () => {
  it('menghitung umur, koreksi, IMT, dan empat indeks', () => {
    const r = calculateAll(lia, index)

    expect(r.errors).toEqual([])
    expect(r.calculationVersion).toBe(CALCULATION_VERSION)

    expect(r.age).toMatchObject({ years: 0, months: 9, days: 0, completedMonths: 9 })
    expect(r.correctedLengthHeight).toMatchObject({ correctedLengthHeightCm: 61, appliedCm: 0, kind: 'PB' })
    expect(r.bmi).toBe(18.27)

    expect(r.weightForAge).toMatchObject({ zScore: -1.63, status: 'Berat badan normal', indicator: 'BB_U', referenceKey: 9 })
    expect(r.lengthHeightForAge).toMatchObject({ status: 'Sangat pendek', indicator: 'PB_U', referenceKey: 9 })
    expect(r.lengthHeightForAge.zScore!).toBeCloseTo(-3.79, 2)
    expect(r.weightForLengthHeight).toMatchObject({ zScore: 1.14, status: 'Berisiko gizi lebih', indicator: 'BB_PB' })
    expect(r.bmiForAge).toMatchObject({ zScore: 0.98, status: 'Gizi baik', indicator: 'IMT_U_PB', referenceKey: 9 })

    expect(r.overallStatus).toBe('Perlu perhatian lebih lanjut')
    expect(r.weightForAge.sourceTable).toContain('Tabel 8')
  })
})

describe('calculateAll - pemilihan tabel mengikuti umur', () => {
  it('usia > 24 bulan memakai TB_U, BB_TB, IMT_U_TB', () => {
    const r = calculateAll(
      {
        dateOfBirth: '2023-01-15',
        measurementDate: '2026-01-15',
        weightKg: 14.5,
        rawLengthHeightCm: 96,
        measurementMethod: 'STANDING',
        gender: 'L',
      },
      index,
    )
    expect(r.age!.completedMonths).toBe(36)
    expect(r.correctedLengthHeight!.kind).toBe('TB')
    expect(r.bmi).toBe(15.73)
    expect(r.lengthHeightForAge.indicator).toBe('TB_U')
    expect(r.weightForLengthHeight.indicator).toBe('BB_TB')
    expect(r.bmiForAge.indicator).toBe('IMT_U_TB')
    expect(r.errors).toEqual([])
  })
})

describe('calculateAll - referensi tidak tersedia', () => {
  it('menghasilkan zScore null dan status "Referensi tidak tersedia", tanpa fallback angka', () => {
    const r = calculateAll(
      {
        dateOfBirth: '2025-01-01',
        measurementDate: '2026-09-01',
        weightKg: 12,
        rawLengthHeightCm: 115,
        measurementMethod: 'LYING',
        gender: 'L',
      },
      index,
    )
    expect(r.errors).toEqual([])
    expect(r.weightForLengthHeight.zScore).toBeNull()
    expect(r.weightForLengthHeight.referenceFound).toBe(false)
    expect(r.weightForLengthHeight.status).toBe('Referensi tidak tersedia')
    // Indeks lain tetap terhitung, tidak ikut menjadi null.
    expect(r.weightForAge.referenceFound).toBe(true)
  })

  it('panjang/tinggi tidak diukur: indeks bergantung panjang tidak dapat dihitung', () => {
    const r = calculateAll(
      {
        dateOfBirth: '2026-01-14',
        measurementDate: '2026-10-14',
        weightKg: 6.8,
        rawLengthHeightCm: null,
        measurementMethod: 'LYING',
        gender: 'P',
      },
      index,
    )
    expect(r.correctedLengthHeight).toBeNull()
    expect(r.bmi).toBeNull()
    expect(r.weightForAge.zScore).toBe(-1.63)
    expect(r.lengthHeightForAge.status).toBe('Data tidak dapat dihitung')
    expect(r.weightForLengthHeight.status).toBe('Data tidak dapat dihitung')
    expect(r.bmiForAge.status).toBe('Data tidak dapat dihitung')
    expect(r.overallStatus).toBe('Data tidak lengkap')
  })
})

describe('calculateAll - VALIDATION ERROR (data tidak boleh disimpan)', () => {
  it('tanggal lahir > tanggal ukur', () => {
    const r = calculateAll({ ...lia, dateOfBirth: '2026-11-01' }, index)
    expect(r.errors.map((e) => e.code)).toContain('DATE_BEFORE_BIRTH')
    expect(r.age).toBeNull()
    expect(r.weightForAge.zScore).toBeNull()
    expect(r.overallStatus).toBe('Data tidak lengkap')
  })

  it('usia > 60 bulan', () => {
    const r = calculateAll({ ...lia, dateOfBirth: '2020-01-14' }, index)
    expect(r.errors.map((e) => e.code)).toContain('AGE_OUT_OF_RANGE')
    expect(r.weightForAge.zScore).toBeNull()
    expect(r.weightForAge.status).not.toBe('Referensi tidak tersedia')
  })

  it('berat badan <= 0', () => {
    const r = calculateAll({ ...lia, weightKg: 0 }, index)
    expect(r.errors.map((e) => e.code)).toContain('WEIGHT_NOT_POSITIVE')
  })

  it('panjang badan <= 0', () => {
    const r = calculateAll({ ...lia, rawLengthHeightCm: -5 }, index)
    expect(r.errors.map((e) => e.code)).toContain('LENGTH_NOT_POSITIVE')
  })

  it('berat badan mustahil (2 kg bukan error, 0.5 kg error)', () => {
    expect(calculateAll({ ...lia, weightKg: 2 }, index).errors).toEqual([])
    expect(calculateAll({ ...lia, weightKg: 0.5 }, index).errors.map((e) => e.code)).toContain('WEIGHT_OUT_OF_RANGE')
  })
})

describe('calculateAll - CLINICAL WARNING (data boleh disimpan)', () => {
  it('BB 2 kg + PB 80 cm pada usia 2 bulan memicu peringatan data tidak wajar', () => {
    const r = calculateAll(
      {
        dateOfBirth: '2026-01-14',
        measurementDate: '2026-03-14',
        weightKg: 2,
        rawLengthHeightCm: 80,
        measurementMethod: 'LYING',
        gender: 'L',
      },
      index,
    )
    expect(r.errors).toEqual([])
    const codes = r.warnings.map((w) => w.code)
    expect(codes).toContain('BMI_OUT_OF_RANGE')
    expect(codes).toContain('Z_BEYOND_3SD')
    expect(codes).toContain('SUSPICIOUS_MEASUREMENT')
    expect(r.warnings.find((w) => w.code === 'SUSPICIOUS_MEASUREMENT')!.message).toBe(ANOMALY_WARNING_MESSAGE)
  })

  it('cara ukur tidak sesuai usia diberi peringatan, bukan ditolak', () => {
    const infantStanding = calculateAll({ ...lia, measurementMethod: 'STANDING' }, index)
    expect(infantStanding.errors).toEqual([])
    expect(infantStanding.warnings.map((w) => w.code)).toContain('METHOD_STANDING_INFANT')
    expect(infantStanding.correctedLengthHeight!.correctedLengthHeightCm).toBe(61.7)

    const olderLying = calculateAll(
      { ...lia, dateOfBirth: '2023-01-14', rawLengthHeightCm: 96, measurementMethod: 'LYING' },
      index,
    )
    expect(olderLying.warnings.map((w) => w.code)).toContain('METHOD_LYING_OLDER')
    expect(olderLying.correctedLengthHeight!.correctedLengthHeightCm).toBe(95.3)
  })

  it('penurunan berat dan panjang dibanding pengukuran sebelumnya', () => {
    const r = calculateAll(
      {
        ...lia,
        previous: { measurementDate: '2026-09-14', weightKg: 7.4, correctedLengthHeightCm: 63 },
      },
      index,
    )
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.code)).toContain('WEIGHT_LOSS')
    expect(r.warnings.map((w) => w.code)).toContain('LENGTH_LOSS')
  })

  it('kenaikan berat yang wajar tidak memicu peringatan', () => {
    const r = calculateAll(
      {
        ...lia,
        weightKg: 7.1,
        rawLengthHeightCm: 61.5,
        previous: { measurementDate: '2026-09-14', weightKg: 6.8, correctedLengthHeightCm: 61 },
      },
      index,
    )
    const codes = r.warnings.map((w) => w.code)
    expect(codes).not.toContain('WEIGHT_LOSS')
    expect(codes).not.toContain('WEIGHT_GAIN_EXTREME')
    expect(codes).not.toContain('LENGTH_LOSS')
  })
})

describe('AnthropometryService', () => {
  it('menyediakan fungsi per indeks yang konsisten dengan calculateAll', () => {
    const perFn = AnthropometryService.calculateWeightForAge(6.8, 'P', 9, index)
    expect(perFn).toMatchObject(calculateAll(lia, index).weightForAge)

    expect(AnthropometryService.calculateBMI(6.8, 61)).toBe(18.27)
    expect(AnthropometryService.calculateAge('2026-01-14', '2026-10-14').completedMonths).toBe(9)
    expect(AnthropometryService.correctLengthHeight({
      rawLengthHeightCm: 60, measurementMethod: 'STANDING', completedMonths: 9,
    }).correctedLengthHeightCm).toBe(60.7)
  })

  it('metode LMS menghasilkan z-score searah dengan piecewise interpolation', () => {
    const piecewise = calculateAll(lia, index, { method: 'piecewise_interpolation' })
    const lms = calculateAll(lia, index, { method: 'lms' })
    for (const key of ['weightForAge', 'lengthHeightForAge', 'weightForLengthHeight', 'bmiForAge'] as const) {
      expect(lms[key].method).toBe('lms')
      expect(lms[key].zScore!).toBeCloseTo(piecewise[key].zScore!, 0)
      expect(lms[key].status).toBe(piecewise[key].status)
    }
  })
})
