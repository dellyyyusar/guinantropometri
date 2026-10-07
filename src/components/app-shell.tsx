import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { logoutFn } from '~/auth/functions'
import type { SessionUser } from '~/auth/session'
import { DEFAULT_DASHBOARD_SEARCH } from '~/lib/search-defaults'
import { Button, cn } from './ui'

const DISCLAIMER =
  'Hasil aplikasi merupakan alat bantu berdasarkan standar antropometri dan bukan pengganti penilaian tenaga kesehatan.'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/children', label: 'Data Anak', exact: false },
  { to: '/import', label: 'Impor Excel', exact: false },
  { to: '/export', label: 'Ekspor Data', exact: false },
] as const

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-56 shrink-0 border-r border-line bg-card lg:flex lg:flex-col">
        <BrandMark />
        <Nav user={user} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-60 flex-col border-r border-line bg-card">
            <BrandMark />
            <Nav user={user} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label="Buka menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              â˜°
            </Button>
            <p className="truncate text-sm font-semibold tracking-tight">
              Standar Antropometri Anak
            </p>
          </div>
          <UserMenu user={user} />
        </header>

        <main className="print-full min-w-0 flex-1 p-4 lg:p-6">{children}</main>

        <footer className="no-print border-t border-line px-4 py-3 text-[11px] leading-relaxed text-faint lg:px-6">
          <p className="max-w-3xl">{DISCLAIMER}</p>
          <p className="mt-1">
            Sumber standar: Permenkes RI Nomor 2 Tahun 2020 (WHO Child Growth Standards 2006).
          </p>
        </footer>
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <Link to="/" search={DEFAULT_DASHBOARD_SEARCH} className="block border-b border-line px-4 py-4">
      <p className="text-sm font-semibold tracking-tight text-primary">Antropometri Anak</p>
      <p className="mt-0.5 text-[11px] leading-tight text-faint">
        Permenkes No. 2 Tahun 2020
      </p>
    </Link>
  )
}

function Nav({
  user,
  onNavigate,
}: {
  user: SessionUser
  onNavigate?: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const items = user.role === 'admin' ? NAV_ITEMS : NAV_ITEMS.slice(0, 2)

  return (
    <nav className="flex-1 p-2" aria-label="Navigasi utama">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary-soft font-semibold text-primary-dark'
                    : 'text-muted hover:bg-line-soft hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const router = useRouter()
  const logout = useServerFn(logoutFn)
  const [busy, setBusy] = useState(false)

  async function handleLogout() {
    setBusy(true)
    try {
      await logout({ data: undefined })
      await router.invalidate()
      await navigate({ to: '/login' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold text-ink">{user.name}</p>
        <p className="text-[11px] text-faint">
          {user.role === 'admin' ? 'Administrator' : 'Petugas'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleLogout} loading={busy}>
        Keluar
      </Button>
    </div>
  )
}
