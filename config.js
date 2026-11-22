/* Подключение личного кабинета к Supabase.
   Supabase → Project Settings → API: скопируй Project URL и anon public key.
   Ключ anon публичный по задумке — данные защищают правила доступа (RLS) из supabase/schema.sql.
   Пока поля пустые, кабинет показывает подсказку и не работает. */
window.MH_SUPABASE = {
  // Адрес настоящего сайта. С других адресов (например, предпросмотр на Claude) кабинет ведёт сюда.
  siteUrl: 'https://nacsu0102.github.io/mettenheim/',
  url: 'https://wsciwjslwmfkwwywsyda.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2l3anNsd21ma3d3eXdzeWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyOTgxNzIsImV4cCI6MjExMDg3NDE3Mn0.aGwy08zAQQNZGE49cTomcaoCG1omjBK4PjEUsrCrXBw',
  // Входы, которые включены в Supabase → Authentication → Providers
  discord: true,
  email: true
};
