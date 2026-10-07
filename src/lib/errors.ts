/**
 * Error yang aman ditampilkan ke pengguna.
 * Error lain (bug, koneksi DB) tidak boleh bocor apa adanya ke browser.
 */
export class AppError extends Error {
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

/** VALIDATION ERROR: data ditolak, tidak boleh masuk database. */
export class ValidationError extends AppError {
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super('VALIDATION_ERROR', message, fieldErrors)
    this.name = 'ValidationError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function errorMessage(error: unknown): string {
  if (isAppError(error)) return error.message
  if (error instanceof Error && error.name === 'AuthError') return error.message
  return 'Terjadi kesalahan tak terduga. Silakan coba lagi.'
}
