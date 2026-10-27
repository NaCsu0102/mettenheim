-- =====================================================================
--  Портрет игрока и чат сайта, связанный с каналом Discord.
--  Выполнить после schema.sql, notify.sql и residents.sql. Повторный запуск безопасен.
-- =====================================================================

-- Портрет игрока (аватар на сайте): ссылка на картинку в хранилище, см. portraits.sql
alter table public.profiles add column if not exists portrait text;

-- Сообщения чата. Пишет только бот (service role), читают все.
create table if not exists public.chat_messages (
  id          bigserial primary key,
  discord_id  text unique,
  source      text not null default 'discord' check (source in ('site', 'discord')),
  profile_id  uuid references public.profiles(id) on delete set null,
  author      text not null default '',
  avatar      text not null default '',
  body        text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_created on public.chat_messages (created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to anon, authenticated using (true);
grant select on public.chat_messages to anon, authenticated;

-- Служебные значения бота (вебхук канала, отметки синхронизации). Доступ только у сервера.
create table if not exists public.bot_kv (
  k text primary key,
  v text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.bot_kv enable row level security;

-- Новые сообщения сразу приходят на открытые страницы
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
