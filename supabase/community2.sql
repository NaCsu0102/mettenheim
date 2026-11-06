-- =====================================================================
--  Сообщество, часть 2: реакции в чате и витрина артов.
--  Выполнить после chat.sql и portraits.sql. Повторный запуск безопасен.
-- =====================================================================

-- Имя игрока для подписи: «N | персонаж», если персонаж принят, иначе имя профиля
create or replace function public.display_of(uid uuid) returns table (author text, avatar text)
language sql stable security definer set search_path = public as $$
  select coalesce((select c.number || ' | ' || c.name from public.characters c
                    where c.owner = p.id and c.status = 'approved' order by c.number limit 1),
                  nullif(p.display_name, ''), nullif(p.discord, ''), 'Житель'),
         coalesce(case when p.portrait like 'https://%' then p.portrait end, p.avatar_url, '')
  from public.profiles p where p.id = uid;
$$;

/* ---------- реакции на сообщения чата ---------- */
create table if not exists public.chat_reactions (
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);
alter table public.chat_reactions enable row level security;
drop policy if exists chat_react_read on public.chat_reactions;
drop policy if exists chat_react_add on public.chat_reactions;
drop policy if exists chat_react_del on public.chat_reactions;
create policy chat_react_read on public.chat_reactions for select to anon, authenticated using (true);
create policy chat_react_add on public.chat_reactions for insert to authenticated with check (profile_id = auth.uid());
create policy chat_react_del on public.chat_reactions for delete to authenticated using (profile_id = auth.uid());
grant select on public.chat_reactions to anon, authenticated;
grant insert, delete on public.chat_reactions to authenticated;
alter table public.chat_reactions replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reactions') then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;

/* ---------- витрина артов ---------- */
create table if not exists public.gallery_arts (
  id         bigserial primary key,
  owner      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author     text not null default '',
  avatar     text not null default '',
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null default '' check (char_length(body) <= 600),
  house      text not null default '' check (house in ('', 'talbot', 'dorn')),
  image_url  text not null check (image_url like 'https://%'),
  path       text not null default '',
  likes      int not null default 0,
  comments   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_arts_created on public.gallery_arts (created_at desc);

create table if not exists public.gallery_likes (
  art_id     bigint not null references public.gallery_arts(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (art_id, profile_id)
);

create table if not exists public.gallery_comments (
  id         bigserial primary key,
  art_id     bigint not null references public.gallery_arts(id) on delete cascade,
  owner      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author     text not null default '',
  avatar     text not null default '',
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists gallery_comments_art on public.gallery_comments (art_id, created_at);

-- подпись автора и счётчики ставит сервер, а не браузер
create or replace function public.gallery_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.owner := auth.uid(); end if;
    select * into d from public.display_of(new.owner);
    new.author := coalesce(d.author, 'Житель'); new.avatar := coalesce(d.avatar, '');
    if tg_table_name = 'gallery_arts' then new.likes := 0; new.comments := 0; new.created_at := now(); end if;
  elsif tg_table_name = 'gallery_arts' and auth.uid() is not null and not public.is_staff() then
    new.owner := old.owner; new.author := old.author; new.avatar := old.avatar; new.image_url := old.image_url;
    new.path := old.path; new.likes := old.likes; new.comments := old.comments; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists gallery_arts_fill on public.gallery_arts;
create trigger gallery_arts_fill before insert or update on public.gallery_arts for each row execute function public.gallery_fill();
drop trigger if exists gallery_comments_fill on public.gallery_comments;
create trigger gallery_comments_fill before insert on public.gallery_comments for each row execute function public.gallery_fill();

create or replace function public.gallery_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'gallery_likes' then
    update public.gallery_arts set likes = (select count(*) from public.gallery_likes where art_id = coalesce(new.art_id, old.art_id)) where id = coalesce(new.art_id, old.art_id);
  else
    update public.gallery_arts set comments = (select count(*) from public.gallery_comments where art_id = coalesce(new.art_id, old.art_id)) where id = coalesce(new.art_id, old.art_id);
  end if;
  return null;
end $$;
drop trigger if exists gallery_likes_count on public.gallery_likes;
create trigger gallery_likes_count after insert or delete on public.gallery_likes for each row execute function public.gallery_count();
drop trigger if exists gallery_comments_count on public.gallery_comments;
create trigger gallery_comments_count after insert or delete on public.gallery_comments for each row execute function public.gallery_count();

alter table public.gallery_arts enable row level security;
alter table public.gallery_likes enable row level security;
alter table public.gallery_comments enable row level security;
drop policy if exists ga_read on public.gallery_arts;
drop policy if exists ga_add on public.gallery_arts;
drop policy if exists ga_edit on public.gallery_arts;
drop policy if exists ga_del on public.gallery_arts;
create policy ga_read on public.gallery_arts for select to anon, authenticated using (true);
create policy ga_add on public.gallery_arts for insert to authenticated with check (owner = auth.uid());
create policy ga_edit on public.gallery_arts for update to authenticated using (owner = auth.uid() or public.is_staff()) with check (true);
create policy ga_del on public.gallery_arts for delete to authenticated using (owner = auth.uid() or public.is_staff());
drop policy if exists gl_read on public.gallery_likes;
drop policy if exists gl_add on public.gallery_likes;
drop policy if exists gl_del on public.gallery_likes;
create policy gl_read on public.gallery_likes for select to anon, authenticated using (true);
create policy gl_add on public.gallery_likes for insert to authenticated with check (profile_id = auth.uid());
create policy gl_del on public.gallery_likes for delete to authenticated using (profile_id = auth.uid());
drop policy if exists gc_read on public.gallery_comments;
drop policy if exists gc_add on public.gallery_comments;
drop policy if exists gc_del on public.gallery_comments;
create policy gc_read on public.gallery_comments for select to anon, authenticated using (true);
create policy gc_add on public.gallery_comments for insert to authenticated with check (owner = auth.uid());
create policy gc_del on public.gallery_comments for delete to authenticated using (owner = auth.uid() or public.is_staff());
grant select on public.gallery_arts, public.gallery_likes, public.gallery_comments to anon, authenticated;
grant insert, update, delete on public.gallery_arts, public.gallery_comments to authenticated;
grant insert, delete on public.gallery_likes to authenticated;
grant usage on sequence public.gallery_arts_id_seq, public.gallery_comments_id_seq to authenticated;

-- картинки витрины: каждый пишет только в свою папку <id>/..., до 3 МБ
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists gallery_obj_add on storage.objects;
drop policy if exists gallery_obj_del on storage.objects;
create policy gallery_obj_add on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
create policy gallery_obj_del on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
