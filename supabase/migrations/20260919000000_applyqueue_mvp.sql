create extension if not exists pgcrypto;

create type public.application_status as enum (
  'QUEUED', 'PROCESSING', 'NEEDS_INPUT', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED'
);

create type public.application_event_type as enum (
  'APPLICATION_CREATED', 'PROCESSING_STARTED', 'SESSION_CREATED',
  'NAVIGATED_TO_JOB', 'FOUND_APPLY_BUTTON', 'OPENED_APPLICATION',
  'FIELDS_DISCOVERED', 'FIELD_FILLED', 'NEEDS_INPUT',
  'READY_FOR_REVIEW', 'ERROR'
);

create type public.application_question_status as enum (
  'AUTO_ANSWERED', 'NEEDS_INPUT', 'ANSWERED_BY_USER'
);

create type public.document_type as enum ('resume', 'other');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  location text,
  school text,
  degree text,
  graduation_date text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  work_authorization text,
  requires_sponsorship boolean,
  preferred_locations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  company text,
  role text,
  status public.application_status not null default 'QUEUED',
  progress integer not null default 0 check (progress between 0 and 100),
  browserbase_session_id text,
  browserbase_session_url text,
  error_message text,
  processing_requested_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index applications_worker_queue_idx
  on public.applications (processing_requested_at, created_at)
  where status = 'QUEUED' and processing_requested_at is not null;

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type public.application_event_type not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index application_events_timeline_idx
  on public.application_events (application_id, created_at);

create table public.application_questions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  field_identifier text not null,
  question text not null,
  answer text,
  confidence double precision check (confidence between 0 and 1),
  status public.application_question_status not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, field_identifier)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.document_type not null,
  storage_path text not null,
  filename text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger application_questions_set_updated_at before update on public.application_questions
for each row execute function public.set_updated_at();

-- Atomically reserves one explicitly-started application for a worker.
create or replace function public.claim_next_application()
returns setof public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  select id into claimed_id
  from public.applications
  where status = 'QUEUED' and processing_requested_at is not null
  order by processing_requested_at asc
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  return query
  update public.applications
  set status = 'PROCESSING', progress = 5, started_at = now(), error_message = null
  where id = claimed_id
  returning *;
end;
$$;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.application_questions enable row level security;
alter table public.documents enable row level security;

revoke all on public.profiles, public.applications, public.application_events,
  public.application_questions, public.documents from anon, authenticated;
grant all on public.profiles, public.applications, public.application_events,
  public.application_questions, public.documents to service_role;
revoke execute on function public.claim_next_application() from public, anon, authenticated;
grant execute on function public.claim_next_application() to service_role;

insert into public.profiles (id, first_name, last_name, email)
values ('00000000-0000-4000-8000-000000000001', 'Demo', 'Applicant', 'demo@example.com')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "service role manages application documents"
on storage.objects for all to service_role
using (bucket_id = 'application-documents')
with check (bucket_id = 'application-documents');
