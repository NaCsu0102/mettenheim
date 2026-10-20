/* Личный кабинет игрока и кабинет администратора.
   Данные — в Supabase (см. config.js и supabase/schema.sql). Вход через Discord или письмо со ссылкой.
   Весь доступ к базе идёт через объект api: для проверки его можно подменить window.MH_CABINET_API. */
(() => {
'use strict';
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const play = n => window.MH && MH.play && MH.play(n);
const CFG = window.MH_SUPABASE || {};
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
const AFTER_KEY = 'mh:after-login';

const STATUS = {
  draft: ['Черновик', 'st-draft', 'Видишь только ты. Допиши и отправь на проверку.'],
  submitted: ['На проверке', 'st-sub', 'Мастера читают квенту. Пока она на проверке, править нельзя — можно отозвать.'],
  revision: ['На доработке', 'st-rev', 'Мастер вернул квенту с замечаниями. Исправь и отправь снова.'],
  approved: ['Принята', 'st-ok', 'Персонаж принят. Добро пожаловать в Меттенхейм.'],
  rejected: ['Отклонена', 'st-no', 'Квента отклонена. Причина — в истории ниже.'],
  archived: ['В архиве', 'st-draft', 'Персонаж в архиве.']
};
const VERDICT = { comment: 'Комментарий', submitted: 'Отправлена на проверку', withdrawn: 'Отозвана в черновик', revision: 'Возвращена на доработку', approved: 'Принята', rejected: 'Отклонена' };
const ROLE = { player: 'Игрок', master: 'Мастер', admin: 'Администратор' };
const MIN_QUENTA = 1500;
const fmtDate = d => d ? new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const pill = s => `<span class="cab-pill ${(STATUS[s] || STATUS.draft)[1]}">${(STATUS[s] || STATUS.draft)[0]}</span>`;

/* ---------- справочники из сайта ---------- */
const Mx = () => window.M || {};
const peoples = () => Mx().peoples || [];
const originsOf = p => (peoples().find(x => x.id === p) || { origins: [] }).origins;
const classes = () => Mx().classes || [];
const backgrounds = () => Mx().backgrounds || [];
const curses = () => Mx().curses || [];
const education = () => Mx().education || [];
const nameOf = (list, id) => (list.find(x => x.id === id) || {}).name || '';
const describe = d => [nameOf(peoples(), d.p), nameOf(originsOf(d.p), d.o), nameOf(classes(), d.c)].filter(Boolean).join(' · ');

/* ---------- слой данных: Supabase ---------- */
function loadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = SB_LIB; s.onload = res; s.onerror = () => rej(new Error('lib')); document.head.appendChild(s); });
}
let sbPromise = null;
function sb() {
  if (!sbPromise) sbPromise = loadLib().then(() => window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }));
  return sbPromise;
}
const must = r => { if (r.error) throw r.error; return r.data; };
const SupabaseApi = {
  configured: () => !!(CFG.url && CFG.anonKey),
  methods: () => ({ discord: CFG.discord !== false, email: CFG.email !== false }),
  async session() { const c = await sb(); const { data } = await c.auth.getSession(); return data.session; },
  async onAuth(cb) { const c = await sb(); c.auth.onAuthStateChange((_e, s) => cb(s)); },
  async signInDiscord() { const c = await sb(); must(await c.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname } })); },
  async signInEmail(email) { const c = await sb(); must(await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })); },
  async signOut() { const c = await sb(); await c.auth.signOut(); },
  async myProfile(uid) { const c = await sb(); return must(await c.from('profiles').select('*').eq('id', uid).maybeSingle()); },
  async saveProfile(uid, patch) { const c = await sb(); return must(await c.from('profiles').update(patch).eq('id', uid).select().single()); },
  async myChars(uid) { const c = await sb(); return must(await c.from('characters').select('id,name,status,data,updated_at,submitted_at,reviewed_at').eq('owner', uid).order('updated_at', { ascending: false })); },
  async getChar(id) { const c = await sb(); return must(await c.from('characters').select('*').eq('id', id).single()); },
  async createChar(row) { const c = await sb(); return must(await c.from('characters').insert(row).select().single()); },
  async saveChar(id, patch) { const c = await sb(); return must(await c.from('characters').update(patch).eq('id', id).select().single()); },
  async deleteChar(id) { const c = await sb(); must(await c.from('characters').delete().eq('id', id)); },
  async reviews(id) { const c = await sb(); return must(await c.from('reviews').select('*').eq('character_id', id).order('created_at', { ascending: true })); },
  async addReview(charId, uid, verdict, body) { const c = await sb(); return must(await c.from('reviews').insert({ character_id: charId, author: uid, verdict, body })); },
  async queue(status) { const c = await sb(); let qy = c.from('characters').select('id,name,status,data,owner,updated_at,submitted_at,reviewed_at').order('submitted_at', { ascending: true, nullsFirst: false }); if (status && status !== 'all') qy = qy.eq('status', status); return must(await qy.limit(300)); },
  async counts() { const c = await sb(); const out = {}; for (const s of ['submitted', 'revision', 'approved', 'rejected']) { const r = await c.from('characters').select('id', { count: 'exact', head: true }).eq('status', s); out[s] = r.count || 0; } return out; },
  async profiles(ids) { const c = await sb(); let qy = c.from('profiles').select('*').order('created_at', { ascending: true }); if (ids) qy = qy.in('id', ids); return must(await qy.limit(500)); },
  async slots() { const c = await sb(); const rows = must(await c.rpc('slot_counts')); const o = {}; (rows || []).forEach(r => { o[r.kind] = { taken: +r.taken, pending: +r.pending }; }); return o; },
  async setRole(id, role) { const c = await sb(); return must(await c.from('profiles').update({ role }).eq('id', id).select().single()); }
};
const api = () => window.MH_CABINET_API || SupabaseApi;

/* ---------- общие куски ---------- */
const toast = (el, t, bad) => { const b = q('.cab-toast', el); if (!b) return; b.textContent = t; b.classList.toggle('bad', !!bad); clearTimeout(toast.t); toast.t = setTimeout(() => { b.textContent = ''; }, 5000); };
const errText = e => {
  const m = (e && (e.message || e.error_description)) || String(e || '');
  if (/lib/.test(m)) return 'Не удалось загрузить модуль входа. Проверь интернет и обнови страницу.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Нет связи с сервером кабинета. Попробуй ещё раз через минуту.';
  return m || 'Что-то пошло не так. Попробуй ещё раз.';
};
const field = (id, label, input, hint) => `<label class="cab-f" for="${id}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
const opt = (list, cur, empty) => (empty ? `<option value="">${empty}</option>` : '') + list.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('');

function setupNotice() {
  return `<article class="panel cab-setup"><div class="eyebrow">Кабинет ещё не подключён</div><h3>Нужен сервер кабинета</h3>
    <p>Регистрация, квенты и проверка мастерами работают, когда сайт выложен на свой хостинг и подключён к Supabase. В предпросмотре на Claude кабинет только показывает, как будет выглядеть.</p>
    <ol><li>Создай проект на supabase.com и выполни <code>supabase/schema.sql</code>.</li><li>Включи вход через Discord.</li><li>Впиши адрес проекта и ключ в <code>config.js</code>.</li><li>Выложи сайт на GitHub Pages или Vercel.</li></ol>
    <p class="muted">Подробно — в файле <code>КАБИНЕТ-ЗАПУСК.md</code> рядом с сайтом.</p></article>`;
}

function loginCard(el, after) {
  const m = api().methods();
  el.innerHTML = `<div class="cab-login"><article class="panel cab-login-card">
      <img class="cab-login-logo" src="assets/logo.webp" alt="">
      <div class="eyebrow">Хроники Меттенхейма</div><h2>Вход в кабинет</h2>
      <p class="muted">Один аккаунт на все персонажи. Первый вход сразу создаёт профиль — регистрироваться отдельно не нужно.</p>
      ${m.discord ? `<button type="button" class="btn cab-discord" id="cDiscord"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.7.1 18.2a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.6-13.8ZM8.3 15.5c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>Войти через Discord</button>` : ''}
      ${m.discord && m.email ? '<div class="cab-or"><span>или по почте</span></div>' : ''}
      ${m.email ? `<form id="cMail" class="cab-mail" novalidate>${field('cEmail', 'Почта', '<input id="cEmail" type="email" autocomplete="email" required placeholder="name@mail.ru">')}<button class="btn ghost" type="submit">Прислать ссылку для входа</button></form>` : ''}
      <p class="cab-toast" role="status" aria-live="polite"></p>
    </article></div>`;
  const remember = () => { try { sessionStorage.setItem(AFTER_KEY, after); } catch (_) {} };
  const d = q('#cDiscord', el);
  if (d) d.onclick = async () => { remember(); d.disabled = true; try { await api().signInDiscord(); } catch (e) { d.disabled = false; toast(el, errText(e), true); } };
  const f = q('#cMail', el);
  if (f) f.onsubmit = async ev => {
    ev.preventDefault(); const email = q('#cEmail', el).value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast(el, 'Впиши почту целиком, например name@mail.ru', true); return; }
    remember();
    try { await api().signInEmail(email); toast(el, 'Письмо отправлено. Открой ссылку из него на этом устройстве.'); } catch (e) { toast(el, errText(e), true); }
  };
}

function topBar(prof, isAdminView) {
  const staff = prof && ['master', 'admin'].includes(prof.role);
  return `<div class="cab-top panel">
    ${prof.avatar_url ? `<img class="cab-ava" src="${esc(prof.avatar_url)}" alt="">` : `<span class="cab-ava cab-ava-empty">${esc((prof.display_name || '?').slice(0, 1).toUpperCase())}</span>`}
    <div class="cab-who"><b>${esc(prof.display_name || 'Без имени')}</b><small>${ROLE[prof.role] || 'Игрок'}${prof.discord ? ' · Discord: ' + esc(prof.discord) : ''}</small></div>
    <nav class="cab-switch">${staff ? `<a href="#cabinet" class="${isAdminView ? '' : 'on'}">Мой кабинет</a><a href="#admin" class="${isAdminView ? 'on' : ''}">Кабинет мастера</a>` : ''}</nav>
    <button type="button" class="btn small ghost" id="cOut">Выйти</button></div>`;
}

/* ---------- сборка древа и анкета с этого сайта ---------- */
const store = () => (window.MH && MH.store) || { get: (k, d) => d, set() {} };
function anketaDraft() {
  const a = store().get('anketa', null); if (!a) return null;
  const pick = ['g', 'p', 'o', 'c', 'bg', 'u', 'cu', 'ik', 'player', 'playerAge', 'discord', 'age', 'prof', 'edu', 'faith', 'traits', 'fears', 'goal'];
  const data = {}; pick.forEach(k => { if (a[k] != null) data[k] = a[k]; });
  data.house = document.documentElement.dataset.house === 'dorn' ? 'dorn' : 'talbot';
  return { name: a.name || '', quenta: a.bio || '', data, portrait: store().get('portrait', null) };
}
function treeBuild(cls) {
  const got = store().get('tree2:' + cls, null), forks = store().get('tree2f:' + cls, {}) || {};
  if (!got || got.length < 2) return null;
  return { cls, nodes: got, forks, names: window.MH_TREE_NAMES ? window.MH_TREE_NAMES(got, forks) : [] };
}
function treeHTML(t) {
  if (!t) return '<p class="muted">Сборка не прикреплена.</p>';
  const names = t.names && t.names.length ? t.names : t.nodes;
  return `<p class="muted" style="margin:0 0 6px">${nameOf(classes(), t.cls) || t.cls} · узлов: ${Math.max(0, t.nodes.length - 1)}</p><div class="cab-tags">${names.map(n => `<span>${esc(n)}</span>`).join('')}</div>`;
}

/* ---------- карточка персонажа (общая для игрока и мастера) ---------- */
function dossierHTML(ch) {
  const d = ch.data || {};
  const bg = backgrounds().find(b => b.id === d.bg);
  const uniq = d.u === 'construct' ? 'Конструкт' : d.u === 'curse' ? 'Проклятие · ' + nameOf(curses(), d.cu) : '';
  const rows = [['Народ', [nameOf(peoples(), d.p), nameOf(originsOf(d.p), d.o)].filter(Boolean).join(' · ')], ['Класс', nameOf(classes(), d.c)], ['Пол', d.g === 'male' ? 'Мужской' : d.g === 'female' ? 'Женский' : ''], ['Возраст', d.age], ['Сторона', d.house === 'dorn' ? 'Дом Дорн' : d.house === 'talbot' ? 'Дом Талбот' : ''], ['Предыстория', bg && bg.name], ['Уникальность', uniq], ['Дом Короля', d.p === 'infernals' && d.ik ? ((Mx().kings || []).find(k => k.id === d.ik) || {}).name : ''], ['Образование', d.edu], ['Профессия', d.prof], ['Вера', d.faith], ['Черты', d.traits], ['Страхи', d.fears], ['Цель', d.goal]].filter(r => r[1]);
  return `<div class="cab-dossier">${ch.portrait ? `<img class="cab-portrait" src="${esc(ch.portrait)}" alt="Портрет">` : ''}<div class="kv">${rows.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`;
}
function historyHTML(list, names) {
  if (!list || !list.length) return '<p class="muted">Истории пока нет.</p>';
  return `<ol class="cab-hist">${list.map(r => `<li class="v-${r.verdict}"><div><b>${VERDICT[r.verdict] || r.verdict}</b><small>${esc((names && names[r.author]) || '')}${names && names[r.author] ? ' · ' : ''}${fmtDate(r.created_at)}</small></div>${r.body ? `<p>${esc(r.body)}</p>` : ''}</li>`).join('')}</ol>`;
}

/* =================== КАБИНЕТ ИГРОКА =================== */
async function playerView(el, sess, prof) {
  const uid = sess.user.id;
  let chars = [], open = null, tab = 'chars';
  async function reload() { chars = await api().myChars(uid); }
  function frame(inner) {
    el.innerHTML = topBar(prof, false) + `<div class="cab-tabs" role="tablist"><button type="button" role="tab" data-tab="chars" aria-selected="${tab === 'chars'}">Мои персонажи <i>${chars.length}</i></button><button type="button" role="tab" data-tab="profile" aria-selected="${tab === 'profile'}">Профиль</button></div><div id="cBody">${inner}</div><p class="cab-toast" role="status" aria-live="polite"></p>`;
    q('#cOut', el).onclick = async () => { await api().signOut(); paintHeader(null); location.hash = '#cabinet'; mount(el, 'player'); };
    qa('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; open = null; play('click'); render(); });
  }
  function listHTML() {
    const draft = anketaDraft();
    return `<div class="cab-head"><div><div class="eyebrow">Персонажи</div><h2>Мои квенты</h2></div><div class="cab-acts"><button type="button" class="btn" id="cNew">Новый персонаж</button>${draft && (draft.name || draft.quenta) ? `<button type="button" class="btn ghost" id="cFromA">Взять из анкеты: ${esc(draft.name || 'без имени')}</button>` : ''}</div></div>
      ${chars.length ? `<div class="cab-grid">${chars.map(c => `<button type="button" class="panel cab-card" data-open="${c.id}"><div class="cab-card-top">${pill(c.status)}<small>${fmtDate(c.updated_at)}</small></div><h3>${esc(c.name || 'Без имени')}</h3><p>${esc(describe(c.data || {})) || 'Народ и класс не выбраны'}</p></button>`).join('')}</div>`
        : `<article class="panel cab-empty"><h3>Пока ни одного персонажа</h3><p class="muted">Создай нового или перенеси анкету, которую собрал на главной странице. Квенту можно писать частями — черновик сохраняется на сервере.</p></article>`}`;
  }
  function profileHTML() {
    return `<form class="panel cab-form" id="cProf"><div class="eyebrow">Профиль игрока</div>
      <div class="cab-row">${field('pfName', 'Как к тебе обращаться', `<input id="pfName" maxlength="60" value="${esc(prof.display_name)}">`)}${field('pfDiscord', 'Ник в Discord', `<input id="pfDiscord" maxlength="60" value="${esc(prof.discord)}">`, 'По нему мастера напишут, если появятся вопросы')}</div>
      <div class="cab-row">${field('pfGame', 'Ник в Conan Exiles / Steam', `<input id="pfGame" maxlength="60" value="${esc(prof.game_nick)}">`)}${field('pfTz', 'Часовой пояс', `<input id="pfTz" maxlength="40" value="${esc(prof.timezone)}" placeholder="МСК, МСК+4…">`)}</div>
      ${field('pfAbout', 'О себе как об игроке', `<textarea id="pfAbout" rows="4" maxlength="1500">${esc(prof.about)}</textarea>`, 'Опыт в RP, когда обычно играешь, что любишь в сюжетах')}
      <label class="cab-check"><input type="checkbox" id="pfNotify"${prof.notify === false ? '' : ' checked'}> <span>Присылать решения и комментарии мастеров в личку Discord<small>Бот «Хроники Меттенхейма» пишет, когда квенту приняли, вернули на доработку или отклонили. Для этого нужно быть на нашем сервере Discord.</small></span></label>
      <button class="btn" type="submit">Сохранить профиль</button></form>`;
  }
  async function editor(id, seed) {
    let ch;
    if (id) ch = await api().getChar(id);
    else {
      const d = seed || { name: '', quenta: '', data: {} };
      ch = await api().createChar({ owner: uid, name: d.name || '', quenta: d.quenta || '', data: d.data || {}, portrait: d.portrait || null, status: 'draft' });
      await reload();
    }
    open = ch.id;
    const hist = await api().reviews(ch.id).catch(() => []);
    const d = ch.data || {};
    const editable = ['draft', 'revision'].includes(ch.status);
    const ro = editable ? '' : ' disabled';
    const lastNote = [...hist].reverse().find(r => ['revision', 'rejected', 'comment'].includes(r.verdict) && r.body);
    const body = q('#cBody', el);
    body.innerHTML = `<div class="cab-head"><div><button type="button" class="cab-back" id="cBack">← Все персонажи</button><h2>${esc(ch.name || 'Новый персонаж')}</h2><div class="cab-stline">${pill(ch.status)}<span class="muted">${(STATUS[ch.status] || STATUS.draft)[2]}</span></div></div></div>
      ${lastNote && ch.status !== 'approved' ? `<article class="panel cab-note"><div class="eyebrow">Замечание мастера · ${fmtDate(lastNote.created_at)}</div><p>${esc(lastNote.body)}</p></article>` : ''}
      ${d.p === 'infernals' || d.u === 'curse' ? `<div class="slot-box" data-slot="${d.p === 'infernals' ? 'infernal' : 'curse'}"></div>` : ''}<form class="cab-edit" id="cEdit" novalidate>
        <section class="panel cab-form"><div class="eyebrow">Персонаж</div>
          <div class="cab-row">${field('eName', 'Имя персонажа', `<input id="eName" maxlength="80" value="${esc(ch.name)}"${ro}>`)}${field('eAge', 'Возраст', `<input id="eAge" maxlength="10" value="${esc(d.age || '')}"${ro}>`)}</div>
          <div class="cab-row3">${field('eP', 'Народ', `<select id="eP"${ro}>${opt(peoples(), d.p, 'Выбери народ')}</select>`)}${field('eO', 'Происхождение', `<select id="eO"${ro}>${opt(originsOf(d.p), d.o, '—')}</select>`)}${field('eC', 'Класс', `<select id="eC"${ro}>${opt(classes(), d.c, 'Выбери класс')}</select>`)}</div>
          <div class="cab-row3">${field('eG', 'Пол', `<select id="eG"${ro}><option value="">—</option><option value="female"${d.g === 'female' ? ' selected' : ''}>Женский</option><option value="male"${d.g === 'male' ? ' selected' : ''}>Мужской</option></select>`)}${field('eH', 'Сторона', `<select id="eH"${ro}><option value="talbot"${d.house !== 'dorn' ? ' selected' : ''}>Дом Талбот</option><option value="dorn"${d.house === 'dorn' ? ' selected' : ''}>Дом Дорн</option></select>`)}${field('eBg', 'Предыстория', `<select id="eBg"${ro}>${opt(backgrounds(), d.bg, '—')}</select>`)}</div>
          <div class="cab-row3">${field('eU', 'Уникальность', `<select id="eU"${ro}><option value="none">Нет</option><option value="construct"${d.u === 'construct' ? ' selected' : ''}>Конструкт</option><option value="curse"${d.u === 'curse' ? ' selected' : ''}>Проклятие</option></select>`)}${field('eCu', 'Проклятие', `<select id="eCu"${ro}${d.u === 'curse' ? '' : ' disabled'}>${opt(curses(), d.cu, '—')}</select>`)}${field('eIk', 'Дом Короля (инферналы)', `<select id="eIk"${ro}${d.p === 'infernals' ? '' : ' disabled'}><option value="">—</option>${(Mx().kings || []).map(k => `<option value="${k.id}"${k.id === d.ik ? ' selected' : ''}>${esc(k.name)} · ${esc(k.sin)}${k.chaos === 'ice' ? ' (ледяной)' : ' (огненный)'}</option>`).join('')}</select>`)}</div><div class="cab-row3">${field('eEdu', 'Образование', `<select id="eEdu"${ro}><option value="">—</option>${education().map(e => `<option${e[1] === d.edu ? ' selected' : ''}>${esc(e[1])}</option>`).join('')}</select>`)}</div>
          <div class="cab-row">${field('eProf', 'Профессия', `<input id="eProf" maxlength="80" value="${esc(d.prof || '')}"${ro}>`)}${field('eFaith', 'Вера', `<input id="eFaith" maxlength="80" value="${esc(d.faith || '')}"${ro}>`)}</div>
          ${field('eTraits', 'Черты характера', `<input id="eTraits" maxlength="200" value="${esc(d.traits || '')}"${ro}>`)}
          <div class="cab-row">${field('eFears', 'Страхи', `<input id="eFears" maxlength="200" value="${esc(d.fears || '')}"${ro}>`)}${field('eGoal', 'Цель', `<input id="eGoal" maxlength="200" value="${esc(d.goal || '')}"${ro}>`)}</div>
        </section>
        <section class="panel cab-form"><div class="eyebrow">Квента</div>
          ${field('eQ', 'История персонажа', `<textarea id="eQ" rows="18" maxlength="60000"${ro} placeholder="Откуда он, что с ним случилось, почему он в Меттенхейме и чего хочет. Пиши от третьего лица или от первого — как удобнее.">${esc(ch.quenta)}</textarea>`, `<span id="eQn">${(ch.quenta || '').length}</span> знаков · для отправки нужно от ${MIN_QUENTA}`)}
        </section>
        <section class="panel cab-form cab-side"><div class="eyebrow">Портрет и древо</div>
          <div class="cab-pwrap">${ch.portrait ? `<img class="cab-portrait" id="ePimg" src="${esc(ch.portrait)}" alt="Портрет">` : '<div class="cab-portrait cab-pempty" id="ePimg">Нет портрета</div>'}
            ${editable ? `<div class="cab-acts"><button type="button" class="btn small ghost" id="ePpick">Загрузить портрет</button>${ch.portrait ? '<button type="button" class="btn small ghost" id="ePdel">Убрать</button>' : ''}<input type="file" id="ePfile" accept="image/*" hidden></div>` : ''}</div>
          <div class="al-sub" style="margin-top:14px">Сборка древа талантов</div><div id="eTree">${treeHTML(ch.tree)}</div>
          ${editable ? `<button type="button" class="btn small ghost" id="eTreeAdd">Прикрепить мою сборку из «Древа»</button>` : ''}
        </section>
        <div class="cab-bar">${editable ? `<button type="submit" class="btn ghost" id="eSave">Сохранить черновик</button><button type="button" class="btn" id="eSend">Отправить на проверку</button><button type="button" class="btn small ghost cab-del" id="eDel">Удалить</button>` : ch.status === 'submitted' ? `<button type="button" class="btn ghost" id="eBackDraft">Отозвать в черновик</button>` : ''}</div>
      </form>
      <section class="panel cab-form"><div class="eyebrow">История и переписка</div>${historyHTML(hist, { [uid]: 'ты' })}
        <form id="eMsg" class="cab-msg">${field('eMsgT', 'Написать мастерам', '<textarea id="eMsgT" rows="2" maxlength="2000" placeholder="Вопрос или пояснение к квенте"></textarea>')}<button class="btn small ghost" type="submit">Отправить сообщение</button></form></section>`;

    fillSlots(body);
    let portrait = ch.portrait || null, tree = ch.tree || null, dirty = false;
    const F = id => q('#' + id, body);
    const collect = () => ({
      name: F('eName').value.trim(), quenta: F('eQ').value, portrait, tree,
      data: Object.assign({}, d, { age: F('eAge').value.trim(), p: F('eP').value, o: F('eO').value, c: F('eC').value, g: F('eG').value, house: F('eH').value, bg: F('eBg').value, u: F('eU').value, cu: F('eCu').value, ik: F('eP').value === 'infernals' ? F('eIk').value : '', edu: F('eEdu').value, prof: F('eProf').value.trim(), faith: F('eFaith').value.trim(), traits: F('eTraits').value.trim(), fears: F('eFears').value.trim(), goal: F('eGoal').value.trim() })
    });
    F('cBack').onclick = () => { if (dirty && editable) save(ch.status === 'revision' ? 'revision' : 'draft', true).then(back); else back(); };
    const back = async () => { open = null; await reload(); render(); };
    if (editable) {
      body.addEventListener('input', () => { dirty = true; F('eQn').textContent = F('eQ').value.length; });
      F('eP').onchange = () => { F('eO').innerHTML = opt(originsOf(F('eP').value), '', '—'); F('eIk').disabled = F('eP').value !== 'infernals'; };
      F('eU').onchange = () => { F('eCu').disabled = F('eU').value !== 'curse'; };
      F('ePpick').onclick = () => F('ePfile').click();
      F('ePfile').onchange = () => {
        const f = F('ePfile').files[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => {
          const c = document.createElement('canvas'), k = Math.min(1, 640 / Math.max(img.width, img.height)); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); portrait = c.toDataURL('image/jpeg', .8); dirty = true;
          const box = F('ePimg'); box.outerHTML = `<img class="cab-portrait" id="ePimg" src="${portrait}" alt="Портрет">`;
        }; img.src = r.result; }; r.readAsDataURL(f);
      };
      if (F('ePdel')) F('ePdel').onclick = () => { portrait = null; dirty = true; F('ePimg').outerHTML = '<div class="cab-portrait cab-pempty" id="ePimg">Нет портрета</div>'; };
      F('eTreeAdd').onclick = () => {
        const cls = F('eC').value || 'fighter', t = treeBuild(cls);
        if (!t) { toast(el, `На этом устройстве нет сборки древа за класс «${nameOf(classes(), cls) || cls}». Собери её на странице «Древо» и вернись.`, true); return; }
        tree = t; dirty = true; F('eTree').innerHTML = treeHTML(t); toast(el, 'Сборка прикреплена. Не забудь сохранить.');
      };
      const keep = () => ch.status === 'revision' ? 'revision' : 'draft';
      F('cEdit').onsubmit = ev => { ev.preventDefault(); save(keep()); };
      F('eSend').onclick = () => {
        const c = collect(), miss = [];
        if (!c.name) miss.push('имя'); if (!c.data.p) miss.push('народ'); if (!c.data.c) miss.push('класс'); if (c.data.p === 'infernals' && !c.data.ik) miss.push('Дом Короля');
        if (c.quenta.trim().length < MIN_QUENTA) miss.push(`квента от ${MIN_QUENTA} знаков (сейчас ${c.quenta.trim().length})`);
        if (miss.length) { toast(el, 'Чтобы отправить, заполни: ' + miss.join(', '), true); return; }
        save('submitted');
      };
      F('eDel').onclick = async () => {
        const b = F('eDel');
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Точно удалить? Нажми ещё раз'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Удалить'; } }, 4000); return; }
        try { await api().deleteChar(ch.id); toast(el, 'Персонаж удалён'); back(); } catch (e) { toast(el, errText(e), true); }
      };
    }
    if (F('eBackDraft')) F('eBackDraft').onclick = async () => { try { await api().saveChar(ch.id, { status: 'draft' }); toast(el, 'Квента отозвана — можно править'); editor(ch.id); } catch (e) { toast(el, errText(e), true); } };
    F('eMsg').onsubmit = async ev => {
      ev.preventDefault(); const t = F('eMsgT').value.trim(); if (!t) return;
      try { await api().addReview(ch.id, uid, 'comment', t); toast(el, 'Сообщение отправлено'); editor(ch.id); } catch (e) { toast(el, errText(e), true); }
    };
    async function save(status, quiet) {
      try {
        const c = collect(); await api().saveChar(ch.id, Object.assign(c, { status })); dirty = false;
        if (!quiet) { toast(el, status === 'submitted' ? 'Квента отправлена мастерам. Ответ придёт сюда.' : 'Сохранено'); play('click'); }
        if (status === 'submitted') editor(ch.id);
      } catch (e) { toast(el, errText(e), true); }
    }
  }
  function render() {
    frame(tab === 'profile' ? profileHTML() : listHTML());
    if (tab === 'profile') {
      q('#cProf', el).onsubmit = async ev => {
        ev.preventDefault();
        try { prof = await api().saveProfile(uid, { display_name: q('#pfName', el).value.trim(), discord: q('#pfDiscord', el).value.trim(), game_nick: q('#pfGame', el).value.trim(), timezone: q('#pfTz', el).value.trim(), about: q('#pfAbout', el).value.trim(), notify: q('#pfNotify', el).checked }); render(); toast(el, 'Профиль сохранён'); } catch (e) { toast(el, errText(e), true); }
      };
    } else {
      q('#cNew', el).onclick = () => editor(null).catch(e => toast(el, errText(e), true));
      const fa = q('#cFromA', el); if (fa) fa.onclick = () => editor(null, anketaDraft()).catch(e => toast(el, errText(e), true));
      qa('[data-open]', el).forEach(b => b.onclick = () => editor(b.dataset.open).catch(e => toast(el, errText(e), true)));
      if (open) editor(open).catch(e => toast(el, errText(e), true));
    }
  }
  await reload();
  const want = (() => { try { const v = sessionStorage.getItem('mh:open-char'); sessionStorage.removeItem('mh:open-char'); return v; } catch (_) { return null; } })();
  if (want === 'anketa') { render(); editor(null, anketaDraft()).catch(e => toast(el, errText(e), true)); return; }
  if (want && chars.some(c => c.id === want)) { render(); editor(want).catch(e => toast(el, errText(e), true)); return; }
  render();
}

/* =================== КАБИНЕТ МАСТЕРА =================== */
async function adminView(el, sess, prof) {
  const uid = sess.user.id, isAdmin = prof.role === 'admin';
  let tab = 'submitted', list = [], counts = {}, people = {}, open = null, query = '';
  const TABS = [['submitted', 'На проверке'], ['revision', 'На доработке'], ['approved', 'Приняты'], ['rejected', 'Отклонены'], ['all', 'Все']];
  async function load() {
    [list, counts] = await Promise.all([api().queue(tab), api().counts().catch(() => ({}))]);
    const ids = [...new Set(list.map(c => c.owner))];
    if (ids.length) (await api().profiles(ids)).forEach(p => { people[p.id] = p; });
  }
  function frame(inner) {
    el.innerHTML = topBar(prof, true) + `<div class="cab-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-at="${k}" aria-selected="${k === tab}">${l}${counts[k] != null ? ` <i>${counts[k]}</i>` : ''}</button>`).join('')}${isAdmin ? `<button type="button" role="tab" data-at="players" aria-selected="${tab === 'players'}">Игроки и роли</button>` : ''}</div><div id="aBody">${inner}</div><p class="cab-toast" role="status" aria-live="polite"></p>`;
    q('#cOut', el).onclick = async () => { await api().signOut(); location.hash = '#cabinet'; };
    qa('[data-at]', el).forEach(b => b.onclick = async () => { tab = b.dataset.at; open = null; play('click'); await show(); });
  }
  const who = id => people[id] ? (people[id].display_name || people[id].discord || 'Игрок') : 'Игрок';
  function queueHTML() {
    const qq = query.toLowerCase();
    const rows = list.filter(c => !qq || (c.name + ' ' + who(c.owner) + ' ' + describe(c.data || {})).toLowerCase().includes(qq));
    return `<div class="cab-head"><div><div class="eyebrow">Кабинет мастера</div><h2>${(TABS.find(t => t[0] === tab) || ['', 'Квенты'])[1]}</h2></div><div class="cab-acts"><input type="search" id="aQ" placeholder="Найти: имя, игрок, народ…" value="${esc(query)}" aria-label="Поиск по квентам"><button type="button" class="btn small ghost" id="aRe">Обновить</button></div></div>
      ${rows.length ? `<div class="panel cab-table"><table><thead><tr><th>Персонаж</th><th>Игрок</th><th>Народ · класс</th><th>Статус</th><th>${tab === 'submitted' ? 'Ждёт с' : 'Изменена'}</th></tr></thead><tbody>${rows.map(c => `<tr data-ao="${c.id}" tabindex="0"><td><b>${esc(c.name || 'Без имени')}</b></td><td>${esc(who(c.owner))}</td><td>${esc(describe(c.data || {}))}</td><td>${pill(c.status)}</td><td>${fmtDate(tab === 'submitted' ? c.submitted_at : c.updated_at)}</td></tr>`).join('')}</tbody></table></div>`
        : `<article class="panel cab-empty"><h3>${tab === 'submitted' ? 'Очередь пуста' : 'Здесь пока пусто'}</h3><p class="muted">${tab === 'submitted' ? 'Новые квенты появятся здесь, как только игроки нажмут «Отправить на проверку».' : 'Квенты с этим статусом появятся здесь.'}</p></article>`}`;
  }
  async function playersHTML() {
    const all = await api().profiles();
    return `<div class="cab-head"><div><div class="eyebrow">Только для администратора</div><h2>Игроки и роли</h2><p class="muted">Мастер проверяет квенты. Администратор ещё и раздаёт роли.</p></div></div>
      <div class="panel cab-table"><table><thead><tr><th>Игрок</th><th>Discord</th><th>Ник в игре</th><th>С нами с</th><th>Роль</th></tr></thead><tbody>${all.map(p => `<tr><td><b>${esc(p.display_name || '—')}</b></td><td>${esc(p.discord)}</td><td>${esc(p.game_nick)}</td><td>${fmtDate(p.created_at)}</td><td><select data-role="${p.id}"${p.id === uid ? ' disabled title="Свою роль не меняют"' : ''} aria-label="Роль: ${esc(p.display_name)}">${Object.entries(ROLE).map(([k, v]) => `<option value="${k}"${p.role === k ? ' selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  }
  async function review(id) {
    open = id;
    const [ch, hist] = await Promise.all([api().getChar(id), api().reviews(id).catch(() => [])]);
    const ids = [...new Set([ch.owner, ...hist.map(r => r.author).filter(Boolean)])].filter(x => !people[x]);
    if (ids.length) (await api().profiles(ids)).forEach(p => { people[p.id] = p; });
    const names = Object.fromEntries(Object.values(people).map(p => [p.id, p.display_name || p.discord || 'Игрок']));
    const owner = people[ch.owner] || {};
    const b = q('#aBody', el);
    b.innerHTML = `<div class="cab-head"><div><button type="button" class="cab-back" id="aBack">← К списку</button><h2>${esc(ch.name || 'Без имени')}</h2><div class="cab-stline">${pill(ch.status)}<span class="muted">${ch.submitted_at ? 'Отправлена ' + fmtDate(ch.submitted_at) : ''}</span></div></div></div>
      <div class="cab-review">
        <div class="cab-col">
          <section class="panel cab-form"><div class="eyebrow">Игрок</div><div class="kv">${[['Имя', owner.display_name], ['Discord', owner.discord], ['Ник в игре', owner.game_nick], ['Часовой пояс', owner.timezone]].filter(r => r[1]).map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>${owner.about ? `<p class="muted" style="margin-top:10px">${esc(owner.about)}</p>` : ''}</section>
          <section class="panel cab-form"><div class="eyebrow">Анкета</div>${dossierHTML(ch)}</section>
          <section class="panel cab-form"><div class="eyebrow">Квента · ${(ch.quenta || '').length} знаков</div><div class="cab-quenta">${esc(ch.quenta || '').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') || '<p class="muted">Квента пустая.</p>'}</div></section>
          <section class="panel cab-form"><div class="eyebrow">Сборка древа</div>${treeHTML(ch.tree)}</section>
        </div>
        <aside class="cab-col">
          <section class="panel cab-form cab-verdict"><div class="eyebrow">Решение</div>
            ${field('aBody2', 'Комментарий игроку', '<textarea id="aBody2" rows="6" maxlength="8000" placeholder="Что исправить или почему отказ. Для «Принять» — по желанию."></textarea>', 'Обязателен, если возвращаешь на доработку или отклоняешь')}
            <div class="cab-vbtns"><button type="button" class="btn" data-v="approved">Принять</button><button type="button" class="btn ghost" data-v="revision">На доработку</button><button type="button" class="btn ghost cab-del" data-v="rejected">Отклонить</button><button type="button" class="btn small ghost" data-v="comment">Только комментарий</button></div>
          </section>
          <section class="panel cab-form"><div class="eyebrow">История</div>${historyHTML(hist, names)}</section>
        </aside>
      </div>`;
    q('#aBack', el).onclick = async () => { open = null; await show(); };
    qa('[data-v]', b).forEach(btn => btn.onclick = async () => {
      const v = btn.dataset.v, text = q('#aBody2', b).value.trim();
      if (['revision', 'rejected', 'comment'].includes(v) && !text) { toast(el, 'Напиши комментарий — игрок должен понять, что делать дальше', true); q('#aBody2', b).focus(); return; }
      try {
        if (v !== 'comment') await api().saveChar(id, { status: v });
        if (text) await api().addReview(id, uid, 'comment', text);
        toast(el, v === 'approved' ? 'Квента принята' : v === 'revision' ? 'Возвращена на доработку' : v === 'rejected' ? 'Квента отклонена' : 'Комментарий отправлен'); play('click');
        await review(id);
      } catch (e) { toast(el, errText(e), true); }
    });
  }
  async function show() {
    if (tab === 'players') { frame('<p class="muted">Загружаю…</p>'); try { q('#aBody', el).innerHTML = await playersHTML(); } catch (e) { toast(el, errText(e), true); } bindPlayers(); return; }
    try { await load(); } catch (e) { frame(''); toast(el, errText(e), true); return; }
    frame(queueHTML()); bindQueue();
    if (open) review(open).catch(e => toast(el, errText(e), true));
  }
  function bindQueue() {
    const s = q('#aQ', el); if (s) s.oninput = () => { query = s.value; const pos = s.selectionStart; q('#aBody', el).innerHTML = queueHTML(); bindQueue(); const n = q('#aQ', el); n.focus(); n.setSelectionRange(pos, pos); };
    const r = q('#aRe', el); if (r) r.onclick = () => show();
    qa('[data-ao]', el).forEach(tr => { const go = () => review(tr.dataset.ao).catch(e => toast(el, errText(e), true)); tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
  }
  function bindPlayers() {
    qa('[data-role]', el).forEach(sel => sel.onchange = async () => { try { await api().setRole(sel.dataset.role, sel.value); toast(el, 'Роль обновлена'); } catch (e) { toast(el, errText(e), true); } });
  }
  await show();
}

/* =================== ТОЧКА ВХОДА =================== */
async function mount(el, mode) {
  if (!el) return;
  if (!window.MH_CABINET_API && CFG.siteUrl && location.origin !== new URL(CFG.siteUrl).origin) {
    el.innerHTML = `<article class="panel cab-empty"><div class="eyebrow">Это предпросмотр сайта</div><h3>Кабинет работает на основном сайте</h3><p class="muted">Вход через Discord, квенты и проверка мастерами доступны по адресу сайта.</p><a class="btn" href="${esc(CFG.siteUrl)}#${mode === 'admin' ? 'admin' : 'cabinet'}" target="_blank" rel="noopener">Открыть кабинет на сайте</a></article>` + demoNote(mode); return;
  }
  if (!api().configured()) { el.innerHTML = setupNotice() + demoNote(mode); return; }
  el.innerHTML = '<p class="muted cab-loading">Открываю кабинет…</p>';
  let sess;
  try { sess = await api().session(); } catch (e) { el.innerHTML = `<article class="panel cab-empty"><h3>Кабинет недоступен</h3><p class="muted">${esc(errText(e))}</p></article>`; return; }
  if (!sess) { loginCard(el, mode === 'admin' ? 'admin' : 'cabinet'); return; }
  let prof = null;
  try { prof = await api().myProfile(sess.user.id); } catch (_) {}
  if (!prof) prof = { id: sess.user.id, display_name: (sess.user.email || '').split('@')[0], discord: '', game_nick: '', timezone: '', about: '', avatar_url: '', role: 'player' };
  if (mode === 'admin') {
    if (!['master', 'admin'].includes(prof.role)) { el.innerHTML = topBar(prof, false) + `<article class="panel cab-empty"><h3>Кабинет мастера закрыт</h3><p class="muted">Сюда заходят только мастера и администраторы. Если ты мастер — попроси администратора выдать роль.</p><a class="btn" href="#cabinet">В мой кабинет</a></article>`; q('#cOut', el).onclick = async () => { await api().signOut(); mount(el, mode); }; return; }
    return adminView(el, sess, prof);
  }
  return playerView(el, sess, prof);
}
function demoNote(mode) {
  return `<article class="panel cab-demo"><div class="eyebrow">Как это будет выглядеть</div><div class="cab-demo-grid">
    ${mode === 'admin'
      ? '<div><b>Очередь квент</b><p>Все отправленные квенты по порядку: кто, за кого, сколько ждёт.</p></div><div><b>Проверка</b><p>Анкета, портрет, сборка древа и сама квента на одном экране.</p></div><div><b>Решение</b><p>Принять, вернуть на доработку с комментарием или отклонить. Игрок видит ответ в своём кабинете.</p></div><div><b>Роли</b><p>Администратор назначает мастеров прямо в кабинете.</p></div>'
      : '<div><b>Вход в один клик</b><p>Через Discord или по ссылке на почту. Первый вход сам создаёт профиль.</p></div><div><b>Мои персонажи</b><p>Несколько персонажей, у каждого статус: черновик, на проверке, на доработке, принят.</p></div><div><b>Квента</b><p>Пишется частями, черновик хранится на сервере. Анкету и сборку древа можно перенести с сайта.</p></div><div><b>Ответ мастера</b><p>Замечания и переписка с мастерами — прямо в карточке персонажа.</p></div>'}
  </div></article>`;
}

/* ---------- счётчики мест (инферналы, проклятые) ---------- */
let slotCache = null, slotAt = 0;
async function slotData() {
  if (!api().configured() || !api().slots) return null;
  if (slotCache && Date.now() - slotAt < 60000) return slotCache;
  try { slotCache = await api().slots(); slotAt = Date.now(); } catch (_) { slotCache = null; }
  return slotCache;
}
const SLOT_NAME = { infernal: ['инферналов', 'Инферналы'], curse: ['проклятых', 'Проклятые'] };
function fillSlots(root) {
  const boxes = qa('.slot-box', root || document); if (!boxes.length) return;
  const lim = (window.M && M.slots) || { infernal: 7, curse: 7 };
  const paint = d => boxes.forEach(b => {
    const k = b.dataset.slot, L = lim[k] || 7, nm = SLOT_NAME[k] || [k, k];
    if (!d || !d[k]) { b.innerHTML = `<div class="sb-num">${L}</div><div><b>${nm[1]} — ограниченный набор: ${L} мест</b><span>Мест на сервере столько, сколько персонажей может быть одновременно. Счётчик свободных мест появится, когда кабинет подключён.</span></div>`; b.classList.remove('full'); return; }
    const left = Math.max(0, L - d[k].taken), full = left === 0;
    b.classList.toggle('full', full);
    b.innerHTML = `<div class="sb-num">${left}</div><div><b>${full ? `Мест для ${nm[0]} нет` : `Свободно ${left} из ${L} мест для ${nm[0]}`}</b><span>Принято: ${d[k].taken}${d[k].pending ? ` · на проверке: ${d[k].pending}` : ''}. ${full ? 'Новые заявки откроются, когда кто-то из игроков освободит место.' : 'Место закрепляется, когда мастер принимает квенту.'}</span><i class="sb-bar"><em style="width:${Math.min(100, d[k].taken / L * 100)}%"></em></i></div>`;
  });
  paint(null);
  slotData().then(d => { if (d) paint(d); });
}

/* ---------- шапка: аватарка из Discord ---------- */
const liveSite = () => api().configured() && (!CFG.siteUrl || window.MH_CABINET_API || location.origin === new URL(CFG.siteUrl).origin);
let headSess = null;
function paintHeader(sess) {
  headSess = sess;
  const b = document.getElementById('cabBtn'); if (!b) return;
  const md = (sess && sess.user && sess.user.user_metadata) || {};
  const name = md.custom_claims && md.custom_claims.global_name || md.full_name || md.name || (sess && sess.user.email || '').split('@')[0];
  if (sess) {
    b.classList.add('in');
    b.title = 'Личный кабинет · ' + (name || '');
    b.innerHTML = (md.avatar_url ? `<img class="cab-btn-ava" src="${esc(md.avatar_url)}" alt="">` : `<i class="cab-btn-ava">${esc((name || '?').slice(0, 1).toUpperCase())}</i>`) + `<span>${esc(name || 'Кабинет')}</span>`;
  } else {
    b.classList.remove('in'); b.title = 'Личный кабинет';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg><span>Войти</span>';
  }
}
function initHeader() {
  if (!liveSite()) return;
  api().session().then(paintHeader).catch(() => {});
  api().onAuth(s => { paintHeader(s); }).catch(() => {});
}

/* ---------- статусы квент на странице анкеты ---------- */
async function anketaStatus(el) {
  if (!el) return;
  if (!liveSite()) { el.innerHTML = ''; return; }
  let sess = null; try { sess = await api().session(); } catch (_) {}
  if (!sess) { el.innerHTML = `<div class="panel ak-status"><div class="eyebrow">Отправка на проверку</div><p>Чтобы отправить анкету мастерам и видеть её статус, <a href="#cabinet">войди в кабинет через Discord</a>.</p></div>`; return; }
  let list = []; try { list = await api().myChars(sess.user.id); } catch (_) {}
  el.innerHTML = `<div class="panel ak-status"><div class="eyebrow">Мои квенты</div>${list.length ? `<ul>${list.map(c => `<li><a href="#cabinet" data-oc="${esc(c.id)}"><b>${esc(c.name || 'Без имени')}</b>${pill(c.status)}<small>${esc((STATUS[c.status] || STATUS.draft)[2])}</small></a></li>`).join('')}</ul>` : '<p class="muted">Пока ни одной. Нажми «Отправить в кабинет» — анкета станет черновиком, оттуда её можно отправить на проверку.</p>'}</div>`;
  qa('[data-oc]', el).forEach(a => a.onclick = () => { try { sessionStorage.setItem('mh:open-char', a.dataset.oc); } catch (_) {} });
}

window.Cabinet = { mount, api: SupabaseApi, fillSlots, anketaStatus, initHeader };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader); else setTimeout(initHeader, 0);
// после входа через Discord / почту вернуть игрока туда, откуда он пришёл
if (CFG.url && CFG.anonKey && /[?&](code|error_description)=/.test(location.search)) {
  let to = 'cabinet'; try { to = sessionStorage.getItem(AFTER_KEY) || 'cabinet'; sessionStorage.removeItem(AFTER_KEY); } catch (_) {}
  sb().then(c => c.auth.getSession()).finally(() => { history.replaceState(null, '', location.pathname + '#' + to); window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
})();
