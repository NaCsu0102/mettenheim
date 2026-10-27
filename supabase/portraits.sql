-- =====================================================================
--  Портреты в публичном хранилище: аватар игрока и портреты принятых персонажей.
--  Картинки по прямой ссылке видят сайт и Discord. Повторный запуск безопасен.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- игрок пишет только свой файл ava/<id>.jpg; портреты персонажей кладёт бот
drop policy if exists portraits_ava_read on storage.objects;
drop policy if exists portraits_ava_insert on storage.objects;
drop policy if exists portraits_ava_update on storage.objects;
drop policy if exists portraits_ava_delete on storage.objects;
create policy portraits_ava_read on storage.objects for select to authenticated
  using (bucket_id = 'portraits' and name = 'ava/' || auth.uid()::text || '.jpg');
create policy portraits_ava_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portraits' and name = 'ava/' || auth.uid()::text || '.jpg');
create policy portraits_ava_update on storage.objects for update to authenticated
  using (bucket_id = 'portraits' and name = 'ava/' || auth.uid()::text || '.jpg')
  with check (bucket_id = 'portraits' and name = 'ava/' || auth.uid()::text || '.jpg');
create policy portraits_ava_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portraits' and name = 'ava/' || auth.uid()::text || '.jpg');

-- в профиле теперь ссылка на картинку
alter table public.profiles drop constraint if exists profiles_portrait_size;
alter table public.profiles add constraint profiles_portrait_size check (portrait is null or length(portrait) < 600);

-- ссылка на портрет принятого персонажа (ставит бот)
alter table public.characters add column if not exists portrait_url text;

drop function if exists public.residents();
create function public.residents()
returns table (number int, name text, p text, o text, c text, g text, house text, approved_at timestamptz, portrait_url text)
language sql stable security definer set search_path = public as $$
  select c.number, c.name, c.data ->> 'p', c.data ->> 'o', c.data ->> 'c', c.data ->> 'g', c.data ->> 'house', c.reviewed_at, c.portrait_url
  from public.characters c
  where c.status = 'approved'
  order by c.number nulls last;
$$;
grant execute on function public.residents() to anon, authenticated;

-- ссылку на портрет персонажа меняет только сервер
create or replace function public.guard_portrait_url() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.portrait_url := case when tg_op = 'UPDATE' then old.portrait_url else null end;
  end if;
  return new;
end $$;
drop trigger if exists guard_portrait_url on public.characters;
create trigger guard_portrait_url before insert or update on public.characters
  for each row execute function public.guard_portrait_url();
