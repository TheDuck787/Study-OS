import { createApp } from '../server/app.js'

/**
 * Vercel Function for everything under /api (Node.js runtime).
 * vercel.json rewrites /api/<path> to this function as /api?__path=<path>; the original path is
 * restored here so the Hono routes match no matter how the platform passes the URL.
 * API keys come from Vercel's encrypted environment variables and never reach the browser.
 */
const { app } = createApp()

function restorePath(req: Request): Request {
  const url = new URL(req.url)
  const original = url.searchParams.get('__path')
  if (original === null || url.pathname.startsWith('/api/')) return req
  url.searchParams.delete('__path')
  url.pathname = `/api/${original.replace(/^\/+/, '')}`
  return new Request(url, req)
}

export default {
  fetch(req: Request) {
    return app.fetch(restorePath(req))
  },
}
