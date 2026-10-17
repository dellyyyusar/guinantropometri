import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { createMeasurementFn, previewMeasurementFn } from '~/api/measurements'
import type { Indicator } from '~/db/schema'
import { todayIso } from '~/lib/format'
import type { CalculationResult, IndicatorResult } from '~/services/anthropometry'
import { measurementSchema, type MeasurementInputSchema } from '~/validators/schemas'
import { StatusBadge, formatNumber, formatZ } from './status-badge'
import { Alert, Button, Card, CardHeader, Field, Input, Select, Spinner, Textarea } from './ui'

/** Skema memakai z.preprocess, jadi tipe masukan zod (sebelum diparse) berbeda dari keluaran. */
type MeasurementFormValues = z.input<typeof measurementSchema>

const INDICATOR_LABEL: Record<Indicator, string> = {
  BB_U: 'Berat Badan menurut Umur (BB/U)',
  PB_U: 'Panjang Badan menurut Umur (PB/U)',
  TB_U: 'Tinggi Badan menurut Umur (TB/U)',
  BB_PB: 'Berat Badan menurut Panjang Badan (BB/PB)',
  BB_TB: 'Berat Badan menurut Tinggi Badan (BB/TB)',
  IMT_U_PB: 'IMT menurut Umur (IMT/U)',
  IMT_U_TB: 'IMT menurut Umur (IMT/U)',
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Satu kartu hasil: z-score dan status untuk satu indeks. */
function ResultTile({ title, result }: { title: string; result: IndicatorResult }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tnum">
          {result.zScore === null ? '-' : formatZ(result.zScore)}
        </span>
        <span className="text-[11px] text-faint">Z-score</span>
      </div>
      <div className="mt-2">
        <StatusBadge status={result.status} />
      </div>
      {result.sourceTable !== null ? (
        <p className="mt-2 text-[10px] leading-tight text-faint">{result.sourceTable}</p>
      ) : null}
    </div>
  )
}

export function ResultTiles({ calculation }: { calculation: CalculationResult }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ResultTile title={INDICATOR_LABEL.BB_U} result={calculation.weightForAge} />
      <ResultTile
        title={
          calculation.lengthHeightForAge.indicator === null
            ? INDICATOR_LABEL.PB_U
            : INDICATOR_LABEL[calculation.lengthHeightForAge.indicator]
        }
        result={calculation.lengthHeightForAge}
      />
      <ResultTile
        title={
          calculation.weightForLengthHeight.indicator === null
            ? INDICATOR_LABEL.BB_PB
            : INDICATOR_LABEL[calculation.weightForLengthHeight.indicator]
        }
        result={calculation.weightForLengthHeight}
      />
      <ResultTile
        title={
          calculation.bmiForAge.indicator === null
            ? INDICATOR_LABEL.IMT_U_PB
            : INDICATOR_LABEL[calculation.bmiForAge.indicator]
        }
        result={calculation.bmiForAge}
      />
    </div>
  )
}

export function CalculationSummary({ calculation }: { calculation: CalculationResult }) {
  const age = calculation.age
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">Umur</dt>
        <dd className="mt-0.5 tnum">
          {age === null ? '-' : `${age.years} th ${age.months} bln ${age.days} hr`}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          {calculation.correctedLengthHeight?.kind === 'TB' ? 'TB Koreksi' : 'PB Koreksi'}
        </dt>
        <dd className="mt-0.5 tnum">
          {calculation.correctedLengthHeight === null
            ? '-'
            : `${formatNumber(calculation.correctedLengthHeight.correctedLengthHeightCm, 2)} cm`}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">IMT</dt>
        <dd className="mt-0.5 tnum">
          {calculation.bmi === null ? '-' : `${formatNumber(calculation.bmi, 2)} kg/m²`}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          Status Keseluruhan
        </dt>
        <dd className="mt-0.5">
          <StatusBadge status={calculation.overallStatus} />
        </dd>
      </div>
    </dl>
  )
}

export function MeasurementForm({
  childId,
  onSaved,
  onCancel,
}: {
  childId: number
  onSaved: () => void
  onCancel: () => void
}) {
  const preview = useServerFn(previewMeasurementFn)
  const save = useServerFn(createMeasurementFn)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const form = useForm<MeasurementFormValues, unknown, MeasurementInputSchema>({
    resolver: zodResolver(measurementSchema),
    defaultValues: {
      measurementDate: todayIso(),
      weightKg: '',
      rawLengthHeightCm: '',
      measurementMethod: 'LYING',
      notes: '',
    },
  })

  const watched = useWatch({ control: form.control })
  const debounced = useDebounced(watched, 400)

  const canPreview =
    typeof debounced.measurementDate === 'string' &&
    debounced.measurementDate.length === 10 &&
    typeof debounced.weightKg === 'number' &&
    Number.isFinite(debounced.weightKg) &&
    debounced.weightKg > 0

  // Pratinjau dihitung di server, bukan di browser: angka yang dilihat petugas
  // saat mengetik identik dengan yang nanti disimpan.
  const calculation = useQuery({
    queryKey: ['measurement-preview', childId, debounced],
    queryFn: () =>
      preview({
        data: {
          childId,
          measurementDate: String(debounced.measurementDate),
          weightKg: Number(debounced.weightKg),
          rawLengthHeightCm:
            debounced.rawLengthHeightCm === null || debounced.rawLengthHeightCm === undefined
              ? null
              : Number(debounced.rawLengthHeightCm),
          measurementMethod: debounced.measurementMethod === 'STANDING' ? 'STANDING' : 'LYING',
          notes: null,
        },
      }),
    enabled: canPreview,
  })

  const result = calculation.data
  const calc = result?.ok === true ? result.data : null
  const blockingErrors = calc?.errors ?? []

  async function handleSubmit(values: MeasurementInputSchema) {
    setServerMessage(null)
    const response = await save({ data: { ...values, childId } })
    if (!response.ok) {
      setServerMessage(response.message)
      if (response.fieldErrors !== undefined) {
        for (const [field, message] of Object.entries(response.fieldErrors)) {
          form.setError(field as keyof MeasurementFormValues, { type: 'server', message })
        }
      }
      return
    }
    onSaved()
  }

  const errors = form.formState.errors

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
      {serverMessage !== null ? <Alert tone="attention" title={serverMessage} /> : null}

      <Card>
        <CardHeader
          title="Data pengukuran"
          description="Hasil perhitungan muncul otomatis saat kolom diisi."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Tanggal Pengukuran" required error={errors.measurementDate?.message}>
            <Input
              type="date"
              max={todayIso()}
              invalid={errors.measurementDate !== undefined}
              {...form.register('measurementDate')}
            />
          </Field>

          <Field
            label="Cara Pengukuran"
            required
            hint="Berbaring untuk usia <= 24 bulan, berdiri untuk > 24 bulan."
            error={errors.measurementMethod?.message}
          >
            <Select {...form.register('measurementMethod')}>
              <option value="LYING">Berbaring (terlentang)</option>
              <option value="STANDING">Berdiri (tegak)</option>
            </Select>
          </Field>

          <Field label="Berat Badan (kg)" required error={errors.weightKg?.message}>
            <Input
              type="number"
              step="0.001"
              min="0.1"
              max="99.999"
              inputMode="decimal"
              placeholder="Contoh: 6.8"
              invalid={errors.weightKg !== undefined}
              {...form.register('weightKg', { valueAsNumber: true })}
            />
          </Field>

          <Field
            label="Panjang/Tinggi Badan (cm)"
            hint="Opsional. Bila kosong, PB/U, BB/PB, dan IMT/U tidak dapat dihitung."
            error={errors.rawLengthHeightCm?.message}
          >
            <Input
              type="number"
              step="0.1"
              min="10"
              max="250"
              inputMode="decimal"
              placeholder="Contoh: 61"
              invalid={errors.rawLengthHeightCm !== undefined}
              {...form.register('rawLengthHeightCm')}
            />
          </Field>

          <Field label="Catatan" className="sm:col-span-2" error={errors.notes?.message}>
            <Textarea rows={2} placeholder="Catatan tambahan (opsional)" {...form.register('notes')} />
          </Field>
        </div>
      </Card>

      {canPreview ? (
        <>
          {calculation.isFetching ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Menghitung…
            </p>
          ) : null}

          {result !== undefined && result.ok === false ? (
            <Alert tone="attention" title="Perhitungan gagal" children={result.message} />
          ) : null}

          {calc !== null ? (
            <>
              {blockingErrors.length > 0 ? (
                <Alert tone="attention" title="Data pengukuran tidak valid">
                  <ul className="list-inside list-disc space-y-0.5">
                    {blockingErrors.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                  Data dengan kesalahan ini tidak dapat disimpan.
                </Alert>
              ) : null}

              {calc.warnings.length > 0 ? (
                <Alert tone="risk" title="Peringatan klinis">
                  <ul className="list-inside list-disc space-y-0.5">
                    {calc.warnings.map((warning) => (
                      <li key={warning.code}>{warning.message}</li>
                    ))}
                  </ul>
                  Data tetap dapat disimpan. Peringatan ini bukan diagnosis.
                </Alert>
              ) : null}

              <Card>
                <CardHeader title="Hasil perhitungan" description="Dihitung di server." />
                <div className="p-4">
                  <CalculationSummary calculation={calc} />
                </div>
                <div className="border-t border-line p-4">
                  <ResultTiles calculation={calc} />
                </div>
                <p className="border-t border-line px-4 py-2 text-[10px] leading-relaxed text-faint">
                  {calc.calculationVersion} · Referensi {calc.weightForAge.sourceTable ?? '-'}
                </p>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <Alert tone="info" title="Isi tanggal pengukuran dan berat badan untuk melihat hasil." />
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          disabled={calc === null || blockingErrors.length > 0}
        >
          Simpan Pengukuran
        </Button>
      </div>
    </form>
  )
}
