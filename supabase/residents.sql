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
