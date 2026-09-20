-- Rich, normalized applicant profiles. Safe to apply after the MVP migration.

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state_province text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists timezone text,
  add column if not exists willing_to_relocate boolean,
  add column if not exists availability_start_date date,
  add column if not exists short_bio text,
  add column if not exists has_no_employment_history boolean not null default false;

-- Preserve a useful portion of the legacy free-form location where possible.
update public.profiles
set city = location
where city is null and nullif(trim(location), '') is not null;

create type public.profile_link_type as enum (
  'LINKEDIN', 'GITHUB', 'PORTFOLIO', 'PERSONAL_WEBSITE', 'OTHER'
);

create table public.profile_educations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  school text not null check (length(trim(school)) > 0),
  degree text,
  field_of_study text,
  start_month smallint check (start_month between 1 and 12),
  start_year smallint check (start_year between 1900 and 2200),
  end_month smallint check (end_month between 1 and 12),
  end_year smallint check (end_year between 1900 and 2200),
  is_current boolean not null default false,
  gpa text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_employments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null check (length(trim(company)) > 0),
  title text not null check (length(trim(title)) > 0),
  location text,
  start_month smallint check (start_month between 1 and 12),
  start_year smallint check (start_year between 1900 and 2200),
  end_month smallint check (end_month between 1 and 12),
  end_year smallint check (end_year between 1900 and 2200),
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.profile_link_type not null,
  label text,
  url text not null check (length(trim(url)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profile_educations_profile_id_idx on public.profile_educations (profile_id);
create index profile_employments_profile_id_idx on public.profile_employments (profile_id);
create index profile_links_profile_id_idx on public.profile_links (profile_id);

create trigger profile_educations_set_updated_at before update on public.profile_educations
for each row execute function public.set_updated_at();
create trigger profile_employments_set_updated_at before update on public.profile_employments
for each row execute function public.set_updated_at();
create trigger profile_links_set_updated_at before update on public.profile_links
for each row execute function public.set_updated_at();

alter table public.profile_educations enable row level security;
alter table public.profile_employments enable row level security;
alter table public.profile_links enable row level security;

revoke all on public.profile_educations, public.profile_employments, public.profile_links
from anon, authenticated;
grant all on public.profile_educations, public.profile_employments, public.profile_links
to service_role;

-- Convert the original lower-case document enum without losing existing rows.
alter table public.documents alter column "type" type text using "type"::text;
drop type public.document_type;
create type public.document_type as enum ('RESUME', 'COVER_LETTER', 'TRANSCRIPT', 'OTHER');
alter table public.documents
  alter column "type" type public.document_type
  using upper("type")::public.document_type;

alter table public.documents
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint check (file_size_bytes >= 0),
  add column if not exists is_primary boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();

create index documents_profile_id_idx on public.documents (profile_id);
create index documents_profile_type_idx on public.documents (profile_id, type);

-- Promote at most one existing resume per profile before enforcing uniqueness.
with ranked_resumes as (
  select id, row_number() over (partition by profile_id order by created_at desc, id) as position
  from public.documents
  where type = 'RESUME'
)
update public.documents as documents
set is_primary = (ranked_resumes.position = 1)
from ranked_resumes
where documents.id = ranked_resumes.id;

create unique index documents_one_primary_resume_per_profile_idx
on public.documents (profile_id)
where type = 'RESUME' and is_primary;

-- Copy legacy education once. Graduation values remain intact on profiles and
-- recognizable month/year values are also normalized into the education row.
insert into public.profile_educations (
  profile_id,
  school,
  degree,
  end_month,
  end_year
)
select
  profile.id,
  trim(profile.school),
  nullif(trim(profile.degree), ''),
  case
    when lower(profile.graduation_date) ~ 'jan' then 1
    when lower(profile.graduation_date) ~ 'feb' then 2
    when lower(profile.graduation_date) ~ 'mar' then 3
    when lower(profile.graduation_date) ~ 'apr' then 4
    when lower(profile.graduation_date) ~ 'may' then 5
    when lower(profile.graduation_date) ~ 'jun' then 6
    when lower(profile.graduation_date) ~ 'jul' then 7
    when lower(profile.graduation_date) ~ 'aug' then 8
    when lower(profile.graduation_date) ~ 'sep' then 9
    when lower(profile.graduation_date) ~ 'oct' then 10
    when lower(profile.graduation_date) ~ 'nov' then 11
    when lower(profile.graduation_date) ~ 'dec' then 12
    when profile.graduation_date ~ '^[12][0-9]{3}-(0[1-9]|1[0-2])'
      then substring(profile.graduation_date from 6 for 2)::smallint
    else null
  end,
  case
    when profile.graduation_date ~ '([12][0-9]{3})'
      then substring(profile.graduation_date from '([12][0-9]{3})')::smallint
    else null
  end
from public.profiles as profile
where nullif(trim(profile.school), '') is not null
  and not exists (
    select 1 from public.profile_educations as education
    where education.profile_id = profile.id
      and lower(education.school) = lower(trim(profile.school))
  );

insert into public.profile_links (profile_id, type, label, url)
select id, 'LINKEDIN', 'LinkedIn', trim(linkedin_url)
from public.profiles
where nullif(trim(linkedin_url), '') is not null
on conflict do nothing;

insert into public.profile_links (profile_id, type, label, url)
select id, 'GITHUB', 'GitHub', trim(github_url)
from public.profiles
where nullif(trim(github_url), '') is not null
on conflict do nothing;

insert into public.profile_links (profile_id, type, label, url)
select id, 'PORTFOLIO', 'Portfolio', trim(portfolio_url)
from public.profiles
where nullif(trim(portfolio_url), '') is not null
on conflict do nothing;

-- Keep the existing bucket private and retain its 10 MiB object limit.
update storage.buckets
set public = false, file_size_limit = 10485760
where id = 'application-documents';
