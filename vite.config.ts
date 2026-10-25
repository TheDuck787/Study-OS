import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * Builds dist/sw.js from sw/sw.js: a new cache version for every build (so updates arrive)
 * and a precache list of the app code, so the installed app also opens offline.
 */
function serviceWorker(): Plugin {
  return {
    name: 'studyos-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle)
        .filter((f) => /\.(js|css)$/.test(f.fileName))
        .filter((f) => (f.type === 'chunk' ? f.code.length : f.source.length) < 2_000_000)
        .map((f) => `./${f.fileName}`)
      const precache = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', ...files.sort()]
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)
      const source = readFileSync(fileURLToPath(new URL('./sw/sw.js', import.meta.url)), 'utf8')
        .replace('__SW_VERSION__', version)
        .replace('__SW_PRECACHE__', JSON.stringify(precache, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

/** VITE_* variables end up in the public JavaScript – refuse anything that looks like a secret. */
function guardPublicEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const risky = Object.keys(env).filter((k) => /KEY|SECRET|TOKEN|PASSWORD/i.test(k))
  if (risky.length) throw new Error(`Diese Variablen würden im Browser landen und dürfen kein Geheimnis enthalten: ${risky.join(', ')}. API-Schlüssel gehören ohne VITE_-Präfix in die Server-Umgebung.`)
}

export default defineConfig(({ mode }) => {
  guardPublicEnv(mode)
  return {
    // Relative asset paths so the build also works from a sub-path.
    base: './',
    plugins: [react(), tailwindcss(), serviceWorker()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:8787' },
    },
    preview: {
      port: 4173,
      proxy: { '/api': 'http://localhost:8787' },
    },
    build: { chunkSizeWarningLimit: 1500 },
    test: {
      include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['tests/unit/setup.ts'],
    },
  }
})
