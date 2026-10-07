import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  // .env -> process.env, supaya kode server (drizzle, auth) bisa membacanya
  // tanpa menambah dependency dotenv.
  //
  // NODE_ENV sengaja DIBUANG: nilainya menentukan mode transform JSX.
  // Kalau .env memuat NODE_ENV=development, `vite build` akan menghasilkan
  // bundel mode development yang gagal jalan dengan React produksi.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (key === 'NODE_ENV') continue
    process.env[key] ??= value
  }

  return {
    server: {
      port: 3000,
    },
    resolve: {
      tsconfigPaths: true,
    },
    /**
     * WAJIB. Transform JSX di Vite 8 dijalankan oleh oxc, dan tanpanya oxc
     * memakai mode development: tiap komponen dipanggil lewat jsxDEV dari
     * react/jsx-dev-runtime, yang tidak diekspor React mode produksi.
     * Gejalanya: seluruh halaman 500 dengan "jsxDEV is not a function".
     * vite dev dibiarkan memakai mode development agar pesan JSX informatif.
     */
    oxc: {
      jsx: { development: mode === 'development' },
    },
    plugins: [tailwindcss(), tanstackStart({ srcDirectory: 'src' }), viteReact(), nitro()],
  }
})
