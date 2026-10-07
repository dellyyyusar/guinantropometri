import type { ChildFilters } from '~/validators/schemas'

/**
 * Nilai awal filter daftar anak.
 *
 * Dipakai saat berpindah ke /children dari halaman lain: route itu memvalidasi
 * search params dengan .catch(), sehingga tipe hasilnya mewajibkan ketiga kunci
 * selalu ada. Konstanta ini menghindari objek filter yang ditulis ulang di
 * setiap titik navigasi.
 */
export const DEFAULT_CHILD_FILTERS: ChildFilters = { q: '', gender: 'ALL', page: 1 }

export const DEFAULT_DASHBOARD_SEARCH = { gender: 'L' } as const
export const DEFAULT_EXPORT_FILTERS = {
  format: 'xlsx',
  scope: 'all',
} as const
