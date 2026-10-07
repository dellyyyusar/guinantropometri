import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from '~/auth/session'
import { guard, parseOrThrow } from '~/lib/api'
import * as service from '~/services/measurements'
import { measurementSchema } from '~/validators/schemas'

const newMeasurementSchema = measurementSchema.extend({ childId: z.number().int().positive() })
const updateMeasurementSchema = measurementSchema.extend({ measurementId: z.number().int().positive() })
const measurementIdSchema = z.object({ measurementId: z.number().int().positive() })

/**
 * Pratinjau perhitungan untuk form input.
 * Sengaja lewat server: klien tidak pernah menghitung z-score sendiri, sehingga
 * angka yang dilihat petugas saat mengetik identik dengan yang tersimpan.
 */
export const previewMeasurementFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => parseOrThrow(newMeasurementSchema, input))
  .handler(async ({ data: { childId, ...input } }) =>
    guard(async () => {
      await requireUser()
      return service.previewMeasurement(childId, input)
    }),
  )

export const createMeasurementFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(newMeasurementSchema, input))
  .handler(async ({ data: { childId, ...input } }) =>
    guard(async () => {
      const user = await requireUser()
      return service.createMeasurement(childId, input, user.id)
    }),
  )

export const updateMeasurementFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(updateMeasurementSchema, input))
  .handler(async ({ data: { measurementId, ...input } }) =>
    guard(async () => {
      const user = await requireUser()
      return service.updateMeasurement(measurementId, input, user.id)
    }),
  )

export const deleteMeasurementFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseOrThrow(measurementIdSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      const user = await requireUser()
      await service.deleteMeasurement(data.measurementId, user.id)
      return { deleted: true }
    }),
  )
