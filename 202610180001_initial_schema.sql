-- MediBridge Care initial schema. Apply in Supabase SQL Editor or with Supabase CLI.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('patient','doctor','hospital_admin','platform_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('requested','confirmed','cancelled','completed');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en','ta')),
  role public.app_role not null default 'patient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  state text not null default 'Tamil Nadu',
  postal_code text,
  phone text,
  latitude double precision,
  longitude double precision,
  website text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  full_name text not null,
  specialty text not null,
  license_number text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  status public.appointment_status not null default 'requested',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  record_type text not null default 'general',
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.allergies (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.profiles(id) on delete cascade,
  substance text not null, reaction text, severity text check (severity is null or severity in ('mild','moderate','severe','unknown')),
  created_at timestamptz not null default now()
);
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, dosage text, instructions text, prescribed_by text, start_date date, end_date date,
  created_at timestamptz not null default now()
);
create table if not exists public.vitals (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.profiles(id) on delete cascade,
  systolic_bp integer, diastolic_bp integer, heart_rate integer, temperature_c numeric(4,1), weight_kg numeric(5,2), recorded_at timestamptz not null default now(), notes text
);
create table if not exists public.care_articles (
  id uuid primary key default gen_random_uuid(), title text not null, summary text not null, body text not null,
  category text not null default 'wellness', language text not null default 'en' check (language in ('en','ta')),
  reviewed_by text, published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null, granted boolean not null, policy_version text not null, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
  action text not null, resource_type text not null, resource_id text, created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.health_records enable row level security;
alter table public.allergies enable row level security;
alter table public.medications enable row level security;
alter table public.vitals enable row level security;
alter table public.care_articles enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile read self or platform admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.current_app_role() = 'platform_admin');
create policy "profile update self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = public.current_app_role());
create policy "profile insert self" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "hospitals public read" on public.hospitals for select to anon, authenticated using (true);
create policy "doctors public read active" on public.doctors for select to anon, authenticated using (active = true);
create policy "appointments patient or assigned doctor read" on public.appointments for select to authenticated using (patient_id = (select auth.uid()) or doctor_id in (select id from public.doctors where profile_id = (select auth.uid())) or public.current_app_role() = 'platform_admin');
create policy "patients create own appointments" on public.appointments for insert to authenticated with check (patient_id = (select auth.uid()));
create policy "patients cancel own requested appointments" on public.appointments for update to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy "patient records private" on public.health_records for select to authenticated using (patient_id = (select auth.uid()) or public.current_app_role() = 'platform_admin');
create policy "patient creates own records" on public.health_records for insert to authenticated with check (patient_id = (select auth.uid()));
create policy "patient updates own records" on public.health_records for update to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy "patient deletes own records" on public.health_records for delete to authenticated using (patient_id = (select auth.uid()));
create policy "allergies private to patient" on public.allergies for all to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy "medications private to patient" on public.medications for all to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy "vitals private to patient" on public.vitals for all to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy "published care articles public" on public.care_articles for select to anon, authenticated using (published = true);
create policy "consent records own" on public.consent_records for select to authenticated using (user_id = (select auth.uid()));
create policy "consent insert own" on public.consent_records for insert to authenticated with check (user_id = (select auth.uid()));
create policy "audit logs platform admin read" on public.audit_logs for select to authenticated using (public.current_app_role() = 'platform_admin');

create index if not exists appointments_patient_starts_idx on public.appointments(patient_id, starts_at);
create index if not exists appointments_doctor_starts_idx on public.appointments(doctor_id, starts_at);
create index if not exists health_records_patient_created_idx on public.health_records(patient_id, created_at desc);
create index if not exists doctors_hospital_idx on public.doctors(hospital_id);

-- Important: never allow a client to set its own role to doctor/admin. Role changes must be performed
-- through a trusted admin workflow / service-side function after verifying authorization.
