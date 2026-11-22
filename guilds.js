/* Гильдии, цеха, ордена и общества Меттенхейма.
   Данные — в Supabase (supabase/guilds.sql). Пока таблиц нет или сайт открыт не на своём адресе — показываются образцы.
   Гильдия живёт в игре: сайт только записывает то, что было на сервере. */
(() => {
'use strict';
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const play = n => window.MH && MH.play && MH.play(n);
const C = () => window.Cabinet || {};

const KIND = { guild: 'Гильдия', workshop: 'Цех', order: 'Орден', society: 'Общество', artel: 'Артель', service: 'Служба' };
const KIND_HINT = { guild: 'вольное объединение по делу', workshop: 'мастера одного ремесла', order: 'клятва и устав', society: 'клуб, кружок, тайное общество', artel: 'бригада на общий заработок', service: 'стража, госпиталь, контора' };
const HOUSE = { '': 'Вне Домов', talbot: '🟡 Жёлтые', dorn: '🔴 Красные' };
const STATUS = { forming: ['Собирается', 'st-sub'], active: ['Действует', 'st-ok'], archived: ['В архиве', 'st-draft'] };
const RANK = { leader: 'Глава', officer: 'Офицер', member: 'Участник', pending: 'Заявка' };
const DISTRICTS = ['', 'Заводская сторона', 'Ржавые кварталы', 'Верхний город', 'Шахты Люмерита', 'Порт и шлюзы', 'За стенами'];
const MIN_ACTIVE = 3;
const fmt = d => d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const txt = s => esc(s).replace(/\n/g, '<br>');
const pill = s => `<span class="cab-pill ${(STATUS[s] || STATUS.forming)[1]}">${(STATUS[s] || STATUS.forming)[0]}</span>`;
const emblem = g => g.emblem_url ? `<img class="gd-emb" src="${esc(g.emblem_url)}" alt="" loading="lazy">` : `<span class="gd-emb gd-emb-empty h-${g.house || 'none'}">${esc((g.name || '?').slice(0, 1).toUpperCase())}</span>`;

/* ---------- образцы для предпросмотра ---------- */
const DEMO = [
  { id: -1, demo: true, name: 'Цех литейщиков «Горячий ковш»', kind: 'workshop', house: 'dorn', district: 'Заводская сторона', short: 'Литьё, плавка и ремонт заводских котлов. Держим смену, когда остальные спят.', recruit: 'литейщики, подмастерья, механики', recruit_open: true, status: 'active', official: true, members: 7, leader_name: '12 | Бруно Кальт', created_at: '2026-10-30',
    about: 'Старейший цех Заводской стороны. Работаем на заказах Дома Дорн, но котлы чиним всем, кто платит.', goals: 'Держать котельные в строю.\nВыучить новых литейщиков.\nПолучить свой пай с люмеритовой плавки.', charter: 'Смена — святое.\nСвой не бросает своего у печи.\nКлеймо цеха ставят только мастера.', relations: 'Дом Дорн — заказчик и защитник. Артели Ржавых кварталов — соседи и соперники.' },
  { id: -2, demo: true, name: 'Протезная мастерская Вельс', kind: 'service', house: 'talbot', district: 'Верхний город', short: 'Ставим руки, ноги и глаза тем, кого искалечил завод. Бедным — в долг.', recruit: 'протезисты, лекари, инженеры', recruit_open: true, status: 'forming', official: false, members: 2, leader_name: '27 | Ида Вельс', created_at: '2026-11-14',
    about: 'Мастерская при Доме Талбот. Учимся у старших протезистов и берём заказы с улицы.', goals: 'Собрать постоянный состав.\nОткрыть приём в Ржавых кварталах.', charter: 'Не отказывать раненому.\nЧертежи — общие.', relations: '' },
  { id: -3, demo: true, name: 'Общество Тихого корня', kind: 'society', house: '', district: 'Ржавые кварталы', short: 'Чай, разговоры и старые песни. О чём ещё — знают только свои.', recruit: '', recruit_open: false, status: 'active', official: false, members: 4, leader_name: '33 | Маргит', created_at: '2026-11-02',
    about: 'Собираемся по средам в задней комнате чайной.', goals: '', charter: 'Что сказано у корня — остаётся у корня.', relations: 'Инквизиция о нас не знает. Пусть так и будет.' }
];
const DEMO_ROSTER = [{ number: 12, name: 'Бруно Кальт', rank: 'leader', title: 'мастер цеха' }, { number: 18, name: 'Тесса Ворн', rank: 'officer', title: 'казначей' }, { number: 21, name: 'Гримм', rank: 'member', title: '' }];

/* ---------- доступ к базе ---------- */
async function ctx() {
  const cab = C();
  const live = !!(cab.liveSite && cab.liveSite());
  const out = { live, c: null, me: null, prof: null, staff: false };
  if (!live) return out;
  try {
    out.c = await cab.client();
    const s = await cab.api.session();
    if (s) { out.me = s.user.id; out.prof = await cab.api.myProfile(out.me); out.staff = !!(out.prof && ['master', 'admin'].includes(out.prof.role)); }
  } catch (_) {}
  return out;
}
const errText = e => {
  const m = (e && (e.message || e.details)) || String(e || '');
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Нет связи с сервером. Попробуй ещё раз через минуту.';
  if (/function .* does not exist|relation .* does not exist|schema cache/i.test(m)) return 'Гильдии ещё не включены в базе — мастера скоро их откроют.';
  return m || 'Что-то пошло не так.';
};
const toast = (el, t, bad) => { const b = q('.cab-toast', el); if (!b) return; b.textContent = t; b.classList.toggle('bad', !!bad); clearTimeout(toast.t); toast.t = setTimeout(() => { b.textContent = ''; }, 6000); };
async function myChars(x) {
  if (!x.me) return [];
  try { return (await C().api.myChars(x.me)).filter(ch => ch.status === 'approved'); } catch (_) { return []; }
}
function login(el, after) {
  try { sessionStorage.setItem('mh:after-login', after); } catch (_) {}
  C().api.signInDiscord().catch(e => toast(el, errText(e), true));
}

/* ---------- модальное окно ---------- */
function modal(title, inner, onSubmit) {
  const m = document.createElement('div'); m.className = 'gl-box'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<form class="gb-up panel gd-form"><button type="button" class="gb-x" aria-label="Закрыть">✕</button><div class="eyebrow">Гильдии</div><h3>${esc(title)}</h3>${inner}
    <div class="cab-acts"><button class="btn" type="submit">Сохранить</button><button type="button" class="btn ghost gb-cancel">Отмена</button></div><p class="cab-toast" role="status"></p></form>`;
  document.body.append(m); document.body.classList.add('gl-lock');
  const close = () => { m.remove(); document.body.classList.remove('gl-lock'); removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.gb-x,.gb-cancel')) close(); });
  const form = q('form', m);
  form.onsubmit = async e => {
    e.preventDefault(); const btn = q('button[type=submit]', form); btn.disabled = true;
    try { await onSubmit(form); close(); } catch (er) { toast(m, errText(er), true); btn.disabled = false; }
  };
  const first = q('input,select,textarea', form); if (first) first.focus();
  return m;
}
const charSelect = (chars, name = 'char') => `<label>Персонаж<select name="${name}" required>${chars.map(ch => `<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join('')}</select></label>`;
const kindSelect = cur => `<label>Вид<select name="kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v} — ${KIND_HINT[k]}</option>`).join('')}</select></label>`;
const houseSelect = cur => `<label>Дом<select name="house">${Object.entries(HOUSE).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`;

// Вывеска гильдии: висит на цепях над улицей, лента — цвет покровителя
const sway = id => ((Math.abs(+id || 7) * 37) % 9 - 4) * .6;
const card = g => `<a class="gd-sign h-${g.house || 'none'}${g.official ? ' gd-official' : ''}${g.status === 'archived' ? ' gd-arch' : ''}" href="#guild-${g.id}" style="--sw:${sway(g.id)}deg">
  <i class="gd-chain l" aria-hidden="true"></i><i class="gd-chain r" aria-hidden="true"></i>
  <span class="gd-board">${emblem(g)}<b>${esc(g.name)}</b><small>${KIND[g.kind] || 'Гильдия'} · ${g.members} в книге учёта</small>${g.official ? '<span class="gd-crest">Признана городом</span>' : ''}</span>
  <span class="gd-tag">${g.status === 'archived' ? 'Контора закрыта' : g.recruit_open ? (g.recruit ? 'Ищем: ' + esc(g.recruit) : 'Двери открыты') : 'Набор закрыт'}</span></a>`;
// Улицы: гильдии развешаны по своим районам
const street = list => {
  const by = {}; list.forEach(g => { const d = g.district || 'Окраины и переулки'; (by[d] = by[d] || []).push(g); });
  const order = [...DISTRICTS.filter(Boolean), 'Окраины и переулки'].filter(d => by[d]);
  return order.map(d => `<section class="gd-street"><h3 class="gd-dist"><span>${esc(d)}</span></h3><div class="gd-beam" aria-hidden="true"></div><div class="gd-signs">${by[d].map(card).join('')}</div></section>`).join('');
};

/* =================== СПИСОК ГИЛЬДИЙ =================== */
async function listPage(el) {
  if (!el) return;
  const x = await ctx();
  let all = [], demo = !x.live;
  const f = { kind: '', house: '', status: 'live', open: false, text: '' };
  el.innerHTML = `<article class="panel gd-rule"><b>Улицы гильдий Меттенхейма.</b> Над каждой дверью — вывеска: цех, артель, орден или служба. <b>Гильдия живёт в игре.</b> Вступление, повышения, награды и вся жизнь гильдии отыгрываются на сервере — сайт только записывает то, что было. Гильдию, которая существует лишь на сайте, мастера отправляют в архив. С ${MIN_ACTIVE} участников гильдия считается действующей.</article>
    <div class="gl-bar panel">
      <input type="search" class="gd-search" placeholder="Поиск по названию" aria-label="Поиск гильдии">
      <div class="gl-chips" role="group" aria-label="Состояние">${[['live', 'Открытые конторы'], ['archived', 'Закрытые']].map(([k, t]) => `<button type="button" data-fs="${k}" aria-pressed="${k === 'live'}">${t}</button>`).join('')}</div>
      <label class="gd-open"><input type="checkbox" data-fo> Только с открытым набором</label>
      <span class="gl-count muted"></span><button type="button" class="btn small" id="gdAdd">＋ Основать гильдию</button></div>
    <p class="gl-note" hidden></p><div class="gd-city" id="gdGrid"><p class="muted">Загружаю гильдии…</p></div><p class="cab-toast" role="status" aria-live="polite"></p>`;
  const grid = q('#gdGrid', el), note = q('.gl-note', el);
  async function load() {
    if (!x.live) { all = DEMO; return; }
    const r = await x.c.rpc('guild_list');
    if (r.error) { demo = true; all = DEMO; return; }
    demo = false; all = r.data || [];
    if (!all.length) { demo = true; all = DEMO; }
  }
  function draw() {
    const t = f.text.toLowerCase();
    const list = all.filter(g => (!f.kind || g.kind === f.kind) && (!f.house || (f.house === 'none' ? !g.house : g.house === f.house))
      && (f.status === 'archived' ? g.status === 'archived' : g.status !== 'archived') && (!f.open || g.recruit_open) && (!t || g.name.toLowerCase().includes(t)));
    note.hidden = !demo;
    note.innerHTML = demo ? (x.live ? 'Пока на улицах ни одной вывески — это образцы. Основай первую гильдию, и её вывеска повиснет в твоём районе.' : 'Это предпросмотр: здесь образцы. Основывать гильдии и вступать в них можно на основном сайте.') : '';
    q('.gl-count', el).textContent = `Найдено: ${list.length}`;
    grid.innerHTML = list.length ? street(list)
      : `<article class="panel cab-empty"><h3>${all.length ? 'Под фильтр ничего не подошло' : 'Гильдий пока нет'}</h3><p class="muted">Основай первую — цех, артель, орден или тайное общество.</p></article>`;
  }
  el.addEventListener('click', e => {
    const k = e.target.closest('[data-fk]'); if (k) { f.kind = k.dataset.fk; qa('[data-fk]', el).forEach(b => b.setAttribute('aria-pressed', b === k)); draw(); return; }
    const h = e.target.closest('[data-fh]'); if (h) { f.house = h.dataset.fh; qa('[data-fh]', el).forEach(b => b.setAttribute('aria-pressed', b === h)); draw(); return; }
    const s = e.target.closest('[data-fs]'); if (s) { f.status = s.dataset.fs; qa('[data-fs]', el).forEach(b => b.setAttribute('aria-pressed', b === s)); draw(); }
  });
  q('[data-fo]', el).onchange = e => { f.open = e.target.checked; draw(); };
  q('.gd-search', el).oninput = e => { f.text = e.target.value.trim(); draw(); };
  const add = q('#gdAdd', el);
  if (x.live && !x.me) add.textContent = 'Войти и основать гильдию';
  add.onclick = async () => {
    if (!x.live) { toast(el, 'Основывать гильдии можно на основном сайте', true); return; }
    if (!x.me) { login(el, 'guilds'); return; }
    if (demo) { toast(el, 'Гильдии ещё не включены в базе — мастера скоро их откроют', true); return; }
    const chars = await myChars(x);
    if (!chars.length) { toast(el, 'Основать гильдию может только принятый персонаж. Сначала дождись принятия квенты.', true); return; }
    modal('Основать гильдию', `${charSelect(chars)}<small class="muted">Этот персонаж станет главой.</small>
      <label>Название<input type="text" name="name" minlength="3" maxlength="80" required placeholder="Например: «Цех литейщиков „Горячий ковш“»"></label>
      ${kindSelect('guild')}${houseSelect('')}
      <label>Коротко о гильдии<input type="text" name="short" maxlength="160" placeholder="Одна строка — её увидят в списке"></label>
      <p class="muted gu-rule">Цели, устав и набор заполнишь на странице гильдии. До ${MIN_ACTIVE} участников гильдия «собирается».</p>`, async form => {
      const r = await x.c.rpc('guild_create', { p_name: form.name.value.trim(), p_kind: form.kind.value, p_house: form.house.value, p_short: form.short.value.trim(), p_char: form.char.value });
      if (r.error) throw r.error;
      play('click'); location.hash = '#guild-' + r.data;
    });
  };
  await load(); draw();
}

/* =================== СТРАНИЦА ГИЛЬДИИ =================== */
async function guildPage(el, arg) {
  if (!el) return;
  const id = +arg;
  const x = await ctx();
  let g = null, roster = [], posts = [], requests = [], mine = [], chars = [], demo = !x.live || id < 0, tab = 'about';
  el.innerHTML = '<p class="muted">Открываю гильдию…</p>';
  async function load() {
    if (demo) {
      g = DEMO.find(d => d.id === id) || DEMO[0]; roster = g.id === -1 ? DEMO_ROSTER : DEMO_ROSTER.slice(0, g.members > 2 ? 3 : g.members);
      posts = [{ id: -1, kind: 'news', title: 'Набор подмастерьев', body: 'Ждём у ворот котельной после вечерней смены.', author_name: g.leader_name, created_at: g.created_at }, { id: -2, kind: 'chronicle', title: 'Первая плавка', body: 'Цех впервые отлил котёл для Дома целиком своими руками.', author_name: g.leader_name, created_at: g.created_at }];
      return;
    }
    const [lst, rs, ps] = await Promise.all([x.c.rpc('guild_list'), x.c.rpc('guild_roster', { gid: id }), x.c.from('guild_posts').select('*').eq('guild_id', id).order('created_at', { ascending: false }).limit(200)]);
    if (lst.error) throw lst.error;
    const base = (lst.data || []).find(r => r.id === id);
    if (!base) { g = null; return; }
    const full = await x.c.from('guilds').select('*').eq('id', id).maybeSingle();
    g = Object.assign({}, base, full.data || {});
    roster = rs.data || []; posts = ps.data || [];
    mine = [];
    if (x.me) {
      const mm = await x.c.rpc('guild_mine'); mine = (mm.data || []).filter(r => r.guild_id === id);
      chars = await myChars(x);
    }
    const manage = x.staff || mine.some(r => ['leader', 'officer'].includes(r.rank));
    if (manage) { const rq = await x.c.rpc('guild_requests', { gid: id }); requests = rq.data || []; } else requests = [];
  }
  const myRank = () => mine.reduce((best, r) => ['leader', 'officer', 'member', 'pending'].indexOf(r.rank) < ['leader', 'officer', 'member', 'pending'].indexOf(best) ? r.rank : best, 'none');
  const canManage = () => !demo && (x.staff || ['leader', 'officer'].includes(myRank()));
  const isLeader = () => !demo && (x.staff || myRank() === 'leader');
  function section(h, body) { return body ? `<h2>${h}</h2><p>${txt(body)}</p>` : ''; }
  function list(h, body) { const items = String(body || '').split('\n').map(s => s.trim()).filter(Boolean); return items.length ? `<h2>${h}</h2><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''; }
  function draw() {
    if (!g) { el.innerHTML = `<article class="panel cab-empty"><h3>Такой гильдии нет</h3><p class="muted">Возможно, её распустили. <a href="#guilds">Ко всем гильдиям</a></p></article>`; return; }
    const r = myRank();
    const freeChars = chars.filter(ch => !mine.some(m => m.character_id === ch.id));
    const joinBtn = g.status === 'archived' ? '' : demo ? (g.recruit_open ? '<button type="button" class="btn" data-a="join">Вступить</button>' : '')
      : !x.me ? '<button type="button" class="btn" data-a="login">Войти и вступить</button>'
      : r === 'pending' ? '<span class="cab-pill st-sub">Заявка отправлена</span>'
      : g.recruit_open && freeChars.length ? `<button type="button" class="btn" data-a="join">${r === 'none' ? 'Вступить' : 'Вступить ещё персонажем'}</button>` : '';
        el.innerHTML = `<p class="gl-note"${demo ? '' : ' hidden'}>${demo ? 'Это образец гильдии — так будет выглядеть страница настоящей.' : ''}</p>
      <article class="panel gd-head">
        ${emblem(g)}
        <div class="gd-head-main"><div class="eyebrow">${KIND[g.kind] || 'Гильдия'}${g.house ? ' · под покровительством Дома ' + (g.house === 'dorn' ? 'Дорн' : 'Талбот') : ' · вольная'}${g.district ? ' · ' + esc(g.district) : ''}</div>
          <h2>${esc(g.name)}</h2>${g.short ? `<p class="gd-short">${esc(g.short)}</p>` : ''}
          <div class="gd-badges">${g.official ? '<span class="cab-pill st-ok">✓ Признана городом</span>' : ''}${pill(g.status)}<span class="cab-pill ${g.recruit_open ? 'st-ok' : 'st-draft'}">${g.recruit_open ? 'Набор открыт' : 'Набор закрыт'}</span></div>
          ${g.recruit_open && g.recruit ? `<p class="gd-recruit"><b>Ищем:</b> ${esc(g.recruit)}</p>` : ''}
          <dl class="gd-facts"><div><dt>Глава</dt><dd>${esc(g.leader_name || '—')}</dd></div><div><dt>Состав</dt><dd>${roster.length}</dd></div><div><dt>Основана</dt><dd>${fmt(g.created_at)}</dd></div></dl>
          <div class="gd-acts">${joinBtn}${canManage() ? '<button type="button" class="btn small ghost" data-a="edit">Редактировать</button><button type="button" class="btn small ghost" data-a="post">＋ Запись</button>' : ''}
            ${!demo && r !== 'none' && r !== 'leader' ? '<button type="button" class="btn small ghost" data-a="leave">Выйти из гильдии</button>' : ''}
            ${!demo && myRank() === 'leader' && g.status !== 'archived' ? '<button type="button" class="btn small ghost" data-a="dissolve">Распустить</button>' : ''}
            ${!demo && x.staff ? `<button type="button" class="btn small ghost" data-a="official">${g.official ? 'Снять признание' : '✓ Признать городом'}</button><button type="button" class="btn small ghost" data-a="archive">${g.status === 'archived' ? 'Вернуть из архива' : 'В архив'}</button>` : ''}
            <a class="btn small ghost" href="#guilds">Все гильдии</a></div>
        </div></article>
      <div class="gd-office">
        <section class="gd-charter"><div class="gd-k">Хартия гильдии</div>${charterBody()}<div class="gd-seal h-${g.house || 'none'}" title="${g.house ? 'Покровитель: ' + HOUSE[g.house] : 'Вольная гильдия'}"><span>${g.house === 'talbot' ? 'Т' : g.house === 'dorn' ? 'Д' : '✦'}</span></div></section>
        <section class="gd-ledger"><div class="gd-k">Книга учёта</div>${rosterBody()}</section>
        <section class="gd-board-notes"><div class="gd-k">Доска поручений</div>${postList('news')}</section>
        <section class="gd-chron"><div class="gd-k">Хроника</div>${postList('chronicle')}</section>
      </div><p class="cab-toast" role="status" aria-live="polite"></p>`;
  }
  function postList(kind) {
    const ps = posts.filter(p => p.kind === kind);
    if (!ps.length) return `<p class="muted">${kind === 'news' ? 'Поручений пока нет.' : 'Хроника пуста. Сюда записывают, что гильдия сделала в игре.'}</p>`;
    return ps.map(p => `<article class="gd-post"><div class="gd-post-h"><b>${esc(p.title)}</b><small>${fmt(p.created_at)} · ${esc(p.author_name || 'Житель')}</small>${canManage() || (x.me && p.author === x.me) ? `<button type="button" class="gb-cdel" data-del="${p.id}" aria-label="Удалить запись">✕</button>` : ''}</div>${p.body ? `<p>${txt(p.body)}</p>` : ''}</article>`).join('');
  }
  function rosterBody() {
    const lead = isLeader();
    const rows = roster.map(m => `<div class="gd-mem"><span class="gd-rank r-${m.rank}">${RANK[m.rank]}</span>
        <a href="${m.number ? '#hero-' + m.number : '#residents'}"><b>${m.number ? m.number + ' | ' : ''}${esc(m.name)}</b></a>${m.title ? `<small>${esc(m.title)}</small>` : ''}
        ${!demo && canManage() && m.rank !== 'leader' ? `<span class="gd-mem-acts">${lead ? `<button type="button" class="btn small ghost" data-rank="${m.character_id}">Звание</button>` : ''}<button type="button" class="btn small ghost" data-kick="${m.character_id}">Исключить</button></span>` : ''}</div>`).join('');
    const reqs = canManage() && requests.length ? `<h4 class="gd-sub">Просятся в книгу · ${requests.length}</h4>${requests.map(rq => `<div class="gd-mem gd-req"><b>${esc(rq.name)}</b>${rq.message ? `<p>${esc(rq.message)}</p>` : ''}<span class="gd-mem-acts"><button type="button" class="btn small" data-accept="${rq.character_id}">Принять</button><button type="button" class="btn small ghost" data-decline="${rq.character_id}">Отклонить</button></span></div>`).join('')}` : '';
    return reqs + (rows || '<p class="muted">В книге пока пусто.</p>');
  }
  function charterBody() {
    const body = section('О гильдии', g.about) + list('Цели', g.goals) + list('Устав', g.charter) + (g.recruit ? `<h2>Кого принимаем</h2><p>${esc(g.recruit)}</p>` : '') + section('Отношения', g.relations);
    return `<div class="prose">${body || '<p class="muted">Глава ещё не рассказал о гильдии.</p>'}</div>`;
  }
  async function act(fn) { try { await fn(); await load(); draw(); play('click'); } catch (e) { toast(el, errText(e), true); } }
  const rpc = async (name, args) => { const r = await x.c.rpc(name, args); if (r.error) throw r.error; return r.data; };
  el.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
    const a = e.target.closest('[data-a]');
    if (a) {
      const k = a.dataset.a;
      if (demo) { toast(el, 'Это образец — на настоящей гильдии кнопка сработает', true); return; }
      if (k === 'login') login(el, 'guild-' + id);
      if (k === 'join') {
        const free = chars.filter(ch => !mine.some(m => m.character_id === ch.id));
        if (!free.length) { toast(el, 'Вступать может только принятый персонаж', true); return; }
        modal('Вступить в гильдию', `${charSelect(free)}<label>Пара слов главе<textarea name="msg" rows="3" maxlength="500" placeholder="Кто ты в игре и чем можешь помочь"></textarea></label><p class="muted gu-rule">Главе стоит встретиться с тобой на сервере: вступление отыгрывают в игре.</p>`,
          async form => { await rpc('guild_apply', { gid: id, p_char: form.char.value, p_msg: form.msg.value.trim() }); await load(); draw(); toast(el, 'Заявка отправлена главе'); });
      }
      if (k === 'leave') { const m = mine.find(r => r.rank !== 'leader'); if (!m) return; if (!a.dataset.sure) { a.dataset.sure = 1; a.textContent = 'Точно выйти?'; return; } act(() => rpc('guild_remove', { gid: id, p_char: m.character_id })); }
      if (k === 'dissolve') { if (!a.dataset.sure) { a.dataset.sure = 1; a.textContent = 'Точно распустить? Вернуть сможет только мастер'; return; } act(async () => { const r = await x.c.from('guilds').update({ status: 'archived' }).eq('id', id); if (r.error) throw r.error; }); }
      if (k === 'official') act(() => rpc('guild_moderate', { gid: id, p_official: !g.official, p_archived: g.status === 'archived' }));
      if (k === 'archive') act(() => rpc('guild_moderate', { gid: id, p_official: g.official, p_archived: g.status !== 'archived' }));
      if (k === 'post') modal('Новая запись', `<label>Куда<select name="kind"><option value="news">Поручение на доску</option><option value="chronicle">Хроника — что гильдия сделала в игре</option></select></label><label>Заголовок<input type="text" name="title" maxlength="120" required></label><label>Текст<textarea name="body" rows="6" maxlength="6000"></textarea></label>`,
        async form => { const r = await x.c.from('guild_posts').insert({ guild_id: id, kind: form.kind.value, title: form.title.value.trim(), body: form.body.value.trim() }); if (r.error) throw r.error; tab = form.kind.value; await load(); draw(); });
      if (k === 'edit') modal('Гильдия', `<label>Название<input type="text" name="name" minlength="3" maxlength="80" required value="${esc(g.name)}"></label>${kindSelect(g.kind)}${houseSelect(g.house)}
          <label>Район<select name="district">${DISTRICTS.map(d => `<option value="${esc(d)}"${d === g.district ? ' selected' : ''}>${d || 'Не указан'}</option>`).join('')}</select></label>
          <label>Коротко<input type="text" name="short" maxlength="160" value="${esc(g.short)}"></label>
          <label>О гильдии<textarea name="about" rows="4" maxlength="4000">${esc(g.about)}</textarea></label>
          <label>Цели <small class="muted">— каждая с новой строки</small><textarea name="goals" rows="3" maxlength="2000">${esc(g.goals)}</textarea></label>
          <label>Устав <small class="muted">— каждое правило с новой строки</small><textarea name="charter" rows="4" maxlength="4000">${esc(g.charter)}</textarea></label>
          <label>Кого ищем<input type="text" name="recruit" maxlength="300" value="${esc(g.recruit)}" placeholder="литейщики, подмастерья, механики"></label>
          <label class="gd-open"><input type="checkbox" name="recruit_open"${g.recruit_open ? ' checked' : ''}> Набор открыт</label>
          <label>Отношения с Домами и другими гильдиями<textarea name="relations" rows="3" maxlength="2000">${esc(g.relations)}</textarea></label>
          <label>Ссылка на герб <small class="muted">— картинка https://…, можно из Витрины артов</small><input type="url" name="emblem_url" value="${esc(g.emblem_url)}" placeholder="https://"></label>`,
        async form => {
          const emb = form.emblem_url.value.trim();
          if (emb && !/^https:\/\//.test(emb)) throw new Error('Ссылка на герб должна начинаться с https://');
          const patch = { name: form.name.value.trim(), kind: form.kind.value, house: form.house.value, district: form.district.value, short: form.short.value.trim(), about: form.about.value.trim(), goals: form.goals.value.trim(), charter: form.charter.value.trim(), recruit: form.recruit.value.trim(), recruit_open: form.recruit_open.checked, relations: form.relations.value.trim(), emblem_url: emb };
          const r = await x.c.from('guilds').update(patch).eq('id', id); if (r.error) throw r.error; await load(); draw();
        });
      return;
    }
    const acc = e.target.closest('[data-accept]'); if (acc) { act(() => rpc('guild_decide', { gid: id, p_char: acc.dataset.accept, p_accept: true })); return; }
    const dec = e.target.closest('[data-decline]'); if (dec) { act(() => rpc('guild_decide', { gid: id, p_char: dec.dataset.decline, p_accept: false })); return; }
    const kick = e.target.closest('[data-kick]'); if (kick) { if (!kick.dataset.sure) { kick.dataset.sure = 1; kick.textContent = 'Точно?'; return; } act(() => rpc('guild_remove', { gid: id, p_char: kick.dataset.kick })); return; }
    const rk = e.target.closest('[data-rank]');
    if (rk) {
      const m = roster.find(z => z.character_id === rk.dataset.rank); if (!m) return;
      modal('Звание и должность', `<p><b>${esc(m.name)}</b></p><label>Звание<select name="rank"><option value="member"${m.rank === 'member' ? ' selected' : ''}>Участник</option><option value="officer"${m.rank === 'officer' ? ' selected' : ''}>Офицер — принимает заявки и пишет записи</option><option value="leader">Глава — передать главенство</option></select></label><label>Должность<input type="text" name="title" maxlength="40" value="${esc(m.title)}" placeholder="казначей, мастер цеха…"></label>`,
        async form => { await rpc('guild_set_rank', { gid: id, p_char: m.character_id, p_rank: form.rank.value, p_title: form.title.value.trim() }); await load(); draw(); });
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) { if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = 'Удалить?'; return; } act(async () => { const r = await x.c.from('guild_posts').delete().eq('id', +del.dataset.del); if (r.error) throw r.error; }); }
  });
  try { await load(); } catch (e) { demo = true; await load(); }
  draw();
}

/* =================== ВИТРИНА ГИЛЬДИЙ НА ГЛАВНОЙ =================== */
async function mini(el) {
  if (!el) return;
  const x = await ctx();
  let all = DEMO, demo = true;
  if (x.live) { try { const r = await x.c.rpc('guild_list'); if (!r.error && r.data && r.data.length) { all = r.data; demo = false; } } catch (_) {} }
  const top = all.filter(g => g.status !== 'archived').sort((a, b) => (b.official - a.official) || (b.members - a.members)).slice(0, 3);
  el.innerHTML = `<div class="sec-head"><div class="eyebrow">Цеха, ордена и общества</div><h2>Гильдии Меттенхейма</h2><p>Их ведут сами игроки: устав, состав, объявления и летопись того, что гильдия сделала в игре.${demo ? ' Пока — образцы, первые настоящие гильдии появятся здесь сами.' : ''}</p></div>
    <div class="gd-grid">${top.map(card).join('')}</div>
    <div class="gd-home-foot"><a class="btn small" href="#guilds">Все гильдии →</a><a class="btn small ghost" href="#guilds">Основать свою</a></div>`;
}

window.Guilds = { list: listPage, page: guildPage, mini, KIND, HOUSE };
})();
