-- Run this in Supabase SQL Editor to extend the profiles table
-- with fields needed for the profile page.

alter table public.profiles
  add column if not exists age int check (age > 0 and age < 120),
  add column if not exists height_cm float check (height_cm > 50 and height_cm < 280),
  add column if not exists weight_kg float check (weight_kg > 20 and weight_kg < 350),
  add column if not exists dominant_side text check (dominant_side in ('left', 'right')),
  add column if not exists fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  add column if not exists position text,
  add column if not exists past_injuries jsonb default '[]'::jsonb;
