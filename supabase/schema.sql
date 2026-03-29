-- ============================================================
-- FORM Sports Biomechanics App — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  sport text,
  created_at timestamptz default now()
);

-- 2. Sessions table
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  movement_type text not null check (movement_type in ('lateral_cut', 'jump_landing', 'squat', 'deadlift', 'lunge', 'plank', 'overhead_press', 'sprint')),
  timestamp timestamptz default now(),
  video_url text,
  video_expires_at timestamptz,
  pose_data jsonb,
  pose_skeleton_summary jsonb,
  scores jsonb,
  detected_issues jsonb,
  ai_feedback text,
  rep_count int,
  duration_seconds float
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Sessions policies
create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE SETUP (run after creating bucket in dashboard)
-- ============================================================
-- STEP 1: In Supabase Dashboard → Storage → New bucket
--   Name: session-videos
--   Public bucket: ON  ← toggle this on
--   Then come back and run the SQL below.

-- RLS on storage.objects (Supabase's actual storage policy table)
-- Drop existing policies first to avoid conflicts
drop policy if exists "Authenticated users can upload videos" on storage.objects;
drop policy if exists "Public read session videos" on storage.objects;
drop policy if exists "Users can delete own videos" on storage.objects;

-- Allow authenticated users to upload to session-videos bucket
create policy "Authenticated users can upload videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'session-videos');

-- Allow public read of session-videos
create policy "Public read session videos"
  on storage.objects for select
  to public
  using (bucket_id = 'session-videos');

-- Allow authenticated users to delete from session-videos
create policy "Users can delete own videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'session-videos');

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_timestamp_idx on public.sessions(timestamp desc);
create index if not exists sessions_video_expires_idx on public.sessions(video_expires_at)
  where video_url is not null;
