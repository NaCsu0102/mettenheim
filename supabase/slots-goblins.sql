-- =====================================================================
--  Лимит мест: инферналы 7, проклятые 7, гоблины 15.
--  Персонаж может занимать два места сразу (например, проклятый гоблин).
-- =====================================================================
create or replace function public.slot_kinds(d jsonb) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when d ->> 'p' = 'infernals' then 'infernal' end,
    case when d ->> 'u' = 'curse' and d ->> 'p' <> 'infernals' then 'curse' end,
    case when d ->> 'p' = 'goblins' then 'goblin' end
  ], null);
$$;
create or replace function public.slot_limit(kind text) returns int
language sql immutable as $$ select case kind when 'infernal' then 7 when 'curse' then 7 when 'goblin' then 15 else null end; $$;

create or replace function public.slot_counts() returns table (kind text, taken bigint, pending bigint)
language sql stable security definer set search_path = public as $$
  select k.kind,
    (select count(*) from public.characters c where k.kind = any(public.slot_kinds(c.data)) and c.status = 'approved'),
    (select count(*) from public.characters c where k.kind = any(public.slot_kinds(c.data)) and c.status = 'submitted')
  from (values ('infernal'), ('curse'), ('goblin')) as k(kind);
$$;
grant execute on function public.slot_counts() to anon, authenticated;

create or replace function public.guard_slots() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; taken int;
begin
  if new.status not in ('submitted', 'approved') then return new; end if;
  foreach k in array public.slot_kinds(new.data) loop
    if tg_op = 'UPDATE' and old.status = 'approved' and k = any(public.slot_kinds(old.data)) then continue; end if;
    select count(*) into taken from public.characters c
      where k = any(public.slot_kinds(c.data)) and c.status = 'approved' and c.id <> new.id;
    if taken >= public.slot_limit(k) then
      raise exception 'Все % мест для % заняты', public.slot_limit(k),
        case k when 'infernal' then 'инферналов' when 'goblin' then 'гоблинов' else 'проклятых' end;
    end if;
  end loop;
  return new;
end $$;
