import { drizzle } from 'drizzle-orm/mysql2'
import type { SQL } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import { env } from '~/lib/env'
import * as schema from './schema'

function createDrizzle() {
  return drizzle(getPool(), { schema, mode: 'default' })
}

export type Db = ReturnType<typeof createDrizzle>

let pool: mysql.Pool | undefined
let db: Db | undefined

export function getPool(): mysql.Pool {
  pool ??= mysql.createPool({
    uri: env().DATABASE_URL,
    connectionLimit: 10,
    timezone: 'Z',
    // DATE dibaca sebagai string 'YYYY-MM-DD' supaya tanggal lahir/tanggal ukur
    // tidak bergeser karena zona waktu.
    dateStrings: true,
  })
  return pool
}

export function getDb(): Db {
  db ??= createDrizzle()
  return db
}

/**
 * Jalankan SQL mentah (CTE / window function) dan kembalikan barisnya.
 * Satu-satunya tempat hasil `execute` di-cast: drizzle tidak mengetik SELECT mentah.
 * Parameter selalu lewat placeholder drizzle, tidak pernah dirangkai sebagai string.
 */
export async function sqlAll<T>(statement: SQL): Promise<T[]> {
  const [rows] = (await getDb().execute(statement)) as unknown as [T[]]
  return Array.isArray(rows) ? rows : []
}
