-- Optional database verification. Every fixture is rolled back at the end.
begin;

do $$
declare
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  pet_id uuid := gen_random_uuid();
  record_id uuid := gen_random_uuid();
  affected integer;
  rejected boolean;
begin
  insert into auth.users (id, email) values
    (owner_a, owner_a::text || '@example.invalid'),
    (owner_b, owner_b::text || '@example.invalid');

  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  execute 'set local role authenticated';

  insert into public.pets (id, name) values (pet_id, 'Temporary policy test');
  insert into public.pet_records (id, "petId", category, title)
    values (record_id, pet_id, 'health', 'Temporary health note');

  if not exists (select 1 from public.pets where id = pet_id and owner_id = owner_a) then
    raise exception 'Owner cannot read their own pet';
  end if;

  update public.pets set name = 'Updated policy test' where id = pet_id;
  if not exists (select 1 from public.pets where id = pet_id and name = 'Updated policy test') then
    raise exception 'Owner update did not persist';
  end if;

  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  if exists (select 1 from public.pets where id = pet_id) then
    raise exception 'A different owner can read the pet';
  end if;
  if exists (select 1 from public.pet_records where id = record_id) then
    raise exception 'A different owner can read the record';
  end if;

  update public.pets set name = 'Unauthorized edit' where id = pet_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'A different owner can edit the pet'; end if;

  rejected := false;
  begin
    insert into public.pets (owner_id, name) values (owner_a, 'Forged owner');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'A client can forge an owner ID'; end if;

  rejected := false;
  begin
    insert into public.pet_records ("petId", category, title)
      values (pet_id, 'health', 'Invalid cross-owner record');
  exception when foreign_key_violation then rejected := true;
  end;
  if not rejected then raise exception 'A record can reference another owner''s pet'; end if;

  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  delete from public.pets where id = pet_id;
  if exists (select 1 from public.pet_records where id = record_id) then
    raise exception 'Deleting the pet did not cascade to its records';
  end if;

  execute 'reset role';
end $$;

rollback;
select 'Owner CRUD, isolation, forged-owner rejection, and cascade deletion passed. All fixtures rolled back.' as result;
