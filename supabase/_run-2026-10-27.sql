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
-- =====================================================================
--  Живой сервер: новости и события из Discord, счёт Домов, страница персонажа.
--  Выполнить после schema.sql, chat.sql и portraits.sql. Повторный запуск безопасен.
-- =====================================================================

-- Картинки новостей и событий (бот копирует их из Discord, чтобы ссылки не протухали)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

-- Новости: копия канала анонсов Discord. Пишет только бот, читают все (сайт и лаунчер).
create table if not exists public.news (
  discord_id  text primary key,
  author      text not null default '',
  avatar      text not null default '',
  body        text not null default '',
  images      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index if not exists news_created on public.news (created_at desc);
alter table public.news enable row level security;
drop policy if exists news_read on public.news;
create policy news_read on public.news for select to anon, authenticated using (true);
grant select on public.news to anon, authenticated;

-- События: копия запланированных событий сервера Discord
create table if not exists public.events (
  id           text primary key,
  name         text not null default '',
  description  text not null default '',
  starts_at    timestamptz,
  ends_at      timestamptz,
  location     text not null default '',
  image        text not null default '',
  interested   int not null default 0,
  status       int not null default 1,
  updated_at   timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to anon, authenticated using (true);
grant select on public.events to anon, authenticated;

-- Счёт Домов: общий пул очков фракции
create table if not exists public.faction_score (
  house      text primary key check (house in ('talbot', 'dorn')),
  points     int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.faction_score (house) values ('talbot'), ('dorn') on conflict do nothing;
alter table public.faction_score enable row level security;
drop policy if exists faction_read on public.faction_score;
create policy faction_read on public.faction_score for select to anon, authenticated using (true);
grant select on public.faction_score to anon, authenticated;

-- Журнал начислений. Пишут мастера, читают все.
create table if not exists public.faction_log (
  id         bigserial primary key,
  house      text not null check (house in ('talbot', 'dorn')),
  delta      int not null check (delta between -1000 and 1000 and delta <> 0),
  reason     text not null default '' check (length(reason) <= 300),
  author     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists faction_log_created on public.faction_log (created_at desc);
alter table public.faction_log enable row level security;
drop policy if exists faction_log_read on public.faction_log;
drop policy if exists faction_log_write on public.faction_log;
create policy faction_log_read on public.faction_log for select to anon, authenticated using (true);
create policy faction_log_write on public.faction_log for insert to authenticated with check (public.is_staff());
grant select on public.faction_log to anon, authenticated;
grant insert on public.faction_log to authenticated;
grant usage on sequence public.faction_log_id_seq to authenticated;

create or replace function public.faction_apply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author := auth.uid();
  update public.faction_score set points = greatest(0, points + new.delta), updated_at = now() where house = new.house;
  return new;
end $$;
drop trigger if exists faction_apply on public.faction_log;
create trigger faction_apply before insert on public.faction_log
  for each row execute function public.faction_apply();

-- Обновления сразу на открытых страницах
do $$ declare t text; begin
  foreach t in array array['news', 'events', 'faction_score'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Открытая карточка принятого персонажа: без квенты и без данных игрока
create or replace function public.hero(n int)
returns table (number int, name text, portrait_url text, p text, o text, c text, g text, house text, age text,
               bg text, u text, cu text, ik text, faith text, prof text, traits text, goal text, approved_at timestamptz, channel text)
language sql stable security definer set search_path = public as $$
  select c.number, c.name, c.portrait_url, c.data ->> 'p', c.data ->> 'o', c.data ->> 'c', c.data ->> 'g', c.data ->> 'house', c.data ->> 'age',
         c.data ->> 'bg', c.data ->> 'u', c.data ->> 'cu', c.data ->> 'ik', c.data ->> 'faith', c.data ->> 'prof', c.data ->> 'traits', c.data ->> 'goal',
         c.reviewed_at, c.discord_channel_id
  from public.characters c
  where c.status = 'approved' and c.number = n;
$$;
grant execute on function public.hero(int) to anon, authenticated;
