import { migrate } from 'drizzle-orm/mysql2/migrator'
import { getDb, getPool } from './index'

async function main() {
  console.log('Menjalankan migrasi dari ./drizzle ...')
  await migrate(getDb(), { migrationsFolder: './drizzle' })
  console.log('Migrasi selesai.')
  await getPool().end()
}

main().catch(async (err) => {
  console.error('Migrasi gagal:', err)
  process.exit(1)
})
