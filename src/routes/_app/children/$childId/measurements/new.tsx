import { createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { getChildFn } from '~/api/children'
import { MeasurementForm } from '~/components/measurement-form'
import { Alert } from '~/components/ui'
import { formatDate, formatGender } from '~/lib/format'

export const Route = createFileRoute('/_app/children/$childId/measurements/new')({
  loader: async ({ params }) => {
    const result = await getChildFn({ data: { childId: Number(params.childId) } })
    if (!result.ok) throw notFound()
    return result.data.child
  },
  component: NewMeasurementPage,
})

function NewMeasurementPage() {
  const child = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Tambah Pengukuran</h1>
        <p className="mt-0.5 text-xs text-muted">
          {child.name} · {formatGender(child.gender)} · lahir {formatDate(child.dateOfBirth)}
        </p>
      </header>

      <Alert tone="info" title="Cara pengukuran menentukan koreksi">
        Anak usia 24 bulan atau kurang dirujuk ke tabel Panjang Badan (PB) dan diukur berbaring.
        Di atas 24 bulan dirujuk ke tabel Tinggi Badan (TB) dan diukur berdiri. Bila tidak sesuai,
        aplikasi menambahkan atau mengurangi 0.7 cm secara otomatis dan menampilkan peringatan.
      </Alert>

      <MeasurementForm
        childId={child.id}
        onCancel={() => navigate({ to: '/children/$childId', params: { childId: String(child.id) } })}
        onSaved={async () => {
          await router.invalidate()
          await navigate({ to: '/children/$childId', params: { childId: String(child.id) } })
        }}
      />
    </div>
  )
}
