-- Посты из канала событий Discord хранятся рядом с новостями, с пометкой kind = 'event'
alter table public.news add column if not exists kind text not null default 'news';
create index if not exists news_kind_created on public.news (kind, created_at desc);
