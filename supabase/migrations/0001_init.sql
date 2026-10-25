-- Study OS – Supabase/PostgreSQL schema (migration path from the local IndexedDB version).
-- Status: NOT connected to the app yet. The app runs local-first; this schema mirrors src/db/types.ts
-- so a later sync/migration does not need a redesign. Every table is isolated per user via RLS.
-- Tested for syntax and policies with PGlite (npm run test:sql).

create extension if not exists pgcrypto;

-- ───────────── Profiles & settings ─────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  grade smallint not null default 9 check (grade between 1 and 13),
  school_type text not null default 'Gesamtschule',
  region text not null default 'Mecklenburg-Vorpommern',
  daily_goal_minutes smallint not null default 20 check (daily_goal_minutes between 5 and 240),
  weekly_goal_days smallint not null default 4 check (weekly_goal_days between 1 and 7),
  explanation_mode text not null default 'normal' check (explanation_mode in ('simple','normal','detailed','examples','steps')),
  quiz_difficulty text not null default 'adaptive',
  grading_scale_id text not null default 'scale-standard',
  rest_days smallint[] not null default '{0}',
  paused_until date,
  notifications jsonb not null default '{"enabled":false,"reminderTime":"16:00","examReminders":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grading_scales (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  thresholds jsonb not null,          -- [{grade:1..6, minPercent}]
  tendencies boolean not null default true,
  primary key (user_id, id)
);

-- ───────────── Curriculum ─────────────
create table public.subjects (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color smallint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, name)
);

create table public.topics (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  parent_id text,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  sort_order integer not null default 0,
  prerequisite_ids text[] not null default '{}',
  curriculum text not null default 'own' check (curriculum in ('example-unverified','own')),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete cascade
);
create index topics_subject_idx on public.topics (user_id, subject_id);

-- ───────────── Library ─────────────
create table public.materials (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text,
  topic_id text,
  title text not null,
  file_name text,
  mime_type text not null,
  size integer not null default 0,
  text text not null default '',
  sections jsonb not null default '[]',
  extraction jsonb not null,           -- {status, method, pages, pagesWithText, warnings[]}
  summary text not null default '',
  summary_source text not null default 'none' check (summary_source in ('none','extractive','ai')),
  tags text[] not null default '{}',
  storage_path text,                   -- original file in Supabase Storage (bucket "materials/{user_id}/…")
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.notes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text,
  topic_id text,
  title text not null check (char_length(title) between 1 and 150),
  content text not null default '',
  tags text[] not null default '{}',
  source_material_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index notes_fts_idx on public.notes using gin (to_tsvector('german', title || ' ' || content));
create index materials_fts_idx on public.materials using gin (to_tsvector('german', title || ' ' || text));

-- ───────────── Flashcards ─────────────
create table public.decks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text,
  topic_id text,
  name text not null,
  description text not null default '',
  front_lang text,
  back_lang text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.cards (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id text not null,
  topic_id text,
  front text not null,
  back text not null,
  example text not null default '',
  tags text[] not null default '{}',
  srs jsonb not null,                  -- {state, due, intervalDays, ease, reps, lapses, lastReviewed}
  due_at timestamptz not null,          -- copy of srs.due for indexing (kept in sync by the app)
  source_material_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, deck_id) references public.decks (user_id, id) on delete cascade
);
create index cards_due_idx on public.cards (user_id, due_at);

create table public.card_reviews (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  deck_id text not null,
  rating text not null check (rating in ('again','hard','good','easy')),
  at timestamptz not null,
  was_due boolean not null,
  interval_before integer not null,
  interval_after integer not null,
  primary key (user_id, id)
);

-- ───────────── Questions, attempts, answers ─────────────
create table public.questions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  topic_id text not null,
  type text not null check (type in ('mc','tf','text','numeric','math','vocab')),
  prompt text not null,
  payload jsonb not null,              -- options, answers, keywords, hints, steps, … (see Question type)
  difficulty smallint not null check (difficulty between 1 and 4),
  points numeric(5,1) not null default 1,
  source text not null check (source in ('library','user','generator','material','ai')),
  source_material_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index questions_topic_idx on public.questions (user_id, topic_id);

create table public.quiz_attempts (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  mode text not null check (mode in ('practice','exam')),
  title text not null,
  subject_id text,
  topic_ids text[] not null default '{}',
  question_snapshots jsonb not null,   -- questions frozen at start
  started_at timestamptz not null,
  finished_at timestamptz,
  score numeric(7,1) not null default 0,
  max_score numeric(7,1) not null default 0,
  percent numeric(5,2) not null default 0,
  grading_scale_id text not null,
  estimated_grade smallint check (estimated_grade between 1 and 6),
  exam_id text,
  plan_session_id text,
  duration_sec integer not null default 0,
  time_limit_min integer,
  primary key (user_id, id)
);

create table public.answers (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id text not null,
  question_id text not null,
  subject_id text not null,
  topic_id text not null,
  given text not null,
  correct boolean not null,
  score numeric(3,2) not null check (score between 0 and 1),
  at timestamptz not null,
  hints_used smallint not null default 0,
  time_ms integer not null default 0,
  mode text not null,
  self_assessed boolean not null default false,
  feedback text not null default '',
  error_tag text,
  primary key (user_id, id),
  foreign key (user_id, attempt_id) references public.quiz_attempts (user_id, id) on delete cascade
);
create index answers_topic_idx on public.answers (user_id, topic_id, at);
create index answers_question_idx on public.answers (user_id, question_id);

-- ───────────── Exams & plans ─────────────
create table public.exams (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  title text not null,
  type text not null,
  date date not null,
  topic_ids text[] not null default '{}',
  material_ids text[] not null default '{}',
  difficulty smallint not null check (difficulty between 1 and 3),
  minutes_per_day smallint not null check (minutes_per_day between 10 and 240),
  available_weekdays smallint[] not null,
  notes text not null default '',
  plan jsonb not null default '[]',     -- PlanSession[]
  plan_warnings text[] not null default '{}',
  plan_generated_at timestamptz,
  grading_scale_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.teacher_grades (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  exam_id text,
  title text not null,
  grade text not null check (grade ~ '^([1-6][+-]?|[1-6][.,][0-9]{1,2})$'),
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ───────────── Motivation & activity ─────────────
create table public.study_sessions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  started_at timestamptz not null,
  duration_sec integer not null check (duration_sec >= 0),
  activity text not null,
  subject_id text,
  items integer not null default 0,
  ref_id text,
  primary key (user_id, id)
);

create table public.xp_events (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null,
  day date not null,
  amount integer not null check (amount between 0 and 100),
  reason text not null,
  ref_id text,
  primary key (user_id, id)
);

create table public.achievements (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  unlocked_at timestamptz not null,
  primary key (user_id, id)
);

create table public.tutor_chats (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text,
  topic_id text,
  title text not null,
  mode text not null,
  material_ids text[] not null default '{}',
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ───────────── Row level security: every user sees only their own rows ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','grading_scales','subjects','topics','materials','notes','decks','cards','card_reviews',
    'questions','quiz_attempts','answers','exams','teacher_grades','study_sessions','xp_events','achievements','tutor_chats'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;
