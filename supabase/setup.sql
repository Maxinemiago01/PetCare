-- Run once in the Supabase SQL Editor for the Petcare project.
-- Quoted column names match Angular models so the REST API returns usable JSON.
begin;

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  species text not null default 'Dog' check (species in ('Dog', 'Cat', 'Rabbit', 'Bird', 'Other')),
  breed text not null default '' check (length(breed) <= 100),
  sex text not null default 'Unknown' check (sex in ('Unknown', 'Female', 'Male')),
  birthday text not null default '' check (
    birthday = '' or (birthday ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and birthday::date <= current_date)
  ),
  "weightKg" numeric(7, 2) check ("weightKg" > 0 and "weightKg" <= 1000),
  allergies text not null default '' check (length(allergies) <= 500),
  notes text not null default '' check (length(notes) <= 2000),
  "imagePath" text not null default '' check (
    "imagePath" = '' or "imagePath" like owner_id::text || '/%'
  ),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.pet_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "petId" uuid not null,
  category text not null check (category in ('vaccination', 'medical', 'health')),
  title text not null check (length(trim(title)) between 1 and 150),
  date date not null default current_date check (date <= current_date),
  "nextDate" text not null default '' check (
    "nextDate" = '' or ("nextDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and "nextDate"::date >= date)
  ),
  veterinarian text not null default '' check (length(veterinarian) <= 150),
  "weightKg" numeric(7, 2) check ("weightKg" > 0 and "weightKg" <= 1000),
  notes text not null default '' check (length(notes) <= 3000),
  "createdAt" timestamptz not null default now(),
  foreign key ("petId", owner_id) references public.pets(id, owner_id) on delete cascade
);

create index if not exists pets_owner_id_idx on public.pets(owner_id);
create index if not exists pet_records_owner_pet_idx on public.pet_records(owner_id, "petId");
create index if not exists pet_records_pet_owner_idx on public.pet_records("petId", owner_id);

alter table public.pets enable row level security;
alter table public.pet_records enable row level security;
revoke all on public.pets, public.pet_records from anon;
grant select, insert, update, delete on public.pets, public.pet_records to authenticated;

drop policy if exists "Petcare owners manage their pets" on public.pets;
create policy "Petcare owners manage their pets"
  on public.pets for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Petcare owners manage their records" on public.pet_records;
create policy "Petcare owners manage their records"
  on public.pet_records for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg'];

-- Each photo is stored at <signed-in-user-id>/<random-id>.jpg.
drop policy if exists "Petcare owners manage their photos" on storage.objects;
create policy "Petcare owners manage their photos"
  on storage.objects for all to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

notify pgrst, 'reload schema';
commit;
