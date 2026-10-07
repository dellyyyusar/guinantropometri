# Antropometri Anak — Standar Permenkes No. 2 Tahun 2020

Aplikasi pencatatan pertumbuhan anak usia 0–60 bulan dan penilaian status antropometri
berdasarkan **Standar Antropometri Anak (Permenkes RI Nomor 2 Tahun 2020)**, yang mengadopsi
**WHO Child Growth Standards 2006**.

> Hasil aplikasi merupakan alat bantu berdasarkan standar antropometri dan **bukan pengganti
> penilaian tenaga kesehatan**. Kategori "perlu perhatian lebih lanjut" bukan diagnosis medis.

## Indeks yang dihitung

| Indeks | Tabel referensi | Batasan |
|---|---|---|
| BB/U — Berat Badan menurut Umur | Tabel 1 (L) / 8 (P) | 0–60 bulan |
| PB/U — Panjang Badan menurut Umur | Tabel 2 (L) / 9 (P) | 0–24 bulan, berbaring |
| TB/U — Tinggi Badan menurut Umur | Tabel 3 (L) / 10 (P) | 24–60 bulan, berdiri |
| BB/PB — Berat Badan menurut Panjang | Tabel 4 (L) / 11 (P) | panjang 45–110 cm |
| BB/TB — Berat Badan menurut Tinggi | Tabel 5 (L) / 12 (P) | tinggi 65–120 cm |
| IMT/U — IMT menurut Umur | Tabel 6–7 (L) / 13–14 (P) | 0–60 bulan |

Koreksi panjang/tinggi badan ±0.7 cm diterapkan otomatis sesuai usia dan cara ukur.

## Stack

TanStack Start + React 19 + TypeScript + Tailwind CSS v4 + TanStack Router/Query +
React Hook Form + Zod + Drizzle ORM + MySQL 8 + bcryptjs + Recharts + SheetJS.

## Menjalankan

```bash
pnpm install
cp .env.example .env      # isi DATABASE_URL dan SESSION_SECRET
pnpm db:migrate           # buat 7 tabel (berawalan antro_)
pnpm db:seed              # 854 baris referensi Permenkes + user admin
pnpm dev                  # http://localhost:3000
```

Perintah lain:

```bash
pnpm test                 # 122 unit test
pnpm typecheck            # tsc --noEmit
pnpm build                # build produksi (client + SSR + nitro)
pnpm db:generate          # buat migrasi baru dari schema
```

## Sumber data

Tabel referensi **tidak diketik manual** dan **tidak dikarang**. `data/raw/` memuat berkas
resmi yang diunduh dari sumbernya, dengan provenance lengkap di
[`data/raw/PROVENANCE.md`](data/raw/PROVENANCE.md):

- 14 XLSX cutpoint SD + parameter LMS dari `cdn.who.int` (WHO Child Growth Standards)
- 9 tabel LMS dari repositori resmi `WorldHealthOrganization/anthro`
- PDF Permenkes No. 2 Tahun 2020 dari JDIH BPK

`data/raw/verify.py` dan `compare_permenkes.py` memverifikasi: **5978 sel** PDF Permenkes
dibanding XLSX WHO cocok seluruhnya kecuali satu typo pada PDF (Tabel 12, BB/TB perempuan
69.5 cm, −3SD tercetak `6.`). Aplikasi memakai nilai WHO yang benar (**6.3**), dikonfirmasi
perhitungan LMS. Ada unit test yang mengunci nilai ini.

## Prinsip perhitungan

1. **Referensi tidak ditemukan menghasilkan `zScore: null`** dan status
   "Referensi tidak tersedia" — tidak pernah di-fallback ke 0, +3, atau −3.
2. **Nilai di luar ±3SD diekstrapolasi**, sehingga status tetap membedakan `Z > +3`
   (Obesitas) dari `Z = +3` (Gizi lebih).
3. **Umur dihitung dari tanggal lahir dan tanggal pengukuran**, bukan `TODAY()`.
4. **Perhitungan selalu di server.** Pratinjau di form memakai mesin yang sama persis dengan
   yang menulis ke database.
5. **Validation error memblokir penyimpanan; clinical warning tidak.** Keduanya ditampilkan
   terpisah.
6. Setiap hasil menyimpan `source_table` dan `calculation_version` agar dapat diaudit.

## Struktur

```
src/
  api/                    server function (children, measurements, dashboard, import, export)
  auth/                   sesi, hashing password, rate limit login
  charts/                 grafik pertumbuhan Recharts
  components/             UI, app shell, form, badge status
  db/                     schema, migrasi, seed, loader XLSX
  lib/                    env, error, format tanggal/angka, helper API
  routes/                 halaman (login, dashboard, anak, pengukuran, impor, ekspor, cetak)
  services/anthropometry/ mesin perhitungan murni (umur, koreksi, IMT, z-score, status, anomali)
  services/               lapisan domain (anak, pengukuran, dashboard, ekspor, impor, audit)
  validators/             skema Zod
```

## Catatan operasional

- Tabel database diberi awalan `antro_` agar aman bila database dipakai bersama aplikasi lain.
- `SESSION_SECRET` minimal 16 karakter; ganti sebelum produksi.
- Akun admin awal dibuat dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` saat `pnpm db:seed`.
