import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from '~/auth/session'
import type { AnthropometricResult, Child, Gender, Measurement, MeasurementMethod } from '~/db/schema'
import { guard, parseOrThrow } from '~/lib/api'
import * as service from '~/services/children'
import { childFiltersSchema, childSchema } from '~/validators/schemas'

const childIdSchema = z.object({ childId: z.number().int().positive() })
const updateChildSchema = childSchema.extend({ childId: z.number().int().positive() })

export type ChildDto = {
  id: number
  childCode: string
  name: string
  gender: Gender
  dateOfBirth: string
  birthWeight: number | null
  birthLength: number | null
  motherName: string | null
  fatherName: string | null
  address: string | null
  notes: string | null
}

export type ResultDto = {
  weightForAgeZ: number | null
  weightForAgeStatus: string
  lengthHeightForAgeZ: number | null
  lengthHeightForAgeStatus: string
  weightForLengthHeightZ: number | null
  weightForLengthHeightStatus: string
  bmiForAgeZ: number | null
  bmiForAgeStatus: string
  overallStatus: string
  calculationVersion: string
}

export type MeasurementDto = {
  id: number
  measurementDate: string
  weightKg: number
  rawLengthHeightCm: number | null
  measurementMethod: MeasurementMethod
  correctedLengthHeightCm: number | null
  ageYear: number
  ageMonth: number
  ageDay: number
  ageTotalMonths: number
  bmi: number | null
  notes: string | null
  result: ResultDto | null
}

export type ChildDetailDto = { child: ChildDto; measurements: MeasurementDto[] }

function toChildDto(child: Child): ChildDto {
  return {
    id: child.id,
    childCode: child.childCode,
    name: child.name,
    gender: child.gender,
    dateOfBirth: child.dateOfBirth,
    birthWeight: child.birthWeight,
    birthLength: child.birthLength,
    motherName: child.motherName,
    fatherName: child.fatherName,
    address: child.address,
    notes: child.notes,
  }
}

function toResultDto(result: AnthropometricResult): ResultDto {
  return {
    weightForAgeZ: result.weightForAgeZ,
    weightForAgeStatus: result.weightForAgeStatus,
    lengthHeightForAgeZ: result.lengthHeightForAgeZ,
    lengthHeightForAgeStatus: result.lengthHeightForAgeStatus,
    weightForLengthHeightZ: result.weightForLengthHeightZ,
    weightForLengthHeightStatus: result.weightForLengthHeightStatus,
    bmiForAgeZ: result.bmiForAgeZ,
    bmiForAgeStatus: result.bmiForAgeStatus,
    overallStatus: result.overallStatus,
    calculationVersion: result.calculationVersion,
  }
}

function toMeasurementDto(row: { measurement: Measurement; result: AnthropometricResult | null }): MeasurementDto {
  const m = row.measurement
  return {
    id: m.id,
    measurementDate: m.measurementDate,
    weightKg: m.weightKg,
    rawLengthHeightCm: m.rawLengthHeightCm,
    measurementMethod: m.measurementMethod,
    correctedLengthHeightCm: m.correctedLengthHeightCm,
    ageYear: m.ageYear,
    ageMonth: m.ageMonth,
    ageDay: m.ageDay,
    ageTotalMonths: m.ageTotalMonths,
    bmi: m.bmi,
    notes: m.notes,
    result: row.result === null ? null : toResultDto(row.result),
  }
}

export const listChildrenFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => parseOrThrow(childFiltersSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      await requireUser()
      const page = await service.listChildren(data)
      return { ...page, rows: page.rows }
    }),
  )

export const suggestChildCodeFn = createServerFn({ method: 'GET' }).handler(async () =>
  guard(async () => {
    await requireUser()
    return service.suggestChildCode()
  }),
)

/** Daftar ringkas seluruh anak untuk dropdown (filter, ekspor, pilihan anak). */
export const childOptionsFn = createServerFn({ method: 'GET' }).handler(async () =>
  guard(async () => {
    await requireUser()
    return service.listChildOptions()
  }),
)

export const getChildFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => parseOrThrow(childIdSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      await requireUser()
      const detail = await service.getChildDetail(data.childId)
      return {
        child: toChildDto(detail.child),
        measurements: detail.measurements.map(toMeasurementDto),
      } satisfies ChildDetailDto
    }),
  )

export const createChildFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(childSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      const user = await requireUser()
      return toChildDto(await service.createChild(data, user.id))
    }),
  )

export const updateChildFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(updateChildSchema, input))
  .handler(async ({ data: { childId, ...input } }) =>
    guard(async () => {
      const user = await requireUser()
      return toChildDto(await service.updateChild(childId, input, user.id))
    }),
  )

export const deleteChildFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(childIdSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      const user = await requireUser()
      await service.deleteChild(data.childId, user.id)
      return { deleted: true }
    }),
  )

