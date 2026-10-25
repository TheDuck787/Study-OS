-- Study OS – cloud sync for signed-in users (Supabase Auth).
-- One row per local record (same JSON shape as IndexedDB and the JSON backup), isolated per user by RLS.
-- Idempotent: safe to run again.

create table if not exists public.sync_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null,
  record_id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  device_id text,
  primary key (user_id, table_name, record_id),
  constraint sync_records_table_name check (table_name in (
    'profile', 'subjects', 'topics', 'notes', 'materials', 'decks', 'cards', 'cardReviews', 'questions', 'attempts', 'answers',
    'exams', 'gradingScales', 'teacherGrades', 'sessions', 'xpEvents', 'achievements', 'tutorChats', 'meta', 'events', 'tasks', 'eventCategories'
  )),
  constraint sync_records_record_id check (char_length(record_id) between 1 and 200),
  constraint sync_records_device_id check (device_id is null or char_length(device_id) <= 64),
  -- a live record needs data, a deletion (tombstone) carries none
  constraint sync_records_payload check ((deleted and data is null) or (not deleted and data is not null)),
  constraint sync_records_size check (data is null or pg_column_size(data) <= 2000000)
);

comment on table public.sync_records is 'Study OS: one row per synced local record (JSON), isolated per user by RLS. Tombstones mark deletions.';

-- incremental pulls: "everything of this user changed since …"
create index if not exists sync_records_user_updated_idx on public.sync_records (user_id, updated_at);

-- The server sets the timestamp (clients cannot backdate or postdate rows) and the owner can never change.
create or replace function public.sync_records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_records_before_write on public.sync_records;
create trigger sync_records_before_write
  before insert or update on public.sync_records
  for each row execute function public.sync_records_before_write();

alter table public.sync_records enable row level security;
alter table public.sync_records force row level security;

drop policy if exists sync_records_select_own on public.sync_records;
drop policy if exists sync_records_insert_own on public.sync_records;
drop policy if exists sync_records_update_own on public.sync_records;
drop policy if exists sync_records_delete_own on public.sync_records;

create policy sync_records_select_own on public.sync_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sync_records_insert_own on public.sync_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sync_records_update_own on public.sync_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sync_records_delete_own on public.sync_records
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No access at all without sign-in; signed-in users only through the policies above.
revoke all on public.sync_records from anon;
revoke all on public.sync_records from public;
grant select, insert, update, delete on public.sync_records to authenticated;
revoke execute on function public.sync_records_before_write() from public, anon, authenticated;
