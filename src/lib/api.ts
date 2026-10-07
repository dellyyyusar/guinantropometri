import type { z } from 'zod'
import { AppError, ValidationError, isAppError } from './errors'

/** Hasil seragam semua server function: selalu serialisable, tidak pernah melempar error domain. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    fieldErrors[issue.path.join('.') || '_form'] ??= issue.message
  }
  throw new ValidationError('Data yang dikirim tidak lengkap atau tidak valid.', fieldErrors)
}

/**
 * Bungkus badan server function.
 *
 * Error domain (validasi, tidak ditemukan, sesi habis) dikembalikan sebagai pesan
 * yang aman ditampilkan. Error tak terduga HANYA dicatat di server: isi pesan aslinya
 * bisa memuat nama tabel, kredensial, atau jejak koneksi database.
 */
export async function guard<T>(run: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors }
    }
    if (error instanceof Error && error.name === 'AuthError') {
      return { ok: false, message: error.message }
    }
    console.error('[api] kesalahan tak tertangani:', error)
    return { ok: false, message: 'Terjadi kesalahan tak terduga di server.' }
  }
}

export { AppError, ValidationError, isAppError }
