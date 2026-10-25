// Validates the Supabase migrations with PGlite (embedded Postgres) and checks that RLS isolates users.
// Supabase's auth schema is stubbed: auth.users table, auth.uid() reading the JWT claim, anon/authenticated roles.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../supabase/migrations/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const db = new PGlite()
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema public to authenticated, anon;
`)
for (const f of files) await db.exec(readFileSync(new URL(f, dir), 'utf8'))
// running the migration twice must be harmless (idempotent)
for (const f of files) await db.exec(readFileSync(new URL(f, dir), 'utf8'))

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`)

async function as(role, user, query) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  try {
    return await db.query(query)
  } finally {
    await db.exec('reset role;')
  }
}
const fails = async (fn, what) => {
  try {
    await fn()
  } catch {
    return
  }
  throw new Error(`Expected failure: ${what}`)
}

// own rows, user id from the session (default)
await as('authenticated', A, `insert into public.sync_records (table_name, record_id, data) values ('subjects', 's1', '{"name":"Mathematik"}')`)
await as('authenticated', B, `insert into public.sync_records (table_name, record_id, data) values ('subjects', 's1', '{"name":"Deutsch"}')`)
const a = await as('authenticated', A, 'select data->>\'name\' as name, user_id from public.sync_records')
const b = await as('authenticated', B, 'select data->>\'name\' as name from public.sync_records')
if (a.rows.length !== 1 || a.rows[0].name !== 'Mathematik' || a.rows[0].user_id !== A) throw new Error('RLS: A sees wrong rows')
if (b.rows.length !== 1 || b.rows[0].name !== 'Deutsch') throw new Error('RLS: B sees wrong rows')

// no spoofing, no cross-user writes, no anonymous access
await fails(() => as('authenticated', A, `insert into public.sync_records (user_id, table_name, record_id, data) values ('${B}', 'subjects', 'x', '{}')`), 'A inserts a row for B')
const upd = await as('authenticated', A, `update public.sync_records set data = '{"name":"hack"}' where user_id = '${B}'`)
if (upd.affectedRows) throw new Error('RLS: A could update B')
const del = await as('authenticated', A, `delete from public.sync_records where user_id = '${B}'`)
if (del.affectedRows) throw new Error('RLS: A could delete B')
await fails(() => as('anon', null, 'select * from public.sync_records'), 'anon can read')
await fails(() => as('anon', null, `insert into public.sync_records (user_id, table_name, record_id, data) values ('${A}', 'subjects', 'y', '{}')`), 'anon can insert')
const noSession = await as('authenticated', null, 'select * from public.sync_records')
if (noSession.rows.length) throw new Error('RLS: authenticated role without user sees rows')

// owner can never be changed; timestamps are set by the server
await as('authenticated', A, `update public.sync_records set user_id = '${B}' where record_id = 's1'`).catch(() => {})
const still = await as('authenticated', A, `select count(*)::int as n from public.sync_records`)
if (still.rows[0].n !== 1) throw new Error('owner of a row could be changed')
await as('authenticated', A, `insert into public.sync_records (table_name, record_id, data, updated_at) values ('notes', 'n1', '{}', '2000-01-01')`)
const ts = await as('authenticated', A, `select updated_at > now() - interval '1 minute' as fresh from public.sync_records where record_id = 'n1'`)
if (!ts.rows[0].fresh) throw new Error('client could backdate updated_at')

// upsert as used by the app (on conflict update), tombstones, constraints
await as('authenticated', A, `insert into public.sync_records (user_id, table_name, record_id, data) values ('${A}', 'notes', 'n1', '{"v":2}') on conflict (user_id, table_name, record_id) do update set data = excluded.data, deleted = excluded.deleted`)
await as('authenticated', A, `insert into public.sync_records (user_id, table_name, record_id, data, deleted) values ('${A}', 'notes', 'n1', null, true) on conflict (user_id, table_name, record_id) do update set data = excluded.data, deleted = excluded.deleted`)
await fails(() => as('authenticated', A, `insert into public.sync_records (table_name, record_id, data) values ('evil_table', 'z', '{}')`), 'unknown table name accepted')
await fails(() => as('authenticated', A, `insert into public.sync_records (table_name, record_id, data, deleted) values ('notes', 'z', null, false)`), 'live row without data accepted')
await fails(() => as('authenticated', A, `insert into public.sync_records (table_name, record_id, data, deleted) values ('notes', 'z2', '{}', true)`), 'tombstone with data accepted')

console.log(`Supabase migration OK (${files.join(', ')}): idempotent, RLS isolates users, no anonymous access, no owner spoofing, server timestamps, constraints enforced.`)
