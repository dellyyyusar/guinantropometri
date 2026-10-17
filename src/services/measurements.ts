import { and, desc, eq, lt } from 'drizzle-orm'
import { getDb } from '~/db'
import {
  anthropometricResults,
  children,
  measurements,
  type AnthropometricResult,
  type Measurement,
} from '~/db/schema'
import { AppError, ValidationError } from '~/lib/errors'
import {
  calculateAll,
  round2,
  type CalculationResult,
  type MeasurementInput,
  type PreviousMeasurement,
} from '~/services/anthropometry'
import type { MeasurementInputSchema } from '~/validators/schemas'
import { writeAuditLog } from './audit'
import { getReferenceIndex } from './reference-cache'

export type MeasurementRow = {
  measurement: Measurement
  result: AnthropometricResult | null
}

/** Pengukuran terakhir SEBELUM tanggal tertentu - dasar perbandingan dan deteksi anomali. */
export async function getPreviousMeasurement(
  childId: number,
  beforeDate: string,
): Promise<PreviousMeasurement | null> {
  const [row] = await getDb()
    .select()
    .from(measurements)
    .where(and(eq(measurements.childId, childId), lt(measurements.measurementDate, beforeDate)))
    .orderBy(desc(measurements.measurementDate), desc(measurements.id))
    .limit(1)

  if (row === undefined) return null
  return {
    measurementDate: row.measurementDate,
    weightKg: row.weightKg,
    correctedLengthHeightCm: row.correctedLengthHeightCm,
  }
}

export type ChildForCalculation = { gender: MeasurementInput['gender']; dateOfBirth: string; name: string }

export async function loadChild(childId: number): Promise<ChildForCalculation & { id: number }> {
  const [child] = await getDb()
    .select({
      id: children.id,
      name: children.name,
      gender: children.gender,
      dateOfBirth: children.dateOfBirth,
    })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1)
  if (child === undefined) throw new AppError('CHILD_NOT_FOUND', 'Data anak tidak ditemukan.')
  return child
}

/**
 * Hitung ulang tanpa menyimpan. Dipakai form input supaya pratinjau z-score
 * datang dari mesin yang sama persis dengan yang menulis ke database -
 * klien tidak pernah menghitung sendiri.
 */
export async function previewMeasurement(
  childId: number,
  input: MeasurementInputSchema,
): Promise<CalculationResult> {
  const child = await loadChild(childId)
  const [index, previous] = await Promise.all([
    getReferenceIndex(),
    getPreviousMeasurement(childId, input.measurementDate),
  ])

  return calculateAll(
    {
      dateOfBirth: child.dateOfBirth,
      measurementDate: input.measurementDate,
      weightKg: input.weightKg,
      rawLengthHeightCm: input.rawLengthHeightCm ?? null,
      measurementMethod: input.measurementMethod,
      gender: child.gender,
      previous,
    },
    index,
  )
}

/** VALIDATION ERROR diubah jadi exception: data tidak boleh masuk database. */
function assertNoErrors(calc: CalculationResult): void {
  if (calc.errors.length === 0) return
  const fieldErrors: Record<string, string> = {}
  for (const issue of calc.errors) fieldErrors[issue.field] ??= issue.message
  throw new ValidationError(calc.errors[0]!.message, fieldErrors)
}

export function resultValues(calc: CalculationResult) {
  return {
    weightForAgeZ: calc.weightForAge.zScore,
    weightForAgeStatus: calc.weightForAge.status,
    lengthHeightForAgeZ: calc.lengthHeightForAge.zScore,
    lengthHeightForAgeStatus: calc.lengthHeightForAge.status,
    weightForLengthHeightZ: calc.weightForLengthHeight.zScore,
    weightForLengthHeightStatus: calc.weightForLengthHeight.status,
    bmiForAgeZ: calc.bmiForAge.zScore,
    bmiForAgeStatus: calc.bmiForAge.status,
    overallStatus: calc.overallStatus,
    calculationVersion: calc.calculationVersion,
  }
}

export function measurementValues(childId: number, input: MeasurementInputSchema, calc: CalculationResult, userId: number) {
  const age = calc.age
  if (age === null) throw new AppError('AGE_UNAVAILABLE', 'Umur tidak dapat dihitung dari tanggal lahir dan tanggal ukur.')
  return {
    childId,
    measurementDate: input.measurementDate,
    weightKg: input.weightKg,
    rawLengthHeightCm: input.rawLengthHeightCm ?? null,
    measurementMethod: input.measurementMethod,
    correctedLengthHeightCm: calc.correctedLengthHeight?.correctedLengthHeightCm ?? null,
    ageYear: age.years,
    ageMonth: age.months,
    ageDay: age.days,
    ageTotalMonths: round2(age.totalMonths),
    bmi: calc.bmi,
    notes: input.notes ?? null,
    createdBy: userId,
    updatedBy: userId,
  }
}

export type SaveMeasurementResult = {
  measurementId: number
  calculation: CalculationResult
}

export async function createMeasurement(
  childId: number,
  input: MeasurementInputSchema,
  userId: number,
): Promise<SaveMeasurementResult> {
  const calc = await previewMeasurement(childId, input)
  assertNoErrors(calc)

  const db = getDb()
  let measurementId: number | undefined

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(measurements)
      .values(measurementValues(childId, input, calc, userId))
      .$returningId()
    measurementId = inserted?.id
    if (measurementId === undefined) throw new AppError('INSERT_FAILED', 'Gagal menyimpan pengukuran.')

    await tx.insert(anthropometricResults).values({
      measurementId,
      ...resultValues(calc),
    })

    await writeAuditLog(
      {
        userId,
        entity: 'measurement',
        entityId: measurementId,
        action: 'CREATE',
        newData: { measurement: input, result: resultValues(calc) },
      },
      tx,
    )
  })

  return { measurementId: measurementId!, calculation: calc }
}

export async function updateMeasurement(
  measurementId: number,
  input: MeasurementInputSchema,
  userId: number,
): Promise<SaveMeasurementResult> {
  const db = getDb()

  const [before] = await db
    .select({ measurement: measurements, result: anthropometricResults })
    .from(measurements)
    .leftJoin(anthropometricResults, eq(anthropometricResults.measurementId, measurements.id))
    .where(eq(measurements.id, measurementId))
    .limit(1)
  if (before === undefined) throw new AppError('MEASUREMENT_NOT_FOUND', 'Pengukuran tidak ditemukan.')

  const childId = before.measurement.childId
  const calc = await previewMeasurement(childId, input)
  assertNoErrors(calc)

  await db.transaction(async (tx) => {
    await tx.update(measurements).set(measurementValues(childId, input, calc, userId)).where(eq(measurements.id, measurementId))

    if (before.result === null) {
      await tx.insert(anthropometricResults).values({ measurementId, ...resultValues(calc) })
    } else {
      await tx.update(anthropometricResults).set(resultValues(calc)).where(eq(anthropometricResults.measurementId, measurementId))
    }

    await writeAuditLog(
      {
        userId,
        entity: 'measurement',
        entityId: measurementId,
        action: 'UPDATE',
        oldData: before,
        newData: { measurement: input, result: resultValues(calc) },
      },
      tx,
    )
  })

  return { measurementId, calculation: calc }
}

export async function deleteMeasurement(measurementId: number, userId: number): Promise<void> {
  const db = getDb()

  const [before] = await db
    .select({ measurement: measurements, result: anthropometricResults })
    .from(measurements)
    .leftJoin(anthropometricResults, eq(anthropometricResults.measurementId, measurements.id))
    .where(eq(measurements.id, measurementId))
    .limit(1)
  if (before === undefined) throw new AppError('MEASUREMENT_NOT_FOUND', 'Pengukuran tidak ditemukan.')

  await db.transaction(async (tx) => {
    // FK ON DELETE CASCADE menghapus anthropometric_results.
    await tx.delete(measurements).where(eq(measurements.id, measurementId))
    await writeAuditLog(
      { userId, entity: 'measurement', entityId: measurementId, action: 'DELETE', oldData: before },
      tx,
    )
  })
}
