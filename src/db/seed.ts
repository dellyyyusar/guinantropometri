import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb, getPool } from './index'
import { env } from '~/lib/env'
import { assertReferenceRowsComplete, loadReferenceRows } from './reference-source'
import { anthropometricReference, users } from './schema'

async function seedReference() {
  const db = getDb()
  const dir = env().REFERENCE_DATA_DIR

  console.log(`Membaca tabel referensi dari ${dir} ...`)
  const rows = loadReferenceRows(dir)
  assertReferenceRowsComplete(rows)
  console.log(`  ${rows.length} baris referensi (14 tabel Permenkes 2/2020).`)

  // Idempoten: seluruh isi tabel referensi diganti dari sumber resmi dalam satu transaksi.
  // Tabel ini tidak punya FK masuk, jadi delete+insert aman dan jauh lebih sederhana
  // daripada upsert 854 baris.
  await db.delete(anthropometricReference)

  const CHUNK = 200
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(anthropometricReference).values(rows.slice(i, i + CHUNK))
    console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length} baris`)
  }
}

async function seedAdmin() {
  const db = getDb()
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = env()

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL))
  if (existing.length > 0) {
    console.log(`Admin ${ADMIN_EMAIL} sudah ada, dilewati.`)
    return
  }

  await db.insert(users).values({
    name: 'Administrator',
    email: ADMIN_EMAIL,
    passwordHash: await hash(ADMIN_PASSWORD, 12),
    role: 'admin',
  })
  console.log(`Admin dibuat: ${ADMIN_EMAIL} (password dari ADMIN_PASSWORD).`)
}

async function main() {
  const db = getDb()
  await db.transaction(async () => {
    await seedReference()
    await seedAdmin()
  })
  console.log('Seed selesai.')
  await getPool().end()
}

main().catch(async (err) => {
  console.error('Seed gagal:', err)
  process.exit(1)
})
