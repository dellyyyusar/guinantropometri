import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET minimal 16 karakter'),
  ADMIN_EMAIL: z.email().default('admin@example.test'),
  ADMIN_PASSWORD: z.string().min(8).default('change-me'),
  REFERENCE_DATA_DIR: z.string().default('./data/raw'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

function load(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const flat = z.treeifyError(parsed.error)
    throw new Error(
      `Environment variable tidak valid:\n${JSON.stringify(flat, null, 2)}\nSalin .env.example menjadi .env lalu isi.`,
    )
  }
  return parsed.data
}

let cached: Env | undefined

export function env(): Env {
  cached ??= load()
  return cached
}
