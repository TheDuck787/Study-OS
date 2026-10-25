// Validates the Supabase migration with PGlite (embedded Postgres) and checks that RLS isolates users.
// Supabase's auth schema is stubbed: auth.users table and auth.uid() reading a session setting.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8')
const db = new PGlite()

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
`)
await db.exec(sql.replace('create extension if not exists pgcrypto;', ''))
await db.exec(`
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
`)

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`)

async function as(user, query) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await db.query(query)
  } finally {
    await db.exec('reset role;')
  }
}

await as(A, `insert into public.subjects (id, user_id, name) values ('s1', '${A}', 'Mathematik')`)
await as(B, `insert into public.subjects (id, user_id, name) values ('s1', '${B}', 'Deutsch')`)
const seenByA = await as(A, 'select name from public.subjects')
const seenByB = await as(B, 'select name from public.subjects')
if (seenByA.rows.length !== 1 || seenByA.rows[0].name !== 'Mathematik') throw new Error('RLS: A sees wrong rows')
if (seenByB.rows.length !== 1 || seenByB.rows[0].name !== 'Deutsch') throw new Error('RLS: B sees wrong rows')

let blocked = false
try {
  await as(A, `insert into public.subjects (id, user_id, name) values ('s2', '${B}', 'Hack')`)
} catch {
  blocked = true
}
if (!blocked) throw new Error('RLS: A could insert a row for B')

const upd = await as(A, `update public.subjects set name = 'x' where user_id = '${B}'`)
if (upd.affectedRows) throw new Error('RLS: A could update B')

let gradeRejected = false
try {
  await as(A, `insert into public.teacher_grades (id, user_id, subject_id, title, grade, date) values ('g', '${A}', 's1', 'T', '7', '2026-01-01')`)
} catch {
  gradeRejected = true
}
if (!gradeRejected) throw new Error('Check constraint: grade 7 accepted')

console.log('Supabase migration OK: schema created, RLS isolates users, constraints enforced.')
