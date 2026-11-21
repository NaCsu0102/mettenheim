-- =====================================================================
--  Гильдии, цеха, ордена и общества Меттенхейма.
--  Выполнить после schema.sql: Supabase → SQL Editor → New query → вставить → Run.
--  Повторный запуск безопасен: ничего не стирает.
--
--  Как устроено:
--  · основать гильдию может любой, у кого есть принятый персонаж, — он становится главой;
--  · вступают персонажи (а не игроки): заявка → глава или офицер принимает;
--  · до 3 участников гильдия «собирается», с 3 — «действует»; мастер может дать отметку
--    «Признана городом» и отправить гильдию в архив;
--  · всё меняется только через функции ниже — права проверяются внутри них.
-- =====================================================================

-- ---------- Гильдии ----------
create table if not exists public.guilds (
  id          bigserial primary key,
  name        text not null check (char_length(name) between 3 and 80),
  kind        text not null default 'guild' check (kind in ('guild', 'workshop', 'order', 'society', 'artel', 'service')),
  house       text not null default '' check (house in ('', 'talbot', 'dorn')),
  district    text not null default '' check (char_length(district) <= 60),
  short       text not null default '' check (char_length(short) <= 160),
  about       text not null default '' check (char_length(about) <= 4000),
  goals       text not null default '' check (char_length(goals) <= 2000),
  charter     text not null default '' check (char_length(charter) <= 4000),
  recruit     text not null default '' check (char_length(recruit) <= 300),   -- «Ищем: …»
  recruit_open boolean not null default true,
  relations   text not null default '' check (char_length(relations) <= 2000),
  emblem_url  text not null default '' check (emblem_url = '' or emblem_url like 'https://%'),
  status      text not null default 'forming' check (status in ('forming', 'active', 'archived')),
  official    boolean not null default false,                                 -- «Признана городом» — ставит мастер
  leader      uuid references public.profiles (id) on delete set null,
  leader_char uuid references public.characters (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists guilds_name_uniq on public.guilds (lower(name));

-- ---------- Состав ----------
create table if not exists public.guild_members (
  guild_id     bigint not null references public.guilds (id) on delete cascade,
  character_id uuid   not null references public.characters (id) on delete cascade,
  profile_id   uuid   not null references public.profiles (id) on delete cascade,
  rank         text   not null default 'pending' check (rank in ('leader', 'officer', 'member', 'pending')),
  title        text   not null default '' check (char_length(title) <= 40),    -- должность: «мастер цеха», «казначей»
  message      text   not null default '' check (char_length(message) <= 500), -- текст заявки
  joined_at    timestamptz not null default now(),
  primary key (guild_id, character_id)
);
create index if not exists guild_members_profile on public.guild_members (profile_id);

-- ---------- Объявления и летопись ----------
create table if not exists public.guild_posts (
  id         bigserial primary key,
  guild_id   bigint not null references public.guilds (id) on delete cascade,
  kind       text   not null default 'news' check (kind in ('news', 'chronicle')),
  title      text   not null check (char_length(title) between 1 and 120),
  body       text   not null default '' check (char_length(body) <= 6000),
  author     uuid   default auth.uid() references public.profiles (id) on delete set null,
  author_name text  not null default '',
  created_at timestamptz not null default now()
);
create index if not exists guild_posts_guild on public.guild_posts (guild_id, created_at desc);

-- ---------- Проверки прав ----------
create or replace function public.guild_rank(gid bigint) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select m.rank from public.guild_members m
                   where m.guild_id = gid and m.profile_id = auth.uid() and m.rank <> 'pending'
                   order by case m.rank when 'leader' then 0 when 'officer' then 1 else 2 end limit 1), '');
$$;
create or replace function public.guild_can_manage(gid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.guild_rank(gid) in ('leader', 'officer');
$$;
create or replace function public.guild_char_ok(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.characters c where c.id = ch and c.owner = auth.uid() and c.status = 'approved');
$$;
-- «N | Имя» персонажа для подписи
create or replace function public.guild_char_name(ch uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(c.number || ' | ', '') || c.name from public.characters c where c.id = ch), 'Житель');
$$;

-- ---------- Защита полей: «признание» и архив — только мастер, глава меняется только передачей ----------
create or replace function public.guard_guild() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if new.official is distinct from old.official then new.official := old.official; end if;
    if new.leader is distinct from old.leader or new.leader_char is distinct from old.leader_char then
      if current_setting('mh.guild_transfer', true) is distinct from '1' then
        new.leader := old.leader; new.leader_char := old.leader_char;
      end if;
    end if;
    if new.status is distinct from old.status and current_setting('mh.guild_refresh', true) is distinct from '1' then
      -- глава может сам распустить гильдию в архив, вернуть из архива — только мастер
      if not (new.status = 'archived' and public.guild_rank(old.id) = 'leader') then new.status := old.status; end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guilds_guard on public.guilds;
create trigger guilds_guard before update on public.guilds for each row execute function public.guard_guild();

-- Статус по числу участников: до 3 — собирается, с 3 — действует (архив не трогаем).
-- Помечаем вызов, чтобы защита полей пропустила смену статуса.
create or replace function public.guild_refresh(gid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('mh.guild_refresh', '1', true);
  update public.guilds g set status = case
      when (select count(*) from public.guild_members m where m.guild_id = gid and m.rank <> 'pending') >= 3 then 'active'
      else 'forming' end
  where g.id = gid and g.status <> 'archived';
  perform set_config('mh.guild_refresh', '', true);
end $$;

-- ---------- Права доступа к таблицам ----------
alter table public.guilds        enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_posts   enable row level security;

drop policy if exists guilds_read on public.guilds;
drop policy if exists guilds_edit on public.guilds;
create policy guilds_read on public.guilds for select to anon, authenticated using (true);
create policy guilds_edit on public.guilds for update to authenticated
  using (public.guild_can_manage(id)) with check (public.guild_can_manage(id));

-- состав читается через guild_roster(); напрямую — только свои строки, руководство гильдии и мастера
drop policy if exists gm_read on public.guild_members;
create policy gm_read on public.guild_members for select to authenticated
  using (profile_id = auth.uid() or public.guild_can_manage(guild_id));

drop policy if exists gp_read on public.guild_posts;
drop policy if exists gp_add on public.guild_posts;
drop policy if exists gp_del on public.guild_posts;
create policy gp_read on public.guild_posts for select to anon, authenticated using (true);
create policy gp_add on public.guild_posts for insert to authenticated
  with check (author = auth.uid() and public.guild_can_manage(guild_id));
create policy gp_del on public.guild_posts for delete to authenticated
  using (author = auth.uid() or public.guild_can_manage(guild_id));

grant select on public.guilds, public.guild_posts to anon, authenticated;
grant update on public.guilds to authenticated;
grant select on public.guild_members to authenticated;
grant insert, delete on public.guild_posts to authenticated;
grant usage, select on sequence public.guild_posts_id_seq to authenticated;

-- подпись автора объявления
create or replace function public.guild_post_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author := auth.uid();
  new.author_name := coalesce((select d.author from public.display_of(auth.uid()) d), 'Житель');
  return new;
end $$;
drop trigger if exists guild_posts_fill on public.guild_posts;
create trigger guild_posts_fill before insert on public.guild_posts for each row execute function public.guild_post_fill();

-- =====================================================================
--  Функции для сайта
-- =====================================================================

-- Список гильдий с числом участников и главой
create or replace function public.guild_list()
returns table (id bigint, name text, kind text, house text, district text, short text, recruit text, recruit_open boolean,
               emblem_url text, status text, official boolean, members bigint, leader_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.kind, g.house, g.district, g.short, g.recruit, g.recruit_open, g.emblem_url, g.status, g.official,
         (select count(*) from public.guild_members m where m.guild_id = g.id and m.rank <> 'pending'),
         public.guild_char_name(g.leader_char), g.created_at
  from public.guilds g
  order by g.official desc, (g.status = 'archived'), g.created_at desc;
$$;

-- Состав гильдии: только принятые участники и безопасные поля
create or replace function public.guild_roster(gid bigint)
returns table (character_id uuid, number int, name text, p text, o text, c text, g text, rank text, title text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.number, c.name, c.data ->> 'p', c.data ->> 'o', c.data ->> 'c', c.data ->> 'g', m.rank, m.title, m.joined_at
  from public.guild_members m join public.characters c on c.id = m.character_id
  where m.guild_id = gid and m.rank <> 'pending'
  order by case m.rank when 'leader' then 0 when 'officer' then 1 else 2 end, m.joined_at;
$$;

-- Заявки на вступление — видят глава, офицеры и мастера
create or replace function public.guild_requests(gid bigint)
returns table (character_id uuid, name text, message text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.character_id, public.guild_char_name(m.character_id), m.message, m.joined_at
  from public.guild_members m
  where m.guild_id = gid and m.rank = 'pending' and public.guild_can_manage(gid)
  order by m.joined_at;
$$;

-- Мои гильдии (для кабинета и кнопок на странице гильдии)
create or replace function public.guild_mine()
returns table (guild_id bigint, guild_name text, character_id uuid, char_name text, rank text, title text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, m.character_id, public.guild_char_name(m.character_id), m.rank, m.title
  from public.guild_members m join public.guilds g on g.id = m.guild_id
  where m.profile_id = auth.uid()
  order by g.name;
$$;

-- Основать гильдию: персонаж должен быть принят; не больше 2 гильдий во главе у одного игрока
create or replace function public.guild_create(p_name text, p_kind text, p_house text, p_short text, p_char uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare gid bigint;
begin
  if auth.uid() is null then raise exception 'Войди в кабинет'; end if;
  if not public.guild_char_ok(p_char) then raise exception 'Основать гильдию может только принятый персонаж'; end if;
  if (select count(*) from public.guilds where leader = auth.uid() and status <> 'archived') >= 2 then
    raise exception 'Во главе у тебя уже две гильдии — больше нельзя';
  end if;
  if exists (select 1 from public.guilds where lower(name) = lower(trim(p_name))) then
    raise exception 'Гильдия с таким названием уже есть';
  end if;
  insert into public.guilds (name, kind, house, short, leader, leader_char)
    values (trim(p_name), coalesce(nullif(p_kind, ''), 'guild'), coalesce(p_house, ''), coalesce(p_short, ''), auth.uid(), p_char)
    returning id into gid;
  insert into public.guild_members (guild_id, character_id, profile_id, rank) values (gid, p_char, auth.uid(), 'leader');
  return gid;
end $$;

-- Подать заявку персонажем
create or replace function public.guild_apply(gid bigint, p_char uuid, p_msg text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.guild_char_ok(p_char) then raise exception 'Вступать может только принятый персонаж'; end if;
  if not exists (select 1 from public.guilds where id = gid and status <> 'archived' and recruit_open) then
    raise exception 'Набор в эту гильдию закрыт';
  end if;
  if exists (select 1 from public.guild_members where guild_id = gid and character_id = p_char) then
    raise exception 'Этот персонаж уже в гильдии или ждёт ответа';
  end if;
  insert into public.guild_members (guild_id, character_id, profile_id, rank, message)
    values (gid, p_char, auth.uid(), 'pending', left(coalesce(p_msg, ''), 500));
end $$;

-- Принять или отклонить заявку
create or replace function public.guild_decide(gid bigint, p_char uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.guild_can_manage(gid) then raise exception 'Решать заявки могут глава и офицеры'; end if;
  if p_accept then
    update public.guild_members set rank = 'member', joined_at = now() where guild_id = gid and character_id = p_char and rank = 'pending';
  else
    delete from public.guild_members where guild_id = gid and character_id = p_char and rank = 'pending';
  end if;
  perform public.guild_refresh(gid);
end $$;

-- Звание и должность. 'leader' — передать главенство (только глава или мастер)
create or replace function public.guild_set_rank(gid bigint, p_char uuid, p_rank text, p_title text)
returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.guild_rank(gid); target record;
begin
  select * into target from public.guild_members where guild_id = gid and character_id = p_char and rank <> 'pending';
  if not found then raise exception 'Такого участника нет'; end if;
  if p_rank = 'leader' then
    if me <> 'leader' and not public.is_staff() then raise exception 'Передать главенство может только глава'; end if;
    update public.guild_members set rank = 'officer' where guild_id = gid and rank = 'leader';
    update public.guild_members set rank = 'leader', title = left(coalesce(p_title, title), 40) where guild_id = gid and character_id = p_char;
    perform set_config('mh.guild_transfer', '1', true);
    update public.guilds set leader = target.profile_id, leader_char = p_char where id = gid;
    perform set_config('mh.guild_transfer', '', true);
    return;
  end if;
  if p_rank not in ('officer', 'member') then raise exception 'Неизвестное звание'; end if;
  if target.rank = 'leader' then raise exception 'Главу меняют только передачей главенства'; end if;
  if p_rank <> target.rank and me <> 'leader' and not public.is_staff() then raise exception 'Звания раздаёт глава'; end if;
  if not public.guild_can_manage(gid) then raise exception 'Нет прав'; end if;
  update public.guild_members set rank = p_rank, title = left(coalesce(p_title, ''), 40) where guild_id = gid and character_id = p_char;
end $$;

-- Исключить участника (глава и офицеры; офицера — только глава) или выйти самому
create or replace function public.guild_remove(gid bigint, p_char uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare target record; me text := public.guild_rank(gid);
begin
  select * into target from public.guild_members where guild_id = gid and character_id = p_char;
  if not found then return; end if;
  if target.rank = 'leader' then raise exception 'Глава не может уйти — сначала передай главенство'; end if;
  if target.profile_id <> auth.uid() then
    if not public.guild_can_manage(gid) then raise exception 'Нет прав'; end if;
    if target.rank = 'officer' and me <> 'leader' and not public.is_staff() then raise exception 'Офицера исключает только глава'; end if;
  end if;
  delete from public.guild_members where guild_id = gid and character_id = p_char;
  perform public.guild_refresh(gid);
end $$;

-- Мастер: признание городом и архив
create or replace function public.guild_moderate(gid bigint, p_official boolean, p_archived boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Только для мастеров'; end if;
  update public.guilds set official = p_official, status = case when p_archived then 'archived' else 'forming' end where id = gid;
  if not p_archived then perform public.guild_refresh(gid); end if;
end $$;

grant execute on function public.guild_list(), public.guild_roster(bigint) to anon, authenticated;
grant execute on function public.guild_requests(bigint), public.guild_mine(),
  public.guild_create(text, text, text, text, uuid), public.guild_apply(bigint, uuid, text),
  public.guild_decide(bigint, uuid, boolean), public.guild_set_rank(bigint, uuid, text, text),
  public.guild_remove(bigint, uuid), public.guild_moderate(bigint, boolean, boolean) to authenticated;
revoke execute on function public.guild_refresh(bigint) from anon, authenticated, public;
