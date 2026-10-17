import type { Gender, MeasurementMethod } from '~/db/schema'
import { MAX_AGE_MONTHS, calculateAge, dateFromIso, parseDateString, type Age } from './age'
import { calculateBmi } from './bmi'
import { correctLengthHeight } from './correction'

export type ValidationIssue = { field: string; code: string; message: string }
export type ClinicalWarning = { code: string; message: string }

export type AnomalyResult = {
  /** Data TIDAK boleh disimpan. */
  errors: ValidationIssue[]
  /** Data boleh disimpan, tetapi tampilkan peringatan ke petugas. */
  warnings: ClinicalWarning[]
}

export type PreviousMeasurement = {
  measurementDate: string
  weightKg: number
  correctedLengthHeightCm: number | null
}

export type AnomalyInput = {
  dateOfBirth: string
  measurementDate: string
  weightKg: number
  rawLengthHeightCm: number | null
  measurementMethod: MeasurementMethod
  gender: Gender
  previous?: PreviousMeasurement | null
}

// Batas absolut yang longgar: hanya menangkap data yang jelas mustahil, bukan anak yang
// memang berada di ekor distribusi. Naikkan/turunkan bila populasi layanan berbeda.
export const WEIGHT_MIN_KG = 0.8
export const WEIGHT_MAX_KG = 40
export const LENGTH_MIN_CM = 35
export const LENGTH_MAX_CM = 140
export const BMI_MIN = 8
export const BMI_MAX = 30

// Laju tumbuh yang dianggap tidak wajar antar dua pengukuran berurutan.
export const WEIGHT_GAIN_MAX_KG_PER_MONTH = 2
export const LENGTH_GAIN_MAX_CM_PER_MONTH = 5
export const WEIGHT_LOSS_TOLERANCE_KG = 0.05
export const LENGTH_LOSS_TOLERANCE_CM = 0.2
/** Di bawah interval ini laju per bulan terlalu berisik, hanya cek arah (turun/naik). */
const MIN_MONTHS_FOR_RATE = 0.5

export const ANOMALY_WARNING_MESSAGE =
  'Data pengukuran terlihat tidak wajar. Silakan periksa kembali berat/panjang badan dan tanggal lahir.'

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((dateFromIso(toIso).getTime() - dateFromIso(fromIso).getTime()) / 86_400_000)
}

/**
 * VALIDATION ERROR - kalau ada satu saja, pengukuran tidak boleh disimpan.
 */
export function validateMeasurement(input: AnomalyInput): ValidationIssue[] {
  const errors: ValidationIssue[] = []

  const birthIso = input.dateOfBirth
  const measureIso = input.measurementDate
  try {
    parseDateString(birthIso)
    parseDateString(measureIso)
  } catch (err) {
    errors.push({
      field: 'measurementDate',
      code: 'INVALID_DATE',
      message: err instanceof Error ? err.message : 'Format tanggal tidak valid.',
    })
    return errors
  }

  if (measureIso < birthIso) {
    errors.push({
      field: 'measurementDate',
      code: 'DATE_BEFORE_BIRTH',
      message: `Tanggal pengukuran (${measureIso}) tidak boleh sebelum tanggal lahir (${birthIso}).`,
    })
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    errors.push({ field: 'weightKg', code: 'WEIGHT_NOT_POSITIVE', message: 'Berat badan harus lebih dari 0 kg.' })
  } else if (input.weightKg < WEIGHT_MIN_KG || input.weightKg > WEIGHT_MAX_KG) {
    errors.push({
      field: 'weightKg',
      code: 'WEIGHT_OUT_OF_RANGE',
      message: `Berat badan ${input.weightKg} kg di luar rentang wajar ${WEIGHT_MIN_KG}-${WEIGHT_MAX_KG} kg untuk anak 0-${MAX_AGE_MONTHS} bulan.`,
    })
  }

  if (input.rawLengthHeightCm !== null) {
    const cm = input.rawLengthHeightCm
    if (!Number.isFinite(cm) || cm <= 0) {
      errors.push({ field: 'rawLengthHeightCm', code: 'LENGTH_NOT_POSITIVE', message: 'Panjang/tinggi badan harus lebih dari 0 cm.' })
    } else if (cm < LENGTH_MIN_CM || cm > LENGTH_MAX_CM) {
      errors.push({
        field: 'rawLengthHeightCm',
        code: 'LENGTH_OUT_OF_RANGE',
        message: `Panjang/tinggi badan ${cm} cm di luar rentang wajar ${LENGTH_MIN_CM}-${LENGTH_MAX_CM} cm untuk anak 0-${MAX_AGE_MONTHS} bulan.`,
      })
    }
  }

  if (!errors.some((e) => e.code === 'DATE_BEFORE_BIRTH')) {
    let age: Age
    try {
      age = calculateAge(input.dateOfBirth, input.measurementDate)
    } catch (err) {
      errors.push({
        field: 'measurementDate',
        code: 'INVALID_AGE',
        message: err instanceof Error ? err.message : 'Umur tidak dapat dihitung.',
      })
      return errors
    }
    if (age.outOfRange) {
      errors.push({
        field: 'measurementDate',
        code: 'AGE_OUT_OF_RANGE',
        message: `Umur ${age.totalMonths.toFixed(1)} bulan melewati rentang standar antropometri 0-${MAX_AGE_MONTHS} bulan.`,
      })
    }
  }

  return errors
}

/**
 * CLINICAL WARNING - data tetap boleh disimpan, tetapi petugas harus melihat peringatannya.
 */
export function clinicalWarnings(input: AnomalyInput, age: Age | null): ClinicalWarning[] {
  const warnings: ClinicalWarning[] = []

  if (age !== null) {
    const infant = age.completedMonths <= 24
    if (infant && input.measurementMethod === 'STANDING') {
      warnings.push({
        code: 'METHOD_STANDING_INFANT',
        message: `Anak berusia ${age.completedMonths} bulan diukur berdiri. Standar menganjurkan berbaring untuk usia <= 24 bulan; hasil dikoreksi +0.7 cm.`,
      })
    }
    if (!infant && input.measurementMethod === 'LYING') {
      warnings.push({
        code: 'METHOD_LYING_OLDER',
        message: `Anak berusia ${age.completedMonths} bulan diukur berbaring. Standar menganjurkan berdiri untuk usia > 24 bulan; hasil dikoreksi -0.7 cm.`,
      })
    }
  }

  if (age !== null && input.rawLengthHeightCm !== null && Number.isFinite(input.rawLengthHeightCm) && input.rawLengthHeightCm > 0) {
    const { correctedLengthHeightCm } = correctLengthHeight({
      rawLengthHeightCm: input.rawLengthHeightCm,
      measurementMethod: input.measurementMethod,
      completedMonths: age.completedMonths,
    })
    const bmi = calculateBmi(input.weightKg, correctedLengthHeightCm)
    if (bmi !== null && (bmi < BMI_MIN || bmi > BMI_MAX)) {
      warnings.push({
        code: 'BMI_OUT_OF_RANGE',
        message: `IMT ${bmi.toFixed(1)} kg/m² di luar rentang wajar ${BMI_MIN}-${BMI_MAX}. Periksa kembali berat dan panjang/tinggi badan.`,
      })
    }
    const ratio = input.weightKg / correctedLengthHeightCm
    if (ratio > 0.35 || ratio < 0.015) {
      warnings.push({
        code: 'WEIGHT_LENGTH_MISMATCH',
        message: `Kombinasi berat ${input.weightKg} kg dan panjang/tinggi ${correctedLengthHeightCm} cm tidak lazim untuk usia ${age.completedMonths} bulan.`,
      })
    }
  }

  const previous = input.previous
  if (previous) {
    const intervalDays = daysBetween(previous.measurementDate, input.measurementDate)
    const intervalMonths = intervalDays / 30.4375

    const weightDelta = input.weightKg - previous.weightKg
    if (weightDelta < -WEIGHT_LOSS_TOLERANCE_KG) {
      warnings.push({
        code: 'WEIGHT_LOSS',
        message: `Berat badan turun ${Math.abs(weightDelta).toFixed(2)} kg dibanding pengukuran ${previous.measurementDate}.`,
      })
    } else if (intervalMonths >= MIN_MONTHS_FOR_RATE && weightDelta / intervalMonths > WEIGHT_GAIN_MAX_KG_PER_MONTH) {
      warnings.push({
        code: 'WEIGHT_GAIN_EXTREME',
        message: `Kenaikan berat ${(weightDelta / intervalMonths).toFixed(2)} kg/bulan melebihi ${WEIGHT_GAIN_MAX_KG_PER_MONTH} kg/bulan.`,
      })
    }

    const previousCm = previous.correctedLengthHeightCm
    if (input.rawLengthHeightCm !== null && previousCm !== null && previousCm > 0) {
      const lengthDelta = input.rawLengthHeightCm - previousCm
      if (lengthDelta < -LENGTH_LOSS_TOLERANCE_CM) {
        warnings.push({
          code: 'LENGTH_LOSS',
          message: `Panjang/tinggi badan menyusut ${Math.abs(lengthDelta).toFixed(1)} cm dibanding pengukuran ${previous.measurementDate}.`,
        })
      } else if (intervalMonths >= MIN_MONTHS_FOR_RATE && lengthDelta / intervalMonths > LENGTH_GAIN_MAX_CM_PER_MONTH) {
        warnings.push({
          code: 'LENGTH_GAIN_EXTREME',
          message: `Pertambahan panjang/tinggi ${(lengthDelta / intervalMonths).toFixed(1)} cm/bulan melebihi ${LENGTH_GAIN_MAX_CM_PER_MONTH} cm/bulan.`,
        })
      }
    }

    if (intervalDays < 0) {
      warnings.push({
        code: 'MEASUREMENT_ORDER',
        message: `Tanggal pengukuran lebih awal dari pengukuran sebelumnya (${previous.measurementDate}).`,
      })
    }
  }

  return warnings
}

/** Peringatan untuk nilai yang jauh di luar tabel referensi (|Z| > 3). */
export function detectZScoreWarnings(zScores: Record<string, number | null>): ClinicalWarning[] {
  const LABELS: Record<string, string> = {
    weightForAge: 'BB/U',
    lengthHeightForAge: 'PB/U atau TB/U',
    weightForLengthHeight: 'BB/PB atau BB/TB',
    bmiForAge: 'IMT/U',
  }
  const warnings: ClinicalWarning[] = []
  for (const [key, label] of Object.entries(LABELS)) {
    const z = zScores[key]
    if (typeof z === 'number' && Math.abs(z) > 3) {
      warnings.push({
        code: 'Z_BEYOND_3SD',
        message: `Nilai ${label} berada di luar rentang -3SD sampai +3SD (Z = ${z.toFixed(2)}). Kemungkinan ada kesalahan pengukuran, pencatatan, atau tanggal lahir.`,
      })
    }
  }
  return warnings
}

/**
 * Gabungan validasi + peringatan klinis.
 * `age` null berarti umur tidak bisa dihitung (mis. tanggal pengukuran sebelum lahir),
 * sehingga pemeriksaan yang bergantung umur dilewati dan error tanggal sudah cukup.
 * `extraWarnings` dipakai pemanggil untuk menyertakan peringatan berbasis z-score
 * sebelum ringkasan "data tidak wajar" diputuskan.
 */
export function detectAnomaly(
  input: AnomalyInput,
  age: Age | null,
  extraWarnings: readonly ClinicalWarning[] = [],
): AnomalyResult {
  const errors = validateMeasurement(input)
  const warnings = [...clinicalWarnings(input, age), ...extraWarnings]
  if (warnings.length >= 2) {
    warnings.push({ code: 'SUSPICIOUS_MEASUREMENT', message: ANOMALY_WARNING_MESSAGE })
  }
  return { errors, warnings }
}
