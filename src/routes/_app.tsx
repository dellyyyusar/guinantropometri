import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserFn } from '~/auth/functions'
import { AppShell } from '~/components/app-shell'

/**
 * Layout tanpa segmen URL: semua halaman di bawah routes/_app/* memakai sidebar
 * dan topbar, dan tidak bisa diakses tanpa sesi.
 *
 * beforeLoad hanya untuk pengalaman navigasi (langsung dialihkan ke /login).
 * Otorisasi yang sebenarnya ada di tiap server function lewat requireUser().
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const user = await currentUserFn()
    if (user === null) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}
