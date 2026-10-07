import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb } from '~/db'
import { users } from '~/db/schema'
import { loginSchema } from '~/validators/schemas'
import {
  checkLoginRateLimit,
  createSession,
  destroySession,
  getCurrentUser,
  recordLoginFailure,
  resetLoginRateLimit,
  verifyPassword,
  type SessionUser,
} from './session'

/**
 * Hash buang-buang: bila email tidak terdaftar, bcrypt tetap dijalankan supaya
 * waktu respons tidak membocorkan email mana yang punya akun.
 */
const DUMMY_HASH = '$2b$12$6hDPXwgxH5Rkedkb2ozOsOtfaSwhG9jDKsnCmT3E6QYnkyiyJs0fm'

const GENERIC_FAILURE = 'Email atau password salah.'

export type LoginResult = { ok: true } | { ok: false; message: string }

export const loginFn = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const limited = checkLoginRateLimit(data.email)
    if (!limited.allowed) {
      return {
        ok: false,
        message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${limited.retryAfterSeconds} detik.`,
      }
    }

    const rows = await getDb()
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, data.email.trim().toLowerCase()))
      .limit(1)

    const user = rows[0]
    const passwordMatches = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH)

    if (user === undefined || !passwordMatches) {
      recordLoginFailure(data.email)
      return { ok: false, message: GENERIC_FAILURE }
    }

    resetLoginRateLimit(data.email)
    await createSession(user.id)
    return { ok: true }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async (): Promise<{ ok: true }> => {
  await destroySession()
  return { ok: true }
})

/** Tidak pernah melempar: null berarti belum masuk. Dipakai loader untuk gating navigasi. */
export const currentUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => getCurrentUser(),
)
