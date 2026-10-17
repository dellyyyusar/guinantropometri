import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { listChildrenFn } from '~/api/children'
import { OverallBadge } from '~/components/status-badge'
import { Alert, Button, Card, EmptyState, Input, Pagination, Select } from '~/components/ui'
import { formatDateShort, formatGender, formatMonths } from '~/lib/format'
import { childFiltersSchema, type ChildFilters } from '~/validators/schemas'

export const Route = createFileRoute('/_app/children/')({
  validateSearch: childFiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => listChildrenFn({ data: deps satisfies ChildFilters }),
  component: ChildrenPage,
})

function ChildrenPage() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  if (!result.ok) {
    return <Alert tone="attention" title="Gagal memuat data anak" children={result.message} />
  }

  const { rows, total, page, totalPages } = result.data

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Data Anak</h1>
          <p className="mt-0.5 text-xs text-muted">
            {total} anak terdaftar pada layanan ini.
          </p>
        </div>
        <Link to="/children/new">
          <Button>Tambah Anak</Button>
        </Link>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <SearchBox
            value={search.q}
            onCommit={(q) => navigate({ search: (prev) => ({ ...prev, q, page: 1 }) })}
          />
          <div className="w-40">
            <label className="field-label" htmlFor="filter-gender">
              Jenis Kelamin
            </label>
            <Select
              id="filter-gender"
              value={search.gender}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    gender: event.target.value as ChildFilters['gender'],
                    page: 1,
                  }),
                })
              }
            >
              <option value="ALL">Semua</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada data anak"
            description={
              search.q !== '' || search.gender !== 'ALL'
                ? 'Tidak ada anak yang cocok dengan pencarian. Coba ubah kata kunci atau filter.'
                : 'Mulai dengan menambahkan data anak, lalu catat pengukurannya.'
            }
            action={
              <Link to="/children/new">
                <Button>Tambah Anak</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-head">Kode</th>
                  <th className="table-head">Nama</th>
                  <th className="table-head">Jenis Kelamin</th>
                  <th className="table-head">Tanggal Lahir</th>
                  <th className="table-head">Umur Terakhir</th>
                  <th className="table-head">Pengukuran Terakhir</th>
                  <th className="table-head">Status Terakhir</th>
                  <th className="table-head text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((child) => (
                  <tr key={child.id} className="hover:bg-line-soft/40">
                    <td className="table-cell font-mono text-xs text-muted">{child.childCode}</td>
                    <td className="table-cell font-medium">
                      <Link
                        to="/children/$childId"
                        params={{ childId: String(child.id) }}
                        className="text-primary hover:underline"
                      >
                        {child.name}
                      </Link>
                    </td>
                    <td className="table-cell">{formatGender(child.gender)}</td>
                    <td className="table-cell tnum">{formatDateShort(child.dateOfBirth)}</td>
                    <td className="table-cell tnum">
                      {child.latestMeasurementDate === null ? '-' : formatMonths(child.latestAgeMonths)}
                    </td>
                    <td className="table-cell tnum">
                      {formatDateShort(child.latestMeasurementDate)}
                    </td>
                    <td className="table-cell">
                      <OverallBadge status={child.latestOverallStatus} />
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        <Link to="/children/$childId" params={{ childId: String(child.id) }}>
                          <Button variant="secondary" size="sm">
                            Detail
                          </Button>
                        </Link>
                        <Link
                          to="/children/$childId/measurements/new"
                          params={{ childId: String(child.id) }}
                        >
                          <Button size="sm">Tambah Pengukuran</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-line px-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onChange={(next) => navigate({ search: (prev) => ({ ...prev, page: next }) })}
          />
        </div>
      </Card>
    </div>
  )
}

/** Kotak pencarian dengan debounce supaya tiap ketukan tidak memicu query baru. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    if (local === value) return
    const timer = setTimeout(() => onCommit(local), 300)
    return () => clearTimeout(timer)
  }, [local, value, onCommit])

  return (
    <div className="min-w-56 flex-1">
      <label className="field-label" htmlFor="search-children">
        Cari nama atau kode anak
      </label>
      <Input
        id="search-children"
        type="search"
        placeholder="Contoh: Lia atau ANK-00001"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
      />
    </div>
  )
}
