import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { createChildFn, suggestChildCodeFn } from '~/api/children'
import { ChildForm } from '~/components/child-form'
import { Alert } from '~/components/ui'
import { DEFAULT_CHILD_FILTERS } from '~/lib/search-defaults'
import type { ChildInput } from '~/validators/schemas'

export const Route = createFileRoute('/_app/children/new')({
  loader: async () => ({ suggestedCode: await suggestChildCodeFn() }),
  component: NewChildPage,
})

function NewChildPage() {
  const { suggestedCode } = Route.useLoaderData()
  const navigate = useNavigate()
  const createChild = useServerFn(createChildFn)
  const [serverMessage, setServerMessage] = useState<string | null>(
    suggestedCode.ok ? null : suggestedCode.message,
  )

  const defaults: ChildInput = {
    childCode: suggestedCode.ok ? suggestedCode.data : '',
    name: '',
    gender: 'L',
    dateOfBirth: '',
    birthWeight: null,
    birthLength: null,
    motherName: null,
    fatherName: null,
    address: null,
    notes: null,
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Tambah Anak</h1>
        <p className="mt-0.5 text-xs text-muted">
          Data ini menjadi dasar perhitungan umur pada setiap pengukuran.
        </p>
      </header>

      <ChildForm
        defaultValues={defaults}
        submitLabel="Simpan Anak"
        serverMessage={serverMessage}
        onCancel={() => navigate({ to: '/children', search: DEFAULT_CHILD_FILTERS })}
        onSubmit={async (values) => {
          setServerMessage(null)
          const result = await createChild({ data: values })
          if (!result.ok) {
            setServerMessage(result.message)
            return { ok: false, message: result.message, fieldErrors: result.fieldErrors }
          }
          await navigate({
            to: '/children/$childId',
            params: { childId: String(result.data.id) },
          })
          return { ok: true }
        }}
      />

      <Alert tone="info" title="Catatan">
        Perhitungan status antropometri baru muncul setelah pengukuran pertama dicatat untuk anak
        ini.
      </Alert>
    </div>
  )
}
