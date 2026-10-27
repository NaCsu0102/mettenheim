// Бот «Хроники Меттенхейма».
// 1) Пишет игроку в личку Discord о решении мастера и комментариях.
// 2) Когда квенту принимают — создаёт канал персонажа в категории «Личный кабинет»,
//    выкладывает карточку персонажа и приветствие с навигацией.
// Вызывается триггером notify_bot из базы. Секрет: DISCORD_BOT_TOKEN.
// Лёгкий клиент базы вместо supabase-js: функция стартует за доли секунды.
const DB_URL = Deno.env.get('SUPABASE_URL')!, DB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
class Q {
  t: string; f: string[] = []; m = 'GET'; body: unknown = null; sel = '*'; one = false; cnt = false; head = false; lim = 0;
  constructor(t: string) { this.t = t; }
  select(c = '*', o: { count?: string; head?: boolean } = {}) { this.sel = c; if (o.count) { this.cnt = true; this.head = !!o.head; } return this; }
  update(b: unknown) { this.m = 'PATCH'; this.body = b; return this; }
  ord = ''; up = '';
  insert(b: unknown, onConflict = '') { this.m = 'POST'; this.body = b; this.up = onConflict; return this; }
  delete() { this.m = 'DELETE'; return this; }
  order(k: string, o: { ascending?: boolean } = {}) { this.ord = `${k}.${o.ascending === false ? 'desc' : 'asc'}`; return this; }
  private op(k: string, o: string, v: unknown) { this.f.push(`${k}=${o}.${encodeURIComponent(String(v))}`); return this; }
  eq(k: string, v: unknown) { return this.op(k, 'eq', v); }
  gte(k: string, v: unknown) { return this.op(k, 'gte', v); }
  lte(k: string, v: unknown) { return this.op(k, 'lte', v); }
  is(k: string, v: null) { this.f.push(`${k}=is.null`); return this; }
  in(k: string, a: unknown[]) { this.f.push(`${k}=in.(${a.map((x) => encodeURIComponent(`"${x}"`)).join(',')})`); return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.one = true; return this; }
  async run() {
    const qs = [...this.f];
    if (this.m === 'GET') { qs.unshift('select=' + encodeURIComponent(this.sel)); if (this.ord) qs.push('order=' + this.ord); if (this.lim) qs.push('limit=' + this.lim); }
    if (this.m === 'POST' && this.up) qs.push('on_conflict=' + this.up);
    const h: Record<string, string> = { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY, 'Content-Type': 'application/json' };
    if (this.cnt) h.Prefer = 'count=exact';
    if (this.m === 'PATCH' || this.m === 'DELETE') h.Prefer = 'return=minimal';
    if (this.m === 'POST') h.Prefer = this.up ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal';
    const r = await fetch(`${DB_URL}/rest/v1/${this.t}?${qs.join('&')}`, { method: this.cnt && this.head ? 'HEAD' : this.m, headers: h, body: this.body ? JSON.stringify(this.body) : undefined });
    if (!r.ok) return { data: null, error: await r.text(), count: null };
    const count = this.cnt ? Number((r.headers.get('content-range') || '').split('/')[1]) || 0 : null;
    if (this.m !== 'GET' || this.head) return { data: null, error: null, count };
    const rows = await r.json();
    return { data: this.one ? (rows[0] ?? null) : rows, error: null, count };
  }
  then(res: (v: any) => unknown, rej?: (e: unknown) => unknown) { return this.run().then(res, rej); }
}
const SB = { from: (t: string) => new Q(t) };
const TOKEN = Deno.env.get('DISCORD_BOT_TOKEN') ?? '';
const SITE = Deno.env.get('SITE_URL') ?? 'https://nacsu0102.github.io/mettenheim/';
const GUILD = Deno.env.get('DISCORD_GUILD_ID') ?? '1467559507721982075';
const CATEGORY = Deno.env.get('DISCORD_CATEGORY_ID') ?? '1562186518821478480'; // «-- [Личный кабинет 1] --»
const API = 'https://discord.com/api/v10';
const SUBMIT_CHANNEL = Deno.env.get('DISCORD_SUBMIT_CHANNEL_ID') ?? '1470122628705681449'; // «🚩┋подача-квенты»

const N = {"peoples":{"humans":"Люди","elves":"Полуэльфы","dwarves":"Дворфы","goblins":"Гоблины","infernals":"Инферналы"},"origins":{"humans/west":"Западник","humans/east":"Восточник","humans/south":"Южанин","humans/mett":"Меттенхеймец","elves/high":"Высший","elves/wood":"Лесной","elves/dark":"Тёмный","dwarves/dwarf":"Дворф","goblins/urban":"Городской","goblins/tribal":"Племенной","infernals/fire":"Огненный","infernals/ice":"Ледяной"},"classes":{"fighter":"Боец","rogue":"Плут","mage":"Маг","shooter":"Стрелок","engineer":"Инженер"},"backgrounds":{"military":"Военный","artisan":"Ремесленник","factory":"Заводчанин","wanderer":"Странник","scholar":"Учёный","outskirts":"Житель окраин","mountain":"Дитя Гор","lost":"Потерянный","survivor":"Выживший","aristocrat":"Аристократ","renegade":"Отступник","spy":"Шпион"},"curses":{"doppler":"Доплер","beast":"Бист","vrakhir":"Вракхир","possessed":"Одержимый"},"kings":{"asmodeus":"Асмодей · Похоть","baal":"Ваал · Обман","mammon":"Маммона · Жадность","paimon":"Паймон · Гордыня","belial":"Белиал · Зависть","beleth":"Белет · Страх","vine":"Вине · Гнев","zagan":"Заган · Чревоугодие","balam":"Балам · Лень","purson":"Пурсон · Отчаяние"}} as Record<string, Record<string, string>>;

// арты с сайта: фигура персонажа по происхождению, полу и классу, эмблема народа
const ART = {"o":{"humans/west":["human-west","assets/emblems/human-west.webp"],"humans/east":["human-east","assets/emblems/human-east.webp"],"humans/south":["human-south","assets/emblems/human-south.webp"],"humans/mett":["mettenheimer","assets/emblems/mettenheimer.webp"],"elves/high":["high-elf","assets/emblems/halfelf-high.webp"],"elves/wood":["wood-elf","assets/emblems/halfelf-wood.webp"],"elves/dark":["drow","assets/emblems/halfelf-drow.webp"],"dwarves/dwarf":["dwarf","assets/emblems/dwarf.webp"],"goblins/urban":["goblin","assets/emblems/goblin.webp"],"goblins/tribal":["goblin-tribal","assets/emblems/goblin.webp"],"infernals/fire":["infernal-fire","assets/emblems/infernal.webp"],"infernals/ice":["infernal-ice","assets/emblems/infernal.webp"]},"c":{"fighter":"assets/emblems/fighter.webp","rogue":"assets/emblems/rogue.webp","mage":"assets/emblems/mage.webp","shooter":"assets/emblems/shooter.webp","engineer":"assets/emblems/engineer.webp"}} as any;
const figure = (d: any) => { const o = ART.o[`${d.p}/${d.o}`]; return o && d.c ? `${SITE}assets/characters/${o[0]}/${d.g === 'male' ? 'male' : 'female'}-${d.c}.webp` : null; };
const emblem = (d: any) => { const o = ART.o[`${d.p}/${d.o}`]; return o ? SITE + o[1] : (ART.c[d.c] ? SITE + ART.c[d.c] : null); };

const VERDICT: Record<string, [string, number, string]> = {
  approved: ['✅ Квента принята', 0x7fa36a, 'Добро пожаловать в Меттенхейм! Персонаж принят.'],
  revision: ['🛠️ Квента возвращена на доработку', 0xd0a03c, 'Мастер просит кое-что поправить. Исправь и отправь снова.'],
  rejected: ['❌ Квента отклонена', 0xc2523f, 'Мастер отклонил квенту.'],
  comment: ['💬 Новое сообщение от мастера', 0xb8925a, '']
};
// права Discord
const VIEW = 1024n, SEND = 2048n, EMBED = 16384n, ATTACH = 32768n, HISTORY = 65536n, MANAGE_CH = 16n, MANAGE_MSG = 8192n;
const MEMBER = (VIEW | SEND | EMBED | ATTACH | HISTORY).toString();
const BOTP = (VIEW | SEND | EMBED | ATTACH | HISTORY | MANAGE_CH | MANAGE_MSG).toString();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const num = (n: number) => '№' + String(n).padStart(3, '0');

async function discord(method: string, path: string, body?: unknown, form?: FormData) {
  const headers: Record<string, string> = { Authorization: 'Bot ' + TOKEN };
  if (!form) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  if (!r.ok) throw new Error(`Discord ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
const say = (channel: string, msg: Record<string, unknown>) => discord('POST', `/channels/${channel}/messages`, msg);

/* ---------- карточка персонажа ---------- */
function card(ch: any, pr: any, masterName: string | null) {
  const d = ch.data || {};
  const val = (v: unknown) => (v == null || v === '' ? null : String(v));
  const uniq = d.p === 'infernals' ? (N.kings[d.ik] ? 'Инфернал · Дом ' + N.kings[d.ik] : 'Инфернал')
    : d.u === 'construct' ? 'Конструкт' : d.u === 'curse' ? 'Проклятие · ' + (N.curses[d.cu] || '') : null;
  const fields = [
    ['👤 Игрок', pr.discord_id ? `<@${pr.discord_id}>` : (pr.display_name || '—')],
    ['🧬 Народ', [N.peoples[d.p], N.origins[`${d.p}/${d.o}`]].filter(Boolean).join(' · ')],
    ['⚔️ Класс', N.classes[d.c]],
    ['🏛️ Сторона', d.house === 'dorn' ? '🔴 Дом Дорн' : d.house === 'talbot' ? '🟡 Дом Талбот' : null],
    ['📜 Предыстория', N.backgrounds[d.bg]],
    ['⏳ Возраст', val(d.age)],
    ['🪪 Пол', d.g === 'male' ? 'Мужской' : d.g === 'female' ? 'Женский' : null],
    ['✨ Уникальность', uniq],
    ['🔧 Профессия', val(d.prof)],
    ['🎓 Образование', val(d.edu)],
    ['🕯️ Вера', val(d.faith)]
  ].filter(([, v]) => v).map(([name, value]) => ({ name, value: String(value).slice(0, 1000), inline: true }));
  const q = (ch.quenta || '').trim();
  if (q) fields.push({ name: '📖 Из квенты', value: (q.length > 900 ? q.slice(0, 900).replace(/\s+\S*$/, '') + '…' : q), inline: false });
  if (d.traits) fields.push({ name: '🎭 Особенности', value: String(d.traits).slice(0, 1000), inline: false });
  if (d.goal) fields.push({ name: '🎯 Цель', value: String(d.goal).slice(0, 1000), inline: false });
  return {
    author: { name: '⚙️ Хроники Меттенхейма · Личное дело' },
    title: `${num(ch.number)} · ${ch.name || 'Без имени'}`,
    color: d.house === 'dorn' ? 0xc2523f : 0xd6a23f,
    fields,
    footer: { text: masterName ? `✒️ Принят мастером ${masterName}` : '✒️ Персонаж принят' },
    timestamp: new Date().toISOString(),
    ...(emblem(d) ? { thumbnail: { url: emblem(d)! } } : {}),
    ...(figure(d) ? { image: { url: figure(d)! } } : {})
  };
}
function welcome(pr: any, ch: any) {
  return {
    content: pr.discord_id ? `<@${pr.discord_id}>` : '',
    embeds: [{
      title: '🗝️ Добро пожаловать в Хроники Меттенхейма!',
      color: 0xb8925a,
      image: { url: SITE + ((ch.data || {}).house === 'dorn' ? 'assets/house-dorn-banner.webp' : 'assets/house-talbot-banner.webp') },
      thumbnail: { url: SITE + 'assets/logo.webp' },
      description: [
        `Это твой личный кабинет на сервере. Здесь живёт личное дело персонажа ${num(ch.number)}, сюда приходят решения и комментарии мастеров. Канал видишь только ты и мастера — пиши сюда любые вопросы.`,
        '',
        '🧭 **Как зайти в игру**',
        `📜 **1.** Прочитай [правила сервера](${SITE}#rules) и [правила Discord](${SITE}#discord).`,
        `🧩 **2.** Подпишись на [коллекцию модов](${SITE}#modlist) в Steam Workshop и дождись полной загрузки.`,
        '🔌 **3.** Зайди на сервер: [подключиться в один клик](https://wargm.ru/server/61449/connect) или вручную по адресу `145.239.130.3:7790`. Пароль, если он нужен, спроси у мастера здесь.',
        `🎭 **4.** Создай в игре персонажа с именем **${ch.name || 'как в квенте'}** — внешность по анкете.`,
        `❓ **5.** Не получается зайти — загляни в [частые вопросы](${SITE}#faq).`,
        '',
        `📚 Справочник мира, классы, древо талантов и мастерская — на [сайте проекта](${SITE}). Удачной игры!`
      ].join('\n')
    }],
    components: [{ type: 1, components: [
      { type: 2, style: 5, label: 'Правила', emoji: { name: '📜' }, url: SITE + '#rules' },
      { type: 2, style: 5, label: 'Модлист', emoji: { name: '🧩' }, url: SITE + '#modlist' },
      { type: 2, style: 5, label: 'Вопросы', emoji: { name: '❓' }, url: SITE + '#faq' },
      { type: 2, style: 5, label: 'Личный кабинет', emoji: { name: '🗝️' }, url: SITE + '#cabinet' }
    ] }]
  };
}

/* ---------- канал персонажа ---------- */
async function pickCategory() {
  const all: any[] = await discord('GET', `/guilds/${GUILD}/channels`);
  const base = all.find((c) => c.id === CATEGORY);
  if (!base) throw new Error('категория «Личный кабинет» не найдена');
  // в категории Discord не больше 50 каналов — тогда заводим «Личный кабинет 2», 3…
  const cats = all.filter((c) => c.type === 4 && /Личный кабинет/i.test(c.name)).sort((a, b) => a.position - b.position);
  for (const c of cats) if (all.filter((x) => x.parent_id === c.id).length < 50) return { cat: c, all };
  const n = cats.length + 1;
  const cat = await discord('POST', `/guilds/${GUILD}/channels`, {
    name: base.name.replace(/\d+/, String(n)), type: 4, position: base.position + n - 1, permission_overwrites: base.permission_overwrites
  });
  return { cat, all };
}
async function makeChannel(ch: any, pr: any, staffIds: string[]) {
  const { cat } = await pickCategory();
  const me = await discord('GET', '/users/@me');
  const over = new Map<string, any>();
  (cat.permission_overwrites || []).forEach((o: any) => over.set(o.id, { ...o }));
  const ev = over.get(GUILD) || { id: GUILD, type: 0, allow: '0', deny: '0' };
  ev.deny = (BigInt(ev.deny || '0') | VIEW).toString(); ev.allow = (BigInt(ev.allow || '0') & ~VIEW).toString();
  over.set(GUILD, ev);
  const add = (id: string, allow: string) => { if (id) over.set(id, { id, type: 1, allow, deny: '0' }); };
  staffIds.forEach((id) => add(id, MEMBER));
  add(pr.discord_id, MEMBER);
  add(me.id, BOTP);
  const slug = (ch.name || 'персонаж').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const chan = await discord('POST', `/guilds/${GUILD}/channels`, {
    name: `${String(ch.number).padStart(3, '0')}-${slug}`, type: 0, parent_id: cat.id,
    topic: `Личный кабинет персонажа ${num(ch.number)} · ${ch.name || ''}`.slice(0, 1024),
    permission_overwrites: [...over.values()]
  });
  await SB.from('characters').update({ discord_channel_id: chan.id }).eq('id', ch.id);
  return chan.id as string;
}
async function postCard(channel: string, ch: any, pr: any, masterName: string | null) {
  const embed: any = card(ch, pr, masterName);
  const form = new FormData();
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(ch.portrait || '');
  if (m) {
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    form.append('files[0]', new Blob([bytes], { type: m[1] }), 'portrait.jpg');
    embed.image = { url: 'attachment://portrait.jpg' };
  }
  form.append('payload_json', JSON.stringify({ content: pr.discord_id ? `🎉 <@${pr.discord_id}>, твой персонаж принят!` : '', embeds: [embed] }));
  const msg = await discord('POST', `/channels/${channel}/messages`, undefined, form);
  try { await discord('PUT', `/channels/${channel}/pins/${msg.id}`); } catch (_) { /* закрепить не обязательно */ }
}

/* ---------- роли после принятия ---------- */
// снять «Гость» и «Странник», выдать роли жителя; остальные роли игрока не трогаем
const norm = (n: string) => n.replace(/[\s\u3164\u115f\u1160\u200b]+/g, '').toLowerCase();
// точное имя роли, допускается значок в начале: «「✏️」Игрок» → «игрок»
const core = (n: string) => n.replace(/^[「\[(][^」\])]*[」\])]/, '').replace(/^[^а-яёa-z【]+/i, '');
const ROLES_OFF = ['гость', 'странник'];
const ROLES_ON = ['【status】', 'игрок', 'житель', '【special】', 'меттенхейм', '【achieve】'];
async function giveRoles(userId: string) {
  const roles: any[] = await discord('GET', `/guilds/${GUILD}/roles`);
  const member = await discord('GET', `/guilds/${GUILD}/members/${userId}`);
  const has = new Set<string>(member.roles || []);
  const errs: string[] = [];
  for (const r of roles) {
    const n = norm(r.name);
    try {
      if (ROLES_OFF.includes(core(n)) && has.has(r.id)) await discord('DELETE', `/guilds/${GUILD}/members/${userId}/roles/${r.id}`);
      else if (ROLES_ON.includes(core(n)) && !has.has(r.id)) await discord('PUT', `/guilds/${GUILD}/members/${userId}/roles/${r.id}`);
    } catch (e) { errs.push(`роль «${r.name}»: ${String((e as Error).message || e).slice(0, 80)}`); }
  }
  if (errs.length) throw new Error(errs.join('; '));
}

let statsCache: { at: number; body: unknown } | null = null;

/* ---------- обработка ---------- */
/* ---------- портреты персонажей в публичном хранилище (для сайта и Discord) ---------- */
function dataUrlBytes(u: string): [Uint8Array, string] | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(u || '');
  if (!m) return null;
  const bin = atob(m[2]); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return [a, m[1]];
}
async function publishPortrait(ch: any) {
  const b = dataUrlBytes(ch.portrait || '');
  if (!b || !ch.number) return null;
  const path = `char/${ch.number}.jpg`;
  const r = await fetch(`${DB_URL}/storage/v1/object/portraits/${path}`, { method: 'POST', headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY, 'Content-Type': b[1], 'x-upsert': 'true', 'Cache-Control': '3600' }, body: b[0] });
  if (!r.ok) throw new Error('storage ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const url = `${DB_URL}/storage/v1/object/public/portraits/${path}?v=${(ch.portrait as string).length}`;
  await SB.from('characters').update({ portrait_url: url }).eq('id', ch.id);
  return url;
}
// разово: выложить портреты уже принятых персонажей
async function backfillPortraits() {
  const { data } = await SB.from('characters').select('id,number,portrait,portrait_url').eq('status', 'approved');
  let n = 0;
  for (const ch of data || []) if (ch.portrait && !ch.portrait_url) { try { if (await publishPortrait(ch)) n++; } catch (_) { /* дальше */ } }
  return { published: n };
}

/* ---------- чат сайта ↔ канал Discord ---------- */
const CHAT_CHANNEL = Deno.env.get('DISCORD_CHAT_CHANNEL_ID') ?? '1564605532524908666';
const kvGet = async (k: string) => (await SB.from('bot_kv').select('v,updated_at').eq('k', k).maybeSingle()).data as { v: string; updated_at: string } | null;
const kvSet = (k: string, v: string) => SB.from('bot_kv').insert({ k, v, updated_at: new Date().toISOString() }, 'k').run().then(() => SB.from('bot_kv').update({ v, updated_at: new Date().toISOString() }).eq('k', k).run());
const memberCache = new Map<string, { at: number; nick: string; avatar: string }>();

async function chatWebhook(): Promise<{ id: string; token: string }> {
  const saved = await kvGet('chat_webhook');
  if (saved?.v) { const [id, token] = saved.v.split(':'); if (id && token) return { id, token }; }
  const list: any[] = await discord('GET', `/channels/${CHAT_CHANNEL}/webhooks`);
  let wh = list.find((w) => w.name === 'Сайт Меттенхейма' && w.token);
  if (!wh) wh = await discord('POST', `/channels/${CHAT_CHANNEL}/webhooks`, { name: 'Сайт Меттенхейма' });
  await kvSet('chat_webhook', `${wh.id}:${wh.token}`);
  return { id: wh.id, token: wh.token };
}
const avatarOf = (u: any, m?: any) => m?.avatar ? `https://cdn.discordapp.com/guilds/${GUILD}/users/${u.id}/avatars/${m.avatar}.png?size=96`
  : u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=96` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
async function memberOf(u: any) {
  const c = memberCache.get(u.id);
  if (c && Date.now() - c.at < 10 * 60 * 1000) return c;
  let nick = u.global_name || u.username, avatar = avatarOf(u);
  try { const m = await discord('GET', `/guilds/${GUILD}/members/${u.id}`); nick = m.nick || nick; avatar = avatarOf(u, m); } catch (_) { /* не на сервере */ }
  const v = { at: Date.now(), nick, avatar }; memberCache.set(u.id, v); return v;
}
function plainBody(m: any) {
  let t = String(m.content || '');
  for (const u of m.mentions || []) t = t.replace(new RegExp(`<@!?${u.id}>`, 'g'), '@' + (u.global_name || u.username));
  t = t.replace(/<@&\d+>/g, '@роль').replace(/<#\d+>/g, '#канал');
  if (!t && m.sticker_items?.length) t = '[стикер] ' + m.sticker_items[0].name;
  if (!t && m.embeds?.length) t = [m.embeds[0].title, m.embeds[0].description].filter(Boolean).join('\n');
  return t.slice(0, 4000);
}
// забрать новые сообщения из Discord (не чаще раза в 3 секунды на всех)
async function syncChat() {
  const mark = await kvGet('chat_sync');
  if (mark && Date.now() - new Date(mark.updated_at).getTime() < 3000) return { skip: true };
  await kvSet('chat_sync', String(Date.now()));
  const wh = await chatWebhook();
  const last = (await kvGet('chat_last'))?.v || '';
  const msgs: any[] = await discord('GET', `/channels/${CHAT_CHANNEL}/messages?limit=50${last ? '&after=' + last : ''}`);
  if (!msgs.length) return { added: 0 };
  msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const rows = [];
  for (const m of msgs) {
    if (m.webhook_id === wh.id) continue; // это сообщение с сайта, уже в базе
    if (m.type !== 0 && m.type !== 19) continue; // только обычные сообщения и ответы
    const mb = m.webhook_id ? { nick: m.author.username, avatar: avatarOf(m.author) } : await memberOf(m.author);
    rows.push({
      discord_id: m.id, source: 'discord', author: mb.nick, avatar: mb.avatar, body: plainBody(m),
      attachments: (m.attachments || []).slice(0, 4).map((a: any) => ({ url: a.url, name: a.filename, image: /^image\//.test(a.content_type || '') })),
      created_at: m.timestamp
    });
  }
  if (rows.length) await SB.from('chat_messages').insert(rows, 'discord_id').run();
  await kvSet('chat_last', msgs[msgs.length - 1].id);
  return { added: rows.length };
}
async function userFrom(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const r = await fetch(`${DB_URL}/auth/v1/user`, { headers: { apikey: DB_KEY, Authorization: 'Bearer ' + jwt } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? u : null;
}
async function chat(req: Request, action: string, CORS: Record<string, string>) {
  const out = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });
  if (action === 'sync') return out(await syncChat());
  if (req.method !== 'POST') return out({ error: 'POST only' }, 405);
  const user = await userFrom(req);
  if (!user) return out({ error: 'Войди через Discord, чтобы писать в чат' }, 401);
  const { data: pr } = await SB.from('profiles').select('id,display_name,discord,avatar_url,portrait,role').eq('id', user.id).maybeSingle();
  if (!pr) return out({ error: 'Профиль не найден' }, 403);
  let body: any = {}; try { body = await req.json(); } catch (_) { /* пусто */ }

  if (action === 'del') {
    if (!['master', 'admin'].includes(pr.role)) return out({ error: 'Удалять сообщения могут только мастера' }, 403);
    const { data: m } = await SB.from('chat_messages').select('id,discord_id').eq('id', Number(body.id)).maybeSingle();
    if (!m) return out({ ok: true });
    if (m.discord_id) { try { await discord('DELETE', `/channels/${CHAT_CHANNEL}/messages/${m.discord_id}`); } catch (_) { /* уже удалено */ } }
    await SB.from('chat_messages').delete().eq('id', m.id).run();
    return out({ ok: true });
  }

  if (action === 'send') {
    const text = String(body.text || '').replace(/\r/g, '').trim().slice(0, 1500);
    if (!text) return out({ error: 'Пустое сообщение' }, 400);
    const { data: lastMine } = await SB.from('chat_messages').select('created_at').eq('profile_id', pr.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (lastMine && Date.now() - new Date(lastMine.created_at).getTime() < 2500) return out({ error: 'Не так быстро — подожди пару секунд' }, 429);
    // имя как на сервере: «N | персонаж», если персонаж принят
    const { data: chs } = await SB.from('characters').select('number,name').eq('owner', pr.id).eq('status', 'approved').order('number', { ascending: true }).limit(1);
    const ch = chs && chs[0];
    const name = ((ch ? `${ch.number} | ${ch.name}` : pr.display_name || pr.discord || 'Гость сайта') + ' · сайт').replace(/discord/gi, 'dc').slice(0, 80);
    const avatar = (/^https:\/\//.test(pr.portrait || '') ? pr.portrait : '') || pr.avatar_url || '';
    const wh = await chatWebhook();
    const r = await fetch(`${API}/webhooks/${wh.id}/${wh.token}?wait=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, username: name, avatar_url: avatar || undefined, allowed_mentions: { parse: [] } })
    });
    if (r.status === 404) { await kvSet('chat_webhook', ''); return out({ error: 'Связь с каналом обновилась, отправь ещё раз' }, 503); }
    if (!r.ok) return out({ error: 'Discord не принял сообщение: ' + (await r.text()).slice(0, 120) }, 502);
    const msg = await r.json();
    await SB.from('chat_messages').insert({ discord_id: msg.id, source: 'site', profile_id: pr.id, author: name.replace(/ · сайт$/, ''), avatar, body: text, created_at: msg.timestamp }, 'discord_id').run();
    return out({ ok: true });
  }
  return out({ error: 'unknown action' }, 400);
}

/* ---------- новости и события из Discord ---------- */
const NEWS_CHANNEL = Deno.env.get('DISCORD_NEWS_CHANNEL_ID') ?? '1471498060625477856';
async function toMedia(url: string, path: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return url;
    const type = r.headers.get('content-type') || 'image/png';
    if (!/^image\//.test(type)) return url;
    const up = await fetch(`${DB_URL}/storage/v1/object/media/${path}`, { method: 'POST', headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY, 'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': '604800' }, body: await r.arrayBuffer() });
    return up.ok ? `${DB_URL}/storage/v1/object/public/media/${path}` : url;
  } catch (_) { return url; }
}
async function throttle(key: string, ms: number) {
  const mark = await kvGet(key);
  if (mark && Date.now() - new Date(mark.updated_at).getTime() < ms) return true;
  await kvSet(key, String(Date.now()));
  return false;
}
async function syncNews(force = false) {
  if (!force && await throttle('news_sync', 60000)) return { skip: true };
  const msgs: any[] = await discord('GET', `/channels/${NEWS_CHANNEL}/messages?limit=40`);
  const { data: have } = await SB.from('news').select('discord_id,edited_at,body,images').limit(200);
  const known = new Map((have || []).map((n: any) => [n.discord_id, n]));
  let added = 0, updated = 0;
  for (const m of msgs) {
    if (m.type !== 0 && m.type !== 19) continue;
    const prev: any = known.get(m.id);
    const edited = m.edited_timestamp || null;
    if (prev && (prev.edited_at || null) === edited && (prev.body || (prev.images || []).length)) continue;
    const mb = m.webhook_id ? { nick: m.author.username, avatar: avatarOf(m.author) } : await memberOf(m.author);
    const pics: any[] = [];
    let i = 0;
    for (const a of (m.attachments || []).slice(0, 6)) {
      if (!/^image\//.test(a.content_type || '')) continue;
      const ext = (a.filename.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      pics.push({ url: await toMedia(a.url, `news/${m.id}-${i++}.${ext}`), w: a.width || null, h: a.height || null });
    }
    for (const e of (m.embeds || []).slice(0, 2)) {
      const u = e.image?.url || e.thumbnail?.url;
      if (u) pics.push({ url: await toMedia(u, `news/${m.id}-${i++}.png`), w: e.image?.width || null, h: e.image?.height || null });
    }
    let body = plainBody(m);
    if (!m.content && m.embeds?.length) body = [m.embeds[0].title ? '## ' + m.embeds[0].title : '', m.embeds[0].description || ''].filter(Boolean).join('\n');
    await SB.from('news').insert({ discord_id: m.id, author: mb.nick, avatar: mb.avatar, body, images: pics, created_at: m.timestamp, edited_at: edited }, 'discord_id').run();
    if (prev) await SB.from('news').update({ author: mb.nick, avatar: mb.avatar, body, images: pics, edited_at: edited }).eq('discord_id', m.id).run();
    prev ? updated++ : added++;
  }
  // удалённые в Discord — убрать и с сайта (в пределах загруженного окна)
  if (msgs.length) {
    const ids = new Set(msgs.map((m) => m.id));
    const oldest = msgs[msgs.length - 1].timestamp;
    const { data: recent } = await SB.from('news').select('discord_id,created_at').gte('created_at', oldest).limit(100);
    for (const n of recent || []) if (!ids.has(n.discord_id)) await SB.from('news').delete().eq('discord_id', n.discord_id).run();
  }
  return { added, updated };
}
async function syncEvents(force = false) {
  if (!force && await throttle('events_sync', 120000)) return { skip: true };
  const list: any[] = await discord('GET', `/guilds/${GUILD}/scheduled-events?with_user_count=true`);
  const ids: string[] = [];
  for (const e of list) {
    ids.push(e.id);
    const image = e.image ? await toMedia(`https://cdn.discordapp.com/guild-events/${e.id}/${e.image}.png?size=1024`, `events/${e.id}-${e.image}.png`) : '';
    const row = { id: e.id, name: e.name || '', description: e.description || '', starts_at: e.scheduled_start_time, ends_at: e.scheduled_end_time || null,
      location: e.entity_metadata?.location || (e.channel_id ? 'Голосовой канал Discord' : ''), image, interested: e.user_count || 0, status: e.status, updated_at: new Date().toISOString() };
    await SB.from('events').insert(row, 'id').run();
    await SB.from('events').update(row).eq('id', e.id).run();
  }
  // прошедшие и отменённые события Discord уже не отдаёт — убрать
  const { data: have } = await SB.from('events').select('id').limit(200);
  for (const h of have || []) if (!ids.includes(h.id)) await SB.from('events').delete().eq('id', h.id).run();
  return { events: list.length };
}

/* ---------- для мастеров: чтение каналов Discord (хроника сессии) ---------- */
async function staffRead(req: Request, qp: URLSearchParams) {
  // временный ключ чтения (ставится вручную в bot_kv, живёт час) или вход мастера
  const rk = req.headers.get('x-read-key') || '';
  const kv = rk ? await kvGet('read_key') : null;
  const keyOk = !!(kv && kv.v && kv.v.length >= 24 && kv.v === rk && Date.now() - new Date(kv.updated_at).getTime() < 3600000);
  if (!keyOk) {
    const user = await userFrom(req);
    if (!user) return { error: 'нужен вход', status: 401 };
    const { data: pr } = await SB.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!pr || !['master', 'admin'].includes(pr.role)) return { error: 'только мастера', status: 403 };
  }
  const what = qp.get('discord');
  if (what === 'channels') {
    const chans: any[] = await discord('GET', `/guilds/${GUILD}/channels`);
    const act: any = await discord('GET', `/guilds/${GUILD}/threads/active`);
    return { channels: chans.map((c) => ({ id: c.id, name: c.name, type: c.type, parent: c.parent_id })), threads: (act.threads || []).map((t: any) => ({ id: t.id, name: t.name, parent: t.parent_id })) };
  }
  if (what === 'archived') {
    const ch = qp.get('channel') || '';
    const pub: any = await discord('GET', `/channels/${ch}/threads/archived/public?limit=100`).catch(() => ({ threads: [] }));
    return { threads: (pub.threads || []).map((t: any) => ({ id: t.id, name: t.name, parent: t.parent_id })) };
  }
  if (what === 'messages') {
    const ch = qp.get('channel') || '';
    let before = '', out: any[] = [];
    for (let i = 0; i < 6; i++) {
      const page: any[] = await discord('GET', `/channels/${ch}/messages?limit=100${before ? '&before=' + before : ''}`);
      out = out.concat(page.map((m) => ({ id: m.id, at: m.timestamp, author: m.author?.global_name || m.author?.username, text: plainBody(m), files: (m.attachments || []).map((a: any) => a.filename) })));
      if (page.length < 100) break;
      before = page[page.length - 1].id;
    }
    return { messages: out.reverse() };
  }
  return { error: 'unknown', status: 400 };
}

Deno.serve(async (req) => {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-read-key', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  // проверка ролей без изменений: какие роли бот снимет и выдаст
  if (new URL(req.url).searchParams.get('roles') === 'check') {
    const roles: any[] = await discord('GET', `/guilds/${GUILD}/roles`);
    const me = await discord('GET', '/users/@me');
    const meM = await discord('GET', `/guilds/${GUILD}/members/${me.id}`);
    const top = Math.max(...roles.filter((r) => (meM.roles || []).includes(r.id)).map((r) => r.position));
    const pick = (list: string[]) => roles.filter((r) => list.includes(core(norm(r.name)))).map((r) => ({ name: r.name, below_bot: r.position < top }));
    return new Response(JSON.stringify({ off: pick(ROLES_OFF), on: pick(ROLES_ON) }), { headers: CORS });
  }
  // числа сервера Discord для сайта: участники и в сети
  if (new URL(req.url).searchParams.get('stats') === 'discord') {
    if (!statsCache || Date.now() - statsCache.at > 60000) {
      const g = await discord('GET', `/guilds/${GUILD}?with_counts=true`);
      statsCache = { at: Date.now(), body: { name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${GUILD}/${g.icon}.png?size=128` : null, members: g.approximate_member_count, online: g.approximate_presence_count } };
    }
    return new Response(JSON.stringify(statsCache.body), { headers: { ...CORS, 'Cache-Control': 'public, max-age=60' } });
  }
  const qp = new URL(req.url).searchParams;
  // новости и события Discord для сайта и лаунчера
  if (qp.get('live') === 'sync') {
    const [news, events] = await Promise.all([syncNews().catch((e) => ({ error: String(e) })), syncEvents().catch((e) => ({ error: String(e) }))]);
    return new Response(JSON.stringify({ news, events }), { headers: CORS });
  }
  if (qp.get('discord')) {
    try { const r: any = await staffRead(req, qp); return new Response(JSON.stringify(r), { status: r.status || 200, headers: CORS }); }
    catch (e) { return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: CORS }); }
  }
  // разово выложить портреты принятых персонажей
  if (qp.get('portraits') === 'backfill') return new Response(JSON.stringify(await backfillPortraits()), { headers: CORS });
  // чат сайта ↔ канал Discord
  if (qp.get('chat')) {
    try { return await chat(req, qp.get('chat')!, CORS); }
    catch (e) { return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: CORS }); }
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!TOKEN) return json({ error: 'DISCORD_BOT_TOKEN не задан' }, 500);
  let id: number;
  try { id = Number((await req.json()).review_id); } catch { return json({ error: 'bad body' }, 400); }
  if (!id) return json({ error: 'no review_id' }, 400);

  // Мастер часто ставит статус и сразу пишет комментарий — ждём, чтобы отправить одним сообщением.
  await sleep(2000);
  const { data: rv } = await SB.from('reviews').select('*').eq('id', id).maybeSingle();
  if (!rv || rv.notified_at) return json({ skip: 'нет записи или уже отправлено' });
  if (Date.now() - new Date(rv.created_at).getTime() > 10 * 60 * 1000) return json({ skip: 'старая запись' });

  const { data: ch } = await SB.from('characters').select('*').eq('id', rv.character_id).maybeSingle();
  if (!ch) return json({ skip: 'нет персонажа' });
  // квента подана → объявление в канал «подача-квенты»
  if (rv.verdict === 'submitted') {
    await SB.from('reviews').update({ notified_at: new Date().toISOString() }).eq('id', rv.id);
    const { data: op } = await SB.from('profiles').select('discord_id,discord,display_name,avatar_url').eq('id', ch.owner).maybeSingle();
    const { count } = await SB.from('reviews').select('id', { count: 'exact', head: true }).eq('character_id', ch.id).eq('verdict', 'submitted');
    const d = ch.data || {};
    const again = (count || 0) > 1;
    const who = op ? (op.discord_id ? `<@${op.discord_id}>` : '') + (op.discord ? ` · \`${op.discord}\`` : '') : '—';
    const uniq = d.p === 'infernals' ? (N.kings[d.ik] ? 'Инфернал · Дом ' + N.kings[d.ik] : 'Инфернал') : d.u === 'construct' ? 'Конструкт' : d.u === 'curse' ? 'Проклятие · ' + (N.curses[d.cu] || '') : null;
    const fields = [
      ['👤 Игрок', who || (op?.display_name ?? '—')],
      ['🎭 Персонаж', ch.name || 'Без имени'],
      ['🧬 Народ', [N.peoples[d.p], N.origins[`${d.p}/${d.o}`]].filter(Boolean).join(' · ')],
      ['⚔️ Класс', N.classes[d.c]],
      ['🏛️ Сторона', d.house === 'dorn' ? '🔴 Дом Дорн' : d.house === 'talbot' ? '🟡 Дом Талбот' : null],
      ['✨ Уникальность', uniq],
      ['📏 Квента', `${(ch.quenta || '').length} знаков`]
    ].filter(([, v]) => v).map(([name, value]) => ({ name, value: String(value).slice(0, 1000), inline: true }));
    let role: string | null = null;
    try { const roles: any[] = await discord('GET', `/guilds/${GUILD}/roles`); role = (roles.find((r) => /квентолог/i.test(r.name)) || {}).id || null; } catch (_) { /* без пинга */ }
    try {
      const nick = op?.discord || op?.display_name || 'Игрок';
      await say(SUBMIT_CHANNEL, {
        content: role ? `<@&${role}>` : '',
        embeds: [{
          author: { name: nick, ...(op?.avatar_url ? { icon_url: op.avatar_url } : {}) },
          description: `📨 **${nick}** — квента ждёт проверки${again ? ' (после доработки)' : ''}`,
          color: 0xd0a03c
        }],
        components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Проверить', emoji: { name: '🔍' }, url: SITE + '#admin' }] }],
        allowed_mentions: { parse: [], roles: role ? [role] : [] }
      });
      return json({ ok: true });
    } catch (e) {
      await SB.from('reviews').update({ notify_error: String((e as Error).message || e).slice(0, 300) }).eq('id', rv.id);
      return json({ error: String(e) }, 502);
    }
  }
  if (rv.author && rv.author === ch.owner) return json({ skip: 'это сообщение самого игрока' });

  let body = rv.body || '';
  const claim = [rv.id];
  const sameAuthor = (q: any) => (rv.author ? q.eq('author', rv.author) : q.is('author', null));
  if (rv.verdict === 'comment') {
    const since = new Date(new Date(rv.created_at).getTime() - 20000).toISOString();
    const { data: near } = await sameAuthor(SB.from('reviews').select('id').eq('character_id', ch.id))
      .in('verdict', ['approved', 'revision', 'rejected']).gte('created_at', since).lte('created_at', rv.created_at).limit(1);
    if (near && near.length) return json({ skip: 'войдёт в сообщение о статусе' });
  } else {
    const until = new Date(new Date(rv.created_at).getTime() + 20000).toISOString();
    const { data: com } = await sameAuthor(SB.from('reviews').select('id,body').eq('character_id', ch.id))
      .eq('verdict', 'comment').gte('created_at', rv.created_at).lte('created_at', until).is('notified_at', null);
    (com || []).forEach((c: any) => { if (c.body) body += (body ? '\n\n' : '') + c.body; claim.push(c.id); });
  }
  const mark = (err: string | null) => SB.from('reviews').update({ notified_at: new Date().toISOString(), notify_error: err }).in('id', claim);
  await mark(null); // отмечаем сразу, чтобы повторный вызов не прислал дубль

  const { data: pr } = await SB.from('profiles').select('discord_id,notify,display_name').eq('id', ch.owner).maybeSingle();
  const { data: master } = rv.author ? await SB.from('profiles').select('display_name').eq('id', rv.author).maybeSingle() : { data: null };
  if (!pr) return json({ skip: 'нет профиля' });
  const errors: string[] = [];

  // канал персонажа при принятии
  let channel: string | null = ch.discord_channel_id || null;
  if (rv.verdict === 'approved' && ch.number) {
    try { await publishPortrait(ch); } catch (e) { console.log('portrait', e); }
    try {
      const { data: staff } = await SB.from('profiles').select('discord_id').in('role', ['master', 'admin']);
      if (!channel) {
        channel = await makeChannel(ch, pr, (staff || []).map((s: any) => s.discord_id).filter(Boolean));
        await postCard(channel, ch, pr, master?.display_name || null);
        await say(channel, welcome(pr, ch));
      } else {
        await postCard(channel, ch, pr, master?.display_name || null);
      }
    } catch (e) { errors.push('канал: ' + String((e as Error).message || e)); }
    if (pr.discord_id) { try { await giveRoles(pr.discord_id); } catch (e) { errors.push('роли: ' + String((e as Error).message || e)); } }
    // ник на сервере: «номер | имя персонажа», как у остальных жителей
    if (pr.discord_id) {
      const nick = `${ch.number} | ${(ch.name || '').trim()}`.slice(0, 32);
      try { await discord('PATCH', `/guilds/${GUILD}/members/${pr.discord_id}`, { nick }); }
      catch (e) { errors.push('ник: ' + String((e as Error).message || e)); }
    }
  }

  const [title, color, lead] = VERDICT[rv.verdict] ?? VERDICT.comment;
  const description = [lead, body ? '> ' + body.slice(0, 3500).replace(/\n/g, '\n> ') : ''].filter(Boolean).join('\n\n');
  const embed = {
    title, color, description,
    author: { name: '⚙️ Хроники Меттенхейма' },
    fields: [
      { name: '🎭 Персонаж', value: (ch.number ? num(ch.number) + ' · ' : '') + (ch.name || 'Без имени'), inline: true },
      ...(master?.display_name ? [{ name: '✒️ Мастер', value: master.display_name, inline: true }] : []),
      ...(channel && rv.verdict === 'approved' ? [{ name: '🗝️ Твой кабинет на сервере', value: `<#${channel}>`, inline: false }] : [])
    ],
    footer: { text: '💬 Ответить мастеру можно в личном кабинете' },
    timestamp: new Date().toISOString()
  };
  const buttons = [{ type: 1, components: [
    { type: 2, style: 5, label: 'Открыть кабинет', emoji: { name: '🗝️' }, url: SITE + '#cabinet' },
    ...(channel ? [{ type: 2, style: 5, label: 'Канал персонажа', emoji: { name: '💬' }, url: `https://discord.com/channels/${GUILD}/${channel}` }] : [])
  ] }];

  // в канал персонажа — все решения и комментарии, кроме самого принятия (там уже карточка)
  if (channel && rv.verdict !== 'approved') {
    try { await say(channel, { content: pr.discord_id ? `<@${pr.discord_id}>` : '', embeds: [embed] }); } catch (e) { errors.push('канал: ' + String((e as Error).message || e)); }
  }
  // в личку
  if (pr.notify && pr.discord_id) {
    try {
      const dm = await discord('POST', '/users/@me/channels', { recipient_id: pr.discord_id });
      await say(dm.id, { embeds: [embed], components: buttons });
    } catch (e) { errors.push('личка: ' + String((e as Error).message || e)); }
  }
  if (errors.length) await mark(errors.join(' | ').slice(0, 300));
  return json({ ok: !errors.length, errors });
});
