-- =====================================================================
--  Хроники Меттенхейма · личный кабинет игрока и администратора
--  Выполнить один раз: Supabase → SQL Editor → New query → вставить → Run
-- =====================================================================

-- ---------- Профили игроков ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  discord     text not null default '',
  game_nick   text not null default '',
  timezone    text not null default '',
  about       text not null default '',
  avatar_url  text not null default '',
  role        text not null default 'player' check (role in ('player', 'master', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Персонажи и квенты ----------
create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references public.profiles (id) on delete cascade,
  name         text not null default '',
  status       text not null default 'draft'
               check (status in ('draft', 'submitted', 'revision', 'approved', 'rejected', 'archived')),
  data         jsonb not null default '{}'::jsonb,   -- поля анкеты: народ, класс, предыстория…
  quenta       text not null default '',
  portrait     text,                                 -- data:image/jpeg;base64,… до ~300 КБ
  tree         jsonb,                                -- сборка древа талантов
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  reviewer     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint quenta_size check (length(quenta) <= 60000),
  constraint portrait_size check (portrait is null or length(portrait) <= 400000)
);
create index if not exists characters_owner_idx on public.characters (owner);
create index if not exists characters_status_idx on public.characters (status, submitted_at);

-- ---------- История проверки ----------
create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  character_id uuid not null references public.characters (id) on delete cascade,
  author       uuid references public.profiles (id) on delete set null,
  verdict      text not null check (verdict in ('comment', 'submitted', 'withdrawn', 'revision', 'approved', 'rejected')),
  body         text not null default '',
  created_at   timestamptz not null default now(),
  constraint body_size check (length(body) <= 8000)
);
create index if not exists reviews_char_idx on public.reviews (character_id, created_at);

-- Номер персонажа выдаётся при принятии квенты, канал-кабинет создаёт бот
alter table public.characters add column if not exists number int unique;
alter table public.characters add column if not exists discord_channel_id text;
create sequence if not exists public.character_number_seq;

-- ---------- Кто мастер ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('master', 'admin'));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Профиль создаётся сам при первом входе ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, discord, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  ) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Защита полей ----------
-- Игрок не может сам выдать себе роль.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() пустой, когда запрос идёт из SQL-редактора Supabase: так назначается первый администратор
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Роль меняет только администратор';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Игрок правит квенту только в черновике или на доработке и может лишь отправить её или отозвать.
-- Мастер ставит вердикт. Каждая смена статуса пишется в историю.
create or replace function public.guard_character() returns trigger
language plpgsql security definer set search_path = public as $$
declare staff boolean := public.is_staff() or auth.uid() is null;
begin
  if tg_op = 'INSERT' then
    if not staff and new.status not in ('draft', 'submitted') then raise exception 'Новый персонаж — только черновик или заявка'; end if;
    new.owner := coalesce(new.owner, auth.uid());
    if new.status = 'submitted' then new.submitted_at := now(); end if;
    new.reviewer := null; new.reviewed_at := null;
    if not staff then new.number := null; new.discord_channel_id := null; end if;
    return new;
  end if;

  if not staff then
    new.owner := old.owner; new.reviewer := old.reviewer; new.reviewed_at := old.reviewed_at;
    new.number := old.number; new.discord_channel_id := old.discord_channel_id;
    if old.status not in ('draft', 'revision', 'submitted') then
      raise exception 'Принятую или отклонённую квенту правит только мастер';
    end if;
    if old.status = 'submitted' and new.status <> 'draft' and (new.quenta is distinct from old.quenta or new.data is distinct from old.data or new.name is distinct from old.name) then
      raise exception 'Квента на проверке. Отзови её, чтобы править';
    end if;
    if new.status not in ('draft', 'submitted') and not (new.status = 'revision' and old.status = 'revision') then raise exception 'Игрок может только сохранить черновик или отправить квенту'; end if;
  else
    if new.status in ('approved', 'rejected', 'revision') and new.status is distinct from old.status then
      new.reviewer := auth.uid(); new.reviewed_at := now();
    end if;
    if new.status = 'approved' and new.number is null then new.number := nextval('public.character_number_seq'); end if;
  end if;

  if new.status = 'submitted' and old.status is distinct from 'submitted' then new.submitted_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_character on public.characters;
create trigger guard_character before insert or update on public.characters
  for each row execute function public.guard_character();

create or replace function public.log_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('submitted', 'draft', 'revision', 'approved', 'rejected') then
    insert into public.reviews (character_id, author, verdict, body)
    values (new.id, auth.uid(),
      case new.status when 'submitted' then 'submitted' when 'draft' then 'withdrawn' else new.status end, '');
  end if;
  return new;
end $$;
drop trigger if exists log_status on public.characters;
create trigger log_status after update on public.characters
  for each row execute function public.log_status();

-- ---------- Ограниченные места: инферналы и проклятые (по 7) ----------
create or replace function public.slot_kind(d jsonb) returns text
language sql immutable as $$
  select case when d ->> 'p' = 'infernals' then 'infernal' when d ->> 'u' = 'curse' then 'curse' else null end;
$$;
create or replace function public.slot_limit(kind text) returns int
language sql immutable as $$ select case kind when 'infernal' then 7 when 'curse' then 7 else null end; $$;

-- Счётчик виден всем, даже без входа: только числа, без имён.
create or replace function public.slot_counts() returns table (kind text, taken bigint, pending bigint)
language sql stable security definer set search_path = public as $$
  select k.kind,
    (select count(*) from public.characters c where public.slot_kind(c.data) = k.kind and c.status = 'approved'),
    (select count(*) from public.characters c where public.slot_kind(c.data) = k.kind and c.status = 'submitted')
  from (values ('infernal'), ('curse')) as k(kind);
$$;
grant execute on function public.slot_counts() to anon, authenticated;

create or replace function public.guard_slots() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text := public.slot_kind(new.data); taken int;
begin
  if k is null or new.status not in ('submitted', 'approved') then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and public.slot_kind(old.data) = k then return new; end if;
  select count(*) into taken from public.characters c
    where public.slot_kind(c.data) = k and c.status = 'approved' and c.id <> new.id;
  if taken >= public.slot_limit(k) then
    raise exception 'Все % мест для % заняты', public.slot_limit(k), case k when 'infernal' then 'инферналов' else 'проклятых' end;
  end if;
  return new;
end $$;
drop trigger if exists guard_slots on public.characters;
create trigger guard_slots before insert or update on public.characters
  for each row execute function public.guard_slots();

-- ---------- Права доступа (RLS) ----------
alter table public.profiles   enable row level security;
alter table public.characters enable row level security;
alter table public.reviews    enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff()
         or exists (select 1 from public.characters c where c.owner = profiles.id and c.status = 'approved'));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "characters read" on public.characters;
create policy "characters read" on public.characters for select to authenticated
  using (owner = auth.uid() or public.is_staff() or status = 'approved');
drop policy if exists "characters insert own" on public.characters;
create policy "characters insert own" on public.characters for insert to authenticated
  with check (owner = auth.uid());
drop policy if exists "characters update" on public.characters;
create policy "characters update" on public.characters for update to authenticated
  using (owner = auth.uid() or public.is_staff()) with check (owner = auth.uid() or public.is_staff());
drop policy if exists "characters delete own draft" on public.characters;
create policy "characters delete own draft" on public.characters for delete to authenticated
  using ((owner = auth.uid() and status in ('draft', 'revision')) or public.is_admin());

drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews for select to authenticated
  using (public.is_staff() or exists (select 1 from public.characters c where c.id = character_id and c.owner = auth.uid()));
drop policy if exists "reviews write" on public.reviews;
create policy "reviews write" on public.reviews for insert to authenticated
  with check (author = auth.uid() and (
    public.is_staff()
    or (verdict = 'comment' and exists (select 1 from public.characters c where c.id = character_id and c.owner = auth.uid()))));

-- ---------- Первый администратор ----------
-- Войди на сайт через Discord один раз, затем выполни (подставь свой ник Discord):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'твоя@почта');
-- Дальше роли мастеров выдаются прямо в кабинете администратора.
-- Список жителей для сайта: только принятые персонажи и только безопасные поля
create or replace function public.residents()
returns table (number int, name text, p text, o text, c text, g text, house text, approved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.number, c.name, c.data ->> 'p', c.data ->> 'o', c.data ->> 'c', c.data ->> 'g', c.data ->> 'house', c.reviewed_at
  from public.characters c
  where c.status = 'approved'
  order by c.number nulls last;
$$;
grant execute on function public.residents() to anon, authenticated;
