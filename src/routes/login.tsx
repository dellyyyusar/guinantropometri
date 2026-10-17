import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { currentUserFn, loginFn } from '~/auth/functions'
import { Alert, Button, Card, Field, Input } from '~/components/ui'
import { DEFAULT_DASHBOARD_SEARCH } from '~/lib/search-defaults'
import { loginSchema, type LoginInput } from '~/validators/schemas'

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async () => {
    const user = await currentUserFn()
    if (user !== null) throw redirect({ to: '/', search: DEFAULT_DASHBOARD_SEARCH })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const login = useServerFn(loginFn)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    const result = await login({ data: values })

    if (!result.ok) {
      setFormError(result.message)
      return
    }

    await router.invalidate()
    await navigate({ to: redirectTo !== undefined && redirectTo.startsWith('/') ? redirectTo : '/', search: DEFAULT_DASHBOARD_SEARCH })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Antropometri Anak</h1>
          <p className="mt-1 text-xs text-muted">
            Standar Antropometri Anak - Permenkes RI No. 2 Tahun 2020
          </p>
        </div>

        <Card className="p-5">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError !== null ? <Alert tone="attention" title={formError} /> : null}

            <Field label="Email" required error={form.formState.errors.email?.message}>
              <Input
                type="email"
                autoComplete="username"
                autoFocus
                invalid={form.formState.errors.email !== undefined}
                {...form.register('email')}
              />
            </Field>

            <Field label="Password" required error={form.formState.errors.password?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                invalid={form.formState.errors.password !== undefined}
                {...form.register('password')}
              />
            </Field>

            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Masuk
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
          Aplikasi ini alat bantu pencatatan dan interpretasi antropometri, bukan pengganti
          penilaian tenaga kesehatan.
        </p>
      </div>
    </div>
  )
}
