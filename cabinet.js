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
      <p class="muted" style="font-size:13px;margin-top:14px">Входя, ты соглашаешься с <a href="#privacy">политикой конфиденциальности</a>.</p>
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
    el.innerHTML = topBar(prof, false) + `<div class="cab-tabs" role="tablist"><button type="button" role="tab" data-tab="chars" aria-selected="${tab === 'chars'}">Мои персонажи <i>${chars.length}</i></button><button type="button" role="tab" data-tab="logs" aria-selected="${tab === 'logs'}">Дневники</button><button type="button" role="tab" data-tab="profile" aria-selected="${tab === 'profile'}">Профиль</button></div><div id="cBody">${inner}</div><p class="cab-toast" role="status" aria-live="polite"></p>`;
    q('#cOut', el).onclick = async () => { await api().signOut(); paintHeader(null); location.hash = '#cabinet'; mount(el, 'player'); };
    qa('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; open = null; play('click'); render(); });
  }
  function listHTML() {
    const draft = anketaDraft();
    return `<div class="cab-head"><div><div class="eyebrow">Персонажи</div><h2>Мои квенты</h2></div><div class="cab-acts"><button type="button" class="btn" id="cNew">Новый персонаж</button>${draft && (draft.name || draft.quenta) ? `<button type="button" class="btn ghost" id="cFromA">Взять из анкеты: ${esc(draft.name || 'без имени')}</button>` : ''}</div></div>
      ${chars.length ? `<div class="cab-grid">${chars.map(c => `<button type="button" class="panel cab-card" data-open="${c.id}"><div class="cab-card-top">${pill(c.status)}<small>${fmtDate(c.updated_at)}</small></div><h3>${esc(c.name || 'Без имени')}</h3><p>${esc(describe(c.data || {})) || 'Народ и класс не выбраны'}</p></button>`).join('')}</div>`
        : `<article class="panel cab-empty"><h3>Пока ни одного персонажа</h3><p class="muted">Создай нового или перенеси анкету, которую собрал на главной странице. Квенту можно писать частями — черновик сохраняется на сервере.</p></article>`}`;
  }
  let logT = 'hunger';
  const LOGS = [['hunger', 'Дневник голода', 'Инферналам: Голод, Эссенция, питание и траты.'], ['crystal', 'Резервуар мага', 'Магам: резервуар, кристаллы и истощение.']];
  function logsHTML() {
    return `<div class="cab-head"><div><div class="eyebrow">Отчётность персонажа</div><h2>Дневники</h2><p class="muted">Здесь ведётся то, что меняется по ходу игры. Записи хранятся в этом браузере.</p></div></div>
      <div class="cab-subtabs">${LOGS.map(([k, n, d]) => `<button type="button" data-log="${k}" aria-pressed="${k === logT}"><b>${n}</b><small>${d}</small></button>`).join('')}</div><div id="logMount"></div>`;
  }
  function mountLogs() {
    qa('[data-log]', el).forEach(b => b.onclick = () => { logT = b.dataset.log; play('click'); render(); });
    const m = q('#logMount', el);
    const go = () => { if (logT === 'hunger' && window.Inferno) window.Inferno.mountDiary(m); else if (logT === 'crystal' && window.Crystal) window.Crystal.mount(m); };
    if (logT === 'crystal' && !window.ICON_ART_DATA && window.MH && MH.loadArt) { m.innerHTML = '<p class="muted">Загружаю…</p>'; MH.loadArt().then(go, go); } else go();
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
    if (tab === 'logs') { frame(logsHTML()); mountLogs(); return; }
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
  headSess = sess; bellInit(sess);
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
/* ---------- колокольчик: статус квенты, ответы в чате, комментарии к артам ---------- */
const BELL_SEEN = 'mh:bell-seen';
const BELL_VERD = { submitted: ['📨', 'Квента ушла мастерам'], approved: ['✅', 'Квента принята'], revision: ['🛠️', 'Квента вернулась на доработку'], rejected: ['❌', 'Квента отклонена'], comment: ['💬', 'Мастер оставил комментарий'] };
const bell = { uid: null, items: [], told: null, t: 0 };
const seenAt = () => { try { return +localStorage.getItem(BELL_SEEN) || 0; } catch (_) { return 0; } };
function bellInit(sess) {
  if (!liveSite()) return;
  let b = document.getElementById('bellBtn');
  if (!sess) { if (b) b.remove(); bell.uid = null; clearInterval(bell.t); return; }
  if (!b) {
    b = document.createElement('button'); b.id = 'bellBtn'; b.type = 'button'; b.className = 'icon-btn bell-btn'; b.title = 'Уведомления'; b.setAttribute('aria-label', 'Уведомления'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><i class="bell-n" hidden></i>';
    const cab = document.getElementById('cabBtn'); if (cab) cab.before(b);
    b.onclick = () => bellOpen(b);
  }
  if (bell.uid !== sess.user.id) { bell.uid = sess.user.id; bell.told = null; bellLoad(); clearInterval(bell.t); bell.t = setInterval(() => { if (!document.hidden) bellLoad(); }, 60000); }
}
async function bellLoad() {
  const uid = bell.uid; if (!uid) return;
  const c = await sb(), items = [];
  try {
    const ch = await c.from('characters').select('id,name').eq('owner', uid);
    const names = new Map((ch.data || []).map(x => [x.id, x.name || 'Без имени']));
    if (names.size) {
      const rv = await c.from('reviews').select('id,character_id,verdict,body,created_at,author').in('character_id', [...names.keys()]).order('created_at', { ascending: false }).limit(25);
      (rv.data || []).forEach(r => {
        if (r.author === uid && r.verdict !== 'submitted') return;
        const v = BELL_VERD[r.verdict]; if (!v) return;
        items.push({ k: 'rv' + r.id, at: r.created_at, icon: v[0], kind: r.verdict, title: `${v[1]} · ${names.get(r.character_id)}`, text: (r.body || '').replace(/\s+/g, ' ').slice(0, 120), href: '#cabinet' });
      });
    }
  } catch (_) {}
  try {
    const mine = await c.from('chat_messages').select('discord_id').eq('profile_id', uid).order('created_at', { ascending: false }).limit(60);
    const dids = new Set((mine.data || []).map(m => m.discord_id).filter(Boolean));
    if (dids.size) {
      const rec = await c.from('chat_messages').select('id,discord_id,author,body,created_at,profile_id').like('body', '> ↪ %').order('created_at', { ascending: false }).limit(80);
      (rec.data || []).forEach(m => {
        const rp = splitReply(m.body); if (!rp.did || !dids.has(rp.did) || m.profile_id === uid) return;
        items.push({ k: 'ch' + m.id, at: m.created_at, icon: '↩️', kind: 'reply', title: `${m.author || 'Житель'} ответил(а) тебе в чате`, text: rp.rest.replace(/\s+/g, ' ').slice(0, 120), href: '#chat-d' + (m.discord_id || rp.did) });
      });
    }
  } catch (_) {}
  try {
    const arts = await c.from('gallery_arts').select('id,title').eq('owner', uid).limit(200);
    const at = new Map((arts.data || []).map(a => [a.id, a.title]));
    if (at.size) {
      const cm = await c.from('gallery_comments').select('id,art_id,author,body,created_at,owner').in('art_id', [...at.keys()]).order('created_at', { ascending: false }).limit(25);
      (cm.data || []).forEach(x => { if (x.owner !== uid) items.push({ k: 'gc' + x.id, at: x.created_at, icon: '🎨', kind: 'art', title: `${x.author} — комментарий к «${at.get(x.art_id)}»`, text: x.body.replace(/\s+/g, ' ').slice(0, 120), href: '#gallery-' + x.art_id }); });
    }
  } catch (_) {}
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  bell.items = items.slice(0, 30);
  // всплывающее уведомление браузера — только о новом с прошлой проверки
  if (bell.told) {
    const fresh = bell.items.filter(i => !bell.told.has(i.k) && new Date(i.at).getTime() > seenAt());
    fresh.slice(0, 3).forEach(i => { play('click'); try { if ('Notification' in window && Notification.permission === 'granted') { const n = new Notification(i.icon + ' ' + i.title, { body: i.text, icon: 'assets/logo-sm.webp', tag: i.k }); n.onclick = () => { focus(); location.hash = i.href; n.close(); }; } } catch (_) {} });
  }
  bell.told = new Set(bell.items.map(i => i.k));
  bellBadge();
}
// новое сообщение в открытом чате — сразу проверить, не ответ ли это мне
window.MH_BELL = { chat: m => { if (bell.uid && m.profile_id !== bell.uid && REPLY_RE.test(m.body || '')) bellLoad(); }, refresh: () => bellLoad() };
function bellBadge() {
  const n = bell.items.filter(i => new Date(i.at).getTime() > seenAt()).length, el = document.querySelector('#bellBtn .bell-n');
  if (!el) return; el.hidden = !n; el.textContent = n > 9 ? '9+' : n;
  document.getElementById('bellBtn').classList.toggle('has', !!n);
}
function bellOpen(btn) {
  const old = document.querySelector('.bell-pop'); if (old) { old.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
  const seen = seenAt();
  const pop = document.createElement('div'); pop.className = 'bell-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Уведомления');
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  pop.innerHTML = `<div class="bell-h"><b>Уведомления</b>${perm === 'default' ? '<button type="button" class="ch-link" id="bellPerm">Включить всплывающие</button>' : perm === 'granted' ? '<small>Всплывающие включены</small>' : ''}</div>
    <div class="bell-l">${bell.items.length ? bell.items.map(i => `<a href="${i.href}" class="bell-i k-${i.kind}${new Date(i.at).getTime() > seen ? ' new' : ''}"><span class="bell-ic">${i.icon}</span><span><b>${esc(i.title)}</b>${i.text ? `<small>${esc(i.text)}</small>` : ''}<time>${chatTime(i.at)}</time></span></a>`).join('') : '<p class="muted bell-empty">Пока пусто. Сюда придут решения мастеров по квенте, ответы тебе в чате и комментарии к твоим артам.</p>'}</div>
    <div class="bell-f">Решения по квенте бот также присылает в личку Discord.</div>`;
  document.body.append(pop); btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  pop.style.top = r.bottom + 10 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right - 8) + 'px';
  try { localStorage.setItem(BELL_SEEN, String(Date.now())); } catch (_) {}
  setTimeout(bellBadge, 0);
  const pb = pop.querySelector('#bellPerm'); if (pb) pb.onclick = async () => { try { await Notification.requestPermission(); } catch (_) {} pop.remove(); bellOpen(btn); };
  const shut = () => { pop.remove(); btn.setAttribute('aria-expanded', 'false'); removeEventListener('pointerdown', close, true); };
  const close = e => { if (pop.contains(e.target) || btn.contains(e.target)) return; shut(); };
  pop.addEventListener('click', e => { if (e.target.closest('a')) setTimeout(shut, 0); });
  setTimeout(() => addEventListener('pointerdown', close, true), 0);
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
  if (!rs) rsEl.innerHTML = '';
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
// opts.dock — чат в плавающем облачке: живёт между страницами; opts.active() — открыто ли облачко; opts.onNew(msg) — новое сообщение
/* ---------- смайлики: общий выбор для чата, реакций и витрины ---------- */
const EMOJI = [
  ['Лица', '😀 😄 😁 😂 🤣 😊 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😏 🤔 🤨 😐 😶 🙄 😬 😴 😮 😯 😲 😳 🥺 😢 😭 😤 😠 😡 🤬 😱 😨 😰 🤯 🤪 😜 😇 🤗 🤭 🫡 🤫 😈 👿 💀 👻 🤡 🤖'],
  ['Жесты', '👍 👎 👌 ✌️ 🤞 🤝 👏 🙌 🙏 💪 👋 🫶 ✊ 👊 🖐️ ☝️ 👀 🫠'],
  ['Сердца', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💯 ✨ ⭐ 🌟 🔥 💥 💫'],
  ['Город', '⚙️ 🔩 🔧 🛠️ ⚒️ ⚔️ 🗡️ 🛡️ 🏹 🔫 💣 🧪 ⚗️ 💎 🪙 💰 📜 🗝️ 🕯️ 🎲 🍺 🍷 🥖 🍖 🚂 🏭 🌫️ 🌙 ☠️ 🩸 🌿 🍄'],
  ['Дома', '🟡 🔴 👑 🏛️ ⚖️ 🗳️ 📯 🎭']
];
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥', '⚙️', '⚔️'];
function emojiPicker(anchor, onPick, quick) {
  qa('.emo-pop').forEach(p => p.remove());
  const pop = document.createElement('div'); pop.className = 'emo-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Смайлики');
  pop.innerHTML = (quick ? `<div class="emo-quick">${QUICK.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>` : '')
    + EMOJI.map(([t, s]) => `<div class="emo-k">${t}</div><div class="emo-grid">${s.split(' ').map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`).join('');
  document.body.append(pop);
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  pop.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(innerHeight - h - 8, r.bottom + 8)) + 'px';
  const close = () => { pop.remove(); removeEventListener('pointerdown', out, true); removeEventListener('keydown', esc_); };
  const out = e => { if (!pop.contains(e.target) && e.target !== anchor) close(); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  pop.addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { onPick(b.dataset.e); if (quick) close(); } });
  setTimeout(() => { addEventListener('pointerdown', out, true); addEventListener('keydown', esc_); }, 0);
  return pop;
}
// ответ как в Discord: первая строка-цитата со ссылкой на сообщение. Её же видят в канале Discord.
const SITE_URL = (CFG.siteUrl || 'https://nacsu0102.github.io/mettenheim/').replace(/#.*$/, '');
const REPLY_RE = /^> ↪ \[([^\]]*)\]\([^)\s]*#chat-d(\d+)\):? ?([^\n]*)\n?/;
const splitReply = body => { const m = REPLY_RE.exec(body || ''); return m ? { name: m[1], did: m[2], quote: m[3], rest: (body || '').slice(m[0].length) } : { rest: body || '' }; };
const replyLine = m => { const rp = splitReply(m.body); const cut = rp.rest.replace(/\s+/g, ' ').replace(/[[\]()<>*_`|~]/g, '').trim(); return `> ↪ [${String(m.author || 'Житель').replace(/[[\]]/g, '')}](${SITE_URL}#chat-d${m.discord_id}): ${cut.length > 70 ? cut.slice(0, 70) + '…' : cut || '📎 вложение'}\n`; };
async function chatPage(el, opts = {}) {
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
  const me = sess ? sess.user.id : null;
  const staff = prof && ['master', 'admin'].includes(prof.role);
  const msgs = new Map(), reacts = new Map();
  let reactOk = true, replyTo = null;
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const myDids = () => new Set([...msgs.values()].filter(m => me && m.profile_id === me && m.discord_id).map(m => m.discord_id));
  function reactRow(m) {
    const r = reacts.get(m.id); if (!r) return '';
    const list = [...r].filter(([, s]) => s.size); if (!list.length) return '';
    return `<div class="ch-reacts">${list.map(([e, s]) => `<button type="button" class="ch-rc${me && s.has(me) ? ' on' : ''}" data-rc="${m.id}" data-e="${esc(e)}" title="${s.size === 1 ? '1 реакция' : s.size + ' реакций'}"${me ? '' : ' disabled'}>${esc(e)}<b>${s.size}</b></button>`).join('')}${me ? `<button type="button" class="ch-rc add" data-react="${m.id}" title="Добавить реакцию" aria-label="Добавить реакцию">+</button>` : ''}</div>`;
  }
  function draw(stick) {
    const list = [...msgs.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    if (!list.length) { log.innerHTML = '<p class="muted ch-note">Пока тихо. Напиши первым — сообщение появится и в Discord.</p>'; return; }
    const keep = stick || atBottom(), mine = myDids();
    let prev = null;
    log.innerHTML = list.map(m => {
      const rp = splitReply(m.body);
      const cont = !rp.did && prev && prev.author === m.author && prev.source === m.source && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
      const ping = rp.did && mine.has(rp.did) && m.profile_id !== me;
      prev = m;
      const att = (m.attachments || []).map(a => a.image ? `<a href="${esc(a.url)}" target="_blank" rel="noopener"><img class="ch-img" src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy"></a>` : `<a class="ch-file" href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a>`).join('');
      const tools = (me ? `${reactOk ? `<button type="button" data-react="${m.id}" title="Реакция" aria-label="Поставить реакцию">😊</button>` : ''}${m.discord_id ? `<button type="button" data-reply="${m.id}" title="Ответить" aria-label="Ответить">↩</button>` : ''}` : '') + (staff ? `<button type="button" class="ch-del" data-del="${m.id}" title="Удалить сообщение" aria-label="Удалить сообщение">✕</button>` : '');
      return `<div class="ch-msg${cont ? ' cont' : ''}${m.profile_id && m.profile_id === me ? ' mine' : ''}${ping ? ' ping' : ''}${rp.did ? ' is-reply' : ''}" data-id="${m.id}" data-did="${esc(m.discord_id || '')}">
        ${rp.did ? `<button type="button" class="ch-ref" data-goto="${rp.did}"><i aria-hidden="true"></i><b>${esc(rp.name)}</b><span>${esc(rp.quote)}</span></button>` : ''}
        ${cont ? '<span class="ch-ava-sp"></span>' : (m.avatar ? `<img class="ch-ava" src="${esc(m.avatar)}" alt="" loading="lazy">` : `<span class="ch-ava cab-ava-empty">${esc((m.author || '?').slice(0, 1).toUpperCase())}</span>`)}
        <div class="ch-body">${cont ? '' : `<div class="ch-meta"><b>${esc(m.author || 'Без имени')}</b><span class="ch-src ${m.source}">${m.source === 'site' ? 'сайт' : 'discord'}</span><time>${chatTime(m.created_at)}</time></div>`}
          ${rp.rest ? `<div class="ch-text">${chatText(rp.rest)}</div>` : ''}${att ? `<div class="ch-att">${att}</div>` : ''}${reactRow(m)}</div>
        ${tools ? `<div class="ch-tools">${tools}</div>` : ''}</div>`;
    }).join('');
    if (keep) log.scrollTop = log.scrollHeight;
  }
  const add = rows => rows.forEach(r => msgs.set(r.id, r));
  const putReact = (r, on) => { let mm = reacts.get(r.message_id); if (!mm) reacts.set(r.message_id, mm = new Map()); let s = mm.get(r.emoji); if (!s) mm.set(r.emoji, s = new Set()); on ? s.add(r.profile_id) : s.delete(r.profile_id); };
  try {
    const r = await c.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(80);
    if (r.error) throw r.error;
    add(r.data || []);
  } catch (e) { log.innerHTML = `<p class="muted ch-note">Чат пока не подключён: ${esc(errText(e))}</p>`; return; }
  try {
    const ids = [...msgs.keys()];
    const r = ids.length ? await c.from('chat_reactions').select('message_id,profile_id,emoji').in('message_id', ids) : { data: [] };
    if (r.error) reactOk = false; else (r.data || []).forEach(x => putReact(x, true));
  } catch (_) { reactOk = false; }
  draw(true);
  const goto = did => {
    const t = q(`.ch-msg[data-did="${CSS.escape(did)}"]`, log);
    if (!t) { toast(el, 'Это сообщение старше загруженных', true); return; }
    t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
  };
  const hm = /#chat-d(\d+)/.exec(location.hash); if (hm) setTimeout(() => goto(hm[1]), 300);
  // мгновенно: новые строки из базы и реакции
  const rt = c.channel('mh-chat-' + Math.random().toString(36).slice(2)).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, p => {
    if (p.eventType === 'DELETE') { msgs.delete(p.old.id); draw(); return; }
    if (p.new && p.new.id) { const mine = atBottom(); msgs.set(p.new.id, p.new); draw(mine); if (p.new.source === 'discord') play('click'); if (p.eventType === 'INSERT' && opts.onNew) opts.onNew(p.new); if (p.eventType === 'INSERT' && window.MH_BELL) window.MH_BELL.chat(p.new); }
  }).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, p => {
    const row = p.eventType === 'DELETE' ? p.old : p.new; if (!row || !msgs.has(row.message_id)) return;
    putReact(row, p.eventType !== 'DELETE'); draw();
  }).subscribe();
  // забираем новое из Discord, пока страница открыта (в облачке — пока оно развёрнуто)
  const sync = () => { if (document.hidden || (opts.active && !opts.active())) return; fetch(fnUrl('chat=sync'), { headers: { Authorization: 'Bearer ' + CFG.anonKey, apikey: CFG.anonKey } }).catch(() => {}); };
  sync(); const timer = setInterval(sync, 4000);
  const stop = () => { clearInterval(timer); try { c.removeChannel(rt); } catch (_) {} window.removeEventListener('hashchange', stop); };
  if (!opts.dock) window.addEventListener('hashchange', stop);

  async function toggleReact(id, e) {
    if (!me) return;
    const s = reacts.get(id)?.get(e), had = !!(s && s.has(me));
    putReact({ message_id: id, profile_id: me, emoji: e }, !had); draw();
    const r = had ? await c.from('chat_reactions').delete().eq('message_id', id).eq('profile_id', me).eq('emoji', e)
      : await c.from('chat_reactions').insert({ message_id: id, profile_id: me, emoji: e });
    if (r.error) { putReact({ message_id: id, profile_id: me, emoji: e }, had); draw(); toast(el, 'Реакция не сохранилась: ' + errText(r.error), true); }
  }
  log.addEventListener('click', async ev => {
    const g = ev.target.closest('[data-goto]'); if (g) { goto(g.dataset.goto); return; }
    const rc = ev.target.closest('[data-rc]'); if (rc) { toggleReact(+rc.dataset.rc, rc.dataset.e); return; }
    const ra = ev.target.closest('[data-react]'); if (ra) { emojiPicker(ra, e => toggleReact(+ra.dataset.react, e), true); return; }
    const rp = ev.target.closest('[data-reply]'); if (rp) { setReply(msgs.get(+rp.dataset.reply)); return; }
    const b = ev.target.closest('[data-del]'); if (!b || !staff) return;
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
  foot.innerHTML = `<div class="ch-replybar" id="chReply" hidden></div><form class="ch-form" id="chForm">${avaOf(prof) ? `<img class="ch-ava" src="${esc(avaOf(prof))}" alt="">` : ''}<div class="ch-in"><textarea id="chIn" rows="1" maxlength="1500" placeholder="Сообщение в общий чат… Enter — отправить, Shift+Enter — новая строка" aria-label="Сообщение"></textarea><button type="button" class="ch-emo-btn" id="chEmo" title="Смайлики" aria-label="Смайлики">😊</button></div><button class="btn small" type="submit">Отправить</button></form>`;
  const form = q('#chForm', el), inp = q('#chIn', el), bar = q('#chReply', el);
  function setReply(m) {
    replyTo = m && m.discord_id ? m : null;
    if (!replyTo) { bar.hidden = true; bar.innerHTML = ''; return; }
    const rp = splitReply(m.body);
    bar.innerHTML = `<span>↩ Ответ <b>${esc(m.author || 'Житель')}</b>: ${esc(rp.rest.replace(/\s+/g, ' ').slice(0, 80)) || '📎 вложение'}</span><button type="button" aria-label="Отменить ответ" title="Отменить ответ">✕</button>`;
    bar.hidden = false; q('button', bar).onclick = () => setReply(null); inp.focus();
  }
  const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(160, inp.scrollHeight) + 'px'; };
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } if (e.key === 'Escape' && replyTo) setReply(null); });
  q('#chEmo', el).onclick = e => emojiPicker(e.currentTarget, em => { const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a; inp.value = inp.value.slice(0, a) + em + inp.value.slice(b); inp.selectionStart = inp.selectionEnd = a + em.length; inp.focus(); grow(); });
  form.onsubmit = async ev => {
    ev.preventDefault();
    let text = inp.value.trim(); if (!text) return;
    if (replyTo) text = (replyLine(replyTo) + text).slice(0, 1500);
    const btn = q('button[type=submit]', form); btn.disabled = true;
    try {
      const s = await api().session();
      const r = await fetch(fnUrl('chat=send'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: CFG.anonKey }, body: JSON.stringify({ text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Сообщение не ушло');
      inp.value = ''; grow(); setReply(null); play('click');
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
// Пустые блоки главной не показываем: секция появляется, когда в ней есть что показать
const hideSec = (node, hide) => { const s = node && node.closest('section'); if (s) s.hidden = hide; };
async function liveBlock(el) {
  if (!el) return;
  if (!liveOk()) { el.innerHTML = ''; [el, q('#fxMount'), q('#evMount')].forEach(x => hideSec(x, true)); return; }
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
    // Счётчик-одометр: барабаны цифр, ведущие нули приглушены
    const odo = n => { const s = String(Math.max(0, n | 0)).padStart(4, '0'), f = s.search(/[1-9]/); return s.split('').map((c, i) => `<i${f < 0 ? (i < s.length - 1 ? ' class="z"' : '') : i < f ? ' class="z"' : ''}>${c}</i>`).join(''); };
    const lead = t > d ? 't' : d > t ? 'd' : '', diff = Math.abs(t - d), HS = (window.M && M.houses) || {};
    const fxEl = q('#fxMount'); if (fxEl) fxEl.innerHTML = `<div class="panel fx-board fx2 ${lead ? 'lead-' + lead : 'even'}"><div class="eyebrow">Счёт Домов · общий пул очков фракции</div>
      <div class="fx-h t">${HS.talbot ? `<img class="fx-flag" src="${HS.talbot.flag}" alt="">` : ''}<small>Жёлтые</small><b>Дом Талбот</b><span class="fx-n fx-odo" aria-label="${t} очков">${odo(t)}</span></div>
      <div class="fx-gauge" role="img" aria-label="Перевес: ${sum ? (t > d ? 'Талбот' : d > t ? 'Дорн' : 'равенство') : 'пока равенство'}"><span class="fx-steam" aria-hidden="true"></span><div class="fx-needle" style="--fx-a:${((50 - pt) / 50 * -110).toFixed(1)}deg"></div><b>Перевес</b></div>
      <div class="fx-h d">${HS.dorn ? `<img class="fx-flag" src="${HS.dorn.flag}" alt="">` : ''}<small>Красные</small><b>Дом Дорн</b><span class="fx-n fx-odo" aria-label="${d} очков">${odo(d)}</span></div>
      <div class="fx-vs"><span class="fx-plate">${sum ? (lead === 't' ? `◀ Жёлтые впереди на ${diff}` : lead === 'd' ? `Красные впереди на ${diff} ▶` : 'Равновесие') : 'Сезон открыт — первые очки решат перевес'}</span></div>
      <div class="fx-tube"><div class="fx-bar" role="img" aria-label="Талбот ${t}, Дорн ${d}"><i class="t" style="width:${pt}%"></i><i class="d" style="width:${100 - pt}%"></i></div><i class="fx-mid" aria-hidden="true"></i></div>
      <p class="muted">Очки приносят ивенты, задания и победы в сюжете. Уровни пула открывают Дому бонусы — подробнее в главе <a href="#factions">Фракции</a>.</p></div>`;
    hideSec(fxEl, false);
    const news = (nw.data || []).filter(n => n.body || (n.images || []).length), evs = (ev.data || []).filter(e => e.status !== 3 && e.status !== 4);
    const posts = (ep.data || []).filter(n => n.body || (n.images || []).length);
    const evEl = q('#evMount');
    if (evEl) evEl.innerHTML = `<div class="live-head"><div class="eyebrow">Ивенты и мероприятия</div><h2>События</h2><a class="btn small ghost" href="#news">Все события</a></div>
      ${evs.length ? `<div class="ev-list wide">${evs.map(eventCard).join('')}</div>` : ''}
      ${posts.length ? `<div class="nw-list ev-posts">${posts.map(n => newsCard(n, false)).join('')}</div>` : ''}
`;
    hideSec(evEl, !evs.length && !posts.length);
    el.innerHTML = news.length ? `<div class="live-grid solo"><div><div class="live-head"><div class="eyebrow">Хроники Меттенхейма</div><h2>Новости и анонсы</h2><a class="btn small ghost" href="#news">Все новости</a></div>
        <div class="nw-list">${news.map(n => newsCard(n, false)).join('')}</div></div></div>` : '';
    hideSec(el, !news.length);
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

/* ---------- Общий чат в облачке справа: открыть, свернуть, счётчик новых ---------- */
function chatDock() {
  if (document.querySelector('.chd-fab')) return;
  const KEY = 'mh-chat-dock';
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'chd-fab'; fab.setAttribute('aria-label', 'Общий чат'); fab.setAttribute('aria-expanded', 'false'); fab.title = 'Общий чат — сайт и Discord';
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg><span class="chd-badge" hidden></span>';
  const panel = document.createElement('section');
  panel.className = 'chd-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Общий чат');
  panel.innerHTML = `<header class="chd-head"><b>Общий чат<small>Сайт и Discord — одна лента</small></b><a href="#chat" title="Открыть на всю страницу">⤢</a><button type="button" class="chd-x" aria-label="Свернуть чат">Скрыть</button></header><div class="chd-body"></div>`;
  document.body.append(panel, fab);
  const badge = q('.chd-badge', fab), body = q('.chd-body', panel);
  let mounted = false, unread = 0;
  const isOpen = () => !panel.hidden;
  const setBadge = () => { badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : unread; };
  const open = v => {
    panel.hidden = !v; fab.setAttribute('aria-expanded', String(v));
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {}
    if (v) { unread = 0; setBadge(); if (!mounted) { mounted = true; chatPage(body, { dock: true, active: isOpen, onNew: m => { if (!isOpen() && m.source === 'discord') { unread++; setBadge(); } } }); } }
  };
  fab.onclick = () => open(!isOpen());
  q('.chd-x', panel).onclick = () => open(false);
  q('a', panel).onclick = () => open(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) open(false); });
  // кнопка «Чат» в шапке открывает облачко вместо отдельной страницы
  const hb = document.getElementById('chatBtn');
  if (hb) hb.addEventListener('click', e => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); open(!isOpen()); });
  // на странице чата облачко не нужно — там чат во весь экран
  const onRoute = () => { const full = location.hash.replace('#', '').split('?')[0] === 'chat'; fab.hidden = full; if (full) open(false); };
  window.addEventListener('hashchange', onRoute); onRoute();
  try { if (localStorage.getItem(KEY) === '1' && !fab.hidden) open(true); } catch (_) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chatDock); else chatDock();

/* ---------- витрина артов: игроки выкладывают арты, ставят лайки, комментируют ---------- */
const GAL_DEMO = [
  ['Меттенхейм на рассвете', 'assets/codex/city-v2.webp', 'Эльза Вермеер', 'talbot', 'Вид с крыши литейного цеха. Писала по памяти после ночной смены.', 24],
  ['Мастерская Инженера', 'assets/classes/scene-engineer.webp', 'Ингрид Штоль', 'dorn', 'Мой верстак — со всеми его шрамами.', 17],
  ['Плетение у котлов', 'assets/classes/scene-mage.webp', 'Лиара Тенн', 'talbot', 'Первое заклинание моего мага, нарисовала к квенте.', 31],
  ['Тень на складах', 'assets/classes/scene-rogue.webp', 'Кассиан Мор', 'dorn', '', 12],
  ['Архив Коллегии', 'assets/codex/archive.webp', 'Ансельм Грей', '', 'Скетч к ивенту в архиве.', 8],
  ['Стрелок дозора', 'assets/classes/scene-shooter.webp', 'Ансельм Грей', 'talbot', 'Портрет персонажа — коммишн у друга.', 19],
  ['Литейщик', 'assets/classes/scene-fighter.webp', 'Брандт Кессель', 'dorn', 'Перед боем на заводском ринге.', 22],
  ['Вера Столпов', 'assets/codex/faith.webp', 'Вира Сольт', '', '', 6]
].map(([title, image_url, author, house, body, likes], i) => ({ id: -1 - i, title, image_url, author, house, body, likes, comments: i % 3 ? 0 : 2, created_at: new Date(Date.now() - i * 864e5 * 1.7).toISOString(), demo: true }));
const HOUSE_TAG = { talbot: '🟡 Жёлтые', dorn: '🔴 Красные' };
async function shrinkImage(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не удалось открыть картинку')); i.src = URL.createObjectURL(file); });
  let max = 2000, q = .86, blob = null;
  for (let k = 0; k < 5; k++) {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    blob = await new Promise(r => cv.toBlob(r, 'image/webp', q));
    if (!blob) blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    if (blob.size < 2.6e6) break;
    max *= .8; q -= .06;
  }
  URL.revokeObjectURL(img.src);
  return blob;
}
async function galleryPage(el, openId) {
  if (!el) return;
  const live = liveSite();
  let c = null, sess = null, prof = null, me = null, staff = false;
  let arts = [], liked = new Set(), demo = !live;
  const f = { house: '', sort: 'new' };
  if (live) {
    c = await sb();
    try { sess = await api().session(); if (sess) { me = sess.user.id; prof = await api().myProfile(me); } } catch (_) {}
    staff = !!(prof && ['master', 'admin'].includes(prof.role));
  }
  el.innerHTML = `<div class="gl-bar panel"><div class="gl-chips" role="group" aria-label="Дом">${[['', 'Все'], ['talbot', '🟡 Жёлтые'], ['dorn', '🔴 Красные']].map(([k, t]) => `<button type="button" data-gh="${k}" aria-pressed="${k === ''}">${t}</button>`).join('')}</div>
    <div class="gl-chips" role="group" aria-label="Порядок">${[['new', 'Новые'], ['top', 'Любимые']].map(([k, t]) => `<button type="button" data-gs="${k}" aria-pressed="${k === 'new'}">${t}</button>`).join('')}</div>
    <span class="gl-count muted"></span><button type="button" class="btn small" id="glAdd">＋ Выложить арт</button></div>
    <p class="gl-note" hidden></p><div class="gl-grid" id="glGrid"><p class="muted">Загружаю витрину…</p></div><p class="cab-toast" role="status" aria-live="polite"></p>`;
  const grid = q('#glGrid', el), note = q('.gl-note', el);
  async function load() {
    if (!live) { arts = GAL_DEMO; return; }
    const r = await c.from('gallery_arts').select('*').order('created_at', { ascending: false }).limit(300);
    if (r.error) { demo = true; arts = GAL_DEMO; return; }
    demo = false; arts = r.data || [];
    if (me && arts.length) { const l = await c.from('gallery_likes').select('art_id').eq('profile_id', me); liked = new Set((l.data || []).map(x => x.art_id)); }
  }
  function draw() {
    let list = arts.filter(a => !f.house || a.house === f.house);
    if (f.sort === 'top') list = [...list].sort((a, b) => b.likes - a.likes || new Date(b.created_at) - new Date(a.created_at));
    note.hidden = !demo;
    note.innerHTML = demo ? (live ? '🛠️ Витрина откроется, когда мастера включат её в базе. Пока — образцы, чтобы было видно, как это будет.' : 'Это предпросмотр: здесь образцы. Выкладывать арты, ставить лайки и писать комментарии можно на основном сайте.') : '';
    q('.gl-count', el).textContent = demo ? '' : `Артов: ${list.length}`;
    grid.innerHTML = list.length ? list.map(a => `<figure class="gl-card${a.demo ? ' demo' : ''}" data-open="${a.id}" tabindex="0" role="button" aria-label="Открыть арт «${esc(a.title)}»">
      <img src="${esc(a.image_url)}" alt="${esc(a.title)}" loading="lazy">${a.house ? `<span class="gl-house h-${a.house}">${HOUSE_TAG[a.house]}</span>` : ''}
      <figcaption><b>${esc(a.title)}</b><span class="gl-by">${esc(a.author || 'Житель')}</span><span class="gl-stats"><button type="button" class="gl-like${liked.has(a.id) ? ' on' : ''}" data-like="${a.id}" aria-pressed="${liked.has(a.id)}" aria-label="Нравится">♥ <i>${a.likes || 0}</i></button><span>💬 ${a.comments || 0}</span></span></figcaption></figure>`).join('')
      : `<article class="panel cab-empty"><h3>${f.house ? 'У этого Дома пока нет артов' : 'Витрина пуста'}</h3><p class="muted">Выложи первый — портрет персонажа, сцену с ивента или скетч города.</p></article>`;
  }
  async function like(id) {
    const a = arts.find(x => x.id === id); if (!a) return;
    if (a.demo) { a.likes += liked.has(id) ? -1 : 1; liked.has(id) ? liked.delete(id) : liked.add(id); draw(); return; }
    if (!me) { toast(el, 'Войди через Discord, чтобы ставить лайки', true); return; }
    const on = !liked.has(id);
    on ? liked.add(id) : liked.delete(id); a.likes += on ? 1 : -1; draw(); refreshBox(a);
    const r = on ? await c.from('gallery_likes').insert({ art_id: id, profile_id: me }) : await c.from('gallery_likes').delete().eq('art_id', id).eq('profile_id', me);
    if (r.error) { on ? liked.delete(id) : liked.add(id); a.likes += on ? -1 : 1; draw(); refreshBox(a); toast(el, errText(r.error), true); }
  }
  let box = null;
  function refreshBox(a) { if (!box || +box.dataset.id !== a.id) return; const b = q('.gb-like', box); b.classList.toggle('on', liked.has(a.id)); b.setAttribute('aria-pressed', liked.has(a.id)); q('i', b).textContent = a.likes; }
  async function open(id) {
    const a = arts.find(x => x.id === id); if (!a) return;
    if (box) box.remove();
    box = document.createElement('div'); box.className = 'gl-box'; box.dataset.id = a.id; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', a.title);
    const mine = me && a.owner === me;
    box.innerHTML = `<div class="gb-in"><button type="button" class="gb-x" aria-label="Закрыть">✕</button>
      <div class="gb-pic"><img src="${esc(a.image_url)}" alt="${esc(a.title)}"></div>
      <aside class="gb-side"><div class="gb-head">${a.avatar ? `<img class="ch-ava" src="${esc(a.avatar)}" alt="">` : `<span class="ch-ava cab-ava-empty">${esc((a.author || '?').slice(0, 1))}</span>`}<div><b>${esc(a.author || 'Житель')}</b><small>${newsDate(a.created_at)}${a.house ? ' · ' + HOUSE_TAG[a.house] : ''}</small></div></div>
        <h3>${esc(a.title)}</h3>${a.body ? `<p class="gb-body">${esc(a.body).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="gb-acts"><button type="button" class="gb-like gl-like${liked.has(a.id) ? ' on' : ''}" aria-pressed="${liked.has(a.id)}">♥ <i>${a.likes || 0}</i> <span>Нравится</span></button><a class="btn small ghost" href="${esc(a.image_url)}" target="_blank" rel="noopener">Оригинал</a>${(mine || staff) && !a.demo ? '<button type="button" class="btn small ghost gb-del">Удалить</button>' : ''}</div>
        <div class="gb-k">Комментарии</div><div class="gb-cm"><p class="muted">Загружаю…</p></div>
        ${me && !a.demo ? `<form class="gb-form"><div class="ch-in"><textarea rows="2" maxlength="500" placeholder="Что скажешь об арте?" aria-label="Комментарий"></textarea><button type="button" class="ch-emo-btn" title="Смайлики" aria-label="Смайлики">😊</button></div><button class="btn small" type="submit">Отправить</button></form>` : `<p class="muted gb-login">${a.demo ? 'Это образец — комментарии появятся у настоящих артов.' : 'Войди через Discord, чтобы комментировать.'}</p>`}
      </aside></div>`;
    document.body.append(box); document.body.classList.add('gl-lock');
    const close = () => { box.remove(); box = null; document.body.classList.remove('gl-lock'); removeEventListener('keydown', key); if (/^#gallery-/.test(location.hash)) history.replaceState(null, '', '#gallery'); };
    const key = e => { if (e.key === 'Escape' && !q('.emo-pop')) close(); };
    addEventListener('keydown', key);
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.gb-x')) close(); });
    q('.gb-like', box).onclick = () => like(a.id);
    const del = q('.gb-del', box);
    if (del) del.onclick = async () => {
      if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = 'Точно удалить?'; return; }
      const r = await c.from('gallery_arts').delete().eq('id', a.id);
      if (r.error) { toast(el, errText(r.error), true); return; }
      if (a.path) c.storage.from('gallery').remove([a.path]).catch(() => {});
      arts = arts.filter(x => x.id !== a.id); close(); draw();
    };
    const cmEl = q('.gb-cm', box);
    const paintCm = list => { cmEl.innerHTML = list.length ? list.map(x => `<div class="gb-c"><b>${esc(x.author)}</b><time>${chatTime(x.created_at)}</time>${me && (x.owner === me || staff) && x.id > 0 ? `<button type="button" class="gb-cdel" data-cdel="${x.id}" aria-label="Удалить комментарий">✕</button>` : ''}<p>${chatText(x.body)}</p></div>`).join('') : '<p class="muted">Пока никто не написал. Будь первым.</p>'; };
    let cms = [];
    if (a.demo) { cms = a.comments ? [{ id: -1, author: 'Корвин Хальд', body: 'Вот это свет! ⚙️🔥', created_at: a.created_at }, { id: -2, author: 'Вира Сольт', body: 'Хочу такое в свой кабинет 😍', created_at: a.created_at }] : []; paintCm(cms); }
    else { const r = await c.from('gallery_comments').select('*').eq('art_id', a.id).order('created_at', { ascending: true }).limit(200); cms = r.data || []; paintCm(cms); }
    cmEl.addEventListener('click', async e => {
      const b = e.target.closest('[data-cdel]'); if (!b) return;
      const r = await c.from('gallery_comments').delete().eq('id', +b.dataset.cdel);
      if (r.error) { toast(el, errText(r.error), true); return; }
      cms = cms.filter(x => x.id !== +b.dataset.cdel); a.comments = cms.length; paintCm(cms); draw();
    });
    const form = q('.gb-form', box);
    if (form) {
      const ta = q('textarea', form);
      q('.ch-emo-btn', form).onclick = e => emojiPicker(e.currentTarget, em => { const s = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, s) + em + ta.value.slice(ta.selectionEnd ?? s); ta.selectionStart = ta.selectionEnd = s + em.length; ta.focus(); });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      form.onsubmit = async e => {
        e.preventDefault(); const body = ta.value.trim(); if (!body) return;
        const btn = q('button[type=submit]', form); btn.disabled = true;
        const r = await c.from('gallery_comments').insert({ art_id: a.id, body }).select().single();
        btn.disabled = false;
        if (r.error) { toast(el, errText(r.error), true); return; }
        ta.value = ''; cms.push(r.data); a.comments = cms.length; paintCm(cms); cmEl.scrollTop = cmEl.scrollHeight; draw(); play('click');
      };
    }
    q('.gb-x', box).focus();
  }
  function upload() {
    if (!live) { toast(el, 'Выкладывать арты можно на основном сайте', true); return; }
    if (!me) { try { sessionStorage.setItem(AFTER_KEY, 'gallery'); } catch (_) {} api().signInDiscord().catch(e => toast(el, errText(e), true)); return; }
    if (demo) { toast(el, 'Витрина ещё не включена в базе — мастера скоро её откроют', true); return; }
    const m = document.createElement('div'); m.className = 'gl-box'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Выложить арт');
    m.innerHTML = `<form class="gb-up panel"><button type="button" class="gb-x" aria-label="Закрыть">✕</button><div class="eyebrow">Витрина артов</div><h3>Выложить арт</h3>
      <label class="gu-drop"><input type="file" accept="image/jpeg,image/png,image/webp" required><span class="gu-hint">Перетащи картинку сюда или нажми, чтобы выбрать<br><small>JPG, PNG или WEBP · большие картинки сожмём сами</small></span><img class="gu-prev" alt="" hidden></label>
      <label>Название<input type="text" name="title" maxlength="80" required placeholder="Например: «Эльза у котлов»"></label>
      <label>Пара слов об арте<textarea name="body" rows="3" maxlength="600" placeholder="Кто на арте, кто автор, к какому ивенту…"></textarea></label>
      <label>Дом<select name="house"><option value="">Без Дома</option><option value="talbot">🟡 Жёлтые — Дом Талбот</option><option value="dorn">🔴 Красные — Дом Дорн</option></select></label>
      <p class="muted gu-rule">Выкладывай свои работы или указывай автора. Без 18+ и без чужих артов без спроса — мастера удаляют такое.</p>
      <div class="cab-acts"><button class="btn" type="submit">Выложить</button><button type="button" class="btn ghost gb-cancel">Отмена</button></div><p class="cab-toast" role="status"></p></form>`;
    document.body.append(m); document.body.classList.add('gl-lock');
    const close = () => { m.remove(); document.body.classList.remove('gl-lock'); };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('.gb-x,.gb-cancel')) close(); });
    const form = q('form', m), fi = q('input[type=file]', m), prev = q('.gu-prev', m), drop = q('.gu-drop', m);
    let file = null;
    const pick = fl => { if (!fl || !/^image\//.test(fl.type)) return; file = fl; prev.src = URL.createObjectURL(fl); prev.hidden = false; q('.gu-hint', m).hidden = true; if (!form.title.value) form.title.value = fl.name.replace(/\.[^.]+$/, '').slice(0, 80); };
    fi.onchange = () => pick(fi.files[0]);
    ['dragover', 'dragenter'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
    form.onsubmit = async e => {
      e.preventDefault(); if (!file) { toast(m, 'Выбери картинку', true); return; }
      const btn = q('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Загружаю…';
      try {
        const blob = await shrinkImage(file);
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg', path = `${me}/${Date.now()}.${ext}`;
        const up = await c.storage.from('gallery').upload(path, blob, { contentType: blob.type, upsert: false });
        if (up.error) throw up.error;
        const url = c.storage.from('gallery').getPublicUrl(path).data.publicUrl;
        const r = await c.from('gallery_arts').insert({ title: form.title.value.trim(), body: form.body.value.trim(), house: form.house.value, image_url: url, path }).select().single();
        if (r.error) { c.storage.from('gallery').remove([path]).catch(() => {}); throw r.error; }
        arts.unshift(r.data); close(); draw(); play('click'); toast(el, 'Арт на витрине!');
      } catch (er) { toast(m, errText(er), true); btn.disabled = false; btn.textContent = 'Выложить'; }
    };
  }
  el.addEventListener('click', e => {
    const lk = e.target.closest('[data-like]'); if (lk) { e.stopPropagation(); like(+lk.dataset.like); return; }
    const op = e.target.closest('[data-open]'); if (op) { open(+op.dataset.open); return; }
    const h = e.target.closest('[data-gh]'); if (h) { f.house = h.dataset.gh; qa('[data-gh]', el).forEach(b => b.setAttribute('aria-pressed', b === h)); draw(); return; }
    const s = e.target.closest('[data-gs]'); if (s) { f.sort = s.dataset.gs; qa('[data-gs]', el).forEach(b => b.setAttribute('aria-pressed', b === s)); draw(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-open]')) open(+e.target.dataset.open); });
  q('#glAdd', el).onclick = upload;
  if (live && !me) q('#glAdd', el).textContent = 'Войти и выложить арт';
  await load(); draw();
  if (openId) open(+openId);
}

window.Cabinet = { gallery: galleryPage, residentsData, mount, api: SupabaseApi, fillSlots, anketaStatus, initHeader, community, residentsPage, chat: chatPage, live: liveBlock, news: newsPage, hero: heroPage };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader); else setTimeout(initHeader, 0);
// после входа через Discord / почту вернуть игрока туда, откуда он пришёл
if (CFG.url && CFG.anonKey && /[?&](code|error_description)=/.test(location.search)) {
  let to = 'cabinet'; try { to = sessionStorage.getItem(AFTER_KEY) || 'cabinet'; sessionStorage.removeItem(AFTER_KEY); } catch (_) {}
  sb().then(c => c.auth.getSession()).finally(() => { history.replaceState(null, '', location.pathname + '#' + to); window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
})();
