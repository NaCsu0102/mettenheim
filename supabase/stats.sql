-- =====================================================================
--  Счётчики для главной: только числа, без личных данных.
--  Выполнить после schema.sql и guilds.sql. Повторный запуск безопасен.
-- =====================================================================
create or replace function public.site_stats()
returns table (residents bigint, quents bigint, players bigint, guilds bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.characters where status = 'approved'),
    (select count(*) from public.characters where submitted_at is not null),
    (select count(*) from public.profiles),
    (select count(*) from public.guilds where status <> 'archived');
$$;
grant execute on function public.site_stats() to anon, authenticated;
