/* Подключение личного кабинета к Supabase.
   Supabase → Project Settings → API: скопируй Project URL и anon public key.
   Ключ anon публичный по задумке — данные защищают правила доступа (RLS) из supabase/schema.sql.
   Пока поля пустые, кабинет показывает подсказку и не работает. */
window.MH_SUPABASE = {
  // Адрес настоящего сайта. С других адресов (например, предпросмотр на Claude) кабинет ведёт сюда.
  siteUrl: 'https://nacsu0102.github.io/mettenheim/',
  url: 'https://ioksfvdjcknokcgxnpop.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3NmdmRqY2tub2tjZ3hucG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTI5ODEsImV4cCI6MjEwODA4ODk4MX0.Na9-UIlP4iXEjsA7yTQ_hl4wb2ewqnJHkcM8H9mImQE',
  // Входы, которые включены в Supabase → Authentication → Providers
  discord: true,
  email: true
};
