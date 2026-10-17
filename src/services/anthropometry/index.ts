import type { Gender, Indicator, MeasurementMethod } from '~/db/schema'
import { calculateAge, usesInfantTable, type Age } from './age'
import { detectAnomaly, detectZScoreWarnings, type ClinicalWarning, type ValidationIssue, type PreviousMeasurement } from './anomaly'
import { calculateBmi } from './bmi'
import { correctLengthHeight, type CorrectedLengthHeight } from './correction'
import {
  lookupByAgeMonth,
  lookupByLengthHeight,
  type ReferenceIndex,
  type ReferenceRow,
} from './reference'
import {
  getBmiForAgeStatus,
  getLengthHeightForAgeStatus,
  getOverallStatus,
  getWeightForAgeStatus,
  getWeightForLengthHeightStatus,
  STATUS_UNCOMPUTABLE,
  STATUS_REFERENCE_MISSING,
} from './status'
import {
  DEFAULT_ZSCORE_METHOD,
  calculateZScore,
  type ZScoreMethod,
  type ZScoreResult,
} from './zscore'

export const CALCULATION_VERSION = 'permenkes-2-2020/v1'

export type MeasurementInput = {
  dateOfBirth: string
  measurementDate: string
  weightKg: number
  rawLengthHeightCm: number | null
  measurementMethod: MeasurementMethod
  gender: Gender
  previous?: PreviousMeasurement | null
}

export type IndicatorResult = {
  zScore: number | null
  status: string
  referenceFound: boolean
  method: ZScoreMethod
  /** Kode tabel referensi yang dipakai, null bila referensi tidak ditemukan. */
  indicator: Indicator | null
  /** Sumber resmi, untuk penelusuran hasil (audit). */
  sourceTable: string | null
  /** Kunci baris referensi: bulan penuh atau cm. */
  referenceKey: number | null
}

export type CalculationResult = {
  age: Age | null
  correctedLengthHeight: CorrectedLengthHeight | null
  bmi: number | null
  weightForAge: IndicatorResult
  lengthHeightForAge: IndicatorResult
  weightForLengthHeight: IndicatorResult
  bmiForAge: IndicatorResult
  overallStatus: string
  /** VALIDATION ERROR: kalau tidak kosong, data tidak boleh disimpan. */
  errors: ValidationIssue[]
  /** CLINICAL WARNING: data boleh disimpan, tampilkan ke petugas. */
  warnings: ClinicalWarning[]
  calculationVersion: string
}

function emptyIndicator(method: ZScoreMethod, referenceFound: boolean): IndicatorResult {
  const status = referenceFound ? STATUS_UNCOMPUTABLE : STATUS_REFERENCE_MISSING
  return {
    zScore: null,
    status,
    referenceFound,
    method,
    indicator: null,
    sourceTable: null,
    referenceKey: null,
  }
}

function evaluate(
  value: number | null,
  row: ReferenceRow | null,
  indicator: Indicator,
  referenceKey: number | null,
  method: ZScoreMethod,
  statusFn: (z: number | null, options?: { referenceFound?: boolean }) => string,
): IndicatorResult {
  if (value === null || !Number.isFinite(value)) {
    return { ...emptyIndicator(method, true), status: statusFn(null) }
  }
  if (row === null) {
    return {
      ...emptyIndicator(method, false),
      status: statusFn(null, { referenceFound: false }),
    }
  }

  const z: ZScoreResult = calculateZScore({
    value,
    minus3: row.minus3Sd,
    minus2: row.minus2Sd,
    minus1: row.minus1Sd,
    median: row.median,
    plus1: row.plus1Sd,
    plus2: row.plus2Sd,
    plus3: row.plus3Sd,
    lms: row.l !== null && row.m !== null && row.s !== null ? { l: row.l, m: row.m, s: row.s } : null,
    method,
  })

  return {
    zScore: z.zScore,
    status: statusFn(z.zScore, { referenceFound: z.referenceFound }),
    referenceFound: z.referenceFound,
    method: z.method,
    indicator,
    sourceTable: row.sourceTable,
    referenceKey,
  }
}

/**
 * Satu pintu masuk seluruh perhitungan antropometri Permenkes 2/2020.
 * Route/server function memanggil ini; komponen React tidak boleh menghitung sendiri.
 */
export function calculateAll(
  input: MeasurementInput,
  index: ReferenceIndex,
  options?: { method?: ZScoreMethod },
): CalculationResult {
  const method = options?.method ?? DEFAULT_ZSCORE_METHOD

  let age: Age | null = null
  try {
    age = calculateAge(input.dateOfBirth, input.measurementDate)
  } catch {
    age = null
  }

  const anomalyInput = { ...input, previous: input.previous ?? null }

  if (age === null || age.outOfRange) {
    const blocked = detectAnomaly(anomalyInput, age)
    return {
      age,
      correctedLengthHeight: null,
      bmi: null,
      weightForAge: emptyIndicator(method, true),
      lengthHeightForAge: emptyIndicator(method, true),
      weightForLengthHeight: emptyIndicator(method, true),
      bmiForAge: emptyIndicator(method, true),
      overallStatus: getOverallStatus([]),
      errors: blocked.errors,
      warnings: blocked.warnings,
      calculationVersion: CALCULATION_VERSION,
    }
  }

  const corrected =
    input.rawLengthHeightCm !== null && Number.isFinite(input.rawLengthHeightCm) && input.rawLengthHeightCm > 0
      ? correctLengthHeight({
          rawLengthHeightCm: input.rawLengthHeightCm,
          measurementMethod: input.measurementMethod,
          completedMonths: age.completedMonths,
        })
      : null

  const bmi = corrected === null ? null : calculateBmi(input.weightKg, corrected.correctedLengthHeightCm)

  const infant = usesInfantTable(age)
  const month = age.completedMonths

  const lhfaIndicator: Indicator = infant ? 'PB_U' : 'TB_U'
  const wlhIndicator: Indicator = infant ? 'BB_PB' : 'BB_TB'
  const bmiIndicator: Indicator = infant ? 'IMT_U_PB' : 'IMT_U_TB'

  const weightForAge = evaluate(
    input.weightKg,
    lookupByAgeMonth(index, 'BB_U', input.gender, month),
    'BB_U',
    month,
    method,
    getWeightForAgeStatus,
  )

  const lengthHeightForAge = evaluate(
    corrected?.correctedLengthHeightCm ?? null,
    lookupByAgeMonth(index, lhfaIndicator, input.gender, month),
    lhfaIndicator,
    month,
    method,
    getLengthHeightForAgeStatus,
  )

  const weightForLengthHeight = evaluate(
    corrected === null ? null : input.weightKg,
    corrected === null ? null : lookupByLengthHeight(index, wlhIndicator, input.gender, corrected.correctedLengthHeightCm),
    wlhIndicator,
    corrected?.correctedLengthHeightCm ?? null,
    method,
    getWeightForLengthHeightStatus,
  )

  const bmiForAge = evaluate(
    bmi,
    lookupByAgeMonth(index, bmiIndicator, input.gender, month),
    bmiIndicator,
    month,
    method,
    getBmiForAgeStatus,
  )

  // Peringatan berbasis z-score ikut dihitung sebelum ringkasan "data tidak wajar"
  // diputuskan, supaya contoh BB 2 kg + PB 80 cm pada bayi 2 bulan benar-benar terdeteksi.
  const { errors, warnings } = detectAnomaly(
    anomalyInput,
    age,
    detectZScoreWarnings({
      weightForAge: weightForAge.zScore,
      lengthHeightForAge: lengthHeightForAge.zScore,
      weightForLengthHeight: weightForLengthHeight.zScore,
      bmiForAge: bmiForAge.zScore,
    }),
  )

  return {
    age,
    correctedLengthHeight: corrected,
    bmi,
    weightForAge,
    lengthHeightForAge,
    weightForLengthHeight,
    bmiForAge,
    overallStatus: getOverallStatus([
      weightForAge.status,
      lengthHeightForAge.status,
      weightForLengthHeight.status,
      bmiForAge.status,
    ]),
    errors,
    warnings,
    calculationVersion: CALCULATION_VERSION,
  }
}

export * from './age'
export * from './anomaly'
export * from './bmi'
export * from './correction'
export * from './reference'
export * from './status'
export * from './zscore'

/**
 * AnthropometryService - antarmuka yang dipakai lapisan server.
 * Objek tipis di atas fungsi murni; dibuat supaya pemanggil tidak perlu tahu
 * urutan age -> correction -> bmi -> z-score -> status -> anomaly.
 */
export const AnthropometryService = {
  calculateAge,
  correctLengthHeight,
  calculateBMI: calculateBmi,
  calculateWeightForAge: (
    weightKg: number,
    gender: Gender,
    month: number,
    index: ReferenceIndex,
    method: ZScoreMethod = DEFAULT_ZSCORE_METHOD,
  ) =>
    evaluate(
      weightKg,
      lookupByAgeMonth(index, 'BB_U', gender, month),
      'BB_U',
      month,
      method,
      getWeightForAgeStatus,
    ),
  calculateLengthHeightForAge: (
    cm: number,
    gender: Gender,
    month: number,
    index: ReferenceIndex,
    method: ZScoreMethod = DEFAULT_ZSCORE_METHOD,
  ) => {
    const indicator: Indicator = month <= 24 ? 'PB_U' : 'TB_U'
    return evaluate(cm, lookupByAgeMonth(index, indicator, gender, month), indicator, month, method, getLengthHeightForAgeStatus)
  },
  calculateWeightForLengthHeight: (
    weightKg: number,
    cm: number,
    gender: Gender,
    month: number,
    index: ReferenceIndex,
    method: ZScoreMethod = DEFAULT_ZSCORE_METHOD,
  ) => {
    const indicator: Indicator = month <= 24 ? 'BB_PB' : 'BB_TB'
    return evaluate(weightKg, lookupByLengthHeight(index, indicator, gender, cm), indicator, cm, method, getWeightForLengthHeightStatus)
  },
  calculateBMIForAge: (
    bmi: number,
    gender: Gender,
    month: number,
    index: ReferenceIndex,
    method: ZScoreMethod = DEFAULT_ZSCORE_METHOD,
  ) => {
    const indicator: Indicator = month <= 24 ? 'IMT_U_PB' : 'IMT_U_TB'
    return evaluate(bmi, lookupByAgeMonth(index, indicator, gender, month), indicator, month, method, getBmiForAgeStatus)
  },
  calculateAll,
  detectAnomaly,
}

