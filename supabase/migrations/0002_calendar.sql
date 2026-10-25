-- Study OS – calendar & planner (mirrors CalendarEvent, Task, EventCustomCategory in src/db/types.ts).
-- Still not connected to the app (local-first); kept in sync so a later sync needs no redesign.

alter table public.subjects add column if not exists icon text;
alter table public.exams add column if not exists start_time time;
alter table public.exams add column if not exists end_time time;
alter table public.exams add column if not exists location text not null default '';
alter table public.exams add column if not exists topic_confidence jsonb not null default '{}';
alter table public.exams add column if not exists estimated_prep_minutes integer check (estimated_prep_minutes is null or estimated_prep_minutes between 0 and 6000);

create table public.event_categories (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color smallint not null default 0 check (color between 0 and 9),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.calendar_events (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('lesson','study','flashcards','appointment','internship','break','custom')),
  custom_category_id text,
  subject_id text,
  date date not null,
  end_date date check (end_date is null or end_date >= date),
  all_day boolean not null default false,
  start_time time,
  end_time time,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  description text not null default '',
  location text not null default '',
  teacher text not null default '',
  topic_ids text[] not null default '{}',
  material_ids text[] not null default '{}',
  deck_id text,
  task_id text,
  exam_id text,
  workload_minutes integer check (workload_minutes is null or workload_minutes between 1 and 1440),
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 20160),
  checklist jsonb not null default '[]',
  recurrence jsonb,                      -- {freq, interval, byWeekday, until, count, exceptions}
  completed_dates date[] not null default '{}',
  series_id text,
  original_date date,
  source text not null default 'manual' check (source in ('manual','planner')),
  pinned boolean not null default false,
  blocks_study boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (all_day or (start_time is not null and end_time is not null and end_time > start_time))
);
create index calendar_events_date on public.calendar_events (user_id, date);

create table public.tasks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  kind text not null check (kind in ('homework','project','todo')),
  subject_id text,
  topic_ids text[] not null default '{}',
  material_id text,
  due_date date,
  due_time time check (due_time is null or due_date is not null),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes between 5 and 6000),
  status text not null default 'open' check (status in ('open','done')),
  done_at timestamptz,
  subtasks jsonb not null default '[]',
  reminder_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index tasks_due on public.tasks (user_id, status, due_date);

do $$
declare t text;
begin
  foreach t in array array['event_categories','calendar_events','tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;
