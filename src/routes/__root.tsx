import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { useState } from 'react'
import appCss from '~/styles.css?url'
import { errorMessage } from '~/lib/errors'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Antropometri Anak â€” Standar Permenkes No. 2 Tahun 2020' },
      {
        name: 'description',
        content:
          'Pencatatan dan penilaian status antropometri anak usia 0-60 bulan berdasarkan Standar Antropometri Anak Permenkes RI Nomor 2 Tahun 2020.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: RootError,
  component: RootDocument,
})

function RootDocument() {
  // Satu QueryClient per render tree; SSR membuat instance sendiri tiap request.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootError({ error }: { error: unknown }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="card max-w-md p-6">
            <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
            <p className="mt-2 text-sm text-muted">{errorMessage(error)}</p>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
