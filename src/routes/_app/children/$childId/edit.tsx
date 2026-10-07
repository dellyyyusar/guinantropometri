import { createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getChildFn, updateChildFn } from '~/api/children'
import { ChildForm } from '~/components/child-form'
import { Alert } from '~/components/ui'
import type { ChildInput } from '~/validators/schemas'

export const Route = createFileRoute('/_app/children/$childId/edit')({
  loader: async ({ params }) => {
    const result = await getChildFn({ data: { childId: Number(params.childId) } })
    if (!result.ok) throw notFound()
    return result.data
  },
  component: EditChildPage,
})

function EditChildPage() {
  const { child } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const updateChild = useServerFn(updateChildFn)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const defaults: ChildInput = {
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Ubah Data Anak</h1>
        <p className="mt-0.5 text-xs text-muted">
          Perubahan tanggal lahir atau jenis kelamin akan mengubah hasil perhitungan pengukuran yang
          sudah tercatat.
        </p>
      </header>

      <ChildForm
        defaultValues={defaults}
        submitLabel="Simpan Perubahan"
        serverMessage={serverMessage}
        onCancel={() => navigate({ to: '/children/$childId', params: { childId: String(child.id) } })}
        onSubmit={async (values) => {
          setServerMessage(null)
          const result = await updateChild({ data: { ...values, childId: child.id } })
          if (!result.ok) {
            setServerMessage(result.message)
            return { ok: false, message: result.message, fieldErrors: result.fieldErrors }
          }
          await router.invalidate()
          await navigate({ to: '/children/$childId', params: { childId: String(child.id) } })
          return { ok: true }
        }}
      />

      <Alert tone="risk" title="Perhatian">
        Mengubah tanggal lahir membuat z-score pengukuran lama tidak lagi cocok dengan umur yang
        tersimpan. Jalankan ulang pengukuran bila tanggal lahir memang salah input.
      </Alert>
    </div>
  )
}
