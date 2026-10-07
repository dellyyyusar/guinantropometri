import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, getRequestIP, setCookie } from '@tanstack/react-start/server'
import { eq, lt } from 'drizzle-orm'
import { compare, hash } from 'bcryptjs'
import { getDb } from '~/db'
import { sessions, users, type Role } from '~/db/schema'
import { env } from '~/lib/env'

export const SESSION_COOKIE = 'antropoanak_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const BCRYPT_ROUNDS = 12

const SESSION_ID_RE = /^[0-9a-f]{64}$/

export type SessionUser = {
  id: number
  name: string
  email: string
  role: Role
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash)
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    // Lax sudah menahan cookie dikirim pada POST lintas-origin, sehingga CSRF
    // lewat form pihak ketiga tidak membawa sesi. Tidak perlu token CSRF terpisah.
    sameSite: 'lax' as const,
    secure: env().NODE_ENV === 'production',
    path: '/',
    expires,
  }
}

export async function createSession(userId: number): Promise<void> {
  const id = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await getDb().insert(sessions).values({ id, userId, expiresAt })
  setCookie(SESSION_COOKIE, id, cookieOptions(expiresAt))
}

export async function destroySession(): Promise<void> {
  const id = getCookie(SESSION_COOKIE)
  if (id !== undefined && SESSION_ID_RE.test(id)) {
    await getDb().delete(sessions).where(eq(sessions.id, id))
  }
  deleteCookie(SESSION_COOKIE, { path: '/' })
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = getCookie(SESSION_COOKIE)
  // Validasi bentuk sebelum menyentuh database: cookie bisa diisi siapa saja.
  if (id === undefined || !SESSION_ID_RE.test(id)) return null

  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (user === null) throw new AuthError('Sesi berakhir atau belum masuk. Silakan login kembali.')
  return user
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== role) {
    throw new AuthError(`Aksi ini hanya untuk peran ${role}.`)
  }
  return user
}

// ---------------------------------------------------------------------------
// Rate limiting login
//
// ponytail: counter in-memory per proses. Cukup untuk satu instance; kalau
// nanti jalan multi-instance/multi-region, pindah ke Redis atau tabel MySQL.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function rateLimitKey(email: string): string {
  return `${getRequestIP() ?? 'unknown'}|${email.trim().toLowerCase()}`
}

export function checkLoginRateLimit(email: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const key = rateLimitKey(email)
  const bucket = buckets.get(key)
  const now = Date.now()
  if (bucket === undefined || bucket.resetAt <= now) {
    buckets.delete(key)
    return { allowed: true }
  }
  if (bucket.count < MAX_ATTEMPTS) return { allowed: true }
  return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
}

export function recordLoginFailure(email: string): void {
  const key = rateLimitKey(email)
  const now = Date.now()
  const bucket = buckets.get(key)
  if (bucket === undefined || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    bucket.count += 1
  }
  // Bersihkan bucket kedaluwarsa sesekali supaya Map tidak tumbuh tanpa batas.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
}

export function resetLoginRateLimit(email: string): void {
  buckets.delete(rateLimitKey(email))
}

export async function purgeExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
