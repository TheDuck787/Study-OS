// Fails the build if an API key or the access code ended up in the public files (dist/).
// Checks typical key formats and the actual values of the server-side variables, if set.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2] ?? 'dist'
const PATTERNS = [/sk-ant-[A-Za-z0-9_-]{20,}/, /sk-proj-[A-Za-z0-9_-]{20,}/, /\bsk-[A-Za-z0-9]{40,}\b/, /sb_secret_[A-Za-z0-9_-]{10,}/]
const SECRET_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'APP_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_JWT_SECRET', 'POSTGRES_PASSWORD', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING']
/** JWTs in the bundle are fine only if they are Supabase anon keys – a service_role JWT would bypass RLS. */
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
function privilegedJwt(text) {
  for (const m of text.match(JWT) ?? []) {
    try {
      const role = JSON.parse(Buffer.from(m.split('.')[1], 'base64').toString('utf8')).role
      if (role && role !== 'anon') return role
    } catch {
      /* not a JWT */
    }
  }
  return null
}
const values = SECRET_VARS.map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 8)

const files = []
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(js|mjs|css|html|json|webmanifest|map|txt)$/.test(name)) files.push(p)
  }
}
walk(DIR)

const problems = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const re of PATTERNS) if (re.test(text)) problems.push(`${f}: sieht aus wie ein API-Schlüssel (${re})`)
  for (const [k, v] of values) if (text.includes(v)) problems.push(`${f}: enthält den Wert von ${k}`)
  const role = privilegedJwt(text)
  if (role) problems.push(`${f}: enthält einen Supabase-JWT mit Rolle „${role}“ (umgeht Row Level Security)`)
}
if (problems.length) {
  console.error('Geheimnis im öffentlichen Build gefunden – Build abgebrochen:\n' + problems.join('\n'))
  process.exit(1)
}
console.log(`Kein API-Schlüssel in ${DIR}/ gefunden (${files.length} Dateien geprüft).`)
