create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'supervisor', 'operador', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'viewer')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create table if not exists public.road_events (
  id text primary key,
  event_code text,
  created_by uuid references public.profiles(id) on delete set null,
  street_name text,
  sector text,
  severity text not null check (severity in ('good', 'warning', 'critical', 'repaired')),
  damage_type text not null,
  length_m numeric default 0,
  width_m numeric default 0,
  priority_score numeric default 0,
  status text not null default 'open',
  notes text,
  captured_at timestamptz not null default now(),
  repaired_at timestamptz,
  point_lat numeric,
  point_lng numeric,
  end_lat numeric,
  end_lng numeric,
  photos text[] default '{}',
  history jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id text references public.road_events(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.road_events enable row level security;
alter table public.event_photos enable row level security;

drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "admins can update profiles" on public.profiles;
create policy "admins can update profiles"
on public.profiles for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "authenticated users can read road events" on public.road_events;
create policy "authenticated users can read road events"
on public.road_events for select
to authenticated
using (true);

drop policy if exists "admins can insert road events" on public.road_events;
create policy "admins can insert road events"
on public.road_events for insert
to authenticated
with check (public.current_user_role() = 'admin');

drop policy if exists "admins can update road events" on public.road_events;
create policy "admins can update road events"
on public.road_events for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admins can delete road events" on public.road_events;
create policy "admins can delete road events"
on public.road_events for delete
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists "authenticated users can read event photos" on public.event_photos;
create policy "authenticated users can read event photos"
on public.event_photos for select
to authenticated
using (true);

drop policy if exists "admins can write event photos" on public.event_photos;
create policy "admins can write event photos"
on public.event_photos for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "authenticated users can read event storage" on storage.objects;
create policy "authenticated users can read event storage"
on storage.objects for select
to authenticated
using (bucket_id = 'event-photos');

drop policy if exists "admins can upload event storage" on storage.objects;
create policy "admins can upload event storage"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-photos' and public.current_user_role() = 'admin');

drop policy if exists "admins can update event storage" on storage.objects;
create policy "admins can update event storage"
on storage.objects for update
to authenticated
using (bucket_id = 'event-photos' and public.current_user_role() = 'admin')
with check (bucket_id = 'event-photos' and public.current_user_role() = 'admin');

drop policy if exists "admins can delete event storage" on storage.objects;
create policy "admins can delete event storage"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-photos' and public.current_user_role() = 'admin');
