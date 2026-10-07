import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from '~/auth/session'
import { guard, parseOrThrow } from '~/lib/api'
import { getDashboardStats, getMeasurementTrend } from '~/services/dashboard'
import {
  CHART_SERIES_KEYS,
  getChartSeriesCombined,
  type ChartSeriesKey,
} from '~/services/reference-cache'

const chartSeriesSchema = z.object({
  key: z.enum(CHART_SERIES_KEYS),
  gender: z.enum(['L', 'P'] as const),
})

export const dashboardFn = createServerFn({ method: 'GET' }).handler(async () =>
  guard(async () => {
    await requireUser()
    const [stats, trend] = await Promise.all([getDashboardStats(), getMeasurementTrend(12)])
    return { stats, trend }
  }),
)

/** Pita -3SD..+3SD standar Permenkes untuk grafik pertumbuhan. */
export const chartSeriesFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => parseOrThrow(chartSeriesSchema, input))
  .handler(async ({ data }) =>
    guard(async () => {
      await requireUser()
      return getChartSeriesCombined(data.key as ChartSeriesKey, data.gender)
    }),
  )
