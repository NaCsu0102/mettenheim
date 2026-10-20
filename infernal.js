/* Инферно: голод эмоциями, Эссенция, дневник голода. Короли — в data.js (M.kings). */
(() => {
'use strict';
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FEED_STEPS = [
  ['Учуять', 'Чутьё греха', 'Вы видите след греха своего Дома на людях и в местах: огненные — как жар, ледяные — как иней. Спросите мастера или игрока, какой след на цели: нет, слабый, яркий или пылающий. Внимательность 13 — понять, к чему эмоция привязана.'],
  ['Раздуть', 'Подтолкнуть', 'Отыграйте искушение, укол или угрозу. d20 + Красноречие (похоть, обман, жадность, гордыня, зависть, чревоугодие, лень) или Запугивание (страх, гнев, отчаяние) против Самообладания цели. Успех — след на ступень ярче.'],
  ['Вкусить', 'Питание', 'На пике эмоции — взглядом или касанием в 2 тайлах. Слабый след даёт 1 порцию, яркий — 2, пылающий — 3. С одной цели — раз в сцену. Каждая порция сначала снимает 1 Голод, остаток уходит в Эссенцию.'],
  ['Опустошение', 'Цена для цели', 'Эмоция гаснет до конца сцены. Цель чувствует пустоту и холод: −1 к следующему броску Самообладания. Та же цель снова — только в следующей сцене.']
];
const HUNGER = [
  ['Сыт', 'Без штрафов.'],
  ['Голоден', '−1 к Красноречию и Запугиванию. Голод виден в глазах.'],
  ['Истощён', '−2 к Красноречию, Запугиванию и Магии. Дар Дома недоступен.'],
  ['Одичание', 'Маска спадает: рога, глаза и следы печати видны. В каждой сцене с источником эмоции — Самообладание 14, иначе вы кормитесь немедленно, где бы ни были.']
];
const HUNGER_RULES = [
  ['Рост голода', '+1 Голод за каждый игровой день без питания. Максимум — Одичание.'],
  ['Эссенция', 'Хранится до 5. Сгорает только тратами.'],
  ['Почему они голодны', 'Печать была источником силы. В Лимн её не пронести через грань миров, поэтому здесь сила инфернала — только то, что он съел.'],
  ['Согласие', 'Питаться персонажем другого игрока можно только с его согласия вне игры. НПС — по решению мастера.']
];
const SPEND_ALL = [
  ['Дар Дома', '1–2', 'Особое умение вашего Короля — в карточке Дома.'],
  ['Закрыть рану', '1', 'Восстановить 1d4 ОЗ.'],
  ['Удержать маску', '1', 'На одну сцену скрыть Одичание. Голод при этом не снижается.']
];
const SPEND_FIRE = [
  ['Иллюзорная печать', '1', 'Ложный образ или звук в 5 тайлах до конца сцены. Внимательность 14 — распознать.'],
  ['Портальная печать', '2', 'Начертить печать-якорь. Позже за 2 Эссенции — шагнуть к ней с любого места в городе.'],
  ['Разрушающая печать', '2', 'Огненная ловушка 2×2 тайла: +1d6 урона огнём и Горение тому, кто войдёт.'],
  ['Сделка', '—', 'Не тратит, а приносит Эссенцию: 1–3 порции, по цене сделки. Ценность утверждает мастер.']
];
const SPEND_ICE = [
  ['Иней', '1', 'Цель в 3 тайлах теряет 1 тайл движения на ход.'],
  ['Предчувствие', '1', '+2 к Инициативе на этот бой.'],
  ['Проклятие слабости', '2', 'Тёмная магия, не у всех ледяных. Цель теряет 2 от одного куба до конца сцены. Маг. защита 14 — устоять.'],
  ['Ледяная броня', '2', '+2 к Защите до конца следующего хода.']
];
const BOND = {
  spy: ['Шпион · связь жива', 'С каждого питания 1 порция уходит Королю. Раз в сессию Король зовёт: мастер передаёт приказ или помощь. Король всегда знает, где вы. Ослушаться приказа — +2 Голод.'],
  renegade: ['Отступник · связь порвана', 'Всё добытое — ваше. Но Дар Дома стоит на 1 Эссенцию дороже, а когда вы дичаете, охотники Короля чуют след.']
};
const DEALS = {
  can: ['Исполнить почти любое желание в обмен на равноценную цену', 'Обратить смертную душу в силу Хаоса и так создать нового инфернала'],
  cannot: ['Заставить кого-то полюбить', 'Поднять мёртвого', 'Сработать без достойной цены: чем выше цена, тем больше можно попросить'],
  law: 'Контракт заключается с душой и нерушим для обеих сторон. Инфернал не имеет права лгать в сделке, но имеет право умолчать — так сделка становится выгоднее ему.'
};

const kings = () => (window.M && M.kings) || [];
const king = id => kings().find(k => k.id === id);
const chaosName = c => c === 'ice' ? 'Ледяной хаос' : 'Огненный хаос';

function kingCard(k) {
  return `<article class="panel king k-${k.chaos}" id="king-${k.id}">
    <div class="king-top"><span class="king-sin">${esc(k.sin)}</span></div>
    <h3>${esc(k.name)}</h3><div class="king-title">${esc(k.title)}</div>
    <p>${esc(k.text)}</p>
    <div class="king-row"><b>Питается</b><span>${esc(k.feed)}</span></div>
    <div class="king-row"><b>Дар Дома · ${esc(k.gift[0])}</b><span>${esc(k.gift[1])}</span></div>
    <div class="king-row"><b>Клеймо</b><span>${esc(k.brand)}</span></div>
    <p class="muted king-court">${esc(k.court)}</p></article>`;
}
const table = rows => `<dl class="inf-dl">${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`;
const costTable = rows => `<div class="inf-costs">${rows.map(([n, c, d]) => `<div><b>${n}</b><i>${c}</i><span>${d}</span></div>`).join('')}</div>`;

/* ---------- страница ---------- */
function pageHTML() {
  const fire = kings().filter(k => k.chaos === 'fire'), ice = kings().filter(k => k.chaos === 'ice');
  return `
<div class="slot-box" data-slot="infernal"></div>
<div class="sec-head"><div class="eyebrow">Истоки</div><h2>Мир Инферно</h2><p>Инферно создал Чёрный дракон тысячелетия назад. Он украл дыхание стихий и из него сотворил первых инферналов. Инферно — система огромных подземелий и лавовых гротов, разделённых на королевства. Верхнее Инферно огненное, Нижнее — ледяное.</p></div>
<div class="grid2">
  <article class="panel inf-chaos fire"><div class="eyebrow">Верхнее Инферно</div><h3>Хаос-Игнео · Огненный хаос</h3><p>Квинтэссенция пламени Фоти и Гила. Сила огненного хаоса разделена между Королями, и каждый держит свой грех. В совершеннолетие, в 20 лет, инфернал получает печать на руку — пропуск в мир Инферно, источник силы и прямую связь с Королём, которому нельзя ослушаться. Печать останавливает старение.</p><p class="muted">Магия: сделки и печати — портальные, иллюзорные, разрушающие. Огненные полагаются на хитрость и уловки.</p></article>
  <article class="panel inf-chaos ice"><div class="eyebrow">Нижнее Инферно</div><h3>Хаос-Глациалис · Ледяной хаос</h3><p>Источник из сил Аэроса и Нэро. Ледяные Короли вкладывали часть силы прямо в суть своих инферналов: ледяные рождаются с хаосом, как с отпечатком в душе, и печать им не нужна. В войне Короли Нижнего Инферно были закованы и порабощены — но не убиты. Их хаос живёт в ледяных и всё ещё голоден.</p><p class="muted">Магия: ледяная и тёмная — предсказания и проклятия, не у всех. Ледяные — сильные и умелые воины.</p></article>
</div>
<p class="note" style="margin-top:16px">Изначально Королей было 33. Война оставила десять великих Домов — по пять в каждом Инферно. Остальные владыки стали князьями и герцогами при чужих дворах. Инферналы говорят на инфернальном языке, похожем на латынь, и на всеобщем.</p>

<div class="sec-head" style="margin-top:56px"><div class="eyebrow">Десять Домов</div><h2>Короли и грехи</h2><p>Каждый инфернал принадлежит Дому одного Короля. Грех Короля связывает его с инферналом: это та эмоция, которой инфернал питается. Дом выбирается в анкете вместе с происхождением.</p></div>
<h3 class="inf-sub fire">Огненные Дома</h3><div class="king-grid">${fire.map(kingCard).join('')}</div>
<h3 class="inf-sub ice">Ледяные Дома</h3><div class="king-grid">${ice.map(kingCard).join('')}</div>

<div class="sec-head" style="margin-top:56px"><div class="eyebrow">Механика</div><h2>Голод и Эссенция</h2><p>Инфернал видит в людях грехи, как следы на снегу, и питается эмоциями, которые этот грех рождает. Сытость держит маску человека, голод её срывает.</p></div>
<div class="inf-steps">${FEED_STEPS.map(([a, b, c], i) => `<article class="panel"><div class="inf-n">${i + 1}</div><div class="eyebrow">${b}</div><h3>${a}</h3><p>${c}</p></article>`).join('')}</div>
<div class="grid2" style="margin-top:18px">
  <article class="panel"><div class="eyebrow">Шкала голода</div>${table(HUNGER.map(([a, b], i) => [i + ' · ' + a, b]))}</article>
  <article class="panel"><div class="eyebrow">Правила</div>${table(HUNGER_RULES)}</article>
</div>
<div class="grid2" style="margin-top:18px">
  <article class="panel"><div class="eyebrow">Связь с Королём</div>${table(Object.values(BOND))}</article>
  <article class="panel"><div class="eyebrow">Траты · все</div>${costTable(SPEND_ALL)}</article>
</div>
<div class="grid2" style="margin-top:18px">
  <article class="panel inf-chaos fire"><div class="eyebrow">Траты · огненные</div>${costTable(SPEND_FIRE)}</article>
  <article class="panel inf-chaos ice"><div class="eyebrow">Траты · ледяные</div>${costTable(SPEND_ICE)}</article>
</div>
<article class="panel" style="margin-top:18px"><div class="eyebrow">Магия сделок · только огненные</div><p>${DEALS.law}</p>
  <div class="grid2"><div><h4>Сделка может</h4><ul>${DEALS.can.map(x => `<li>${x}</li>`).join('')}</ul></div><div><h4>Сделка не может</h4><ul>${DEALS.cannot.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
  <p class="muted">Сделка с персонажем другого игрока — только с его согласия вне игры. Создание нового инфернала через сделку — по решению мастера.</p></article>

<div class="sec-head" style="margin-top:56px"><div class="eyebrow">Для игрока</div><h2>Дневник голода</h2><p>Выбери Дом и связь с Королём, отмечай питание и траты. Дневник хранится в этом браузере.</p></div>
<div id="hungerMount"></div>`;
}

/* ---------- дневник голода ---------- */
function mountDiary(el) {
  const S = (window.MH && MH.store) || { get: (k, d) => d, set() {} };
  const a = S.get('anketa', {}) || {};
  let st = Object.assign({ k: a.ik || 'asmodeus', bond: a.bg === 'spy' ? 'spy' : 'renegade', h: 0, e: 0, log: [] }, S.get('hunger', {}) || {});
  const save = () => S.set('hunger', st);
  const log = t => { st.log.unshift(t); st.log = st.log.slice(0, 8); };
  const K = () => king(st.k) || kings()[0];
  function feed(n, label) {
    let give = n;
    if (st.bond === 'spy') give = Math.max(0, n - 1);
    const fromH = Math.min(st.h, give); st.h -= fromH;
    const toE = Math.min(5 - st.e, give - fromH); st.e += toE;
    log(`Вкусил: ${label} след — ${n} порц.${st.bond === 'spy' ? ' (1 Королю)' : ''} → Голод −${fromH}, Эссенция +${toE}`);
  }
  function spend(n, name) {
    if (st.e < n) { log(`Не хватает Эссенции на «${name}»`); return; }
    st.e -= n; log(`${name}: −${n} Эссенции`);
  }
  function render() {
    const k = K(), giftCost = (/за (\d) Эссенци/.exec(k.gift[1]) || [, 1])[1] * 1 + (st.bond === 'renegade' ? 1 : 0);
    const spends = [['Дар Дома · ' + k.gift[0], giftCost], ['Закрыть рану', 1], ['Удержать маску', 1], ...(k.chaos === 'fire' ? SPEND_FIRE.slice(0, 3) : SPEND_ICE).map(x => [x[0], +x[1]])];
    el.innerHTML = `<div class="panel hunger k-${k.chaos}">
      <div class="hg-pick">
        <label class="cab-f"><span>Дом</span><select id="hgK">${['fire', 'ice'].map(c => `<optgroup label="${chaosName(c)}">${kings().filter(x => x.chaos === c).map(x => `<option value="${x.id}"${x.id === st.k ? ' selected' : ''}>${x.name} · ${x.sin}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="cab-f"><span>Связь с Королём</span><select id="hgB"><option value="spy"${st.bond === 'spy' ? ' selected' : ''}>Шпион — связь жива</option><option value="renegade"${st.bond === 'renegade' ? ' selected' : ''}>Отступник — связь порвана</option></select></label>
      </div>
      <p class="muted" style="margin:0 0 16px">Питается: ${esc(k.feed)}.</p>
      <div class="hg-meters">
        <div class="hg-m"><div class="eyebrow">Голод</div><div class="hg-pips">${HUNGER.map((_, i) => `<i class="${i <= st.h && i > 0 ? 'on' : ''}${i === 0 ? ' zero' : ''}"></i>`).join('')}</div><b>${st.h} · ${HUNGER[st.h][0]}</b><small>${HUNGER[st.h][1]}</small>
          <div class="cab-acts"><button type="button" class="btn small ghost" data-a="day">Прошёл день без еды</button><button type="button" class="btn small ghost" data-a="h-">−1</button></div></div>
        <div class="hg-m"><div class="eyebrow">Эссенция</div><div class="hg-pips ess">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= st.e ? 'on' : ''}"></i>`).join('')}</div><b>${st.e} из 5</b><small>${st.bond === 'spy' ? 'Шпион: 1 порция с каждого питания уходит Королю.' : 'Отступник: всё ваше, Дар Дома +1 к цене.'}</small>
          <div class="cab-acts"><button type="button" class="btn small ghost" data-a="e+">+1 (сделка)</button><button type="button" class="btn small ghost" data-a="e-">−1</button></div></div>
      </div>
      <div class="al-sub" style="margin-top:18px">Вкусить</div>
      <div class="cab-acts"><button type="button" class="btn small" data-feed="1">Слабый след · 1</button><button type="button" class="btn small" data-feed="2">Яркий · 2</button><button type="button" class="btn small" data-feed="3">Пылающий · 3</button></div>
      <div class="al-sub" style="margin-top:18px">Потратить</div>
      <div class="cab-acts">${spends.map(([n, c], i) => `<button type="button" class="btn small ghost" data-sp="${i}"${st.e < c ? ' disabled' : ''}>${esc(n)} · ${c}</button>`).join('')}</div>
      ${st.h >= 2 ? `<p class="hg-warn">${st.h === 3 ? 'Одичание: маска спала. Самообладание 14 в каждой сцене с источником эмоции.' : 'Истощение: Дар Дома недоступен.'}</p>` : ''}
      <div class="al-sub" style="margin-top:18px">Журнал</div>
      ${st.log.length ? `<ol class="hg-log">${st.log.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p class="muted">Пока пусто.</p>'}
      <button type="button" class="btn small ghost" data-a="reset" style="margin-top:10px">Сбросить дневник</button>
    </div>`;
    q('#hgK', el).onchange = e => { st.k = e.target.value; save(); render(); };
    q('#hgB', el).onchange = e => { st.bond = e.target.value; save(); render(); };
    qa('[data-feed]', el).forEach(b => b.onclick = () => { feed(+b.dataset.feed, ['', 'слабый', 'яркий', 'пылающий'][b.dataset.feed]); save(); render(); window.MH && MH.play && MH.play('click'); });
    qa('[data-sp]', el).forEach(b => b.onclick = () => {
      const [n, c] = spends[b.dataset.sp];
      if (n.startsWith('Дар Дома') && st.h >= 2) { log('Истощён — Дар Дома недоступен'); } else spend(c, n);
      save(); render();
    });
    qa('[data-a]', el).forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'day') { st.h = Math.min(3, st.h + 1); log(`Прошёл день — Голод ${st.h}`); }
      if (a === 'h-') st.h = Math.max(0, st.h - 1);
      if (a === 'e+') { st.e = Math.min(5, st.e + 1); log('Эссенция +1'); }
      if (a === 'e-') st.e = Math.max(0, st.e - 1);
      if (a === 'reset') st = { k: st.k, bond: st.bond, h: 0, e: 0, log: [] };
      save(); render();
    });
  }
  render();
}

window.Inferno = { pageHTML, mountDiary, kingCard, king, kings };
})();
