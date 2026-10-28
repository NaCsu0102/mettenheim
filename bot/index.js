// Бот «Хроники Меттенхейма» — постоянное присутствие в Discord.
// Держит бота «в сети» со статусом и сразу будит сайт, когда в каналах чата,
// новостей и событий появляется новое сообщение. Вся остальная работа — в функции notify на Supabase.
import { Client, GatewayIntentBits, ActivityType, Events, Partials } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) { console.error('Нет DISCORD_BOT_TOKEN в /opt/mettenheim-bot/.env'); process.exit(1); }

const SB_URL = 'https://ioksfvdjcknokcgxnpop.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3NmdmRqY2tub2tjZ3hucG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTI5ODEsImV4cCI6MjEwODA4ODk4MX0.Na9-UIlP4iXEjsA7yTQ_hl4wb2ewqnJHkcM8H9mImQE';
const GUILD = '1467559507721982075';
const CHAT = '1564605532524908666';                       // общий чат сайта
const LIVE = ['1471498060625477856', '1470110267416379502']; // новости, мероприятия

// Статусы под ником бота — меняются по кругу. {members} и {online} подставляются сами.
const STATUSES = (process.env.BOT_STATUSES || 'Следит за Меттенхеймом|Проверяет квенты|Жителей на сервере: {members}|В сети: {online}').split('|');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildScheduledEvents], partials: [Partials.Message, Partials.Channel] });

const poke = async (q) => {
  try { await fetch(`${SB_URL}/functions/v1/notify?${q}`, { headers: { Authorization: 'Bearer ' + SB_ANON, apikey: SB_ANON } }); }
  catch (e) { console.error('notify', e.message); }
};

let i = 0;
async function rotate() {
  try {
    const g = await client.guilds.fetch({ guild: GUILD, withCounts: true });
    const text = STATUSES[i++ % STATUSES.length]
      .replace('{members}', g.approximateMemberCount ?? g.memberCount ?? '?')
      .replace('{online}', g.approximatePresenceCount ?? '?');
    client.user.setPresence({ status: 'online', activities: [{ name: 'custom', type: ActivityType.Custom, state: text }] });
  } catch (e) { console.error('status', e.message); }
}

client.once(Events.ClientReady, c => {
  console.log('В сети как', c.user.tag);
  rotate(); setInterval(rotate, 60_000);
});

// новое, изменённое или удалённое сообщение в нужных каналах — сайт подтягивает его сразу
let liveT = null;
const onMsg = m => {
  const ch = m.channelId;
  if (ch === CHAT) poke('chat=sync');
  else if (LIVE.includes(ch)) { clearTimeout(liveT); liveT = setTimeout(() => poke('live=sync&force=1'), 3000); }
};
client.on(Events.MessageCreate, m => { if (!m.webhookId) onMsg(m); });
client.on(Events.MessageUpdate, onMsg);
client.on(Events.MessageDelete, onMsg);
// события Discord: создали, изменили, удалили — обновить календарь на сайте
for (const ev of [Events.GuildScheduledEventCreate, Events.GuildScheduledEventUpdate, Events.GuildScheduledEventDelete])
  client.on(ev, () => { clearTimeout(liveT); liveT = setTimeout(() => poke('live=sync&force=1'), 3000); });

client.on(Events.Error, e => console.error('discord', e.message));
process.on('unhandledRejection', e => console.error('unhandled', e && e.message));
client.login(TOKEN);
