import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'node:fs'
import { createApp } from './app.js'

/**
 * Self-hosting: one Node process serves the built web app (dist/) and the AI proxy (/api).
 * On Vercel this file is not used – see api/index.ts.
 */
const PORT = Number(process.env.PORT ?? 8787)
const { app, detail, accessTokenSet } = createApp()

if (existsSync('./dist/index.html')) {
  // The service worker must never be cached, otherwise updates do not arrive.
  app.use('/sw.js', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-cache')
  })
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Study OS Server läuft auf http://localhost:${info.port}`)
  console.log(`KI: ${detail}`)
  if (!accessTokenSet) console.log('Hinweis: APP_ACCESS_TOKEN ist nicht gesetzt – betreibe den Server nur lokal oder setze einen Zugangscode.')
})
