import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type DefaultValues } from 'react-hook-form'
import type { z } from 'zod'
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from './ui'
import { childSchema, type ChildInput } from '~/validators/schemas'

/**
 * Skema memakai z.preprocess (kolom kosong -> null), jadi tipe MASUKAN zod
 * (kolom numerik bertipe unknown sebelum diparse) berbeda dari tipe KELUARAN.
 * Form diarahkan pada tipe masukan, dan onSubmit menerima tipe keluaran yang
 * sudah bersih - pemisahan ini yang membuat zodResolver cocok tanpa cast.
 */
type ChildFormValues = z.input<typeof childSchema>

export type ChildFormProps = {
  defaultValues: ChildFormValues
  onSubmit: (values: ChildInput) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>
  submitLabel: string
  onCancel: () => void
  serverMessage?: string | null
  extraActions?: React.ReactNode
}

export function ChildForm({
  defaultValues,
  onSubmit,
  submitLabel,
  onCancel,
  serverMessage,
  extraActions,
}: ChildFormProps) {
  const form = useForm<ChildFormValues, unknown, ChildInput>({
    resolver: zodResolver(childSchema),
    defaultValues: defaultValues as DefaultValues<ChildFormValues>,
  })

  async function handleSubmit(values: ChildInput) {
    const result = await onSubmit(values)
    if (result.ok) return
    if (result.fieldErrors !== undefined) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        // Kesalahan dari server (mis. kode anak sudah dipakai) ditempelkan
        // ke kolom yang tepat supaya pengguna tahu harus mengubah apa.
        form.setError(field as keyof ChildFormValues, { type: 'server', message })
      }
    }
  }

  const errors = form.formState.errors

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
      {serverMessage !== null && serverMessage !== undefined ? (
        <Alert tone="attention" title={serverMessage} />
      ) : null}

      <Card>
        <CardHeader title="Identitas anak" description="Kolom bertanda bintang wajib diisi." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Kode Anak" required error={errors.childCode?.message}>
            <Input
              placeholder="ANK-00001"
              autoComplete="off"
              invalid={errors.childCode !== undefined}
              {...form.register('childCode')}
            />
          </Field>

          <Field label="Nama Anak" required error={errors.name?.message}>
            <Input
              placeholder="Nama lengkap anak"
              autoComplete="off"
              invalid={errors.name !== undefined}
              {...form.register('name')}
            />
          </Field>

          <Field label="Jenis Kelamin" required error={errors.gender?.message}>
            <Select invalid={errors.gender !== undefined} {...form.register('gender')}>
              <option value="">Pilih jenis kelamin</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </Field>

          <Field label="Tanggal Lahir" required error={errors.dateOfBirth?.message}>
            <Input
              type="date"
              max="2100-12-31"
              invalid={errors.dateOfBirth !== undefined}
              {...form.register('dateOfBirth')}
            />
          </Field>

          <Field
            label="Berat Lahir (kg)"
            hint="Opsional. Contoh: 3.2"
            error={errors.birthWeight?.message}
          >
            <Input
              type="number"
              step="0.001"
              min="0.3"
              max="9.999"
              inputMode="decimal"
              invalid={errors.birthWeight !== undefined}
              {...form.register('birthWeight')}
            />
          </Field>

          <Field
            label="Panjang Lahir (cm)"
            hint="Opsional. Contoh: 49.5"
            error={errors.birthLength?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="20"
              max="70"
              inputMode="decimal"
              invalid={errors.birthLength !== undefined}
              {...form.register('birthLength')}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data orang tua dan catatan" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nama Ibu" error={errors.motherName?.message}>
            <Input autoComplete="off" {...form.register('motherName')} />
          </Field>
          <Field label="Nama Ayah" error={errors.fatherName?.message}>
            <Input autoComplete="off" {...form.register('fatherName')} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2" error={errors.address?.message}>
            <Input autoComplete="off" {...form.register('address')} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2" error={errors.notes?.message}>
            <Textarea rows={3} placeholder="Catatan tambahan (opsional)" {...form.register('notes')} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        {extraActions}
        <Button type="button" variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
