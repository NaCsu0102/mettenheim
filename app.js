(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('mh2:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mh2:' + k, JSON.stringify(v)); } catch {} }
};
window.MH = { $, $$, esc, store };

/* ================= ЗВУК ================= */
// звук не качается, пока его не включили: музыка весит 7 МБ
const A = (src, vol, loop = false) => { const a = new Audio(); a.preload = 'none'; a.dataset.src = src; a.volume = vol; a.loop = loop; return a; };
const arm = a => { if (!a.src && a.dataset.src) { a.src = a.dataset.src; a.load(); } return a; };
const snd = {
  music: A('assets/audio/music-box.mp3', .16, true),
  gears: A('assets/audio/gears.mp3', 0, true),
  click: A('assets/audio/click.mp3', .45),
  card: A('assets/audio/card.mp3', .5),
  dice: A('assets/audio/dice.mp3', .6)
};
let soundOn = store.get('sound', null);
const soundBtn = $('#soundBtn');
const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function play(name) {
  if (!soundOn) return;
  const a = snd[name]; try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
}
function setSound(on, save = true) {
  soundOn = !!on; if (save) store.set('sound', soundOn);
  soundBtn.innerHTML = soundOn ? ICON_ON : ICON_OFF;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) { Object.values(snd).forEach(arm); const t = store.get('musicT', 0); if (t && !snd.music.currentTime) { try { snd.music.currentTime = t; } catch {} } snd.music.play().catch(() => {}); }
  else { snd.music.pause(); snd.gears.pause(); }
}
MH.play = play;
setInterval(() => { if (!snd.music.paused) store.set('musicT', snd.music.currentTime); }, 1500);
soundBtn.addEventListener('click', () => setSound(!soundOn));
if (soundOn === null) {
  const w = $('#welcome'); w.hidden = false;
  $('#wOn').onclick = () => { w.hidden = true; setSound(true); play('click'); };
  $('#wOff').onclick = () => { w.hidden = true; setSound(false); };
} else {
  setSound(false, false); soundOn = store.get('sound'); if (soundOn) Object.values(snd).forEach(arm);
  soundBtn.innerHTML = soundOn ? ICON_ON : ICON_OFF; soundBtn.setAttribute('aria-pressed', String(soundOn));
  // браузер запустит музыку только после первого касания
  const kick = () => { if (soundOn) snd.music.play().catch(() => {}); };
  addEventListener('pointerdown', kick, { once: true }); addEventListener('keydown', kick, { once: true });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-nosnd]')) return;
  if (e.target.closest('a,button,summary,select')) play('click');
});

/* ======= шестерни по краям: крутятся вместе со страницей и звучат ======= */
const gearsImgs = $$('.machinery img');
let lastY = scrollY, lastT = performance.now(), stopT, fadeI, raf = false;
function rotate() { gearsImgs.forEach((g, i) => g.style.setProperty('--rot', (scrollY * parseFloat(g.dataset.speed) + i * 17) + 'deg')); raf = false; }
function gearFade(target, ms) {
  clearInterval(fadeI); const a = snd.gears, from = a.volume, t0 = performance.now();
  fadeI = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = from + (target - from) * k; if (k >= 1) { clearInterval(fadeI); if (!target) a.pause(); } }, 16);
}
addEventListener('scroll', () => {
  if (!raf) { raf = true; requestAnimationFrame(rotate); }
  if (!soundOn) return;
  const now = performance.now(), sp = Math.min(1, Math.abs(scrollY - lastY) / Math.max(16, now - lastT) * 1.6);
  lastY = scrollY; lastT = now;
  if (sp < .02) return;
  snd.gears.playbackRate = .82 + sp * .3;
  if (snd.gears.paused) snd.gears.play().catch(() => {});
  gearFade(.12 + sp * .2, 70);
  clearTimeout(stopT); stopT = setTimeout(() => gearFade(0, 220), 140);
}, { passive: true });
rotate();

/* ================= ДОМ / ТЕМА ================= */
let house = store.get('house', 'talbot');
let houseHooks = [];
MH.onHouse = f => houseHooks.push(f);
function applyHouse(h, animate) {
  house = h === 'dorn' ? 'dorn' : 'talbot'; store.set('house', house);
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const s = $('#shift'); s.classList.remove('run'); void s.offsetWidth; s.classList.add('run');
    if (soundOn) { const g = snd.gears; g.currentTime = 0; g.volume = .35; g.playbackRate = 1; g.play().catch(() => {}); clearTimeout(stopT); stopT = setTimeout(() => gearFade(0, 300), 650); }
    setTimeout(() => setVars(), 260);
  } else setVars();
}
function setVars() {
  document.documentElement.dataset.house = house;
  $$('.house-gear').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === house)));
  $$('.side[data-side]').forEach(b => b.classList.toggle('on', b.dataset.side === house));
  $$('[data-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pick === house)));
  const st = $('#heroStatus'); if (st) st.textContent = 'Твоя сторона: ' + M.houses[house].name;
  houseHooks.forEach(f => { try { f(house); } catch (e) { console.warn(e); } });
}
MH.house = () => house;
$$('.house-gear').forEach(b => b.addEventListener('click', () => applyHouse(b.dataset.h, true)));
setVars();

/* ================= НАВИГАЦИЯ ================= */
/* Книга: части и главы. Порядок здесь задаёт оглавление и кнопки «Назад / Дальше». */
const BOOK = [
  ['Начало', [['start', 'Как начать играть'], ['faq', 'Частые вопросы'], ['modlist', 'Модлист'], ['news', 'Новости и события'], ['residents', 'Жители города'], ['chat', 'Общий чат'], ['glossary', 'Словарь терминов']]],
  ['Правила', [['rules', 'Правила сервера'], ['discord', 'Правила Discord']]],
  ['Мир', [['city', 'Меттенхейм'], ['history', 'История города'], ['houses', 'Дома Талбот и Дорн'], ['lumerite', 'Люмерит'], ['faith', 'Вера'], ['magic', 'Магия'], ['world', 'История мира'], ['chronicle', 'Хроника сессии'], ['deck', 'Проклятая колода']]],
  ['Народы', [['races', 'Народы и отношения'], ...M.peoples.map(p => ['people-' + p.id, p.name]), ['inferno', 'Инферно и Короли']]],
  ['Классы и системы', [['classes', 'Классы'], ['system', 'Ролевая система'], ['eloquence', 'Красноречие'], ['healing', 'Лекари и травмы'], ['curses', 'Развитие Проклятых'], ['factions', 'Фракции'], ['inventions', 'Изобретения Инженера']]],
  ['Древо талантов', [['tree', 'Древо талантов']]],
  ['Мастерская', [['forge', 'Оружейная'], ['armor', 'Бронник'], ['craft', 'Крафт-станция'], ['gathering', 'Инструменты добычи'], ['blueprints', 'Чертежи ремёсел'], ['recycle', 'Переработчик'], ['alchemy', 'Алхимия'], ['cooking', 'Кулинария'], ['body', 'Протезы и конструкты']]]
];
const CHAPTERS = BOOK.flatMap(([part, ch]) => ch.map(([id, t]) => ({ id, t, part })));
const partOf = id => { const c = CHAPTERS.find(x => x.id === id); return c ? c.part : null; };
const nav = $('#nav');
nav.innerHTML = BOOK.map(([part, ch]) => `<a class="nav-btn" href="#${ch[0][0]}" data-part="${part}">${({ 'Классы и системы': 'Классы', 'Древо талантов': 'Древо' })[part] || part}</a>`).join('') + `<a class="nav-btn" href="#anketa" data-part="anketa">Анкета</a>`;
function bookTOC(cur) {
  return BOOK.map(([part, ch]) => `<div class="rail-part${partOf(cur) === part ? ' on' : ''}"><h5>${part}</h5>${ch.map(([id, t]) => `<a href="#${id}"${id === cur ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</div>`).join('')
    + `<div class="rail-part"><h5>Игроку</h5><a href="#anketa">Анкета персонажа</a><a href="#cabinet">Личный кабинет</a><a href="#home">Главная</a></div>`;
}
// мобильное оглавление
const drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.hidden = true; drawer.id = 'drawer'; document.body.append(drawer);
$('#burger').setAttribute('aria-controls', 'drawer');
$('#burger').addEventListener('click', () => { const o = drawer.hidden; drawer.hidden = !o; if (o) drawer.innerHTML = `<div class="eyebrow">Оглавление</div>${bookTOC(currentRoute)}`; $('#burger').setAttribute('aria-expanded', String(o)); });
drawer.addEventListener('click', e => { if (e.target.closest('a')) { drawer.hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); } });
let currentRoute = 'home';
function markNav(route) {
  const part = route === 'anketa' ? 'anketa' : (route === 'cabinet' || route === 'admin') ? 'cabinet' : partOf(route.startsWith('class-') ? 'classes' : route.startsWith('tree-') ? 'tree' : route.startsWith('rules-') ? 'rules' : route);
  $$('.nav-btn', nav).forEach(b => b.classList.toggle('current', b.dataset.part === part));
}

/* ---------- поиск по книге (Ctrl K) ---------- */
const searchBtn = document.createElement('button');
searchBtn.className = 'icon-btn search-btn'; searchBtn.setAttribute('aria-label', 'Поиск по сайту'); searchBtn.title = 'Поиск (Ctrl K)';
searchBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8.5" r="6"/><path d="m13 13 5 5"/></svg>';
$('#soundBtn').before(searchBtn);
let IDX = null;
function buildIdx() {
  const strip = h => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  IDX = CHAPTERS.filter(c => c.id !== 'tree').map(c => {
    let html = '';
    try { html = renderChapter(c.id); } catch {}
    if (c.id.startsWith('people-')) { const p = M.peoples.find(x => 'people-' + x.id === c.id); html += p.origins.map(o => ' ' + o.name + ' ' + o.tagline + ' ' + o.culture + ' ' + o.look.join(' ') + ' ' + o.talents.map(t => t.join(' ')).join(' ')).join(' '); }
    if (c.id === 'classes') html += M.classes.map(k => k.name + ' ' + k.text + ' ' + k.abilities.map(x => x.join(' ')).join(' ')).join(' ');
    const x = strip(html); return { c, x, xl: x.toLowerCase() };
  });
}
function openSearch() {
  if (!IDX) buildIdx();
  const w = document.createElement('div'); w.className = 'pal';
  w.innerHTML = `<div class="pal-box" role="dialog" aria-label="Поиск"><div class="pal-in"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8.5" r="6"/><path d="m13 13 5 5"/></svg><input id="palQ" placeholder="Люмерит, кража, гоблины, Солл…" autocomplete="off"><kbd>Esc</kbd></div><div class="pal-res" id="palRes"></div></div>`;
  document.body.append(w);
  const q = $('#palQ', w), res = $('#palRes', w); let sel = 0, cur = [];
  const close = () => w.remove();
  w.addEventListener('click', e => { if (e.target === w) close(); });
  function run() {
    const v = q.value.trim().toLowerCase();
    if (!v) { cur = CHAPTERS.slice(0, 8).map(c => ({ c, snip: c.part })); }
    else cur = IDX.map(r => { const i = r.xl.indexOf(v), t = r.c.t.toLowerCase().includes(v); return i < 0 && !t ? null : { c: r.c, score: (t ? 100 : 0) + (i < 0 ? 0 : 50 - Math.min(49, i / 200)), snip: i < 0 ? r.c.part : '…' + esc(r.x.slice(Math.max(0, i - 50), i)) + '<mark>' + esc(r.x.slice(i, i + v.length)) + '</mark>' + esc(r.x.slice(i + v.length, i + v.length + 80)) + '…' }; }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
    sel = 0;
    res.innerHTML = cur.length ? cur.map((r, i) => `<a href="#${r.c.id}" class="${i === sel ? 'on' : ''}"><small>${r.c.part}</small><b>${r.c.t}</b><span>${r.snip}</span></a>`).join('') : '<p class="muted" style="padding:16px">Ничего не найдено. Попробуй другое слово.</p>';
  }
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => {
    const links = $$('a', res);
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; links.forEach((a, i) => a.classList.toggle('on', i === sel)); links[sel]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && links[sel]) { location.hash = links[sel].getAttribute('href'); close(); }
  });
  res.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  run(); q.focus();
}
searchBtn.addEventListener('click', openSearch);
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'л')) { e.preventDefault(); if (!$('.pal')) openSearch(); } });

/* ================= ОБЩИЕ КУСКИ ================= */
const CH_BG = { start: 'bg-start', faq: 'bg-faq', modlist: 'bg-modlist', rules: 'bg-rules', discord: 'bg-discord', city: 'bg-city', history: 'bg-history', houses: 'bg-houses', lumerite: 'bg-lumerite', faith: 'bg-faith', magic: 'bg-magic', world: 'bg-world', deck: 'bg-deck', races: 'bg-peoples', 'people-humans': 'bg-humans', 'people-elves': 'bg-elves', 'people-dwarves': 'bg-dwarves', 'people-goblins': 'bg-goblins', 'people-infernals': 'bg-peoples', classes: 'bg-classes', system: 'bg-rules', eloquence: 'bg-houses', forge: 'bg-forge', armor: 'bg-armor', craft: 'bg-forge', recycle: 'bg-armor', alchemy: 'bg-magic', cooking: 'bg-forge', healing: 'bg-faith', body: 'bg-forge', curses: 'bg-deck', factions: 'bg-houses', inventions: 'bg-forge', gathering: 'bg-armor', blueprints: 'bg-forge', inferno: 'bg-peoples' };
const head = ({ eyebrow, title, lead, bg, crumbs }) => (bg = CH_BG[currentRoute] ? 'assets/art/' + CH_BG[currentRoute] + '.webp' : bg, `
<section class="page-head"><div class="bg" style="background-image:url('${bg || 'assets/city-bg.webp'}')"></div>
<div class="wrap reveal">${crumbs ? `<div class="crumbs"><a href="#home">Главная</a> / ${crumbs}</div>` : ''}<div class="eyebrow">${eyebrow || 'Хроники Меттенхейма'}</div><h1>${title}</h1>${lead ? `<p>${lead}</p>` : ''}</div></section>`);
const subnav = (items, cur) => `<nav class="subnav" aria-label="Подразделы"><div class="wrap">${items.map(([r, t]) => `<a href="#${r}" ${r === cur ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</div></nav>`;
const LORE = [['city', 'Меттенхейм'], ['history', 'История города'], ['houses', 'Дома'], ['lumerite', 'Люмерит'], ['faith', 'Вера'], ['magic', 'Магия'], ['world', 'История мира'], ['chronicle', 'Хроника'], ['deck', 'Проклятая колода']];
const PEOPLE_NAV = [['races', 'Все народы'], ...M.peoples.map(p => ['people-' + p.id, p.name]), ['inferno', 'Инферно']];
const CLS_NAV = [['classes', 'Классы'], ['tree', 'Древо талантов'], ['system', 'Ролевая система'], ['eloquence', 'Красноречие'], ['healing', 'Лекари'], ['curses', 'Проклятые'], ['factions', 'Фракции'], ['inventions', 'Изобретения'], ['forge', 'Оружейная'], ['armor', 'Бронник'], ['craft', 'Крафт-станция'], ['gathering', 'Добыча'], ['blueprints', 'Чертежи'], ['recycle', 'Переработчик'], ['alchemy', 'Алхимия'], ['cooking', 'Кулинария'], ['body', 'Протезы']];
const START_NAV = [['start', 'Как начать'], ['faq', 'FAQ'], ['modlist', 'Модлист'], ['rules', 'Правила']];
const ul = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const charImg = (folder, g, c) => `assets/characters/${folder}/${g}-${c}.webp`;

/* ================= ГЛАВНАЯ ================= */
function pageHome() {
  const html = pageHomeRaw(), cut = html.indexOf('</section>') + 10;
  // всё ниже заставки грузится по мере прокрутки
  return html.slice(0, cut) + html.slice(cut).replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" decoding="async" ');
}
function pageHomeRaw() {
  const H = M.houses;
  const portals = [
    ['city', 'Меттенхейм', 'Город двух заводов и Люмерита', 'assets/codex/city-v2.webp'],
    ['races', 'Народы', 'Люди, полуэльфы, дворфы, гоблины, инферналы', 'assets/codex/peoples.webp'],
    ['classes', 'Классы', 'Пять путей и новое древо развития', 'assets/codex/arcane-v2.webp'],
    ['forge', 'Мастерская', 'Оружие и броня с обвесами', 'assets/codex/workshop-v2.webp'],
    ['rules', 'Правила', 'Сцены, бой и взаимодействие', 'assets/codex/rules.webp'],
    ['faith', 'Вера', 'Троединство, Прогресс и запретные боги', 'assets/codex/faith.webp']
  ];
  return `
<section class="hero" aria-label="Выбор стороны">
  <div class="side talbot" data-side="talbot"><div class="art"></div>
    <div class="caption"><small>${H.talbot.side.toUpperCase()}</small><h2>${H.talbot.name}</h2><div class="hc-btns"><button type="button" class="hbtn" data-pick="talbot" aria-pressed="false"><span>Встать на сторону</span></button><a class="hlink" href="#houses">Подробнее</a></div></div></div>
  <div class="hero-core"><div class="ring"><img class="gear" src="assets/gear-md.webp" alt=""><img class="logo" src="assets/logo-md.webp" alt="Хроники Меттенхейма"></div>
    <h1 class="sr-only">Хроники Меттенхейма — ролевой сервер Conan Exiles, RP 21+</h1>
    <div class="core-plate"><div class="motto">ГОРОД ПАРА, СТАЛИ И АМБИЦИЙ</div><div class="status" id="heroStatus"></div>
    <div class="engine"><span class="eng-dot"></span><span>Переехали на <b>Conan Exiles Enhanced</b></span><span class="eng-ue">Unreal Engine 5</span></div></div></div>
  <div class="side dorn" data-side="dorn"><div class="art"></div>
    <div class="caption"><small>${H.dorn.side.toUpperCase()}</small><h2>${H.dorn.name}</h2><div class="hc-btns"><button type="button" class="hbtn" data-pick="dorn" aria-pressed="false"><span>Встать на сторону</span></button><a class="hlink" href="#houses">Подробнее</a></div></div></div>
</section>

<section class="section tight sides-sec"><div class="wrap">
  <div class="sec-head"><div class="eyebrow">Выбери свою сторону</div><h2>Два завода, два будущих</h2><p>Принадлежность к Дому отражает взгляды и интересы персонажа. Жёлтые и Красные — не светлая и тёмная сторона, а два ответа на вопрос, кому должен служить прогресс.</p></div>
  <div class="houses">${['talbot', 'dorn'].map(k => `<article class="panel house-card ${k === house ? 'lit' : ''}" data-hcard="${k}"><img src="${H[k].img}" alt=""><div><div class="eyebrow ${k[0]}">${H[k].side}</div><h3>${H[k].name}</h3><p>${H[k].head}</p>${ul(H[k].points)}<p style="margin-top:14px"><button class="btn small" data-pick="${k}" aria-pressed="false">Выбрать ${k === 'talbot' ? 'Жёлтых' : 'Красных'}</button></p></div></article>`).join('')}</div>
  <div id="fxMount" style="margin-top:22px"></div>
</div></section>

<section class="section tight live-sec"><div class="wrap" id="liveMount"></div></section>

<section class="section tight" style="padding-top:0"><div class="wrap">
  <div class="comm-layout">
    <div id="commMount"></div>
    <div class="comm-right">
      <div class="community">
        <a href="https://wargm.ru/server/61449" target="_blank" rel="noopener"><img src="assets/community/wargm-3d.webp" alt=""><span><strong>WARGM</strong><small>Поддержать голосом</small></span></a>
        <a href="https://boosty.to/riverside" target="_blank" rel="noopener"><img src="assets/community/boosty-3d.webp" alt=""><span><strong>BOOSTY</strong><small>Поддержать проект</small></span></a>
        <a href="https://wargm.ru/server/61449/connect" target="_blank" rel="noopener"><img src="assets/community/connect-3d.webp" alt=""><span><strong>ПОДКЛЮЧИТЬСЯ</strong><small>145.239.130.3:7790</small></span></a>
      </div>
      <div id="rsMini"></div>
    </div>
  </div>
</div></section>

<img class="divider" src="assets/divider.webp" alt="">

<section class="section" id="chronicle"><div class="wrap">
  <div class="sec-head"><div class="eyebrow">Хронометр · поверни эпоху</div><h2>Как появился Меттенхейм</h2><p>Город не был построен за один день. Он вырос из дыма первых плавилен, пережил борьбу домов и подошёл к эпохе, в которой энергии не хватало даже для человеческих амбиций.</p></div>
  <div class="chrono"><div class="dial" id="dial"><div class="face"></div><img class="gear" id="dialGear" src="assets/gear-md.webp" alt=""><div class="hand" id="dialHand"></div><div class="hub"></div></div>
  <article class="panel era" id="era" aria-live="polite"></article></div>
</div></section>

<section class="section tight"><div class="wrap">
  <div class="sec-head"><div class="eyebrow">Путеводитель</div><h2>Куда дальше</h2></div>
  <div class="grid3">${portals.map(([r, t, d, img]) => `<a class="link-card" href="#${r}"><div class="bg" style="background-image:url('${img}')"></div><div class="eyebrow">Раздел</div><h3>${t}</h3><p>${d}</p></a>`).join('')}</div>
</div></section>

<img class="divider" src="assets/divider.webp" alt="">

<section class="section" id="builder"><div class="wrap">
  <div class="app-banner" id="aBanner"><img id="aBannerImg" alt=""><div class="shade"></div><div class="cap"><span id="aBannerSide"></span><strong id="aBannerName"></strong></div></div>
  <div class="sec-head" style="margin-top:34px"><div class="eyebrow">Анкета игрока</div><h2>Создать персонажа</h2><p>Выбранный Дом переносится в анкету, черновик сохраняется в этом браузере. Когда всё готово — войди в личный кабинет через Discord и отправь квенту мастерам: решение придёт в кабинет и в личку.</p></div>
  <form id="aForm" class="app-form" autocomplete="off">
    <div class="ornament"><span></span><b>ДОСЬЕ ПЕРСОНАЖА</b><span></span></div>
    <div class="app-layout">
      <div class="app-fields">
        <div class="ftitle"><span>◈</span><div><small>ФОТОГРАФИЯ</small><strong>Портрет персонажа</strong></div></div>
        <div class="portrait"><div class="pframe" id="pFrame"><img id="pImg" alt="Загруженный портрет" hidden><div class="pempty" id="pEmpty"><span>CM</span><b>ИЗОБРАЖЕНИЕ<br>ОТСУТСТВУЕТ</b></div></div>
          <div class="pbtns"><input id="pFile" type="file" accept="image/png,image/jpeg,image/webp" hidden><button type="button" class="btn small" id="pPick">Загрузить портрет</button><button type="button" class="btn small ghost" id="pDel" hidden>Удалить</button><p class="phint">Вертикальный кадр 3:4, лицо ближе к верху. PNG, JPG или WEBP.</p></div></div>
        <label class="check"><input type="checkbox" id="fConsent" name="consent"> Согласие на обработку личных данных</label>
        <label class="check"><input type="checkbox" id="fRules" name="rules"> Я прочитал(а) лор и правила</label>

        <div class="ftitle"><span>01</span><div><small>ИГРОК</small><strong>Кто стоит за персонажем</strong></div></div>
        <div class="fgrid">
          <div class="field"><label for="fPlayer">Ваше имя</label><input type="text" id="fPlayer" name="player"></div>
          <div class="field"><label for="fPlayerAge">Ваш возраст</label><input type="number" id="fPlayerAge" name="playerAge" min="21"></div>
          <div class="field"><label for="fDiscord">ID Discord</label><input type="text" id="fDiscord" name="discord"></div>
          <div class="field"><label for="fHouse">Сторона</label><select id="fHouse" name="house"><option value="talbot">Талбот · Жёлтые</option><option value="dorn">Дорн · Красные</option></select></div>
        </div>

        <div class="ftitle"><span>02</span><div><small>ПЕРСОНАЖ</small><strong>Основные данные</strong></div></div>
        <div class="fgrid">
          <div class="field"><label for="fName">Имя персонажа</label><input type="text" id="fName" name="name"></div>
          <div class="field"><label for="fAge">Возраст персонажа</label><input type="number" id="fAge" name="age" min="1"></div>
          <div class="field full"><label>Пол</label><div class="chips" id="bGender"></div></div>
          <div class="field full"><label>Раса</label><div class="chips" id="bPeople"></div></div>
          <div class="field full"><label>Происхождение</label><div class="chips" id="bOrigin"></div><div class="onote" id="bOriginNote"></div></div>
          <div class="field full"><label>Класс</label><div class="chips" id="bClass"></div></div>
          <div class="field full"><label for="fProf">Профессия</label><select id="fProf" name="prof"><option>Нет</option><option>Алхимия</option><option>Повар</option><option>Лекарь</option><option>Кузнец</option><option>Бронник</option></select></div>
        </div>

        <div class="ftitle"><span>03</span><div><small>ПРЕДЫСТОРИЯ</small><strong>Откуда он пришёл</strong></div></div>
        <span class="mono bg-count" id="bgCount"></span>
        <div class="bg-grid" id="bBg"></div>
        <div class="bg-pick"><img id="bBgImg" alt=""><div><strong id="bBgTitle"></strong><p id="bBgText"></p></div></div>

        <div class="ftitle"><span>04</span><div><small>АРХЕТИП</small><strong>Уникальность</strong></div></div>
        <div class="chips" id="bUnique"></div>
        <div class="onote" id="bUniqueNote" hidden><strong>КОНСТРУКТ</strong><p>Конструкты — существа, перенёсшие собственный разум в искусственно созданное тело. Внутри оболочки сохраняются личность, память и сознание прежнего существа.</p></div>
        <div id="bCurse" hidden><div class="slot-box" data-slot="curse"></div><div class="onote curse"><strong>ПРОКЛЯТИЕ — НЕ ДАР</strong><p>${M.curseNote}</p></div><div class="chips" id="bCurseKind" style="margin-top:10px"></div><div class="bg-pick curse-pick"><img id="bCurseImg" alt=""><div><strong id="bCurseTitle"></strong><p id="bCurseText"></p></div></div></div>

        <div class="ftitle"><span>05</span><div><small>ХАРАКТЕР</small><strong>То, что делает его живым</strong></div></div>
        <div class="fgrid">
          <div class="field full"><span class="ctrl-label">Образованность</span><input type="hidden" id="fEdu" name="edu"><div class="chips" id="bEdu" role="group" aria-label="Образованность"></div><p class="muted edu-note" id="bEduNote"></p></div>
          <div class="field full"><label for="fFaith">Вера</label><select id="fFaith" name="faith"><option>Троединство · Тарн</option><option>Троединство · Солл</option><option>Троединство · Морн</option><option>Вера в Прогресс</option><option>Старая вера (тайно)</option><option>Вера в Камень (дворфы)</option><option>Вера в Инфернальных Королей (инферналы)</option><option>Нет веры</option><option>Другое</option></select></div>
          <div class="field full"><label for="fTraits">Особенности</label><textarea id="fTraits" name="traits" style="min-height:90px"></textarea></div>
          <div class="field full"><label for="fFears">Слабости и страхи</label><textarea id="fFears" name="fears" style="min-height:90px"></textarea></div>
          <div class="field full"><label for="fGoal">Цель и мотивации</label><textarea id="fGoal" name="goal" style="min-height:90px"></textarea></div>
          <div class="field full"><label for="fBio">Биография персонажа</label><textarea id="fBio" name="bio" style="min-height:220px" placeholder="Квента — от 1500 знаков: откуда персонаж, что с ним случилось и зачем он в Меттенхейме"></textarea></div>
        </div>
      </div>

      <aside class="app-preview"><div class="sticky">
        <div class="ftitle"><span>◈</span><div><small>ЛИЧНОЕ ДЕЛО</small><strong>Карточка персонажа</strong></div></div>
        <div class="stage"><img class="flag" id="bFlag" alt=""><img class="ring-gear" src="assets/gear-md.webp" alt=""><div class="floor"></div><img class="fig" id="bFig" alt=""></div>
        <div class="panel dossier" id="bDossier"></div>
      </div></aside>
    </div>
    <div class="seal"><span>CM</span><p>Тема анкеты связана с выбранным Домом.<br><small>Сменить сторону можно в любой момент.</small></p></div>
    <div class="form-actions"><button type="submit" class="btn">Сохранить анкету →</button><button type="button" class="btn ghost" id="bCopy">Скопировать для Discord</button><button type="button" class="btn ghost" id="bCab">Отправить в кабинет</button><span class="toast" id="bToast" role="status"></span></div>
    <textarea id="bExport" hidden readonly style="margin-top:12px;min-height:200px"></textarea>
    <div id="bStatus" style="margin-top:18px"></div>
  </form>
</div></section>

<section class="section tight"><div class="wrap">
  <div class="sec-head"><div class="eyebrow">Механизм случая</div><h2>Кубики игрока</h2></div>
  ${diceHTML()}
</div></section>`;
}
function diceHTML() {
  const img = n => n === 20 || n === 100 ? n : 5;
  return `<div class="dice" data-dice>${[4, 6, 20, 100].map(n => `<button class="die" data-die="${n}" data-nosnd><img src="assets/d${img(n)}-gear.webp" alt=""><span>БРОСИТЬ D${n}</span></button>`).join('')}<div class="roll-out panel"><div><small>РЕЗУЛЬТАТ</small><b data-roll>—</b><small data-rollinfo>&nbsp;</small></div></div></div>
  <div class="roulette panel"><div><div class="eyebrow">Рулетка удачи · 1d100</div><p class="muted" style="margin:4px 0 0;font-size:14px">Сначала выбери, потом бросай. Угадал — исход в твою пользу.</p></div><div class="ru-btns"><button class="btn ghost" data-ru="hi">Больше 50</button><button class="btn ghost" data-ru="lo">Меньше 50</button></div><b class="ru-out" data-ruout>—</b></div>`;
}
function mountDice(root) {
  $$('[data-ru]', root).forEach(b => b.addEventListener('click', () => {
    const r = 1 + Math.floor(Math.random() * 100), hi = b.dataset.ru === 'hi', win = r === 50 ? false : hi ? r > 50 : r < 50;
    play('dice'); $('[data-ruout]', root).innerHTML = `${r} · <span class="${win ? 'up' : 'down'}">${win ? 'угадал' : 'мимо'}</span>`;
  }));
  $$('[data-die]', root).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.die, r = 1 + Math.floor(Math.random() * n);
    play('dice'); b.classList.remove('rolling'); void b.offsetWidth; b.classList.add('rolling');
    const out = $('[data-roll]', root), info = $('[data-rollinfo]', root);
    let k = 0; const t = setInterval(() => { out.textContent = 1 + Math.floor(Math.random() * n); if (++k > 10) { clearInterval(t); out.textContent = r; info.textContent = `D${n}${n === 20 && r === 20 ? ' · КРИТ!' : n === 20 && r === 1 ? ' · ПРОВАЛ' : ''}`; } }, 60);
  }));
}

function mountHome() {
  // выбор стороны
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => { if (b.dataset.pick !== house) applyHouse(b.dataset.pick, true); }));
  $$('.side[data-side]').forEach(b => b.addEventListener('click', e => { if (e.target.closest('a,button')) return; if (b.dataset.side !== house) applyHouse(b.dataset.side, true); }));
  setVars();
  MH.onHouse(hcards);
  hcards();
  // хронометр
  const dial = $('#dial'), N = M.eras.length;
  M.eras.forEach((e, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2, b = document.createElement('button');
    b.className = 'mark'; b.textContent = e.n; b.setAttribute('aria-label', `Эпоха ${e.n}: ${e.title}`);
    b.style.left = (50 + Math.cos(a) * 43) + '%'; b.style.top = (50 + Math.sin(a) * 43) + '%';
    b.addEventListener('click', () => era(i)); dial.append(b);
  });
  let cur = 0;
  function era(i) {
    cur = (i + N) % N; const e = M.eras[cur];
    $$('.mark', dial).forEach((m, j) => m.setAttribute('aria-selected', String(j === cur)));
    $('#dialHand').style.setProperty('--a', (cur / N * 360 + 180) + 'deg');
    $('#dialGear').style.transform = `rotate(${cur * -60}deg)`;
    const box = $('#era');
    box.innerHTML = `<div class="era-in"><div class="years">ЭПОХА ${e.n} · ${e.years}</div><h3>${e.title}</h3>${e.text.map(p => `<p>${p}</p>`).join('')}
      <div class="pager"><button class="btn small ghost" data-step="-1">← Раньше</button><button class="btn small" data-step="1">Позже →</button><a class="btn small ghost" href="#history">Вся хроника</a></div></div>`;
    $$('[data-step]', box).forEach(s => s.addEventListener('click', () => { era(cur + +s.dataset.step); if (soundOn) { snd.gears.currentTime = 0; snd.gears.volume = .25; snd.gears.play().catch(() => {}); clearTimeout(stopT); stopT = setTimeout(() => gearFade(0, 200), 400); } }));
  }
  era(0);
  mountBuilder();
  mountDice($('[data-dice]').parentElement);
}
function hcards() { $$('[data-hcard]').forEach(c => c.classList.toggle('lit', c.dataset.hcard === house)); }

/* ---------- мастерская персонажа ---------- */
function mountBuilder() {
  const st = Object.assign({ g: 'female', p: 'humans', o: 'mett', c: 'engineer', bg: 'factory', u: 'none', cu: 'doppler' }, store.get('anketa', {}));
  const people = () => M.peoples.find(p => p.id === st.p) || M.peoples[0];
  const origin = () => people().origins.find(o => o.id === st.o) || people().origins[0];
  const cls = () => M.classes.find(c => c.id === st.c) || M.classes[0];
  const chip = (attr, val, label, cur, img) => `<button type="button" class="chip" data-${attr}="${val}" aria-pressed="${val === cur}">${img ? `<img src="${img}" alt="">` : ''}${label}</button>`;
  const form = $('#aForm'), F = form.elements;
  const FIELDS = ['player', 'playerAge', 'discord', 'name', 'age', 'prof', 'edu', 'faith', 'traits', 'fears', 'goal', 'bio'];
  FIELDS.forEach(k => { if (st[k] != null && F[k]) F[k].value = st[k]; });
  F.consent.checked = !!st.consent; F.rules.checked = !!st.rules;
  F.house.value = house;
  // портрет
  const portrait = store.get('portrait', null);
  const showP = src => { $('#pImg').hidden = !src; $('#pEmpty').hidden = !!src; $('#pDel').hidden = !src; if (src) $('#pImg').src = src; };
  showP(portrait);
  $('#pPick').onclick = () => $('#pFile').click();
  $('#pFile').onchange = () => {
    const f = $('#pFile').files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => {
      const img = new Image(); img.onload = () => {
        const c = document.createElement('canvas'), k = Math.min(1, 720 / Math.max(img.width, img.height));
        c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', .82); store.set('portrait', url); showP(url);
      }; img.src = r.result;
    }; r.readAsDataURL(f);
  };
  $('#pDel').onclick = () => { store.set('portrait', null); showP(null); };

  const isInf = () => !!people().infernal;
  const bgAllowed = b => isInf() ? !!b.infernal : !b.infernal && (!b.only || b.only.includes(origin().id));
  function banner() {
    const H = M.houses[house];
    $('#aBannerImg').src = H.banner; $('#aBannerSide').textContent = house === 'dorn' ? 'КРАСНАЯ СТОРОНА' : 'ЖЁЛТАЯ СТОРОНА'; $('#aBannerName').textContent = H.name.toUpperCase();
    F.house.value = house;
    const fl = $('#bFlag');
    if (!fl.getAttribute('src')) fl.src = H.flag;
    else if (!fl.src.endsWith(H.flag)) { fl.classList.add('out'); setTimeout(() => { fl.src = H.flag; fl.classList.remove('out'); }, 280); }
  }
  function draw(swap) {
    if (!people().origins.some(o => o.id === st.o)) st.o = people().origins[0].id;
    if (!bgAllowed(M.backgrounds.find(b => b.id === st.bg) || {})) st.bg = isInf() ? 'renegade' : 'military';
    if (isInf()) st.u = 'none';
    $('#bGender').innerHTML = chip('g', 'female', 'Женский', st.g) + chip('g', 'male', 'Мужской', st.g);
    $('#bPeople').innerHTML = M.peoples.map(p => chip('p', p.id, ({ humans: 'Человек', elves: 'Полуэльф', dwarves: 'Дворф', goblins: 'Гоблин', infernals: 'Инфернал' })[p.id] || p.name, st.p, p.emblem)).join('');
    $('#bOrigin').innerHTML = people().origins.map(o => chip('o', o.id, o.name, st.o)).join('');
    $('#bOriginNote').innerHTML = `${st.p === 'goblins' ? '<div class="slot-box" data-slot="goblin" style="margin-bottom:12px"></div>' : ''}<strong>${origin().name}</strong><p>${origin().tagline} ${origin().culture.split('. ').slice(0, 2).join('. ')}.</p>`;
    $('#bClass').innerHTML = M.classes.map(c => chip('c', c.id, c.name, st.c, c.emblem)).join('');
    const chaos = origin().id === 'ice' ? 'ice' : 'fire', KS = M.kings.filter(k => k.chaos === chaos);
    if (isInf() && !KS.some(k => k.id === st.ik)) st.ik = KS[0].id;
    const KK = M.kings.find(k => k.id === st.ik);
    $('#bUnique').innerHTML = isInf() ? `<div class="note" style="margin:0 0 12px"><strong>Инфернал уже уникален.</strong> Проклятие и Конструкт ему недоступны, а предыстория — только Отступник или Шпион.</div><div class="slot-box" data-slot="infernal"></div><span class="ctrl-label">Дом Короля</span><div class="chips">${KS.map(k => chip('ik', k.id, k.name + ' · ' + k.sin, st.ik)).join('')}</div>${KK ? `<div class="onote"><strong>${KK.name} · ${KK.title}</strong><p>Грех — ${KK.sin.toLowerCase()}. Питается: ${KK.feed}. <a href="#inferno">Подробнее о Домах и голоде</a></p></div>` : ''}` : chip('u', 'none', 'Нет', st.u) + chip('u', 'curse', 'Проклятие', st.u, 'assets/emblems/possessed.webp') + chip('u', 'construct', 'Конструкт', st.u, 'assets/emblems/construct.webp');
    $('#bUniqueNote').hidden = st.u !== 'construct';
    const curse = M.curses.find(x => x.id === st.cu) || M.curses[0];
    $('#bCurse').hidden = st.u !== 'curse';
    $('#bCurseKind').innerHTML = M.curses.map(x => chip('cu', x.id, x.name, st.cu, x.emblem)).join('');
    $('#bCurseImg').src = curse.emblem; $('#bCurseTitle').textContent = curse.name; $('#bCurseText').textContent = curse.text;
    const uEmb = isInf() ? 'assets/emblems/infernal.webp' : st.u === 'construct' ? 'assets/emblems/construct.webp' : st.u === 'curse' ? curse.emblem : '';
    const uName = isInf() ? 'Инфернал · ' + origin().name + (KK ? ' · Дом ' + KK.gen : '') : st.u === 'construct' ? 'Конструкт' : st.u === 'curse' ? 'Проклятие · ' + curse.name : '';
    const list = M.backgrounds.filter(bgAllowed);
    $('#bBg').innerHTML = list.map(b => `<button type="button" class="bg-card" data-bg="${b.id}" aria-pressed="${b.id === st.bg}"><img src="${b.img}" alt="" loading="lazy"><span>${b.name}</span></button>`).join('');
    const bgo = M.backgrounds.find(b => b.id === st.bg); $('#bBgTitle').textContent = bgo ? bgo.name : ''; if (bgo) $('#bBgImg').src = bgo.img;
    const eduOk = (bgo && bgo.edu) || M.education.map(e => e[0]);
    $('#bBgText').innerHTML = bgo ? `${esc(bgo.text)}<span class="edu-tag">Образованность: ${M.education.filter(e => eduOk.includes(e[0])).map(e => e[1]).join(' · ')}</span>` : '';
    let eduCur = (M.education.find(e => e[1] === F.edu.value) || [])[0];
    if (!eduOk.includes(eduCur)) { eduCur = eduOk.includes('life') ? 'life' : eduOk[0]; F.edu.value = M.education.find(e => e[0] === eduCur)[1]; }
    $('#bEdu').innerHTML = M.education.map(([id, label]) => { const ok = eduOk.includes(id); return `<button type="button" class="chip${ok ? '' : ' locked'}" data-edu="${id}" aria-pressed="${id === eduCur}" ${ok ? '' : `disabled title="Недоступно для предыстории «${bgo ? bgo.name : ''}»"`}>${ok ? '' : '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>'}${label}</button>`; }).join('');
    $('#bEduNote').textContent = (M.education.find(e => e[0] === eduCur) || [])[2] || '';
    $('#bgCount').textContent = `Выбрано: ${list.findIndex(b => b.id === st.bg) + 1} из ${list.length}`;
    const o = origin(), c = cls(), H = M.houses[house];
    const src = charImg(o.folder, st.g, c.id), fig = $('#bFig');
    if (fig.getAttribute('src') !== src) {
      if (swap) { fig.classList.add('out'); setTimeout(() => { fig.src = src; fig.onload = () => fig.classList.remove('out'); }, 200); } else fig.src = src;
      fig.alt = `${o.name}, ${c.name}`;
    }
    const nm = F.name.value.trim() || 'Персонаж', age = F.age.value;
    $('#bDossier').innerHTML = `<small class="eyebrow">ЛИЧНОЕ ДЕЛО · ${H.side.toUpperCase()}</small><h3>${esc(nm)}</h3>
      <div class="meta">${[age ? age + ' лет' : '', st.g === 'female' ? 'Женщина' : 'Мужчина', c.name].filter(Boolean).join(' · ')}</div>
      <p class="row">${people().name} · ${o.name}</p><p class="row">Профессия · ${esc(F.prof.value)}</p>${uName ? `<p class="row hl">${uName}</p>` : ''}
      <div class="emblems"><figure><img src="${o.emblem}" alt="">РАСА</figure><figure><img src="${c.emblem}" alt="">КЛАСС</figure><figure class="${uEmb ? '' : 'empty'}">${uEmb ? `<img src="${uEmb}" alt="">` : '<i></i>'}УНИКАЛЬНОСТЬ</figure></div>`;
  }
  function save() { const d = { ...st, consent: F.consent.checked, rules: F.rules.checked }; FIELDS.forEach(k => d[k] = F[k].value); store.set('anketa', d); }
  form.addEventListener('click', e => {
    const b = e.target.closest('.chip[data-g],.chip[data-p],.chip[data-o],.chip[data-c],.chip[data-u],.chip[data-cu],.chip[data-ik]'); if (!b) return;
    for (const k of ['g', 'p', 'o', 'c', 'u', 'cu', 'ik']) if (b.dataset[k]) st[k] = b.dataset[k];
    if (b.dataset.p) st.o = people().origins[0].id;
    play('card'); draw(true); save(); window.Cabinet && window.Cabinet.fillSlots($('#aForm'));
  });
  $('#bBg').addEventListener('click', e => { const b = e.target.closest('[data-bg]'); if (!b) return; st.bg = b.dataset.bg; draw(); save(); });
  $('#bEdu').addEventListener('click', e => { const b = e.target.closest('[data-edu]'); if (!b || b.disabled) return; F.edu.value = M.education.find(x => x[0] === b.dataset.edu)[1]; play('click'); draw(); save(); });
  F.house.addEventListener('change', () => applyHouse(F.house.value, true));
  form.addEventListener('input', e => { if (e.target !== F.house) { draw(); save(); } });
  const toast = t => { $('#bToast').textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => $('#bToast').textContent = '', 4000); };
  form.addEventListener('submit', e => {
    e.preventDefault(); save();
    if (!F.consent.checked || !F.rules.checked) { toast('Отметь согласие и подтверди, что прочитал правила'); return; }
    toast('Анкета сохранена в этом браузере');
  });
  $('#bCab').addEventListener('click', () => { save(); try { sessionStorage.setItem('mh:open-char', 'anketa'); } catch {} location.hash = '#cabinet'; });
  $('#bCopy').addEventListener('click', () => {
    const o = origin(), c = cls(), bgo = M.backgrounds.find(b => b.id === st.bg);
    const txt = `АНКЕТА · ХРОНИКИ МЕТТЕНХЕЙМА\n\nИГРОК\nИмя: ${F.player.value}\nВозраст: ${F.playerAge.value}\nDiscord: ${F.discord.value}\nСторона: ${M.houses[house].name}\n\nПЕРСОНАЖ\nИмя: ${F.name.value}\nВозраст: ${F.age.value}\nПол: ${st.g === 'female' ? 'Женский' : 'Мужской'}\nРаса: ${people().name} (${o.name})\nКласс: ${c.name}\nПрофессия: ${F.prof.value}\nПредыстория: ${bgo ? bgo.name : ''}\nУникальность: ${isInf() ? 'Инфернал, Дом ' + ((M.kings.find(k => k.id === st.ik) || {}).gen || '—') : st.u === 'construct' ? 'Конструкт' : st.u === 'curse' ? 'Проклятие (' + (M.curses.find(x => x.id === st.cu) || M.curses[0]).name + ')' : 'Нет'}\n\nХАРАКТЕР\nОбразованность: ${F.edu.value}\nВера: ${F.faith.value}\nОсобенности: ${F.traits.value}\nСлабости и страхи: ${F.fears.value}\nЦель и мотивации: ${F.goal.value}\n\nБИОГРАФИЯ\n${F.bio.value}`;
    const ta = $('#bExport');
    navigator.clipboard.writeText(txt).then(() => toast('Анкета скопирована — вставь её в Discord'), () => { ta.hidden = false; ta.value = txt; ta.select(); toast('Скопируй текст вручную из поля ниже'); });
  });
  MH.onHouse(() => { banner(); draw(); });
  banner(); draw();
}

/* ================= ЛОР ================= */
function pageCity() {
  return head({ eyebrow: 'Город двух заводов', title: 'Меттенхейм', lead: 'Пар, сталь и Люмерит. Два дома спорят о будущем, пока Лимн меняется вокруг них.', bg: 'assets/city-bg.webp', crumbs: 'Мир' }) + subnav(LORE, 'city') + `
<section class="content"><div class="wrap"><div class="prose reveal">
<p class="lead">Меттенхейм вырос у реки и железной руды. Семь веков он превращал дым плавилен в механизмы, а механизмы — в силу, с которой считается даже Западная Корона.</p>
<h2>На пороге новой эпохи</h2>
<p>Шахтёры Меттенхейма вскрыли кристаллические жилы лей-линий. Открытие изменило промышленность: заводы получили новый источник энергии, а автоматоны, машины и конструкты — новое топливо. Разработки, зависевшие от постоянного подключения, стали самостоятельнее. Город совершил скачок, на который при прежних условиях ушло бы два столетия.</p>
<p>Табита Талбот видит возможность передать достижения всему Лимну. Виктор Дорн стремится сохранить контроль над ними и обеспечить военное превосходство. Каждое новое месторождение усиливает борьбу за то, кому достанется энергия и какие машины будут построены.</p>
<p>Город живёт сменами. Инженеры испытывают новые устройства, рабочие собирают машины, а владельцы предприятий решают, куда отправятся следующие партии топлива. За пределами стен меняется весь Лимн, и Меттенхейму предстоит доказать, что его машины способны его защитить.</p>
<h2>Как устроен город</h2>
<div class="grid2">
<div class="panel art-card"><img src="assets/art/bg-houses.webp" alt="" loading="lazy"><h4>Заводская сторона</h4><p class="muted">Два гигантских предприятия, котельные, литейные дворы и рабочие кварталы. Остановка завода оставляет без хлеба целые улицы.</p></div>
<div class="panel art-card"><img src="assets/art/head-rust.webp" alt="" loading="lazy"><h4>Ржавые кварталы</h4><p class="muted">Тесные улочки вдоль реки, где живут рабочие, гоблинские артели и все, кто ищет заработок без лишних вопросов.</p></div>
<div class="panel art-card"><img src="assets/art/bg-rules.webp" alt="" loading="lazy"><h4>Совет</h4><p class="muted">Промышленная хартия даёт городу собственный совет и широкие права в обмен на приоритет коронных заказов.</p></div>
<div class="panel art-card"><img src="assets/art/head-lumerite.webp" alt="" loading="lazy"><h4>Шахты Люмерита</h4><p class="muted">Глубокие штреки под городом. Кто контролирует месторождение, тот решает, какие машины будут работать завтра.</p></div>
</div>
<h2>Два пути</h2>
<div class="grid2">${['talbot', 'dorn'].map(k => `<a class="link-card" href="#houses"><div class="bg" style="background-image:url('${M.houses[k].banner}')"></div><div class="eyebrow">${M.houses[k].side}</div><h3>${M.houses[k].name}</h3><p>${M.houses[k].motto}</p></a>`).join('')}</div>
</div></div></section>`;
}
function pageHistory() {
  return head({ eyebrow: 'Архив Меттенхейма · Том I', title: 'История города', lead: 'От поселения у плавилен до города машин. Ранняя история остаётся реконструкцией архивариусов: даты связывают события, но не являются окончательным каноном.', bg: 'assets/codex/history.webp', crumbs: 'Мир' }) + subnav(LORE, 'history') + `
<section class="content"><div class="wrap"><div class="prose reveal" style="max-width:860px">
${M.eras.map(e => `<article class="panel" style="margin-bottom:6px"><div class="eyebrow">Эпоха ${e.n} · ${e.years}</div><h2 style="margin:6px 0 12px;font-size:30px">${e.title}</h2>${e.text.map(p => `<p style="margin-bottom:10px">${p}</p>`).join('')}</article>`).join('')}
</div></div></section>`;
}
function pageHouses() {
  const H = M.houses;
  return head({ eyebrow: 'Жёлтые и Красные', title: 'Дома Талбот и Дорн', lead: 'Два предприятия. Два взгляда на то, кому должен служить прогресс.', bg: 'assets/house-talbot-banner.webp', crumbs: 'Мир' }) + subnav(LORE, 'houses') + `
<section class="content"><div class="wrap">
<div class="houses">${['talbot', 'dorn'].map(k => `<article class="panel house-card ${k === house ? 'lit' : ''}" data-hcard="${k}"><img src="${H[k].img}" alt=""><div><div class="eyebrow ${k[0]}">${H[k].side}</div><h3>${H[k].name}</h3><p>${H[k].head}</p>${ul(H[k].points)}<p style="margin-top:14px"><button class="btn small" data-pick="${k}" aria-pressed="false">Выбрать сторону</button></p></div></article>`).join('')}</div>
<div class="prose" style="margin-top:40px">
<h2>Развод и раздел заводов</h2><p>Прежде оба крупных завода принадлежали Виктору. После развода Табита получила производство деталей и протезов, Виктор сохранил крупнейший завод машин, танкеров и оружия. Противоположные взгляды владельцев стали основой городского раскола.</p>
<h2>Борьба за Люмерит</h2><p>Контроль над месторождениями даёт энергию заводам. Оба дома нуждаются в Люмерите, но расходятся в том, для чего строить машины и на каких условиях делиться разработками с другими землями.</p>
<p class="note">Принадлежность к Дому отражает взгляды и интересы персонажа. Красные и Жёлтые не являются названиями светлой и тёмной репутации. Фракционная репутация описана в разделе «Ролевая система».</p>
</div></div></section>`;
}
function pageLumerite() {
  return head({ eyebrow: 'Энергия лей-линий', title: 'Люмерит', lead: 'Застывшая магия мира. Источник энергии для заводов и единственный источник маны для магов.', bg: 'assets/codex/magic.webp', crumbs: 'Мир' }) + subnav(LORE, 'lumerite') + `
<section class="content"><div class="wrap"><img class="wide-art" src="assets/art/head-lumerite.webp" alt=""><div class="prose reveal">
<h2>Гибель Тихого древа</h2><p>Когда было уничтожено последнее Тихое древо — последний оплот магии этого мира, — лей-линии потеряли опору. Нити силы, что текли сквозь всё живое, кристаллизовались и ушли под землю. Так родились люмеритовые жилы: застывшая магия мира, спрятанная в камне.</p>
<p>Чистый кристалл светится изнутри холодным золотом и тёплый на ощупь. Его первыми нашли в шахтах Меттенхейма.</p>
<h2>Магия только через Люмерит</h2><p>Живые существа больше не проводят лей-линии сквозь себя. Чтобы колдовать, магу нужен Люмерит: он берёт ману из кристалла и плетёт ею заклинание. Без Люмерита даже опытный маг бессилен.</p>
<p>Черпать ману из жилы умеют не все. Это <b>Дар жилы</b> — особый талант, который есть у немногих и который нужно развить. Поэтому магия больше не принадлежит каждому: магами становятся только те, кто научился обращаться с Люмеритом в новых условиях. В игре Дар жилы есть у класса Маг.</p>
<h2>Промышленное применение</h2><p>Люмерит даёт огромный объём энергии. Из него производят топливо для автоматонов, больших машин и конструктов. Изобретения, раньше требовавшие постоянного подключения к заводу, стали автономными.</p>
<h2>Цена контроля</h2><p>Для Талбот новая энергия открывает путь к развитию всего мира. Для Дорна — обеспечивает силу и военное превосходство. Маги, заводы и Дома тянутся к одним и тем же жилам, и борьба за Люмерит определяет будущее Меттенхейма.</p>
<p class="note">Как маг тратит и заряжает кристаллы — в главе <a href="#magic">Магия</a>. Кристаллы и переработка Люмерита — в <a href="#craft">Крафт-станции</a>.</p>
</div></div></section>`;
}
function pageFaith() {
  const T = M.trinity;
  return head({ eyebrow: 'Столпы, шестерня и запретные боги', title: 'Вера', lead: 'Три веры живут в Меттенхейме. Одну принесли люди, вторую родил сам город, а третью запретил Совет. Дворфы и инферналы хранят свои.', bg: 'assets/codex/faith.webp', crumbs: 'Мир' }) + subnav(LORE, 'faith') + `
<section class="content"><div class="wrap">
<div class="sec-head"><div class="eyebrow">Новая вера людей</div><h2>Троединство</h2><p>Вера в Тарна, Солла и Морна. Столпы — не совсем обычные боги, а стиль жизни и путь, которому следуют. Удел Порядка наследуется, Труд принимает любого, а Безмолвие выбирается сознательно.</p></div>
<div class="faith-grid">${T.map(t => `<article class="panel pillar"><img class="medal" src="assets/art/faith-${({ Тарн: 'tarn', Солл: 'varn', Морн: 'morn' })[t.name]}.webp" alt=""><div class="role">${t.role}</div><h3>${t.name}</h3><p>${t.text}</p><h4>Удел</h4>${ul(t.who)}<h4>Сильные стороны</h4>${ul(t.plus)}<h4>Цена</h4>${ul(t.minus)}</article>`).join('')}</div>

<div class="faith-banner"><img src="assets/art/head-progress.webp" alt=""><img class="medal" src="assets/art/faith-progress.webp" alt=""></div>
<div class="sec-head" style="margin-top:30px"><div class="eyebrow">Вера Меттенхейма</div><h2>Вера в Прогресс</h2><p>Родилась в цехах, а не в храмах. Её последователей называют прогрессистами, а в Ржавых кварталах — «шестерёночниками».</p></div>
<div class="grid2">
<article class="panel prose"><h3 style="margin-top:0">Во что они верят</h3><p>Боги ушли из Лимна, а мир остался. Значит, его можно понять, разобрать и собрать лучше. Каждое изобретение — молитва, каждый отремонтированный механизм — доброе дело, а застой — единственный настоящий грех.</p>
<ul><li>Мир — механизм, и у него есть чертёж</li><li>Руки и разум важнее крови и рода</li><li>Знание, которое никто не применил, мертво</li><li>Ошибка мастера прощается, ржавчина — нет</li><li>Люмерит — свет, добытый руками, а не подаренный небом</li></ul></article>
<article class="panel prose"><h3 style="margin-top:0">Обряды</h3><ul>
<li><b>Первый оборот.</b> Новый механизм освящают при запуске, а его имя вносят в Книгу Оборотов цеха.</li>
<li><b>Минута гудка.</b> Когда гудит заводская сирена в конце смены, прогрессисты замолкают в память погибших в цехах.</li>
<li><b>Клеймо мастера.</b> Ученик получает личное клеймо, когда его первая работа проходит проверку чужими руками.</li>
<li><b>Символ</b> — шестерня с искрой Люмерита в центре. Её носят на цепочке, гравируют на инструментах и протезах.</li></ul>
<p>Жрецов нет. Есть Хранители Чертежей — архивариусы цехов — и механики-проповедники, которые читают на заводах лекции вместо проповедей.</p></article>
</div>
<div class="grid2" style="margin-top:18px">
<article class="panel"><div class="eyebrow">Жёлтые</div><h3 style="margin:6px 0 8px">Открытый оборот</h3><p class="muted">Течение, близкое Дому Талбот: чертёж принадлежит всем, а прогресс, спрятанный в сейфе, перестаёт быть прогрессом.</p></article>
<article class="panel"><div class="eyebrow">Красные</div><h3 style="margin:6px 0 8px">Закрытый оборот</h3><p class="muted">Течение, близкое Дому Дорн: знание — это оружие, и отдать его чужим значит предать город, который его создал.</p></article>
</div>
<p class="note" style="margin-top:18px">С Троединством Прогресс уживается: рабочие Тарна легко принимают шестерню рядом со своим столпом, последователи Солла терпят её как полезную городскую привычку. Со Старой верой прогрессисты непримиримы.</p>

<div class="sec-head" style="margin-top:70px"><div class="eyebrow">Хранители Природы</div><h2>Старая вера</h2><p>Вера в Первородных богов Лимна, существовавших задолго до людей и королевств. Староверы верят в равновесие и круговорот мира: смерть — не конец, а вмешательство в естественный ход вещей рождает уродства и катастрофы.</p></div>
<article class="panel banned"><span class="stamp">ЗАПРЕЩЕНА</span>
<p style="max-width:62ch">Совет Меттенхейма запретил Старую веру, когда староверы начали срывать работу шахт Люмерита, называя добычу раной на теле Лимна. Публичные обряды, святилища-рощи и костяные талисманы на виду караются штрафом, конфискацией и изгнанием из города. Многие продолжают верить тайно.</p>
<div class="gods" style="margin-top:20px">${M.oldGods.map(([n, d]) => `<div class="god"><b>${n}</b><span>${d}</span></div>`).join('')}</div>
</article>

<div class="sec-head" style="margin-top:70px"><div class="eyebrow">Вера дворфов</div><h2>Вера в Камень</h2><p>Дворфы верят, что их народ высечен из камня гор, а Камень — первый предок, который помнит каждого, кто жил под ним. Сердце Камня — Железный Горн, и каждый удар молота считается молитвой ему.</p></div>
<div class="grid2">
<article class="panel prose"><h3 style="margin-top:0">Во что они верят</h3><ul><li>Камень помнит всё: имя, высеченное в камне, не умирает</li><li>Предки уходят в скалу и держат на себе своды</li><li>Ремесло — разговор с Камнем, ржавый инструмент — оскорбление предков</li><li>Потерянный дом не потерян, пока жив хоть один, кто помнит его камни</li></ul></article>
<article class="panel prose"><h3 style="margin-top:0">Обряды</h3><ul><li><b>Имя в камне.</b> Ребёнку высекают имя на родовом камне. Вдали от дома — на любом камне, который дворф носит с собой.</li><li><b>Первая искра.</b> Первое изделие ученика кладут в горн как дар, а не продают.</li><li><b>Тишина обвала.</b> По погибшим под землёй молчат столько ударов сердца, сколько им было лет.</li><li><b>Символ</b> — молот на наковальне, вписанный в гору.</li></ul>
<p>Жрецов нет. Есть Хранители Памяти — старейшины, помнящие родословные и названия залов Кхазад-Кадрина и Каз'Громара.</p></article>
</div>
<p class="note" style="margin-top:18px">Доступна только дворфам. С Прогрессом Вера в Камень уживается легко — и та и другая чтит руки мастера. К Старой вере дворфы равнодушны: её боги не жили под землёй.</p>

<div class="sec-head" style="margin-top:70px"><div class="eyebrow">Вера инферналов</div><h2>Вера в Инфернальных Королей</h2><p>Для инферналов Короли — не правители, а истинные боги-создатели: они носители хаоса, из которого сделан весь народ Инферно. Поклоняются своему Дому и его греху. Подробно о Домах — в главе <a href="#inferno">Инферно и Короли</a>.</p></div>
<div class="grid2">
<article class="panel prose"><h3 style="margin-top:0">Во что они верят</h3><ul><li>Грех — не порок, а природа, которую дал Король</li><li>Сделка священна: нарушивший договор теряет душу</li><li>Сила, добытая голодом, принадлежит и инферналу, и его Королю</li><li>Ледяные верят, что закованные Короли однажды проснутся</li></ul></article>
<article class="panel prose"><h3 style="margin-top:0">Как это выглядит в Меттенхейме</h3><p>Открыто молиться Королям в городе — значит выдать себя. Вера держится на мелочах: знак Дома, вырезанный изнутри перчатки, клятва на инфернальном языке шёпотом, первая порция голода, которую оставляют Королю.</p><p>Шпион молится Королю, который всё ещё его слышит. Отступник — Королю, от которого бежит. Это одна вера и две очень разные молитвы.</p></article>
</div>
<p class="note" style="margin-top:18px">Доступна только инферналам. Для Троединства, Прогресса и Старой веры поклонение Королям — ересь хуже любой другой.</p>

<div class="sec-head" style="margin-top:70px"><div class="eyebrow">Своя вера</div><h2>Другое</h2><p>Если вера персонажа не подходит ни под одну из описанных — чужеземный культ, семейный обычай, личная клятва, — выбери в анкете «Другое» и опиши её в особенностях или квенте. Новую веру утверждает мастер.</p></div>
</div></section>`;
}
const kvRows = rows => `<div class="kv">${rows.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
const SPELL_COST_HTML = () => kvRows(window.SPELL_COST || []);
const RECHARGE_HTML = () => kvRows(window.RECHARGE || []);
function pageMagic() {
  return head({ eyebrow: 'Лей-линии и плетение', title: 'Магия', lead: 'После гибели последнего Тихого древа магия ушла в камень. Колдовать можно только через Люмерит — и только тем, у кого есть Дар жилы.', bg: 'assets/codex/arcane-v2.webp', crumbs: 'Мир' }) + subnav(LORE, 'magic') + `
<section class="content"><div class="wrap">
<div class="prose" style="margin-bottom:34px"><p class="lead">Лей-линии — нити силы, когда-то пронизывавшие всё живое. Когда было уничтожено последнее Тихое древо, они кристаллизовались и ушли под землю люмеритовыми жилами. Теперь маг берёт ману только из Люмерита.</p>
<p>Черпать ману из кристалла умеют немногие: это Дар жилы, особый талант. Магами становятся лишь те, кто научился обращаться с Люмеритом. Поэтому маги в Меттенхейме редки и нужны заводам как никогда.</p>
<p>У каждого мага четыре базовых плетения. Дальше он развивается по ветвям школ на древе развития.</p></div>
<div class="sec-head"><div class="eyebrow">Кристаллы магии</div><h2>Сила из застывшей жилы</h2><p>Тянуть силу из себя больше нельзя — лей-линии ушли из живых существ. Маг плетёт только через люмеритовый кристалл-фокус, и каждое заклинание тратит его заряды.</p></div>
<div id="crystalMount"></div>
<div class="grid2" style="margin-top:22px">
<article class="panel"><div class="eyebrow">Цена заклинаний</div>${SPELL_COST_HTML()}</article>
<article class="panel"><div class="eyebrow">Как зарядить</div>${RECHARGE_HTML()}</article></div>
<div class="cards-list" style="margin-top:18px">${(window.CRYSTAL_RULES || []).map(([n, d]) => `<div class="cardrow"><b>${n}</b><p>${d}</p></div>`).join('')}</div>
<p class="note" style="margin-top:16px">Кристаллы делают на люмеритовой станции: Осколок — из сырого Люмерита и стекла, Огранённый и Сердце жилы — из очищенного Люмерита и камней. Рецепты в Крафт-станции.</p>
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Школы</div><h2>Четыре школы</h2></div>
<div class="grid2">${M.schools.map((s, i) => `<article class="panel school-card"><img src="assets/art/school-${['elements', 'matter', 'shadow', 'blood'][i]}.webp" alt=""><div class="eyebrow">Ветвь древа мага</div><h3 style="margin:6px 0 10px;font-size:28px">${s.name}</h3><p class="muted">${s.text}</p></article>`).join('')}</div>
<p style="margin-top:22px"><a class="btn" href="#tree-mage">Открыть древо мага</a></p>
</div></section>`;
}
function pageWorld() {
  return head({ eyebrow: 'Память Лимна', title: 'История мира', lead: 'От Слияния миров до новой эпохи заводов.', bg: 'assets/codex/archive.webp', crumbs: 'Мир' }) + subnav(LORE, 'world') + `
<section class="content"><div class="wrap">
<div class="tbl panel" style="padding:8px 18px"><table><thead><tr><th style="width:120px">Год</th><th>Событие</th></tr></thead><tbody>${M.worldTimeline.map(([y, t]) => `<tr><td class="mono" style="color:var(--house-hi)">${y}</td><td>${t}</td></tr>`).join('')}</tbody></table></div>
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Перекрёстки миров</div><h2>Миры, касающиеся Лимна</h2><p>Те, кто умеет управлять лей-линиями, могут черпать силу этих миров и формировать заклинания, касаясь материи иных реальностей.</p></div>
<div class="grid2">${M.worlds.map(([n, t]) => `<article class="panel"><h3 style="font-size:26px;margin-bottom:8px">${n}</h3><p class="muted">${t}</p></article>`).join('')}</div>
</div></section>`;
}
function pageDeck() {
  return head({ eyebrow: 'Архив необъяснимого', title: 'Проклятая колода', lead: 'Карты Аурица и Варна. Судьба, которой нельзя доверять.', bg: 'assets/codex/deck.webp', crumbs: 'Мир' }) + subnav(LORE, 'deck') + `
<section class="content"><div class="wrap">
<div class="prose" style="margin-bottom:30px"><p>Никто точно не знает, откуда появились колоды Аурица и Варна. Те, кто держал в руках карты Аурица, либо умирали, либо сходили с ума. Сам Ауриц говорит, что астральные карты, если долго их слушать, начинают шептать в ответ.</p></div>
<div class="panel deck-draw"><button class="card3d" id="deckCard" data-nosnd aria-label="Вытянуть карту"><div class="in"><div class="face"><img src="assets/card-back.webp" alt=""></div><div class="face front"><div><span id="deckNum">?</span><b id="deckName">—</b></div></div></div></button>
<div><div class="eyebrow">Бросок 1d50</div><h3 style="font-size:30px;margin:6px 0 10px">Найденная карта</h3><p class="muted" id="deckText">Нажми на колоду: механизм бросит 1d50 и откроет найденную карту вместе с описанием. Карты Аурица нельзя передать или продать, карты Варна можно дарить.</p><p style="margin-top:14px"><button class="btn" id="deckDraw" data-nosnd>Вытянуть карту</button></p></div></div>
${Object.entries(M.decks).map(([k, d]) => `<div class="sec-head" style="margin-top:56px"><div class="eyebrow">${d.note}</div><h2>${d.name}</h2></div>${d.groups.map(([g, cards]) => `<h3 style="font-size:20px;color:var(--house-hi);margin:22px 0 10px">${g}</h3><div class="cards-list">${cards.map(([n, t]) => `<div class="cardrow" data-card="${esc(n)}"><b>${n}</b><p>${t}</p></div>`).join('')}</div>`).join('')}`).join('')}
</div></section>`;
}
function mountDeck() {
  const card = $('#deckCard'); const draw = () => {
    const n = 1 + Math.floor(Math.random() * 50), name = M.deckOrder[n - 1];
    play('card'); card.classList.remove('flip'); void card.offsetWidth;
    setTimeout(() => {
      $('#deckNum').textContent = n; $('#deckName').textContent = name; card.classList.add('flip');
      const row = $$('[data-card]').find(r => r.dataset.card === name);
      $$('.cardrow.hit').forEach(r => r.classList.remove('hit'));
      const deck = Object.values(M.decks).find(d => d.groups.some(([, c]) => c.some(([x]) => x === name)));
      $('#deckText').innerHTML = row ? `<b style="color:var(--parch)">${esc(deck.name)}.</b> ${esc($('p', row).textContent)}` : '';
      if (row) row.classList.add('hit');
    }, 250);
  };
  card.addEventListener('click', draw); $('#deckDraw').addEventListener('click', draw);
}

/* ================= ПРАВИЛА / НАЧАЛО ================= */
function pageRules() {
  const R = (window.RULES || []).filter(r => r.id !== 'discord');
  return head({ eyebrow: 'Свод города', title: 'Правила сервера', lead: 'Начиная игру, вы соглашаетесь со всеми правилами проекта. Незнание правил не освобождает от ответственности.', bg: 'assets/codex/rules.webp', crumbs: 'Правила' }) + `
<section class="content"><div class="wrap">${R.map((r, i) => `<section class="rule-sec" id="r-${r.id}"><h2><span class="n">§ ${i + 1}</span>${r.title}</h2><div class="body">${r.html}</div></section>`).join('')}</div></section>`;
}
function pageDiscord() {
  const r = (window.RULES || []).find(x => x.id === 'discord') || { html: '' };
  return head({ eyebrow: 'Сообщество', title: 'Правила Discord', lead: 'Как общаться на сервере проекта, какие каналы для чего и куда писать администрации.', bg: 'assets/codex/rules.webp', crumbs: 'Правила' }) + `
<section class="content"><div class="wrap"><section class="rule-sec"><h2><span class="n">§</span>Правила сообщества</h2><div class="body">${r.html}</div></section></div></section>`;
}
function pageStart() {
  const steps = [
    ['Познакомься с миром', 'Меттенхейм живёт между двумя заводами и двумя взглядами на будущее. Прочитай о городе, Люмерите и домах Талбот и Дорн.', 'city', 'Открыть город'],
    ['Выбери народ и класс', 'Люди, полуэльфы, дворфы, гоблины или инферналы. Пять классов: Боец, Плут, Маг, Стрелок и Инженер. Посмотри древо развития своего класса. Часть мест ограничена — см. ниже.', 'races', 'Изучить народы'],
    ['Прочитай правила', 'Ознакомься с правилами сообщества и ролевой игры, прежде чем вступать в сцену.', 'rules', 'Правила сервера'],
    ['Собери анкету', 'Выбери сторону, происхождение и предысторию, напиши квенту. Войди в личный кабинет через Discord и отправь квенту мастерам — ответ придёт в кабинет и в личку.', 'anketa', 'Открыть анкету'],
    ['Дождись решения мастеров', 'Мастер прочитает квенту и примет её, вернёт на доработку или отклонит. Решение придёт в кабинет и в личку Discord. После принятия бот откроет тебе личный канал персонажа, выдаст роли и сменит ник на «номер | имя».', 'cabinet', 'Личный кабинет'],
    ['Подключись', 'Сервер работает на Conan Exiles Enhanced (Unreal Engine 5). Модлист собирается — ссылка появится в Discord и на сайте. Если что-то не работает, загляни в FAQ.', 'faq', 'Частые вопросы']
  ];
  return head({ eyebrow: 'Первые шаги', title: 'Как начать играть', lead: 'От знакомства с городом до первой ролевой сцены — шаг за шагом.', bg: 'assets/codex/archive.webp', crumbs: 'Начать' }) + subnav(START_NAV, 'start') + `
<section class="content"><div class="wrap"><div class="panel start-slots"><div class="eyebrow">Ограниченные места</div><h3>Не все роли бесконечны</h3><div class="ss-grid"><div><b>7</b><span>Инферналы</span></div><div><b>7</b><span>Проклятые</span></div><div><b>15</b><span>Гоблины</span></div></div><p class="muted">Счётчики свободных мест — в анкете. Пока квента на проверке, место держится за тобой.</p></div><ol class="steps" style="list-style:none;padding:0;margin:0;max-width:820px">${steps.map(([t, d, r, b], i) => `<li class="panel step reveal" style="animation-delay:${i * 70}ms"><div class="num">${i + 1}</div><div><h3>${t}</h3><p>${d}</p><p style="margin-top:12px"><a class="btn small ghost" href="#${r}">${b}</a></p></div></li>`).join('')}</ol></div></section>`;
}
function pageFaq() {
  return head({ eyebrow: 'Помощь игрокам', title: 'Частые вопросы', lead: 'Собранные вопросы о сервере, персонажах, классах и ремесле.', bg: 'assets/codex/archive.webp', crumbs: 'Начать' }) + subnav(START_NAV, 'faq') + `
<section class="content"><div class="wrap" style="max-width:860px">${M.faq.map(g => `<div class="faq-group"><h3>${g.group}</h3>${g.items.map(([q, a]) => `<details class="qa"><summary>${q}</summary><div><p>${a}</p></div></details>`).join('')}</div>`).join('')}</div></section>`;
}
function pageModlist() {
  const help = [['Mod Mismatch', 'У клиента и сервера должны совпадать одни и те же моды, в том же порядке и тех же версиях. Это самая частая причина ошибки.'], ['Моды не докачались', 'Большие моды могут скачиваться долго. Дождитесь окончания загрузки в Steam Workshop и перезапустите Steam.'], ['Старый кэш модов', 'Отпишитесь от коллекции, перезапустите Steam, подпишитесь заново и дайте модам скачаться начисто.'], ['modlist.txt', 'Если игра зациклилась на ошибке, удаление или пересоздание локального modlist.txt помогает получить актуальный список сервера.'], ['Сервер не виден', 'Из-за провайдера или маршрутизации сервер может не отображаться. Используйте VPN или WARP.'], ['Проверка файлов', 'Если ничего не помогает, проверьте целостность файлов игры в Steam и убедитесь, что Workshop обновился.']];
  return head({ eyebrow: 'Подготовка к игре', title: 'Модлист', lead: 'Список модов и коллекция Steam Workshop для новой сессии.', bg: 'assets/codex/workshop.webp', crumbs: 'Начать' }) + subnav(START_NAV, 'modlist') + `
<section class="content"><div class="wrap">
<img class="wide-art" src="assets/art/head-modlist.webp" alt="">
<div class="grid2"><div class="panel"><div class="eyebrow">Steam Workshop</div><h3 style="font-size:26px;margin:6px 0 10px">Коллекция модов</h3><div class="empty-hint">Ссылка на коллекцию появится здесь</div></div>
<div class="panel"><div class="eyebrow">Сборка Меттенхейма</div><h3 style="font-size:26px;margin:6px 0 10px">Список модов</h3><div class="empty-hint">Модлист новой сессии готовится</div></div></div>
<div class="sec-head" style="margin-top:50px"><div class="eyebrow">Как подключиться</div><h2>Частые проблемы</h2><p>Подпишитесь на коллекцию, дождитесь полной загрузки Workshop, перезапустите Steam и только потом запускайте игру.</p></div>
<div class="grid3">${help.map(([t, d]) => `<div class="panel"><h4 style="font-family:var(--f-display);font-size:20px;font-weight:400;margin-bottom:6px">${t}</h4><p class="muted" style="font-size:15px">${d}</p></div>`).join('')}</div>
</div></section>`;
}

/* ================= НАРОДЫ ================= */
function pageRaces() {
  const R = M.relations;
  return head({ eyebrow: 'Народы Лимна', title: 'Народы нового города', lead: 'Выбери народ и узнай его историю — а потом реши, какую историю начнёшь ты.', bg: 'assets/codex/peoples.webp', crumbs: 'Народы' }) + subnav(PEOPLE_NAV, 'races') + `
<section class="content"><div class="wrap">
<div class="grid2">${M.peoples.map(p => { const o = p.origins[0]; return `<a class="link-card" href="#people-${p.id}" style="min-height:300px"><div class="bg" style="background-image:url('assets/codex/peoples.webp');opacity:.18"></div><img src="${charImg(o.folder, 'male', 'fighter')}" alt="" style="position:absolute;right:0;bottom:0;height:100%;width:auto;max-width:55%;object-fit:contain;z-index:1;filter:drop-shadow(0 0 20px var(--house-glow))"><div style="max-width:55%"><div class="eyebrow">${p.origins.length > 1 ? p.origins.map(x => x.name).join(' · ') : 'Один народ'}</div><h3 style="font-size:34px">${p.name}</h3><p>${p.short}</p></div></a>`; }).join('')}</div>
<div class="sec-head" style="margin-top:70px"><div class="eyebrow">Кто кого терпит</div><h2>Отношения народов</h2><p>Как народы относятся друг к другу в Меттенхейме. Нажми на ячейку, чтобы прочитать подробности. Строка — кто относится, столбец — к кому.</p></div>
<div class="legend" style="margin-bottom:12px"><span class="t-ally">● союз</span><span class="t-calm">● терпимость</span><span class="t-tense">● напряжение</span><span class="t-foe">● вражда</span></div>
<div class="panel rel" style="padding:8px 12px"><table><thead><tr><th></th>${R.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${R.rows.map(([who, ...cells], i) => `<tr><td>${who}</td>${cells.map(([t, l, d], j) => `<td>${t === 'self' ? `<span class="t-self mono" style="font-size:12px">${l}</span>` : `<button class="rel-cell t-${t}" data-rel="${i}-${j}" aria-pressed="false">${l}</button>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<div class="note" id="relOut" style="margin-top:14px">Выбери ячейку таблицы.</div>
</div></section>`;
}
function mountRaces() {
  $$('[data-rel]').forEach(b => b.addEventListener('click', () => {
    const [i, j] = b.dataset.rel.split('-').map(Number), row = M.relations.rows[i], cell = row[j + 1];
    $$('[data-rel]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#relOut').innerHTML = `<b>${row[0]} → ${M.relations.cols[j]}: ${cell[1]}.</b> ${cell[2]}`;
  }));
}
function pagePeople(id) {
  const p = M.peoples.find(x => x.id === id) || M.peoples[0];
  const idx = M.peoples.indexOf(p), next = M.peoples[(idx + 1) % M.peoples.length];
  return head({ eyebrow: 'Народы Лимна', title: p.name, lead: p.short, bg: 'assets/codex/peoples.webp', crumbs: '<a href="#races">Народы</a>' }) + subnav(PEOPLE_NAV, 'people-' + p.id) + `
<section class="content"><div class="wrap">
${p.id === 'goblins' ? '<img class="wide-art" src="assets/art/head-goblins.webp" alt="">' : ''}<div class="prose" style="margin-bottom:30px">${p.about.map(t => `<p class="lead" style="font-size:18px">${t}</p>`).join('')}</div>
${p.origins.length > 1 ? `<div class="origin-tabs" id="oTabs" role="tablist">${p.origins.map((o, i) => `<button class="chip" role="tab" data-ot="${o.id}" aria-pressed="${i === 0}"><img src="${o.emblem}" alt="">${o.name}</button>`).join('')}</div>` : ''}
<div id="oView" style="margin-top:20px"></div>
<p style="margin-top:40px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#anketa">Создать персонажа</a><a class="btn ghost" href="#people-${next.id}">Следующий народ: ${next.name} →</a></p>
</div></section>`;
}
function mountPeople(id) {
  const p = M.peoples.find(x => x.id === id) || M.peoples[0];
  let g = 'male', c = 'fighter';
  const show = oid => {
    const o = p.origins.find(x => x.id === oid) || p.origins[0];
    const pics = []; for (const gg of ['male', 'female']) for (const cc of ['fighter', 'rogue', 'mage', 'shooter', 'engineer']) pics.push([gg, cc]);
    const rk = RACE_KEY[p.id + '-' + o.id];
    $('#oView').innerHTML = `${rk ? `<figure class="race-banner"><img src="assets/races/race-${rk}.webp" alt="${p.name} · ${o.name}" loading="lazy"><figcaption><span class="eyebrow">${p.name}</span><b>${o.name}</b></figcaption></figure>` : ''}<div class="people-hero">
      <div class="reveal" style="display:grid;gap:18px">
        <div><div class="eyebrow">${p.name} · ${o.name}</div><h2 style="font-size:clamp(32px,4vw,48px);margin:6px 0 8px">${o.tagline}</h2><p class="lead" style="font-size:18px">${o.culture}</p></div>
        ${o.stats ? `<div><span class="ctrl-label">Расовые бонусы</span><div class="stat-list">${o.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div></div>` : ''}
        <div class="panel"><span class="ctrl-label">Облик</span>${ul(o.look).replace('<ul>', '<ul style="margin:0;padding-left:18px;color:var(--smoke)">')}</div>
        <div><span class="ctrl-label">Таланты народа · черта, порыв и наследие</span><div class="talents">${o.talents.map(([k, n, d], ti) => `<div class="panel talent${ICO(`talent-${RACE_KEY[p.id + '-' + o.id]}-${ti + 1}`) ? ' has-ic' : ''}">${icoImg(`talent-${RACE_KEY[p.id + '-' + o.id]}-${ti + 1}`, 'tal-ic')}<div class="eyebrow">${k}</div><h4 style="font-family:var(--f-display);font-weight:400;font-size:21px;margin:4px 0">${n}</h4><p class="muted" style="font-size:15px">${d}</p></div>`).join('')}</div></div>
        ${o.houses ? `<div><span class="ctrl-label">${o.houses.length > 1 ? 'Великие дома' : 'Особенность'}</span><div class="${o.houses.length === 4 ? 'grid2' : 'grid3'}">${o.houses.map(([n, d]) => `<div class="panel"><h4 style="font-family:var(--f-display);font-weight:400;font-size:19px;margin-bottom:4px">${n}</h4><p class="muted" style="font-size:14px">${d}</p></div>`).join('')}</div></div>` : ''}
      </div>
      <div><div class="people-stage"><img id="pFig" src="${charImg(o.folder, g, c)}" alt="${o.name}"></div>
        <div class="gallery" style="margin-top:8px">${pics.map(([gg, cc]) => `<button data-pic="${gg}-${cc}" aria-pressed="${gg === g && cc === c}" aria-label="${gg === 'male' ? 'Мужчина' : 'Женщина'}, ${M.classes.find(x => x.id === cc).name}"><img src="${charImg(o.folder, gg, cc)}" alt="" loading="lazy"></button>`).join('')}</div></div>
    </div>`;
    $$('[data-pic]').forEach(b => b.addEventListener('click', () => { [g, c] = b.dataset.pic.split('-'); $('#pFig').src = charImg(o.folder, g, c); $$('[data-pic]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); play('card'); }));
  };
  $$('[data-ot]').forEach(b => b.addEventListener('click', () => { $$('[data-ot]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); show(b.dataset.ot); }));
  show(p.origins[0].id);
}

const ICO = id => (window.MH_ICON && window.MH_ICON(id)) || '';
const icoImg = (id, cls) => ICO(id) ? `<img class="${cls}" src="${ICO(id)}" alt="" loading="lazy">` : '';
const RACE_KEY = { 'humans-west': 'human-west', 'humans-east': 'human-east', 'humans-south': 'human-south', 'humans-mett': 'human-mettenheimer', 'elves-high': 'elf-high', 'elves-wood': 'elf-wood', 'elves-dark': 'elf-drow', 'dwarves-dwarf': 'dwarf', 'goblins-urban': 'goblin-urban', 'goblins-tribal': 'goblin-tribal', 'infernals-fire': 'infernal-fire', 'infernals-ice': 'infernal-ice' };
const KIND_ICON = { 'ОСН': 'act-main', 'ДОП': 'act-bonus', 'РЕАКЦИЯ': 'act-reaction', 'ПАС': 'act-passive' };
const RES_ICON = { fighter: 'res-temper', rogue: 'res-cunning', mage: 'res-charge', shooter: 'res-focus', engineer: 'res-parts' };
const STATUS_ICON = { 'Отравление': 'st-poison', 'Кровотечение': 'st-bleed', 'Горение': 'st-burn', 'Обморожение': 'st-frost', 'Без сознания': 'st-unconscious', 'Связан': 'st-bound', 'Оглушение': 'st-stun', 'Очарование': 'st-charm', 'Истощение': 'st-exhaust', 'Усталость': 'st-exhaust', 'Страх': 'st-fear' };
const TURN_ICON = ['act-main', 'act-bonus', 'act-move'];

/* ================= КЛАССЫ / СИСТЕМЫ ================= */
function pageClasses(id) {
  return head({ eyebrow: 'Пять путей', title: 'Классы', lead: 'У каждого класса свои способности и стартовая точка на общем древе развития. Маг развивается по четырём школам.', bg: 'assets/codex/arcane-v2.webp', crumbs: 'Классы' }) + subnav(CLS_NAV, 'classes') + `
<section class="content"><div class="wrap"><div class="class-tabs" role="tablist">${M.classes.map(c => `<button class="class-tab" role="tab" data-cls="${c.id}" aria-selected="${c.id === (id || 'fighter')}"><img src="${c.emblem}" alt="">${c.name}${c.isNew ? ' <span class="tag house">новый</span>' : ''}</button>`).join('')}</div><div id="clsView"></div></div></section>`;
}
function mountClasses(id) {
  let g = 'male';
  const show = cid => {
    const c = M.classes.find(x => x.id === cid) || M.classes[0];
    $$('[data-cls]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cls === c.id)));
    $('#clsView').innerHTML = `<div class="class-view reveal"><div class="class-art"><img id="cFig" src="${charImg('mettenheimer', g, c.id)}" alt="${c.name}"></div>
    <div class="class-info"><div class="eyebrow">Класс${c.isNew ? ' · новый в этой сессии' : ''}</div><h2>${c.name}</h2>
      <div class="facts"><div><small>Роль</small><b>${c.role}</b></div><div><small>Ресурс</small><b>${c.resource}</b></div><div><small>Дистанция</small><b>${c.range}</b></div></div>
      <p class="lead" style="font-size:18px">${c.text}</p>
      <div><span class="ctrl-label">Кубы класса — их качают малые узлы древа</span><div class="chips">${(c.cubes || []).map(s => `<span class="chip">${s}</span>`).join('')}</div></div>
      <div><span class="ctrl-label">${c.id === 'mage' ? 'Базовые плетения' : 'Способности класса'}</span><div class="abilities">${c.abilities.map(([n, k, d], i) => `<div class="ability${ICO(`ability-${c.id}-${i + 1}`) ? ' has-ic' : ''}">${icoImg(`ability-${c.id}-${i + 1}`, 'ab-ic')}<div><span class="k">${icoImg(k === 'РЕСУРС' ? RES_ICON[c.id] : KIND_ICON[k], 'k-ic')}${String(i + 1).padStart(2, '0')} · ${k}</span><b>${n}</b><p>${d}</p></div></div>`).join('')}</div></div>
      ${c.schools ? `<div><span class="ctrl-label">Школы развития</span><div class="chips">${c.schools.map(s => `<span class="chip">${s}</span>`).join('')}</div></div>` : `<div><span class="ctrl-label">Развитие</span><p class="muted">Класс задаёт стартовую точку на общем древе. Дальше персонаж берёт общие способности и может уйти в ветви других классов.</p></div>`}
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#tree-${c.id}">Древо талантов</a><button class="btn ghost" id="cSwap">Показать ${g === 'male' ? 'женский' : 'мужской'} образ</button></div>
    </div></div>`;
    $('#cSwap').addEventListener('click', () => { g = g === 'male' ? 'female' : 'male'; show(c.id); });
  };
  $$('[data-cls]').forEach(b => b.addEventListener('click', () => { play('card'); history.replaceState(null, '', '#class-' + b.dataset.cls); show(b.dataset.cls); }));
  show(id || 'fighter');
}
function pageTree() { return `<h1 class="sr-only">Древо талантов</h1><div id="treeMount"></div>`; }
function pageHealing() { return head({ eyebrow: 'Системы · лекарь', title: 'Лекари и травмы', lead: 'После боя в Меттенхейме остаются не только шрамы. Травмы бывают лёгкие, средние и тяжёлые, а лекари — трёх тиров: чем выше тир, тем больше коек и тем тяжелее раны, которые он берёт без риска.', bg: 'assets/codex/faith.webp', crumbs: 'Классы и системы' }) + subnav(CLS_NAV, 'healing') + `<section class="content"><div class="wrap" id="healMount"></div></section>`; }
function pageEloquence() { return head({ eyebrow: 'Системы · социальные сцены', title: 'Красноречие', lead: 'Как тебя слушают, зависит от того, как ты выглядишь. Бросок — d20, а одежда задаёт к нему бонус, духи и баня дают временный +1, а украшения — особые умения и бонус за полный комплект.', bg: 'assets/codex/history.webp', crumbs: 'Классы и системы' }) + subnav(CLS_NAV, 'eloquence') + `<section class="content"><div class="wrap" id="eloqMount"></div></section>`; }
/* ---------- Характеристики (кубы) ---------- */
const STATS = [
  ['Боевые навыки', 'Насколько хорошо персонаж сражается.', [
    ['Атака', 'Атака оружием и немагическими навыками.'],
    ['Защита', 'Защита от немагических атак.'],
    ['Магия', 'Атака заклинаниями и магическим оружием.'],
    ['Маг. защита', 'Защита от магии и магического оружия.'],
    ['Инициатива', 'Скорость реакции и очередь хода в бою.']]],
  ['Тело', 'Физическое развитие.', [
    ['Атлетичность', 'Сила рук и ног, захваты, переноска тяжестей, прыжки.'],
    ['Ловкость', 'Лазанье, акробатика, отмычки и взлом замков, карманные кражи.'],
    ['Скрытность', 'Оставаться незамеченным, прятаться, бесшумно двигаться.'],
    ['Стойкость', 'Терпеть боль, держать удар: Оглушение, сбивание с ног, тяжёлые травмы.'],
    ['Иммунитет', 'Сопротивление ядам, болезням, Гнили, смогу, интоксикации и мутагенам.', 1]]],
  ['Разум', 'Знания и умения.', [
    ['Образование', 'История, языки, математика, чертежи, знание мира.'],
    ['Ремесло', 'Создание предметов, ловушек, оружия, брони, еды и зелий.'],
    ['Механика', 'Машины, паровые механизмы, Люмерит, протезы, конструкты, механические замки и ловушки.', 1],
    ['Медицина', 'Лечение, травмы, яды и противоядия.'],
    ['Красноречие', 'Убеждение и торговля. Растёт только от одежды и украшений.'],
    ['Запугивание', 'Напугать, надавить, заставить отступить.']]],
  ['Воля', 'Сила духа.', [
    ['Собранность', 'Держать бой под ударами и в стрессе — против людей и против чудовищ. Порог 13, если атака врага 16+, помеха на следующую Атаку и Защиту при провале.'],
    ['Самообладание', 'Сопротивление страху, внушению, ментальной магии, голосу проклятия и Порче.', 1],
    ['Внимательность', 'Заметить важное, найти скрытое, распознать ложь и дурные намерения.']]]
];
const DICE_RULES = [
  ['d20 + куб', 'Любая проверка — d20 плюс бонус нужного куба. Порог назначает мастер: 10 — легко, 13 — обычно, 16 — трудно, 18+ — почти невозможно. 20 — крит, 1 — провал.'],
  ['Урон', 'Урон считается в ЕУ. Оружие и способности могут добавлять 1d4 или 1d6 сверху — других кубов урона нет.'],
  ['Удача', 'Отдельный главный атрибут без навыков. Кубик Удачи — d20 + Удача, когда исход решает случай: находка, осечка, повезло или нет.'],
  ['Рулетка', 'Для чистого случая — 1d100: игрок заранее говорит «больше 50» или «меньше 50». Угадал — исход в его пользу.'],
  ['Кап +10', 'Бонус к любому кубу из всех источников вместе — раса, древо, предметы, еда, зелья, протезы — не выше +10. Лишнее сгорает.'],
  ['Ресурсы', 'ОЗ 10, ОВ 10, ОД 4 тайла у всех на старте. Растут от брони, древа и проклятий.']
];
function statsHTML() {
  return `<div class="st-grid">${STATS.map(([a, d, list]) => `<article class="panel st-card"><div class="eyebrow">Атрибут</div><h3>${a}</h3><p class="muted" style="font-size:14px;margin:0 0 10px">${d}</p>${list.map(([n, t, isNew]) => `<div class="st-row"><b>${n}${isNew ? ' <em class="st-new">новый</em>' : ''}</b><span>${t}</span></div>`).join('')}</article>`).join('')}
    <article class="panel st-card st-luck"><div class="eyebrow">Главный атрибут</div><h3>Удача</h3><p class="muted" style="font-size:14px">Без навыков. Бросается отдельно, когда исход решает случай, а не умение. Её почти ничто не поднимает: Удача — редкая награда.</p></article></div>`;
}
function pageSystem() {
  return head({ eyebrow: 'Справочник сцены', title: 'Ролевая система', lead: 'Кубы, характеристики, ход и состояния. Найди нужное правило прямо во время сцены.', bg: 'assets/codex/deck.webp', crumbs: 'Классы' }) + subnav(CLS_NAV, 'system') + `
<section class="content"><div class="wrap">
<div class="sec-head"><div class="eyebrow">Как бросаем</div><h2>Кубы и проверки</h2><p>Основной кубик один — d20 с плюсами. Сверху — только 1d4 и 1d6 урона, а для случая — Удача и рулетка 1d100.</p></div>
<div class="cards-list">${DICE_RULES.map(([n, d]) => `<div class="cardrow"><b>${n}</b><p>${d}</p></div>`).join('')}</div>
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Характеристики</div><h2>Атрибуты и навыки</h2><p>Каждый навык — это куб: бонус, который прибавляется к d20. Бонус к атрибуту целиком (+1 к Телу) добавляется ко всем его навыкам.</p></div>
${statsHTML()}
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Структура хода</div><h2>Действия в ходу</h2><p>Каждый игрок в бою получает несколько типов действий. Некоторые способности требуют основное или дополнительное действие.</p></div>
<div class="grid3">${M.turn.map(([t, d], i) => `<div class="panel">${icoImg(TURN_ICON[i], 'turn-ic')}<div class="eyebrow">${i + 1} из 3</div><h3 style="font-size:24px;margin:6px 0 8px">${t}</h3><p class="muted">${d}</p></div>`).join('')}</div>
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Статусы</div><h2>Состояния персонажа</h2><p>На персонаже может находиться не более двух дебаффов одновременно.</p></div>
${M.statuses.map(g => `<h3 style="font-size:20px;color:var(--house-hi);margin:20px 0 10px">${g.group}</h3><div class="cards-list">${g.items.map(([n, d]) => `<div class="cardrow${ICO(STATUS_ICON[n]) ? ' has-ic' : ''}">${icoImg(STATUS_ICON[n], 'st-ic')}<b>${n}</b><p>${d}</p></div>`).join('')}</div>`).join('')}
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Фракционная репутация</div><h2>Талбот и Дорн</h2><p>Город помнит, на чью сторону вы встали. Репутация у Домов открывает одни двери и закрывает другие.</p></div>
<div class="grid2">${['talbot', 'dorn'].map(k => `<article class="panel"><img src="${M.houses[k].flag}" alt="" style="width:100%;height:120px;object-fit:cover;opacity:.6;margin-bottom:14px"><div class="eyebrow">${M.houses[k].side}</div><h3 style="font-size:26px;margin:6px 0 10px">Репутация: ${M.houses[k].name}</h3><div class="empty-hint">Ступени, награды и цена репутации будут описаны позже</div></article>`).join('')}</div>
<div class="sec-head" style="margin-top:60px"><div class="eyebrow">Механизм случая</div><h2>Кубики</h2></div>
${diceHTML()}
</div></section>`;
}
function pageForge() { return head({ eyebrow: 'Мастерская · заготовка', title: 'Оружейная', lead: 'Выбери оружие, поставь особые улучшения в слоты и подбери боеприпас. Урон считается в ЕУ, дистанция — в тайлах, способности оружие получает только от улучшений.', bg: 'assets/codex/workshop-v2.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'forge') + `<section class="content"><div class="wrap" id="forgeMount"></div></section>`; }
function pageBody() { return head({ eyebrow: 'Мастерская · протезист', title: 'Протезы и конструкты', lead: 'Меттенхейм чинит людей так же, как машины. Живым ставят протезы и импланты — от простой руки до нейроускорителя, — пока тело выдерживает нагрузку. Конструкты меняют детали целиком: ядро, каркас, оптику, руки.', bg: 'assets/codex/workshop-v2.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'body') + `<section class="content"><div class="wrap" id="bodyMount"></div></section>`; }
function pageCurses() { return head({ eyebrow: 'Системы · уникальность', title: 'Развитие Проклятых', lead: 'Проклятие растёт, когда им пользуются. Пять ступеней: каждая даёт силу и берёт свою цену. Сдержать рост можно, повернуть назад — нет.', bg: 'assets/codex/deck.webp', crumbs: 'Классы и системы' }) + subnav(CLS_NAV, 'curses') + `<section class="content"><div class="wrap" id="curseMount"></div></section>`; }
function pageInventions() { return head({ eyebrow: 'Системы · инженер', title: 'Изобретения', lead: 'Инженер не берёт механизмы из каталога — он их изобретает. Правила задают слоты, силу и цену, а как работает машина, придумываете вы. Помощник, боевая турель, автоматон в кейсе.', bg: 'assets/codex/workshop-v2.webp', crumbs: 'Классы и системы' }) + subnav(CLS_NAV, 'inventions') + `<section class="content"><div class="wrap"><article class="panel"><div class="eyebrow">Как создаётся изобретение</div>${kvRows(window.INV_RULES || [])}</article><div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Верстак изобретателя</div><h2>Твои чертежи</h2><p>Выбери тир, заполни слоты и скопируй заявку для мастера. Черновик сохраняется в браузере.</p></div><div id="invMount"></div></div></section>`; }
function pageFactions() { return head({ eyebrow: 'Системы · Дома', title: 'Фракции', lead: 'Игроки приносят Дому очки фракции, и всё идёт в общий пул. Уровни пула открывают то, чем Дом силён: у Талботов — протезы, у Дорна — материалы для оружия.', bg: 'assets/codex/housing.webp', crumbs: 'Классы и системы' }) + subnav(CLS_NAV, 'factions') + `<section class="content"><div class="wrap" id="factionMount"></div></section>`; }
function pageCooking() { return head({ eyebrow: 'Мастерская · повар', title: 'Кулинария', lead: 'Кухня города пара: от заводского кренделя до стола Домов. Брось в котелок продукты и заготовки — еда снимает Голод и даёт бафы на несколько часов.', bg: 'assets/codex/housing.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'cooking') + `<section class="content"><div class="wrap" id="cookMount"></div></section>`; }
function pageAlchemy() { return head({ eyebrow: 'Мастерская · алхимик', title: 'Алхимия', lead: 'Ремесленник куёт металл, алхимик варит то, что меняет тело и разум. Положи в колбу два-три компонента и свари зелье.', bg: 'assets/codex/arcane-v2.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'alchemy') + `<section class="content"><div class="wrap" id="alchMount"></div></section>`; }
function pageGathering() { return head({ eyebrow: 'Мастерская · добыча', title: 'Инструменты добычи', lead: 'Чем рубить, копать, срезать и разделывать. Простой инструмент на каждое дело, улучшенный — вдвое больше и доступ к редкому, а паровой бур перерабатывает руду прямо в забое.', bg: 'assets/codex/workshop.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'gathering') + `<section class="content"><div class="wrap" id="gatherMount"></div></section>`; }
function pageBlueprints() { return head({ eyebrow: 'Мастерская · знания', title: 'Чертежи ремёсел', lead: 'Станция и материалы — ещё не всё. Каждая вещь тратит чертёж своего ремесла и тира: один чертёж — одно изделие. Шесть ремёсел, три тира. Чертежи покупают, добывают, копируют и выбивают при разборке.', bg: 'assets/codex/workshop.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'blueprints') + `<section class="content"><div class="wrap" id="bpMount"></div></section>`; }
function pageRecycle() { return head({ eyebrow: 'Мастерская · ресурсы', title: 'Переработчик', lead: 'Брось сырьё в бункер — машина разберёт его на материалы. Полученное можно перерабатывать дальше. Шансы и выходы черновые.', bg: 'assets/codex/workshop-v2.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'recycle') + `<section class="content"><div class="wrap" id="recycleMount"></div></section>`; }
function pageCraft() { return head({ eyebrow: 'Мастерская · каталог', title: 'Крафт-станция', lead: 'Всё оружие, броня, улучшения и боеприпасы в одном месте — и на какой станции их делают. Рецепты появятся вместе с каталогом материалов.', bg: 'assets/codex/workshop.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'craft') + `<section class="content"><div class="wrap" id="craftMount"></div></section>`; }
function pageArmor() { return head({ eyebrow: 'Мастерская · заготовка', title: 'Бронник', lead: 'Выбери корпус — лёгкий, средний или тяжёлый — и навесь на него детали: наручи, наплечники, нагрудную пластину, поножи и накладки. У каждого корпуса своя особенность и своя уникальная деталь.', bg: 'assets/codex/workshop.webp', crumbs: 'Мастерская' }) + subnav(CLS_NAV, 'armor') + `<section class="content"><div class="wrap" id="armorMount"></div></section>`; }

/* ================= РОУТЕР ================= */
function pageInferno() { return head({ eyebrow: 'Народы · инферналы', title: 'Инферно и Короли', lead: 'Мир под миром. Десять великих Домов, десять грехов — и голод, который инфернал приносит с собой в Меттенхейм.', bg: 'assets/codex/peoples.webp', crumbs: 'Народы' }) + subnav(PEOPLE_NAV, 'inferno') + `<section class="content"><div class="wrap">${window.Inferno.pageHTML()}</div></section>`; }
function pageNews() { return head({ eyebrow: 'Город · на связи', title: 'Новости и события', lead: 'Анонсы из нашего Discord и календарь событий сервера. Записаться на событие можно одним нажатием.', bg: 'assets/codex/city-v2.webp', crumbs: 'Начало' }) + `<section class="content"><div class="wrap" id="newsMount"></div></section>`; }
function pageHero() { return head({ eyebrow: 'Перепись Меттенхейма', title: 'Личное дело', lead: 'Открытая карточка жителя города. Квента и данные игрока остаются у мастеров.', bg: 'assets/codex/city-v2.webp', crumbs: 'Жители' }) + `<section class="content"><div class="wrap" id="heroMount"></div></section>`; }
function pageGlossary() {
  return head({ eyebrow: 'Справочник', title: 'Словарь терминов', lead: 'Короткие объяснения слов, которые встречаются в лоре и правилах Меттенхейма.', bg: 'assets/codex/archive.webp', crumbs: 'Начало' }) + `
<section class="content"><div class="wrap" style="max-width:980px"><div class="panel gl-tools"><input type="search" id="glQ" placeholder="Найти термин…" aria-label="Поиск по словарю"><span class="muted" id="glN"></span></div>
<div class="gl-list" id="glList">${M.glossary.map(([t, cat, d, link]) => `<article class="panel gl-item" data-gl="${esc((t + ' ' + d).toLowerCase())}"><div class="eyebrow">${cat}</div><h3>${t}</h3><p>${d}</p>${link ? `<a href="#${link}">Подробнее →</a>` : ''}</article>`).join('')}</div></div></section>`;
}
function mountGlossary() {
  const inp = $('#glQ'), items = $$('[data-gl]'), n = $('#glN');
  const f = () => { const v = inp.value.trim().toLowerCase(); let k = 0; items.forEach(i => { const ok = !v || i.dataset.gl.includes(v); i.hidden = !ok; k += ok; }); n.textContent = `${k} из ${items.length}`; };
  inp.addEventListener('input', f); f();
}
function pageChronicle() {
  return head({ eyebrow: 'Летопись игроков', title: 'Хроника сессии', lead: 'Что уже произошло в мире: сюжетные ветки, которые вели игроки и мастера. Читай, чтобы догнать историю.', bg: 'assets/codex/history.webp', crumbs: 'Мир' }) + subnav(LORE, 'chronicle') + `
<section class="content"><div class="wrap">${M.chronicle.map(b => `<article class="panel chr-branch" id="chr-${b.id}"><div class="eyebrow">${b.tag}</div><h2>${b.title}</h2><p class="lead">${b.lead}</p>${b.parts.map(([h, t]) => `<h3>${h}</h3><p>${t}</p>`).join('')}${b.open ? `<p class="note">${b.open}</p>` : ''}</article>`).join('')}</div></section>`;
}
function pageChat() { return head({ eyebrow: 'Город · на связи', title: 'Общий чат', lead: 'Один чат на сайт и Discord: пиши отсюда — сообщение увидят на сервере, ответы с сервера появятся здесь.', bg: 'assets/codex/city-v2.webp', crumbs: 'Начало' }) + `<section class="content"><div class="wrap" id="chatMount"></div></section>`; }
function pageResidents() { return head({ eyebrow: 'Город · перепись', title: 'Жители Меттенхейма', lead: 'Все персонажи, чьи квенты приняли мастера. Ищи соседей, союзников и врагов для своей истории.', bg: 'assets/codex/city-v2.webp', crumbs: 'Начало' }) + `<section class="content"><div class="wrap" id="rsMount"></div></section>`; }
function pageCabinet(mode) { const adm = mode === 'admin'; return head({ eyebrow: adm ? 'Для мастеров' : 'Для игроков', title: adm ? 'Кабинет мастера' : 'Личный кабинет', lead: adm ? 'Очередь отправленных квент. Прочитай, оставь комментарий и вынеси решение — игрок увидит его у себя в кабинете.' : 'Твои персонажи и квенты в одном месте. Пиши черновик, отправляй на проверку и получай ответ мастеров прямо здесь.', bg: 'assets/codex/history.webp', crumbs: adm ? 'Кабинет мастера' : 'Кабинет' }) + `<section class="content"><div class="wrap" id="cabMount"></div></section>`; }
const ROUTES = {
  home: [pageHome, mountHome], anketa: [pageHome, mountHome],
  chat: [pageChat, () => window.Cabinet.chat($('#chatMount'))],
  news: [pageNews, () => window.Cabinet.news($('#newsMount'))],
  hero: [pageHero, n => window.Cabinet.hero($('#heroMount'), n)],
  glossary: [pageGlossary, mountGlossary], chronicle: [pageChronicle],
  residents: [pageResidents, () => window.Cabinet.residentsPage($('#rsMount'))],
  inferno: [pageInferno, () => window.Inferno.mountDiary($('#hungerMount'))],
  cabinet: [() => pageCabinet('player'), () => window.Cabinet.mount($('#cabMount'), 'player')], admin: [() => pageCabinet('admin'), () => window.Cabinet.mount($('#cabMount'), 'admin')],
  city: [pageCity], history: [pageHistory], houses: [pageHouses, () => { $$('[data-pick]').forEach(b => b.addEventListener('click', () => { if (b.dataset.pick !== house) applyHouse(b.dataset.pick, true); })); setVars(); MH.onHouse(hcards); }],
  lumerite: [pageLumerite], faith: [pageFaith], magic: [pageMagic, () => window.Crystal.mount($('#crystalMount'))], world: [pageWorld], deck: [pageDeck, mountDeck],
  rules: [pageRules], discord: [pageDiscord], start: [pageStart], faq: [pageFaq], modlist: [pageModlist],
  races: [pageRaces, mountRaces], classes: [pageClasses, mountClasses], system: [pageSystem, () => mountDice($('[data-dice]').parentElement)], eloquence: [pageEloquence, () => window.Eloquence.mount($('#eloqMount'))], healing: [pageHealing, () => window.Healing.mount($('#healMount'))],
  tree: [pageTree], forge: [pageForge, () => window.Forge.mount($('#forgeMount'))], armor: [pageArmor, () => window.Armor.mount($('#armorMount'))], craft: [pageCraft, () => window.Craft.mount($('#craftMount'))], gathering: [pageGathering, () => window.Gathering.mount($('#gatherMount'))], blueprints: [pageBlueprints, () => window.Blueprints.mount($('#bpMount'))], recycle: [pageRecycle, () => window.Recycler.mount($('#recycleMount'))], alchemy: [pageAlchemy, () => window.Alchemy.mount($('#alchMount'))], cooking: [pageCooking, () => window.Cooking.mount($('#cookMount'))], body: [pageBody, () => window.BodyLab.mount($('#bodyMount'))], curses: [pageCurses, () => window.CurseLab.mount($('#curseMount'))], factions: [pageFactions, () => window.Factions.mount($('#factionMount'))], inventions: [pageInventions, () => window.Inventor.mount($('#invMount'))]
};
function resolve(raw) {
  let key = raw, arg = null;
  const m = raw.match(/^(rules|people|class|tree|hero)-(.+)$/);
  if (m) { key = m[1] === 'class' ? 'classes' : m[1]; arg = m[2]; }
  if (key === 'rules' && arg === 'discord') { key = 'discord'; arg = null; }
  const chapter = key === 'people' ? 'people-' + arg : key;
  return { key, arg, chapter };
}
function renderChapter(id) {
  const { key, arg } = resolve(id);
  if (key === 'people') return pagePeople(arg);
  return (ROUTES[key] || ROUTES.home)[0](arg);
}
/* оборачивает главу в книжный разворот: оглавление слева, текст, «на странице» справа, листание внизу */
function bookify(view, chapter) {
  const content = $('section.content', view); if (!content) return;
  $$('.subnav', view).forEach(n => n.remove());
  const inner = content.firstElementChild; inner.classList.remove('wrap');
  const k = CHAPTERS.findIndex(c => c.id === chapter), prev = CHAPTERS[k - 1], next = CHAPTERS[k + 1];
  const doc = document.createElement('div'); doc.className = 'doc wrap';
  doc.innerHTML = `<aside class="rail" aria-label="Оглавление">${bookTOC(chapter)}</aside><article class="doc-main"></article><aside class="doc-toc" aria-label="На странице"></aside>`;
  const main = $('.doc-main', doc); main.append(inner);
  const pager = document.createElement('nav'); pager.className = 'pager';
  pager.innerHTML = `${prev ? `<a href="#${prev.id}"><small>‹ Назад · ${prev.part}</small><b>${prev.t}</b></a>` : '<span></span>'}${next ? `<a class="nx" href="#${next.id}"><small>${next.part} · Дальше ›</small><b>${next.t}</b></a>` : `<a class="nx" href="#anketa"><small>Готов? ›</small><b>Анкета персонажа</b></a>`}`;
  main.append(pager);
  content.replaceChildren(doc);
  // «На странице»
  const hs = $$('h2', main).filter(h => !h.closest('.pager'));
  const toc = $('.doc-toc', doc);
  if (hs.length > 1) {
    hs.forEach((h, i) => h.id = h.id || `${chapter}-s${i}`);
    toc.innerHTML = `<div class="k">На странице</div>` + hs.map(h => `<a href="#${chapter}" data-to="${h.id}">${esc(h.textContent.replace(/^§\s*\d*/, ''))}</a>`).join('');
    $$('a', toc).forEach(a => a.addEventListener('click', e => { e.preventDefault(); $('#' + a.dataset.to).scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('a', toc).forEach(a => a.classList.toggle('on', a.dataset.to === e.target.id)); }), { rootMargin: '-20% 0px -70% 0px' });
    hs.forEach(h => io.observe(h));
  } else doc.classList.add('no-toc');
  // текущая глава видна в оглавлении
  const curA = $('.rail [aria-current]', doc); if (curA) setTimeout(() => curA.scrollIntoView({ block: 'nearest' }), 0);
}
let lastRoute = null;
/* тяжёлые арты (предметы ~5 МБ, иконки ~2 МБ) грузятся только для страниц, где они нужны */
const LIGHT = new Set(['home', 'anketa', 'cabinet', 'admin', 'residents', 'chat', 'news', 'hero', 'glossary', 'chronicle', 'city', 'history', 'houses', 'lumerite', 'faith', 'world', 'rules', 'discord', 'start', 'faq', 'modlist', 'inferno', 'races']);
const ART_V = ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('?')[1] || '';
let artP = null;
const loadArt = () => artP || (artP = Promise.all(['items-art.js', 'icons-art.js'].map(f => new Promise((res, rej) => {
  const sc = document.createElement('script'); sc.src = f + (ART_V ? '?' + ART_V : ''); sc.onload = res; sc.onerror = () => { artP = null; rej(); }; document.head.appendChild(sc);
}))));
MH.loadArt = loadArt;
function route() {
  const raw = (location.hash || '#home').slice(1) || 'home';
  const { key, arg, chapter } = resolve(raw);
  if (!LIGHT.has(key) && !window.ICON_ART_DATA) {
    $('#view').innerHTML = '<div class="art-loading"><img src="assets/gear-md.webp" alt=""><p>Механизм прогревается…</p></div>';
    loadArt().then(route, () => { $('#view').innerHTML = '<div class="art-loading"><p>Не удалось загрузить страницу. Проверь интернет и обнови.</p></div>'; });
    return;
  }
  if (key === 'people') ROUTES.people = [() => pagePeople(arg), () => mountPeople(arg)];
  const r = ROUTES[key] || ROUTES.home;
  houseHooks = []; currentRoute = chapter;
  const view = $('#view');
  view.innerHTML = r[0](arg);
  if (CHAPTERS.some(c => c.id === chapter) && key !== 'tree') bookify(view, chapter);
  r[1] && r[1](arg);
  if (chapter === 'people-infernals') { const m = $('.doc-main', view) || $('section.content .wrap', view); if (m) m.insertAdjacentHTML('afterbegin', `<div class="slot-box" data-slot="infernal"></div><p class="note" style="margin:0 0 22px">Короли, грехи и голод инферналов — в главе <a href="#inferno">Инферно и Короли</a>.</p>`); }
  if (chapter === 'people-goblins') { const m = $('.doc-main', view) || $('section.content .wrap', view); if (m) m.insertAdjacentHTML('afterbegin', '<div class="slot-box" data-slot="goblin"></div>'); }
  if (chapter === 'curses') { const m = $('.doc-main', view); if (m) m.insertAdjacentHTML('afterbegin', '<div class="slot-box" data-slot="curse"></div>'); }
  window.Cabinet && window.Cabinet.fillSlots(view);
  if ((key === 'home' || key === 'anketa') && window.Cabinet) window.Cabinet.anketaStatus($('#bStatus'));
  if ((key === 'home' || key === 'anketa') && window.Cabinet) { window.Cabinet.community($('#commMount')); window.Cabinet.live($('#liveMount')); }
  const cb = $('#cabBtn'); if (cb) { if (key === 'cabinet' || key === 'admin') cb.setAttribute('aria-current', 'page'); else cb.removeAttribute('aria-current'); }
  document.body.classList.toggle('tree-mode', key === 'tree');
  if (key === 'tree') window.Tree.mount($('#treeMount'), arg || 'fighter');
  if (key === 'anketa') setTimeout(() => $('#builder').scrollIntoView({ behavior: 'smooth' }), 60);
  else if (!(lastRoute === 'tree' && key === 'tree')) scrollTo({ top: 0, behavior: 'instant' });
  markNav(raw);
  document.title = key === 'home' ? 'Хроники Меттенхейма' : ($('h1', view)?.textContent || '') + ' · Хроники Меттенхейма';
  $('#drawer').hidden = true; $('.pal')?.remove();
  lastRoute = key;
}
addEventListener('hashchange', route);
route();
})();
