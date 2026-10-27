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
  async uploadAva(uid, blob) { const c = await sb(); const path = `ava/${uid}.jpg`; must(await c.storage.from('portraits').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })); return c.storage.from('portraits').getPublicUrl(path).data.publicUrl + '?v=' + Date.now(); },
  async removeAva(uid) { const c = await sb(); await c.storage.from('portraits').remove([`ava/${uid}.jpg`]); },
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
      <img class="cab-login-logo" src="assets/logo-md.webp" alt="">
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

const avaOf = p => (p && (p.portrait || p.avatar_url)) || '';
function topBar(prof, isAdminView) {
  const staff = prof && ['master', 'admin'].includes(prof.role);
  return `<div class="cab-top panel">
    ${avaOf(prof) ? `<img class="cab-ava" src="${esc(avaOf(prof))}" alt="">` : `<span class="cab-ava cab-ava-empty">${esc((prof.display_name || '?').slice(0, 1).toUpperCase())}</span>`}
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
    return `<section class="panel cab-form cab-avabox"><div class="eyebrow">Портрет игрока</div>
      <div class="cab-avarow">${avaOf(prof) ? `<img class="cab-avabig" id="pfAvaImg" src="${esc(avaOf(prof))}" alt="Портрет">` : `<span class="cab-avabig cab-ava-empty" id="pfAvaImg">${esc((prof.display_name || '?').slice(0, 1).toUpperCase())}</span>`}
        <div><p class="muted">Показывается в шапке сайта, в кабинете и рядом с твоими сообщениями в чате — на сайте и в Discord. ${prof.portrait ? 'Сейчас стоит твой портрет.' : 'Сейчас стоит аватарка Discord.'}</p>
        <div class="cab-acts"><button type="button" class="btn small" id="pfAvaPick">Загрузить портрет</button>${prof.portrait ? '<button type="button" class="btn small ghost" id="pfAvaDel">Вернуть аватарку Discord</button>' : ''}<input type="file" id="pfAvaFile" accept="image/png,image/jpeg,image/webp" hidden></div>
        <small class="muted">Квадратный кадр, лицо по центру. Картинка ужмётся до 320×320.</small></div></div></section>
      <form class="panel cab-form" id="cProf"><div class="eyebrow">Профиль игрока</div>
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
        const f = F('ePfile').files[0]; F('ePfile').value = ''; if (!f) return;
        window.MHCrop(f, { aspect: 3 / 4, w: 480, title: 'Кадр портрета персонажа' }).then(c => {
          if (!c) return; portrait = c.toDataURL('image/jpeg', .84); dirty = true;
          const box = F('ePimg'); box.outerHTML = `<img class="cab-portrait" id="ePimg" src="${portrait}" alt="Портрет">`;
        });
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
      const setAva = async blob => { try { const url = blob ? await api().uploadAva(uid, blob) : (await api().removeAva(uid), null); prof = await api().saveProfile(uid, { portrait: url }); paintHeader(headSess, prof); render(); toast(el, blob ? 'Портрет сохранён' : 'Вернули аватарку Discord'); } catch (e) { toast(el, errText(e), true); } };
      q('#pfAvaPick', el).onclick = () => q('#pfAvaFile', el).click();
      q('#pfAvaFile', el).onchange = () => {
        const f = q('#pfAvaFile', el).files[0]; q('#pfAvaFile', el).value = ''; if (!f) return;
        window.MHCrop(f, { aspect: 1, w: 320, round: true, title: 'Кадр аватара' }).then(c => { if (c) c.toBlob(b => b ? setAva(b) : toast(el, 'Не получилось обработать картинку', true), 'image/jpeg', .86); });
      };
      const ad = q('#pfAvaDel', el); if (ad) ad.onclick = () => setAva(null);
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
    el.innerHTML = topBar(prof, true) + `<div class="cab-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-at="${k}" aria-selected="${k === tab}">${l}${counts[k] != null ? ` <i>${counts[k]}</i>` : ''}</button>`).join('')}<button type="button" role="tab" data-at="factions" aria-selected="${tab === 'factions'}">Счёт Домов</button>${isAdmin ? `<button type="button" role="tab" data-at="players" aria-selected="${tab === 'players'}">Игроки и роли</button>` : ''}</div><div id="aBody">${inner}</div><p class="cab-toast" role="status" aria-live="polite"></p>`;
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
  async function factionsHTML() {
    const c = await sb();
    const [sc, lg] = await Promise.all([c.from('faction_score').select('*'), c.from('faction_log').select('*').order('created_at', { ascending: false }).limit(30)]);
    if (sc.error) throw sc.error;
    const P = Object.fromEntries((sc.data || []).map(r => [r.house, r.points]));
    const ids = [...new Set((lg.data || []).map(r => r.author).filter(x => x && !people[x]))];
    if (ids.length) (await api().profiles(ids)).forEach(p => { people[p.id] = p; });
    const HN = { talbot: 'Дом Талбот', dorn: 'Дом Дорн' };
    return `<div class="cab-head"><div><div class="eyebrow">Кабинет мастера</div><h2>Счёт Домов</h2><p class="muted">Очки фракции идут в общий пул Дома. Счёт сразу обновляется на главной странице.</p></div></div>
      <div class="grid2">${['talbot', 'dorn'].map(h => `<form class="panel cab-form fx-form h-${h}" data-fx="${h}"><div class="eyebrow">${HN[h]}</div><div class="fx-big">${P[h] || 0}</div>
        <div class="cab-row">${field('fxD-' + h, 'Сколько очков', `<input id="fxD-${h}" type="number" min="-1000" max="1000" step="1" value="10" required>`, 'Минус — чтобы снять очки')}${field('fxR-' + h, 'За что', `<input id="fxR-${h}" maxlength="300" placeholder="Ивент, задание, победа в споре…" required>`)}</div>
        <button class="btn" type="submit">Начислить</button></form>`).join('')}</div>
      <section class="panel cab-form" style="margin-top:16px"><div class="eyebrow">Последние начисления</div>${(lg.data || []).length ? `<ol class="cab-hist">${lg.data.map(r => `<li class="${r.delta > 0 ? 'v-approved' : 'v-rejected'}"><div><b>${HN[r.house]} ${r.delta > 0 ? '+' : ''}${r.delta}</b><small>${esc(who(r.author))} · ${fmtDate(r.created_at)}</small></div>${r.reason ? `<p>${esc(r.reason)}</p>` : ''}</li>`).join('')}</ol>` : '<p class="muted">Начислений пока не было.</p>'}</section>`;
  }
  function bindFactions() {
    qa('[data-fx]', el).forEach(f => f.onsubmit = async ev => {
      ev.preventDefault(); const h = f.dataset.fx, d = parseInt(q('#fxD-' + h, el).value, 10), r = q('#fxR-' + h, el).value.trim();
      if (!d) { toast(el, 'Впиши число, отличное от нуля', true); return; }
      try { const c = await sb(); must(await c.from('faction_log').insert({ house: h, delta: d, reason: r })); play('click'); toast(el, 'Счёт обновлён'); q('#aBody', el).innerHTML = await factionsHTML(); bindFactions(); } catch (e) { toast(el, errText(e), true); }
    });
  }
  async function show() {
    if (tab === 'factions') { frame('<p class="muted">Загружаю…</p>'); try { q('#aBody', el).innerHTML = await factionsHTML(); bindFactions(); } catch (e) { toast(el, errText(e), true); } return; }
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
const SLOT_NAME = { infernal: ['инферналов', 'Инферналы'], curse: ['проклятых', 'Проклятые'], goblin: ['гоблинов', 'Гоблины'] };
function fillSlots(root) {
  const boxes = qa('.slot-box', root || document); if (!boxes.length) return;
  const lim = (window.M && M.slots) || { infernal: 7, curse: 7, goblin: 15 };
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
let headSess = null, headProf = null;
function paintHeader(sess, prof) {
  headSess = sess;
  if (prof !== undefined) headProf = prof;
  if (!sess) headProf = null;
  const b = document.getElementById('cabBtn'); if (!b) return;
  const md = (sess && sess.user && sess.user.user_metadata) || {};
  const name = md.custom_claims && md.custom_claims.global_name || md.full_name || md.name || (sess && sess.user.email || '').split('@')[0];
  if (sess) {
    b.classList.add('in');
    b.title = 'Личный кабинет · ' + (name || '');
    const own = headProf && headProf.portrait;
    b.innerHTML = (own ? `<img class="cab-btn-ava" src="${esc(own)}" alt="">` : md.avatar_url ? `<img class="cab-btn-ava" src="${esc(md.avatar_url)}" alt="">` : `<i class="cab-btn-ava">${esc((name || '?').slice(0, 1).toUpperCase())}</i>`) + `<span>${esc(name || 'Кабинет')}</span>`;
  } else {
    b.classList.remove('in'); b.title = 'Личный кабинет';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg><span>Войти</span>';
  }
}
function initHeader() {
  if (!liveSite()) return;
  const withProf = s => { paintHeader(s); if (s) api().myProfile(s.user.id).then(p => { if (p) paintHeader(s, p); }).catch(() => {}); };
  api().session().then(withProf).catch(() => {});
  api().onAuth(s => { if (!s || !headSess || s.user.id !== headSess.user.id) withProf(s); }).catch(() => {});
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

/* ---------- сообщество: Discord и жители города ---------- */
const GUILD_ID = '1467559507721982075';
const INVITE = 'https://discord.gg/K8Bg5SaEeb';
async function residentsData() {
  if (!api().configured() || window.MH_CABINET_API) return null;
  try { const c = await sb(); const r = await c.rpc('residents'); return r.error ? null : r.data; } catch (_) { return null; }
}
async function discordData() {
  const out = { stats: null, widget: null };
  if (CFG.url && CFG.anonKey) {
    try { const r = await fetch(CFG.url + '/functions/v1/notify?stats=discord', { headers: { Authorization: 'Bearer ' + CFG.anonKey, apikey: CFG.anonKey } }); if (r.ok) out.stats = await r.json(); } catch (_) {}
  }
  try { const r = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`); if (r.ok) out.widget = await r.json(); } catch (_) {}
  return out;
}
const origin = (p, o) => (originsOf(p).find(x => x.id === o) || {});
const figureOf = r => { const o = origin(r.p, r.o); return o.folder && r.c ? `assets/characters/${o.folder}/${r.g === 'male' ? 'male' : 'female'}-${r.c}.webp` : ''; };
const numOf = n => '№' + String(n || 0).padStart(3, '0');
const charPic = r => /^https:\/\//.test(r.portrait_url || '') ? r.portrait_url : '';
function residentRow(r) {
  const o = origin(r.p, r.o);
  const pic = charPic(r);
  return `<li class="rs-row h-${r.house === 'dorn' ? 'dorn' : 'talbot'}" onclick="location.hash='hero-${r.number}'" style="cursor:pointer">${pic ? `<img class="rs-pic" src="${esc(pic)}" alt="" loading="lazy">` : o.emblem ? `<img src="${esc(o.emblem)}" alt="">` : '<i></i>'}<div><b>${numOf(r.number)} · ${esc(r.name || 'Без имени')}</b><small>${esc([nameOf(peoples(), r.p), o.name, nameOf(classes(), r.c)].filter(Boolean).join(' · '))}</small></div></li>`;
}
async function community(el) {
  if (!el) return;
  const rsEl = document.getElementById('rsMini');
  el.innerHTML = `<article class="panel dc-card"><div class="dc-head"><img class="dc-icon" src="assets/community/discord-3d.webp" alt=""><div><div class="eyebrow">Discord · наше сообщество</div><h3 class="dc-name">Хроники Меттенхейма</h3><p class="dc-counts">Загружаю…</p></div></div>
      <div class="dc-online"></div>
      <ul class="dc-inside">
        <li><b>📜 Правила и анонсы</b><span>Новости сессии, ивенты и изменения правил</span></li>
        <li><b>🚩 Подача квент</b><span>Квенты с сайта, решения мастеров приходят в личку</span></li>
        <li><b>🗝️ Личные кабинеты</b><span>Свой канал у каждого принятого персонажа</span></li>
        <li><b>🎙️ Голос и сцены</b><span>Ролевые каналы, гостевой войс, поиск игроков</span></li>
      </ul>
      <div class="dc-btns"><a class="btn dc-join" href="${INVITE}" target="_blank" rel="noopener">Войти на сервер</a><a class="btn ghost" href="#chat">💬 Чат на сайте</a></div></article>`;
  if (rsEl) rsEl.innerHTML = `<article class="panel rs-card"><div class="eyebrow">Жители Меттенхейма</div><h3>Принятые персонажи</h3><ul class="rs-list"><li class="muted">Загружаю…</li></ul><a class="btn small ghost" href="#residents">Все жители →</a></article>`;
  const [dd, rs] = await Promise.all([discordData(), residentsData()]);
  const st = dd.stats, w = dd.widget;
  if (st && st.icon) q('.dc-icon', el).src = st.icon;
  if (st && st.name) q('.dc-name', el).textContent = st.name;
  const online = (st && st.online) ?? (w && w.presence_count);
  q('.dc-counts', el).innerHTML = st || w ? `${st && st.members ? `<span>👥 ${st.members} участников</span>` : ''}${online != null ? `<span><i class="dot"></i>${online} в сети</span>` : ''}` : 'Сервер ролевого проекта';
  if (w && w.members && w.members.length) {
    const ms = w.members.slice(0, 30);
    q('.dc-online', el).innerHTML = `<div class="dc-sub">Сейчас в сети</div><div class="dc-avas">${ms.map(m => `<span class="dc-ava st-${esc(m.status)}" title="${esc(m.username)}"><img src="${esc(m.avatar_url)}" alt="" loading="lazy"></span>`).join('')}${w.members.length > ms.length ? `<span class="dc-more">+${w.members.length - ms.length}</span>` : ''}</div>`;
    if (w.instant_invite) q('.dc-join', el).href = w.instant_invite;
  }
  const list = rsEl && q('.rs-list', rsEl);
  if (!list) return;
  if (!rs) list.innerHTML = '<li class="muted">Список появится на основном сайте.</li>';
  else if (!rs.length) list.innerHTML = '<li class="muted">Пока никто не принят. <a href="#anketa">Подай квенту первым</a>.</li>';
  else list.innerHTML = rs.slice(-5).reverse().map(residentRow).join('');
}
async function residentsPage(el) {
  if (!el) return;
  el.innerHTML = '<p class="muted">Загружаю жителей…</p>';
  const rs = await residentsData();
  if (!rs) { el.innerHTML = '<article class="panel cab-empty"><h3>Список жителей — на основном сайте</h3><p class="muted">Он берётся из базы кабинета.</p>' + (CFG.siteUrl ? `<a class="btn" href="${esc(CFG.siteUrl)}#residents" target="_blank" rel="noopener">Открыть</a>` : '') + '</article>'; return; }
  let f = { q: '', house: '', p: '', c: '' };
  const draw = () => {
    const qq = f.q.toLowerCase();
    const list = rs.filter(r => (!f.house || (r.house || 'talbot') === f.house) && (!f.p || r.p === f.p) && (!f.c || r.c === f.c) && (!qq || (r.name || '').toLowerCase().includes(qq) || String(r.number).includes(qq)));
    q('.rs-grid', el).innerHTML = list.length ? list.map(r => { const o = origin(r.p, r.o), fig = figureOf(r);
      const pic = charPic(r);
      return `<a class="panel rs-tile h-${r.house === 'dorn' ? 'dorn' : 'talbot'}${pic ? ' has-pic' : ''}" href="#hero-${r.number}">${pic ? `<img class="rs-portrait" src="${esc(pic)}" alt="Портрет: ${esc(r.name || '')}" loading="lazy">` : fig ? `<img class="rs-fig" src="${fig}" alt="" loading="lazy">` : ''}<div class="rs-info"><span class="rs-num">${numOf(r.number)}</span><h3>${esc(r.name || 'Без имени')}</h3><p>${esc([nameOf(peoples(), r.p), o.name].filter(Boolean).join(' · '))}</p><p>${esc(nameOf(classes(), r.c))} · ${r.house === 'dorn' ? 'Дом Дорн' : 'Дом Талбот'}</p></div></a>`; }).join('') : '<p class="muted">Никого не нашлось.</p>';
    q('.rs-count', el).textContent = `Жителей: ${list.length}${list.length !== rs.length ? ' из ' + rs.length : ''}`;
  };
  el.innerHTML = `<div class="rs-filters panel"><input type="search" id="rsQ" placeholder="Имя или номер" aria-label="Поиск по жителям">
    <select id="rsH" aria-label="Дом"><option value="">Оба Дома</option><option value="talbot">Дом Талбот</option><option value="dorn">Дом Дорн</option></select>
    <select id="rsP" aria-label="Народ"><option value="">Все народы</option>${peoples().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
    <select id="rsC" aria-label="Класс"><option value="">Все классы</option>${classes().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <span class="rs-count muted"></span></div><div class="rs-grid"></div>`;
  if (!rs.length) { q('.rs-grid', el).innerHTML = '<article class="panel cab-empty"><h3>Город ещё пуст</h3><p class="muted">Первые жители появятся здесь, как только мастера примут их квенты.</p><a class="btn" href="#anketa">Создать персонажа</a></article>'; q('.rs-count', el).textContent = ''; return; }
  q('#rsQ', el).oninput = e => { f.q = e.target.value; draw(); };
  q('#rsH', el).onchange = e => { f.house = e.target.value; draw(); };
  q('#rsP', el).onchange = e => { f.p = e.target.value; draw(); };
  q('#rsC', el).onchange = e => { f.c = e.target.value; draw(); };
  draw();
}

/* ---------- чат сайта ↔ канал Discord ---------- */
const CHAT_URL = 'https://discord.com/channels/1467559507721982075/1564605532524908666';
const fnUrl = qs => `${CFG.url}/functions/v1/notify?${qs}`;
function chatText(t) {
  return esc(t)
    .replace(/&lt;(a?):([\w~]+):(\d+)&gt;/g, (_m, a, n, id) => `<img class="ch-emo" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'webp'}?size=48" alt=":${n}:" title=":${n}:">`)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,:;!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}
const chatTime = d => { const t = new Date(d), now = new Date(); const hm = t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); return t.toDateString() === now.toDateString() ? hm : t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + hm; };
async function chatPage(el) {
  if (!el) return;
  if (!api().configured() || window.MH_CABINET_API || !liveSite()) {
    el.innerHTML = `<article class="panel cab-empty"><h3>Чат работает на основном сайте</h3><p class="muted">Он связан с каналом Discord и базой кабинета.</p>${CFG.siteUrl ? `<a class="btn" href="${esc(CFG.siteUrl)}#chat" target="_blank" rel="noopener">Открыть чат</a>` : ''}</article>`;
    return;
  }
  el.innerHTML = `<div class="ch-wrap panel"><div class="ch-head"><div><div class="eyebrow">Город на связи</div><b>Общий чат</b><small>Сообщения идут в канал Discord и обратно</small></div><a class="btn small ghost" href="${CHAT_URL}" target="_blank" rel="noopener">Открыть в Discord</a></div>
    <div class="ch-log" id="chLog" role="log" aria-live="polite" aria-label="Сообщения чата"><p class="muted ch-note">Загружаю сообщения…</p></div>
    <div class="ch-foot" id="chFoot"></div><p class="cab-toast" role="status" aria-live="polite"></p></div>`;
  const log = q('#chLog', el), foot = q('#chFoot', el);
  const c = await sb();
  let sess = null, prof = null;
  try { sess = await api().session(); if (sess) prof = await api().myProfile(sess.user.id); } catch (_) {}
  const staff = prof && ['master', 'admin'].includes(prof.role);
  const msgs = new Map();
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  function draw(stick) {
    const list = [...msgs.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    if (!list.length) { log.innerHTML = '<p class="muted ch-note">Пока тихо. Напиши первым — сообщение появится и в Discord.</p>'; return; }
    const keep = stick || atBottom();
    let prev = null;
    log.innerHTML = list.map(m => {
      const cont = prev && prev.author === m.author && prev.source === m.source && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
      prev = m;
      const att = (m.attachments || []).map(a => a.image ? `<a href="${esc(a.url)}" target="_blank" rel="noopener"><img class="ch-img" src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy"></a>` : `<a class="ch-file" href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a>`).join('');
      return `<div class="ch-msg${cont ? ' cont' : ''}${m.profile_id && sess && m.profile_id === sess.user.id ? ' mine' : ''}" data-id="${m.id}">
        ${cont ? '<span class="ch-ava-sp"></span>' : (m.avatar ? `<img class="ch-ava" src="${esc(m.avatar)}" alt="" loading="lazy">` : `<span class="ch-ava cab-ava-empty">${esc((m.author || '?').slice(0, 1).toUpperCase())}</span>`)}
        <div class="ch-body">${cont ? '' : `<div class="ch-meta"><b>${esc(m.author || 'Без имени')}</b><span class="ch-src ${m.source}">${m.source === 'site' ? 'сайт' : 'discord'}</span><time>${chatTime(m.created_at)}</time></div>`}
          ${m.body ? `<div class="ch-text">${chatText(m.body)}</div>` : ''}${att ? `<div class="ch-att">${att}</div>` : ''}</div>
        ${staff ? `<button type="button" class="ch-del" data-del="${m.id}" title="Удалить сообщение" aria-label="Удалить сообщение">✕</button>` : ''}</div>`;
    }).join('');
    if (keep) log.scrollTop = log.scrollHeight;
  }
  const add = rows => rows.forEach(r => msgs.set(r.id, r));
  try {
    const r = await c.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(80);
    if (r.error) throw r.error;
    add(r.data || []);
  } catch (e) { log.innerHTML = `<p class="muted ch-note">Чат пока не подключён: ${esc(errText(e))}</p>`; return; }
  draw(true);
  // мгновенно: новые строки из базы
  const rt = c.channel('mh-chat').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, p => {
    if (p.eventType === 'DELETE') { msgs.delete(p.old.id); draw(); return; }
    if (p.new && p.new.id) { const mine = atBottom(); msgs.set(p.new.id, p.new); draw(mine); if (p.new.source === 'discord') play('click'); }
  }).subscribe();
  // забираем новое из Discord, пока страница открыта
  const sync = () => { if (document.hidden) return; fetch(fnUrl('chat=sync'), { headers: { Authorization: 'Bearer ' + CFG.anonKey, apikey: CFG.anonKey } }).catch(() => {}); };
  sync(); const timer = setInterval(sync, 4000);
  const stop = () => { clearInterval(timer); try { c.removeChannel(rt); } catch (_) {} window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);

  if (staff) log.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-del]'); if (!b) return;
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Удалить?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = '✕'; } }, 3000); return; }
    const s = await api().session();
    const r = await fetch(fnUrl('chat=del'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: CFG.anonKey }, body: JSON.stringify({ id: +b.dataset.del }) });
    if (!r.ok) toast(el, (await r.json().catch(() => ({}))).error || 'Не удалось удалить', true);
  });

  if (!sess) {
    foot.innerHTML = `<p class="ch-login">Читать может каждый. Чтобы писать, <button type="button" class="ch-link" id="chLogin">войди через Discord</button>.</p>`;
    q('#chLogin', el).onclick = async () => { try { sessionStorage.setItem(AFTER_KEY, 'chat'); } catch (_) {} try { await api().signInDiscord(); } catch (e) { toast(el, errText(e), true); } };
    return;
  }
  foot.innerHTML = `<form class="ch-form" id="chForm">${avaOf(prof) ? `<img class="ch-ava" src="${esc(avaOf(prof))}" alt="">` : ''}<textarea id="chIn" rows="1" maxlength="1500" placeholder="Сообщение в общий чат… Enter — отправить, Shift+Enter — новая строка" aria-label="Сообщение"></textarea><button class="btn small" type="submit">Отправить</button></form>`;
  const form = q('#chForm', el), inp = q('#chIn', el);
  const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(160, inp.scrollHeight) + 'px'; };
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async ev => {
    ev.preventDefault();
    const text = inp.value.trim(); if (!text) return;
    const btn = q('button', form); btn.disabled = true;
    try {
      const s = await api().session();
      const r = await fetch(fnUrl('chat=send'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: CFG.anonKey }, body: JSON.stringify({ text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Сообщение не ушло');
      inp.value = ''; grow(); play('click');
    } catch (e) { toast(el, errText(e), true); }
    btn.disabled = false; inp.focus();
  };
}

/* ---------- живой сервер: новости, события, счёт Домов, страница героя ---------- */
const liveOk = () => api().configured() && !window.MH_CABINET_API;
let liveSyncAt = 0;
const liveSync = () => { if (!liveOk() || Date.now() - liveSyncAt < 60000) return Promise.resolve(); liveSyncAt = Date.now(); return fetch(fnUrl('live=sync'), { headers: { Authorization: 'Bearer ' + CFG.anonKey, apikey: CFG.anonKey } }).catch(() => {}); };
// Discord-разметка: заголовки, жирный, курсив, подчёркнутый, зачёркнутый, ссылки, списки, цитаты, эмодзи
function dmd(t) {
  const inline = x => chatText(x)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>').replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>').replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" tabindex="0">$1</span>');
  const out = []; let list = null;
  for (const line of String(t || '').split('\n')) {
    const h = /^(#{1,3})\s+(.+)$/.exec(line), li = /^\s*[-*•]\s+(.+)$/.exec(line), qt = /^>\s?(.*)$/.exec(line), sm = /^-#\s+(.+)$/.exec(line);
    if (li) { (list = list || []).push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (sm) out.push(`<p class="nw-small">${inline(sm[1])}</p>`);
    else if (h) out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
    else if (qt) out.push(`<blockquote>${inline(qt[1])}</blockquote>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('');
}
const newsDate = d => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
function newsCard(n, big) {
  const imgs = (n.images || []).slice(0, big ? 6 : 1);
  return `<article class="panel nw-card${big ? ' big' : ''}">${imgs.length ? `<div class="nw-pics n${imgs.length}">${imgs.map(i => `<a href="${esc(i.url)}" target="_blank" rel="noopener"><img src="${esc(i.url)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
    <div class="nw-body"><div class="nw-meta">${n.avatar ? `<img src="${esc(n.avatar)}" alt="">` : ''}<b>${esc(n.author || 'Администрация')}</b><time>${newsDate(n.created_at)}</time></div>
    <div class="nw-text${big ? '' : ' clamp'}">${dmd(n.body)}</div>${big ? '' : '<a class="nw-more" href="#news">Читать в новостях →</a>'}</div></article>`;
}
const evTime = e => { const s = new Date(e.starts_at); return s.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }) + ', ' + s.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
function eventCard(e) {
  const live = e.status === 2;
  return `<article class="panel ev-card${live ? ' live' : ''}">${e.image ? `<img class="ev-img" src="${esc(e.image)}" alt="" loading="lazy">` : ''}
    <div class="ev-body"><div class="ev-when">${live ? '<span class="ev-live">Идёт сейчас</span>' : evTime(e)}</div><h3>${esc(e.name)}</h3>
    ${e.description ? `<div class="ev-desc">${dmd(e.description)}</div>` : ''}
    <div class="ev-foot">${e.location ? `<span>📍 ${esc(e.location)}</span>` : ''}${e.interested ? `<span>⭐ ${e.interested} идут</span>` : ''}
    <a class="btn small" href="https://discord.com/events/${GUILD_ID}/${esc(e.id)}" target="_blank" rel="noopener">Записаться</a></div></div></article>`;
}
async function liveBlock(el) {
  if (!el) return;
  if (!liveOk()) { el.innerHTML = ''; return; }
  const c = await sb();
  const draw = async () => {
    const [nw, ep, ev, fx] = await Promise.all([
      c.from('news').select('*').eq('kind', 'news').order('created_at', { ascending: false }).limit(3),
      c.from('news').select('*').eq('kind', 'event').order('created_at', { ascending: false }).limit(3),
      c.from('events').select('*').order('starts_at', { ascending: true }).limit(4),
      c.from('faction_score').select('*')
    ]);
    const F = Object.fromEntries(((fx.data) || []).map(r => [r.house, r.points]));
    const t = F.talbot || 0, d = F.dorn || 0, sum = t + d, pt = sum ? Math.round(t / sum * 100) : 50;
    const fxEl = q('#fxMount'); if (fxEl) fxEl.innerHTML = `<div class="panel fx-board"><div class="eyebrow">Счёт Домов · общий пул очков фракции</div>
      <div class="fx-h t"><small>Жёлтые</small><b>Дом Талбот</b><span class="fx-n">${t}</span></div>
      <div class="fx-gauge" role="img" aria-label="Перевес: ${sum ? (t > d ? 'Талбот' : d > t ? 'Дорн' : 'равенство') : 'пока равенство'}"><div class="fx-needle" style="--fx-a:${((50 - pt) / 50 * -110).toFixed(1)}deg"></div><b>Перевес</b></div>
      <div class="fx-h d"><small>Красные</small><b>Дом Дорн</b><span class="fx-n">${d}</span></div>
      <div class="fx-vs">${sum ? (t > d ? '◀ ведут Жёлтые' : d > t ? 'ведут Красные ▶' : 'ничья') : 'сезон начинается'}</div>
      <div class="fx-tube"><div class="fx-bar" role="img" aria-label="Талбот ${t}, Дорн ${d}"><i class="t" style="width:${pt}%"></i><i class="d" style="width:${100 - pt}%"></i></div></div>
      <p class="muted">Очки приносят ивенты, задания и победы в сюжете. Уровни пула открывают Дому бонусы — подробнее в главе <a href="#factions">Фракции</a>.</p></div>`;
    const news = (nw.data || []).filter(n => n.body || (n.images || []).length), evs = (ev.data || []).filter(e => e.status !== 3 && e.status !== 4);
    const posts = (ep.data || []).filter(n => n.body || (n.images || []).length);
    const evEl = q('#evMount');
    if (evEl) evEl.innerHTML = `<div class="live-head"><div class="eyebrow">Ивенты и мероприятия</div><h2>События</h2><a class="btn small ghost" href="#news">Все события</a></div>
      ${evs.length ? `<div class="ev-list wide">${evs.map(eventCard).join('')}</div>` : ''}
      ${posts.length ? `<div class="nw-list ev-posts">${posts.map(n => newsCard(n, false)).join('')}</div>` : ''}
      ${!evs.length && !posts.length ? '<article class="panel cab-empty"><p class="muted">Здесь появятся события из нашего Discord — с картинками и кнопкой «Записаться».</p></article>' : ''}`;
    el.innerHTML = `<div class="live-grid solo"><div><div class="live-head"><div class="eyebrow">Хроники Меттенхейма</div><h2>Новости и анонсы</h2><a class="btn small ghost" href="#news">Все новости</a></div>
        ${news.length ? `<div class="nw-list">${news.map(n => newsCard(n, false)).join('')}</div>` : '<article class="panel cab-empty"><p class="muted">Скоро здесь появятся новости из нашего Discord.</p></article>'}</div></div>`;
  };
  await draw().catch(() => {});
  liveSync().then(() => setTimeout(() => draw().catch(() => {}), 2500));
  const ch = c.channel('mh-live').on('postgres_changes', { event: '*', schema: 'public', table: 'faction_score' }, () => draw().catch(() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, () => draw().catch(() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => draw().catch(() => {})).subscribe();
  const stop = () => { try { c.removeChannel(ch); } catch (_) {} window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);
}
async function newsPage(el) {
  if (!el) return;
  if (!liveOk()) { el.innerHTML = `<article class="panel cab-empty"><h3>Новости — на основном сайте</h3>${CFG.siteUrl ? `<a class="btn" href="${esc(CFG.siteUrl)}#news" target="_blank" rel="noopener">Открыть</a>` : ''}</article>`; return; }
  el.innerHTML = '<p class="muted">Загружаю новости…</p>';
  const c = await sb();
  const draw = async () => {
    const [nw, ep, ev] = await Promise.all([c.from('news').select('*').eq('kind', 'news').order('created_at', { ascending: false }).limit(40), c.from('news').select('*').eq('kind', 'event').order('created_at', { ascending: false }).limit(20), c.from('events').select('*').order('starts_at', { ascending: true }).limit(20)]);
    const evs = (ev.data || []).filter(e => e.status !== 3 && e.status !== 4), posts = (ep.data || []).filter(n => n.body || (n.images || []).length);
    el.innerHTML = `${evs.length ? `<div class="sec-head"><div class="eyebrow">Календарь</div><h2>События сервера</h2><p>Записаться можно прямо в Discord: кнопка откроет событие.</p></div><div class="ev-list wide">${evs.map(eventCard).join('')}</div>` : ''}
      ${posts.length ? `<div class="sec-head" style="margin-top:${evs.length ? 40 : 0}px"><div class="eyebrow">Из канала мероприятий</div><h2>Ивенты</h2></div><div class="nw-feed">${posts.map(n => newsCard(n, true)).join('')}</div>` : ''}
      <div class="sec-head" style="margin-top:${evs.length || posts.length ? 50 : 0}px"><div class="eyebrow">Из канала анонсов Discord</div><h2>Новости</h2></div>
      ${(nw.data || []).some(n => n.body || (n.images || []).length) ? `<div class="nw-feed">${nw.data.filter(n => n.body || (n.images || []).length).map(n => newsCard(n, true)).join('')}</div>` : '<article class="panel cab-empty"><p class="muted">Новостей пока нет.</p></article>'}`;
  };
  await draw().catch(e => { el.innerHTML = `<p class="muted">${esc(errText(e))}</p>`; });
  liveSyncAt = 0; liveSync().then(() => setTimeout(() => draw().catch(() => {}), 2500));
}
async function heroPage(el, n) {
  if (!el) return;
  if (!liveOk()) { el.innerHTML = `<article class="panel cab-empty"><h3>Карточки жителей — на основном сайте</h3></article>`; return; }
  el.innerHTML = '<p class="muted">Открываю личное дело…</p>';
  const c = await sb(); const r = await c.rpc('hero', { n: +n || 0 });
  const h = (r.data || [])[0];
  if (!h) { el.innerHTML = '<article class="panel cab-empty"><h3>Такого жителя нет</h3><p class="muted">Возможно, персонаж ещё не принят или ушёл в архив.</p><a class="btn" href="#residents">Все жители</a></article>'; return; }
  const o = origin(h.p, h.o), fig = figureOf(h), pic = charPic(h);
  const bg = (Mx().backgrounds || []).find(b => b.id === h.bg);
  const king = h.p === 'infernals' ? ((Mx().kings || []).find(k => k.id === h.ik) || null) : null;
  const curse = h.u === 'curse' ? (curses().find(x => x.id === h.cu) || null) : null;
  const rows = [['Народ', [nameOf(peoples(), h.p), o.name].filter(Boolean).join(' · ')], ['Класс', nameOf(classes(), h.c)], ['Дом', h.house === 'dorn' ? 'Дом Дорн · Красные' : 'Дом Талбот · Жёлтые'],
    ['Пол', h.g === 'male' ? 'Мужской' : h.g === 'female' ? 'Женский' : ''], ['Возраст', h.age], ['Предыстория', bg && bg.name], ['Особенность', king ? 'Инфернал · Дом ' + king.gen : curse ? 'Проклятие · ' + curse.name : h.u === 'construct' ? 'Конструкт' : ''],
    ['Вера', h.faith], ['Ремесло', h.prof], ['Черты', h.traits], ['Цель', h.goal]].filter(x => x[1]);
  document.title = `${h.name} · Хроники Меттенхейма`;
  el.innerHTML = `<article class="panel hero-card h-${h.house === 'dorn' ? 'dorn' : 'talbot'}"><div class="hc-art">${pic ? `<img class="hc-portrait" src="${esc(pic)}" alt="Портрет: ${esc(h.name)}">` : fig ? `<img class="hc-fig" src="${fig}" alt="">` : ''}</div>
    <div class="hc-info"><span class="rs-num">${numOf(h.number)} · житель Меттенхейма</span><h2>${esc(h.name)}</h2>${o.emblem ? `<img class="hc-emb" src="${esc(o.emblem)}" alt="">` : ''}
    <div class="kv">${rows.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <p class="muted" style="margin-top:14px">В городе с ${fmtDate(h.approved_at)}.</p>
    <div class="cab-acts" style="margin-top:12px">${h.channel ? `<a class="btn small" href="https://discord.com/channels/${GUILD_ID}/${esc(h.channel)}" target="_blank" rel="noopener">Канал персонажа в Discord</a>` : ''}<a class="btn small ghost" href="#residents">Все жители</a></div></div></article>`;
}

window.Cabinet = { mount, api: SupabaseApi, fillSlots, anketaStatus, initHeader, community, residentsPage, chat: chatPage, live: liveBlock, news: newsPage, hero: heroPage };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader); else setTimeout(initHeader, 0);
// после входа через Discord / почту вернуть игрока туда, откуда он пришёл
if (CFG.url && CFG.anonKey && /[?&](code|error_description)=/.test(location.search)) {
  let to = 'cabinet'; try { to = sessionStorage.getItem(AFTER_KEY) || 'cabinet'; sessionStorage.removeItem(AFTER_KEY); } catch (_) {}
  sb().then(c => c.auth.getSession()).finally(() => { history.replaceState(null, '', location.pathname + '#' + to); window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
})();
