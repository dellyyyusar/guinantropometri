import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { logoutFn } from '~/auth/functions'
import type { SessionUser } from '~/auth/session'
import { DEFAULT_DASHBOARD_SEARCH } from '~/lib/search-defaults'
import { Button, cn } from './ui'

const DISCLAIMER =
  'Hasil aplikasi merupakan alat bantu berdasarkan standar antropometri dan bukan pengganti penilaian tenaga kesehatan.'

const STORAGE_KEY = 'antropoanak:sidebar-collapsed'

type NavItem = { to: string; label: string; exact: boolean; icon: ReactNode }

/** Ikon inline: cukup beberapa path, tidak perlu menambah dependensi ikon. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    exact: true,
    icon: (
      <Icon>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M10 20v-5h4v5" />
      </Icon>
    ),
  },
  {
    to: '/children',
    label: 'Data Anak',
    exact: false,
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.5h5M18.5 3v5" />
      </Icon>
    ),
  },
  {
    to: '/import',
    label: 'Impor Excel',
    exact: false,
    icon: (
      <Icon>
        <path d="M12 3v11" />
        <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
        <path d="M4.5 17v2.5h15V17" />
      </Icon>
    ),
  },
  {
    to: '/export',
    label: 'Ekspor Data',
    exact: false,
    icon: (
      <Icon>
        <path d="M12 14V3" />
        <path d="m8.5 6.5 3.5-3.5 3.5 3.5" />
        <path d="M4.5 17v2.5h15V17" />
      </Icon>
    ),
  },
]

/** Dibaca dari localStorage setelah mount; SSR selalu mulai dari kondisi terbuka. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      window.localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { collapsed, toggle }
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { collapsed, toggle } = useCollapsed()

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        <BrandMark collapsed={collapsed} />
        <Nav user={user} collapsed={collapsed} />
        <CollapseToggle collapsed={collapsed} onToggle={toggle} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-60 flex-col border-r border-line bg-card">
            <BrandMark collapsed={false} />
            <Nav user={user} collapsed={false} onNavigate={() => setMenuOpen(false)} />
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
              <MenuIcon />
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/"
      search={DEFAULT_DASHBOARD_SEARCH}
      className={cn(
        'block border-b border-line',
        collapsed ? 'px-3 py-4 text-center' : 'px-4 py-4',
      )}
    >
      {collapsed ? (
        <span
          className="inline-flex size-8 items-center justify-center rounded-md bg-primary-soft text-sm font-bold text-primary-dark"
          title="Antropometri Anak - Permenkes No. 2 Tahun 2020"
        >
          A
        </span>
      ) : (
        <>
          <p className="text-sm font-semibold tracking-tight text-primary">Antropometri Anak</p>
          <p className="mt-0.5 text-[11px] leading-tight text-faint">
            Permenkes No. 2 Tahun 2020
          </p>
        </>
      )}
    </Link>
  )
}

function Nav({
  user,
  collapsed,
  onNavigate,
}: {
  user: SessionUser
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const items = user.role === 'admin' ? NAV_ITEMS : NAV_ITEMS.slice(0, 2)

  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Navigasi utama">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                // Saat diciutkan labelnya hilang, jadi judulnya dipindah ke atribut title
                // dan tetap disediakan untuk pembaca layar lewat aria-label.
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
                  active
                    ? 'bg-primary-soft font-semibold text-primary-dark'
                    : 'text-muted hover:bg-line-soft hover:text-ink',
                )}
              >
                {item.icon}
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-line p-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
        title={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
        className={cn(
          'flex w-full items-center rounded-md py-2 text-xs font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('size-5 shrink-0 transition-transform duration-200', collapsed && 'rotate-180')}
          aria-hidden="true"
        >
          <path d="M14.5 6 9 12l5.5 6" />
          <path d="M19 4v16" />
        </svg>
        {collapsed ? null : <span>Ciutkan</span>}
      </button>
    </div>
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
