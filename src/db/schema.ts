import {
  date,
  timestamp,
  decimal,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const GENDERS = ['L', 'P'] as const
export const ROLES = ['admin', 'petugas'] as const
export const MEASUREMENT_METHODS = ['STANDING', 'LYING'] as const
export const INDICATORS = [
  'BB_U',
  'PB_U',
  'TB_U',
  'BB_PB',
  'BB_TB',
  'IMT_U_PB',
  'IMT_U_TB',
] as const
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const

export type Gender = (typeof GENDERS)[number]
export type Role = (typeof ROLES)[number]
export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number]
export type Indicator = (typeof INDICATORS)[number]
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const users = mysqlTable(
  'antro_users',
  {
    id: int().autoincrement().primaryKey(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 190 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: mysqlEnum('role', ROLES).notNull().default('petugas'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
)

export const sessions = mysqlTable(
  'antro_sessions',
  {
    id: varchar({ length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    foreignKey({ name: 'fk_sessions_user', columns: [t.userId], foreignColumns: [users.id] }).onDelete('cascade'),
  ],
)

export const children = mysqlTable(
  'antro_children',
  {
    id: int().autoincrement().primaryKey(),
    childCode: varchar('child_code', { length: 32 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    gender: mysqlEnum('gender', GENDERS).notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
    birthWeight: decimal('birth_weight', { precision: 5, scale: 3, mode: 'number' }),
    birthLength: decimal('birth_length', { precision: 5, scale: 2, mode: 'number' }),
    motherName: varchar('mother_name', { length: 100 }),
    fatherName: varchar('father_name', { length: 100 }),
    address: varchar({ length: 255 }),
    notes: text(),
    createdBy: int('created_by'),
    updatedBy: int('updated_by'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [
    uniqueIndex('children_child_code_uq').on(t.childCode),
    index('children_name_idx').on(t.name),
    index('children_date_of_birth_idx').on(t.dateOfBirth),
    foreignKey({ name: 'fk_children_created_by', columns: [t.createdBy], foreignColumns: [users.id] }).onDelete('set null'),
    foreignKey({ name: 'fk_children_updated_by', columns: [t.updatedBy], foreignColumns: [users.id] }).onDelete('set null'),
  ],
)

export const measurements = mysqlTable(
  'antro_measurements',
  {
    id: int().autoincrement().primaryKey(),
    childId: int('child_id').notNull(),
    measurementDate: date('measurement_date', { mode: 'string' }).notNull(),
    weightKg: decimal('weight_kg', { precision: 5, scale: 3, mode: 'number' }).notNull(),
    rawLengthHeightCm: decimal('raw_length_height_cm', {
      precision: 5,
      scale: 2,
      mode: 'number',
    }),
    measurementMethod: mysqlEnum('measurement_method', MEASUREMENT_METHODS).notNull(),
    correctedLengthHeightCm: decimal('corrected_length_height_cm', {
      precision: 5,
      scale: 2,
      mode: 'number',
    }),
    ageYear: smallint('age_year').notNull(),
    ageMonth: smallint('age_month').notNull(),
    ageDay: smallint('age_day').notNull(),
    ageTotalMonths: decimal('age_total_months', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    bmi: decimal({ precision: 6, scale: 2, mode: 'number' }),
    notes: text(),
    createdBy: int('created_by'),
    updatedBy: int('updated_by'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [
    index('measurements_child_date_idx').on(t.childId, t.measurementDate),
    index('measurements_measurement_date_idx').on(t.measurementDate),
    foreignKey({ name: 'fk_measurements_child', columns: [t.childId], foreignColumns: [children.id] }).onDelete('cascade'),
    foreignKey({ name: 'fk_measurements_created_by', columns: [t.createdBy], foreignColumns: [users.id] }).onDelete('set null'),
    foreignKey({ name: 'fk_measurements_updated_by', columns: [t.updatedBy], foreignColumns: [users.id] }).onDelete('set null'),
  ],
)

export const anthropometricResults = mysqlTable(
  'antro_anthropometric_results',
  {
    id: int().autoincrement().primaryKey(),
    measurementId: int('measurement_id').notNull(),
    weightForAgeZ: decimal('weight_for_age_z', { precision: 6, scale: 2, mode: 'number' }),
    weightForAgeStatus: varchar('weight_for_age_status', { length: 64 }).notNull(),
    lengthHeightForAgeZ: decimal('length_height_for_age_z', {
      precision: 6,
      scale: 2,
      mode: 'number',
    }),
    lengthHeightForAgeStatus: varchar('length_height_for_age_status', { length: 64 }).notNull(),
    weightForLengthHeightZ: decimal('weight_for_length_height_z', {
      precision: 6,
      scale: 2,
      mode: 'number',
    }),
    weightForLengthHeightStatus: varchar('weight_for_length_height_status', {
      length: 64,
    }).notNull(),
    bmiForAgeZ: decimal('bmi_for_age_z', { precision: 6, scale: 2, mode: 'number' }),
    bmiForAgeStatus: varchar('bmi_for_age_status', { length: 64 }).notNull(),
    overallStatus: varchar('overall_status', { length: 64 }).notNull(),
    calculationVersion: varchar('calculation_version', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('anthropometric_results_measurement_uq').on(t.measurementId),
    index('anthropometric_results_overall_idx').on(t.overallStatus),
    foreignKey({ name: 'fk_results_measurement', columns: [t.measurementId], foreignColumns: [measurements.id] }).onDelete('cascade'),
  ],
)

/**
 * Tabel referensi Standar Antropometri Anak.
 *
 * `age_month` dan `measurement_cm` memakai -1 sebagai penanda "tidak berlaku"
 * (bukan NULL) supaya UNIQUE constraint berfungsi di MySQL: indeks unik MySQL
 * menganggap NULL tidak pernah duplikat, sehingga seed tidak idempoten.
 *
 *   indeks umur   (BB/U, PB/U, TB/U, IMT/U)  -> age_month terisi, measurement_cm = -1
 *   indeks panjang (BB/PB, BB/TB)            -> measurement_cm terisi, age_month = -1
 *
 * Kolom l/m/s adalah parameter LMS WHO. Belum dipakai oleh perhitungan default
 * (piecewise interpolation atas cutpoint Permenkes), disimpan agar metode LMS
 * bisa diaktifkan tanpa migrasi ulang data.
 */
export const anthropometricReference = mysqlTable(
  'antro_anthropometric_reference',
  {
    id: int().autoincrement().primaryKey(),
    indicator: mysqlEnum('indicator', INDICATORS).notNull(),
    gender: mysqlEnum('gender', GENDERS).notNull(),
    ageMonth: decimal('age_month', { precision: 5, scale: 1, mode: 'number' })
      .notNull()
      .default(-1),
    measurementCm: decimal('measurement_cm', { precision: 5, scale: 1, mode: 'number' })
      .notNull()
      .default(-1),
    minus3Sd: decimal('minus_3sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    minus2Sd: decimal('minus_2sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    minus1Sd: decimal('minus_1sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    median: decimal({ precision: 6, scale: 2, mode: 'number' }).notNull(),
    plus1Sd: decimal('plus_1sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    plus2Sd: decimal('plus_2sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    plus3Sd: decimal('plus_3sd', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    l: decimal({ precision: 9, scale: 5, mode: 'number' }),
    m: decimal({ precision: 9, scale: 5, mode: 'number' }),
    s: decimal({ precision: 9, scale: 5, mode: 'number' }),
    sourceTable: varchar('source_table', { length: 64 }).notNull(),
    sourceDocument: varchar('source_document', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reference_lookup_uq').on(t.indicator, t.gender, t.ageMonth, t.measurementCm),
  ],
)

export const auditLogs = mysqlTable(
  'antro_audit_logs',
  {
    id: int().autoincrement().primaryKey(),
    userId: int('user_id'),
    entity: varchar({ length: 32 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    action: mysqlEnum('action', AUDIT_ACTIONS).notNull(),
    oldData: json('old_data'),
    newData: json('new_data'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_user_idx').on(t.userId),
    index('audit_logs_created_at_idx').on(t.createdAt),
    foreignKey({ name: 'fk_audit_user', columns: [t.userId], foreignColumns: [users.id] }).onDelete('set null'),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Child = typeof children.$inferSelect
export type NewChild = typeof children.$inferInsert
export type Measurement = typeof measurements.$inferSelect
export type NewMeasurement = typeof measurements.$inferInsert
export type AnthropometricResult = typeof anthropometricResults.$inferSelect
export type AnthropometricReference = typeof anthropometricReference.$inferSelect
export type NewAnthropometricReference = typeof anthropometricReference.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect

