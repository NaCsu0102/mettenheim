// Бот «Хроники Меттенхейма»: пишет игроку в личку Discord о решении мастера.
// Вызывается триггером notify_bot из базы. Нужен секрет DISCORD_BOT_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SB = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TOKEN = Deno.env.get('DISCORD_BOT_TOKEN') ?? '';
const SITE = Deno.env.get('SITE_URL') ?? 'https://nacsu0102.github.io/mettenheim/';
const API = 'https://discord.com/api/v10';

const VERDICT: Record<string, [string, number, string]> = {
  approved: ['Квента принята', 0x7fa36a, 'Добро пожаловать в Меттенхейм! Персонаж принят.'],
  revision: ['Квента возвращена на доработку', 0xd0a03c, 'Мастер просит кое-что поправить. Исправь и отправь снова.'],
  rejected: ['Квента отклонена', 0xc2523f, 'Мастер отклонил квенту.'],
  comment: ['Новое сообщение от мастера', 0xb8925a, '']
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

async function discord(path: string, body: unknown) {
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Discord ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!TOKEN) return json({ error: 'DISCORD_BOT_TOKEN не задан' }, 500);
  let id: number;
  try { id = Number((await req.json()).review_id); } catch { return json({ error: 'bad body' }, 400); }
  if (!id) return json({ error: 'no review_id' }, 400);

  // Мастер часто ставит статус и сразу пишет комментарий — ждём, чтобы отправить одним сообщением.
  await sleep(5000);
  const { data: rv } = await SB.from('reviews').select('*').eq('id', id).maybeSingle();
  if (!rv || rv.notified_at) return json({ skip: 'нет записи или уже отправлено' });
  if (Date.now() - new Date(rv.created_at).getTime() > 10 * 60 * 1000) return json({ skip: 'старая запись' });

  const { data: ch } = await SB.from('characters').select('id,name,owner,status').eq('id', rv.character_id).maybeSingle();
  if (!ch) return json({ skip: 'нет персонажа' });
  if (rv.author === ch.owner) return json({ skip: 'это сообщение самого игрока' });

  let body = rv.body || '';
  const claim = [rv.id];
  if (rv.verdict === 'comment') {
    // если рядом есть смена статуса от того же мастера — её сообщение уже включит этот комментарий
    const since = new Date(new Date(rv.created_at).getTime() - 20000).toISOString();
    const { data: near } = await SB.from('reviews').select('id').eq('character_id', ch.id).eq('author', rv.author)
      .in('verdict', ['approved', 'revision', 'rejected']).gte('created_at', since).lte('created_at', rv.created_at).limit(1);
    if (near && near.length) return json({ skip: 'войдёт в сообщение о статусе' });
  } else {
    const until = new Date(new Date(rv.created_at).getTime() + 20000).toISOString();
    const { data: com } = await SB.from('reviews').select('id,body').eq('character_id', ch.id).eq('author', rv.author)
      .eq('verdict', 'comment').gte('created_at', rv.created_at).lte('created_at', until).is('notified_at', null);
    (com || []).forEach((c) => { if (c.body) body += (body ? '\n\n' : '') + c.body; claim.push(c.id); });
  }

  const { data: pr } = await SB.from('profiles').select('discord_id,notify,display_name').eq('id', ch.owner).maybeSingle();
  const { data: master } = rv.author ? await SB.from('profiles').select('display_name').eq('id', rv.author).maybeSingle() : { data: null };
  const mark = (err: string | null) => SB.from('reviews').update({ notified_at: new Date().toISOString(), notify_error: err }).in('id', claim);
  if (!pr || !pr.notify) { await mark('игрок отключил уведомления'); return json({ skip: 'уведомления выключены' }); }
  if (!pr.discord_id) { await mark('нет Discord ID'); return json({ skip: 'нет Discord ID' }); }

  const [title, color, lead] = VERDICT[rv.verdict] ?? VERDICT.comment;
  const description = [lead, body ? '> ' + body.slice(0, 3500).replace(/\n/g, '\n> ') : ''].filter(Boolean).join('\n\n');
  try {
    await mark(null); // сначала отмечаем, чтобы повторный вызов не прислал дубль
    const dm = await discord('/users/@me/channels', { recipient_id: pr.discord_id });
    await discord(`/channels/${dm.id}/messages`, {
      embeds: [{
        title, color, description,
        author: { name: 'Хроники Меттенхейма' },
        fields: [{ name: 'Персонаж', value: ch.name || 'Без имени', inline: true }, ...(master?.display_name ? [{ name: 'Мастер', value: master.display_name, inline: true }] : [])],
        footer: { text: 'Ответить мастеру можно в личном кабинете' },
        timestamp: new Date().toISOString()
      }],
      components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Открыть кабинет', url: SITE + '#cabinet' }] }]
    });
    return json({ ok: true });
  } catch (e) {
    await mark(String((e as Error).message || e).slice(0, 300));
    return json({ error: String(e) }, 502);
  }
});
