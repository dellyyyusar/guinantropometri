import { sql } from 'drizzle-orm'
import { getDb } from '~/db'
import { anthropometricResults, children, measurements } from '~/db/schema'
import { AppError } from '~/lib/errors'
import { calculateAll, formatAge, type CalculationResult } from '~/services/anthropometry'
import { importRowSchema, type ImportRow, type MeasurementInputSchema } from '~/validators/schemas'
import { writeAuditLog } from './audit'
import { getReferenceIndex } from './reference-cache'
import { measurementValues, resultValues } from './measurements'
import { childGroupKeyFromRow, childGroupKey, normalizeImportRow } from './import-normalize'

// Normalisasi baris Excel ada di ./import-normalize (murni, ikut berjalan di browser).
export {
  IMPORT_HEADERS,
  childGroupKey,
  childGroupKeyFromRow,
  normalizeDate,
  normalizeGender,
  normalizeImportRow,
  normalizeMethod,
  normalizeNumber,
} from './import-normalize'
export type ImportPreviewRow = {
  lineNumber: number
  status: 'ok' | 'error'
  errors: string[]
  warnings: string[]
  /** Diisi hanya bila baris lolos validasi; dikirim balik saat commit. */
  parsed?: ImportRow
  summary?: {
    nama: string
    tanggalUkur: string
    umur: string
    bb: number
    pbTb: number | null
    imt: number | null
    zBbU: number | null
    statusBbU: string
    zPbTbU: number | null
    statusPbTbU: string
    zBbPbTb: number | null
    statusBbPbTb: string
    zImtU: number | null
    statusImtU: string
    statusKeseluruhan: string
  }
}

export type ImportPreview = {
  rows: ImportPreviewRow[]
  okCount: number
  errorCount: number
}

export type ImportRowInput = { raw: Record<string, unknown>; lineNumber: number }

/**
 * Validasi + hitung tiap baris TANPA menulis apa pun.
 * Dipanggil dua kali: sekali untuk pratinjau, sekali lagi di dalam commitImport.
 * Commit tidak pernah mempercayai hasil pratinjau dari klien.
 */
export async function previewImportRows(
  inputs: readonly ImportRowInput[],
  existingChildren: Map<string, { id: number; dateOfBirth: string; gender: 'L' | 'P' }>,
): Promise<ImportPreview> {
  const index = await getReferenceIndex()
  const rows: ImportPreviewRow[] = []

  for (const { raw, lineNumber } of inputs) {
    const normalized = normalizeImportRow(raw)
    if ('empty' in normalized) continue

    const result = importRowSchema.safeParse(normalized.data)
    if (!result.success) {
      rows.push({
        lineNumber,
        status: 'error',
        errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'baris'}: ${issue.message}`),
        warnings: [],
      })
      continue
    }

    const parsed = result.data
    const groupKey = childGroupKey(parsed)
    const existing = existingChildren.get(groupKey)
    const dateOfBirth = existing?.dateOfBirth ?? parsed.tanggalLahir
    const gender = existing?.gender ?? parsed.jenisKelamin

    if (existing !== undefined && existing.dateOfBirth !== parsed.tanggalLahir) {
      rows.push({
        lineNumber,
        status: 'error',
        errors: [`Tanggal lahir ${parsed.tanggalLahir} berbeda dari data anak yang sudah ada (${existing.dateOfBirth}).`],
        warnings: [],
        parsed,
      })
      continue
    }

    const measurementInput: MeasurementInputSchema = {
      measurementDate: parsed.tanggalUkur,
      weightKg: parsed.bb,
      rawLengthHeightCm: parsed.pbTb ?? null,
      measurementMethod: parsed.caraUkur,
      notes: null,
    }

    const calc: CalculationResult = calculateAll(
      {
        dateOfBirth,
        measurementDate: measurementInput.measurementDate,
        weightKg: measurementInput.weightKg,
        rawLengthHeightCm: measurementInput.rawLengthHeightCm,
        measurementMethod: measurementInput.measurementMethod,
        gender,
        previous: null,
      },
      index,
    )

    const errors = calc.errors.map((e) => e.message)
    rows.push({
      lineNumber,
      status: errors.length > 0 ? 'error' : 'ok',
      errors,
      warnings: calc.warnings.map((w) => w.message),
      parsed,
      summary: {
        nama: parsed.nama,
        tanggalUkur: parsed.tanggalUkur,
        umur: calc.age === null ? '-' : formatAge(calc.age),
        bb: parsed.bb,
        pbTb: parsed.pbTb ?? null,
        imt: calc.bmi,
        zBbU: calc.weightForAge.zScore,
        statusBbU: calc.weightForAge.status,
        zPbTbU: calc.lengthHeightForAge.zScore,
        statusPbTbU: calc.lengthHeightForAge.status,
        zBbPbTb: calc.weightForLengthHeight.zScore,
        statusBbPbTb: calc.weightForLengthHeight.status,
        zImtU: calc.bmiForAge.zScore,
        statusImtU: calc.bmiForAge.status,
        statusKeseluruhan: calc.overallStatus,
      },
    })
  }

  return {
    rows,
    okCount: rows.filter((r) => r.status === 'ok').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
  }
}

/** Anak yang sudah terdaftar, dipetakan dengan kunci nama+jk+tanggal lahir. */
export async function loadExistingChildren(): Promise<
  Map<string, { id: number; dateOfBirth: string; gender: 'L' | 'P' }>
> {
  const rows = await getDb()
    .select({
      id: children.id,
      name: children.name,
      gender: children.gender,
      dateOfBirth: children.dateOfBirth,
    })
    .from(children)

  return new Map(
    rows.map((r) => [
      childGroupKeyFromRow(r),
      { id: r.id, dateOfBirth: r.dateOfBirth, gender: r.gender },
    ]),
  )
}

export type ImportResult = {
  childrenCreated: number
  measurementsCreated: number
  rowsSkipped: number
  skipped: { lineNumber: number; reason: string }[]
}

/**
 * Tulis baris yang sudah dikonfirmasi pengguna.
 * Validasi diulang dari nol di server - hasil pratinjau klien tidak dipercaya.
 */
export async function commitImport(
  inputs: readonly ImportRowInput[],
  userId: number,
): Promise<ImportResult> {
  const db = getDb()
  const existing = await loadExistingChildren()
  const preview = await previewImportRows(inputs, existing)

  const valid = preview.rows.filter((r) => r.status === 'ok' && r.parsed !== undefined)
  if (valid.length === 0) {
    throw new AppError('IMPORT_NOTHING_TO_SAVE', 'Tidak ada baris valid untuk disimpan.')
  }

  const index = await getReferenceIndex()
  const result: ImportResult = {
    childrenCreated: 0,
    measurementsCreated: 0,
    rowsSkipped: preview.errorCount,
    skipped: preview.rows
      .filter((r) => r.status === 'error')
      .map((r) => ({ lineNumber: r.lineNumber, reason: r.errors.join('; ') })),
  }

  await db.transaction(async (tx) => {
    const [maxRow] = await tx.select({ maxId: sql<number>`COALESCE(MAX(${children.id}), 0)` }).from(children)
    let nextId = Number(maxRow?.maxId ?? 0)

    for (const row of valid) {
      const parsed = row.parsed!
      const groupKey = childGroupKey(parsed)
      let childId = existing.get(groupKey)?.id

      if (childId === undefined) {
        nextId += 1
        const childCode = parsed.kodeAnak?.trim() !== '' && parsed.kodeAnak !== undefined
          ? parsed.kodeAnak
          : `ANK-${String(nextId).padStart(5, '0')}`

        const [inserted] = await tx
          .insert(children)
          .values({
            childCode,
            name: parsed.nama,
            gender: parsed.jenisKelamin,
            dateOfBirth: parsed.tanggalLahir,
            createdBy: userId,
            updatedBy: userId,
          })
          .$returningId()

        childId = inserted?.id
        if (childId === undefined) throw new AppError('INSERT_FAILED', `Gagal membuat anak pada baris ${row.lineNumber}.`)

        existing.set(groupKey, {
          id: childId,
          dateOfBirth: parsed.tanggalLahir,
          gender: parsed.jenisKelamin,
        })
        result.childrenCreated += 1

        await writeAuditLog(
          { userId, entity: 'child', entityId: childId, action: 'CREATE', newData: parsed },
          tx,
        )
      }

      const calc = calculateAll(
        {
          dateOfBirth: parsed.tanggalLahir,
          measurementDate: parsed.tanggalUkur,
          weightKg: parsed.bb,
          rawLengthHeightCm: parsed.pbTb ?? null,
          measurementMethod: parsed.caraUkur,
          gender: parsed.jenisKelamin,
          previous: null,
        },
        index,
      )

      // Berubah sejak pratinjau (mis. data lain masuk bersamaan): lewati, jangan paksa.
      if (calc.errors.length > 0 || calc.age === null) {
        result.rowsSkipped += 1
        result.skipped.push({ lineNumber: row.lineNumber, reason: calc.errors[0]?.message ?? 'Umur tidak dapat dihitung' })
        continue
      }

      const measurementInput: MeasurementInputSchema = {
        measurementDate: parsed.tanggalUkur,
        weightKg: parsed.bb,
        rawLengthHeightCm: parsed.pbTb ?? null,
        measurementMethod: parsed.caraUkur,
        notes: null,
      }

      const [insertedMeasurement] = await tx
        .insert(measurements)
        .values(measurementValues(childId, measurementInput, calc, userId))
        .$returningId()

      const measurementId = insertedMeasurement?.id
      if (measurementId === undefined) {
        throw new AppError('INSERT_FAILED', `Gagal menyimpan pengukuran baris ${row.lineNumber}.`)
      }

      await tx.insert(anthropometricResults).values({ measurementId, ...resultValues(calc) })
      await writeAuditLog(
        { userId, entity: 'measurement', entityId: measurementId, action: 'CREATE', newData: { import: true, parsed } },
        tx,
      )
      result.measurementsCreated += 1
    }

    await writeAuditLog(
      {
        userId,
        entity: 'import',
        entityId: new Date().toISOString(),
        action: 'CREATE',
        newData: result,
      },
      tx,
    )
  })

  return result
}
