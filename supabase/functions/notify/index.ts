// Бот «Хроники Меттенхейма».
// 1) Пишет игроку в личку Discord о решении мастера и комментариях.
// 2) Когда квенту принимают — создаёт канал персонажа в категории «Личный кабинет»,
//    выкладывает карточку персонажа и приветствие с навигацией.
// Вызывается триггером notify_bot из базы. Секрет: DISCORD_BOT_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SB = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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
        '🔌 **3.** Найди сервер Хроник в Conan Exiles. IP и пароль спроси у мастера прямо в этом канале.',
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

/* ---------- обработка ---------- */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!TOKEN) return json({ error: 'DISCORD_BOT_TOKEN не задан' }, 500);
  let id: number;
  try { id = Number((await req.json()).review_id); } catch { return json({ error: 'bad body' }, 400); }
  if (!id) return json({ error: 'no review_id' }, 400);

  // Мастер часто ставит статус и сразу пишет комментарий — ждём, чтобы отправить одним сообщением.
  await sleep(4000);
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
      await say(SUBMIT_CHANNEL, {
        content: role ? `<@&${role}>` : '',
        embeds: [{
          author: { name: op?.discord || op?.display_name || 'Игрок', ...(op?.avatar_url ? { icon_url: op.avatar_url } : {}) },
          title: again ? '📨 Квента подана повторно — после доработки' : '📨 Квента подана на проверку',
          color: 0xd0a03c, fields,
          ...(emblem(d) ? { thumbnail: { url: emblem(d)! } } : {}),
          footer: { text: '⏳ Ждёт решения мастера' }, timestamp: new Date().toISOString()
        }],
        components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Проверить в кабинете мастера', emoji: { name: '🔍' }, url: SITE + '#admin' }] }],
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
