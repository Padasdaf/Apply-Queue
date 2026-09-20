-- Run once in the Supabase SQL editor if the original MVP migration was
-- applied with the non-versioned demo UUID. This script is safe to rerun.
begin;

do $$
declare
  old_profile_id constant uuid := '00000000-0000-0000-0000-000000000001';
  new_profile_id constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from public.profiles where id = old_profile_id) then
    -- Copy the existing profile before moving references. If the corrected row
    -- already exists, the original row remains the source of truth for repair.
    insert into public.profiles (
      id,
      first_name,
      last_name,
      email,
      phone,
      location,
      school,
      degree,
      graduation_date,
      linkedin_url,
      github_url,
      portfolio_url,
      work_authorization,
      requires_sponsorship,
      preferred_locations,
      created_at,
      updated_at
    )
    select
      new_profile_id,
      first_name,
      last_name,
      email,
      phone,
      location,
      school,
      degree,
      graduation_date,
      linkedin_url,
      github_url,
      portfolio_url,
      work_authorization,
      requires_sponsorship,
      preferred_locations,
      created_at,
      updated_at
    from public.profiles
    where id = old_profile_id
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      phone = excluded.phone,
      location = excluded.location,
      school = excluded.school,
      degree = excluded.degree,
      graduation_date = excluded.graduation_date,
      linkedin_url = excluded.linkedin_url,
      github_url = excluded.github_url,
      portfolio_url = excluded.portfolio_url,
      work_authorization = excluded.work_authorization,
      requires_sponsorship = excluded.requires_sponsorship,
      preferred_locations = excluded.preferred_locations;

    update public.applications
    set profile_id = new_profile_id
    where profile_id = old_profile_id;

    update public.documents
    set profile_id = new_profile_id
    where profile_id = old_profile_id;

    delete from public.profiles where id = old_profile_id;
  end if;
end
$$;

commit;
