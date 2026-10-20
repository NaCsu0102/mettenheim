-- =====================================================================
--  Бот уведомлений: пишет игроку в личку Discord, когда мастер
--  меняет статус квенты или оставляет комментарий.
--  Выполнить после schema.sql. Повторный запуск безопасен.
-- =====================================================================

-- Discord ID игрока и его согласие на уведомления
alter table public.profiles add column if not exists discord_id text not null default '';
alter table public.profiles add column if not exists notify boolean not null default true;
-- Отметка, что бот уже написал по этой записи
alter table public.reviews add column if not exists notified_at timestamptz;
alter table public.reviews add column if not exists notify_error text;

-- Новые игроки: Discord ID берётся при первом входе
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, discord, avatar_url, discord_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(new.raw_user_meta_data ->> 'provider_id', '')
  ) on conflict (id) do nothing;
  return new;
end $$;

-- Уже вошедшие игроки
update public.profiles p set discord_id = coalesce(u.raw_user_meta_data ->> 'provider_id', '')
from auth.users u where u.id = p.id and p.discord_id = '';

-- Discord ID и отметки бота меняет только сервер
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Роль меняет только администратор';
  end if;
  if auth.uid() is not null then new.discord_id := old.discord_id; end if;
  new.updated_at := now();
  return new;
end $$;

-- Вызов функции notify при новой записи в истории
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_bot() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.verdict in ('comment', 'revision', 'approved', 'rejected') then
    perform net.http_post(
      url := 'https://ioksfvdjcknokcgxnpop.supabase.co/functions/v1/notify',
      body := jsonb_build_object('review_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3NmdmRqY2tub2tjZ3hucG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTI5ODEsImV4cCI6MjEwODA4ODk4MX0.Na9-UIlP4iXEjsA7yTQ_hl4wb2ewqnJHkcM8H9mImQE'
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end $$;
drop trigger if exists notify_bot on public.reviews;
create trigger notify_bot after insert on public.reviews
  for each row execute function public.notify_bot();
