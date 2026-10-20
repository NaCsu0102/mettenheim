/* Интерактивные заготовки: древо развития, оружейная, бронник.
   Все числа ниже — черновые. Правь данные в начале каждого блока. */
(() => {
'use strict';
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const play = n => window.MH && MH.play && MH.play(n);
const ICON = id => (window.ICON_ART_DATA || {})[id] || '';
const iconImg = (id, cls = 'ic') => ICON(id) ? `<img class="${cls}" src="${ICON(id)}" alt="" loading="lazy">` : '';
window.MH_ICON = ICON;

/* ======================= ДРЕВО РАЗВИТИЯ =======================
   Одно общее древо. У каждого класса стартовый узел и 4 ветви.
   Ветвь: способность → малый узел → малый узел → прокачка (шестерня).
   У мага ветви — школы: школа → заклинание → заклинание → высшее заклинание.
   На внешнем кольце ветви соседних классов связаны перекрёстками. */
const TREE_POINTS = 30; // очков на заготовке
const SECTOR = { fighter: -90, rogue: -18, mage: 54, shooter: 126, engineer: 198 };
const BR_OFF = [-27, -9, 9, 27];
// Ветви общих способностей у каждой стартовой точки. Названия — заготовки, меняй свободно.
const BRANCHES = {
  fighter: ['Сила', 'Стойкость', 'Натиск', 'Оборона'],
  rogue: ['Ловкость', 'Скрытность', 'Яды', 'Обман'],
  mage: ['Школа Стихий', 'Школа Материи', 'Школа Теней', 'Школа Крови'],
  shooter: ['Меткость', 'Порох', 'Дистанция', 'Выслеживание'],
  engineer: ['Механика', 'Люмерит', 'Ремонт', 'Конструкции']
};
// Какую характеристику качает ветвь, цена узлов в опыте и бонус. Кап +10 на характеристику.
// Главный куб ветви (способность и вершина). Малые узлы дают +1 к соседним кубам класса — см. TALENTS.
const BRANCH_STAT = {
  'Сила': 'Атлетичность', 'Стойкость': 'Стойкость', 'Натиск': 'Инициатива', 'Оборона': 'Защита',
  'Ловкость': 'Ловкость', 'Скрытность': 'Скрытность', 'Яды': 'Медицина', 'Обман': 'Внимательность',
  'Меткость': 'Атака', 'Порох': 'Ремесло', 'Дистанция': 'Инициатива', 'Выслеживание': 'Внимательность',
  'Механика': 'Механика', 'Люмерит': 'Маг. защита', 'Ремонт': 'Медицина', 'Конструкции': 'Образование',
  'Школа Стихий': 'Магия', 'Школа Материи': 'Маг. защита', 'Школа Теней': 'Самообладание', 'Школа Крови': 'Медицина'
};
const BRANCH_ICON = {
  'Сила': 'br-strength', 'Стойкость': 'br-endurance', 'Натиск': 'br-onslaught', 'Оборона': 'br-defense',
  'Ловкость': 'br-agility', 'Скрытность': 'br-stealth', 'Яды': 'br-poison', 'Обман': 'br-deceit',
  'Меткость': 'br-aim', 'Порох': 'br-powder', 'Дистанция': 'br-range', 'Выслеживание': 'br-tracking',
  'Механика': 'br-mechanics', 'Люмерит': 'br-lumerite', 'Ремонт': 'br-repair', 'Конструкции': 'br-constructs',
  'Школа Стихий': 'school-elements', 'Школа Материи': 'school-matter', 'Школа Теней': 'school-shadow', 'Школа Крови': 'school-blood'
};
const CLS_ICON = id => `assets/art/class-${id}.webp`;
const NODE_COST = { minor: 40, fork: 50, ability: 60, school: 60, upgrade: 90, bridge: 30, root: 0 };
const NODE_BONUS = { minor: 1, fork: 1, ability: 1, school: 1, upgrade: 2, bridge: 0, root: 0 };
const STAT_CAP = 10;
const RADII = { start: 270, b0: 440, b1: 580, b2: 720, b3: 860, bridge: 990 };

/* ======================= ТАЛАНТЫ =======================
   Для каждой ветви 4 узла по порядку: способность ветви → малый узел → малый узел → вершина.
   У мага: школа → заклинание I → заклинание II → высшее заклинание.
   Бонус к характеристике (+1/+1/+1/+2) добавляется автоматически по ветви. Кап +10. */
const TALENTS = {
  /* Формат ветви: [приём, малый узел, развилка, вершина].
     Приём/вершина/малый: [название, описание, { куб: бонус }].
     Развилка: [название, описание, { куб: бонус }, [[вариант А, описание], [вариант Б, описание]]] — берётся ОДИН вариант.
     Ресурсы классов: Закалка (Боец), Хитрость (Плут), заряды кристалла (Маг), Фокус (Стрелок), Детали (Инженер).
     Красноречие в древе не качается. */
  /* ---------------- БОЕЦ · Закалка ---------------- */
  'fighter-0': [ // Сила
    ['Сокрушение', 'Приём. ОСН, 1 Закалка: удар оружием +1d6 урона, цель отброшена на 1 тайл — встречная Атлетичность против Стойкости.', { 'Атлетичность': 1 }],
    ['Закалка мышц', 'Тело привыкло к весу стали.', { 'Атака': 1 }],
    ['Развилка силы', 'Выберите, как работает Сокрушение.', { 'Атлетичность': 1 }, [
      ['Землетряс', 'Сокрушение бьёт всех врагов в соседних тайлах: без +1d6, но каждый отброшен.'],
      ['Ломатель брони', 'Сокрушение снимает с цели 1 КБ до конца боя, до −2 с одной цели.']]],
    ['Молот гнева', 'Вершина. Раз за бой Сокрушение ничего не стоит. При полной Закалке (3) урон +2d6 вместо 1d6, а цель Оглушена на 1 ход.', { 'Атлетичность': 2 }]
  ],
  'fighter-1': [ // Стойкость
    ['Второе дыхание', 'Приём. ДОП, 1–3 Закалки: за каждую восстановите 1 ОЗ и 2 ОВ.', { 'Стойкость': 1 }],
    ['Крепкая шкура', 'Боль и зараза доходят медленнее.', { 'Иммунитет': 1 }],
    ['Развилка стойкости', 'Выберите, что даёт Закалка, пока вы её копите.', { 'Собранность': 1 }, [
      ['Железная шкура', 'Пока у вас 2+ Закалки, КБ +1.'],
      ['Кровь не стынет', 'Второе дыхание снимает с вас один дебафф.']]],
    ['Несгибаемый', 'Вершина. Первый раз за бой, падая до 0 ОЗ, встаёте с 1d4 ОЗ и полной Закалкой. Срабатывает раньше «На краю».', { 'Стойкость': 2 }]
  ],
  'fighter-2': [ // Натиск
    ['Рывок', 'Приём. Раз за бой: +2 тайла и атака в том же ходу, рывок не провоцирует атак. Первым ворвались в бой — +1 Закалка.', { 'Инициатива': 1 }],
    ['Быстрый шаг', 'Ноги знают дорогу раньше головы.', { 'Инициатива': 1 }],
    ['Развилка натиска', 'Выберите, чем заканчивается рывок.', { 'Атака': 1 }, [
      ['Таран', 'Цель рывка проходит Атлетичность 13 или Сбита с ног.'],
      ['Вихрь клинков', 'После рывка вторая атака одноручным оружием по другому врагу рядом.']]],
    ['Неудержимый', 'Вершина. Рывок дважды за бой. Каждое убийство в ход рывка даёт ещё 2 тайла движения и +1 Закалку.', { 'Инициатива': 2 }]
  ],
  'fighter-3': [ // Оборона
    ['Щит товарища', 'Приём. Реакция: примите атаку по соседнему союзнику на себя. Бросок Защиты 16+ — +1 Закалка.', { 'Защита': 1 }],
    ['Стражевой строй', 'Плечо к плечу.', { 'Защита': 1 }],
    ['Развилка обороны', 'Выберите, как вы держите строй.', { 'Самообладание': 1 }, [
      ['Провокация', 'ДОП: враг в 3 тайлах проходит Самообладание 13 или 1 ход атакует только вас.'],
      ['Стена щитов', 'Союзники в соседних с вами тайлах получают +1 к Защите.']]],
    ['Знамя', 'Вершина. Раз за бой клич: союзники в 3 тайлах получают по 1 единице своего ресурса — Закалку, Хитрость, заряд, Фокус или Деталь — и бросают Собранность с преимуществом.', { 'Защита': 2 }]
  ],
  /* ---------------- ПЛУТ · Хитрость ---------------- */
  'rogue-0': [ // Ловкость
    ['Уклонение', 'Приём. Реакция, 1 Хитрость: урон от одной атаки вдвое, округление вверх.', { 'Ловкость': 1 }],
    ['Лёгкая стойка', 'Вес на носках, локти к телу.', { 'Защита': 1 }],
    ['Развилка ловкости', 'Выберите, что следует за уклонением.', { 'Ловкость': 1 }, [
      ['Танец лезвий', 'Сразу контратакуйте дополнительным действием.'],
      ['Тень за спиной', 'Переместитесь на 1 тайл за спину атакующему — следующая атака по нему во фланг.']]],
    ['Неуловимый', 'Вершина. Первое уклонение за бой бесплатно. При 3 Хитрости ваше передвижение весь ход не провоцирует атак.', { 'Ловкость': 2 }]
  ],
  'rogue-1': [ // Скрытность
    ['Удар из тени', 'Приём. Первая атака из скрытности наносит +1d6 урона.', { 'Скрытность': 1 }],
    ['Тихая поступь', 'В скрытности вы двигаетесь на полное число тайлов.', { 'Ловкость': 1 }],
    ['Развилка тени', 'Выберите, что даёт удар из тени.', { 'Атака': 1 }, [
      ['Перерезать горло', 'Если цель вас не видела — ещё Кровотечение, и 1 ход она не может кричать и колдовать.'],
      ['Исчезнуть', '2 Хитрости: после удара снова уйдите в скрытность, если рядом есть укрытие или тень.']]],
    ['Теневой клинок', 'Вершина. В темноте вы невидимы для тех, кто не видит во тьме. Удар из тени — критический уже на 18+.', { 'Скрытность': 2 }]
  ],
  'rogue-2': [ // Яды
    ['Отравитель', 'Приём. Яды и противоядия I тира в Алхимии. Нанести яд — ДОП. Атака по отравленной цели даёт +1 Хитрость.', { 'Медицина': 1 }],
    ['Привычка к ядам', 'Маленькие дозы каждый день.', { 'Иммунитет': 1 }],
    ['Развилка ядов', 'Выберите свой яд.', { 'Ремесло': 1 }, [
      ['Паралитик', 'Вместо урона: цель проходит Стойкость 14 или Обездвижена на 1 ход.'],
      ['Кислота', 'Яд разъедает броню: −1 КБ цели до конца боя.']]],
    ['Чёрный букет', 'Вершина. Яды II тира. Раз за бой яд накладывает два статуса сразу — сверх лимита в два дебаффа.', { 'Медицина': 2 }]
  ],
  'rogue-3': [ // Обман
    ['Чужое имя', 'Приём. Легенда-прикрытие с бумагами. Раз за сцену Внимательность 13 — узнать, лжёт ли собеседник. Разоблачили — рулетка 1d100: угадали, легенда держится.', { 'Внимательность': 1 }],
    ['Маска', 'Лицо говорит то, что нужно.', { 'Скрытность': 1 }],
    ['Развилка обмана', 'Выберите свой бойцовский трюк.', { 'Самообладание': 1 }, [
      ['Подставной удар', '1 Хитрость: изобразите сдачу — следующая атака врага по вам с помехой, если он не прошёл Самообладание 13.'],
      ['Карманник', 'ДОП: украдите предмет у соседней цели — Ловкость против её Внимательности. Зелье, патроны, даже кристалл мага.']]],
    ['Безликий', 'Вершина. Раз за событие гарантированно уйти в скрытность — найти вас можно только с Внимательностью 16+. Раз в неделю скрыть лицо и голос так, что вас не узнает никто.', { 'Внимательность': 2 }]
  ],
  /* ---------------- МАГ · заряды кристалла ---------------- */
  'mage-0': [ // Стихии
    ['Искра и иней', 'Школа Стихий. 1 заряд: атака Магией на 5 тайлов, 2 ЕУ и Горение или Обморожение (Стойкость 14 — без статуса).', { 'Магия': 1 }],
    ['Чутьё стихий', 'Погода и пламя слушаются лучше.', { 'Магия': 1 }],
    ['Развилка стихий', 'Выберите второе заклинание.', { 'Маг. защита': 1 }, [
      ['Цепная молния', '+1 заряд: Искра перескакивает на вторую цель в 2 тайлах.'],
      ['Порыв', '1 заряд: конус 3 тайла — Атлетичность 14 или все отлетают на 2 тайла и падают.']]],
    ['Буря', 'Высшее. Искра наносит 2 ЕУ +1d6. Раз за бой после заклинания дополнительным действием ещё одно слабое — за свой заряд.', { 'Магия': 2 }]
  ],
  'mage-1': [ // Материи
    ['Укрепление', 'Школа Материи. 1 заряд: броня союзника +1 КБ или его оружие +1 ЕУ до конца боя.', { 'Маг. защита': 1 }],
    ['Чутьё сплавов', 'Вы видите трещины в металле и механизмах.', { 'Механика': 1 }],
    ['Развилка материи', 'Выберите второе заклинание.', { 'Защита': 1 }, [
      ['Ржавь', '1 заряд: механизм цели встаёт на 1 круг, оружие теряет 2 прочности. Конструкты проходят Стойкость 15.'],
      ['Каменная кожа', '1 заряд: союзник получает щит, который поглощает 1d6 урона.']]],
    ['Сердце сплава', 'Высшее. Раз за событие: стена, мост или щит из металла до конца сцены. Механизмы в 3 тайлах подчиняются вам 1 круг.', { 'Маг. защита': 2 }]
  ],
  'mage-2': [ // Тени
    ['Покров', 'Школа Теней. 1 заряд: вы или союзник уходите в тень — Скрытность с преимуществом до первой атаки.', { 'Самообладание': 1 }],
    ['Шаг из темноты', 'Тени ближе, чем кажется.', { 'Скрытность': 1 }],
    ['Развилка теней', 'Выберите второе заклинание.', { 'Запугивание': 1 }, [
      ['Ужас', '1 заряд: цель проходит Самообладание 15 или получает Страх на 2 круга.'],
      ['Двойник', '1 заряд: иллюзия-копия рядом с вами. Первая атака по вам — рулетка 1d100: угадали, удар ушёл в двойника.']]],
    ['Покров разума', 'Высшее. Вы читаете поверхностные мысли. Раз за событие Магия против Самообладания — ответ на один вопрос из памяти существа.', { 'Самообладание': 2 }]
  ],
  'mage-3': [ // Крови
    ['Связь крови', 'Школа Крови. 1 заряд: союзник в 3 тайлах восстанавливает 1d4+1 ОЗ. По цели с Кровотечением заклинания школы не тратят заряд — раз за ход.', { 'Медицина': 1 }],
    ['Чужой пульс', 'Вы слышите, как бьётся сердце рядом.', { 'Стойкость': 1 }],
    ['Развилка крови', 'Выберите второе заклинание.', { 'Магия': 1 }, [
      ['Кипящая кровь', 'Цель с Кровотечением получает 2 ЕУ +1d4, Кровотечение длится ещё круг.'],
      ['Переливание', 'Заберите 2 ОЗ у врага с Кровотечением и отдайте союзнику в 3 тайлах.']]],
    ['Кровавый лекарь', 'Высшее. Раз за бой все союзники в 3 тайлах восстанавливают 3 ОЗ и снимают Кровотечение.', { 'Медицина': 2 }]
  ],
  /* ---------------- СТРЕЛОК · Фокус ---------------- */
  'shooter-0': [ // Меткость
    ['Прицельный выстрел', 'Приём. 1 Фокус: выстрел с преимуществом.', { 'Атака': 1 }],
    ['Глаз стрелка', 'Мушка, цель, выдох.', { 'Внимательность': 1 }],
    ['Развилка меткости', 'Выберите особый выстрел.', { 'Атака': 1 }, [
      ['В сочленение', '2 Фокуса: выстрел игнорирует КБ цели.'],
      ['Выбить оружие', '2 Фокуса: вместо урона цель проходит Ловкость 14 или роняет оружие.']]],
    ['Снайпер', 'Вершина. При 3 Фокусах выстрел наносит +1d6 и критический уже на 18+. На 10+ тайлах +1 ЕУ.', { 'Атака': 2 }]
  ],
  'shooter-1': [ // Порох
    ['Пороховых дел мастер', 'Приём. Особые боеприпасы I тира и гранаты. Оружие не даёт осечек в дождь и сырость.', { 'Ремесло': 1 }],
    ['Знание затворов', 'Любой механизм ствола знаком на ощупь.', { 'Механика': 1 }],
    ['Развилка пороха', 'Выберите свой заряд.', { 'Ремесло': 1 }, [
      ['Бомбардир', 'Раз за бой граната: 2 ЕУ +1d4 в радиусе 2 тайлов и Горение. Ловкость 13 — урон вдвое меньше.'],
      ['Заряд в упор', '1 Фокус: выстрел с 1 тайла +1d6 урона и отбрасывает цель на 1 тайл.']]],
    ['Пиротехник', 'Вершина. Боеприпасы II тира. Раз за бой особый боеприпас не тратится, гранаты — 2 раза за бой.', { 'Ремесло': 2 }]
  ],
  'shooter-2': [ // Дистанция
    ['Шаг назад', 'Приём. 2 раза за бой после выстрела отойдите на 1 тайл, не провоцируя атак и не теряя Фокус.', { 'Инициатива': 1 }],
    ['Чуткий слух', 'Шорох слышен раньше шага.', { 'Ловкость': 1 }],
    ['Развилка дистанции', 'Выберите, как вы держите поле.', { 'Инициатива': 1 }, [
      ['Высота', 'На возвышенности в начале хода +1 Фокус.'],
      ['Огонь на подавление', '1 Фокус: враги в конусе 3 тайлов 1 ход не могут подойти к вам, если не прошли Самообладание 13.']]],
    ['Неуловимый стрелок', 'Вершина. В первом круге вы ходите первым. Шаг назад — после каждого выстрела. Движение больше не мешает копить Фокус.', { 'Инициатива': 2 }]
  ],
  'shooter-3': [ // Выслеживание
    ['Метка', 'Приём. ДОП: пометьте цель — 2 круга атаки союзников по ней наносят +1d4 урона.', { 'Внимательность': 1 }],
    ['Следопыт', 'По следам вы узнаёте, сколько их было и куда ушли.', { 'Скрытность': 1 }],
    ['Развилка охоты', 'Выберите, что даёт метка.', { 'Внимательность': 1 }, [
      ['Не скроешься', 'Помеченная цель видна вам сквозь дым, темноту и Скрытность.'],
      ['Слабое место', 'Ваши выстрелы по помеченной цели — критические на 18+.']]],
    ['Охотник за головами', 'Вершина. Две метки сразу. Добили помеченную — +3 Фокуса, метку можно сразу перевесить.', { 'Внимательность': 2 }]
  ],
  /* ---------------- ИНЖЕНЕР · Детали ---------------- */
  'engineer-0': [ // Механика
    ['Подгонка', 'Приём. 1 Деталь: обвес на оружии союзника даёт двойной бонус до конца боя.', { 'Механика': 1 }],
    ['Набитая рука', 'Инструмент — продолжение пальцев.', { 'Ремесло': 1 }],
    ['Развилка мастерской', 'Выберите второй трюк.', { 'Механика': 1 }, [
      ['Перегрев ствола', '1 Деталь: оружие союзника +1d4 урона на 2 хода, потом 1 ход остывает.'],
      ['Ремкомплект', '1 Деталь: броня союзника +1 КБ до конца боя.']]],
    ['Гений механики', 'Вершина. Бой начинаете с +2 Деталями. Ещё один слот помощника в верстаке изобретателя. Раз за событие — прототип на сцену по согласованию с мастером.', { 'Механика': 2 }]
  ],
  'engineer-1': [ // Люмерит
    ['Мистический заслон', 'Приём. 1 Деталь: щит Люмерита поглощает 3 урона от магии — на вас или соседнем союзнике.', { 'Маг. защита': 1 }],
    ['Ровный пульс', 'Свечение кристалла больше не туманит голову.', { 'Самообладание': 1 }],
    ['Развилка Люмерита', 'Выберите, куда вести энергию.', { 'Маг. защита': 1 }, [
      ['Подзарядка', '1 Деталь, раз за бой: кристалл мага рядом получает +1d4 заряда.'],
      ['Разряд', '1 Деталь: 2 ЕУ +1d4 по цели в 3 тайлах. Механизм или конструкт Оглушён, если не прошёл Стойкость 15.']]],
    ['Кристальное сердце', 'Вершина. Заслон держит 5 урона и ставится на всех соседей. Раз за бой полностью заряжает конструкта или кристалл мага.', { 'Маг. защита': 2 }]
  ],
  'engineer-2': [ // Ремонт
    ['Хирург-механик', 'Приём. Стабилизируете раненых, чините протезы и конструктов без проверки. 1 Деталь: конструкт восстанавливает 1d4 ОЗ.', { 'Медицина': 1 }],
    ['Чистые перчатки', 'Гниль и копоть к вам не липнут.', { 'Иммунитет': 1 }],
    ['Развилка ремонта', 'Выберите, кого вы чините лучше.', { 'Механика': 1 }, [
      ['Полевая операция', 'Лечите травмы как лекарь II тира.'],
      ['Стимулятор', '1 Деталь: союзник с протезом или конструкт получает дополнительное действие на 1 ход.']]],
    ['Мастерская Талбот', 'Вершина. Раз за событие полевой протез союзнику. Конструкт после вашего ремонта получает +1 КБ до конца боя.', { 'Медицина': 2 }]
  ],
  'engineer-3': [ // Конструкции
    ['Турель', 'Приём. Открывает слот боевой турели (Изобретатель II). ОСН, 2 Детали: разверните свою турель — её зону и модуль вы придумали сами.', { 'Образование': 1 }],
    ['Глаз на детали', 'Лишний винт заметен сразу.', { 'Внимательность': 1 }],
    ['Развилка конструкций', 'Выберите вторую машину.', { 'Образование': 1 }, [
      ['Двойной модуль', 'Турель несёт два модуля, при каждом выстреле выбираете один.'],
      ['Сеть-ловушка', '1 Деталь: мина в тайле — вошедший Обездвижен на 1 ход.']]],
    ['Автоматон', 'Вершина. Открывает автоматона в кейсе (Изобретатель III): спутник-защитник с обучающимся разумом. Турель получает +2 ОЗ.', { 'Образование': 2 }]
  ]
};
const TREE_RULES = [
  ['Управление', 'Одно нажатие на узел — выбрать и прочитать описание. Второе нажатие по тому же узлу — изучить его, а если он уже изучен — сбросить (вместе с узлами, которые держались только на нём). ПКМ тоже сбрасывает. Тяни поле, чтобы двигать древо, колесо мыши — масштаб.'],
  ['Опыт', 'Узлы покупаются за опыт: малый узел 40, способность и заклинание 60, вершина 90, перекрёсток 30.'],
  ['Порядок', 'Узел можно изучить, только если рядом уже есть изученный. Начинаешь со стартовой точки своего класса.'],
  ['Ветвь', 'Приём (60 опыта) → малый узел (40) → развилка (50) → вершина (90). Приём и вершина дают +1 и +2 к главному кубу ветви, малый узел и развилка — по +1 к кубам класса.'],
  ['Развилка', 'Ромб А|Б. Выбери один из двух вариантов — так из одной ветви выходят разные стили. Сменить выбор можно, пока планируешь; на игре — только при сбросе.'],
  ['Ресурс класса', 'Приёмы тратят ресурс класса: Боец — Закалку, Плут — Хитрость, Маг — заряды кристалла, Стрелок — Фокус, Инженер — Детали. Ресурс копится в бою и сгорает после него.'],
  ['Кап +10', 'Бонус к любому кубу из всех источников вместе — древо, раса, предметы, еда, зелья, протезы, руны — не выше +10. Лишнее сгорает, эффекты узлов остаются.'],
  ['Красноречие', 'В древе не качается. Красноречие растёт только от одежды и украшений.'],
  ['Вершины', 'Не больше двух вершин на персонажа.'],
  ['Школы магии', 'Не больше двух школ на персонажа, даже если дойти до третьей по кольцу.'],
  ['Другой класс', 'Ветвь проходится до конца. Изучив её вершину, ты открываешь начало любой ветви любого класса — так качается второй класс. Если сбросить все вершины, чужие ветви снимаются.'],
  ['Кольцо', 'От вершины можно выйти на кольцо перекрёстков и пройти по нему к вершинам других ветвей — так можно добраться до любого класса.'],
  ['Сброс', 'Раз в сессию можно забыть узлы и вернуть половину потраченного опыта.']
];

function buildWorld() {
  const nodes = [], links = [];
  const pol = (r, deg) => [Math.round(r * Math.cos(deg * Math.PI / 180)), Math.round(r * Math.sin(deg * Math.PI / 180))];
  const add = (n, from) => { nodes.push(n); if (from) links.push([from, n.id]); };
  M.classes.forEach(cls => {
    const a = SECTOR[cls.id], mage = cls.id === 'mage';
    const [sx, sy] = pol(RADII.start, a);
    add({ id: cls.id, cls: cls.id, x: sx, y: sy, type: 'root', name: cls.name, desc: `Стартовая точка класса «${cls.name}». Способности класса с начала игры: ${(cls.abilities || []).map(x => Array.isArray(x) ? x[0] : x).join(', ')}. Кубы класса: ${(cls.cubes || []).join(', ')}. Все узлы древа — общие: их может взять любой класс, если дойдёт по связям.` });
    for (let k = 0; k < 4; k++) {
      const ang = a + BR_OFF[k], br = BRANCHES[cls.id][k], p = `${cls.id}-${k}`;
      const P = r => pol(r, ang);
      let [x, y] = P(RADII.b0);
      const T = TALENTS[p] || [];
      const tn = (j, fb) => (T[j] && T[j][0]) || fb, td = (j, fb) => (T[j] && T[j][1]) || fb, tb = j => (T[j] && T[j][2]) || null, to = j => (T[j] && T[j][3]) || null;
      add({ id: p + '-0', cls: cls.id, branch: br, x, y, type: mage ? 'school' : 'ability', name: tn(0, br), desc: td(0, 'Описание будет добавлено.'), bonus: tb(0) }, cls.id);
      [x, y] = P(RADII.b1); add({ id: p + '-1', cls: cls.id, branch: br, x, y, type: 'minor', name: tn(1, 'Малый узел'), desc: td(1, ''), bonus: tb(1) }, p + '-0');
      [x, y] = P(RADII.b2); add({ id: p + '-2', cls: cls.id, branch: br, x, y, type: to(2) ? 'fork' : 'minor', name: tn(2, 'Развилка'), desc: td(2, ''), bonus: tb(2), opts: to(2) }, p + '-1');
      [x, y] = P(RADII.b3); add({ id: p + '-3', cls: cls.id, branch: br, x, y, type: 'upgrade', name: tn(3, br + ': вершина'), desc: td(3, '') + ' Отсюда выход на кольцо перекрёстков.', bonus: tb(3) }, p + '-2');
    }
  });
  // Внешнее кольцо: каждый финал ветви выходит на свой перекрёсток, перекрёстки связаны по кругу.
  // Так из финала любой ветви можно уйти в соседние ветви и в древа других классов.
  const finals = nodes.filter(n => n.type === 'upgrade').map(n => ({ n, a: Math.atan2(n.y, n.x) })).sort((x, y) => x.a - y.a);
  finals.forEach(({ n, a: ang }) => {
    const [x, y] = [Math.round(RADII.bridge * Math.cos(ang)), Math.round(RADII.bridge * Math.sin(ang))];
    add({ id: 'x-' + n.id, x, y, type: 'bridge', name: 'Перекрёсток', desc: `Выход из ветви «${n.branch}». По кольцу перекрёстков можно дойти до финалов соседних ветвей и других классов, а оттуда развиваться вглубь их ветвей.` }, n.id);
  });
  finals.forEach(({ n }, i) => links.push(['x-' + n.id, 'x-' + finals[(i + 1) % finals.length].n.id]));
  // Дошёл до вершины своей ветви — открываются начала соседних ветвей (слева и справа по кругу, в том числе у соседнего класса)
  const jumps = [];
  finals.forEach(({ n }, i) => {
    const L = finals[(i - 1 + finals.length) % finals.length].n, Rn = finals[(i + 1) % finals.length].n;
    // переходы теперь не к соседям, а в любой класс — см. unlocked() в Tree.mount
  });
  return { nodes, links, jumps };
}
window.MH_TREE_NAMES = (got, forks) => {
  const by = Object.fromEntries(buildWorld().nodes.map(n => [n.id, n])); forks = forks || {};
  return (got || []).map(id => by[id]).filter(n => n && n.type !== 'root' && n.type !== 'bridge')
    .map(n => n.type === 'fork' && n.opts && forks[n.id] != null && n.opts[forks[n.id]] ? n.opts[forks[n.id]][0] : n.name);
};

const Tree = {
  mount(el, classId) {
    const { nodes, links, jumps } = buildWorld();
    const isJump = new Set(jumps.map(([a, b]) => a + '|' + b)), jumpSet = isJump;
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    // nb[x] — откуда можно прийти в x; out[x] — куда можно пройти из x. Переходы с вершины на соседние ветви — только в одну сторону.
    const nb = {}, out = {}; links.forEach(([a, b]) => { (out[a] ||= []).push(b); (nb[b] ||= []).push(a); if (!jumpSet.has(a + '|' + b)) { (out[b] ||= []).push(a); (nb[a] ||= []).push(b); } });
    let cid = M.classes.some(c => c.id === classId) ? classId : 'fighter';
    let got, sel;
    let forks = {};
    const load = () => { got = new Set(MH.store.get('tree2:' + cid, [cid])); got.add(cid); sel = cid; forks = MH.store.get('tree2f:' + cid, {}) || {}; };
    const save = () => { MH.store.set('tree2:' + cid, [...got]); Object.keys(forks).forEach(k => { if (!got.has(k)) delete forks[k]; }); MH.store.set('tree2f:' + cid, forks); };
    const nodeName = n => n.type === 'fork' && forks[n.id] != null && n.opts ? n.opts[forks[n.id]][0] : n.name;
    const skillId = (n, opt) => { const m = /^([a-z]+)-(\d)-(\d)$/.exec(n.id); if (!m) return ''; const j = +m[3]; const slot = j === 2 ? (n.opts ? '3' + 'ab'[opt != null ? opt : (forks[n.id] != null ? forks[n.id] : 0)] : '3a') : String(j + 1 + (j === 3 ? 0 : 0)); return `skill-${m[1]}-${m[2]}-${j === 3 ? 4 : slot}`; };
    load();
    const R = { root: 44, ability: 24, upgrade: 30, minor: 15, fork: 19, school: 30, bridge: 11 };
    const TYPE = { root: 'Стартовый узел', ability: 'Приём ветви', upgrade: 'Вершина ветви', minor: 'Малый узел', fork: 'Развилка · выбери одно', school: 'Школа магии', bridge: 'Перекрёсток' };
    let view = { x: 0, y: 0, k: 1 };

    el.innerHTML = `<div class="tree-full" id="tBox">
      <svg id="tSvg" role="img" aria-label="Древо талантов"><defs>
        <radialGradient id="tg1"><stop offset="0" stop-color="#3a2d22"/><stop offset="1" stop-color="#150f0b"/></radialGradient>
        ${Object.keys(window.ICON_ART_DATA || {}).filter(k => k.startsWith('skill-')).map(k => `<symbol id="sy-${k}" viewBox="0 0 144 144"><image href="${ICON(k)}" width="144" height="144"/></symbol>`).join('')}
        <filter id="tglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter></defs><g id="tWorld"></g></svg>
      <div class="tree-top">
        <div class="tree-classes" role="tablist">${M.classes.map(c => `<button class="class-tab" data-tc="${c.id}" aria-selected="${c.id === cid}"><img src="${CLS_ICON(c.id)}" alt="">${c.name}</button>`).join('')}</div>
        <div class="tree-hud"><span class="pts">Узлов: <b id="tPts"></b></span><button class="btn small ghost" id="tIn" aria-label="Приблизить">+</button><button class="btn small ghost" id="tOut" aria-label="Отдалить">−</button><button class="btn small ghost" id="tFit">Всё древо</button><button class="btn small ghost" id="tMe">К классу</button><button class="btn small ghost" id="tReset">Сбросить</button><button class="btn small" id="tHelp">Правила</button></div>
      </div>
      <aside class="panel node-panel tree-panel" id="tPanel"></aside>
      <div class="tree-hint">1 нажатие — прочитать узел · 2 нажатия — изучить или сбросить · ПКМ — сбросить · тяни поле · колесо — масштаб</div>
      <div class="tree-rules panel" id="tRules" hidden><div class="tp-head"><div class="eyebrow">Как работает древо</div><button class="btn small ghost" id="tRulesX">Закрыть</button></div>${TREE_RULES.map(([k, v]) => `<div><b>${k}.</b> <span class="muted">${v}</span></div>`).join('')}</div>
    </div>`;
    const world = q('#tWorld', el), box = q('#tBox', el), css = getComputedStyle(document.documentElement);
    const countType = t => [...got].filter(id => byId[id].type === t).length;
    const block = id => { const n = byId[id]; if (n.type === 'upgrade' && countType('upgrade') >= 2) return 'Уже взяты 2 вершины — больше нельзя'; if (n.type === 'school' && countType('school') >= 2) return 'Уже открыты 2 школы магии — больше нельзя'; return ''; };
    // Вершина любой ветви открывает начало ЛЮБОЙ ветви любого класса — так качается другой класс
    const STARTS = nodes.filter(n => /-0$/.test(n.id) && n.cls).map(n => n.id);
    const unlocked = set => [...set].some(id => byId[id] && byId[id].type === 'upgrade');
    const reach = x => got.has(x);
    const canTake = id => byId[id].type !== 'root' && !got.has(id) && ((nb[id] || []).some(reach) || (STARTS.includes(id) && unlocked(got))) && got.size - 1 < TREE_POINTS && !block(id);
    function connected(set) {
      const seen = new Set([cid]), st = [cid];
      const walk = () => { while (st.length) { const c = st.pop(); for (const x of out[c] || []) if (set.has(x) && !seen.has(x)) { seen.add(x); st.push(x); } } };
      walk();
      for (let guard = 0; guard < 5 && unlocked(seen); guard++) { const add = STARTS.filter(x => set.has(x) && !seen.has(x)); if (!add.length) break; add.forEach(x => { seen.add(x); st.push(x); }); walk(); }
      return seen;
    }

    function draw() {
      const house = css.getPropertyValue('--house').trim() || '#d6a23f', hi = css.getPropertyValue('--house-hi').trim() || '#f2cc72';
      let s = '';
      Object.values(RADII).forEach(r => { s += `<circle r="${r}" fill="none" stroke="#2a211a" stroke-width="1" stroke-dasharray="2 9"/>`; });
      s += `<circle r="180" fill="none" stroke="#3a2e23" stroke-width="2"/><image href="assets/scroll-gear.webp" x="-150" y="-150" width="300" height="300" opacity=".35"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="80s" repeatCount="indefinite"/></image>`;
      s += `<text y="6" text-anchor="middle" fill="#a7967c" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="28" letter-spacing="3" stroke="#120e0b" stroke-width="5" paint-order="stroke">МЕТТЕНХЕЙМ</text>`;
      for (const [a, b] of links) {
        const A = byId[a], B = byId[b], rootOpen = x => byId[x].type === 'root' && unlocked(got), on = (got.has(a) || (rootOpen(a) && got.has(b))) && (got.has(b) || (rootOpen(b) && got.has(a))), can = ((got.has(a) || rootOpen(a)) && canTake(b)) || ((got.has(b) || rootOpen(b)) && canTake(a));
        const mine = (A.cls === cid || B.cls === cid);
        if (isJump.has(a + '|' + b)) {
          const mx = (A.x + B.x) / 2 * 1.06, my = (A.y + B.y) / 2 * 1.06, d = `M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`;
          s += `<path d="${d}" fill="none" stroke="${on ? house : can ? '#c9a15b' : '#2f261d'}" stroke-width="${on ? 5 : can ? 3 : 2}" stroke-dasharray="${on ? '0' : '10 9'}" stroke-linecap="round" opacity="${on || can ? 1 : .6}"/>`;
          if (on) s += `<path d="${d}" fill="none" stroke="${hi}" stroke-width="1.5" opacity=".7"/>`;
          continue;
        }
        s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${on ? house : can ? '#7a5f3a' : mine ? '#3b2f24' : '#2a211a'}" stroke-width="${on ? 6 : 4}" stroke-linecap="round"/>`;
        if (on) s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${hi}" stroke-width="1.5" opacity=".7"/>`;
      }
      for (const n of nodes) {
        const r = R[n.type], on = got.has(n.id), can = canTake(n.id) || (n.type === 'root' && n.id !== cid && unlocked(got)), dim = n.cls && n.cls !== cid && !on && !can;
        const ring = on ? hi : can ? '#c9a15b' : '#4a3b2d';
        s += `<g class="tnode" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(nodeName(n))}" style="cursor:pointer" opacity="${dim ? .5 : 1}">`;
        if (on) s += `<circle cx="${n.x}" cy="${n.y}" r="${r + 9}" fill="${house}" opacity=".35" filter="url(#tglow)"/>`;
        if (n.type === 'upgrade' || n.type === 'school') {
          const pts = [], T = 10;
          for (let i = 0; i < T * 2; i++) { const g = i * Math.PI / T, rr = i % 2 ? r : r + 6; pts.push((n.x + rr * Math.cos(g)).toFixed(1) + ',' + (n.y + rr * Math.sin(g)).toFixed(1)); }
          s += `<polygon points="${pts.join(' ')}" fill="url(#tg1)" stroke="${ring}" stroke-width="2.5"/><circle cx="${n.x}" cy="${n.y}" r="${r - 9}" fill="${on ? house : '#1a130e'}" stroke="${ring}" stroke-width="1.5"/>`;
          if (n.type === 'upgrade' && ICON(skillId(n))) { const ir = r - 7; s += `<use href="#sy-${skillId(n)}" x="${n.x - ir}" y="${n.y - ir}" width="${ir * 2}" height="${ir * 2}" opacity="${on ? 1 : can ? .85 : .55}" style="pointer-events:none"/>`; }
        } else if (n.type === 'fork') {
          s += `<rect x="${n.x - r}" y="${n.y - r}" width="${r * 2}" height="${r * 2}" rx="4" transform="rotate(45 ${n.x} ${n.y})" fill="${on ? house : 'url(#tg1)'}" stroke="${ring}" stroke-width="2.5"/>`;
          if (on && forks[n.id] != null && ICON(skillId(n))) { const ir = r - 2; s += `<use href="#sy-${skillId(n)}" x="${n.x - ir}" y="${n.y - ir}" width="${ir * 2}" height="${ir * 2}" style="pointer-events:none"/>`; }
          else s += `<text x="${n.x}" y="${n.y + 6}" text-anchor="middle" fill="${on ? '#1a130e' : '#b3a084'}" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="16" style="pointer-events:none">${on && forks[n.id] != null ? 'АБ'[forks[n.id]] : 'А|Б'}</text>`;
        } else if (n.type === 'bridge') {
          s += `<rect x="${n.x - r}" y="${n.y - r}" width="${r * 2}" height="${r * 2}" transform="rotate(45 ${n.x} ${n.y})" fill="url(#tg1)" stroke="${ring}" stroke-width="2.5"/>`;
          if (on) s += `<circle cx="${n.x}" cy="${n.y}" r="5" fill="${hi}"/>`;
        } else {
          s += `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="url(#tg1)" stroke="${n.type === 'root' && n.id === cid ? hi : ring}" stroke-width="${n.type === 'minor' ? 2 : 3}"/>`;
          if (n.type === 'ability' && !(n.id.endsWith('-0') && BRANCH_ICON[n.branch])) s += `<circle cx="${n.x}" cy="${n.y}" r="${r - 8}" fill="${on ? house : '#1a130e'}" stroke="${ring}" stroke-width="1"/>`;
          if (n.type === 'minor' && ICON(skillId(n))) { const ir = r - 1; s += `<use href="#sy-${skillId(n)}" x="${n.x - ir}" y="${n.y - ir}" width="${ir * 2}" height="${ir * 2}" opacity="${on ? 1 : can ? .8 : .45}" style="pointer-events:none"/>`; }
          else if (n.type === 'minor' && on) s += `<circle cx="${n.x}" cy="${n.y}" r="5" fill="${hi}"/>`;
        }
        if (n.id.endsWith('-0') && BRANCH_ICON[n.branch]) { const ir = r + (n.type === 'school' ? 2 : 6); s += `<image href="assets/art/${BRANCH_ICON[n.branch]}.webp" x="${n.x - ir}" y="${n.y - ir}" width="${ir * 2}" height="${ir * 2}" opacity="${on ? 1 : can ? .85 : .5}" style="pointer-events:none"/>`; }
        if (n.type === 'root') {
          const c = M.classes.find(z => z.id === n.id);
          s += `<image href="${CLS_ICON(c.id)}" x="${n.x - r - 12}" y="${n.y - r - 12}" width="${(r + 12) * 2}" height="${(r + 12) * 2}" style="pointer-events:none"/><text x="${n.x}" y="${n.y + r + 44}" text-anchor="middle" fill="${n.id === cid ? hi : '#b8a68a'}" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="38" letter-spacing="2" stroke="#120e0b" stroke-width="7" paint-order="stroke">${esc(c.name.toUpperCase())}</text>`;
        }
        if (n.id.endsWith('-0') && n.branch) {
          const ang = Math.atan2(n.y, n.x), lx = n.x + Math.cos(ang) * 0, ly = n.y;
          s += `<text x="${lx}" y="${ly - r - 18}" text-anchor="middle" fill="${on ? hi : '#b3a084'}" font-family="Montserrat, Arial, sans-serif" font-weight="600" font-size="24" stroke="#120e0b" stroke-width="6" paint-order="stroke">${esc(n.branch.replace('Школа ', '').replace('Базовое плетение', 'Плетение'))}</text>`;
        }
        if (sel === n.id) s += `<circle cx="${n.x}" cy="${n.y}" r="${r + 14}" fill="none" stroke="${hi}" stroke-width="1.5" stroke-dasharray="4 5"><animateTransform attributeName="transform" type="rotate" from="0 ${n.x} ${n.y}" to="360 ${n.x} ${n.y}" dur="9s" repeatCount="indefinite"/></circle>`;
        s += '</g>';
      }
      world.innerHTML = s; applyView();
      q('#tPts', el).textContent = `${got.size - 1} / ${TREE_POINTS}`;
      qa('[data-tc]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tc === cid)));
      panel();
    }
    function stats() {
      const t = {};
      for (const id of got) { const n = byId[id]; for (const [st, v] of Object.entries(n.bonus || {})) t[st] = (t[st] || 0) + v; }
      return t;
    }
    const spent = () => [...got].reduce((a, id) => a + NODE_COST[byId[id].type], 0);
    const bonusText = n => { const b = Object.entries(n.bonus || {}); return b.length ? b.map(([st, v]) => `+${v} ${st}`).join(', ') : n.type === 'bridge' ? 'проход по кольцу' : ''; };
    function panel() {
      const n = byId[sel], on = got.has(n.id), can = canTake(n.id);
      const why = n.type === 'root' ? (n.id === cid ? 'Твой старт' : unlocked(got) ? 'Класс открыт — бери любую его ветвь' : 'Откроется после вершины любой ветви') : on ? 'Изучено · нажми ещё раз, чтобы сбросить' : can ? 'Можно изучить · нажми ещё раз' : STARTS.includes(n.id) && !unlocked(got) && n.cls !== cid ? 'Чужой класс: сначала дойди до вершины своей ветви' : block(n.id) || (got.size - 1 >= TREE_POINTS ? 'Узлы закончились' : 'Нужен изученный соседний узел');
      const S = stats(), nb0 = Object.entries(n.bonus || {}), overSt = nb0.filter(([k, v]) => (S[k] || 0) + v > STAT_CAP).map(([k]) => k), st = overSt.join(', ');
      const over = !on && overSt.length;
      const myCls = M.classes.find(c => c.id === cid);
      const next = nodes.filter(x => canTake(x.id)).sort((a, b) => NODE_COST[a.type] - NODE_COST[b.type]);
      const statRows = Object.entries(S).sort((a, b) => b[1] - a[1]);
      q('#tPanel', el).innerHTML = `
        <section class="tp-node">${ICON(skillId(n)) ? `<img class="tp-icon tp-skill" src="${ICON(skillId(n))}" alt="">` : n.branch && BRANCH_ICON[n.branch] ? `<img class="tp-icon" src="assets/art/${BRANCH_ICON[n.branch]}.webp" alt="">` : ''}<div class="eyebrow">${TYPE[n.type]}${n.branch ? ' · ' + esc(n.branch) : ''}</div><h3>${esc(nodeName(n))}</h3>
          <div class="tp-tags"><span class="tag ${on || n.id === cid ? 'house' : 'stub'}">${why}</span>${n.type !== 'root' ? `<span class="tag">${NODE_COST[n.type]} опыта</span>` : ''}${bonusText(n) ? `<span class="tag house">${bonusText(n)}</span>` : ''}</div>
          ${over ? `<p class="note" style="font-size:13px">${st} упрётся в кап +${STAT_CAP}: часть бонуса сгорит.</p>` : ''}
          <p class="muted">${esc(n.desc)}</p>
          ${n.opts ? `<div class="tp-fork">${n.opts.map(([on2, od], i) => `<button type="button" data-fork="${i}" aria-pressed="${forks[n.id] === i}"${!on && !can ? ' disabled' : ''}>${iconImg(skillId(n, i), 'tp-fork-ic')}<b>${'АБ'[i]} · ${esc(on2)}</b><span>${esc(od)}</span></button>`).join('')}</div>` : ''}
          ${n.type === 'root' && n.id !== cid ? `<button class="btn small" id="tSwitch">Начать за этот класс</button>` : ''}
          ${n.type !== 'root' ? (on ? `<button class="btn small ghost" id="tDrop">Забыть узел</button>` : n.opts ? '' : `<button class="btn small" id="tTake" ${can ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}>Изучить</button>`) : ''}
        </section>
        <section class="tp-path"><div class="tp-head"><div><div class="eyebrow">Твой путь</div><b><img src="${CLS_ICON(myCls.id)}" alt="">${myCls.name}</b></div><button class="btn small ghost" id="tReset2">Сбросить путь</button></div>
          <div class="tp-sum"><span>Узлов <b>${got.size - 1}/${TREE_POINTS}</b></span><span>Опыта <b>${spent()}</b></span></div>
          <div class="ctrl-label">Как это тебя улучшает</div>
          ${statRows.length ? `<div class="gauges">${statRows.map(([k, val]) => `<div class="gauge"><div class="row"><span>${k}</span><span><b class="${val > STAT_CAP ? 'down' : ''}">+${Math.min(val, STAT_CAP)}</b>${val > STAT_CAP ? ` <em class="down">сгорает ${val - STAT_CAP}</em>` : ''}</span></div><div class="bar"><i style="width:${Math.min(val, STAT_CAP) / STAT_CAP * 100}%"></i></div></div>`).join('')}</div>` : '<p class="muted" style="font-size:14px">Пока ничего не изучено. Начни с узлов рядом со стартом.</p>'}
          <div class="ctrl-label" style="margin-top:14px">Куда можно пойти</div>
          ${next.length ? `<div class="tp-next">${next.slice(0, 8).map(x => `<button data-goto="${x.id}"><span>${esc(x.branch ? x.branch + ' · ' : '')}${esc(x.type === 'bridge' ? 'перекрёсток' : nodeName(x).replace(/^.*?: /, ''))}</span><small>${NODE_COST[x.type]} оп.${bonusText(x) && x.type !== 'bridge' ? ' · ' + bonusText(x) : ''}</small></button>`).join('')}</div>` : `<p class="muted" style="font-size:14px">${got.size - 1 >= TREE_POINTS ? 'Очки закончились.' : 'Нет доступных узлов.'}</p>`}
        </section>
        <p class="muted" style="font-size:11px">Заготовка: цены, бонусы и названия будут уточнены после утверждения системы.</p>`;
      const t = q('#tTake', el), d = q('#tDrop', el), w = q('#tSwitch', el);
      if (t) t.onclick = () => take(sel);
      qa('[data-fork]', el).forEach(b => b.onclick = () => { const i = +b.dataset.fork; if (got.has(sel)) { forks[sel] = i; save(); play('click'); draw(); } else if (canTake(sel)) { forks[sel] = i; take(sel); } });
      if (d) d.onclick = () => { got.delete(sel); got = connected(got); save(); draw(); };
      if (w) w.onclick = () => switchTo(n.id);
      q('#tReset2', el).onclick = reset;
      qa('[data-goto]', el).forEach(b => b.onclick = () => { sel = b.dataset.goto; draw(); focus(sel, true); });
    }
    function reset() { got = new Set([cid]); forks = {}; sel = cid; save(); play('click'); draw(); }
    function take(id) { if (canTake(id)) { if (byId[id].opts && forks[id] == null) forks[id] = 0; got.add(id); save(); play('card'); draw(); } }
    function switchTo(id) { cid = id; load(); history.replaceState(null, '', '#tree-' + cid); play('card'); draw(); focus(cid); }
    function applyView() { world.setAttribute('transform', `translate(${box.clientWidth / 2 + view.x} ${box.clientHeight / 2 + view.y}) scale(${view.k})`); }
    function fit() { view = { x: 0, y: 0, k: Math.max(.25, Math.min(box.clientWidth, box.clientHeight) / 2120) }; applyView(); }
    function focus(id, keepZoom) { const n = byId[id]; if (!keepZoom) view.k = Math.max(view.k, Math.min(1, box.clientWidth / 1100)); view.x = -n.x * view.k; view.y = -n.y * view.k; applyView(); }

    // 1-е нажатие — выбрать узел и прочитать его; 2-е по тому же узлу — изучить (если доступен) или сбросить (если уже изучен)
    world.addEventListener('click', e => {
      const g = e.target.closest('.tnode'); if (!g || moved) return;
      const id = g.dataset.id;
      if (sel !== id) { sel = id; play('click'); draw(); return; }
      if (canTake(id)) { take(id); return; }
      if (got.has(id) && byId[id].type !== 'root') { got.delete(id); got = connected(got); save(); play('click'); draw(); return; }
      play('click'); draw();
    });
    world.addEventListener('keydown', e => { const g = e.target.closest('.tnode'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = g.dataset.id; draw(); } });
    let drag = null, moved = false;
    box.addEventListener('pointerdown', e => { if (e.target.closest('button,.tree-panel,.tree-top,.tree-rules')) return; if (e.button > 2) return; if (e.pointerType === 'mouse') e.preventDefault(); drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId }; moved = false; });
    box.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5) { moved = true; box.classList.add('drag'); try { box.setPointerCapture(drag.id); } catch {} }
      if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    });
    const end = () => { drag = null; box.classList.remove('drag'); setTimeout(() => moved = false, 0); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    // ПКМ: меню браузера не открывается; по изученному узлу — отменить его (и всё, что держалось только на нём)
    box.addEventListener('contextmenu', e => {
      if (e.target.closest('.tree-panel,.tree-top,.tree-rules')) return;
      e.preventDefault(); if (moved) return;
      const g = e.target.closest('.tnode'); if (!g) return;
      const id = g.dataset.id; sel = id;
      if (got.has(id) && byId[id].type !== 'root') { got.delete(id); got = connected(got); save(); play('click'); }
      draw();
    });
    box.addEventListener('dragstart', e => e.preventDefault());
    box.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('.tree-panel,.tree-rules')) e.preventDefault(); });
    const zoom = (f, cx, cy) => {
      const k2 = Math.max(.2, Math.min(2.4, view.k * f)), w = box.clientWidth, h = box.clientHeight;
      if (cx == null) { cx = w / 2; cy = h / 2; }
      const ox = cx - w / 2 - view.x, oy = cy - h / 2 - view.y; view.x -= ox * (k2 / view.k - 1); view.y -= oy * (k2 / view.k - 1); view.k = k2; applyView();
    };
    box.addEventListener('wheel', e => { if (e.target.closest('.tree-panel')) return; e.preventDefault(); const r = box.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    q('#tIn', el).onclick = () => zoom(1.2); q('#tOut', el).onclick = () => zoom(1 / 1.2);
    q('#tFit', el).onclick = fit; q('#tMe', el).onclick = () => focus(cid);
    q('#tReset', el).onclick = reset;
    q('#tHelp', el).onclick = () => { q('#tRules', el).hidden = !q('#tRules', el).hidden; };
    q('#tRulesX', el).onclick = () => { q('#tRules', el).hidden = true; };
    qa('[data-tc]', el).forEach(b => b.onclick = () => switchTo(b.dataset.tc));
    MH.onHouse(draw);
    addEventListener('resize', applyView);
    view.k = Math.min(1, Math.max(.5, box.clientHeight / 1450)); { const n = byId[cid]; view.x = -n.x * .6 * view.k; view.y = -n.y * .6 * view.k; } draw();
  }
};

/* ======================= ОРУЖЕЙНАЯ =======================
   Характеристики в стиле мануала: Урон (ЕУ), Дистанция (тайлы), Апарту, Хват.
   Способности оружие получает только через особые улучшения.
   Тир улучшения = в каком слоте его можно поставить: слот I — улучшения I тира, слот II — до II, слот III — до III.
   Сколько слотов открыто, определяет материал оружия (каталог материалов — отдельно). */
const SLOT_COUNT = 3; // 4-й слот — дополнительная деталь (позже)
const WEAPON_ART = { sword: 'weapon-sword', sabre: 'sabre', cleaver: 'cleaver', spear: 'spear', hammer: 'hammer', revolver: 'revolver', rifle: 'rifle', crossbow: 'crossbow', airgun: 'airgun', axe: 'axe', blunderbuss: 'blunderbuss', bow: 'bow', broadsword: 'broadsword', canesword: 'canesword', carbine: 'carbine', chainsword: 'chainsword', dagger: 'dagger', gatling: 'gatling', gauntlet: 'gauntlet', glaive: 'glaive', greatsword: 'greatsword', halberd: 'halberd', handxbow: 'handxbow', mace: 'mace', mechbow: 'mechbow', mortar: 'mortar', musket: 'musket', pepperbox: 'pepperbox', pistol: 'pistol', rapier: 'rapier', sawnoff: 'sawnoff', shotgun: 'shotgun', stiletto: 'stiletto' };
const ART_FALLBACK = { pistol: 'revolver', long: 'rifle', shot: 'rifle', heavy: 'rifle', bow: 'crossbow', sword: 'weapon-sword', dagger: 'cleaver', blunt: 'hammer', polearm: 'spear' };
const WEAPON_GROUPS = [['sword', 'Мечи'], ['dagger', 'Кинжалы и тесаки'], ['blunt', 'Топоры и дробящее'], ['polearm', 'Древковое'], ['pistol', 'Пистоли'], ['long', 'Винтовки и мушкеты'], ['shot', 'Дробовики'], ['heavy', 'Тяжёлое'], ['bow', 'Луки и арбалеты']];
// dmg — урон в ЕУ; range — дистанция в тайлах; cone — ближний конус; hands — 1/2; ap — Апарту; extra — особенность самого оружия (не способность)
const WEAPONS = [
  { id: 'sword', fam: 'sword', name: 'Меч', kind: 'melee', note: 'Полуторный, рубяще-колющий', dmg: 2, hands: 1, ap: true },
  { id: 'sabre', fam: 'sword', name: 'Сабля', kind: 'melee', note: 'Одноручная, изогнутая, рубящая', dmg: 2, hands: 1, ap: true },
  { id: 'rapier', fam: 'sword', name: 'Рапира', kind: 'melee', note: 'Тонкий колющий клинок дуэлянта', dmg: 1, hands: 1, ap: true, extra: '+1 к атаке в дуэли один на один' },
  { id: 'broadsword', fam: 'sword', name: 'Палаш', kind: 'melee', note: 'Прямой тяжёлый клинок кавалерии', dmg: 3, hands: 1, ap: true },
  { id: 'canesword', fam: 'sword', name: 'Трость-шпага', kind: 'melee', note: 'Клинок спрятан в трости', dmg: 1, hands: 1, ap: true, extra: 'В ножнах выглядит как обычная трость' },
  { id: 'greatsword', fam: 'sword', name: 'Двуручный меч', kind: 'melee', note: 'Длинный клинок, держит дистанцию', dmg: 4, hands: 2, ap: true },
  { id: 'chainsword', fam: 'sword', name: 'Цепной меч', kind: 'melee', note: 'Паровой привод гонит зубья по кромке', dmg: 4, hands: 2, ap: true, extra: 'Громкий: слышно за 10 тайлов' },
  { id: 'dagger', fam: 'dagger', name: 'Кинжал', kind: 'melee', note: 'Короткий, легко спрятать', dmg: 1, hands: 1, ap: true },
  { id: 'stiletto', fam: 'dagger', name: 'Стилет', kind: 'melee', note: 'Узкое жало, ищет щели в броне', dmg: 1, hands: 1, ap: true },
  { id: 'cleaver', fam: 'dagger', name: 'Тесак', kind: 'melee', note: 'Одноручный, рубящий', dmg: 2, hands: 1, ap: true },
  { id: 'axe', fam: 'blunt', name: 'Боевой топор', kind: 'melee', note: 'Одноручный, рубящий', dmg: 2, hands: 1, ap: true },
  { id: 'mace', fam: 'blunt', name: 'Булава', kind: 'melee', note: 'Дробит и мнёт доспех', dmg: 2, hands: 1, ap: true },
  { id: 'gauntlet', fam: 'blunt', name: 'Паровой кастет', kind: 'melee', note: 'Латная перчатка с поршнем', dmg: 2, hands: 1, ap: true, extra: 'Рука остаётся свободной для предметов' },
  { id: 'hammer', fam: 'blunt', name: 'Паровой молот', kind: 'melee', note: 'Двуручный, дробящий', dmg: 4, hands: 2, ap: true },
  { id: 'spear', fam: 'polearm', name: 'Копьё', kind: 'melee', note: 'Древковое, колющее', dmg: 2, hands: 2, range: 2, ap: true },
  { id: 'halberd', fam: 'polearm', name: 'Алебарда', kind: 'melee', note: 'Топор, крюк и пика на одном древке', dmg: 4, hands: 2, range: 2, ap: true },
  { id: 'glaive', fam: 'polearm', name: 'Глефа', kind: 'melee', note: 'Длинный клинок на древке', dmg: 4, hands: 2, range: 2, ap: true },
  { id: 'pistol', ammo: 'ball', fam: 'pistol', name: 'Капсюльный пистоль', kind: 'ranged', note: 'Однозарядный', dmg: 2, hands: 1, range: 3, extra: 'После выстрела — [ОСН] на перезарядку' },
  { id: 'pepperbox', ammo: 'ball', fam: 'pistol', name: 'Перечница', kind: 'ranged', note: 'Многоствольный пистоль', dmg: 1, hands: 1, range: 3, extra: '4 выстрела до перезарядки' },
  { id: 'revolver', ammo: 'cart', fam: 'pistol', name: 'Револьвер', kind: 'ranged', note: 'Барабан на шесть зарядов', dmg: 2, hands: 1, range: 4, extra: '6 выстрелов до перезарядки' },
  { id: 'musket', ammo: 'ball', fam: 'long', name: 'Мушкет', kind: 'ranged', note: 'Гладкоствольный, дым и грохот', dmg: 3, hands: 2, range: 8, extra: 'После выстрела — [ОСН] на перезарядку' },
  { id: 'carbine', ammo: 'cart', fam: 'long', name: 'Карабин', kind: 'ranged', note: 'Укороченная винтовка стражи', dmg: 3, hands: 2, range: 7 },
  { id: 'rifle', ammo: 'cart', fam: 'long', name: 'Винтовка', kind: 'ranged', note: 'Нарезная, дальнобойная', dmg: 4, hands: 2, range: 9, extra: 'Раз в 2 хода — [ОСН] на перезарядку' },
  { id: 'airgun', ammo: 'pellet', fam: 'long', name: 'Пневматическая винтовка', kind: 'ranged', note: 'На сжатом паре', dmg: 2, hands: 2, range: 7, extra: 'Почти бесшумна: не слышно дальше 3 тайлов' },
  { id: 'sawnoff', ammo: 'shell', fam: 'shot', name: 'Обрез', kind: 'ranged', note: 'Два ствола в упор', dmg: 3, hands: 1, cone: 2, extra: '2 выстрела до перезарядки' },
  { id: 'shotgun', ammo: 'shell', fam: 'shot', name: 'Рычажный дробовик', kind: 'ranged', note: 'Картечь, перезарядка рычагом', dmg: 3, hands: 2, cone: 3, extra: 'Раз в 2 хода — [ОСН] на перезарядку' },
  { id: 'blunderbuss', ammo: 'shell', fam: 'shot', name: 'Мушкетон', kind: 'ranged', note: 'Раструб, бьёт всем, что засыпали', dmg: 4, hands: 2, cone: 3, extra: 'После выстрела — [ОСН] на перезарядку' },
  { id: 'mortar', ammo: 'grenade', fam: 'heavy', name: 'Ручная мортира', kind: 'ranged', note: 'Метает гранаты', dmg: 3, hands: 2, range: 6, extra: 'Взрыв задевает всех в радиусе 1 тайла. После выстрела — [ОСН] на перезарядку' },
  { id: 'gatling', ammo: 'belt', fam: 'heavy', name: 'Паровая картечница', kind: 'ranged', note: 'Многоствольная, с котлом за спиной', dmg: 2, hands: 2, range: 5, extra: 'Очередь: 2 атаки за [ОСН], вторая с помехой. Нельзя двигаться в ход стрельбы' },
  { id: 'bow', ammo: 'arrow', fam: 'bow', name: 'Охотничий лук', kind: 'ranged', note: 'Простой лук из дерева и жил', dmg: 1, hands: 2, range: 6, noSlots: true, extra: 'Простое оружие: улучшения на него не ставятся' },
  { id: 'mechbow', ammo: 'arrow', fam: 'bow', name: 'Механический лук', kind: 'ranged', note: 'Блоки и тросы, натяжение держит защёлка', dmg: 2, hands: 2, range: 7, extra: 'Тетиву можно держать натянутой без проверки Атлетики' },
  { id: 'handxbow', ammo: 'bolt', fam: 'bow', name: 'Одноручный арбалет', kind: 'ranged', note: 'Крепится к предплечью', dmg: 2, hands: 1, range: 5, extra: 'Можно носить как доп. оружие вместе с ближним' },
  { id: 'crossbow', ammo: 'bolt', fam: 'bow', name: 'Механический арбалет', kind: 'ranged', note: 'Тихий, с пружинным взводом', dmg: 3, hands: 2, range: 7 }
];
const MELEE = ['sword', 'dagger', 'blunt', 'polearm'], FIRE = ['pistol', 'long', 'shot', 'heavy'], RANGED = [...FIRE, 'bow'];
// t — тир улучшения; fam — для каких видов; fx — dmg (ЕУ), range (тайлы), atk (к кубу атаки), pierce (игнор КБ), ap (даёт Апарту);
// ab — способность в формате мануала; minus — недостаток
const MODS = [
  // ---- I тир: холодное
  { id: 'wrap', t: 1, fam: MELEE, name: 'Кожаная обмотка', fx: { atk: 1 } },
  { id: 'pommel', t: 1, fam: ['sword', 'dagger'], name: 'Утяжелённое навершие', fx: { dmg: 1 }, minus: '−1 к Инициативе' },
  { id: 'serrated', t: 1, fam: ['sword', 'dagger', 'blunt'], name: 'Зазубренная кромка', ab: ['Резня', 'ОСН', '2 раза за бой — гарантированно накладывает Кровотечение при успешной атаке.'] },
  { id: 'poisongroove', t: 1, fam: ['dagger', 'sword'], name: 'Желобок для яда', ab: ['Отравленное лезвие', 'ОСН', '2 раза за бой — гарантированно накладывает Отравление при успешной атаке.'] },
  { id: 'temper', t: 1, fam: MELEE, name: 'Закалённая сталь', ab: ['Несгибаемый', 'ПАС', 'Оружие не ломается и не выбивается при критическом провале.'] },
  { id: 'spikes', t: 1, fam: ['blunt'], name: 'Шипы', ab: ['Оглушение', 'ОСН', '2 раза за бой — при успешном попадании накладывает статус «Оглушён».'] },
  // ---- I тир: дальнее
  { id: 'sight', t: 1, fam: RANGED, name: 'Мушка и целик', fx: { atk: 1 } },
  { id: 'rifling', t: 1, fam: ['pistol', 'long'], name: 'Нарезной ствол', fx: { range: 2 } },
  { id: 'charge', t: 1, fam: FIRE, name: 'Усиленный заряд', fx: { dmg: 1 }, minus: 'на 1 по кубу атаки — осечка, оружие нужно прочистить [ОСН]' },
  { id: 'buckshot', t: 1, fam: ['pistol', 'shot'], name: 'Картечные патроны', ab: ['Картечь', 'ОСН', 'Выстрел с 1 тайла наносит дополнительно 1d4 урона.'] },
  { id: 'choke', t: 1, fam: ['shot'], name: 'Чок-сужение', fx: { range: 1 }, note: 'конус длиннее на 1 тайл' },
  { id: 'spring', t: 1, fam: ['bow'], name: 'Пружинный взвод', ab: ['Быстрый взвод', 'ПАС', 'Перезарядка не тратит действие.'] },
  { id: 'barbs', t: 1, fam: ['bow'], name: 'Зазубренные болты', ab: ['Зазубрины', 'ОСН', 'Успешное попадание отнимает у цели 1 тайл движения на 1 ход.'] },
  { id: 'silencer', t: 1, fam: ['pistol', 'long'], name: 'Глушитель', ab: ['Тихий выстрел', 'ПАС', 'Выстрел не слышен дальше 3 тайлов.'], fx: { range: -1 } },
  // ---- I тир: любое
  { id: 'brass', t: 1, fam: [...MELEE, ...RANGED], name: 'Латунная гравировка', ab: ['Знак мастера', 'ПАС', 'Оружие узнают: подделку под ваше клеймо распознают сразу, а при продаже оружие стоит на треть дороже.'] },

  // ---- II тир: холодное
  { id: 'light', t: 2, fam: ['sword', 'dagger', 'polearm'], name: 'Облегчённый клинок', ab: ['Быстрый выпад', 'ДОП', '1 раз за бой — дополнительная атака с помехой.'] },
  { id: 'piston', t: 2, fam: ['blunt', 'polearm', 'sword'], name: 'Паровой поршень', fx: { dmg: 1 }, ab: ['Размах', 'ОСН', '2 раза за бой — отбрасывает цель на 1 тайл, затем рулетка 1d100: угадали — цель Оглушена.'] },
  { id: 'guard', t: 2, fam: ['sword', 'dagger'], name: 'Гарда-ловушка', ab: ['Обезоруживание', 'ДОП', '1 раз за бой — после успешной защиты цель проходит проверку Ловкости 14, иначе роняет оружие.'] },
  { id: 'hook', t: 2, fam: ['polearm', 'blunt'], name: 'Крюк', ab: ['Подсечка', 'ОСН', '2 раза за бой — цель проходит проверку Стойкости 15, иначе получает «Сбит с ног».'] },
  { id: 'needle', t: 2, fam: ['dagger', 'sword'], name: 'Узкое жало', fx: { pierce: 1 }, note: 'точные удары игнорируют 1 КБ' },
  { id: 'shaft', t: 2, fam: ['polearm'], name: 'Удлинённое древко', fx: { range: 1 }, ab: ['Стена копий', 'ДОП', '2 раза за бой — до вашего следующего хода любой, кто войдёт в зону атаки, получает удар вне хода.'] },
  // ---- II тир: дальнее
  { id: 'scope', t: 2, fam: ['long', 'bow'], name: 'Оптический прицел', fx: { range: 2 }, ab: ['Неподвижная цель', 'ПАС', 'Если вы не двигались в прошлом ходу — +1 к атаке (не стакается).'] },
  { id: 'drum', t: 2, fam: ['pistol', 'shot', 'heavy'], name: 'Барабанный магазин', ab: ['Без перезарядки', 'ПАС', 'Перезарядка нужна только раз в 3 хода.'] },
  { id: 'bipod', t: 2, fam: ['long', 'heavy'], name: 'Сошка', ab: ['Упор', 'ДОП', 'Установить сошку: +2 к атаке, пока вы не двигаетесь.'] },
  { id: 'bayonet', t: 2, fam: ['long', 'shot'], name: 'Штык', fx: { ap: true }, ab: ['Штыковой удар', 'ОСН', 'Атака ближнего боя на 1 тайл, 2 ЕУ.'] },
  { id: 'stock', t: 2, fam: ['pistol'], name: 'Пристёгиваемый приклад', fx: { atk: 1, range: 1 }, minus: 'оружие становится двуручным' },
  { id: 'bolts', t: 2, fam: ['bow'], name: 'Бронебойные болты', fx: { pierce: 1 } },
  { id: 'shrapnel', t: 2, fam: ['heavy'], name: 'Шрапнельные снаряды', ab: ['Шрапнель', 'ОСН', '2 раза за бой — взрыв в радиусе 2 тайлов, 2 ЕУ всем в области.'] },
  { id: 'smoke', t: 2, fam: ['heavy', 'shot'], name: 'Дымовые заряды', ab: ['Дымовая завеса', 'ДОП', '1 раз за бой — все атаки в области 4 тайлов совершаются с помехой 1 ход.'] },

  // ---- III тир: холодное
  { id: 'executioner', t: 3, fam: ['sword', 'blunt', 'polearm'], name: 'Клеймо палача', ab: ['Палач', 'ОСН', '2 раза за бой — +1 ЕУ по цели со статусом.'] },
  { id: 'sweep', t: 3, fam: ['sword', 'polearm', 'blunt'], name: 'Широкое лезвие', ab: ['Сквозной удар', 'ОСН', '2 раза за бой — ударить двух соседних противников одновременно.'] },
  { id: 'mercy', t: 3, fam: ['dagger'], name: 'Гранёное остриё', ab: ['Милосердный удар', 'ОСН', '2 раза за бой — если у цели меньше 3 ОЗ, а куб атаки выше 18, цель добита одним ударом.'] },
  { id: 'unfair', t: 3, fam: ['sword', 'dagger'], name: 'Двойная кромка', ab: ['Нечестный стиль', 'ОСН', 'По цели с Кровотечением — +2 ЕУ и Кровотечение продлевается на 1 ход.'] },
  { id: 'perfectap', t: 3, fam: ['polearm'], name: 'Боевой противовес', ab: ['Совершенное Апарту', 'ПАС', '3 раза за бой — любой, кто входит в зону атаки, может получить удар вне своего хода.'] },
  // ---- III тир: дальнее
  { id: 'through', t: 3, fam: ['long'], name: 'Бронебойная пуля', ab: ['Насквозь', 'ОСН', '1 раз за бой — при кубе атаки выше 16 поражает и второго противника за первым.'] },
  { id: 'spread', t: 3, fam: ['shot'], name: 'Рассеиватель', ab: ['Разброс', 'ОСН', 'Задевает соседние цели в радиусе 2 тайлов, нанося им 1 ЕУ.'] },
  { id: 'incendiary', t: 3, fam: FIRE, name: 'Зажигательный заряд', ab: ['Поджог', 'ОСН', '2 раза за бой — накладывает Горение при успешном попадании.'] },
  { id: 'splitter', t: 3, fam: ['bow'], name: 'Раскалывающий наконечник', ab: ['Раскол', 'ОСН', '2 раза за бой — цель защищается с помехой 1 ход.'] },
  { id: 'twin', t: 3, fam: ['bow', 'pistol'], name: 'Парный механизм', ab: ['Колкий выстрел', 'ОСН', 'С двумя одноручными стволами: при попадании первым второй выстрел идёт без помехи.'] },
  { id: 'boiler', t: 3, fam: ['heavy', 'long'], name: 'Паровой нагнетатель', fx: { dmg: 1, range: 1 }, minus: 'после 3 выстрелов подряд — пропуск хода на остывание' },
  // ---- III тир: любое
  { id: 'lumcore', t: 3, fam: [...MELEE, ...RANGED], name: 'Люмеритовая жила', fx: { dmg: 1 }, ab: ['Светоч', 'ПАС', '+1 ЕУ против проклятых и одержимых. Оружие светится, освещая 2 тайла.'] }
];
const gauge = (label, val, base, max, invert) => {
  const d = Math.round((val - base) * 10) / 10, good = invert ? d < 0 : d > 0;
  return `<div class="gauge"><div class="row"><span>${label}</span><span><b>${val}</b> ${d ? `<em class="${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</em>` : ''}</span></div><div class="bar"><u style="left:${Math.min(val, base) / max * 100}%;width:${Math.abs(d) / max * 100}%"></u><i style="width:${Math.min(val, base) / max * 100}%"></i></div></div>`;
};
const TIER_NAME = { 1: 'I', 2: 'II', 3: 'III' };
const weaponArt = w => WEAPON_ART[w.id] || ART_FALLBACK[w.fam];
const tiles = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'тайл' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'тайла' : 'тайлов'}`;
const modFx = md => {
  const f = md.fx || {}, out = [];
  if (f.dmg) out.push(`${f.dmg > 0 ? '+' : ''}${f.dmg} ЕУ`);
  if (f.range) out.push(`${f.range > 0 ? '+' : ''}${tiles(f.range)}`);
  if (f.atk) out.push(`+${f.atk} к атаке`);
  if (f.pierce) out.push(`игнор ${f.pierce} КБ`);
  if (f.ap) out.push('даёт Апарту');
  if (md.ab) out.push(`«${md.ab[0]}» [${md.ab[1]}]`);
  if (md.note) out.push(md.note);
  return out.join(' · ');
};


/* ---------- Боеприпасы: вид снаряда зависит от оружия ---------- */
const AMMO_CLASS = {
  arrow: 'Стрелы', bolt: 'Арбалетные болты', ball: 'Пуля и порох (дульное заряжание)', cart: 'Патроны',
  shell: 'Дробовые заряды', pellet: 'Пневмоснаряды', grenade: 'Гранаты для мортиры', belt: 'Ленты для картечницы'
};
// fx: dmg / range / pierce; ab — эффект снаряда; t — тир изготовления
const AMMO = [
  { id: 'arrow', cls: 'arrow', t: 1, name: 'Обычная стрела', text: 'Деревянное древко, железный наконечник.' },
  { id: 'arrow-broad', cls: 'arrow', t: 1, name: 'Широкая охотничья стрела', ab: 'При попадании рулетка 1d100: угадали — Кровотечение.' },
  { id: 'arrow-bodkin', cls: 'arrow', t: 2, name: 'Бронебойная стрела', fx: { pierce: 1 }, text: 'Узкий гранёный наконечник.' },
  { id: 'arrow-fire', cls: 'arrow', t: 2, name: 'Зажигательная стрела', ab: 'Накладывает Горение. Не больше 2 раз за бой.' },
  { id: 'arrow-whistle', cls: 'arrow', t: 1, name: 'Свистящая стрела', fx: { dmg: -1 }, ab: 'Громкий свист — сигнал на 20 тайлов.' },
  { id: 'arrow-rope', cls: 'arrow', t: 2, name: 'Стрела с тросом', fx: { dmg: -1 }, ab: 'Вонзается в дерево или кладку: можно натянуть трос до 8 тайлов.' },

  { id: 'bolt', cls: 'bolt', t: 1, name: 'Арбалетный болт', text: 'Короткий и тяжёлый, с латунным оперением.' },
  { id: 'bolt-heavy', cls: 'bolt', t: 2, name: 'Тяжёлый болт', fx: { dmg: 1, range: -1 } },
  { id: 'bolt-ap', cls: 'bolt', t: 2, name: 'Бронебойный болт', fx: { pierce: 1 } },
  { id: 'bolt-poison', cls: 'bolt', t: 2, name: 'Отравленный болт', ab: 'Накладывает Отравление. Не больше 2 раз за бой.' },
  { id: 'bolt-hook', cls: 'bolt', t: 3, name: 'Болт-гарпун', ab: 'Цель проходит проверку Стойкости 14, иначе её подтягивает на 2 тайла к стрелку.' },

  { id: 'ball', cls: 'ball', t: 1, name: 'Свинцовая пуля и порох', text: 'Круглая пуля, бумажный патрон с порохом.' },
  { id: 'ball-buck', cls: 'ball', t: 1, name: 'Картечный заряд', fx: { dmg: 1, range: -2 }, ab: 'С 1 тайла — ещё 1d4 урона.' },
  { id: 'ball-minie', cls: 'ball', t: 2, name: 'Остроконечная пуля', fx: { range: 2 }, text: 'Расширяется в стволе, летит дальше.' },
  { id: 'ball-silver', cls: 'ball', t: 3, name: 'Серебряная пуля', ab: '+1 ЕУ против проклятых и одержимых.' },

  { id: 'cart', cls: 'cart', t: 1, name: 'Обычный патрон', text: 'Латунная гильза, свинцовая пуля.' },
  { id: 'cart-hollow', cls: 'cart', t: 2, name: 'Экспансивная пуля', fx: { dmg: 1 }, ab: 'Против цели в тяжёлой броне урон не растёт.' },
  { id: 'cart-ap', cls: 'cart', t: 2, name: 'Бронебойная пуля', fx: { pierce: 1 } },
  { id: 'cart-tracer', cls: 'cart', t: 2, name: 'Трассирующая пуля', ab: 'Следующая атака союзников по этой цели +1 к атаке.' },
  { id: 'cart-silver', cls: 'cart', t: 3, name: 'Серебряная пуля', ab: '+1 ЕУ против проклятых и одержимых.' },
  { id: 'cart-lum', cls: 'cart', t: 3, name: 'Люмеритовая пуля', fx: { dmg: 1 }, ab: 'Светится в полёте и освещает цель на 1 ход.' },

  { id: 'shell', cls: 'shell', t: 1, name: 'Дробь', text: 'Мелкая дробь — широкий конус, слабее в броню.' },
  { id: 'shell-buck', cls: 'shell', t: 1, name: 'Картечь', fx: { dmg: 1, range: -1 } },
  { id: 'shell-slug', cls: 'shell', t: 2, name: 'Пуля-жакан', single: true, fx: { range: 3 }, ab: 'Бьёт одну цель, без конуса.' },
  { id: 'shell-salt', cls: 'shell', t: 1, name: 'Солевой заряд', fx: { dmg: -2 }, ab: 'Нелетальный: цель проходит Стойкость 13, иначе теряет ход от боли.' },
  { id: 'shell-dragon', cls: 'shell', t: 3, name: '«Драконье дыхание»', ab: 'Конус огня: накладывает Горение на всех в конусе. 1 раз за бой.' },

  { id: 'pellet', cls: 'pellet', t: 1, name: 'Стальные шарики', text: 'Тихие и дешёвые.' },
  { id: 'pellet-dart', cls: 'pellet', t: 2, name: 'Иглы со снотворным', fx: { dmg: -1 }, ab: 'Цель проходит Стойкость 14, иначе засыпает на 2 хода (урон будит).' },

  { id: 'grenade', cls: 'grenade', t: 2, name: 'Осколочная граната', ab: 'Шрапнель: 2 ЕУ всем в радиусе 2 тайлов.' },
  { id: 'grenade-smoke', cls: 'grenade', t: 1, name: 'Дымовая граната', fx: { dmg: -3 }, ab: 'Дымовая завеса радиусом 4 тайла: атаки внутри с помехой.' },
  { id: 'grenade-fire', cls: 'grenade', t: 3, name: 'Зажигательная граната', ab: 'Огненная лужа радиусом 2 тайла: Горение.' },
  { id: 'grenade-oil', cls: 'grenade', t: 2, name: 'Масляная граната', fx: { dmg: -3 }, ab: 'Неустойчивая среда радиусом 4 тайла: передвижение — проверка Ловкости.' },

  { id: 'belt', cls: 'belt', t: 2, name: 'Патронная лента', text: 'Хватает на 3 очереди.' },
  { id: 'belt-ap', cls: 'belt', t: 3, name: 'Бронебойная лента', fx: { pierce: 1 }, text: 'Хватает на 2 очереди.' }
];
const ammoFx = a => { const f = a.fx || {}, o = []; if (f.dmg) o.push(`${f.dmg > 0 ? '+' : ''}${f.dmg} ЕУ`); if (f.range) o.push(`${f.range > 0 ? '+' : ''}${tiles(f.range)}`); if (f.pierce) o.push(`игнор ${f.pierce} КБ`); if (a.ab) o.push(a.ab); else if (a.text) o.push(a.text); return o.join(' · '); };

const Forge = {
  mount(el) {
    const st = Object.assign({ w: 'sword', mods: [] }, MH.store.get('forge', {}));
    const W = () => WEAPONS.find(w => w.id === st.w) || WEAPONS[0];
    el.innerHTML = `<img class="wide-art" src="assets/art/head-forge.webp" alt=""><div class="forge"><div class="wlist" id="fList"><div class="wfilter" role="group" aria-label="Тип оружия">${[['all', 'Всё'], ['melee', 'Холодное'], ['fire', 'Огнестрел'], ['bow', 'Луки']].map(([k, l]) => `<button type="button" data-wf="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}</div>${WEAPON_GROUPS.map(([g, gname]) => `<div class="wgroup" data-g="${g}">${gname}</div>` + WEAPONS.filter(w => w.fam === g).map(w => `<button class="wbtn${WEAPON_ART[w.id] ? '' : ' noart'}" data-g="${w.fam}" data-w="${w.id}" aria-pressed="false"><img src="assets/art/${weaponArt(w)}.webp" alt="" loading="lazy"><b>${w.name}</b><small>${w.dmg} ЕУ · ${w.kind === 'melee' ? (w.range ? tiles(w.range) : w.hands === 2 ? '1.5 тайла' : '1 тайл') : w.cone ? 'конус ' + w.cone : tiles(w.range)}</small></button>`).join('')).join('')}</div>
      <div class="bench panel lit" id="fBench"></div><aside class="panel wcard" id="fStats"></aside></div>
      <p class="note" style="margin-top:18px">Числа черновые. Сколько слотов открыто у конкретного оружия, будет зависеть от материала — каталог материалов с особенностями сделаем отдельно. Здесь показаны все три слота: в первый ставятся улучшения I тира, во второй — до II, в третий — до III. Четвёртый слот откроет дополнительная деталь.</p>`;
    function calc() {
      const w = W(), mods = st.mods.filter(Boolean).map(id => MODS.find(x => x.id === id)).filter(Boolean);
      const r = { dmg: w.dmg, range: w.range || w.cone || 0, atk: 0, pierce: 0, ap: !!w.ap, abs: [], minus: [], hands: w.hands };
      const am = w.ammo && AMMO.find(a => a.id === (st.ammo || {})[w.id] && a.cls === w.ammo) || (w.ammo && AMMO.find(a => a.cls === w.ammo));
      if (am) { const f = am.fx || {}; r.dmg = Math.max(0, r.dmg + (f.dmg || 0)); r.range = Math.max(1, r.range + (f.range || 0)); r.pierce += f.pierce || 0; r.ammo = am; }
      mods.forEach(m => { const f = m.fx || {}; r.dmg += f.dmg || 0; r.range += f.range || 0; r.atk += f.atk || 0; r.pierce += f.pierce || 0; if (f.ap) r.ap = true; if (m.ab) r.abs.push(m); if (m.minus) r.minus.push(m.minus); if (m.id === 'stock') r.hands = 2; });
      return r;
    }
    function draw() {
      const w = W();
      qa('[data-w]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === st.w)));
      const fits = md => md.fam.includes(w.fam);
      st.mods = w.noSlots ? [] : Array.from({ length: SLOT_COUNT }, (_, i) => { const md = MODS.find(x => x.id === st.mods[i]); return md && fits(md) && md.t <= i + 1 ? md.id : ''; });
      q('#fBench', el).innerHTML = `<div class="bench-top"><div><div class="eyebrow">${w.kind === 'melee' ? 'Ближний бой' : 'Дальний бой'} · ${w.note}</div><h3>${w.name}</h3></div></div>
        <div class="weapon-stage${WEAPON_ART[w.id] ? '' : ' noart'}"><img src="assets/art/${w.id === 'sword' && st.mods.filter(Boolean).length >= 3 ? 'weapon-sword-full' : weaponArt(w)}.webp" alt="${w.name}">${WEAPON_ART[w.id] ? '' : '<span class="art-soon">Арт скоро</span>'}</div>
        <div class="slots">${Array.from({ length: 4 }, (_, i) => {
          if (w.noSlots) return `<div class="slot locked">Слот ${TIER_NAME[i + 1] || 'IV'}<br>у простого лука нет слотов</div>`;
          if (i >= SLOT_COUNT) return `<div class="slot locked">Слот IV<br>нужна дополнительная деталь — скоро</div>`;
          const id = st.mods[i] || '', md = MODS.find(x => x.id === id);
          const groups = [1, 2, 3].filter(t => t <= i + 1).map(t => { const list = MODS.filter(m => m.t === t && fits(m)); return list.length ? `<optgroup label="Улучшения ${TIER_NAME[t]} тира">${list.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''} ${st.mods.includes(p.id) && p.id !== id ? 'disabled' : ''}>${p.name}</option>`).join('')}</optgroup>` : ''; }).join('');
          return `<div class="slot ${md ? 'filled' : ''}">${md && !md.noArt ? `<img class="slot-icon" src="assets/art/${md.id}.webp" alt="">` : ''}<div class="sl"><span>Слот ${TIER_NAME[i + 1]}</span></div>
            <select data-slot="${i}" aria-label="Улучшение для слота ${i + 1}"><option value="">— пусто —</option>${groups}</select>
            <div class="fx">${md ? modFx(md) + (md.minus ? ` · <span class="minus">${md.minus}</span>` : '') : 'Выбери улучшение'}</div></div>`;
        }).join('')}</div>`;
      const r = calc(), dist = w.kind === 'melee' ? (r.range ? tiles(r.range) : w.hands === 2 ? '1.5 тайла' : '1 тайл') : w.cone && !(r.ammo && r.ammo.single) ? `ближний конус ${tiles(r.range)}` : tiles(r.range);
      const row = (k, v, d) => `<div class="wrow"><span>${k}</span><b>${v}</b>${d ? `<em>${d}</em>` : ''}</div>`;
      q('#fStats', el).innerHTML = `<div class="eyebrow">Карточка оружия</div><h3>${w.name}</h3>
        ${row('Урон', `${r.dmg} ЕУ`, r.dmg !== w.dmg ? `было ${w.dmg}` : '')}
        ${row('Дистанция', dist, (r.range || 0) !== (w.range || w.cone || 0) ? 'изменена' : '')}
        ${row('Апарту', r.ap ? 'есть' : 'нету', r.ap && !w.ap ? 'от улучшения' : '')}
        ${row('Хват', r.hands === 2 ? 'двуручное' : 'одноручное')}
        ${r.atk ? row('Атака', `+${r.atk}`) : ''}${r.pierce ? row('Пробитие', `игнор ${r.pierce} КБ`) : ''}
        ${row('Снаряд', w.ammo ? AMMO_CLASS[w.ammo] : 'нет — ближний бой')}
        ${w.ammo ? `<div class="ammo-pick" role="group" aria-label="Боеприпас">${AMMO.filter(a => a.cls === w.ammo).map(a => `<button type="button" data-ammo="${a.id}" aria-pressed="${r.ammo && r.ammo.id === a.id}">${a.name}</button>`).join('')}</div><p class="ammo-fx">${ammoFx(r.ammo)}</p>` : ''}
        ${w.extra ? `<p class="wextra">${w.extra}</p>` : ''}
        <div class="eyebrow" style="margin-top:16px">Способности</div>
        ${r.abs.length ? r.abs.map(m => `<div class="wab"><b>«${m.ab[0]}» [${m.ab[1]}]</b><span>${m.ab[2]}</span></div>`).join('') : '<p class="muted" style="font-size:14px">У оружия нет своих способностей — их дают особые улучшения в слотах.</p>'}
        ${r.minus.length ? `<div class="eyebrow" style="margin-top:14px">Недостатки</div>${r.minus.map(x => `<p class="minus" style="font-size:14px;margin:4px 0">${x}</p>`).join('')}` : ''}
        <button class="btn small ghost" id="fClear" style="margin-top:14px">Снять все улучшения</button>`;
      qa('[data-slot]', el).forEach(s => s.onchange = () => { st.mods[+s.dataset.slot] = s.value; play('click'); save(); draw(); });
      q('#fClear', el).onclick = () => { st.mods = []; save(); draw(); };
      qa('[data-ammo]', el).forEach(b => b.onclick = () => { st.ammo = Object.assign({}, st.ammo, { [w.id]: b.dataset.ammo }); play('click'); save(); draw(); });
    }
    const save = () => MH.store.set('forge', st);
    const WF = { melee: MELEE, fire: FIRE, bow: ['bow'] };
    q('#fList', el).addEventListener('click', e => { const f = e.target.closest('[data-wf]'); if (!f) return; qa('[data-wf]', el).forEach(x => x.setAttribute('aria-pressed', String(x === f))); qa('#fList [data-g]', el).forEach(x => { x.hidden = f.dataset.wf !== 'all' && !WF[f.dataset.wf].includes(x.dataset.g); }); play('click'); });
    q('#fList', el).addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; if (st.w !== b.dataset.w) { st.w = b.dataset.w; st.mods = []; } play('card'); save(); draw(); });
    draw();
  }
};

/* ======================= БРОННИК ======================= */
const ARMOR_STATS = [['hp', 'ОЗ'], ['def', 'Защита'], ['mdef', 'Маг. защита'], ['kb', 'КБ'], ['mob', 'Движение'], ['wgt', 'Вес']];
// Броня по правилам: лёгкая +1 ОЗ +1 Защита +1 тайл; средняя +2 ОЗ +1 Защита +2 Маг. защита; тяжёлая +4 ОЗ −1 тайл +2 Стойкость.
// Детали дают доли пункта: полный набор из 4 деталей ≈ +1/+2/+3 Защиты. Всё считается в кап +10.
const fmtFrac = v => { const w = Math.trunc(v), f = Math.round((v - w) * 4); return (w ? w : '') + (['', '¼', '½', '¾'][f] || '') || '0'; };
// Корпус выбирается первым: от него зависят база, особенность, допустимый вес деталей и своя уникальная деталь
const CORPUS = {
  light: { name: 'Лёгкий корпус', sub: 'Стёганка и проклёпанная кожа', base: { hp: 1, def: 1, mdef: 0, kb: 0, mob: 5, wgt: 2 }, allow: ['none', 'light', 'medium'],
    ab: ['Удобное снаряжение', 'ПАС', '+1 ОЗ, +1 Защита, +1 тайл движения. Броня не даёт помехи на Скрытность.'],
    slot: { id: 'cloak', name: 'Плащ', note: 'Только для лёгкого корпуса', opts: [
      ['', '— без плаща —', {}],
      ['travel', 'Дорожный плащ', { mdef: 1 }, 'Защищает от непогоды: Стойкость и Иммунитет в бурю и холод с преимуществом'],
      ['hood', 'Плащ с глубоким капюшоном', {}, '+1 к Скрытности, лицо не разглядеть дальше 2 тайлов'],
      ['duster', 'Пыльник с потайными карманами', { wgt: 1 }, 'Можно спрятать одноручное оружие или 3 предмета от обыска'],
      ['thermo', 'Термоплащ на люмеритовой нити', { mdef: 1, wgt: 1 }, 'Статус Обморожение не действует'] ] } },
  medium: { name: 'Средний корпус', sub: 'Бригантина: кожа с вшитыми пластинами', base: { hp: 2, def: 1, mdef: 2, kb: 0, mob: 4, wgt: 4 }, allow: ['none', 'light', 'medium', 'heavy'],
    ab: ['Опыт боёв', 'ПАС', '+2 ОЗ, +1 Защита, +2 Маг. защита. Разгрузка: достать предмет — [ДОП] вместо [ОСН].'],
    slot: { id: 'belt', name: 'Пояс', note: 'Только для среднего корпуса', opts: [
      ['', '— без пояса —', {}],
      ['bandolier', 'Патронташ', { wgt: 1 }, 'Раз за бой перезарядка не тратит действие'],
      ['medic', 'Подсумок медика', { wgt: 1 }, 'Лечебный набор получает +1 использование'],
      ['tools', 'Пояс инструментов', { wgt: 1 }, '+1 к Механике и Ремеслу при ремонте в бою'],
      ['knives', 'Перевязь метательных ножей', {}, 'Метнуть нож — [ДОП], 1 ЕУ, 4 тайла'] ] } },
  heavy: { name: 'Тяжёлый корпус', sub: 'Латы с паровыми сочленениями', base: { hp: 4, def: 1, mdef: 0, kb: 1, mob: 3, wgt: 8 }, allow: ['none', 'medium', 'heavy'],
    ab: ['Железнобокий', 'ПАС', '+4 ОЗ, +2 Стойкость, −1 тайл движения. Раз за бой гарантированно блокируете физическую атаку — кроме ударов больших монстров. Вас нельзя сбить с ног.'],
    slot: { id: 'helm', name: 'Шлем', note: 'Только для тяжёлого корпуса', opts: [
      ['', '— без шлема —', {}],
      ['open', 'Открытый шлем', { def: 1, wgt: 1 }, 'Обзор не страдает'],
      ['visor', 'Шлем с забралом', { kb: 1, wgt: 2 }, '−1 к Внимательности, пока забрало опущено'],
      ['resp', 'Шлем-респиратор', { def: 1, wgt: 2 }, 'Дым, газы и Дымовая завеса не действуют'],
      ['servo', 'Паровой броневорот', { mob: 1, wgt: 2 }, 'Сервопривод снимает часть веса: +1 тайл движения'] ] } }
};
const ARMOR_BASE = CORPUS.medium.base;
const WEIGHTS = { none: ['Нет', { }], light: ['Лёгкие', { def: .25, wgt: 1 }], medium: ['Средние', { def: .5, mdef: .25, wgt: 2 }], heavy: ['Тяжёлые', { def: .75, mob: -.25, wgt: 3 }] };
const ARMOR_SLOTS = [
  { id: 'bracers', name: 'Наручи', note: 'Защита предплечий' },
  { id: 'pauldrons', name: 'Наплечники', note: 'Плечи и ключицы' },
  { id: 'chest', name: 'Нагрудная пластина', note: 'Главная пластина корпуса', mult: 1.5 },
  { id: 'greaves', name: 'Поножи', note: 'Голени и колени' },
  { id: 'pad1', name: 'Накладка I', note: 'Свободная навеска', extra: true },
  { id: 'pad2', name: 'Накладка II', note: 'Свободная навеска', extra: true }
];
const PAD_MODS = [
  ['', '— без особенности —', {}],
  ['spikes', 'Шипы', { def: 0 }, 'урон тому, кто хватает'],
  ['brass', 'Латунный щиток', { def: 1, wgt: 1 }],
  ['tools', 'Подсумок для инструментов', { mob: 0 }, 'быстрый доступ к деталям'],
  ['lum', 'Люмеритовая вставка', { mdef: 1, wgt: 1 }],
  ['engrave', 'Гравировка мастера', {}, '+1 к Самообладанию против Страха']
];
const ArmorLiving = {
  mount(el) {
    const st = Object.assign({ c: 'medium', w: {}, pad: {}, u: {} }, MH.store.get('armor', {}));
    if (!CORPUS[st.c]) st.c = 'medium';
    el.innerHTML = `<div class="corpus-pick" role="radiogroup" aria-label="Корпус брони">${Object.entries(CORPUS).map(([k, c]) => `<button type="button" role="radio" data-corpus="${k}"><b>${c.name}</b><small>${c.sub}</small><span>${ARMOR_STATS.map(([s, l]) => `${l} ${c.base[s]}`).join(' · ')}</span></button>`).join('')}</div>
      <div class="armor"><div class="panel mannequin" id="aMan"><img src="assets/art/armor-base.webp" alt="Корпус брони"><span class="corpus-badge" id="aBadge"></span></div><div class="panel lit"><div class="bench-top" style="margin-bottom:16px"><div><div class="eyebrow" id="aSub"></div><h3 style="font-size:30px" id="aName"></h3></div><button class="btn small ghost" id="aClear">Снять всё</button></div><div class="armor-slots" id="aSlots"></div></div><aside class="panel" id="aStats"></aside></div>
      <p class="note" style="margin-top:18px">Все значения черновые. Лёгкий корпус не держит тяжёлые детали, тяжёлый — лёгкие. У каждого корпуса своя особенность и своя уникальная деталь.</p>`;
    function draw() {
      const C = CORPUS[st.c], cur = { ...C.base };
      qa('[data-corpus]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.corpus === st.c)));
      q('#aName', el).textContent = C.name; q('#aSub', el).textContent = C.sub;
      q('#aMan', el).dataset.c = st.c; { const im = q('#aMan img', el), src = `assets/art/armor-${st.c}.webp`; if (!im.src.endsWith(src)) { im.classList.add('swap'); setTimeout(() => { im.src = src; im.classList.remove('swap'); }, 180); } } q('#aBadge', el).textContent = C.name;
      Object.keys(st.w).forEach(k => { if (!C.allow.includes(st.w[k])) st.w[k] = 'none'; });
      let html = ARMOR_SLOTS.map(s => {
        const w = st.w[s.id] || 'none', fx = WEIGHTS[w][1], m = s.mult || 1;
        Object.entries(fx).forEach(([k, v]) => cur[k] += v * m);
        const pm = PAD_MODS.find(p => p[0] === (st.pad[s.id] || ''));
        if (s.extra && pm) Object.entries(pm[2]).forEach(([k, v]) => cur[k] += v);
        const pic = s.extra ? (st.pad[s.id] ? 'pad-' + st.pad[s.id] : '') : (w !== 'none' ? `${s.id}-${w}` : '');
        return `<div class="slot ${w !== 'none' ? 'filled' : ''}">${pic ? `<img class="slot-icon" src="assets/art/${pic}.webp" alt="">` : ''}<div class="sl"><span>${s.name}</span>${s.mult ? '<span>×1.5</span>' : ''}</div><div class="muted" style="font-size:13px">${s.note}</div>
          <div class="weight-pick" role="group" aria-label="${s.name}">${Object.entries(WEIGHTS).map(([k, [l]]) => { const ok = C.allow.includes(k); return `<button data-slot="${s.id}" data-wt="${k}" aria-pressed="${k === w}" ${ok ? '' : `disabled title="Не крепится на ${C.name.toLowerCase()}"`}>${l}</button>`; }).join('')}</div>
          ${s.extra ? `<select data-pad="${s.id}" aria-label="Особенность: ${s.name}">${PAD_MODS.map(([id, n]) => `<option value="${id}" ${id === (st.pad[s.id] || '') ? 'selected' : ''}>${n}</option>`).join('')}</select>${pm && pm[3] ? `<div class="fx">${pm[3]}</div>` : ''}` : ''}</div>`;
      }).join('');
      const U = C.slot, uv = st.u[st.c] || '', uo = U.opts.find(o => o[0] === uv) || U.opts[0];
      Object.entries(uo[2]).forEach(([k, v]) => cur[k] += v);
      html += `<div class="slot unique ${uv ? 'filled' : ''}"><div class="sl"><span>${U.name}</span><span class="uniq">особая деталь</span></div><div class="muted" style="font-size:13px">${U.note}</div>
        <select data-uniq="1" aria-label="${U.name}">${U.opts.map(([id, n]) => `<option value="${id}" ${id === uv ? 'selected' : ''}>${n}</option>`).join('')}</select>${uo[3] ? `<div class="fx">${uo[3]}</div>` : ''}</div>`;
      q('#aSlots', el).innerHTML = html;
      Object.keys(cur).forEach(k => cur[k] = Math.floor(cur[k] + 1e-9));
      q('#aStats', el).innerHTML = `<div class="eyebrow">Итог комплекта</div><h3 style="font-size:24px;margin:6px 0 16px">${C.name}</h3>
        <div class="gauges">${ARMOR_STATS.map(([k, l]) => gauge(l, cur[k], C.base[k], { hp: 6, def: 10, mdef: 10, kb: 3, mob: 6, wgt: 20 }[k], k === 'wgt')).join('')}</div>
        <div class="eyebrow" style="margin-top:16px">Особенность корпуса</div>
        <div class="wab"><b>«${C.ab[0]}» [${C.ab[1]}]</b><span>${C.ab[2]}</span></div>
        ${uv ? `<div class="wab"><b>${uo[1]}</b><span>${uo[3] || ''}</span></div>` : ''}
        ${cur.mob <= 2 ? '<p class="note" style="margin-top:14px">Движение низкое: плутам и магам в таком доспехе будет тяжело.</p>' : ''}<p class="muted" style="font-size:12.5px;margin-top:12px">Защита и Маг. защита от брони идут в общий кап +10 вместе с древом, расой и предметами. Детали дают доли пункта — полный набор из четырёх деталей округляется вниз.</p>`;
      qa('[data-wt]', el).forEach(b => b.onclick = () => { if (b.disabled) return; st.w[b.dataset.slot] = b.dataset.wt; play('click'); save(); draw(); });
      qa('[data-pad]', el).forEach(x => x.onchange = () => { st.pad[x.dataset.pad] = x.value; save(); draw(); });
      const us = q('[data-uniq]', el); if (us) us.onchange = () => { st.u[st.c] = us.value; play('click'); save(); draw(); };
    }
    const save = () => MH.store.set('armor', st);
    qa('[data-corpus]', el).forEach(b => b.onclick = () => { st.c = b.dataset.corpus; play('card'); save(); draw(); });
    q('#aClear', el).onclick = () => { st.w = {}; st.pad = {}; st.u = {}; save(); draw(); };
    draw();
  }
};

/* ======================= КРАФТ-СТАНЦИЯ =======================
   Сводный каталог всего, что делается в мастерских: оружие, броня, улучшения, боеприпасы.
   Рецепты и материалы появятся вместе с каталогом материалов. */
const STATIONS = {
  forge: ['Кузня', 'Клинки, топоры, молоты и древковое'],
  gun: ['Оружейный станок', 'Пистоли, ружья, дробовики и тяжёлые стволы'],
  wood: ['Столярный верстак', 'Луки, арбалеты, стрелы и болты'],
  armor: ['Бронный верстак', 'Корпус брони, пластины и накладки'],
  bench: ['Слесарный верстак', 'Улучшения для оружия'],
  alch: ['Алхимический стол', 'Зелья, мази и эликсиры'],
  kitchen: ['Кухня', 'Блюда, выпечка, напитки и заготовки'],
  prosth: ['Протезная мастерская', 'Протезы, импланты, детали и батареи конструктов'],
  medic: ['Стол лекаря', 'Бинты, шины, нити, настойки и хирургия'],
  jewel: ['Ювелирный стол', 'Бижутерия: кольца, серьги, браслеты, ожерелья — скоро'],
  mill: ['Мельница', 'Мука из зерна'],
  distill: ['Перегонный куб', 'Спирт, масла, настойки и вытяжки'],
  brew: ['Пивоварня', 'Солод, эль и вино'],
  smoke: ['Коптильня', 'Копчёное мясо и рыба'],
  gather: ['Сбор', 'Дерево, шкуры, лён, кости и травы добывают в мире'],
  mine: ['Шахта', 'Сырьё добывают, а не делают'],
  smelt: ['Плавильная печь', 'Слитки, сталь, латунь и стекло'],
  sew: ['Швейный стол', 'Кожа, нить, ткань и стёганка'],
  recycle: ['Переработчик', 'Металлы, минералы и топливо из сырья'],
  powder: ['Пороховой стол', 'Пули, патроны, дробь, гранаты'],
  lum: ['Люмеритовый станок', 'Всё, во что вставляют люмерит'],
  draft: ['Чертёжный стол', 'Копии чертежей ремёсел']
};
/* ================= ЦЕПОЧКИ КРАФТА =================
   Ступени: сбор / шахта → переработчик → полуфабрикаты I–III тира → изделие. Всё черновое. */
const GATHER = {
  // собирается или покупается: [название, цвет, где взять, тир]
  wood: ['Простое дерево', '#8a5a32', 'Лесопилки за стеной', 1],
  stone: ['Камень', '#8b8580', 'Каменоломни', 1],
  hide: ['Шкуры', '#9a6a4a', 'Охотничьи угодья', 1],
  fiber: ['Лён', '#d8cfa8', 'Поля за стеной', 1],
  fishscale: ['Рыбья чешуя', '#a9c4c8', 'Причалы и рыбные фермы', 1],
  rope: ['Верёвка', '#b89a6a', 'Порт, торговцы', 1],
  spices: ['Специи', '#b0552a', 'Порт, привоз', 1],
  coffee: ['Кофейные зёрна', '#5a3a24', 'Порт, привоз с юга', 1],
  salt: ['Соль', '#ece7df', 'Торговцы, соляные склады', 1],
  silk: ['Паучий шёлк', '#e0e0e8', 'Логова пауков в старых штольнях', 2],
  // травы I тира
  yarrow: ['Тысячелистник', '#e8e0c8', 'Поля, перелески', 1],
  plantain: ['Подорожник', '#6f9a4a', 'Поля, обочины', 1],
  sage: ['Шалфей', '#8faa8a', 'Перелески', 1],
  mint: ['Болотная мята', '#7fc0a0', 'Болота у шлюзов', 1],
  chamomile: ['Ромашка', '#f0e6a8', 'Поля, перелески', 1],
  wormwood: ['Полынь', '#8aa36a', 'Поля, пустыри', 1],
  belladonna: ['Белладонна', '#4a2a4a', 'Поля, перелески', 1],
  hemlock: ['Болиголов', '#5d7a3e', 'Перелески, болота', 1],
  wolfberry: ['Волчья ягода', '#3a3a6a', 'Перелески', 1],
  poppy: ['Сонный мак', '#c0434f', 'Поля', 1],
  // травы Пустошей, II тир
  fireflower: ['Огнецвет', '#ff7a2a', 'Трещины у люмеритовых разломов', 2],
  icewort: ['Ледянка', '#8fd3f0', 'Холодные поля Пустошей', 2],
  bloodroot: ['Кровоспускатель', '#8a1f2a', 'Болота Пустошей', 2],
  lumfern: ['Люмеритовый папоротник', '#49f0de', 'Люмеритовые разломы', 2],
  ashflower: ['Пепельный цветок', '#6a6460', 'Пепельные поля под заводскими трубами', 2],
  blackroot: ['Чёрный корень', '#2a2420', 'Ядовитые зоны Пустошей', 2],
  dusk: ['Сумерика', '#7a5aa0', 'Сумеречные рощи Пустошей', 2],
  // с тварей Пустошей
  beast_heart: ['Сердце твари', '#a02a3a', 'Твари Пустошей', 3],
  beast_guts: ['Внутренности твари', '#7a3a3a', 'Твари Пустошей', 2],
  beast_meat: ['Мясо твари', '#9a3a2a', 'Твари Пустошей', 2],
  // кухня I тира
  grain: ['Злаки', '#d8b86a', 'Фермы', 1],
  veg: ['Овощи и фрукты', '#c98a4a', 'Фермы и огороды', 1],
  fish: ['Свежая рыба', '#9fb3b8', 'Рыбные фермы, причалы', 1],
  meat: ['Свежее мясо', '#b5463c', 'Охотничьи угодья, скотобойни', 1],
  berries: ['Ягоды', '#7a2a55', 'Перелески, фермы', 1],
  water: ['Чистая вода', '#9cc7e0', 'Колодцы и фильтры', 1],
  milk: ['Молоко', '#f5f1e6', 'Фермы, торговцы', 1],
  honey: ['Мёд', '#e3a83a', 'Пасеки, торговцы', 1],
  // редкие продукты Меттенхейма
  eel: ['Шлюзовой угорь', '#5a6a5a', 'Ночной лов у шлюзов', 2],
  pipeshroom: ['Трубные грибы', '#a08a6a', 'Растут на тёплых заводских трубах', 2],
  lumsalt: ['Люмеритовая соль', '#9ff5ea', 'Светящийся осадок люмеритовых чанов', 3],
  cocoa: ['Какао-бобы с юга', '#5a3220', 'Порт, редкий привоз', 3]
};
const COMP = {
  // [название, тир, станция, рецепт, выход, описание]
  // металлы и стекло
  iron_ingot: ['Железный слиток', 1, 'smelt', [['iron_ore', 2], ['coal', 1]], 1, 'Основа всего железного'],
  copper_ingot: ['Медный слиток', 1, 'smelt', [['copper', 2], ['coal', 1]], 1, 'Трубы, котлы, латунь'],
  glass: ['Стекло', 1, 'smelt', [['quartz', 2], ['coal_powder', 1]], 1, 'Колбы, линзы, механизмы'],
  vial: ['Пустая колба', 1, 'smelt', [['glass', 1]], 3, 'В неё разливают любое зелье'],
  steel: ['Сталь', 2, 'smelt', [['iron_ingot', 2], ['coke', 1]], 1, 'Клинки, иглы, инструменты'],
  brass: ['Латунь', 2, 'smelt', [['copper_ingot', 2], ['tin', 1]], 1, 'Гильзы, гарды, корпуса приборов'],
  gold_ingot: ['Золотой слиток', 2, 'smelt', [['gold', 3], ['coal', 1]], 1, 'Элитное оружие и пластины'],
  lumsteel: ['Люмеритовая сталь', 3, 'lum', [['steel', 2], ['lum_pure', 1]], 1, 'Тёмная сталь с прожилками люмерита'],
  gunpowder: ['Порох', 1, 'powder', [['sulfur', 1], ['coal_powder', 2], ['mineral_bits', 1]], 5, 'Пули, патроны, гранаты'],
  // оружейные заготовки
  grip: ['Рукоять', 1, 'wood', [['wood', 5], ['leather', 2], ['rope', 2]], 1, 'Для мечей, древкового и ружейных лож'],
  tech_parts: ['Стальные детали', 1, 'forge', [['iron_ingot', 6], ['oil', 1]], 1, 'Шестерни, винты, оси'],
  bowstring: ['Прочная тетива', 1, 'wood', [['rope', 4], ['silk', 2]], 1, 'Для луков и арбалетов'],
  mech1: ['Простой механизм', 1, 'bench', [['tech_parts', 2], ['iron_ingot', 4], ['oil', 1]], 1, 'Замок, спуск, взвод'],
  chain: ['Цепь', 1, 'forge', [['iron_ingot', 3]], 1, 'Цепные механизмы, крепления'],
  strong_silk: ['Прочный шёлк', 2, 'sew', [['silk', 6], ['oil', 1]], 1, 'Обмотки, элитная броня'],
  precision: ['Улучшенный механизм', 2, 'bench', [['mech1', 2], ['tech_parts', 3], ['glass', 2], ['oil', 2]], 1, 'Барабаны, затворы, точные спуски'],
  cutgems: ['Огранённые камни', 2, 'jewel', [['gems', 4], ['gold_ingot', 1]], 1, 'Инкрустация и магические пули'],
  lens: ['Линза', 2, 'bench', [['glass', 2], ['mineral_bits', 1]], 1, 'Прицелы и приборы'],
  boiler_p: ['Паровой узел', 2, 'bench', [['copper_ingot', 6], ['rivets', 10], ['tech_parts', 2]], 1, 'Маленький котёл с клапаном'],
  lum_core: ['Люмеритовое ядро', 3, 'lum', [['lum_pure', 2], ['brass', 2], ['glass', 1]], 1, 'Сердце люмеритовых улучшений'],
  lummech: ['Люмеритовый механизм', 3, 'lum', [['precision', 2], ['lumsteel', 2], ['lum_core', 1]], 1, 'Для самых сложных машин'],
  lum_wire: ['Люмеритовая нить', 3, 'lum', [['lum_pure', 1], ['silver', 1], ['strong_silk', 1]], 2, 'Проводит силу люмерита'],
  // кристаллы магии — фокус мага
  crys1: ['Осколок люмерита', 1, 'lum', [['lumerite', 3], ['glass', 1]], 1, 'Кристалл-фокус мага: 4 заряда'],
  crys2: ['Огранённый кристалл', 2, 'lum', [['lum_pure', 2], ['cutgems', 1], ['silver', 1]], 1, 'Кристалл-фокус мага: 8 зарядов, Резонанс'],
  crys3: ['Сердце жилы', 3, 'lum', [['lum_pure', 4], ['lum_core', 1], ['cutgems', 2]], 1, 'Кристалл-фокус мага: 12 зарядов, высшие заклинания дешевле'],
  syringe: ['Шприц', 2, 'bench', [['glass', 1], ['steel', 1], ['brass', 1]], 2, 'Стеклянный шприц со стальной иглой'],
  // заготовки бронника
  leather: ['Выделанная кожа', 1, 'sew', [['hide', 2]], 1, 'Рукояти, ремни, лёгкая броня'],
  rivets: ['Заклёпки', 1, 'forge', [['iron_ingot', 2]], 10, 'Скрепляют пластины и узлы'],
  cloth: ['Ткань', 1, 'sew', [['fiber', 6], ['rope', 1]], 1, 'Бинты, плащи, подклад'],
  plate: ['Стальная пластина', 1, 'armor', [['iron_ingot', 6], ['rivets', 2], ['oil', 1]], 1, 'Вшивается в корпус'],
  silk_cloth: ['Шёлк', 2, 'sew', [['silk', 5], ['cloth', 2]], 1, 'Лёгкие индивидуальные комплекты'],
  gold_plate: ['Золотая пластина', 2, 'armor', [['gold_ingot', 3], ['plate', 2], ['rivets', 3]], 1, 'Парадная и элитная броня'],
  lum_plate: ['Люмеритовая пластина', 3, 'lum', [['plate', 2], ['lumsteel', 5], ['rivets', 4], ['mut2', 1]], 1, 'Элитная броня III тира'],
  lum_silk: ['Люмеритовый шёлк', 3, 'lum', [['strong_silk', 2], ['silk_cloth', 2], ['lum_pure', 2], ['mut2', 1]], 1, 'Защищает от магии'],
  // перегонка
  spirit: ['Спирт', 1, 'distill', [['grain', 5], ['water', 3]], 1, 'Основа алхимии, медицины и настоек'],
  alchdust: ['Алхимическая пыль', 2, 'distill', [['wormwood', 15], ['coal_powder', 5]], 1, 'Участвует в сложных соединениях'],
  // кухонные заготовки
  flour: ['Мука', 1, 'mill', [['grain', 10]], 1, 'Хлеб, крендели и тесто'],
  yeast: ['Дрожжи', 1, 'kitchen', [['grain', 3], ['water', 2]], 1, 'Тесто и пиво'],
  mince: ['Фарш', 1, 'kitchen', [['meat', 3], ['spices', 1]], 2, 'Колбаски и пироги'],
  roastbean: ['Обжаренный кофе', 1, 'kitchen', [['coffee', 3], ['wood', 1]], 2, 'Зёрна, обжаренные в барабане'],
  tincan: ['Жестяная банка', 1, 'forge', [['tin', 1]], 3, 'Консервы заводского образца'],
  broth: ['Костный бульон', 1, 'kitchen', [['water', 5], ['meat', 3], ['spices', 2]], 1, 'Супы и рагу'],
  cream: ['Сливки', 1, 'kitchen', [['milk', 5]], 1, 'Супы и десерты'],
  butter: ['Сливочное масло', 1, 'kitchen', [['milk', 5], ['salt', 1]], 1, 'Выпечка и соусы'],
  glaze: ['Сахарная глазурь', 1, 'kitchen', [['honey', 5], ['spices', 1]], 1, 'Торты и сладкая выпечка'],
  dough: ['Тесто', 2, 'kitchen', [['flour', 2], ['water', 3], ['yeast', 1]], 1, 'Пироги и торты'],
  cheese: ['Сыр', 2, 'kitchen', [['milk', 8], ['salt', 2], ['yeast', 1]], 1, 'Выдерживается в подвалах неделю'],
  smoked: ['Копчёности', 2, 'smoke', [['meat', 4], ['wood', 2], ['salt', 1]], 2, 'Долго хранятся, идут в консервы'],
  marinade: ['Маринад', 2, 'kitchen', [['spices', 2], ['beer', 1], ['salt', 1]], 1, 'Мясо для дорогих блюд'],
  cut: ['Вырезка', 2, 'kitchen', [['meat', 8], ['spices', 2]], 1, 'Лучшие куски туши']
};
// тир оружия при крафте и рецепты в духе Риверсайда
const W_TIER = { dagger: 1, cleaver: 1, sword: 1, sabre: 1, axe: 1, bow: 1, pistol: 1, sawnoff: 1,
  stiletto: 2, rapier: 2, broadsword: 2, greatsword: 2, mace: 2, spear: 2, crossbow: 2, mechbow: 2, musket: 2, pepperbox: 2, shotgun: 2, blunderbuss: 2,
  canesword: 3, chainsword: 3, gauntlet: 3, hammer: 3, halberd: 3, glaive: 3, handxbow: 3, revolver: 3, carbine: 3, rifle: 3, airgun: 3, mortar: 3, gatling: 3 };
const W_REC = {
  dagger: [['iron_ingot', 6], ['wood', 1], ['rope', 1]], cleaver: [['iron_ingot', 8], ['wood', 2], ['rope', 1]],
  sword: [['iron_ingot', 12], ['wood', 3], ['rope', 3]], sabre: [['iron_ingot', 12], ['grip', 1], ['rope', 2]],
  axe: [['iron_ingot', 10], ['wood', 5], ['rope', 3]], bow: [['wood', 8], ['rope', 4]],
  pistol: [['mech1', 1], ['iron_ingot', 10], ['wood', 4], ['gunpowder', 6], ['oil', 2]], sawnoff: [['mech1', 1], ['iron_ingot', 14], ['wood', 4], ['gunpowder', 8], ['oil', 2]],
  stiletto: [['iron_ingot', 20], ['tech_parts', 3], ['grip', 1], ['oil', 2]], rapier: [['iron_ingot', 25], ['tech_parts', 3], ['grip', 1], ['brass', 2], ['oil', 2]],
  broadsword: [['iron_ingot', 35], ['tech_parts', 3], ['grip', 1], ['leather', 3], ['oil', 2]], greatsword: [['iron_ingot', 45], ['tech_parts', 4], ['grip', 2], ['leather', 4], ['oil', 3]],
  mace: [['iron_ingot', 35], ['tech_parts', 3], ['grip', 1], ['leather', 3]], spear: [['iron_ingot', 35], ['tech_parts', 3], ['grip', 2], ['rope', 3]],
  crossbow: [['iron_ingot', 35], ['mech1', 2], ['grip', 1], ['bowstring', 3], ['oil', 3]], mechbow: [['wood', 10], ['mech1', 2], ['bowstring', 3], ['tech_parts', 2], ['oil', 2]],
  musket: [['iron_ingot', 40], ['mech1', 5], ['grip', 1], ['gunpowder', 12], ['glass', 3], ['oil', 3]], pepperbox: [['iron_ingot', 30], ['mech1', 4], ['grip', 1], ['gunpowder', 12], ['oil', 3]],
  shotgun: [['iron_ingot', 45], ['mech1', 4], ['grip', 2], ['gunpowder', 15], ['oil', 4]], blunderbuss: [['iron_ingot', 30], ['brass', 6], ['mech1', 3], ['grip', 2], ['gunpowder', 15], ['oil', 3]],
  canesword: [['tech_parts', 6], ['grip', 1], ['gold_ingot', 2], ['cutgems', 1], ['brass', 4]], chainsword: [['lumsteel', 5], ['precision', 2], ['chain', 3], ['boiler_p', 1], ['grip', 2], ['oil', 6]],
  gauntlet: [['lumsteel', 4], ['precision', 2], ['boiler_p', 1], ['leather', 4], ['oil', 5]], hammer: [['lumsteel', 6], ['tech_parts', 8], ['boiler_p', 1], ['grip', 3], ['oil', 6]],
  halberd: [['tech_parts', 8], ['grip', 3], ['gold_ingot', 3], ['strong_silk', 2], ['lumsteel', 3]], glaive: [['tech_parts', 7], ['grip', 3], ['gold_ingot', 2], ['strong_silk', 2], ['lumsteel', 3]],
  handxbow: [['tech_parts', 6], ['grip', 1], ['bowstring', 4], ['gold_ingot', 2], ['oil', 4]], revolver: [['lumsteel', 3], ['precision', 2], ['grip', 1], ['gold_ingot', 2], ['cutgems', 1], ['gunpowder', 20], ['oil', 5]],
  carbine: [['lumsteel', 5], ['precision', 2], ['grip', 2], ['gold_ingot', 4], ['cutgems', 2], ['gunpowder', 25], ['oil', 6]], rifle: [['lumsteel', 5], ['precision', 3], ['grip', 2], ['lens', 2], ['gold_ingot', 3], ['gunpowder', 25], ['oil', 6]],
  airgun: [['lumsteel', 4], ['precision', 2], ['boiler_p', 1], ['grip', 2], ['lens', 1], ['oil', 6]], mortar: [['lumsteel', 8], ['precision', 1], ['grip', 1], ['gunpowder', 40], ['oil', 6]],
  gatling: [['lumsteel', 10], ['lummech', 2], ['boiler_p', 1], ['precision', 2], ['gunpowder', 35], ['oil', 8]]
};
const M_REC = {
  wrap: [['leather', 2], ['rope', 1]], pommel: [['iron_ingot', 4]], serrated: [['tech_parts', 1], ['oil_bleed', 1]], poisongroove: [['tech_parts', 1], ['oil_poison', 1]], temper: [['iron_ingot', 3], ['oil', 2], ['coal', 2]],
  spikes: [['iron_ingot', 3], ['rivets', 10]], sight: [['brass', 1], ['tech_parts', 1]], rifling: [['tech_parts', 3], ['oil', 1]], charge: [['gunpowder', 10], ['brass', 1]], buckshot: [['lead', 5], ['gunpowder', 5]],
  choke: [['tech_parts', 2], ['oil', 1]], spring: [['mech1', 1], ['tech_parts', 1]], barbs: [['tech_parts', 2]], silencer: [['tech_parts', 2], ['cloth', 2], ['rivets', 10]], brass: [['brass', 2]],
  guard: [['tech_parts', 3], ['brass', 2], ['mech1', 1]], hook: [['tech_parts', 3], ['chain', 1]], needle: [['steel', 2], ['tech_parts', 1]], shaft: [['grip', 2], ['rivets', 10]],
  scope: [['lens', 2], ['brass', 2], ['mech1', 1]], bipod: [['tech_parts', 3], ['mech1', 1]], bayonet: [['steel', 2], ['rivets', 10]], stock: [['grip', 1], ['brass', 2]],
  bolts: [['tech_parts', 4]], shrapnel: [['iron_ingot', 4], ['gunpowder', 15]], smoke: [['gunpowder', 10], ['alchdust', 2], ['cloth', 1]],
  mercy: [['steel', 3], ['cutgems', 1]], unfair: [['steel', 4], ['lumsteel', 1]], perfectap: [['lumsteel', 2], ['brass', 3], ['rivets', 10]], through: [['lumsteel', 1], ['tech_parts', 3]],
  spread: [['precision', 1], ['steel', 2]], incendiary: [['oil_fire', 2], ['gunpowder', 10]], splitter: [['lumsteel', 1], ['glass', 2]], twin: [['precision', 1], ['mech1', 2]],
  boiler: [['boiler_p', 1], ['copper_ingot', 4]], lumcore: [['lum_core', 1], ['lum_wire', 1]]
};
// боеприпасы: обычные партиями по 10, особые — из обычных + боевое масло (как на Риверсайде)
const AMMO_REC = {
  arrow: [[['iron_ingot', 2], ['wood', 5], ['rope', 1]], 10], 'arrow-broad': [[['arrow', 10], ['oil_bleed', 1], ['tech_parts', 1]], 10], 'arrow-bodkin': [[['arrow', 10], ['tech_parts', 2]], 10],
  'arrow-fire': [[['arrow', 10], ['oil_fire', 1]], 10], 'arrow-whistle': [[['arrow', 10], ['brass', 1]], 10], 'arrow-rope': [[['arrow', 10], ['rope', 5]], 10],
  bolt: [[['iron_ingot', 3], ['wood', 4], ['brass', 1]], 10], 'bolt-heavy': [[['bolt', 10], ['iron_ingot', 3]], 10], 'bolt-ap': [[['bolt', 10], ['tech_parts', 2]], 10],
  'bolt-poison': [[['bolt', 10], ['oil_poison', 1]], 10], 'bolt-hook': [[['bolt', 10], ['chain', 1], ['rope', 5]], 10],
  ball: [[['lead', 3], ['gunpowder', 5], ['cloth', 1]], 10], 'ball-buck': [[['ball', 10], ['lead', 3]], 10], 'ball-minie': [[['ball', 10], ['tech_parts', 1]], 10], 'ball-silver': [[['ball', 10], ['silver', 2], ['alchdust', 1]], 10],
  cart: [[['brass', 2], ['lead', 3], ['gunpowder', 5], ['oil', 1]], 10], 'cart-hollow': [[['cart', 10], ['oil_bleed', 1], ['tech_parts', 1]], 10], 'cart-ap': [[['cart', 10], ['steel', 1]], 10],
  'cart-tracer': [[['cart', 10], ['sulfur', 3]], 10], 'cart-silver': [[['cart', 10], ['silver', 2], ['alchdust', 2]], 10], 'cart-lum': [[['cart', 10], ['lum_pure', 1], ['alchdust', 2]], 10],
  shell: [[['brass', 2], ['lead', 5], ['gunpowder', 6]], 10], 'shell-buck': [[['shell', 10], ['lead', 3]], 10], 'shell-slug': [[['shell', 10], ['lead', 4]], 10],
  'shell-salt': [[['shell', 10], ['salt', 10]], 10], 'shell-dragon': [[['shell', 10], ['oil_fire', 1], ['sulfur', 3]], 10],
  pellet: [[['steel', 1]], 20], 'pellet-dart': [[['pellet', 20], ['sleep', 1], ['glass', 1]], 20],
  grenade: [[['iron_ingot', 1], ['tech_parts', 2], ['gunpowder', 15]], 1], 'grenade-smoke': [[['cloth', 1], ['alchdust', 1], ['gunpowder', 15]], 1],
  'grenade-fire': [[['vial', 1], ['oil', 15], ['alchdust', 3]], 1], 'grenade-oil': [[['vial', 1], ['oil', 15]], 1],
  belt: [[['cart', 20], ['leather', 2], ['rivets', 6]], 1], 'belt-ap': [[['cart-ap', 20], ['leather', 2], ['rivets', 6]], 1]
};
// I тир брони — из сырья, как на Риверсайде
const CORPUS_REC = { light: [['hide', 6], ['iron_ingot', 1], ['rope', 4]], medium: [['hide', 6], ['silk', 3], ['rope', 4]], heavy: [['hide', 6], ['iron_ingot', 24], ['silk', 6], ['rope', 3]] };
function pieceRec(slot, w) {
  const m = slot.mult ? 1.5 : 1, n = x => Math.max(1, Math.round(x * m));
  return w === 'light' ? [['leather', n(2)], ['cloth', 1]] : w === 'medium' ? [['leather', 2], ['plate', n(1)], ['rivets', 10]] : [['plate', n(2)], ['rivets', 10], ['leather', 1]];
}
function slotRec(cid, name) {
  const base = { light: [['cloth', 6], ['silk_cloth', 2], ['rope', 1]], medium: [['leather', 4], ['rivets', 10], ['brass', 1]], heavy: [['plate', 3], ['rivets', 10], ['leather', 1]] }[cid].map(x => [...x]);
  const t = name.toLowerCase();
  if (/люмерит|термо/.test(t)) base.push(['lum_wire', 1]);
  if (/пар|механ|клапан|респиратор|маск|линз|окуляр/.test(t)) base.push(['tech_parts', 2]);
  if (/кож|пыльник|капюшон/.test(t)) base.push(['leather', 2]);
  return base;
}
const PAD_REC = { spikes: [['iron_ingot', 3], ['rivets', 10]], brass: [['brass', 3], ['rivets', 10]], tools: [['leather', 3], ['rope', 2]], lum: [['lum_core', 1], ['plate', 1]], engrave: [['gold_ingot', 1], ['brass', 1]] };
// индивидуальная (II) и элитная (III) броня — делается из брони предыдущего тира
const ARMOR_SETS = [
  // [id, название, тир, корпус, рецепт, бонус, особенность]
  ['ranger_duster', 'Пыльник следопыта', 2, 'лёгкий', [['corpus_light', 1], ['cloth', 8], ['silk_cloth', 5], ['strong_silk', 5], ['leather', 5], ['rivets', 10]], '+1 к маг. защите сверх корпуса', '+1 к Скрытности вне города'],
  ['alch_robe', 'Роба алхимика', 2, 'лёгкий', [['corpus_light', 1], ['cloth', 10], ['silk_cloth', 5], ['strong_silk', 2], ['glass', 2]], '+1 к маг. защите сверх корпуса', 'Свои бомбы и пары зелий не задевают носителя'],
  ['guard_uniform', 'Мундир городской стражи', 2, 'средний', [['corpus_medium', 1], ['plate', 6], ['rivets', 20], ['cloth', 6], ['strong_silk', 3], ['leather', 6]], '+1 к защите сверх корпуса', 'Проверки Собранности в строю — с преимуществом'],
  ['boiler_armor', 'Котельный доспех', 2, 'тяжёлый', [['corpus_heavy', 1], ['plate', 10], ['rivets', 20], ['boiler_p', 1], ['leather', 4]], '+1 КБ', 'Холод и Обморожение не действуют'],
  ['undercity_shade', 'Тень Нижнего города', 3, 'лёгкий', [['ranger_duster', 1], ['cloth', 10], ['silk_cloth', 6], ['strong_silk', 8], ['lum_silk', 4], ['gold_plate', 2], ['rivets', 10]], '+1 к защите, +1 к маг. защите', 'Преимущество на Скрытность в темноте'],
  ['parade_armor', 'Парадный доспех Дома', 3, 'средний', [['guard_uniform', 1], ['plate', 8], ['gold_plate', 6], ['lum_plate', 2], ['strong_silk', 5], ['rivets', 20], ['cutgems', 3]], '+2 к защите', '+1 к Запугиванию в официальных сценах и на смотрах'],
  ['house_plate', 'Латы Дома', 3, 'тяжёлый', [['corpus_heavy', 1], ['plate', 14], ['gold_plate', 5], ['lum_plate', 4], ['strong_silk', 4], ['lum_silk', 2], ['rivets', 30], ['iron_ingot', 40]], '+2 к защите, +1 КБ', 'Страх не действует в первый ход боя'],
  ['lum_carapace', 'Люмеритовый панцирь', 3, 'тяжёлый', [['boiler_armor', 1], ['plate', 16], ['lum_plate', 6], ['lum_silk', 4], ['lumsteel', 8], ['rivets', 30], ['cutgems', 2]], '+2 к маг. защите, +1 КБ', 'Светится: Скрытность невозможна']
];
const tierOf = label => /^IV/.test(label) ? 4 : /^III/.test(label) ? 3 : /^II/.test(label) ? 2 : 1;
const TIER_ROMAN = t => ({ 1: 'I', 2: 'II', 3: 'III', 4: 'IV' })[t] || 'I';
const TIER_COL = { 1: '#9a9a9a', 2: '#b8893f', 3: '#d6b25a', 4: '#49f0de' };
const ammoStation = a => a.id === 'cart-lum' ? 'lum' : ['arrow', 'bolt'].includes(a.cls) ? 'wood' : a.cls === 'pellet' ? 'gun' : 'powder';
// единый реестр всего, что можно изготовить: заготовки, зелья, блюда, лекарства, боеприпасы, броня
let _reg;
/* ======================= ИНСТРУМЕНТЫ ДОБЫЧИ =======================
   I тир — по инструменту на дело. II тир — улучшенные: двойной выход и доступ к редкому. III — бур: перерабатывает руду прямо в забое. */
const GTOOL_HERB1 = ['yarrow', 'plantain', 'sage', 'mint', 'chamomile', 'wormwood', 'belladonna', 'hemlock', 'wolfberry', 'poppy', 'grain', 'fiber', 'berries'];
const GTOOL_HERB2 = ['fireflower', 'icewort', 'bloodroot', 'lumfern', 'ashflower', 'blackroot', 'dusk', 'pipeshroom'];
const GTOOL_ORE = ['stone', 'coal', 'ore_rich', 'ore_heavy', 'sulfur_stone', 'quartz_rock', 'oil_shale'];
const GATHER_TOOLS = [
  { id: 'pick1', t: 1, name: 'Кирка', st: 'forge', role: 'Шахта и камень', rec: [['iron_ingot', 3], ['wood', 4], ['leather', 1]],
    gets: GTOOL_ORE, out: '×1', fx: 'Бьёт камень и открытые жилы. Благородная жила и люмеритовая порода ей не поддаются.' },
  { id: 'axe1', t: 1, name: 'Топор', st: 'forge', role: 'Лес', rec: [['iron_ingot', 2], ['wood', 4], ['leather', 1]],
    gets: ['wood'], out: '×1', fx: 'Рубит деревья за стеной и старые сваи у шлюзов.' },
  { id: 'sickle1', t: 1, name: 'Серп', st: 'forge', role: 'Травы и поля', rec: [['iron_ingot', 1], ['wood', 2], ['rope', 1]],
    gets: GTOOL_HERB1, out: '×1', fx: 'Срезает травы полей и болот, злаки, лён и ягоды. Травы Пустошей крошатся: с куста выходит половина.' },
  { id: 'skin1', t: 1, name: 'Нож скорняка', st: 'forge', role: 'Охота: шкуры', rec: [['iron_ingot', 1], ['wood', 1], ['leather', 1]],
    gets: ['hide', 'fishscale', 'silk', 'beast_guts'], out: '×1', fx: 'Снимает шкуры, чешую, паучий шёлк и внутренности. Сердце твари рвётся — нужен улучшенный нож.' },
  { id: 'cleaver1', t: 1, name: 'Топор мясника', st: 'forge', role: 'Охота: мясо', rec: [['iron_ingot', 2], ['wood', 2]],
    gets: ['meat', 'beast_meat', 'fish'], out: '×1', fx: 'Разделывает тушу и рыбу. С твари Пустошей выходит половина мяса — остальное испорчено.' },
  { id: 'kknife1', t: 1, name: 'Кухонный нож', st: 'forge', role: 'Кухня', rec: [['iron_ingot', 1], ['wood', 1]],
    gets: [], out: '—', fx: 'Без него на кухне не режут фарш, вырезку, копчёности и маринад и не чистят шлюзового угря.' },
  { id: 'pickaxe2', t: 2, name: 'Горная кирка-топор', st: 'forge', role: 'Шахта, камень и лес', rec: [['pick1', 1], ['axe1', 1], ['steel', 3], ['rivets', 10]],
    gets: [...GTOOL_ORE, 'vein_noble', 'lum_rock', 'wood'], out: '×2', fx: 'Два инструмента в одном: обух — кирка, лезвие — топор. Берёт благородную жилу и люмеритовую породу.' },
  { id: 'sickle2', t: 2, name: 'Улучшенный серп', st: 'forge', role: 'Травы и Пустоши', rec: [['sickle1', 1], ['steel', 2], ['brass', 1]],
    gets: [...GTOOL_HERB1, ...GTOOL_HERB2], out: '×2', fx: 'Тонкое стальное лезвие. Травы Пустошей и трубные грибы — без потерь, травы полей — вдвое больше.' },
  { id: 'skin2', t: 2, name: 'Улучшенный нож скорняка', st: 'forge', role: 'Охота: шкуры и сердце', rec: [['skin1', 1], ['steel', 2], ['leather', 1]],
    gets: ['hide', 'fishscale', 'silk', 'beast_guts', 'beast_heart'], out: '×2', fx: 'Шкура снимается целиком. Сердце твари вынимается, не порвавшись.' },
  { id: 'cleaver2', t: 2, name: 'Улучшенный топор мясника', st: 'forge', role: 'Охота: мясо', rec: [['cleaver1', 1], ['steel', 3]],
    gets: ['meat', 'beast_meat', 'fish', 'eel'], out: '×2', fx: 'Мясо твари без потерь. Только им разделывают шлюзового угря.' },
  { id: 'chef2', t: 2, name: 'Поварской нож', st: 'forge', role: 'Кухня', rec: [['kknife1', 1], ['steel', 2], ['brass', 1]],
    gets: [], out: '+1 порция', fx: 'Заготовки из мяса и рыбы дают на 1 порцию больше. Блюда III и IV тира — рестораны и стол Домов — готовят только с ним.' },
  { id: 'drill3', t: 3, name: 'Паровой бур', st: 'lum', role: 'Шахта: переработка в забое', rec: [['lum_core', 1], ['lumsteel', 4], ['precision', 4], ['steel', 6], ['brass', 6], ['tech_parts', 10], ['coolant', 2]],
    gets: [...GTOOL_ORE.filter(x => x !== 'stone'), 'vein_noble', 'lum_rock'], out: 'сразу продукт', fx: 'Вгрызается в жилу и тут же дробит породу: вместо руды выдаёт то, что дал бы переработчик.' }
];
const GTOOL_BY = Object.fromEntries(GATHER_TOOLS.map(t => [t.id, t]));
const DRILL_RULES = [
  ['Как получить', 'Собирает только Инженер с вершиной «Гений механики» на люмеритовом станке, по чертежу Общих ремёсел III тира — его даёт Дом Дорн с пулом IV уровня. Проверка Механики 16. Провал — материалы целы, сборка на следующем событии; выпала 1 — люмеритовое ядро треснуло.'],
  ['Топливо', '1 люмеритовое топливо на 3 захода. Без топлива бур — 4 единицы веса бесполезного железа.'],
  ['Перегрев', 'После каждого захода рулетка 1d100. Не угадали — бур перегрет и стоит до конца сцены. Охлаждающая жидкость снимает перегрев сразу.'],
  ['Износ', 'Через 10 заходов нужен капитальный ремонт в мастерской. Без него бур работает как кирка-топор.'],
  ['Что не умеет', 'Люмерит дальше породы не очищает: люмеритовое топливо и очищенный люмерит по-прежнему делает переработчик. Редкие выходы — никель, золото, камни — выпадают вдвое реже, чем в переработчике.'],
  ['Шум', 'Каждый заход слышно на весь штрек. Мастер вправе поднять тварей шахты или охрану чужой артели.'],
  ['Вес', '4. Носят вдвоём или везут на тележке. Один бур на артель — так задумано.']
];
const GTOOL_RULES = [
  ['Без инструмента', 'Руками собирают только то, что лежит: упавшие ветки, ягоды, камни. Ни руды, ни шкур.'],
  ['I тир', 'Свой инструмент на каждое дело. Выход обычный.'],
  ['II тир', 'Улучшенный инструмент делается из инструмента I тира. Двойной выход и доступ к редкому: благородная жила, люмеритовая порода, травы Пустошей, сердце твари, угорь.'],
  ['III тир', 'Паровой бур: дорогой, шумный, ест топливо — зато выдаёт продукт переработки прямо в забое.'],
  ['Износ', 'I тир — 30 заходов, II тир — 60. Затупленный инструмент собирает вполовину, пока его не наточат у кузни: 1 техническое масло, для II тира ещё 1 сталь.'],
  ['Опасные места', 'В Пустошах и старых штольнях заход — проверка Внимательности 12. Провал: выход наполовину или встреча, по решению мастера.']
];
const gtoolName = id => (GTOOL_BY[id] || {}).name;
// что даёт бур вместо руды: выходы переработчика, редкие шансы вдвое реже
function drillOut(id) {
  const outs = RECYCLE[id];
  if (!outs) return id === 'lum_rock' ? [['lumerite', 1]] : [[id, 1]];
  return outs.map(([o, n, ch]) => ch ? [o, n, Math.round(ch / 2)] : [o, n]);
}
const Gathering = {
  mount(el) {
    const st = Object.assign({ t: 0 }, MH.store.get('gtools', {}));
    const chips = ids => ids.length ? ids.map(id => matChip(id, 1)).join('') : '<span class="muted" style="font-size:13px">для кухни</span>';
    const card = t => `<article class="panel gt-card t${t.t}"><div class="gt-head">${artOr(t.id, `<i class="gt-ph" aria-hidden="true">${['', '⚒', '⚒', '⚙'][t.t]}</i>`)}<div><div class="eyebrow">${TIER_ROMAN(t.t)} тир · ${esc(t.role)}</div><h3>${esc(t.name)}</h3><p class="gt-out">Выход: <b>${esc(t.out)}</b></p></div></div>
      <p class="gt-fx">${esc(t.fx)}</p>
      <div class="gt-sub">Что добывает</div><div class="gt-chips">${chips(t.gets)}</div>
      <div class="gt-sub">Рецепт · ${STATIONS[t.st][0]}</div><div class="gt-chips">${t.rec.map(([i, n]) => matChip(i, n)).join('')}</div>
      <button type="button" class="btn small ghost" data-cchain="${t.id}">Цепочка до сырья</button></article>`;
    const res = [...new Set(GATHER_TOOLS.flatMap(t => t.gets))];
    const best = (id, tier) => GATHER_TOOLS.filter(t => t.t === tier && t.gets.includes(id)).map(t => t.name).join(', ') || '—';
    el.innerHTML = `<article class="panel"><div class="eyebrow">Правила добычи</div><div class="kv">${GTOOL_RULES.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${v}</b></div>`).join('')}</div></article>
      <div class="gt-tabs" role="tablist">${[[0, 'Все'], [1, 'I тир'], [2, 'II тир'], [3, 'III тир · бур']].map(([k, l]) => `<button type="button" role="tab" data-gt="${k}" aria-selected="${k === st.t}">${l}</button>`).join('')}</div>
      <div class="gt-grid" id="gtGrid"></div>
      <div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Паровой бур</div><h2>Бур вместо переработчика</h2><p>Бур тратит топливо и шумит, но из забоя сразу несёт продукт. Слева — что лежит в жиле, справа — что отдаёт бур за один заход.</p></div>
      <div class="gt-drill"><article class="panel"><div class="kv">${DRILL_RULES.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${v}</b></div>`).join('')}</div></article>
      <article class="panel"><div class="eyebrow">Что отдаёт бур</div><div class="gt-rows">${GTOOL_BY.drill3.gets.map(id => `<div class="gt-row">${matChip(id, 1)}<span class="arrow">→</span><span>${drillOut(id).map(([o, n, ch]) => matChip(o, n) + (ch ? `<small class="gt-ch">${ch}%</small>` : '')).join(' ')}</span></div>`).join('')}</div></article></div>
      <div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Справочник</div><h2>Чем это добыть</h2></div>
      <div class="panel gt-table"><table><thead><tr><th>Ресурс</th><th>I тир</th><th>II тир</th></tr></thead><tbody>${res.map(id => `<tr><td>${matChip(id, 1)}</td><td>${best(id, 1)}</td><td>${best(id, 2)}</td></tr>`).join('')}</tbody></table></div>`;
    const draw = () => {
      qa('[data-gt]', el).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.gt === st.t)));
      q('#gtGrid', el).innerHTML = GATHER_TOOLS.filter(t => !st.t || t.t === st.t).map(card).join('');
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-gt]'); if (b) { st.t = +b.dataset.gt; MH.store.set('gtools', st); play('click'); draw(); } });
    el.addEventListener('click', compChainClick([], ''));
    draw();
  }
};

function REG() {
  if (_reg) return _reg;
  const r = {};
  Object.entries(COMP).forEach(([id, c]) => r[id] = { name: c[0], tier: c[1], st: c[2], rec: c[3], out: c[4] });
  POTIONS.forEach(p => r[p[0]] = { name: p[1], tier: tierOf(p[2]), st: 'alch', rec: recipeQ(p[4]), out: 1, color: p[3] });
  DISHES.forEach(p => r[p[0]] = { name: p[1], tier: tierOf(p[2]), st: 'kitchen', rec: recipeQ(p[4]), out: 1, color: p[3] });
  MEDS.forEach(m => r[m[0]] = { name: m[1], tier: m[2], st: 'medic', rec: m[3], out: m[4], color: '#8fc27a' });
  AMMO.forEach(a => { const x = AMMO_REC[a.id]; if (x) r[a.id] = { name: a.name, tier: a.t, st: ammoStation(a), rec: x[0], out: x[1] }; });
  Object.entries(CORPUS_REC).forEach(([k, rec]) => r['corpus_' + k] = { name: CORPUS[k].name, tier: 1, st: 'armor', rec, out: 1 });
  ARMOR_SETS.forEach(s => r[s[0]] = { name: s[1], tier: s[2], st: 'armor', rec: s[4], out: 1 });
  CONSTRUCT_CONS.forEach(c => r[c[0]] = { name: c[1], tier: c[2], st: 'prosth', rec: c[3], out: c[4] });
  DORN_MAT.forEach(m => r[m[0]] = { name: m[1], tier: Math.min(3, Math.ceil(m[2] / 2) + 1), st: 'forge', rec: m[3], out: m[4], color: '#c23b2c' });
  GATHER_TOOLS.forEach(t => r[t.id] = { name: t.name, tier: t.t, st: t.st, rec: t.rec, out: 1 });
  Object.assign(r, BP_REG());
  return (_reg = r);
}
const ITEM_ART = new Set(Object.keys(window.ITEM_ART_DATA || {}));
const artSrc = id => (window.ITEM_ART_DATA || {})[id] || '';
const artOr = (id, fb, sm) => ITEM_ART.has(id) ? `<img class="item-art${sm ? ' sm' : ''}" src="${artSrc(id)}" alt="" loading="lazy">` : fb;
function mat(id) {
  const g = REG()[id];
  if (g) return { name: g.name, color: g.color || TIER_COL[g.tier], kind: 'comp', tier: g.tier, src: artSrc(id) };
  if (GATHER[id]) return { name: GATHER[id][0], color: GATHER[id][1], kind: 'gather', where: GATHER[id][2], src: artSrc(id) };
  if (RES[id]) return { name: RES[id][0], color: RES[id][2], kind: RES[id][1] === 'raw' ? 'raw' : 'rec', src: artSrc(id) || (RES_IMG.has(id) ? `assets/res/${id}.webp` : '') };
  return { name: id, color: '#888', kind: 'gather' };
}
const KIND_NAME = { comp: 'изготавливается', gather: 'сбор и закупка', raw: 'шахта', rec: 'переработчик' };
function matChip(id, n) { const m = mat(id); return `<span class="mchip k-${m.kind}" style="--rc:${m.color}" title="${m.name} — ${m.where || KIND_NAME[m.kind]}">${m.src ? `<img src="${m.src}" alt="">` : '<i></i>'}<b>${m.name}</b>${n > 1 ? `<em>×${n}</em>` : ''}</span>`; }
// раскрыть рецепт до исходников: html дерева и суммы листьев
function expandRec(rec, mult = 1, depth = 0, leaves = {}) {
  const html = rec.map(([id, n]) => {
    const need = n * mult, c = REG()[id];
    if (!c) { leaves[id] = (leaves[id] || 0) + need; const m = mat(id); return `<li>${matChip(id, need)}<small>${m.where || KIND_NAME[m.kind]}</small></li>`; }
    const runs = Math.ceil(need / c.out);
    const sub = expandRec(c.rec, runs, depth + 1, leaves).html;
    return `<li class="has">${matChip(id, need)}<small>${STATIONS[c.st][0]} · ${TIER_ROMAN(c.tier)} тир · ${runs} ${runs === 1 ? 'раз' : 'раза'}${c.out > 1 ? ` по ${c.out} шт.` : ''}</small><ul>${sub}</ul></li>`;
  }).join('');
  return { html, leaves };
}
function depthOf(rec) { return rec.reduce((d, [id]) => Math.max(d, REG()[id] ? 1 + depthOf(REG()[id].rec) : 0), 0); }
const ALCH_COMP = ['spirit', 'vial', 'alchdust', 'syringe'];
const KITCHEN_COMP = ['flour', 'yeast', 'mince', 'roastbean', 'tincan', 'broth', 'cream', 'butter', 'glaze', 'dough', 'cheese', 'smoked', 'marinade', 'cut'];
function compSection(ids, eyebrow, title, text) {
  const tiers = [...new Set(ids.map(id => COMP[id][1]))].sort();
  return `<div class="sec-head" style="margin:44px 0 16px"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${text}</p></div>
    ${tiers.map(t => `<div class="al-group"><div class="wgroup">${TIER_ROMAN(t)} тир</div><div class="hl-mgrid">${ids.filter(id => COMP[id][1] === t).map(id => { const c = COMP[id]; return `<article class="hl-med kc" style="--kc:${mat(id).color}"><h4>${artOr(id, '<i>◆</i>', true)}${c[0]}${c[4] > 1 ? ` <em>×${c[4]}</em>` : ''}</h4><p>${STATIONS[c[2]][0]} · ${c[5]}</p><div class="cc-rec">${c[3].map(([i, n]) => matChip(i, n)).join('')}</div><button type="button" class="cc-chain" data-cchain="${id}">Цепочка до сырья</button></article>`; }).join('')}</div></div>`).join('')}`;
}
const compChainClick = (list, station) => e => {
  const d = e.target.closest('[data-dchain]'), c = e.target.closest('[data-cchain]');
  if (d) { const p = list.find(x => x[0] === d.dataset.dchain); showChain(p[1], station, recipeQ(p[4]), 1); }
  else if (c) { const x = REG()[c.dataset.cchain]; showChain(x.name, STATIONS[x.st][0], x.rec, x.out); }
};
function showChain(name, station, rec, out) {
  let modal = document.getElementById('chainModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'chainModal'; modal.className = 'chain-modal'; modal.hidden = true;
    modal.innerHTML = '<div class="chain-card panel" role="dialog" aria-modal="true" aria-labelledby="cmTitle"><button type="button" class="hl-x" data-cm-close aria-label="Закрыть">×</button><div class="cm-body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-cm-close]')) modal.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.hidden = true; });
    window.addEventListener('hashchange', () => { modal.hidden = true; });
  }
  const { html, leaves } = expandRec(rec);
  const groups = [['gather', 'Сбор и закупка'], ['raw', 'Шахта'], ['rec', 'Переработчик']].map(([k, l]) => [l, Object.entries(leaves).filter(([id]) => mat(id).kind === k)]).filter(g => g[1].length);
  modal.querySelector('.cm-body').innerHTML = `<div class="eyebrow">${station}${out > 1 ? ` · за раз ${out} шт.` : ''}</div><h3 id="cmTitle">${name}</h3>
    <div class="chain-sum"><div class="al-sub">Итого исходников</div>${groups.map(([l, arr]) => `<div class="chain-g"><span class="lbl">${l}</span>${arr.map(([id, n]) => matChip(id, n)).join('')}</div>`).join('')}</div>
    <div class="al-sub" style="margin-top:16px">Путь по станциям</div><ul class="chain-tree">${html}</ul>`;
  modal.hidden = false; play('card'); modal.querySelector('[data-cm-close]').focus();
}
const GATHER_GRP = [
  ['Добыча: лес, камень, охота', ['wood', 'stone', 'hide', 'fiber', 'fishscale', 'silk']],
  ['Покупка: порт и торговцы', ['rope', 'spices', 'coffee', 'salt']],
  ['Травы полей и болот · I тир', ['yarrow', 'plantain', 'sage', 'mint', 'chamomile', 'wormwood', 'belladonna', 'hemlock', 'wolfberry', 'poppy']],
  ['Травы Пустошей · II тир', ['fireflower', 'icewort', 'bloodroot', 'lumfern', 'ashflower', 'blackroot', 'dusk']],
  ['С тварей Пустошей', ['beast_heart', 'beast_guts', 'beast_meat']],
  ['Продукты ферм и охоты', ['grain', 'veg', 'fish', 'meat', 'berries', 'water', 'milk', 'honey']],
  ['Редкие продукты Меттенхейма', ['eel', 'pipeshroom', 'lumsalt', 'cocoa']]
];
const COMP_GRP = { smelt: 'Металлы и стекло', lum: 'Люмеритовые заготовки', forge: 'Оружейные заготовки', bench: 'Оружейные заготовки', wood: 'Оружейные заготовки', jewel: 'Оружейные заготовки', gun: 'Оружейные заготовки', sew: 'Заготовки бронника', armor: 'Заготовки бронника', distill: 'Перегонка и порох', powder: 'Перегонка и порох', kitchen: 'Кухонные заготовки', mill: 'Кухонные заготовки' };
const W_GRP = { 1: 'I тир — простое оружие', 2: 'II тир — военное оружие', 3: 'III тир — элитное оружие' };
/* ======================= ЧЕРТЕЖИ РЕМЁСЕЛ =======================
   Шесть ремёсел × три тира. Без чертежа нужного ремесла и тира предмет не сделать.
   Чертёж изучают один раз — он вклеивается в личную книгу ремесла. */
const BP_CRAFTS = [
  ['weapons', 'Оружие', 'оружие, улучшения оружия, боеприпасы', ['forge', 'gun', 'wood', 'bench', 'powder']],
  ['armor', 'Броня', 'корпуса, детали брони, накладки, элитные комплекты', ['armor']],
  ['alchemy', 'Алхимия', 'зелья, масла, инъекции, мутагены, спирт и алхимические основы', ['alch', 'distill']],
  ['cooking', 'Готовка', 'блюда, напитки и кухонные заготовки', ['kitchen', 'mill', 'brew', 'smoke']],
  ['medicine', 'Лекарское дело', 'бинты, шины, настойки, хирургия', ['medic']],
  ['crafting', 'Общие ремёсла', 'слитки, заготовки, протезы, батареи, инструменты добычи', ['smelt', 'sew', 'lum', 'prosth', 'jewel']]
];
const BP_TIER = [
  { t: 1, name: 'I тир', seal: 'медная печать', dc: 10, copy: [['fiber', 3], ['coal_powder', 1]], get: 'Торговцы гильдий — дёшево. Копии на чертёжном столе. На старте у персонажа 3 чертежа I тира любых ремёсел — по предыстории.' },
  { t: 2, name: 'II тир', seal: 'серебряная печать', dc: 14, copy: [['cloth', 2], ['coal_powder', 1], ['silver', 1]], get: 'Мастера Домов за очки фракции, награды за задания, находки на событиях. Копии на чертёжном столе.' },
  { t: 3, name: 'III тир', seal: 'золотая печать с люмеритом', dc: 0, copy: null, get: 'Только с событий, из закрытых архивов или от Дома с пулом IV уровня. Не копируется — каждый на счету.' }
];
const BP_RULES = [
  ['Один чертёж — одна вещь', 'Чертёж — расходник, как материал. Каждый заход крафта тратит 1 чертёж нужного ремесла и тира. Если рецепт даёт несколько штук за заход — патроны, заготовки, — чертёж всё равно один.'],
  ['Без чертежа', 'Вещь не сделать, даже если есть станция и материалы. Без чертежа можно только чинить и разбирать.'],
  ['Разборка', 'Разобрать готовую вещь в мастерской — рулетка 1d100. Угадали — из неё выходит чертёж её ремесла и тира. Не угадали — только часть материалов.'],
  ['Копия', 'На чертёжном столе по образцу того же ремесла и тира — образец не тратится. I тир: лён ×3, угольный порошок, Образование 10. II тир: ткань ×2, угольный порошок, серебро, Образование 14. Выпала 1 — образец испорчен и сгорает. III тир не копируется.'],
  ['Блюда IV тира', 'Стол Домов готовят по чертежу Готовки III тира — и только поварским ножом.']
];
const bpCraftOf = x => { const byCat = { weapon: 'weapons', mod: 'weapons', ammo: 'weapons', armor: 'armor', potion: 'alchemy', food: 'cooking', med: 'medicine' }[x.cat]; if (byCat) return byCat; if (!['body', 'comp', 'tool'].includes(x.cat)) return null; if (x.cat === 'tool') return 'crafting'; const c = BP_CRAFTS.find(c => c[3].includes(x.st)); return c && !['weapons'].includes(c[0]) ? c[0] : 'crafting'; };
const bpId = (craft, t) => `bp_${craft}${Math.min(3, Math.max(1, t))}`;
const bpName = id => { const m = /^bp_([a-z]+)(\d)$/.exec(id); if (!m) return ''; const c = BP_CRAFTS.find(x => x[0] === m[1]); return `Чертежи · ${c[1]} · ${TIER_ROMAN(+m[2])} тир`; };
const BP_REG = () => { const r = {}; BP_CRAFTS.forEach(c => [1, 2, 3].forEach(t => { r[bpId(c[0], t)] = { name: bpName(bpId(c[0], t)), tier: t, st: 'draft', rec: BP_TIER[t - 1].copy || [], out: 1, color: ['', '#b87333', '#c0c6cc', '#d6b25a'][t] }; })); return r; };
const Blueprints = {
  mount(el) {
    const items = craftItems().filter(x => x.bp);
    const st = Object.assign({ c: 'weapons' }, MH.store.get('bp', {}));
    el.innerHTML = `<article class="panel"><div class="eyebrow">Правила чертежей</div><div class="kv bp-kv">${BP_RULES.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${v}</b></div>`).join('')}</div></article>
      <div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Три тира</div><h2>Где взять чертёж</h2></div>
      <div class="bp-tiers">${BP_TIER.map(t => `<article class="panel bp-tier t${t.t}"><div class="eyebrow">${t.name} · ${t.seal}</div><p>${t.get}</p><div class="kv"><div class="wrow"><span>Копия</span><b>${t.copy ? `Образование ${t.dc}` : 'нельзя'}</b></div></div>${t.copy ? `<div class="gt-chips" style="margin-top:8px">${t.copy.map(([i, n]) => matChip(i, n)).join('')}</div>` : ''}</article>`).join('')}</div>
      <div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Шесть ремёсел</div><h2>Что открывает чертёж</h2></div>
      <div class="gt-tabs" role="tablist">${BP_CRAFTS.map(c => `<button type="button" role="tab" data-bpc="${c[0]}" aria-selected="${c[0] === st.c}">${c[1]}</button>`).join('')}</div>
      <div id="bpBody"></div>`;
    function draw() {
      qa('[data-bpc]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.bpc === st.c)));
      const c = BP_CRAFTS.find(x => x[0] === st.c);
      q('#bpBody', el).innerHTML = `<p class="muted" style="margin:0 0 14px">${c[1]}: ${c[2]}.</p><div class="bp-grid">${[1, 2, 3].map(t => {
        const id = bpId(c[0], t), list = items.filter(x => x.bp === id);
        return `<article class="panel bp-card t${t}"><div class="bp-head">${artOr(id, '<i class="gt-ph">✎</i>')}<div><div class="eyebrow">${TIER_ROMAN(t)} тир · ${BP_TIER[t - 1].seal}</div><h3>${bpName(id)}</h3><p class="gt-out">Нужен для рецептов: <b>${list.length}</b> · 1 чертёж на заход</p></div></div>
          <div class="bp-list">${list.slice(0, 14).map(x => `<span>${esc(x.name)}</span>`).join('')}${list.length > 14 ? `<span class="more">и ещё ${list.length - 14}</span>` : ''}</div></article>`;
      }).join('')}</div>`;
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-bpc]'); if (b) { st.c = b.dataset.bpc; MH.store.set('bp', st); play('click'); draw(); } });
    draw();
  }
};

const SLOT_ART = { 'Дорожный плащ': 'cloak-travel', 'Плащ с глубоким капюшоном': 'cloak-hood', 'Пыльник с потайными карманами': 'cloak-duster', 'Термоплащ на люмеритовой нити': 'cloak-thermo', 'Патронташ': 'belt-bandolier', 'Подсумок медика': 'belt-medic', 'Пояс инструментов': 'belt-tools', 'Перевязь метательных ножей': 'belt-knives', 'Открытый шлем': 'helm-open', 'Шлем с забралом': 'helm-visor', 'Шлем-респиратор': 'helm-respirator', 'Паровой броневорот': 'helm-steamcollar' };
function craftItems() {
  const out = [], T = t => TIER_ROMAN(t);
  const famStation = f => MELEE.includes(f) ? 'forge' : f === 'bow' ? 'wood' : 'gun';
  WEAPONS.forEach(w => { const t = W_TIER[w.id] || 1; out.push({ cat: 'weapon', grp: W_GRP[t], st: famStation(w.fam), tier: t, name: w.name, sub: `${T(t)} тир · ${(WEAPON_GROUPS.find(g => g[0] === w.fam) || [])[1]}`, img: weaponArt(w), dim: !WEAPON_ART[w.id],
    stats: `${w.dmg} ЕУ · ${w.kind === 'melee' ? (w.range ? tiles(w.range) : w.hands === 2 ? '1.5 тайла' : '1 тайл') : w.cone ? 'конус ' + w.cone : tiles(w.range)} · ${w.hands === 2 ? 'двуручное' : 'одноручное'}${w.ammo ? ' · ' + AMMO_CLASS[w.ammo].toLowerCase() : ''}`, note: w.noSlots ? 'Без слотов улучшения' : w.note, rec: W_REC[w.id] }); });
  Object.entries(CORPUS).forEach(([ck, c]) => {
    out.push({ cat: 'armor', grp: 'I тир — обычная броня (корпус)', st: 'armor', tier: 1, rec: CORPUS_REC[ck], name: c.name, sub: `I тир · ${c.sub}`, img: 'armor-' + ck, stats: ARMOR_STATS.map(([k, l]) => `${l.toLowerCase()} ${c.base[k]}`).join(' · '), note: `«${c.ab[0]}» [${c.ab[1]}] — ${c.ab[2]}` });
    c.slot.opts.filter(o => o[0]).forEach(o => out.push({ aid: SLOT_ART[o[1]], cat: 'armor', grp: 'Особые детали корпусов', st: 'armor', tier: 2, rec: slotRec(ck, o[1]), name: `${c.slot.name}: ${o[1]}`, sub: `II тир · особая деталь, ${c.name.toLowerCase()}`, img: '', stats: Object.entries(o[2]).map(([k, v]) => `${(ARMOR_STATS.find(a => a[0] === k) || [k, k])[1].toLowerCase()} ${v > 0 ? '+' : ''}${v}`).join(' · ') || '—', note: o[3] || '' }));
  });
  ARMOR_SETS.forEach(s => out.push({ aid: s[0], cat: 'armor', grp: s[2] === 2 ? 'II тир — индивидуальная броня' : 'III тир — элитная броня', st: 'armor', tier: s[2], rec: s[4], name: s[1], sub: `${T(s[2])} тир · ${s[2] === 2 ? 'индивидуальная' : 'элитная'} броня, ${s[3]} корпус`, img: '', stats: s[5], note: s[6] }));
  ARMOR_SLOTS.filter(s => !s.extra).forEach(s => ['light', 'medium', 'heavy'].forEach(k => {
    const fx = WEIGHTS[k][1], m = s.mult || 1, t = k === 'heavy' ? 2 : 1;
    out.push({ cat: 'armor', grp: 'Детали брони: наручи, наплечники, пластины, поножи', st: 'armor', tier: t, rec: pieceRec(s, k), name: `${s.name} — ${WEIGHTS[k][0].toLowerCase()}`, sub: `${T(t)} тир · ${s.note}`, img: `${s.id}-${k}`, stats: `защита +${fmtFrac(fx.def * m)}${fx.mdef ? ' · маг. защита +' + fmtFrac(fx.mdef * m) : ''}${fx.mob ? ' · движение −' + fmtFrac(-fx.mob * m) : ''} · вес +${fx.wgt}`, note: '' });
  }));
  PAD_MODS.filter(p => p[0]).forEach(([id, name, fx, note]) => { const t = id === 'lum' ? 3 : id === 'engrave' ? 2 : 1; out.push({ cat: 'armor', grp: 'Накладки', st: id === 'lum' ? 'lum' : 'armor', tier: t, rec: PAD_REC[id], name: `Накладка: ${name}`, sub: `${T(t)} тир · навеска на корпус`, img: 'pad-' + id,
    stats: Object.entries(fx).filter(([, v]) => v).map(([k, v]) => `${(ARMOR_STATS.find(a => a[0] === k) || [k, k])[1].toLowerCase()} +${v}`).join(' · ') || '—', note: note || '' }); });
  MODS.forEach(m => out.push({ cat: 'mod', grp: `Улучшения ${T(m.t)} тира`, st: m.id === 'lumcore' ? 'lum' : 'bench', tier: m.t, rec: M_REC[m.id], name: m.name, sub: `${T(m.t)} тир · ${m.fam.length >= 9 ? 'любое оружие' : [...new Set(m.fam.map(f => (WEAPON_GROUPS.find(g => g[0] === f) || [])[1]))].join(', ').toLowerCase()}`, img: m.noArt ? '' : m.id,
    stats: modFx(m), note: m.ab ? m.ab[2] : (m.minus ? 'Недостаток: ' + m.minus : '') }));
  AMMO.forEach(a => { const x = AMMO_REC[a.id] || [null, 1]; out.push({ aid: a.id, cat: 'ammo', grp: AMMO_CLASS[a.cls], st: ammoStation(a), tier: a.t, rec: x[0], out: x[1], name: a.name, sub: `${T(a.t)} тир · ${AMMO_CLASS[a.cls]} · для: ${WEAPONS.filter(w => w.ammo === a.cls).map(w => w.name.toLowerCase()).join(', ')}`, img: '', stats: ammoFx(a) || 'Обычный расходник', note: '' }); });
  POTIONS.forEach(p => out.push({ aid: p[0], cat: 'potion', grp: p[2], st: 'alch', tier: tierOf(p[2]), name: p[1], sub: `${p[2]} · ${p[6]}`, img: '', stats: p[5], note: '', rec: recipeQ(p[4]) }));
  DISHES.forEach(p => out.push({ aid: p[0], cat: 'food', grp: p[2], st: 'kitchen', tier: tierOf(p[2]), name: p[1], sub: `${p[2]} · ${p[6]}`, img: '', stats: p[5], note: '', rec: recipeQ(p[4]) }));
  MEDS.forEach(m => out.push({ aid: m[0], cat: 'med', grp: `${T(m[2])} тир — лекарства`, st: 'medic', tier: m[2], name: m[1], sub: `${T(m[2])} тир · лекарство`, img: '', stats: m[5], note: '', rec: m[3], out: m[4] }));
  PARTS.filter(p => !p[7]).forEach(p => out.push({ aid: p[0], cat: 'body', grp: `Протезы и импланты · ${p[1] === 'arm' ? 'Руки' : BODY_SLOTS[p[1]][0]}`, st: 'prosth', tier: p[3], name: p[2], sub: `${T(p[3])} тир · нагрузка ${p[4]} · ${p[6] === 'c' ? 'только конструкты' : p[6] === 'l' ? 'только живые' : 'живые и конструкты'}`, img: '', stats: p[5], note: p[3] > 1 ? `Талбот: пул ${p[3] === 2 ? 2 : 4}-го уровня` : '', rec: partRec(p) }));
  CONSTRUCT_CONS.forEach(c => out.push({ aid: c[0], cat: 'body', grp: 'Батареи и обслуживание конструктов', st: 'prosth', tier: c[2], name: c[1], sub: `${T(c[2])} тир · для конструктов`, img: '', stats: c[5], note: '', rec: c[3], out: c[4] }));
  DORN_MAT.forEach(m => out.push({ aid: m[0], cat: 'comp', grp: 'Материалы Дома Дорн', st: 'forge', tier: Math.min(3, Math.ceil(m[2] / 2) + 1), name: m[1], sub: `Дорн · пул ${m[2]}-го уровня · ${MAT_FOR[m[6]]}`, img: '', stats: m[5], note: '', rec: m[3], out: m[4] }));
  Object.entries(COMP).forEach(([id, c]) => out.push({ aid: id, cat: 'comp', grp: COMP_GRP[c[2]] || 'Прочие заготовки', st: c[2], tier: c[1], name: c[0], sub: `${T(c[1])} тир · заготовка`, img: RES_IMG.has(id) ? 'res:' + id : '', stats: c[5], note: '', rec: c[3], out: c[4] }));
  GATHER_TOOLS.forEach(t => out.push({ aid: t.id, cat: 'tool', grp: `Инструменты добычи · ${TIER_ROMAN(t.t)} тир`, st: t.st, tier: t.t, name: t.name, sub: `${TIER_ROMAN(t.t)} тир · ${t.role}`, img: '', stats: `Выход ${t.out}`, note: t.fx, rec: t.rec }));
  GATHER_GRP.forEach(([gn, ids]) => ids.forEach(id => { const g = GATHER[id]; out.push({ aid: id, cat: 'mat', grp: gn, st: 'gather', tier: g[3], name: g[0], sub: `${T(g[3])} тир · сбор и закупка`, img: '', stats: g[2], note: '' }); }));
  Object.entries(RES).filter(([id]) => !COMP[id]).forEach(([id, [name, type, , use]]) => out.push({ aid: id, cat: 'mat', grp: type === 'raw' ? 'Шахта: сырьё' : type === 'part' ? 'Ювелирные заготовки' : 'Переработчик: металлы и минералы', tier: type === 'rare' ? 2 : 1, st: type === 'raw' ? 'mine' : type === 'part' ? 'jewel' : 'recycle', name, sub: type === 'raw' ? 'Сырьё из шахт' : type === 'part' ? 'Заготовка для бижутерии' : 'Продукт переработки', img: RES_IMG.has(id) ? 'res:' + id : '', stats: use || '', note: RECYCLE[id] ? 'Перерабатывается: ' + RECYCLE[id].map(([o]) => RES[o][0].toLowerCase()).join(', ') : '' }));
  out.forEach(x => { const c = bpCraftOf(x); if (c) { x.bp = bpId(c, x.tier); if (x.rec) x.rec = [...recipeQ(x.rec), [x.bp, 1]]; } });
  BP_CRAFTS.forEach(c => [1, 2, 3].forEach(t => out.push({ aid: bpId(c[0], t), cat: 'bp', grp: 'Чертежи ремёсел', tier: t, name: bpName(bpId(c[0], t)), sub: `${TIER_ROMAN(t)} тир · ${BP_TIER[t - 1].seal}`, img: '', stats: `Открывает: ${c[2]} ${TIER_ROMAN(t)} тира`, note: `Где взять: ${BP_TIER[t - 1].get}`, rec: BP_TIER[t - 1].copy || undefined, st: 'draft' })));
  out.forEach(x => { if (x.aid && ITEM_ART.has(x.aid)) { x.img = 'items:' + x.aid; x.dim = false; } });
  return out;
}
const Craft = {
  mount(el) {
    const items = craftItems();
    const CATS = [['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['mod', 'Улучшения'], ['ammo', 'Боеприпасы'], ['potion', 'Алхимия'], ['food', 'Еда'], ['med', 'Лекарства'], ['body', 'Протезы'], ['comp', 'Заготовки'], ['tool', 'Инструменты'], ['bp', 'Чертежи'], ['mat', 'Сырьё и сбор']];
    const st = Object.assign({ cat: 'all', station: 'all', q: '', tier: 0 }, MH.store.get('craft', {}));
    el.innerHTML = `<div class="craft-top">
        <div class="craft-cats" role="tablist">${CATS.map(([k, l]) => `<button type="button" role="tab" data-cat="${k}">${l} <i>${k === 'all' ? items.length : items.filter(x => x.cat === k).length}</i></button>`).join('')}</div>
        <input type="search" id="cQ" placeholder="Найти: штык, дробь, медь, наручи…" aria-label="Поиск по каталогу">
      </div>
      <div class="craft-tiers" role="group" aria-label="Тир">${[[0, 'Все тиры'], [1, 'I тир'], [2, 'II тир'], [3, 'III тир'], [4, 'IV тир']].map(([t, l]) => `<button type="button" data-tier="${t}">${l}</button>`).join('')}</div>
      <details class="craft-st-fold"><summary>Станции <span id="cStName"></span></summary><div class="craft-stations" role="group" aria-label="Станция">${[['all', 'Все станции', 'Любая мастерская']].concat(Object.entries(STATIONS).map(([k, [n, d]]) => [k, n, d])).map(([k, n, d]) => `<button type="button" data-station="${k}" title="${d}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></details>
      <p class="muted craft-count" id="cCount"></p>
      <div id="cGrid"></div>
      <p class="note" style="margin-top:18px">Крафт идёт по тирам, как на Риверсайде. Сбор, шахта и переработчик дают исходники, из них на станциях делают заготовки I–III тира, а уже из заготовок — изделие. Особые боеприпасы делают из обычных и боевого масла, броню II и III тира — из брони предыдущего тира. Изготовить вещь может мастер её тира и выше. Нажми «Цепочка до сырья», чтобы увидеть весь путь и сколько сырья уйдёт.</p>`;
    const grid = q('#cGrid', el), inp = q('#cQ', el);
    inp.value = st.q;
    function draw() {
      qa('[data-cat]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.cat === st.cat)));
      qa('[data-station]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.station === st.station)));
      qa('[data-tier]', el).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.tier === st.tier)));
      q('#cStName', el).textContent = st.station === 'all' ? '· все' : '· ' + STATIONS[st.station][0];
      const qq = st.q.trim().toLowerCase();
      const list = items.filter(x => (st.cat === 'all' || x.cat === st.cat) && (st.station === 'all' || x.st === st.station) && (!st.tier || x.tier === st.tier) && (!qq || (x.name + ' ' + x.sub + ' ' + x.stats + ' ' + x.note).toLowerCase().includes(qq)));
      q('#cCount', el).textContent = list.length ? `Найдено: ${list.length}` : 'Ничего не нашлось — попробуй другое слово, тир или станцию.';
            const groups = [...new Set(list.map(x => x.grp || 'Прочее'))];
      grid.innerHTML = groups.map(gn => { const gl = list.filter(x => (x.grp || 'Прочее') === gn); return `<section class="craft-sec"><h3 class="craft-grp">${gn} <i>${gl.length}</i></h3><div class="craft-grid">${gl.map(x => { const d = x.rec ? depthOf(x.rec) : 0, i = items.indexOf(x); return `<article class="craft-card c-${x.cat}${st.open === i ? ' open' : ''}" data-card="${i}">
          <button type="button" class="cc-head" aria-expanded="${st.open === i}"><span class="cc-pic">${x.img ? `<img src="${x.img.startsWith('items:') ? artSrc(x.img.slice(6)) : (x.img.startsWith('res:') ? 'assets/res/' + x.img.slice(4) : 'assets/art/' + x.img) + '.webp'}" alt="" loading="lazy"${x.dim ? ' class="dim"' : ''}>` : `<span class="cc-glyph">${{ weapon: '⚔', armor: '⛨', mod: '⚙', ammo: '•', potion: '⚗', food: '♨', med: '✚', body: '⚙', comp: '⚒', mat: '◆' }[x.cat]}</span>`}</span>
            <span class="cc-ht"><span class="cc-tag">${TIER_ROMAN(x.tier)} тир · ${STATIONS[x.st][0]}</span><b>${x.name}</b>${x.rec ? `<small>${x.rec.length} ${x.rec.length < 5 ? 'компонента' : 'компонентов'}${x.out > 1 ? ` · ×${x.out}` : ''}</small>` : `<small>${x.sub || ''}</small>`}</span><span class="cc-arr" aria-hidden="true">▾</span></button>
          <div class="cc-body"><div class="cc-sub">${x.sub || ''}</div>${x.bp ? `<div class="cc-bp">${artOr(x.bp, '', true)}<span>Тратит 1 чертёж: <b>${bpName(x.bp)}</b></span></div>` : ''}<div class="cc-stats">${x.stats}</div>${x.note ? `<p class="cc-note">${x.note}</p>` : ''}${x.rec ? `<div class="al-sub">Рецепт${x.out > 1 ? ` · за раз ${x.out} шт.` : ''}</div><div class="cc-rec">${x.rec.map(([id, n]) => matChip(id, n)).join('')}</div><button type="button" class="cc-chain" data-chain="${i}">Цепочка до сырья · ${d + 1} ${d ? 'ступени' : 'ступень'}</button>` : ''}</div>
        </article>`; }).join('')}</div></section>`; }).join('');
    }
    const save = () => MH.store.set('craft', st);
    qa('[data-cat]', el).forEach(b => b.onclick = () => { st.cat = b.dataset.cat; play('click'); save(); draw(); });
    qa('[data-station]', el).forEach(b => b.onclick = () => { st.station = b.dataset.station; play('click'); save(); draw(); });
    qa('[data-tier]', el).forEach(b => b.onclick = () => { st.tier = +b.dataset.tier; play('click'); save(); draw(); });
    inp.addEventListener('input', () => { st.q = inp.value; save(); draw(); });
    grid.addEventListener('click', e => {
      const b = e.target.closest('[data-chain]');
      if (b) { const x = items[+b.dataset.chain]; showChain(x.name, STATIONS[x.st][0], x.rec, x.out || 1); return; }
      const h = e.target.closest('.cc-head'); if (!h) return;
      const card = h.closest('[data-card]'), i = +card.dataset.card, open = !card.classList.contains('open');
      card.classList.toggle('open', open); h.setAttribute('aria-expanded', String(open)); st.open = open ? i : -1; save(); play('click');
    });
    draw();
  }
};

/* ======================= ПЕРЕРАБОТЧИК =======================
   Ресурсы перетаскиваются в бункер машины, из неё выходят другие ресурсы.
   chance — шанс выпадения в процентах (без него — выпадает всегда). Всё черновое. */
const RES = {
  // сырьё из шахт: [название, тип, цвет, для чего нужно]
  ore_rich: ['Обогащённая руда', 'raw', '#8a7a6c', 'Основные металлы для механизмов, оружия и строительства'],
  ore_heavy: ['Тяжёлая руда', 'raw', '#5d5f66', 'Боеприпасы, пайка, защитные оболочки'],
  vein_noble: ['Благородная жила', 'raw', '#c9b27a', 'Точные приборы, проводящие контакты, алхимические устройства'],
  coal: ['Уголь', 'raw', '#2b2724', 'Печи, выплавка стали, фильтры'],
  sulfur_stone: ['Серный камень', 'raw', '#b9a43a', 'Порох, кислоты, химические смеси'],
  quartz_rock: ['Кварцевая порода', 'raw', '#cfd6d8', 'Стекло, линзы, изоляция, корпуса приборов'],
  oil_shale: ['Масляный сланец', 'raw', '#3d3424', 'Смазка механизмов, герметики, горючие смеси'],
  lum_rock: ['Люмеритовая порода', 'raw', '#5fbfb4', 'Основа самого ценного топлива'],
  // что выходит
  iron_ore: ['Железная руда', 'mat', '#9a948e', 'Механизмы, оружие, строительство'],
  copper: ['Медь', 'mat', '#cf7a45', 'Проводка, трубы, латунь'],
  nickel: ['Никель', 'mat', '#b8bdb5', 'Прочные сплавы, покрытия'],
  lead: ['Свинец', 'mat', '#6f7480', 'Пули, грузила, защитные оболочки'],
  tin: ['Олово', 'mat', '#c4c8cc', 'Пайка, бронза, жесть'],
  silver: ['Серебро', 'mat', '#d9dde2', 'Контакты, серебряные пули, алхимия'],
  gold: ['Золото', 'rare', '#e6b93a', 'Точные контакты, украшения, деньги'],
  gems: ['Драгоценные камни', 'rare', '#c04a8a', 'Линзы, украшения, особые механизмы'],
  coal_powder: ['Угольный порошок', 'mat', '#1f1c1a', 'Порох, фильтры; из него получают кокс'],
  coke: ['Кокс', 'mat', '#3b3633', 'Выплавка стали'],
  sulfur: ['Сера', 'mat', '#ecd94a', 'Порох, кислоты, химические смеси'],
  quartz: ['Кварц', 'mat', '#e6f1f3', 'Стекло, линзы, изоляция'],
  mineral_bits: ['Минеральная крошка', 'waste', '#a39b8e', 'Наполнитель, абразив'],
  oil: ['Техническое масло', 'mat', '#5b4a1e', 'Смазка механизмов'],
  tar: ['Смоляной остаток', 'waste', '#2e2219', 'Герметики, горючие смеси'],
  lumerite: ['Люмерит', 'mat', '#49f0de', 'Неочищенный — его перерабатывают дальше'],
  lum_fuel: ['Люмеритовое топливо', 'rare', '#7fffe9', 'Самое ценное топливо для машин'],
  lum_pure: ['Очищенный люмерит', 'rare', '#b8fff6', 'Вставки, жилы, люмеритовые улучшения'],
  lum_crumb: ['Люмеритовая крошка', 'mat', '#6fe6d6', 'Мелочь от переработки люмерита и шлака — основа зелий маны'],
  slag: ['Шлак', 'waste', '#4a403a', 'Отход переработки руды; из него ещё можно выбить крошку'],
  // детали и заготовки (делаются в мастерских, не в переработчике)
  tech_parts: ['Технические детали', 'part', '#b08a4a', 'Шестерни, пружины и винты для механизмов и улучшений'],
  chain: ['Цепь', 'part', '#9a9a9a', 'Цепные механизмы, бижутерия, крепления'],
  jewel_fittings: ['Ювелирная фурнитура', 'part', '#d6b25a', 'Застёжки, оправы и крепления для бижутерии'],
  blank_ring: ['Заготовка: кольцо', 'part', '#d9b45e', 'Основа для кольца — бижутерия'],
  blank_bracelet: ['Заготовка: браслет', 'part', '#d9b45e', 'Основа для браслета — бижутерия'],
  blank_necklace: ['Заготовка: ожерелье', 'part', '#d9b45e', 'Основа для ожерелья — бижутерия'],
  blank_earring: ['Заготовка: серьга', 'part', '#d9b45e', 'Основа для серьги — бижутерия']
};
const RES_IMG = new Set(['lum_rock','vein_noble','gems','iron_ore','blank_bracelet','blank_ring','blank_necklace','blank_earring','gold','quartz','quartz_rock','coke','lumerite','lum_fuel','oil_shale','copper','mineral_bits','nickel','ore_rich','tin','lum_pure','lead','sulfur','silver','sulfur_stone','tar','tech_parts','oil','ore_heavy','coal','coal_powder','chain','slag','jewel_fittings']);
// вход → выходы [id, кол-во, шанс%]; без шанса — выпадает всегда
const RECYCLE = {
  ore_rich: [['iron_ore', 2], ['copper', 1], ['nickel', 1, 30], ['slag', 1, 40]],
  ore_heavy: [['lead', 2], ['tin', 1], ['slag', 1, 40]],
  slag: [['mineral_bits', 1], ['iron_ore', 1, 15], ['lum_crumb', 1, 10]],
  vein_noble: [['silver', 1], ['gold', 1, 35], ['gems', 1, 15]],
  coal: [['coal_powder', 2]],
  coal_powder: [['coke', 1]],
  sulfur_stone: [['sulfur', 2]],
  quartz_rock: [['quartz', 1], ['mineral_bits', 1]],
  oil_shale: [['oil', 1], ['tar', 1]],
  lum_rock: [['lumerite', 1]],
  lumerite: [['lum_fuel', 1], ['lum_crumb', 3], ['lum_pure', 1, 40]]
};
const resChip = (id, n) => { const [name, , col, use] = RES[id]; return `<span class="res${RES_IMG.has(id) ? ' has-img' : ''}" data-res="${id}" style="--rc:${col}" title="${name}${use ? ' — ' + use : ''}">${RES_IMG.has(id) ? `<img src="assets/res/${id}.webp" alt="" draggable="false">` : '<i></i>'}<b>${name}</b>${n != null ? `<em>×${n}</em>` : ''}</span>`; };
const Recycler = {
  mount(el) {
    const st = Object.assign({ out: {}, log: [] }, MH.store.get('recycle', {}));
    const raws = Object.keys(RES).filter(k => RES[k][1] === 'raw');
    el.innerHTML = `<div class="rc-wrap">
      <section class="panel rc-shelf"><div class="eyebrow">Сырьё из шахт</div><p class="muted" style="font-size:13px;margin:4px 0 10px">Перетащи ресурс в бункер машины или просто нажми на него.</p><div class="rc-list" id="rRaw">${raws.map(id => resChip(id)).join('')}</div></section>
      <section class="rc-machine" id="rMachine" aria-live="polite">
        <div class="rc-art"><img src="assets/art/recycler.webp" alt="Переработчик"><span class="rc-glow"></span><span class="rc-glow g2"></span><span class="rc-lamp l1"></span><span class="rc-lamp l2"></span><span class="rc-lamp l3"></span><span class="rc-smoke"><i></i><i></i><i></i><i></i><i></i></span>
          <div class="rc-hopper" id="rHopper"><span>БУНКЕР</span><small>брось ресурс сюда</small></div></div>
        <div class="rc-chute" id="rChute"></div>
        <p class="rc-recipe" id="rRecipe">Наведи на ресурс, чтобы увидеть, что из него выйдет.</p>
      </section>
      <section class="panel rc-shelf"><div class="rc-head"><div class="eyebrow">Лоток выдачи</div><button class="btn small ghost" id="rClear">Очистить</button></div><p class="muted" style="font-size:13px;margin:4px 0 10px">Полученное тоже можно бросить в машину — из многого выходит что-то ещё.</p><div class="rc-list" id="rOut"></div></section>
    </div>
    <div class="panel rc-book"><div class="eyebrow">Справочник переработки</div><div class="rc-table" id="rBook"></div></div>`;
    const hopper = q('#rHopper', el), chute = q('#rChute', el), machine = q('#rMachine', el);
    const fmt = outs => outs.map(([id, n, ch]) => `${RES[id][0]} ×${n}${ch ? ` <small>(${ch}%)</small>` : ''}`).join(', ');
    function drawOut() {
      const ids = Object.keys(st.out).filter(k => st.out[k] > 0 && RES[k]);
      q('#rOut', el).innerHTML = ids.length ? ids.map(id => resChip(id, st.out[id])).join('') : '<p class="muted" style="font-size:14px">Пока пусто.</p>';
    }
    q('#rBook', el).innerHTML = Object.entries(RECYCLE).map(([id, outs]) => `<div class="rc-row">${resChip(id)}<span class="arrow">→</span><span>${fmt(outs)}<small class="use">${RES[id][3] || ''}</small></span></div>`).join('') + `<div class="eyebrow" style="grid-column:1/-1;margin-top:14px">Для чего нужно</div>` + Object.keys(RES).filter(k => !['raw', 'part'].includes(RES[k][1])).map(id => `<div class="rc-row">${resChip(id)}<span class="arrow">·</span><span>${RES[id][3]}</span></div>`).join('');
    let busy = false;
    function feed(id, fromOut) {
      if (busy) return; const outs = RECYCLE[id];
      if (!outs) { q('#rRecipe', el).innerHTML = `<b>${RES[id][0]}</b> не перерабатывается — это уже конечный материал.`; machine.classList.add('reject'); setTimeout(() => machine.classList.remove('reject'), 500); play('click'); return; }
      if (fromOut) { if (!st.out[id]) return; st.out[id]--; drawOut(); }
      busy = true; machine.classList.add('working'); play('dice');
      hopper.innerHTML = resChip(id);
      setTimeout(() => {
        const got = [];
        outs.forEach(([o, n, ch]) => { if (!ch || Math.random() * 100 < ch) { st.out[o] = (st.out[o] || 0) + n; got.push([o, n]); } });
        chute.innerHTML = got.map(([o, n]) => resChip(o, n)).join('');
        chute.classList.remove('pop'); void chute.offsetWidth; chute.classList.add('pop');
        q('#rRecipe', el).innerHTML = `<b>${RES[id][0]}</b> → ${got.map(([o, n]) => `${RES[o][0]} ×${n}`).join(', ') || 'ничего не вышло'}`;
        hopper.innerHTML = '<span>БУНКЕР</span><small>брось ресурс сюда</small>';
        machine.classList.remove('working'); busy = false; play('card'); drawOut(); MH.store.set('recycle', { out: st.out });
      }, 1100);
    }
    // перетаскивание указателем (мышь и палец)
    let drag = null;
    el.addEventListener('pointerdown', e => {
      const chip = e.target.closest('.rc-list .res'); if (!chip) return;
      e.preventDefault();
      const ghost = chip.cloneNode(true); ghost.classList.add('res-ghost'); document.body.appendChild(ghost);
      drag = { id: chip.dataset.res, fromOut: !!chip.closest('#rOut'), ghost, x: e.clientX, y: e.clientY, moved: false };
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    });
    const over = (x, y) => { const r = machine.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const onMove = e => { if (!drag) return; if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true; drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; machine.classList.toggle('hot', over(e.clientX, e.clientY)); };
    const onUp = e => { if (!drag) return; const d = drag; drag = null; d.ghost.remove(); machine.classList.remove('hot'); if (!d.moved || over(e.clientX, e.clientY)) feed(d.id, d.fromOut); };
    if (window.__rcH) { removeEventListener('pointermove', window.__rcH[0]); removeEventListener('pointerup', window.__rcH[1]); }
    window.__rcH = [onMove, onUp]; addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    el.addEventListener('mouseover', e => { const c = e.target.closest('.rc-list .res'); if (!c || busy) return; const outs = RECYCLE[c.dataset.res]; q('#rRecipe', el).innerHTML = `<b>${RES[c.dataset.res][0]}</b> → ${outs ? fmt(outs) : 'не перерабатывается'}<br><small>${RES[c.dataset.res][3] || ''}</small>`; });
    q('#rClear', el).onclick = () => { st.out = {}; drawOut(); MH.store.set('recycle', { out: st.out }); chute.innerHTML = ''; };
    drawOut();
  }
};

/* ======================= КРАСНОРЕЧИЕ =======================
   Бросок — d20. Одежда задаёт бонус Красноречия (+1/+3/+5). Духи и баня — временные +1. Кап +10.
   Украшения дают особые умения, а полный комплект одного уровня — бонус комплекта. Всё черновое. */
const ELOQ = {
  clothes: [
    { id: 1, img: 'peasant', name: 'Крестьянская одежда', die: 1, text: 'Домотканое, латаное, практичное. На рынке своя, в салоне — чужая.' },
    { id: 2, img: 'burgher', name: 'Одежда горожанина', die: 3, text: 'Добротный сюртук или платье, чистые сапоги. Так ходят мастера, клерки и лавочники.' },
    { id: 3, img: 'rich', name: 'Богатые одежды', die: 5, text: 'Шёлк, бархат, пуговицы с гербом. Двери открываются сами.' }
  ],
  tiers: ['Нет', 'Простое', 'Городское', 'Богатое'],
  tierNote: ['', 'медь, латунь, цветное стекло', 'серебро, кварц, полудрагоценные камни', 'золото, драгоценные камни'],
  slots: [['neck', 'Украшение на шею', 'кулон, ожерелье, цепь'], ['hands', 'Украшение на руки', 'кольца, браслеты'], ['ears', 'Украшение на уши', 'серьги, каффы']],
  // умения украшений [название, описание]
  perks: {
    neck: [null, ['Талисман на удачу', 'Раз в сцену выпала 1 на Красноречии — бросьте рулетку 1d100: угадали, и бросок переигрывается.'], ['Медальон доверия', '+1 к Красноречию со стражей, клерками и мастерами цехов.'], ['Знак положения', '+1 к Красноречию со знатью; слуги и привратники пропускают без вопросов.']],
    hands: [null, ['Ловкие пальцы', '+1 к торгу на рынке и в лавках Ржавых кварталов.'], ['Печатка', '+1 к Красноречию, когда заключаешь сделку или договор.'], ['Перстень с камнем', 'Раз в сцену — преимущество на Красноречие при торге или подкупе.']],
    ears: [null, ['Слух улицы', 'В трактирах и на рынке тебе пересказывают свежие слухи.'], ['Изящество', '+1 к Красноречию в светской беседе и на приёмах.'], ['Блеск', 'Собеседник замечает тебя первым: +1 к Красноречию при знакомстве.']]
  },
  sets: [null,
    ['Свой человек', 'Полный простой комплект: +1 к Красноречию с рабочими, крестьянами и гоблинами — тебя считают своим.'],
    ['Почтенный горожанин', 'Полный городской комплект: стража и чиновники не относятся к тебе с подозрением; +1 к Красноречию в городе.'],
    ['Блеск богатства', 'Полный богатый комплект: преимущество на все броски торговли, торговцы сбавляют цену на 10%.']],
  buffs: { perfume: ['Духи', 6, 'perfume', '+1 к Красноречию'], washed: ['Помылся', 12, 'washed', '+1 к Красноречию'] }
};
const fmtLeft = ms => { const m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `${h} ч ${m % 60} мин` : `${m} мин`; };
const Eloquence = {
  mount(el) {
    const st = Object.assign({ c: 1, neck: 0, hands: 0, ears: 0, buff: {} }, MH.store.get('eloq', {}));
    if (typeof st.buff !== 'object' || !st.buff) st.buff = {};
    el.innerHTML = `<div class="eloq">
      <div class="eloq-main">
        <section><div class="eyebrow">1 · Одежда — задаёт бонус Красноречия</div><div class="eloq-clothes" id="eClothes"></div></section>
        <section><div class="eyebrow">2 · Украшения — особые умения и бонус за полный комплект</div><div class="eloq-slots" id="eSlots"></div></section>
        <section><div class="eyebrow">3 · Уход — временные бафы</div><div class="eloq-care" id="eCare"></div></section>
      </div>
      <aside class="panel eloq-out" id="eOut"></aside>
    </div>
    <div class="panel eloq-rules"><div class="eyebrow">Как это работает</div>
      <p>Красноречие бросается как всё остальное — <b>d20</b> с плюсами. <b>Одежда</b> задаёт бонус: крестьянская +1, горожанина +3, богатые одежды +5. Это единственный путь развития Красноречия: древо, еда и зелья его не поднимают. Кап — +10.</p>
      <p><b>Духи</b> дают +1 к Красноречию на 6 часов, <b>баня</b> — +1 на 12 часов. Потом баф спадает, и его нужно обновить. Таймер считается по реальному времени.</p>
      <p><b>Украшения</b> не меняют бонус одежды, а дают особые умения. Если собрать на шею, руки и уши украшения одного уровня, открывается <b>бонус комплекта</b>. Украшение дороже одежды не работает — золото на крестьянине выглядит краденым.</p></div>`;
    let timer = null;
    function active(k) { const t = st.buff[k]; return t && t > Date.now(); }
    function calc() {
      const C = ELOQ.clothes.find(c => c.id === st.c);
      let bonus = 0; const parts = [], perks = [], warn = [];
      Object.entries(ELOQ.buffs).forEach(([k, [n]]) => { if (active(k)) { bonus += 1; parts.push([n, '+1', fmtLeft(st.buff[k] - Date.now())]); } });
      ELOQ.slots.forEach(([k, n]) => { const t = st[k]; if (!t) return; if (t > st.c) warn.push(`${n}: ${ELOQ.tiers[t].toLowerCase()} не по одежде — умение не работает`); else perks.push(ELOQ.perks[k][t]); });
      const tiers = ELOQ.slots.map(([k]) => st[k]);
      const set = tiers[0] && tiers.every(t => t === tiers[0]) && tiers[0] <= st.c ? ELOQ.sets[tiers[0]] : null;
      return { C, bonus, parts, perks, warn, set };
    }
    function draw() {
      q('#eClothes', el).innerHTML = ELOQ.clothes.map(c => `<button type="button" data-c="${c.id}" aria-pressed="${st.c === c.id}"><img class="eloq-img" src="assets/eloq/clothes-${c.img}.webp" alt=""><b>${c.name}</b><small>${c.text}</small><span>d20 +${c.die}</span></button>`).join('');
      q('#eSlots', el).innerHTML = ELOQ.slots.map(([k, n, ex]) => { const p = st[k] ? ELOQ.perks[k][st[k]] : null; return `<div class="eloq-slot"><div class="sl"><span>${n}</span><small>${ex}</small></div><div class="weight-pick">${ELOQ.tiers.map((t, i) => `<button type="button" data-s="${k}" data-v="${i}" aria-pressed="${st[k] === i}" title="${i ? ELOQ.perks[k][i][0] + ' — ' + ELOQ.tierNote[i] : ''}" class="eloq-tier${i > st.c ? ' over' : ''}">${i ? `<img src="assets/eloq/${k}-${i}.webp" alt="">` : '<span class="none">—</span>'}<span>${t}</span></button>`).join('')}</div>${p ? `<div class="fx"><b>«${p[0]}»</b> — ${p[1]} <span class="muted">· ${ELOQ.tierNote[st[k]]}</span></div>` : ''}</div>`; }).join('');
      q('#eCare', el).innerHTML = Object.entries(ELOQ.buffs).map(([k, [n, h, img, fx]]) => { const on = active(k); return `<div class="eloq-toggle${on ? ' on' : ''}"><img class="eloq-img sm" src="assets/eloq/${img}.webp" alt=""><div><b>${n}</b><small>${fx} на ${h} ч${on ? ` · осталось <em data-left="${k}">${fmtLeft(st.buff[k] - Date.now())}</em>` : ''}</small><div class="eloq-bar"><i style="width:${on ? Math.max(0, (st.buff[k] - Date.now()) / (h * 36e5) * 100) : 0}%"></i></div><div class="eloq-acts"><button type="button" class="btn small${on ? ' ghost' : ''}" data-buff="${k}">${on ? 'Обновить' : k === 'perfume' ? 'Надушиться' : 'Помыться'}</button>${on ? `<button type="button" class="btn small ghost" data-unbuff="${k}">Снять</button>` : ''}</div></div></div>`; }).join('');
      const r = calc(), tot = Math.min(10, r.C.die + r.bonus);
      q('#eOut', el).innerHTML = `<div class="eyebrow">Бросок Красноречия</div>
        <div class="eloq-die" id="eDie"><b>d20<i>+${tot}</i></b><span>${r.C.name}</span></div>
        <button class="btn" id="eRoll" style="width:100%;margin:6px 0 14px">Бросить d20 +${tot}</button>
        <div class="eloq-res" id="eRes"></div>
        ${r.parts.length ? `<div class="eyebrow" style="margin-top:12px">Бафы</div>${r.parts.map(([n, v, left]) => `<div class="wrow"><span>${n}</span><b>${v}</b><em>ещё ${left}</em></div>`).join('')}` : '<p class="muted" style="font-size:13px;margin-top:10px">Бафов нет. Духи и баня дают по +1.</p>'}
        ${r.set ? `<div class="eyebrow" style="margin-top:14px">Бонус комплекта</div><div class="wab set"><b>«${r.set[0]}»</b><span>${r.set[1]}</span></div>` : ''}
        ${r.perks.length ? `<div class="eyebrow" style="margin-top:14px">Умения украшений</div>${r.perks.map(p => `<div class="wab"><b>«${p[0]}»</b><span>${p[1]}</span></div>`).join('')}` : ''}
        ${r.warn.map(w => `<p class="minus" style="font-size:13px;margin:8px 0 0">${w}</p>`).join('')}`;
      q('#eRoll', el).onclick = () => { const n = 20, v = 1 + Math.floor(Math.random() * n); play('dice'); const d = q('#eDie', el); d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); q('#eRes', el).innerHTML = `Выпало <b>${v}</b> + ${tot} = <b>${v + tot}</b>${v === n ? ' — блестяще!' : v === 1 ? ' — неловкая пауза…' : ''}`; };
    }
    const save = () => MH.store.set('eloq', st);
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-c]'), sl = e.target.closest('[data-s]'), b = e.target.closest('[data-buff]'), u = e.target.closest('[data-unbuff]');
      if (c) st.c = +c.dataset.c; else if (sl) st[sl.dataset.s] = +sl.dataset.v;
      else if (b) st.buff[b.dataset.buff] = Date.now() + ELOQ.buffs[b.dataset.buff][1] * 36e5;
      else if (u) delete st.buff[u.dataset.unbuff]; else return;
      play('click'); save(); draw();
    });
    // раз в минуту обновляем таймеры; когда баф спадает — перерисовываем
    clearInterval(window.__eloqT); window.__eloqT = setInterval(() => { if (!document.body.contains(el)) { clearInterval(window.__eloqT); return; } draw(); }, 30000);
    draw();
  }
};

/* ======================= АЛХИМИЯ =======================
   Алхимический стол: 2–3 ингредиента в колбу → зелье. Порядок не важен. Всё черновое. */
const ALCH_ING = {}, COOK_ING = {};
const anyIng = () => null;
const ingName = id => mat(id).name;
const ingColor = id => mat(id).color;
const ingChip = id => RES[id] && !REG()[id] && !ITEM_ART.has(id) ? resChip(id).replace('class="res', `data-ing="${id}" class="res ing`) : `<span class="res ing" data-ing="${id}" style="--rc:${mat(id).color}" title="${mat(id).name} — ${mat(id).where || KIND_NAME[mat(id).kind]}">${ITEM_ART.has(id) ? `<img class="ing-art" src="${artSrc(id)}" alt="" loading="lazy">` : '<i></i>'}<b>${mat(id).name}</b></span>`;
const POTIONS = [
  // [id, название, тир · раздел, цвет, рецепт, действие, длительность, из Риверсайда?]
  ['bitter', 'Горькое зелье', 'I тир · Полевая алхимия', '#7d8f4a', [['plantain', 17], ['yarrow', 17], ['spirit', 2], ['vial', 1]], 'Восстанавливает 2 ОЗ.', 'сразу', true],
  ['rest', 'Зелье отдыха', 'I тир · Полевая алхимия', '#c9b27a', [['sage', 17], ['mint', 17], ['spirit', 2], ['vial', 1]], 'Восстанавливает 2 ОВ.', 'сразу', true],
  ['antidote', 'Противоядие', 'I тир · Полевая алхимия', '#5d7a3e', [['belladonna', 12], ['hemlock', 12], ['plantain', 10], ['spirit', 2], ['vial', 1]], 'Снимает Отравление и даёт иммунитет к яду на 1 ролевой круг.', '1 круг', true],
  ['mana1', 'Зелье маны', 'I тир · Полевая алхимия', '#5fd8e8', [['lum_crumb', 5], ['mint', 10], ['spirit', 2], ['vial', 1]], 'Выливается на кристалл-фокус: +2 заряда (не выше максимума). Одно зелье маны за бой.', 'сразу'],
  ['styptic', 'Кровоостанавливающая мазь', 'I тир · Полевая алхимия', '#8a2f2a', [['yarrow', 15], ['plantain', 10], ['oil', 1], ['vial', 1]], 'Снимает Кровотечение.', 'сразу'],
  ['salts', 'Нюхательная соль', 'I тир · Полевая алхимия', '#e8e2d6', [['salt', 5], ['sulfur', 2], ['vial', 1]], 'Приводит в чувство союзника без сознания (1 ОЗ) или снимает Оглушение.', 'сразу'],
  ['bitter2', 'Горькое зелье II', 'II тир · Алхимический стол', '#8fa04a', [['plantain', 30], ['yarrow', 30], ['sage', 12], ['chamomile', 10], ['spirit', 5], ['oil', 1], ['vial', 1]], 'Восстанавливает 4 ОЗ.', 'сразу', true],
  ['rest2', 'Зелье отдыха II', 'II тир · Алхимический стол', '#d9c28a', [['sage', 30], ['mint', 30], ['chamomile', 12], ['lumfern', 5], ['spirit', 5], ['oil', 1], ['vial', 1]], 'Восстанавливает 4 ОВ.', 'сразу', true],
  ['mana2', 'Зелье маны II', 'II тир · Алхимический стол', '#3fc8f0', [['lum_crumb', 12], ['lumfern', 10], ['icewort', 8], ['spirit', 4], ['oil', 1], ['vial', 1]], '+4 заряда в кристалл-фокус (не выше максимума). Одно зелье маны за бой.', 'сразу'],
  ['hunger', 'Зелье голода', 'II тир · Алхимический стол', '#5a4a6a', [['wolfberry', 18], ['blackroot', 15], ['wormwood', 10], ['spirit', 4], ['oil', 1], ['vial', 1]], 'Сбрасывает эффект еды и бафф «сытость» — можно съесть другое блюдо.', 'сразу', true],
  ['clearbreath', 'Зелье чистого дыхания', 'II тир · Алхимический стол', '#bfe3ea', [['fishscale', 20], ['icewort', 18], ['mint', 22], ['silk', 6], ['spirit', 4], ['vial', 1]], 'Можно дышать под водой, в дыму, газе и заводском смоге.', '1 ч', true],
  ['warming', 'Согревающий эликсир', 'II тир · Алхимический стол', '#e0672a', [['fireflower', 15], ['sage', 10], ['spirit', 3], ['vial', 1]], 'Снимает Обморожение; холод не действует.', '6 ч'],
  ['catseye', 'Кошачий глаз', 'II тир · Алхимический стол', '#d6c23c', [['lumfern', 10], ['wolfberry', 10], ['spirit', 3], ['vial', 1]], 'Ночное зрение на 5 тайлов.', '1 ч'],
  ['sleep', 'Снотворное', 'II тир · Алхимический стол', '#7a3a5a', [['poppy', 20], ['mint', 10], ['spirit', 3], ['vial', 1]], 'Подмешивается в еду или питьё: цель проходит Стойкость 14, иначе засыпает на час.', '1 ч'],
  ['oil_bleed', 'Масло кровотока', 'II тир · Боевые масла', '#8a1f2a', [['bloodroot', 20], ['hemlock', 10], ['oil', 1], ['spirit', 2]], 'Наносится на клинок: шанс наложить Кровотечение ближним оружием. Нужно для особых стрел и пуль.', 'бой', true],
  ['oil_fire', 'Масло поджога', 'II тир · Боевые масла', '#ff7a2a', [['fireflower', 20], ['oil', 1], ['spirit', 4], ['alchdust', 1]], 'Шанс наложить Горение ближним оружием.', 'бой', true],
  ['oil_frost', 'Масло холода', 'II тир · Боевые масла', '#8fd3f0', [['icewort', 20], ['lumfern', 10], ['oil', 1], ['spirit', 2]], 'Шанс наложить Обморожение ближним оружием.', 'бой', true],
  ['oil_poison', 'Ядовитое масло', 'II тир · Боевые масла', '#5d7a3e', [['belladonna', 20], ['hemlock', 20], ['oil', 1], ['alchdust', 1]], 'Шанс наложить Отравление ближним оружием.', 'бой', true],
  ['oil_weak', 'Масло слабости', 'II тир · Боевые масла', '#6a6460', [['wormwood', 20], ['blackroot', 15], ['oil', 1], ['silk', 2], ['alchdust', 1]], 'Шанс наложить Слабость ближним оружием.', 'бой', true],
  ['bitter3', 'Горькое зелье III', 'III тир · Запретная алхимия', '#a0b84a', [['bitter2', 1], ['wolfberry', 15], ['blackroot', 12], ['alchdust', 3], ['oil', 1], ['spirit', 6]], 'Восстанавливает 5 ОЗ и даёт Регенерацию на 2 хода: ещё +2 ОЗ до конца эффекта.', '2 хода', true],
  ['rest3', 'Зелье отдыха III', 'III тир · Запретная алхимия', '#e8d49a', [['rest2', 1], ['lumfern', 12], ['ashflower', 10], ['alchdust', 3], ['oil', 1], ['spirit', 6]], 'Восстанавливает 5 ОВ и даёт «Заряд бодрости»: +1 Разум на 30 минут.', '30 мин', true],
  ['mana3', 'Зелье маны III', 'III тир · Запретная алхимия', '#7ff0ff', [['mana2', 1], ['lum_crumb', 20], ['lum_pure', 1], ['alchdust', 3], ['spirit', 6]], 'Кристалл-фокус заполняется полностью, и на 2 хода — Резонанс: одно заклинание с преимуществом. Трещины не лечит. Одно зелье маны за бой; после боя — Усталость.', '2 хода'],
  ['lumstim', 'Люмеритовый стимулятор', 'III тир · Запретная алхимия', '#49f0de', [['lumerite', 3], ['lumfern', 15], ['alchdust', 2], ['spirit', 4], ['vial', 1]], '+1 ОД. Когда действие кончится — Усталость.', '3 хода'],
  ['truth', 'Сыворотка правды', 'III тир · Запретная алхимия', '#d9dde2', [['poppy', 20], ['silver', 1], ['alchdust', 2], ['spirit', 4], ['vial', 1]], 'Цель проходит Стойкость 15, иначе правдиво отвечает на 3 вопроса.', 'сцена'],
  ['inj_thick', 'Инъекция «Густая кровь»', 'III тир · Инъекции', '#b02a3a', [['mut2', 1], ['bitter2', 1], ['silk', 5], ['spirit', 4], ['alchdust', 2], ['syringe', 1]], 'Мгновенно восстанавливает ВСЕ ОЗ. До конца боя Регенерация: +1 ОЗ каждый ваш ход. Иммунитет к Кровотечению.', 'бой', true],
  ['inj_clean', 'Инъекция «Чистая кровь»', 'III тир · Инъекции', '#7fc0a0', [['mut1', 1], ['antidote', 1], ['belladonna', 12], ['silk', 5], ['spirit', 4], ['syringe', 1]], 'Иммунитет к любому Отравлению на весь ивент.', 'ивент', true],
  ['inj_adren', 'Инъекция «Адреналин»', 'III тир · Инъекции', '#ff8a3a', [['mut1', 1], ['fireflower', 15], ['ashflower', 10], ['spirit', 3], ['syringe', 1]], 'Снимает Оглушение, Страх и «Сбит с ног». +1 ОД на 2 хода. Потом — Усталость.', '2 хода'],
  ['inj_morph', 'Инъекция «Морфий»', 'III тир · Инъекции', '#a08ab8', [['poppy', 25], ['rest2', 1], ['alchdust', 2], ['spirit', 3], ['syringe', 1]], 'Травмы не дают штрафов до конца сцены. Помеха на проверки Разума.', 'сцена'],
  ['inj_wake', 'Инъекция «Пробуждение»', 'III тир · Инъекции', '#f0d070', [['mut2', 1], ['bitter2', 1], ['salts', 1], ['lumfern', 10], ['syringe', 1]], 'Поднимает союзника с 0 ОЗ: он возвращается в бой с половиной ОЗ.', 'сразу'],
  ['inj_iron', 'Инъекция «Железная кожа»', 'III тир · Инъекции', '#8b8f96', [['mut2', 1], ['mineral_bits', 10], ['alchdust', 3], ['spirit', 4], ['syringe', 1]], '+2 КБ до конца боя. После боя −1 Тело на сутки.', 'бой'],
  ['inj_lum', 'Инъекция «Люмеритовый разгон»', 'III тир · Инъекции', '#7fffe9', [['mut3', 1], ['lum_pure', 2], ['alchdust', 3], ['spirit', 6], ['syringe', 1]], 'Два основных действия в ход на 2 хода. Потом −3 ОЗ и Усталость.', '2 хода'],
  ['mut1', 'Слабый мутаген', 'III тир · Мутагены', '#8a6a9a', [['beast_heart', 5], ['beast_guts', 25], ['spirit', 6], ['syringe', 1]], 'Основа для мутаций и шприцов. Даёт или сбрасывает 5 ВП.', '—', true],
  ['mut2', 'Умеренный мутаген', 'III тир · Мутагены', '#9a5aaa', [['mut1', 1], ['beast_heart', 2], ['beast_guts', 6], ['spirit', 8], ['syringe', 1]], 'Более сильная основа. Даёт или сбрасывает 20 ВП.', '—', true],
  ['mut3', 'Сильный мутаген', 'III тир · Мутагены', '#aa3aba', [['mut2', 1], ['beast_heart', 3], ['beast_guts', 12], ['beast_meat', 10], ['spirit', 12], ['syringe', 1]], 'Опасная основа для сильных мутаций. Даёт или сбрасывает 30 ВП.', '—', true]
];
const recipeQ = r => r.map(x => Array.isArray(x) ? x : [x, 1]);
const setKey = r => [...new Set(recipeQ(r).map(([i]) => i))].sort().join('+');
const recipeKey = setKey, potionKey = setKey;
const recipeText = r => recipeQ(r).map(([i, n]) => ingName(i) + (n > 1 ? ' ×' + n : '')).join(' + ');
const POTION_BY_KEY = Object.fromEntries(POTIONS.map(p => [setKey(p[4]), p]));
const DISHES = [
  // [id, название, тир · раздел, цвет, рецепт, эффект, длительность]
  ['pretzel', 'Заводской крендель', 'I тир · Уличная еда', '#c99a5a', [['flour', 2], ['salt', 1], ['water', 1]], '+1 Ремесло, +1 Атлетичность.', '4 ч'],
  ['gruel', 'Похлёбка из столовой', 'I тир · Уличная еда', '#a88a52', [['grain', 8], ['veg', 4], ['water', 2]], '+1 Стойкость, +1 Воля.', '4 ч'],
  ['dockfish', 'Рыба с причала', 'I тир · Уличная еда', '#c9b98a', [['fish', 2], ['spices', 1]], '+2 Ловкость.', '4 ч'],
  ['lardveg', 'Печёные овощи с салом', 'I тир · Уличная еда', '#b07a4a', [['veg', 6], ['meat', 1], ['salt', 1]], '+1 Стойкость, +1 Тело.', '4 ч'],
  ['engcoffee', 'Кофе инженера', 'I тир · Уличная еда', '#4a2e1c', [['roastbean', 1], ['water', 1], ['milk', 1]], '+1 Разум, +1 к Инициативе. Снимает Сонливость.', '2 ч'],
  ['sausages', 'Жареные колбаски с капустой', 'II тир · Трактиры и харчевни', '#9a4a32', [['mince', 2], ['veg', 10], ['spices', 2]], '+2 ОЗ, +1 Тело.', '6 ч'],
  ['chowder', 'Шлюзовая уха со сливками', 'II тир · Трактиры и харчевни', '#d0c08a', [['broth', 1], ['fish', 10], ['veg', 10], ['cream', 1]], '+1 ОЗ, +1 Разум, +1 Внимательность.', '6 ч'],
  ['workpie', 'Пирог рабочего', 'II тир · Трактиры и харчевни', '#b27a3e', [['dough', 1], ['mince', 1], ['veg', 8]], '+2 ОЗ, +1 Стойкость. Сутки не портится — берут на смену.', '6 ч'],
  ['boilerstew', 'Котельное рагу', 'II тир · Трактиры и харчевни', '#8a5a32', [['broth', 1], ['meat', 8], ['veg', 12], ['beer', 1]], '+2 ОЗ, +1 Тело, +1 Ремесло. Томится в паровом котле всю ночь.', '6 ч'],
  ['brassroast', 'Жаркое в латунном котелке', 'III тир · Ресторации Верхнего города', '#8a3f2a', [['cut', 2], ['marinade', 1], ['butter', 1], ['veg', 10]], '+2 ОЗ, +2 ОВ, +2 Тело, +1 Стойкость. 1 раз за бой-сцену избегаешь Кровотечения.', '8 ч'],
  ['eelpie', 'Пирог со шлюзовым угрём', 'III тир · Ресторации Верхнего города', '#7a8a6a', [['dough', 2], ['eel', 2], ['cream', 1], ['butter', 1]], '+2 ОЗ, +2 ОВ, +2 Воля, +1 Разум. 1 раз за бой-сцену Страх действует на 1 ход меньше.', '8 ч'],
  ['cheeseboard', 'Сырная доска к вину', 'III тир · Ресторации Верхнего города', '#e0c070', [['cheese', 2], ['wine', 1], ['berries', 10], ['glaze', 1]], '+1 ОЗ, +2 ОВ, +1 Образование, +1 Внимательность.', '8 ч'],
  ['gearcake', 'Торт «Шестерня»', 'IV тир · Стол Домов', '#e0a84a', [['dough', 3], ['glaze', 3], ['cream', 2], ['cocoa', 4], ['butter', 2]], '+4 ОЗ, +4 ОВ, +2 Разум, +1 Ремесло. Одна проверка Ремесла за сцену — с преимуществом.', '8 ч'],
  ['founderroast', 'Жаркое «Литейщик»', 'IV тир · Стол Домов', '#a02a1a', [['cut', 4], ['marinade', 2], ['broth', 2], ['lumsalt', 1], ['beer', 2]], '+4 ОЗ, +3 ОВ, +2 Тело, +1 Стойкость. Жар печей и холод не действуют. 2 раза за бой-сцену получаешь на 1 ЕУ меньше.', '8 ч'],
  ['glowsoup', 'Светящийся бульон', 'IV тир · Стол Домов', '#7fe8da', [['broth', 3], ['lumsalt', 2], ['pipeshroom', 10], ['cream', 2]], '+4 ОЗ, +5 ОВ, +1 Разум. Иммунитет к Страху и к видениям люмерита.', '8 ч'],
  ['shroomragout', 'Рагу из трубных грибов', 'IV тир · Стол Домов', '#8a7a5a', [['pipeshroom', 15], ['cut', 2], ['cream', 2], ['spices', 3]], '+4 ОЗ, +3 ОВ, +2 Скрытность. Преимущество на Скрытность в Нижнем городе.', '8 ч'],
  ['hotchoc', 'Горячий шоколад с юга', 'IV тир · Стол Домов', '#5a3220', [['cocoa', 6], ['cream', 3], ['glaze', 1], ['spirit', 1]], '+4 ОЗ, +4 ОВ. 2 раза за бой-сцену можно игнорировать Оглушение.', '8 ч'],
  ['lockfeast', 'Банкет на шлюзах', 'IV тир · Стол Домов', '#c23b2c', [['eel', 6], ['smoked', 3], ['wine', 2], ['cheese', 2], ['lumsalt', 1]], 'Стол на 5 человек: +4 ОЗ, +5 ОВ, +2 Тело, +2 Стойкость каждому. 2 раза за бой-сцену получаешь на 1 ЕУ меньше.', '8 ч'],
  ['beer', 'Заводское пиво', 'Напитки', '#c2862a', [['grain', 15], ['yeast', 2], ['water', 5]], '+1 Тело, +1 Стойкость.', '3 ч'],
  ['stout', 'Угольный стаут', 'Напитки', '#2a2018', [['grain', 20], ['yeast', 2], ['water', 5], ['roastbean', 1]], '+1 Тело, +1 Воля. Чёрный как сажа.', '3 ч'],
  ['wine', 'Ягодное вино', 'Напитки', '#7a1f35', [['berries', 30], ['yeast', 5], ['water', 5]], '+1 Собранность. −1 Внимательность.', '3 ч'],
  ['gin', 'Котельный джин', 'Напитки', '#c8d8d0', [['spirit', 3], ['berries', 10], ['spices', 1]], '+1 Самообладание. −1 Внимательность.', '3 ч'],
  ['grog', 'Портовый грог', 'Напитки', '#a06a2a', [['beer', 2], ['spices', 3], ['honey', 2]], '+1 Самообладание. Холод не действует. −1 Красноречие.', '3 ч'],
  ['lumfizz', 'Люмеритовая шипучка', 'Напитки', '#9ff5ea', [['water', 3], ['lumsalt', 1], ['glaze', 1]], '+2 ОВ, +1 Разум. Час тело слабо светится.', '1 ч'],
  ['cans', 'Консервы «Паровоз»', 'Пайки и консервы', '#7a6a5a', [['tincan', 1], ['smoked', 1], ['veg', 5], ['spices', 1]], '+2 ОЗ. Не портятся — стандартный паёк заводских бригад и экспедиций.', '4 ч'],
  ['ration', 'Паёк экспедиции в Пустоши', 'Пайки и консервы', '#6a5a3a', [['founderroast', 1], ['gearcake', 1], ['gin', 2], ['tincan', 1]], '+6 ОЗ, +4 ОВ. Вместо 1 основного действия — 2 основных. Игнорирует Усталость во время события.', '4 ч']
];
const DISH_BY_KEY = Object.fromEntries(DISHES.map(p => [setKey(p[4]), p]));
const VESSEL = {
  flask: `<svg viewBox="0 0 200 260" aria-hidden="true"><defs><clipPath id="vClip"><path d="M80 20h40v70l55 120a22 22 0 0 1-20 32H45a22 22 0 0 1-20-32l55-120z"/></clipPath></defs>
    <g clip-path="url(#vClip)"><rect class="v-liquid" x="0" y="260" width="200" height="260" fill="#6b5a3a"/><g class="v-bubbles"></g></g>
    <path d="M80 20h40v70l55 120a22 22 0 0 1-20 32H45a22 22 0 0 1-20-32l55-120z" fill="none" stroke="#c9a15b" stroke-width="4"/><rect x="72" y="10" width="56" height="12" rx="3" fill="#8a6a3a"/></svg>`,
  pot: `<svg viewBox="0 0 200 260" aria-hidden="true"><defs><clipPath id="vClip"><path d="M28 110h144v70a60 60 0 0 1-60 60H88a60 60 0 0 1-60-60z"/></clipPath></defs>
    <g class="v-steam"><path d="M70 92c-10-14 10-22 0-38"/><path d="M100 88c-10-14 10-24 0-42"/><path d="M130 92c-10-14 10-22 0-38"/></g>
    <g clip-path="url(#vClip)"><rect x="0" y="0" width="200" height="260" fill="#1a130e"/><rect class="v-liquid" x="0" y="260" width="200" height="260" fill="#6b5a3a"/><g class="v-bubbles"></g></g>
    <path d="M28 110h144v70a60 60 0 0 1-60 60H88a60 60 0 0 1-60-60z" fill="none" stroke="#8b8f96" stroke-width="6"/>
    <rect x="18" y="102" width="164" height="12" rx="4" fill="#5e5a55" stroke="#8b8f96" stroke-width="2"/>
    <path d="M18 128h-10a8 8 0 0 0 0 16h12M182 128h10a8 8 0 0 1 0 16h-12" fill="none" stroke="#8b8f96" stroke-width="5"/>
    <g class="v-fire"><path d="M60 258c-6-14 8-16 6-30 10 10 12 20 6 30z"/><path d="M95 258c-8-18 10-22 6-38 14 14 16 26 8 38z"/><path d="M132 258c-6-14 8-16 6-30 10 10 12 20 6 30z"/></g></svg>`
};
function bench(el, cfg) {
  const st = Object.assign({ shelf: {} }, MH.store.get(cfg.store, {}));
  let pot = [];
  const groups = [...new Set(cfg.list.map(p => p[2]))], slots = cfg.slots || 7;
  el.innerHTML = `<div class="al-wrap">
    <section class="panel al-shelf"><div class="eyebrow">${cfg.ingTitle}</div><p class="muted" style="font-size:13px;margin:4px 0 10px">${cfg.ingHint}</p>
      ${cfg.sections.map(([t, ids]) => `<details class="al-sec"${t === cfg.sections[0][0] ? ' open' : ''}><summary class="al-sub">${t} <i>${ids.length}</i></summary><div class="rc-list">${ids.map(ingChip).join('')}</div></details>`).join('')}</section>
    <section class="al-table" aria-live="polite">
      <div class="al-flask al-${cfg.vessel}" id="aFlask">${VESSEL[cfg.vessel]}</div>
      <div class="al-slots" id="aSlots"></div>
      <div class="al-btns"><button class="btn" id="aBrew">${cfg.verb}</button><button class="btn ghost" id="aClear">${cfg.clear}</button></div>
      <div class="al-result" id="aResult"><span class="muted">${cfg.idle}</span></div>
    </section>
    <section class="panel al-shelf"><div class="rc-head"><div class="eyebrow">${cfg.shelfTitle}</div><button class="btn small ghost" id="aShelfClear">Очистить</button></div><div id="aShelf"></div></section>
  </div>
  <div class="al-book"><div class="sec-head" style="margin:40px 0 16px"><div class="eyebrow">${cfg.bookEyebrow}</div><h2>${cfg.bookTitle}</h2><p>${cfg.bookText}</p></div>
    ${groups.map(g => `<details class="al-group al-fold" open><summary class="wgroup">${g} <i>${cfg.list.filter(p => p[2] === g).length}</i></summary><div class="al-grid">${cfg.list.filter(p => p[2] === g).map(p => `<article class="al-card" style="--pc:${p[3]}">${artOr(p[0], cfg.icon)}<div><div class="cc-tag">${p[2]} · ${p[6]}${p[7] ? ' · из Риверсайда' : ''}</div><h4>${p[1]}</h4><p>${p[5]}</p><div class="al-recipe">${recipeQ(p[4]).map(([i, n]) => `<span>${ingName(i)}${n > 1 ? ` <u>×${n}</u>` : ''}</span>`).join('<em>+</em>')}</div>${cfg.chain ? `<button type="button" class="cc-chain" data-dchain="${p[0]}">Цепочка до сырья · ${depthOf(recipeQ(p[4])) + 1} ${depthOf(recipeQ(p[4])) ? 'ступени' : 'ступень'}</button>` : ''}</div></article>`).join('')}</div></details>`).join('')}
  </div>${cfg.after || ''}`;
  const liquid = q('.v-liquid', el), bubbles = q('.v-bubbles', el);
  function mixColor() {
    if (!pot.length) return '#3a2d22';
    const cols = pot.map(ingColor).map(h => [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16)));
    const avg = [0, 1, 2].map(c => Math.round(cols.reduce((a, x) => a + x[c], 0) / cols.length));
    return '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function drawPot() {
    q('#aSlots', el).innerHTML = pot.map(id => `<button type="button" class="al-slot full" data-rm="${id}" title="Убрать">${ingName(id)}<span>×</span></button>`).join('') + (pot.length < slots ? `<div class="al-slot">Ещё компонент · ${pot.length}/${slots}</div>` : '');
    liquid.setAttribute('y', String(pot.length ? 210 - pot.length * 22 : 260));
    liquid.setAttribute('fill', mixColor());
    q('#aBrew', el).disabled = pot.length < 2;
    qa('.al-shelf [data-ing]', el).forEach(c => c.classList.toggle('in', pot.includes(c.dataset.ing)));
  }
  function drawShelf() {
    const ids = Object.keys(st.shelf).filter(k => st.shelf[k] > 0);
    q('#aShelf', el).innerHTML = ids.length ? ids.map(id => { const p = cfg.list.find(x => x[0] === id) || [id, cfg.failName, '', '#4a4030']; return `<div class="al-have" style="--pc:${p[3]}">${artOr(p[0], cfg.iconSm, 1)}<b>${p[1]}</b><em>×${st.shelf[id]}</em></div>`; }).join('') : '<p class="muted" style="font-size:14px">Пока пусто.</p>';
  }
  function bubble() { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', String(60 + Math.random() * 80)); c.setAttribute('cy', '230'); c.setAttribute('r', String(3 + Math.random() * 5)); c.setAttribute('class', 'al-bub'); bubbles.appendChild(c); setTimeout(() => c.remove(), 1600); }
  el.addEventListener('click', e => {
    const ing = e.target.closest('.al-shelf [data-ing]'), rm = e.target.closest('[data-rm]');
    if (ing) {
      const id = ing.dataset.ing;
      if (pot.includes(id)) { pot = pot.filter(x => x !== id); play('click'); drawPot(); return; }
      if (pot.length >= slots) { q('#aResult', el).innerHTML = `<span class="minus">${cfg.full}</span>`; return; }
      pot.push(id); play('click'); bubble(); drawPot();
    }
    else if (rm) { pot = pot.filter(x => x !== rm.dataset.rm); play('click'); drawPot(); }
  });
  q('#aClear', el).onclick = () => { pot = []; drawPot(); q('#aResult', el).innerHTML = `<span class="muted">${cfg.emptied}</span>`; };
  q('#aBrew', el).onclick = () => {
    if (pot.length < 2) return;
    const p = cfg.byKey[setKey(pot)], flask = q('#aFlask', el);
    flask.classList.add('brewing'); play('dice'); for (let i = 0; i < 8; i++) setTimeout(bubble, i * 120);
    setTimeout(() => {
      flask.classList.remove('brewing');
      if (p) { st.shelf[p[0]] = (st.shelf[p[0]] || 0) + 1; liquid.setAttribute('fill', p[3]); q('#aResult', el).innerHTML = `<div class="al-ok" style="--pc:${p[3]}">${artOr(p[0], cfg.icon)}<div><b>${p[1]}</b><span>${p[5]}</span><small>Ушло: ${recipeText(p[4])}</small></div></div>`; play('card'); }
      else { st.shelf.mud = (st.shelf.mud || 0) + 1; liquid.setAttribute('fill', '#4a4030'); q('#aResult', el).innerHTML = `<span class="minus">${cfg.fail}</span>`; }
      pot = []; setTimeout(drawPot, 900); drawShelf(); MH.store.set(cfg.store, st);
    }, 1100);
  };
  q('#aShelfClear', el).onclick = () => { st.shelf = {}; drawShelf(); MH.store.set(cfg.store, st); };
  drawPot(); drawShelf();
}
const Alchemy = {
  mount(el) {
    bench(el, {
      store: 'alch3', list: POTIONS, byKey: POTION_BY_KEY, vessel: 'flask', slots: 7, chain: true,
      ingTitle: 'Ингредиенты', ingHint: 'Положи в колбу нужные компоненты — количество подставится по рецепту. Повторный клик убирает компонент. Разделы раскрываются по клику.',
      sections: [
        ['Травы полей и болот', ['plantain', 'yarrow', 'sage', 'mint', 'chamomile', 'wormwood', 'belladonna', 'hemlock', 'wolfberry', 'poppy']],
        ['Травы Пустошей', ['fireflower', 'icewort', 'bloodroot', 'lumfern', 'ashflower', 'blackroot']],
        ['Перегонка и посуда', ['spirit', 'alchdust', 'vial', 'syringe', 'oil']],
        ['Минералы и прочее', ['salt', 'sulfur', 'silver', 'lumerite', 'lum_pure', 'lum_crumb', 'mineral_bits', 'fishscale', 'silk']],
        ['С тварей Пустошей', ['beast_heart', 'beast_guts', 'beast_meat']],
        ['Готовые зелья и мутагены', ['bitter2', 'rest2', 'antidote', 'salts', 'mut1', 'mut2', 'mut3']]
      ],
      verb: 'Сварить', clear: 'Вылить', idle: 'Положи компоненты и вари.', emptied: 'Колба пуста.', full: 'Больше семи разных компонентов в колбу не влезет.',
      shelfTitle: 'Полка зелий', failName: 'Мутная жижа', fail: 'Получилась мутная жижа. Такого рецепта нет — загляни в рецептурную книгу ниже.',
      bookEyebrow: 'Рецептурная книга', bookTitle: 'Алхимия', bookText: 'Как на Риверсайде: I тир — полевая алхимия, II — алхимический стол и боевые масла, III — запретная алхимия, инъекции и мутагены. Зелья высших тиров варят из зелий предыдущего тира. Для инъекций нужен шприц и мутаген, мутагены — из сердец и внутренностей тварей Пустошей. Сварить можно только своего тира и ниже.',
      icon: '<div class="al-vial"><i></i></div>', iconSm: '<div class="al-vial sm"><i></i></div>',
      after: compSection(ALCH_COMP, 'Перегонка и посуда', 'Основы алхимии', 'Спирт гонят из злаков на перегонном кубе, алхимическую пыль — из полыни и угольного порошка. Колбы и шприцы делают из стекла.')
    });
    el.addEventListener('click', compChainClick(POTIONS, STATIONS.alch[0]));
  }
};
const Cooking = {
  mount(el) {
    bench(el, {
      store: 'cook3', list: DISHES, byKey: DISH_BY_KEY, vessel: 'pot', slots: 7, chain: true,
      ingTitle: 'Продукты', ingHint: 'Брось в котелок нужные продукты и заготовки — количество подставится по рецепту. Повторный клик убирает. Разделы раскрываются по клику.',
      sections: [
        ['Продукты ферм и охоты', ['grain', 'veg', 'fish', 'meat', 'berries', 'water', 'milk', 'honey', 'salt', 'spices', 'coffee', 'wood']],
        ['Кухонные заготовки', ['flour', 'yeast', 'mince', 'roastbean', 'tincan', 'broth', 'cream', 'butter', 'glaze', 'dough', 'cheese', 'smoked', 'marinade', 'cut']],
        ['Редкие продукты Меттенхейма', ['eel', 'pipeshroom', 'lumsalt', 'cocoa']],
        ['Перегонка', ['spirit']],
        ['Готовые блюда и напитки', ['beer', 'wine', 'gin', 'founderroast', 'gearcake']]
      ],
      verb: 'Готовить', clear: 'Вылить', idle: 'Брось продукты в котелок и готовь.', emptied: 'Котелок пуст.', full: 'Больше семи разных продуктов в котелок не влезет.',
      shelfTitle: 'Кладовая', failName: 'Подгорелое варево', fail: 'Вышло подгорелое варево. Есть можно, но толку никакого — загляни в поваренную книгу ниже.',
      bookEyebrow: 'Поваренная книга', bookTitle: 'Поварское дело', bookText: 'Кухня города пара. I тир — уличная еда рабочих кварталов, II — трактиры и харчевни, III — ресторации Верхнего города, IV — стол Домов с редкими продуктами: шлюзовым угрём, трубными грибами, люмеритовой солью и южным какао. Отдельно — заводские напитки и консервы: паёк для экспедиций в Пустоши собирают из готовых блюд. Сытость одна: действует последнее съеденное блюдо, сбросить её можно Зельем голода.',
      icon: '<div class="al-dish"><i></i></div>', iconSm: '<div class="al-dish sm"><i></i></div>',
      after: compSection(KITCHEN_COMP, 'Кухонные заготовки', 'Из чего готовят', 'Заготовки делают заранее: муку мелют на мельнице, копчёности коптят в коптильне, жестяные банки штампуют в кузне из олова, остальное — на кухне.')
    });
    el.addEventListener('click', compChainClick(DISHES, STATIONS.kitchen[0]));
  }
};

/* ================= ЛЕКАРИ ================= */
const SEV = [['light', 'Лёгкая', '#c9b27a'], ['medium', 'Средняя', '#e0672a'], ['heavy', 'Тяжёлая', '#c23b2c']];
const TRAUMA = {
  // вид: [название, значок, цвет, {тяжесть: [название, эффект, лечение, срок]}]
  head: ['Травма головы', '◉', '#d6b47a', {
    light: ['Ушиб головы', '−1 к Внимательности.', 'Холодный компресс и час покоя.', '1 ч'],
    medium: ['Сотрясение', 'Помеха на проверки Разума и Внимательности, −1 тайл движения.', 'Повязка, Зелье отдыха и сон.', '6 ч'],
    heavy: ['Пробитый череп', 'Нельзя использовать [ОСН] способности. Раз в сцену — Стойкость 15, иначе потеря сознания.', 'Операция: хирургический набор, спирт, нить. Горькое зелье. Постельный режим.', '3 дня']
  }],
  body: ['Травма тела', '▣', '#b0855a', {
    light: ['Ушибы и ссадины', '−1 к максимуму ОЗ.', 'Бинт.', '2 ч'],
    medium: ['Сломанные рёбра', '−1 к Защите, помеха на Атлетику.', 'Тугая повязка и Кровоостанавливающая мазь.', '2 дня'],
    heavy: ['Проникающее ранение', '−2 к максимуму ОЗ. Кровотечение не снимается обычным бинтом.', 'Операция: зашить рану, Кровоостанавливающая мазь, Антидот от заражения.', '5 дней']
  }],
  arm: ['Травма руки', '✋', '#c9a46a', {
    light: ['Растяжение кисти', '−1 к атаке этой рукой.', 'Повязка.', '2 ч'],
    medium: ['Вывих плеча', 'Нельзя двуручное оружие, −1 к атаке.', 'Вправить сустав и наложить повязку.', '1 день'],
    heavy: ['Перелом руки', 'Рука не работает: только одноручное оружие в другой руке.', 'Шина и гипс. При неудаче кость срастается криво: −1 к атаке, пока не сломают заново.', '7 дней']
  }],
  leg: ['Травма ноги', '⟂', '#a88a52', {
    light: ['Растяжение', '−1 тайл движения.', 'Повязка.', '2 ч'],
    medium: ['Вывих колена', '−2 тайла движения, нельзя бегать и прыгать.', 'Вправить сустав и наложить повязку.', '1 день'],
    heavy: ['Перелом ноги', 'Движение 1 тайл, только с костылём.', 'Шина и гипс, костыль.', '7 дней']
  }],
  internal: ['Внутренняя травма', '❖', '#8a2f2a', {
    light: ['Отбитые органы', '−1 к максимуму ОВ, после боя тошнит.', 'Покой и Зелье отдыха.', '6 ч'],
    medium: ['Внутреннее кровотечение', '−1 ОЗ каждые 6 часов, пока не вылечат.', 'Горькое зелье и покой под присмотром.', '2 дня'],
    heavy: ['Разрыв органов', '−1 ОЗ каждый час. Без операции — смерть через сутки.', 'Операция и Горькое зелье ×2.', '7 дней']
  }],
  disease: ['Болезнь', '✚', '#7fb6d6', {
    light: ['Простуда', '−1 к максимуму ОВ, помеха на Иммунитет, кашель мешает Скрытности.', 'Согревающий эликсир или горячая похлёбка.', '1 день'],
    medium: ['Лихорадка', 'Помеха на проверки Тела, Усталость.', 'Ромашковый отвар, Зелье отдыха, постель.', '3 дня'],
    heavy: ['Чёрное лёгкое', '−3 к максимуму ОЗ, заразно. Болезнь угольного смога Нижнего города.', 'Зелье чистого дыхания каждый день и чистый воздух.', '7 дней']
  }],
  intox: ['Интоксикация', '☠', '#5d7a3e', {
    light: ['Дурная еда', '−1 ко всем проверкам.', 'Вода и отдых.', '4 ч'],
    medium: ['Отравление ядом', 'Статус Отравление: −1 ОЗ в ход в бою.', 'Антидот.', '1 день'],
    heavy: ['Люмеритовое отравление', 'Вены светятся, −1 ОЗ в час, видения.', 'Антидот, угольный порошок, промывание желудка.', '3 дня']
  }],
  rot: ['Болезнь Гнили', '✺', '#6b4a6b', {
    light: ['Пятна Гнили', 'Тёмные пятна на коже, −1 к Красноречию. Через 3 дня без лечения — средняя.', 'Прижигание и серная мазь.', '1 день'],
    medium: ['Гнилая кровь', 'Кровь чёрная и вязкая: бинт требует Медицины 13, −2 к максимуму ОЗ. Через 7 дней без лечения — тяжёлая.', 'Очищение серебром: серебро на спирту, ежедневно.', '5 дней'],
    heavy: ['Гниение заживо', '−1 к максимуму ОЗ каждый день. Твари Пустошей чуют тебя издалека.', 'Ампутация поражённого или Зелье от Гнили под эфиром.', '10 дней']
  }]
};
const HEALERS = [
  { t: 'I', name: 'Санитар', cap: 3, easy: ['light'], risk: { medium: 12 }, text: 'До 3 пациентов за раз. Лёгкие травмы лечит без проверки, средние — с риском (Медицина 12). Тяжёлые не берёт: только перевязать и дождаться лекаря постарше.' },
  { t: 'II', name: 'Лекарь', cap: 5, easy: ['light', 'medium'], risk: { heavy: 14 }, text: 'До 5 пациентов за раз. Лёгкие и средние — без проверки, тяжёлые — с риском (Медицина 14).' },
  { t: 'III', name: 'Хирург', cap: 8, easy: ['light', 'medium', 'heavy'], risk: {}, text: 'До 8 пациентов за раз. Лечит всё без проверок.' }
];
const MEDS = [
  // [id, название, тир, рецепт, выход, применение]
  ['bandage', 'Бинт', 1, [['cloth', 1], ['spirit', 1]], 1, 'Останавливает Кровотечение, первая помощь.'],
  ['compress', 'Холодный компресс', 1, [['cloth', 1], ['icewort', 5], ['water', 1]], 1, 'Ушибы и отёки, снимает жар.'],
  ['splint', 'Шина', 1, [['wood', 3], ['cloth', 1], ['rope', 1]], 1, 'Фиксирует сустав или кость.'],
  ['dismed', 'Лекарство от болезней', 1, [['vial', 1], ['berries', 15], ['chamomile', 20], ['water', 2]], 1, 'Помогает при обычных болезнях, снимает слабость тела по решению мастера.'],
  ['injmed', 'Лекарство от травм', 1, [['vial', 1], ['spirit', 1], ['plantain', 20], ['sage', 25], ['berries', 15]], 1, 'Для лечения травм, ушибов и переломов.'],
  ['charcoal', 'Угольная взвесь', 1, [['coal_powder', 5], ['water', 2]], 1, 'Связывает дурную еду и яды в желудке.'],
  ['suture', 'Хирургическая нить', 2, [['silk', 2], ['spirit', 1]], 4, 'Зашить рану — без неё глубокие раны не закрыть.'],
  ['cast', 'Гипсовая повязка', 2, [['stone', 5], ['cloth', 2], ['water', 2]], 1, 'Держит перелом неподвижным весь срок.'],
  ['crutch', 'Костыль', 2, [['wood', 6], ['leather', 1]], 1, 'С переломом ноги без него не ходят.'],
  ['disinfect', 'Обеззараживающий раствор', 2, [['spirit', 3], ['salt', 2], ['water', 2]], 3, 'Промыть рану, инструменты или желудок.'],
  ['sulfsalve', 'Серная мазь', 2, [['sulfur', 2], ['hemlock', 10], ['oil', 1]], 2, 'Прижигает пятна Гнили.'],
  ['medkit', 'Лекарский набор', 2, [['bitter', 1], ['rest', 1], ['bandage', 1]], 1, 'Полный комплект первой помощи для похода или боя.'],
  ['surgkit', 'Набор хирурга', 3, [['steel', 2], ['brass', 1], ['glass', 1], ['leather', 2]], 1, 'Скальпели, пилы, зажимы. Многоразовый, нужен для любой операции.'],
  ['ether', 'Эфир', 3, [['spirit', 5], ['sulfur', 2], ['vial', 1]], 2, 'Наркоз: пациент спит, операция не даёт шока.'],
  ['inhaler', 'Паровой ингалятор', 3, [['glass', 2], ['brass', 1], ['tech_parts', 1], ['mint', 15]], 1, 'Чистый пар с травами для больных лёгких.'],
  ['silvertinct', 'Серебряная настойка', 3, [['silver', 1], ['spirit', 3], ['vial', 1]], 3, 'Очищает Гнилую кровь. Принимать ежедневно.'],
  ['rotcure', 'Зелье от Гнили', 3, [['lumfern', 15], ['ashflower', 10], ['beast_heart', 3], ['spirit', 5], ['vial', 1]], 1, 'Против Гниения заживо. Дорогое и редкое средство.']
];
const MED_BY = Object.fromEntries(MEDS.map(m => [m[0], m]));
const TRAUMA_MEDS = {
  'head.light': [['compress', 1]], 'head.medium': [['bandage', 1], ['injmed', 1], ['rest', 1]], 'head.heavy': [['surgkit', 1], ['ether', 1], ['suture', 2], ['bitter2', 1]],
  'body.light': [['bandage', 1]], 'body.medium': [['bandage', 2], ['styptic', 1], ['injmed', 1]], 'body.heavy': [['surgkit', 1], ['suture', 3], ['disinfect', 1], ['injmed', 1]],
  'arm.light': [['bandage', 1]], 'arm.medium': [['splint', 1], ['injmed', 1]], 'arm.heavy': [['splint', 1], ['cast', 1], ['ether', 1], ['injmed', 1]],
  'leg.light': [['bandage', 1]], 'leg.medium': [['splint', 1], ['injmed', 1]], 'leg.heavy': [['splint', 1], ['cast', 1], ['crutch', 1], ['injmed', 1]],
  'internal.light': [['rest', 1]], 'internal.medium': [['bitter', 1], ['injmed', 1]], 'internal.heavy': [['surgkit', 1], ['ether', 1], ['suture', 2], ['bitter2', 1]],
  'disease.light': [['dismed', 1]], 'disease.medium': [['dismed', 2], ['rest', 1]], 'disease.heavy': [['inhaler', 1], ['clearbreath', 3], ['dismed', 2]],
  'intox.light': [['charcoal', 1]], 'intox.medium': [['antidote', 1]], 'intox.heavy': [['antidote', 1], ['charcoal', 2], ['disinfect', 1]],
  'rot.light': [['sulfsalve', 1]], 'rot.medium': [['silvertinct', 3]], 'rot.heavy': [['surgkit', 1], ['ether', 1], ['rotcure', 1]]
};
function medChip(id, n) {
  const m = MED_BY[id], p = !m && POTIONS.find(x => x[0] === id);
  const name = m ? m[1] : p ? p[1] : id, tier = m ? m[2] : p ? tierOf(p[2]) : 0;
  return `<span class="medchip${p ? ' pot' : ''}" title="${m ? `Лекарство ${TIER_ROMAN(tier)} тира — ${m[5]}` : 'Зелье алхимика'}">${ITEM_ART.has(id) ? `<img src="${artSrc(id)}" alt="" loading="lazy">` : `<i>${p ? '⚗' : '✚'}</i>`}${name}${n > 1 ? ` <em>×${n}</em>` : ''}${tier ? `<u>${TIER_ROMAN(tier)}</u>` : ''}</span>`;
}
const medList = (k, s) => (TRAUMA_MEDS[`${k}.${s}`] || []).map(([i, n]) => medChip(i, n)).join('');

const Healing = {
  mount(el) {
    const st = Object.assign({ tier: 0, beds: [], kind: 'head', sev: 'light' }, MH.store.get('heal', {}));
    st.beds = st.beds.filter(b => TRAUMA[b.k] && TRAUMA[b.k][3][b.s]);
    const save = () => MH.store.set('heal', st);
    const sevName = s => SEV.find(x => x[0] === s)[1];
    const sevCol = s => SEV.find(x => x[0] === s)[2];
    el.innerHTML = `
    <div class="hl-tiers" role="group" aria-label="Тир лекаря">${HEALERS.map((h, i) => `<button type="button" data-tier="${i}"><span class="hl-t">${h.t} тир</span><b>${h.name}</b><small>${h.text}</small><em>${'▮'.repeat(h.cap)}</em></button>`).join('')}</div>
    <div class="hl-wrap">
      <section class="panel hl-intake"><div class="eyebrow">Приём</div>
        <div class="al-sub">Вид травмы</div><div class="hl-kinds">${Object.entries(TRAUMA).map(([k, t]) => `<button type="button" data-kind="${k}" style="--tc:${t[2]}"><i>${t[1]}</i>${t[0]}</button>`).join('')}</div>
        <div class="al-sub">Тяжесть</div><div class="hl-sev">${SEV.map(([k, n, c]) => `<button type="button" data-sev="${k}" style="--tc:${c}">${n}</button>`).join('')}</div>
        <div class="hl-preview" id="hPrev"></div>
        <div class="al-btns" style="justify-content:flex-start"><button class="btn" id="hAdd">Положить на койку</button><button class="btn ghost" id="hRoll" title="Персонаж упал до 0 ОЗ в бою">Травма после боя</button></div>
        <p class="muted hl-note">Упал до 0 ОЗ — бросай d20 на тяжесть (1–5 тяжёлая, 6–12 средняя, 13–20 лёгкая) и d5 на место: голова, тело, рука, нога, внутренняя. Болезни, отравления и Гниль приходят из сюжета и ивентов.</p>
      </section>
      <section class="hl-ward"><div class="rc-head"><div class="eyebrow" id="hCap"></div><div class="al-btns"><button class="btn small" id="hTreat">Лечить</button><button class="btn small ghost" id="hOut">Выписать</button></div></div>
        <div class="hl-beds" id="hBeds"></div><div class="hl-log" id="hLog" aria-live="polite"></div></section>
    </div>
    <div class="sec-head" style="margin:44px 0 16px"><div class="eyebrow">Справочник лекаря</div><h2>Травмы и лечение</h2><p>Восемь видов, у каждого три ступени тяжести. Не вылеченная травма держится весь срок, а Гниль со временем тяжелеет сама.</p></div>
    <div class="hl-book">${Object.entries(TRAUMA).map(([k, t]) => `<article class="hl-kind" style="--tc:${t[2]}"><h4><i>${t[1]}</i>${t[0]}</h4>${SEV.map(([s, n, c]) => { const x = t[3][s]; return `<div class="hl-row" style="--sc:${c}"><div class="hl-sv">${n}</div><div><b>${x[0]}</b><p>${x[1]}</p><p class="hl-cure"><span>Лечение:</span> ${x[2]} <em>${x[3]}</em></p><div class="hl-meds">${medList(k, s)}</div></div></div>`; }).join('')}</article>`).join('')}</div>
    <div class="sec-head" style="margin:44px 0 16px"><div class="eyebrow">Стол лекаря</div><h2>Лекарства</h2><p>Три тира, как и травмы: I тир — на лёгкие, II — на средние, III — на тяжёлые. Применить может любой лекарь, а изготовить — только своего тира и ниже: санитар делает I тир, лекарь — I и II, хирург — всё. Зелья (⚗) варит алхимик.</p></div>
    <div class="hl-pharm">${[1, 2, 3].map(t => `<div class="al-group"><div class="wgroup">${TIER_NAME[t]} тир · ${['', 'санитар и выше', 'лекарь и выше', 'только хирург'][t]}</div><div class="hl-mgrid">${MEDS.filter(m => m[2] === t).map(m => `<article class="hl-med"><h4><i>✚</i>${m[1]}${m[4] > 1 ? ` <em>×${m[4]}</em>` : ''}</h4><p>${m[5]}</p><div class="cc-rec">${m[3].map(([i, n]) => matChip(i, n)).join('')}</div></article>`).join('')}</div></div>`).join('')}</div>
    <div class="sec-head" style="margin:44px 0 16px"><div class="eyebrow">Риск</div><h2>Если лечение сорвалось</h2></div>
    <div class="hl-risk panel"><p><b>Провал проверки Медицины</b> — травма остаётся, пациент теряет 1 ОЗ. Можно попробовать снова в следующий сеанс.</p><p><b>Выпала 1</b> — осложнение: средняя травма становится тяжёлой, тяжёлая — пациент без сознания, и спасти его может только лекарь выше тиром.</p><p><b>Выпала 20</b> — лечение идёт вдвое быстрее, срок делится пополам.</p></div>`;
    const tierBtns = qa('[data-tier]', el);
    function status(b) {
      const h = HEALERS[st.tier];
      if (h.easy.includes(b.s)) return ['easy', 'вылечит'];
      if (h.risk[b.s]) return ['risk', `риск · Медицина ${h.risk[b.s]}`];
      return ['no', 'не по силам'];
    }
    function drawIntake() {
      qa('[data-kind]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === st.kind)));
      qa('[data-sev]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sev === st.sev)));
      const x = TRAUMA[st.kind][3][st.sev];
      q('#hPrev', el).innerHTML = `<b style="color:${sevCol(st.sev)}">${x[0]}</b><p>${x[1]}</p><p class="hl-cure"><span>Лечение:</span> ${x[2]} <em>${x[3]}</em></p><div class="hl-meds">${medList(st.kind, st.sev)}</div>`;
    }
    function drawBeds() {
      const h = HEALERS[st.tier];
      tierBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.tier === st.tier)));
      q('#hCap', el).textContent = `Лазарет · ${h.name} · ${Math.min(st.beds.length, h.cap)}/${h.cap} коек`;
      q('#hBeds', el).innerHTML = [...Array(h.cap).keys()].map(i => {
        const b = st.beds[i];
        if (!b) return `<div class="hl-bed empty"><span>Койка ${i + 1}</span></div>`;
        const t = TRAUMA[b.k], x = t[3][b.s], [cls, lbl] = b.res ? [b.res, ''] : status(b);
        return `<div class="hl-bed ${cls}" style="--tc:${t[2]};--sc:${sevCol(b.s)}"><button type="button" class="hl-x" data-del="${i}" aria-label="Убрать">×</button><div class="hl-bt"><i>${t[1]}</i><span>${t[0]} · ${sevName(b.s)}</span></div><b>${x[0]}</b><div class="hl-meds sm">${medList(b.k, b.s)}</div><div class="hl-st">${b.res ? b.msg : lbl}</div></div>`;
      }).join('');
      const over = st.beds.length - h.cap;
      q('#hLog', el).innerHTML = over > 0 ? `<span class="minus">В очереди ещё ${over}: ${h.name} не примет их в этот сеанс.</span>` : '';
    }
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-tier]'), k = e.target.closest('[data-kind]'), s = e.target.closest('[data-sev]'), d = e.target.closest('[data-del]');
      if (t) { st.tier = +t.dataset.tier; st.beds.forEach(b => { delete b.res; }); play('click'); drawBeds(); save(); }
      else if (k) { st.kind = k.dataset.kind; play('click'); drawIntake(); save(); }
      else if (s) { st.sev = s.dataset.sev; play('click'); drawIntake(); save(); }
      else if (d) { st.beds.splice(+d.dataset.del, 1); drawBeds(); save(); }
    });
    q('#hAdd', el).onclick = () => { st.beds.push({ k: st.kind, s: st.sev }); play('card'); drawBeds(); save(); };
    q('#hRoll', el).onclick = () => {
      const r = 1 + Math.floor(Math.random() * 20), loc = ['head', 'body', 'arm', 'leg', 'internal'][Math.floor(Math.random() * 5)];
      st.kind = loc; st.sev = r <= 5 ? 'heavy' : r <= 12 ? 'medium' : 'light';
      st.beds.push({ k: st.kind, s: st.sev }); play('dice'); drawIntake(); drawBeds(); save();
      q('#hLog', el).innerHTML = `<span>d20 = <b>${r}</b> → ${sevName(st.sev).toLowerCase()} · ${TRAUMA[loc][0].toLowerCase()}: ${TRAUMA[loc][3][st.sev][0]}</span>`;
    };
    q('#hTreat', el).onclick = () => {
      const h = HEALERS[st.tier]; let healed = 0, failed = 0;
      play('dice');
      st.beds.slice(0, h.cap).forEach(b => {
        if (b.res === 'done') return;
        const [cls] = status(b);
        if (cls === 'easy') { b.res = 'done'; b.msg = 'вылечен'; healed++; }
        else if (cls === 'risk') {
          const r = 1 + Math.floor(Math.random() * 20), need = h.risk[b.s];
          if (r === 20) { b.res = 'done'; b.msg = `d20 = 20 · вылечен, срок вдвое короче`; healed++; }
          else if (r >= need) { b.res = 'done'; b.msg = `d20 = ${r} · вылечен`; healed++; }
          else if (r === 1) { b.res = 'crit'; b.msg = b.s === 'medium' ? 'd20 = 1 · осложнение: травма стала тяжёлой' : 'd20 = 1 · осложнение: без сознания, нужен лекарь выше тиром'; if (b.s === 'medium') b.s = 'heavy'; failed++; }
          else { b.res = 'fail'; b.msg = `d20 = ${r} · не вышло, −1 ОЗ`; failed++; }
        } else { b.res = 'no'; b.msg = 'не по силам — нужен лекарь выше тиром'; }
      });
      drawBeds(); save();
      const wait = st.beds.length - h.cap; q('#hLog', el).innerHTML = `<span>Сеанс окончен: вылечено ${healed}${failed ? `, неудач ${failed}` : ''}.${wait > 0 ? ` В очереди ещё ${wait} — выпиши вылеченных и лечи снова.` : ''}</span>`;
    };
    q('#hOut', el).onclick = () => { st.beds = st.beds.filter(b => b.res !== 'done'); st.beds.forEach(b => { delete b.res; }); drawBeds(); save(); };
    drawIntake(); drawBeds();
  }
};

/* ======================= ПРОТЕЗЫ И КОНСТРУКТЫ =======================
   Живым — импланты с Нагрузкой и Пределом плоти. Конструктам — детали и ёмкость ядра. Всё черновое. */
const BODY_SLOTS = {
  // слот: [название, зона, для кого: l — живые, c — конструкты]
  core: ['Ядро', 'Ядро и каркас', 'c'], frame: ['Каркас', 'Ядро и каркас', 'c'], cooling: ['Охлаждение', 'Ядро и каркас', 'c'], plating: ['Обшивка — вместо брони', 'Ядро и каркас', 'c'],
  brain: ['Мозг / носитель разума', 'Голова', 'lc'], eyes: ['Глаза', 'Голова', 'lc'], ears: ['Уши', 'Голова', 'lc'], voice: ['Голос', 'Голова', 'lc'],
  heart: ['Сердце', 'Торс', 'l'], lungs: ['Лёгкие', 'Торс', 'l'], spine: ['Позвоночник', 'Торс', 'l'], skin: ['Кожа', 'Торс', 'l'],
  armL: ['Левая рука', 'Руки', 'lc'], armR: ['Правая рука', 'Руки', 'lc'], legs: ['Ноги', 'Ноги', 'lc']
};
// [id, слот (arm — для обеих рук), название, тир, нагрузка, эффект, для кого, стартовая для конструкта?]
const PARTS = [
  // ядро, каркас, охлаждение — только конструкты
  ['core1', 'core', 'Угольное ядро', 1, 0, 'Ёмкость 18. Зарядка люмеритовой батареи — 4 часа в сутки вместо сна.', 'c', true],
  ['core2', 'core', 'Паровое ядро', 2, 0, 'Ёмкость 26. Зарядка 2 часа. +1 Тело.', 'c'],
  ['core3', 'core', 'Люмеритовое ядро', 3, 0, 'Ёмкость 36. Зарядка 1 час. 1 раз за ивент Перегрузка: 2 основных действия в ход.', 'c'],
  ['frame_work', 'frame', 'Рабочий каркас', 1, 2, '+1 Тело. Стандартная оболочка заводской сборки.', 'c', true],
  ['frame_light', 'frame', 'Лёгкий каркас', 1, 2, '+1 Ловкость, +1 тайл движения.', 'c'],
  ['frame_cast', 'frame', 'Литой корпус', 2, 3, '+1 КБ, −1 тайл движения.', 'c'],
  ['frame_lum', 'frame', 'Люмеритовый каркас', 3, 4, '+1 КБ, +2 маг. защиты.', 'c'],
  ['plate1', 'plating', 'Жестяная обшивка', 1, 1, 'Защита 1. Стартовая обшивка заводской сборки.', 'c', true],
  ['plate2', 'plating', 'Листовая обшивка', 1, 2, 'Защита 2, маг. защита 1.', 'c'],
  ['plate3', 'plating', 'Клёпаная броневая обшивка', 2, 3, 'Защита 3, +1 КБ. −1 тайл движения.', 'c'],
  ['plate4', 'plating', 'Люмеритовая обшивка', 3, 4, 'Защита 3, маг. защита 3, +1 КБ.', 'c'],
  ['cool1', 'cooling', 'Воздушное охлаждение', 1, 1, 'После 3 ходов бега или боя — проверка Тела 12, иначе Перегрев (−1 ко всем проверкам до остывания).', 'c', true],
  ['cool2', 'cooling', 'Жидкостное охлаждение', 2, 2, 'Перегрев только после 6 ходов. 1 раз за бой игнорирует Горение.', 'c'],
  ['cool3', 'cooling', 'Ледяной контур', 3, 3, 'Перегрева нет. Иммунитет к Горению.', 'c'],
  // голова
  ['mind1', 'brain', 'Кристаллический носитель разума', 1, 0, 'Разум хранится в кристалле. Сыворотка правды, снотворное и дурманы не действуют.', 'c', true],
  ['calc', 'brain', 'Счётная машина в черепе', 1, 2, '+1 Разум. Расчёты в уме мгновенно.', 'lc'],
  ['memory', 'brain', 'Блок памяти', 1, 1, 'Дословно помнит всё увиденное за сутки. +1 Образование.', 'lc'],
  ['painblock', 'brain', 'Подавитель боли', 2, 3, 'Штрафы травм и поломок не действуют. Свои раны не чувствуешь — их видит только мастер.', 'lc'],
  ['reflex', 'brain', 'Нейроускоритель реакции', 2, 3, '+2 к Инициативе. 1 раз за бой — [ДОП] вне своего хода.', 'lc'],
  ['fearless', 'brain', 'Глушитель страха', 2, 2, 'Иммунитет к Страху. −1 Красноречие: эмоции тускнеют.', 'lc'],
  ['lumneuro', 'brain', 'Люмеритовый нейроконтур', 3, 4, '1 раз за сцену — 2 основных действия в ход. Видишь лей-линии. После — Усталость.', 'lc'],
  ['eyes_std', 'eyes', 'Штатные линзы', 1, 0, 'Ночное зрение на 2 тайла.', 'c', true],
  ['zoom', 'eyes', 'Оптический глаз', 1, 1, '+2 тайла к дальности стрельбы.', 'lc'],
  ['night', 'eyes', 'Ночной фильтр', 1, 1, 'Ночное зрение на 5 тайлов.', 'lc'],
  ['analyzer', 'eyes', 'Глаз-анализатор', 2, 2, '+1 Внимательность. 1 раз за бой атака игнорирует 1 КБ.', 'lc'],
  ['target', 'eyes', 'Прицельная сетка', 3, 3, '+1 к атаке дальним оружием. 1 раз за бой выстрел с преимуществом.', 'lc'],
  ['ears_std', 'ears', 'Акустические мембраны', 1, 0, 'Слышат работу механизмов: по звуку понятно, что сломано.', 'c', true],
  ['amp', 'ears', 'Усилитель слуха', 1, 1, 'Слышит через тонкую стену. +1 Внимательность при подслушивании.', 'lc'],
  ['earfilter', 'ears', 'Шумовой фильтр', 1, 1, 'Иммунитет к оглушению звуком и взрывом.', 'lc'],
  ['echo', 'ears', 'Эхолот', 3, 2, 'Видит в полной темноте на 3 тайла по звуку.', 'lc'],
  ['voice_std', 'voice', 'Голосовая решётка', 1, 0, 'Механический голос: не охрипнуть и не отравить. −1 Красноречие при первом знакомстве.', 'c', true],
  ['vox', 'voice', 'Голосовой модулятор', 1, 1, 'Меняет голос и подражает чужому: Обман голосом с преимуществом.', 'lc'],
  ['horn', 'voice', 'Рупор', 2, 1, 'Голос слышно на 30 тайлов. 1 раз за бой рёв: слабые враги — Страх на ход.', 'lc'],
  ['silver_tongue', 'voice', 'Серебряный язык', 3, 2, 'Голосовой модуль: копирует услышанный голос, +2 Запугивание.', 'lc'],
  // торс — только живые
  ['pump', 'heart', 'Паровой насос', 2, 3, '+2 к максимуму ОЗ.', 'l'],
  ['talbot_heart', 'heart', 'Сердце Талботов', 3, 4, '+3 к максимуму ОЗ, после боя +2 ОЗ. 1 раз за ивент встать с 0 ОЗ с 1 ОЗ.', 'l'],
  ['coalfilter', 'lungs', 'Угольный фильтр', 1, 1, 'Дым, газ и заводской смог не действуют.', 'l'],
  ['airtank', 'lungs', 'Запасной баллон', 2, 2, '10 минут без воздуха: под водой или в газе.', 'l'],
  ['steambreath', 'lungs', 'Паровой выдох', 3, 2, '1 раз за бой облако пара: Дымовая завеса на 2 тайла.', 'l'],
  ['brace', 'spine', 'Опорный корсет', 1, 1, 'Нет штрафа к движению от тяжёлой брони.', 'l'],
  ['armorspine', 'spine', 'Бронированный хребет', 2, 2, '+1 КБ.', 'l'],
  ['servo', 'spine', 'Сервоприводы', 3, 3, '+1 Тело, +1 Атлетичность.', 'l'],
  ['subplates', 'skin', 'Подкожные пластины', 2, 2, '+1 к защите.', 'l'],
  ['lummesh', 'skin', 'Люмеритовая сетка', 3, 3, '+2 к маг. защите.', 'l'],
  // руки
  ['arm_std', 'arm', 'Штатная рука', 1, 0, 'Не чувствует жара и холода — можно брать раскалённое.', 'c', true],
  ['arm_basic', 'arm', 'Простой протез руки', 1, 1, 'Рука работает почти как живая, снимает штраф потери руки.', 'l'],
  ['grip', 'arm', 'Пневмохват', 1, 2, 'Преимущество на хват, удержание и лазание.', 'lc'],
  ['toolarm', 'arm', 'Рука-инструмент', 1, 2, '+1 Ремесло: отвёртки, ключи и щупы встроены.', 'lc'],
  ['blade', 'arm', 'Скрытый клинок', 2, 2, 'Оружие 2 ЕУ, Апарту. При обыске не найти.', 'lc'],
  ['piston', 'arm', 'Гидравлический поршень', 2, 3, '+1 ЕУ рукопашной. Поднимает до 200 кг.', 'lc'],
  ['armgun', 'arm', 'Встроенный пистоль', 2, 3, '2 ЕУ, 3 тайла. Скрыт в предплечье. 1 выстрел за бой без перезарядки.', 'lc'],
  ['armshield', 'arm', 'Раскрывающийся щит', 3, 3, '1 раз за бой получаешь на 2 ЕУ меньше.', 'lc'],
  ['coil', 'arm', 'Люмеритовая катушка', 3, 4, '1 раз за бой удар разрядом: 2 ЕУ и Оглушение.', 'lc'],
  // ноги
  ['legs_std', 'legs', 'Штатные ноги', 1, 0, 'Не устают от ходьбы: марш без Усталости.', 'c', true],
  ['legs_basic', 'legs', 'Простые протезы ног', 1, 1, 'Снимают штраф потери ног.', 'l'],
  ['springlegs', 'legs', 'Пружинные ноги', 1, 2, 'Прыжок +2 тайла, падение с высоты без урона.', 'lc'],
  ['silentstep', 'legs', 'Глушёный шаг', 2, 2, '+1 Скрытность.', 'lc'],
  ['sprint', 'legs', 'Паровые ускорители', 2, 3, '+1 тайл движения.', 'lc'],
  ['anchor', 'legs', 'Якорные ступни', 3, 2, 'Нельзя сдвинуть, отбросить или сбить с ног.', 'lc'],
  ['kick', 'legs', 'Пневмоудар', 3, 3, 'Удар ногой 2 ЕУ, цель отлетает на 2 тайла.', 'lc']
];
const PART_BY = Object.fromEntries(PARTS.map(p => [p[0], p]));
const CORE_CAP = { core1: 18, core2: 26, core3: 36 };
const FLESH_LIMIT = 10;
function partRec(p) {
  if (p[7]) return null; // стартовые детали конструкта выдаются при создании
  const base = { 1: [['tech_parts', 2], ['mech1', 1], ['brass', 1]], 2: [['precision', 1], ['steel', 3], ['brass', 2], ['mech1', 1]], 3: [['precision', 2], ['lumsteel', 2], ['lum_wire', 1], ['lum_core', 1]] }[p[3]].map(x => [...x]);
  const extra = { eyes: [['lens', 1]], brain: [['glass', 1], ['gold_ingot', p[3] > 1 ? 1 : 0]], ears: [['brass', 1]], voice: [['brass', 1]], heart: [['copper_ingot', 4]], lungs: [['glass', 1], ['cloth', 2]], spine: [['plate', 2]], skin: [['plate', 2]], arm: [['rivets', 10], ['leather', 1]], legs: [['rivets', 20], ['leather', 2]], core: [['lum_fuel', 2], ['copper_ingot', 4]], frame: [['plate', 4], ['rivets', 20]], plating: [['plate', 3], ['rivets', 20]], cooling: [['copper_ingot', 3], ['oil', 2]] }[p[1]] || [];
  return base.concat(extra.filter(([, n]) => n > 0));
}
// чем конструкт восстанавливается вместо сна, еды и зелий
const CONSTRUCT_CONS = [
  // [id, название, тир, рецепт, выход, действие]
  ['bat1', 'Малая люмеритовая батарея', 1, [['lum_fuel', 1], ['copper_ingot', 1], ['glass', 1]], 1, 'Восстанавливает 2 ОЗ и 2 ОВ. Пустую батарею можно перезарядить за 1 люмеритовое топливо.'],
  ['bat2', 'Люмеритовая батарея', 2, [['lum_fuel', 2], ['brass', 2], ['glass', 1], ['tech_parts', 1]], 1, 'Восстанавливает 4 ОЗ и 4 ОВ.'],
  ['bat3', 'Батарея Талботов', 3, [['lum_pure', 2], ['lum_fuel', 2], ['lum_core', 1], ['brass', 2]], 1, 'Полностью восстанавливает ОЗ и ОВ. До конца боя +1 ОД.'],
  ['repkit', 'Ремкомплект', 1, [['tech_parts', 2], ['rivets', 10], ['oil', 1]], 1, 'Чинит лёгкую поломку.'],
  ['repkit2', 'Полевой ремкомплект', 2, [['repkit', 1], ['precision', 1], ['brass', 2]], 1, 'Чинит среднюю поломку.'],
  ['overhaul', 'Капитальный ремонт', 3, [['repkit2', 2], ['precision', 2], ['lumsteel', 1]], 1, 'Чинит тяжёлую поломку и все лёгкие. Только в мастерской.'],
  ['coolant', 'Охлаждающая жидкость', 1, [['water', 5], ['icewort', 5], ['oil', 1]], 2, 'Снимает Перегрев и Горение.'],
  ['grease', 'Смазка «Шарнир»', 1, [['oil', 3], ['tar', 1]], 2, '+1 Ловкость на 3 часа. Снимает скрип — нет помехи на Скрытность.'],
  ['sealant', 'Герметик', 1, [['tar', 2], ['oil', 1], ['cloth', 1]], 2, 'Снимает Утечку масла — у конструктов она вместо Кровотечения.'],
  ['anticor', 'Антикор', 2, [['oil', 2], ['sulfur', 1], ['alchdust', 1]], 1, 'Иммунитет к ржавчине, кислотам и солёной воде на ивент.'],
  ['overclock', 'Разгонный стержень', 3, [['lum_pure', 2], ['precision', 1], ['coolant', 1]], 1, 'Два основных действия в ход на 2 хода. Потом Перегрев и −3 ОЗ. Аналог инъекций.']
];
const CONSTRUCT_RULES = [
  ['Не спят', 'Вместо сна — зарядка люмеритовой батареи: 4 часа в сутки с угольным ядром, меньше с ядром лучше. Без зарядки ОВ не восстанавливаются, через сутки — Усталость.'],
  ['Не едят и не пьют', 'Еда, напитки и зелья не действуют, сытости нет. ОЗ и ОВ восстанавливают только люмеритовые батареи и компоненты обслуживания.'],
  ['Поломки вместо травм', 'Вместо травм — поломки той же тяжести. Чинит инженер ремкомплектом, а не лекарь. Вместо Кровотечения — Утечка масла.'],
  ['Неуязвимы для живого', 'Яды, болезни, снотворное и дурманы не действуют. Но уязвимы к ржавчине, кислоте и сильному разряду.'],
  ['Не носят броню', 'Доспехи на каркас не налезают и мешают охлаждению. Защиту даёт обшивка — отдельная деталь, её меняют как любую другую.'],
  ['Заменяют детали', 'Любую деталь можно снять и поставить другую — сумма нагрузки не больше ёмкости ядра. Улучшение ядра расширяет тело.']
];
/* Условная фигура конструкта: каждая деталь рисуется своим слоем, вид зависит от выбранной детали и тира */
const FIG_PAL = { 1: ['#7d838a', '#3e4247', '#a7adb3'], 2: ['#b98d48', '#6a4a20', '#e2bf7a'], 3: ['#34484c', '#162226', '#49f0de'] };
const partTier = id => (PART_BY[id] || [0, 0, 0, 1])[3];
function figArm(side, id) {
  const L = side === 'L', s = L ? -1 : 1, x0 = 120 + s * 52, t = partTier(id), [f, k, h] = FIG_PAL[t];
  const X = dx => x0 + s * dx;
  let g = `<g class="fig-part" data-fig="${L ? 'armL' : 'armR'}">`;
  // плечо, плечевая часть, локоть, предплечье
  g += `<circle cx="${X(0)}" cy="130" r="15" fill="${f}" stroke="${k}" stroke-width="3"/>`;
  g += `<rect x="${Math.min(X(4), X(20))}" y="138" width="16" height="52" rx="6" fill="${f}" stroke="${k}" stroke-width="3"/>`;
  g += `<circle cx="${X(12)}" cy="194" r="8" fill="${k}"/>`;
  const thick = id === 'piston' ? 24 : 16, fx = Math.min(X(12 - thick / 2 + 8), X(12 + thick / 2 + 8)) - 8 * s * 0;
  g += `<rect x="${X(12) - thick / 2}" y="198" width="${thick}" height="50" rx="6" fill="${f}" stroke="${k}" stroke-width="3"/>`;
  if (id === 'piston') g += `<rect x="${X(12) - 3}" y="200" width="6" height="40" fill="${h}" opacity=".8"/><rect x="${X(12) - 8}" y="214" width="16" height="6" fill="${k}"/>`;
  // кисть по типу детали
  const hx = X(12), hy = 252;
  if (id === 'grip') g += `<path d="M${hx - 10} ${hy} l-4 18 M${hx} ${hy} v20 M${hx + 10} ${hy} l4 18" stroke="${h}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  else if (id === 'toolarm') g += `<path d="M${hx} ${hy} v14 m-8 0 h16 v6 h-5 v6 h-6 v-6 h-5z" fill="${h}" stroke="${k}" stroke-width="2"/>`;
  else if (id === 'blade') g += `<path d="M${hx - 4} ${hy - 2} L${hx} ${hy + 46} L${hx + 4} ${hy - 2}z" fill="#d9dde2" stroke="${k}" stroke-width="1.5"/>`;
  else if (id === 'armgun') g += `<rect x="${hx - 5}" y="${hy - 4}" width="10" height="26" fill="${k}"/><circle cx="${hx}" cy="${hy + 22}" r="3" fill="#000"/><rect x="${hx - 9}" y="${hy - 12}" width="18" height="10" fill="${h}"/>`;
  else if (id === 'armshield') g += `<path d="M${X(-6)} 206 l${s * 40} 0 l${s * -4} 40 l${s * -16} 12 l${s * -16} -12z" fill="${f}" stroke="${h}" stroke-width="3" opacity=".95"/>`;
  else if (id === 'coil') g += `<g class="fig-glow"><path d="M${hx - 9} 206 h18 M${hx - 9} 216 h18 M${hx - 9} 226 h18 M${hx - 9} 236 h18" stroke="${h}" stroke-width="3"/><circle cx="${hx}" cy="${hy + 6}" r="9" fill="${h}" opacity=".9"/></g>`;
  else g += `<rect x="${hx - 9}" y="${hy - 2}" width="18" height="16" rx="5" fill="${f}" stroke="${k}" stroke-width="3"/>`;
  return g + '</g>';
}
function figLegs(id) {
  const t = partTier(id), [f, k, h] = FIG_PAL[t];
  let g = `<g class="fig-part" data-fig="legs">`;
  [98, 142].forEach(x => {
    g += `<rect x="${x - 10}" y="262" width="20" height="58" rx="6" fill="${f}" stroke="${k}" stroke-width="3"/><circle cx="${x}" cy="324" r="9" fill="${k}"/>`;
    if (id === 'springlegs') g += `<path d="M${x - 9} 332 l18 6 l-18 6 l18 6 l-18 6 l18 6 l-18 6 l18 6" stroke="${h}" stroke-width="3" fill="none"/>`;
    else g += `<rect x="${x - 9}" y="330" width="18" height="50" rx="5" fill="${f}" stroke="${k}" stroke-width="3"/>`;
    if (id === 'sprint') g += `<rect x="${x + 9}" y="336" width="7" height="34" rx="2" fill="${h}"/><circle cx="${x + 12}" cy="334" r="4" fill="${k}"/>`;
    if (id === 'silentstep') g += `<rect x="${x - 13}" y="380" width="26" height="6" rx="3" fill="#2a2420"/>`;
    const foot = id === 'anchor' ? 34 : id === 'kick' ? 26 : 24;
    g += `<rect x="${x - foot / 2}" y="${id === 'silentstep' ? 384 : 380}" width="${foot}" height="12" rx="4" fill="${f}" stroke="${k}" stroke-width="3"/>`;
    if (id === 'kick') g += `<rect x="${x - 6}" y="352" width="12" height="16" fill="${h}"/>`;
    if (id === 'anchor') g += `<path d="M${x - 17} 392 l-4 6 M${x + 17} 392 l4 6 M${x} 392 v6" stroke="${h}" stroke-width="3"/>`;
  });
  return g + '</g>';
}
function constructSVG(pick) {
  const fr = pick.frame, pl = pick.plating, co = pick.core, cl = pick.cooling;
  const [ff, fk, fh] = FIG_PAL[partTier(fr)], [pf, pk, ph] = FIG_PAL[partTier(pl)];
  const coreCol = { core1: '#ff8a2a', core2: '#f0e6d0', core3: '#49f0de' }[co] || '#ff8a2a';
  const coolCol = { cool1: '#7d838a', cool2: '#5aa0d0', cool3: '#9ff5ea' }[cl] || '#7d838a';
  const w = fr === 'frame_light' ? 66 : fr === 'frame_cast' ? 98 : 82, tx = 120 - w / 2;
  let s = `<svg viewBox="0 0 240 410" class="fig-svg" role="img" aria-label="Конструкт"><defs><radialGradient id="figCore"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${coreCol}"/><stop offset="1" stop-color="${coreCol}" stop-opacity="0"/></radialGradient></defs>`;
  // охлаждение — трубки за спиной
  s += `<g class="fig-part" data-fig="cooling">`;
  if (cl === 'cool1') s += `<rect x="${tx + w - 4}" y="140" width="14" height="40" rx="3" fill="#3e4247"/><path d="M${tx + w - 1} 146 h8 M${tx + w - 1} 154 h8 M${tx + w - 1} 162 h8 M${tx + w - 1} 170 h8" stroke="#7d838a" stroke-width="2"/>`;
  else s += `<path d="M${tx + 6} 122 C ${tx - 18} 150, ${tx - 18} 200, ${tx + 8} 236 M${tx + w - 6} 122 C ${tx + w + 18} 150, ${tx + w + 18} 200, ${tx + w - 8} 236" stroke="${coolCol}" stroke-width="7" fill="none" stroke-linecap="round" class="${cl === 'cool3' ? 'fig-glow' : ''}"/>`;
  s += `</g>`;
  s += figArm('L', pick.armL) + figArm('R', pick.armR) + figLegs(pick.legs);
  // торс: каркас
  s += `<g class="fig-part" data-fig="frame"><path d="M${tx} 116 h${w} l-8 112 q-${w / 2 - 8} 16 -${w - 16} 0z" fill="${ff}" stroke="${fk}" stroke-width="3"/><rect x="104" y="226" width="32" height="30" rx="6" fill="${ff}" stroke="${fk}" stroke-width="3"/>`;
  if (fr === 'frame_lum') s += `<path d="M${tx + 10} 124 l14 40 M${tx + w - 10} 124 l-14 40" stroke="${fh}" stroke-width="2" class="fig-glow"/>`;
  s += `</g>`;
  // обшивка поверх каркаса
  s += `<g class="fig-part" data-fig="plating">`;
  const pw = w - 22, px = 120 - pw / 2;
  if (pl === 'plate1') s += `<rect x="${px}" y="124" width="${pw}" height="24" rx="4" fill="${pf}" stroke="${pk}" stroke-width="2" opacity=".9"/>`;
  else if (pl === 'plate2') s += `<rect x="${px}" y="122" width="${pw}" height="26" rx="4" fill="${pf}" stroke="${pk}" stroke-width="2"/><rect x="${px + 6}" y="190" width="${pw - 12}" height="22" rx="4" fill="${pf}" stroke="${pk}" stroke-width="2"/>`;
  else if (pl === 'plate3') s += [122, 150, 178, 200].map((y, i) => `<rect x="${px - 2 + i}" y="${y}" width="${pw + 4 - i * 2}" height="${i === 3 ? 18 : 24}" rx="3" fill="${pf}" stroke="${pk}" stroke-width="2"/>`).join('') + `<g fill="${pk}">${[130, 158, 186].map(y => `<circle cx="${px + 5}" cy="${y}" r="2"/><circle cx="${px + pw - 5}" cy="${y}" r="2"/>`).join('')}</g>`;
  else if (pl === 'plate4') s += `<path d="M${px} 122 h${pw} l-6 92 h-${pw - 12}z" fill="${pf}" stroke="${ph}" stroke-width="2"/><path d="M${px + 8} 132 L120 206 L${px + pw - 8} 132" stroke="${ph}" stroke-width="2" fill="none" class="fig-glow"/>`;
  s += `</g>`;
  // ядро в груди
  s += `<g class="fig-part" data-fig="core"><circle cx="120" cy="${pl === 'plate1' ? 166 : 160}" r="${co === 'core3' ? 22 : 18}" fill="url(#figCore)" class="fig-core"/><circle cx="120" cy="${pl === 'plate1' ? 166 : 160}" r="11" fill="none" stroke="${co === 'core2' ? '#b98d48' : '#3e4247'}" stroke-width="3"/></g>`;
  // голова
  const bt = partTier(pick.brain), [hf, hk, hh] = FIG_PAL[Math.max(1, bt)];
  s += `<g class="fig-part" data-fig="brain"><rect x="96" y="104" width="48" height="16" rx="4" fill="${hk}"/><rect x="88" y="40" width="64" height="66" rx="16" fill="${hf}" stroke="${hk}" stroke-width="3"/>`;
  if (pick.brain === 'mind1') s += `<path d="M120 22 l9 18 h-18z" fill="#9ff5ea" stroke="#49f0de" stroke-width="1.5" class="fig-glow"/>`;
  else if (pick.brain === 'calc' || pick.brain === 'memory') s += `<circle cx="120" cy="38" r="10" fill="${hh}" stroke="${hk}" stroke-width="3"/><circle cx="120" cy="38" r="3" fill="${hk}"/>`;
  else if (pick.brain === 'lumneuro') s += `<path d="M98 48 q22 -26 44 0" stroke="#49f0de" stroke-width="4" fill="none" class="fig-glow"/>`;
  else if (pick.brain) s += `<rect x="108" y="30" width="24" height="12" rx="4" fill="${hh}" stroke="${hk}" stroke-width="2"/>`;
  s += `</g>`;
  const eyeCol = { eyes_std: '#ffb347', zoom: '#ffd27a', night: '#7fe87f', analyzer: '#7fc8ff', target: '#ff4a3a' }[pick.eyes] || '#ffb347';
  s += `<g class="fig-part" data-fig="eyes">`;
  if (pick.eyes === 'zoom') s += `<circle cx="106" cy="66" r="5" fill="${eyeCol}"/><circle cx="134" cy="66" r="10" fill="#1a1410" stroke="#b98d48" stroke-width="3"/><circle cx="134" cy="66" r="5" fill="${eyeCol}" class="fig-glow"/>`;
  else if (pick.eyes === 'target') s += `<rect x="98" y="60" width="44" height="12" rx="3" fill="#1a1410"/><path d="M106 66 h28 M120 60 v12" stroke="${eyeCol}" stroke-width="2" class="fig-glow"/>`;
  else s += `<circle cx="106" cy="66" r="6" fill="${eyeCol}" class="fig-glow"/><circle cx="134" cy="66" r="6" fill="${eyeCol}" class="fig-glow"/>`;
  s += `</g><g class="fig-part" data-fig="ears">`;
  if (pick.ears === 'echo') s += `<path d="M88 60 l-14 -26 M152 60 l14 -26" stroke="#49f0de" stroke-width="3"/><circle cx="74" cy="34" r="3" fill="#49f0de"/><circle cx="166" cy="34" r="3" fill="#49f0de"/>`;
  else s += `<rect x="80" y="56" width="10" height="20" rx="3" fill="${FIG_PAL[partTier(pick.ears)][0]}" stroke="#3e4247" stroke-width="2"/><rect x="150" y="56" width="10" height="20" rx="3" fill="${FIG_PAL[partTier(pick.ears)][0]}" stroke="#3e4247" stroke-width="2"/>`;
  s += `</g><g class="fig-part" data-fig="voice">`;
  if (pick.voice === 'horn') s += `<path d="M110 86 h20 l8 14 h-36z" fill="#b98d48" stroke="#6a4a20" stroke-width="2"/>`;
  else if (pick.voice === 'silver_tongue') s += `<rect x="104" y="84" width="32" height="10" rx="5" fill="#d9dde2" stroke="#7d838a" stroke-width="2"/>`;
  else s += `<path d="M106 88 h28 M106 93 h28 M106 98 h28" stroke="#2a2420" stroke-width="2.5"/>`;
  s += `</g></svg>`;
  return s;
}

/* Условная фигура человека: чистое тело, установленные протезы и импланты рисуются поверх */
function humanSVG(pick) {
  const sk = '#c9a98c', sd = '#7a5a44', w = 78, tx = 120 - w / 2;
  let s = `<svg viewBox="0 0 240 410" class="fig-svg" role="img" aria-label="Тело"><defs><radialGradient id="figHeart"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#ff5a3a"/><stop offset="1" stop-color="#ff5a3a" stop-opacity="0"/></radialGradient></defs>`;
  // ноги
  if (pick.legs) s += figLegs(pick.legs);
  else s += `<g class="fig-part" data-fig="legs">${[98, 142].map(x => `<path d="M${x - 11} 256 h22 l-2 128 q-9 8 -18 0z" fill="${sk}" stroke="${sd}" stroke-width="2.5"/><rect x="${x - 12}" y="382" width="24" height="10" rx="5" fill="${sk}" stroke="${sd}" stroke-width="2.5"/>`).join('')}</g>`;
  s += `<path d="M90 218 h60 l6 46 q-36 10 -72 0z" fill="${sk}" stroke="${sd}" stroke-width="2.5"/>`;
  // руки
  ['L', 'R'].forEach(side => {
    const id = pick['arm' + side];
    if (id) { s += figArm(side, id); return; }
    const sx = side === 'L' ? -1 : 1, x0 = 120 + sx * 50;
    s += `<g class="fig-part" data-fig="arm${side}"><path d="M${x0} 120 q${sx * 14} 6 ${sx * 16} 30 l${sx * 2} 96 q${sx * -8} 10 ${sx * -16} 0 l${sx * -6} -100z" fill="${sk}" stroke="${sd}" stroke-width="2.5"/><ellipse cx="${x0 + sx * 10}" cy="258" rx="9" ry="12" fill="${sk}" stroke="${sd}" stroke-width="2.5"/></g>`;
  });
  // торс
  s += `<g class="fig-part" data-fig="skin"><path d="M${tx} 116 q${w / 2} -10 ${w} 0 l-6 116 q-${w / 2 - 6} 22 -${w - 12} 0z" fill="${sk}" stroke="${sd}" stroke-width="2.5"/>`;
  if (pick.skin === 'subplates') s += [132, 158, 184].map(y => `<rect x="${tx + 12}" y="${y}" width="${w - 24}" height="18" rx="3" fill="#7d838a" stroke="#3e4247" stroke-width="2" opacity=".9"/>`).join('');
  if (pick.skin === 'lummesh') s += `<path d="M${tx + 10} 130 L${tx + w - 10} 210 M${tx + w - 10} 130 L${tx + 10} 210 M${tx + 10} 170 H${tx + w - 10} M120 124 V224" stroke="#49f0de" stroke-width="2" class="fig-glow"/>`;
  s += `</g>`;
  if (pick.spine) { const [f, k, h] = FIG_PAL[partTier(pick.spine)]; s += `<g class="fig-part" data-fig="spine">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="114" y="${124 + i * 18}" width="12" height="13" rx="3" fill="${f}" stroke="${k}" stroke-width="2"/>`).join('')}<rect x="${tx + 4}" y="222" width="${w - 8}" height="10" rx="3" fill="${f}" stroke="${k}" stroke-width="2"/>${pick.spine === 'servo' ? `<circle cx="${tx + 10}" cy="227" r="4" fill="${h}"/><circle cx="${tx + w - 10}" cy="227" r="4" fill="${h}"/>` : ''}</g>`; }
  if (pick.heart) { const t = partTier(pick.heart); s += `<g class="fig-part" data-fig="heart"><circle cx="134" cy="150" r="${t === 3 ? 15 : 12}" fill="${FIG_PAL[t][0]}" stroke="${FIG_PAL[t][1]}" stroke-width="3"/><circle cx="134" cy="150" r="9" fill="url(#figHeart)" class="fig-core"/><path d="M134 135 v-10 h-12" stroke="${FIG_PAL[t][1]}" stroke-width="3" fill="none"/></g>`; }
  if (pick.lungs) { const [f, k, h] = FIG_PAL[partTier(pick.lungs)]; s += `<g class="fig-part" data-fig="lungs"><rect x="96" y="140" width="16" height="30" rx="5" fill="${f}" stroke="${k}" stroke-width="2"/><path d="M104 140 C 100 120, 108 104, 112 96" stroke="${k}" stroke-width="3" fill="none"/>${pick.lungs === 'steambreath' ? `<circle cx="104" cy="176" r="4" fill="${h}"/>` : ''}</g>`; }
  // шея и голова
  s += `<g class="fig-part" data-fig="brain"><rect x="110" y="96" width="20" height="22" fill="${sk}" stroke="${sd}" stroke-width="2.5"/><ellipse cx="120" cy="66" rx="30" ry="36" fill="${sk}" stroke="${sd}" stroke-width="2.5"/>`;
  if (pick.brain) { const [f, k, h] = FIG_PAL[partTier(pick.brain)]; s += `<path d="M91 60 q29 -46 58 0 q-29 -10 -58 0z" fill="${f}" stroke="${k}" stroke-width="2.5"/>${[100, 120, 140].map(x => `<circle cx="${x}" cy="${x === 120 ? 38 : 48}" r="2.5" fill="${k}"/>`).join('')}${pick.brain === 'lumneuro' ? '<path d="M96 52 q24 -22 48 0" stroke="#49f0de" stroke-width="3" fill="none" class="fig-glow"/>' : ''}${pick.brain === 'reflex' ? `<path d="M146 52 l10 -6 l-4 10 l8 -2" stroke="${h}" stroke-width="2" fill="none"/>` : ''}`; }
  else s += `<path d="M91 56 q29 -40 58 0 q-6 -22 -29 -24 q-23 2 -29 24z" fill="#5a3e2a"/>`;
  s += `</g><g class="fig-part" data-fig="eyes">`;
  const eyeCol = { zoom: '#ffd27a', night: '#7fe87f', analyzer: '#7fc8ff', target: '#ff4a3a' }[pick.eyes];
  s += `<ellipse cx="108" cy="68" rx="5" ry="3.5" fill="#2a2018"/>`;
  if (pick.eyes) s += `<circle cx="132" cy="68" r="9" fill="#1a1410" stroke="${FIG_PAL[partTier(pick.eyes)][0]}" stroke-width="3"/><circle cx="132" cy="68" r="4.5" fill="${eyeCol}" class="fig-glow"/>${pick.eyes === 'target' ? '<path d="M124 68 h16 M132 60 v16" stroke="#ff4a3a" stroke-width="1"/>' : ''}`;
  else s += `<ellipse cx="132" cy="68" rx="5" ry="3.5" fill="#2a2018"/>`;
  s += `</g><g class="fig-part" data-fig="ears">`;
  if (pick.ears) { const [f, k] = FIG_PAL[partTier(pick.ears)]; s += `<rect x="84" y="58" width="10" height="20" rx="4" fill="${f}" stroke="${k}" stroke-width="2"/><rect x="146" y="58" width="10" height="20" rx="4" fill="${f}" stroke="${k}" stroke-width="2"/>${pick.ears === 'echo' ? '<path d="M150 58 l12 -24" stroke="#49f0de" stroke-width="3"/><circle cx="162" cy="34" r="3" fill="#49f0de"/>' : ''}`; }
  else s += `<ellipse cx="89" cy="68" rx="5" ry="9" fill="${sk}" stroke="${sd}" stroke-width="2"/><ellipse cx="151" cy="68" rx="5" ry="9" fill="${sk}" stroke="${sd}" stroke-width="2"/>`;
  s += `</g><g class="fig-part" data-fig="voice">`;
  if (pick.voice) { const [f, k] = FIG_PAL[partTier(pick.voice)]; s += pick.voice === 'horn' ? `<path d="M110 84 h20 l8 14 h-36z" fill="${f}" stroke="${k}" stroke-width="2"/>` : `<rect x="106" y="82" width="28" height="14" rx="5" fill="${f}" stroke="${k}" stroke-width="2"/><path d="M110 87 h20 M110 91 h20" stroke="${k}" stroke-width="1.5"/>`; }
  else s += `<path d="M110 88 q10 6 20 0" stroke="${sd}" stroke-width="2.5" fill="none"/>`;
  s += `</g></svg>`;
  return s;
}


/* Арт-слои: база + прозрачные слои деталей (assets/body/*.webp). Нет арта — показывается рисованная фигура. */
const ART_LAYER = {
  calc: 'brain-t1', memory: 'brain-t1', painblock: 'brain-t2', reflex: 'brain-t2', fearless: 'brain-t2', lumneuro: 'brain-lum',
  zoom: 'eye-zoom', night: 'eye-night', analyzer: 'eye-analyzer', target: 'eye-target', amp: 'ear-t1', earfilter: 'ear-t1', echo: 'ear-echo',
  vox: 'voice-vox', horn: 'voice-horn', silver_tongue: 'voice-silver', pump: 'heart-pump', talbot_heart: 'heart-talbot',
  coalfilter: 'lung-filter', airtank: 'lung-tank', steambreath: 'lung-steam', brace: 'spine-brace', armorspine: 'spine-armor', servo: 'spine-servo',
  subplates: 'skin-plates', lummesh: 'skin-lum', arm_basic: 'arm-basic', grip: 'arm-grip', toolarm: 'arm-tool', blade: 'arm-blade', piston: 'arm-piston', armgun: 'arm-gun', armshield: 'arm-shield', coil: 'arm-coil',
  legs_basic: 'legs-basic', springlegs: 'legs-spring', silentstep: 'legs-silent', sprint: 'legs-sprint', anchor: 'legs-anchor', kick: 'legs-kick',
  frame_light: 'frame-light', frame_cast: 'frame-cast', frame_lum: 'frame-lum', plate2: 'plate-2', plate3: 'plate-3', plate4: 'plate-4',
  core2: 'core-steam', core3: 'core-lum', cool2: 'cool-liquid', cool3: 'cool-ice'
};
const ART_Z = ['cooling', 'legs', 'frame', 'plating', 'core', 'skin', 'spine', 'heart', 'lungs', 'armL', 'armR', 'brain', 'ears', 'eyes', 'voice'];
function figHTML(kind, pick) {
  const pre = kind === 'c' ? 'c-' : 'h-';
  const layers = ART_Z.map(slot => { const id = pick[slot], l = id && ART_LAYER[id]; if (!l) return ''; const f = l.startsWith('arm-') ? `${pre}${l}-${slot === 'armL' ? 'L' : 'R'}` : pre + l; return `<img class="fa-l" src="assets/body/${f}.webp" alt="" onerror="this.remove()">`; }).join('');
  const svg = kind === 'c' ? constructSVG(pick) : humanSVG(pick);
  return `<div class="fig-art"><img class="fa-base" src="assets/body/${pre}base.webp" alt="" onerror="this.closest('.fig-art').classList.add('noart')">${layers}<div class="fa-svg">${svg}</div></div>`;
}

const BodyLab = {
  mount(el) {
    const st = Object.assign({ mode: 'l', pick: {}, pickC: {} }, MH.store.get('body', {}));
    const startC = () => Object.fromEntries(Object.keys(BODY_SLOTS).filter(k => BODY_SLOTS[k][2].includes('c')).map(k => { const p = PARTS.find(x => x[7] && (x[1] === k || (x[1] === 'arm' && k.startsWith('arm')))); return [k, p ? p[0] : '']; }));
    if (!Object.keys(st.pickC).length) st.pickC = startC();
    const save = () => MH.store.set('body', st);
    const T = t => TIER_ROMAN(t);
    const fits = (p, slot) => p[6].includes(st.mode) && (p[1] === slot || (p[1] === 'arm' && slot.startsWith('arm')));
    const zones = [...new Set(Object.values(BODY_SLOTS).map(s => s[1]))];
    el.innerHTML = `<div class="bl-mode" role="radiogroup" aria-label="Тело"><button type="button" data-mode="l"><b>Живое тело</b><small>Протезы и импланты. Предел плоти ${FLESH_LIMIT}</small></button><button type="button" data-mode="c"><b>Конструкт</b><small>Детали, ядро и ёмкость 18–36. Стартовый набор</small></button></div>
      <div class="bl-wrap"><section class="bl-body" id="bBody"></section><aside class="panel bl-side" id="bSide"></aside></div>
      <div id="bExtra"></div>
      <div class="sec-head" style="margin:44px 0 16px"><div class="eyebrow">Каталог</div><h2>Протезы, импланты и детали</h2><p>I тир делает любой инженер. II и III тир — улучшенные и мастерские протезы Талботов: открываются уровнем общего пула фракции (II — 2-й уровень, III — 4-й). Нажми на карточку, чтобы раскрыть рецепт.</p></div>
      <div id="bCat"></div>`;
    function drawBody() {
      qa('[data-mode]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === st.mode)));
      const pick = st.mode === 'l' ? st.pick : st.pickC;
      const slots = Object.entries(BODY_SLOTS).filter(([, s]) => s[2].includes(st.mode));
      q('#bBody', el).innerHTML = zones.filter(z => slots.some(([, s]) => s[1] === z)).map(z => `<div class="bl-zone"><div class="al-sub">${z}</div>${slots.filter(([, s]) => s[1] === z).map(([k, s]) => {
        const opts = PARTS.filter(p => fits(p, k)), cur = PART_BY[pick[k]];
        return `<label class="bl-slot${cur ? ' on' : ''}"><span>${s[0]}</span><select data-slot="${k}">${st.mode === 'l' ? '<option value="">— своё, живое —</option>' : ''}${opts.map(p => `<option value="${p[0]}"${pick[k] === p[0] ? ' selected' : ''}>${p[2]} · ${T(p[3])}${p[4] ? ' · нагрузка ' + p[4] : ''}</option>`).join('')}</select>${cur ? `<small>${cur[5]}</small>` : ''}</label>`; }).join('')}</div>`).join('');
      const used = Object.values(pick).filter(Boolean).map(id => PART_BY[id]).filter(Boolean);
      const load = used.reduce((a, p) => a + p[4], 0), cap = st.mode === 'l' ? FLESH_LIMIT : CORE_CAP[pick.core] || 18, over = load - cap;
      q('#bSide', el).innerHTML = `<div class="c-fig bl-fig">${figHTML(st.mode, pick)}</div><div class="eyebrow">${st.mode === 'l' ? 'Предел плоти' : 'Ёмкость ядра'}</div>
        <div class="bl-meter${over > 0 ? ' over' : ''}"><i style="width:${Math.min(100, load / cap * 100)}%"></i><b>${load} / ${cap}</b></div>
        ${over > 0 ? `<p class="minus" style="font-size:13px">${st.mode === 'l' ? `Перебор на ${over}: <b>Отчуждение</b> — помеха на Волю и Красноречие${over >= 3 ? ', а в стрессе проверка Воли 15, иначе механическое безумие на сцену' : ''}.` : `Перебор на ${over}: ядро не тянет. Поставь ядро мощнее или сними детали.`}</p>` : `<p class="muted" style="font-size:13px">${st.mode === 'l' ? 'Каждый имплант нагружает тело. Перебор — Отчуждение: человек всё меньше чувствует себя человеком.' : 'Сумма нагрузки деталей не может быть больше ёмкости ядра.'}</p>`}
        <div class="al-sub">Итог</div>${used.length ? `<ul class="bl-sum">${used.map(p => `<li><b>${p[2]}</b> ${p[5]}</li>`).join('')}</ul>` : '<p class="muted" style="font-size:13px">Ничего не установлено.</p>'}
        ${st.mode === 'c' ? '<button type="button" class="btn small ghost" id="bReset">Вернуть стартовый набор</button>' : '<button type="button" class="btn small ghost" id="bReset">Снять всё</button>'}`;
      q('#bExtra', el).innerHTML = st.mode === 'c' ? `<div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Особенности</div><h2>Как живёт конструкт</h2></div>
        <div class="bl-rules">${CONSTRUCT_RULES.map(([t, d]) => `<div class="bl-rule"><b>${t}</b><p>${d}</p></div>`).join('')}</div>
        <div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Вместо зелий</div><h2>Батареи и компоненты обслуживания</h2><p>Конструкт восстанавливается зарядкой люмеритовых батарей. Ремкомплекты чинят поломки, остальное снимает перегрев, утечку масла и ржавчину.</p></div>
        <div class="hl-mgrid">${CONSTRUCT_CONS.map(c => `<article class="hl-med kc" style="--kc:${TIER_COL[c[2]]}"><h4><i>⚡</i>${c[1]}${c[4] > 1 ? ` <em>×${c[4]}</em>` : ''}</h4><p>${T(c[2])} тир · ${c[5]}</p><div class="cc-rec">${c[3].map(([i, n]) => matChip(i, n)).join('')}</div><button type="button" class="cc-chain" data-bchain="${c[0]}">Цепочка до сырья</button></article>`).join('')}</div>` : '';
    }
    function drawCat() {
      const list = PARTS.filter(p => p[6].includes(st.mode));
      const slotGroups = [...new Set(list.map(p => p[1]))];
      const sname = k => k === 'arm' ? 'Руки' : BODY_SLOTS[k][0];
      q('#bCat', el).innerHTML = slotGroups.map(k => `<section class="craft-sec"><h3 class="craft-grp">${sname(k)} <i>${list.filter(p => p[1] === k).length}</i></h3><div class="craft-grid">${list.filter(p => p[1] === k).map(p => { const rec = partRec(p); return `<article class="craft-card" data-card="${p[0]}">
        <button type="button" class="cc-head" aria-expanded="false"><span class="cc-pic"><span class="cc-glyph">${{ 1: '⚙', 2: '⛭', 3: '✦' }[p[3]]}</span></span><span class="cc-ht"><span class="cc-tag">${T(p[3])} тир${p[3] > 1 ? ` · Талбот, пул ${p[3] === 2 ? 2 : 4}` : ''}${p[7] ? ' · стартовая' : ''}</span><b>${p[2]}</b><small>нагрузка ${p[4]} · ${p[6] === 'c' ? 'только конструкты' : p[6] === 'l' ? 'только живые' : 'живые и конструкты'}</small></span><span class="cc-arr">▾</span></button>
        <div class="cc-body"><div class="cc-stats">${p[5]}</div>${rec ? `<div class="al-sub">Рецепт · Протезная мастерская</div><div class="cc-rec">${rec.map(([i, n]) => matChip(i, n)).join('')}</div><button type="button" class="cc-chain" data-pchain="${p[0]}">Цепочка до сырья</button>` : '<p class="cc-note">Выдаётся при создании конструкта.</p>'}</div></article>`; }).join('')}</div></section>`).join('');
    }
    el.addEventListener('change', e => { const s = e.target.closest('[data-slot]'); if (!s) return; (st.mode === 'l' ? st.pick : st.pickC)[s.dataset.slot] = s.value; play('click'); save(); drawBody(); });
    el.addEventListener('click', e => {
      const fp = e.target.closest('#bSide [data-fig]');
      if (fp) { const sel = q(`[data-slot="${fp.dataset.fig}"]`, el); if (sel) { sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); sel.focus({ preventScroll: true }); } return; }
      const m = e.target.closest('[data-mode]'), h = e.target.closest('.cc-head'), pc = e.target.closest('[data-pchain]'), bc = e.target.closest('[data-bchain]');
      if (m) { st.mode = m.dataset.mode; play('click'); save(); drawBody(); drawCat(); }
      else if (e.target.closest('#bReset')) { if (st.mode === 'l') st.pick = {}; else st.pickC = startC(); save(); drawBody(); }
      else if (pc) { const p = PART_BY[pc.dataset.pchain]; showChain(p[2], 'Протезная мастерская', partRec(p), 1); }
      else if (bc) { const c = CONSTRUCT_CONS.find(x => x[0] === bc.dataset.bchain); showChain(c[1], 'Протезная мастерская', c[3], c[4]); }
      else if (h) { const card = h.closest('[data-card]'), open = !card.classList.contains('open'); card.classList.toggle('open', open); h.setAttribute('aria-expanded', String(open)); play('click'); }
    });
    drawBody(); drawCat();
  }
};

/* ======================= КРИСТАЛЛЫ МАГИИ =======================
   Маг больше не тянет силу из себя — только из люмеритового кристалла-фокуса.
   Заклинание тратит заряды. Пустой кристалл — рулетка. Единица на броске Магии — трещина. */
const CRYSTALS = [
  { t: 1, id: 'crys1', name: 'Осколок люмерита', max: 4, img: 'lumerite', fx: 'Мутный, с прожилками породы. Дёшев, но держит мало.' },
  { t: 2, id: 'crys2', name: 'Огранённый кристалл', max: 8, img: 'lum_pure', fx: 'Резонанс: раз за бой одно заклинание с преимуществом.' },
  { t: 3, id: 'crys3', name: 'Сердце жилы', max: 12, img: 'lum_pure', fx: 'Резонанс. Высшие заклинания стоят 1 заряд вместо 2.' }
];
const SPELL_COST = [
  ['Базовое плетение, заклинание школы', '1 заряд'],
  ['Высшее заклинание', '2 заряда (1 — для Сердца жилы)'],
  ['Перегрузка: +1d4 к урону или лечению, или +1 ход эффекта', '+1 заряд, раз за ход'],
  ['Школа Крови по цели с Кровотечением', '0 зарядов, раз за ход'],
  ['Лёгкий эффект вне боя (свет, иней, искра)', '1 заряд на сцену']
];
const RECHARGE = [
  ['Люмеритовое топливо в зарядной раме станции', '+4 заряда за 1 топливо'],
  ['Ночь в зарядной раме между событиями', 'кристалл полон'],
  ['Зелье маны I / II / III (алхимия, из люмеритовой крошки)', '+2 / +4 / полный, одно за бой'],
  ['Инженер: «Полевой ремонт»', '+1 заряд'],
  ['Инженер: «Мистический заслон II»', '+1d4 заряда, раз за бой']
];
const CRYSTAL_RULES = [
  ['Без кристалла', 'Маг не плетёт совсем. Сила тела больше не отвечает: шахты выпили лей-линии вокруг города, и то, что маг тянул из себя, теперь берётся только из застывшей жилы.'],
  ['Фокус и запас', 'Кристалл стоит в фокусе — посохе, перчатке, кольце, трости. С собой ещё 2 запасных. Сменить кристалл — дополнительное действие.'],
  ['На пределе', 'Кристалл пуст, а плести надо: рулетка 1d100. Угадали — заклинание срабатывает, кристалл получает трещину. Не угадали — заклинания нет, откат лей-линии: Оглушение на 1 ход.'],
  ['Трещина', 'Выпала 1 на броске Магии — кристалл трескается: −2 к его максимуму зарядов. Третья трещина раскалывает кристалл, заряды пропадают.'],
  ['Кап', 'Кристалл не даёт бонусов к кубам — только заряды и Резонанс. Сила мага растёт в древе, а запас — в кристалле.']
];
const Crystal = {
  mount(el) {
    const st = Object.assign({ t: 1, ch: 4, cr: 0, log: '' }, MH.store.get('crystal', {}));
    const C = () => CRYSTALS.find(c => c.t === st.t) || CRYSTALS[0];
    const cap = () => Math.max(0, C().max - st.cr * 2);
    const save = () => MH.store.set('crystal', st);
    const say = t => { st.log = t; };
    function spend(n, what) {
      if (st.cr >= 3) { say('Кристалл расколот. Поставь новый.'); return; }
      if (st.ch >= n) { st.ch -= n; say(`${what}: −${n} ${n === 1 ? 'заряд' : 'заряда'}.`); return; }
      const r = 1 + Math.floor(Math.random() * 100), hi = Math.random() < .5, win = r !== 50 && (hi ? r > 50 : r < 50);
      if (win) { st.cr++; st.ch = 0; say(`На пределе: ставка «${hi ? 'больше' : 'меньше'} 50», выпало ${r} — угадал. ${what} срабатывает, кристалл трескается${st.cr >= 3 ? ' и раскалывается' : ''}.`); }
      else say(`На пределе: ставка «${hi ? 'больше' : 'меньше'} 50», выпало ${r} — мимо. Заклинания нет, откат лей-линии: Оглушение на 1 ход.`);
    }
    function draw() {
      const c = C(), m = cap(), broken = st.cr >= 3;
      st.ch = Math.min(st.ch, m);
      const hiCost = c.t === 3 ? 1 : 2;
      el.innerHTML = `<div class="cry">
        <div class="cry-pick" role="radiogroup" aria-label="Кристалл">${CRYSTALS.map(x => `<button type="button" role="radio" aria-checked="${x.t === st.t}" data-ct="${x.t}">${ITEM_ART.has(x.id) ? `<img class="cry-art" src="${artSrc(x.id)}" alt="">` : `<span class="cry-gem t${x.t}"></span>`}<b>${x.name}</b><small>${TIER_ROMAN(x.t)} тир · ${x.max} зарядов</small></button>`).join('')}</div>
        <div class="cry-main panel">
          <div class="cry-top"><div><div class="eyebrow">Кристалл в фокусе</div><h3>${c.name}${broken ? ' — расколот' : ''}</h3><p class="muted">${c.fx}</p></div>
            <div class="cry-count"><b>${st.ch}</b><span>из ${m}</span></div></div>
          <div class="cry-pips" aria-label="Заряды">${Array.from({ length: c.max }, (_, i) => `<i class="${i < st.ch ? 'on' : i >= m ? 'cracked' : ''}"></i>`).join('')}</div>
          <div class="cry-cracks">Трещины: ${[0, 1, 2].map(i => `<span class="${i < st.cr ? 'on' : ''}"></span>`).join('')}</div>
          <div class="cry-acts">
            <button class="btn small" data-a="spell">Заклинание · −1</button>
            <button class="btn small" data-a="high">Высшее · −${hiCost}</button>
            <button class="btn small ghost" data-a="over">Перегрузка · −1</button>
            <button class="btn small ghost" data-a="crack">Выпала 1 · трещина</button>
          </div>
          <div class="cry-acts">
            <button class="btn small ghost" data-a="fuel">Топливо · +4</button>
            <button class="btn small ghost" data-a="eng">Инженер · +1</button>
            <button class="btn small ghost" data-a="full">Ночь в раме · полон</button>
            <button class="btn small ghost" data-a="new">Новый кристалл</button>
          </div>
          <p class="cry-log" aria-live="polite">${st.log || 'Заряды тратятся на каждое заклинание. Если кристалл пуст, кнопка сама бросит рулетку.'}</p>
        </div></div>`;
    }
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-ct]'), a = e.target.closest('[data-a]');
      if (t) { st.t = +t.dataset.ct; st.cr = 0; st.ch = C().max; say(`В фокусе: ${C().name}.`); }
      else if (a) {
        const c = C(), k = a.dataset.a;
        if (k === 'spell') spend(1, 'Заклинание');
        else if (k === 'high') spend(c.t === 3 ? 1 : 2, 'Высшее заклинание');
        else if (k === 'over') spend(1, 'Перегрузка');
        else if (k === 'crack') { st.cr = Math.min(3, st.cr + 1); say(st.cr >= 3 ? 'Третья трещина: кристалл раскололся, заряды пропали.' : `Трещина: максимум зарядов −2.`); if (st.cr >= 3) st.ch = 0; }
        else if (k === 'fuel') { if (st.cr < 3) { st.ch = Math.min(cap(), st.ch + 4); say('Зарядная рама: +4 заряда.'); } }
        else if (k === 'eng') { if (st.cr < 3) { st.ch = Math.min(cap(), st.ch + 1); say('Инженер подкачал кристалл: +1 заряд.'); } }
        else if (k === 'full') { if (st.cr < 3) { st.ch = cap(); say('Ночь в раме: кристалл полон. Трещины остаются.'); } }
        else if (k === 'new') { st.cr = 0; st.ch = c.max; say(`Новый ${c.name.toLowerCase()} в фокусе.`); }
      } else return;
      play('click'); save(); draw();
    });
    draw();
  }
};

/* ======================= ИЗОБРЕТЕНИЯ ИНЖЕНЕРА =======================
   Игрок сам придумывает, как работает его механизм. Правила задают рамки: слоты, силу, цену и слабость.
   I тир — помощник. II — +слот помощника и боевая турель с зоной. III — автоматон в кейсе с обучающимся разумом. */
const INV_TIERS = [
  { t: 1, name: 'Подмастерье', open: 'С создания персонажа — способность Инженера «Изобретатель».', slots: { gadget: 1, turret: 0, auto: 0 } },
  { t: 2, name: 'Изобретатель', open: '8 изученных узлов в ветвях Инженера, среди них приём «Турель».', slots: { gadget: 2, turret: 1, auto: 0 } },
  { t: 3, name: 'Мастер-конструктор', open: 'Вершина «Автоматон» в ветви Конструкции.', slots: { gadget: 2, turret: 1, auto: 1 } }
];
const INV_FN = [
  ['scout', 'Разведка', 'Летает или ползает до 6 тайлов от вас и передаёт, что видит и слышит. Внимательность через него — без помех. Бесплатно.'],
  ['tool', 'Инструмент', '+2 к одной узкой проверке: взлом, обезвреживание, лазание, ремонт одного вида машин. Не выше капа +10.'],
  ['aid', 'Поддержка', 'Раз за бой, 1 Деталь: союзник рядом восстанавливает 1d4 ОЗ или снимает один лёгкий статус.'],
  ['hinder', 'Помеха', 'Раз за бой, 1 Деталь: цель в 3 тайлах 1 ход защищается с помехой — дым, вспышка, цепкий трос.'],
  ['carry', 'Носильщик', 'Несёт 2 единицы веса, подаёт предмет союзнику в 3 тайлах без его действия. Раз за бой +1 Деталь.'],
  ['signal', 'Связь и тревога', 'Передаёт короткое сообщение в пределах квартала или сторожит проход и поднимает тревогу. Бесплатно.'],
  ['own', 'Своя функция', 'Опишите сами. Мастер приравнивает её по силе к одной из строк выше и назначает цену.']
];
const INV_WEAK = ['Боится воды: в дождь и под водой отключается', 'Магнит или разряд сбивают его на 1 ход', 'Пружинный завод: работает 3 хода, потом ДОП на подзавод', 'Шумит: ваша Скрытность с помехой, пока он рядом', 'Хрупкий: любое попадание — поломка', 'Жрёт масло: после каждой сцены 1 техническое масло', 'Своя слабость'];
const INV_POWER = ['Пружинный завод', 'Паровой котелок', 'Малая люмеритовая батарея', 'Часовой механизм'];
const INV_ZONE = [
  ['cone', 'Конус', 'Перед турелью: 3 тайла вглубь, расходится до 3 в ширину.'],
  ['line', 'Линия', 'Прямая на 5 тайлов. Пробивает: бьёт первую цель в линии.'],
  ['ring', 'Круг', 'Все тайлы на 2 вокруг турели. Дальность мала, но спины нет.'],
  ['post', 'Пост', 'Квадрат 2×2 до 6 тайлов от турели. Стреляет в первого, кто вошёл.']
];
const INV_MOD = [
  ['shot', 'Картечь', 'Урон 1 ЕУ +1d6 вместо +1d4. Без эффекта.'],
  ['fire', 'Огонь', 'Попадание накладывает Горение.'],
  ['frost', 'Холод', 'Цель теряет 1 тайл движения на ход.'],
  ['net', 'Сеть', 'Раз за бой: цель Обездвижена на 1 ход.'],
  ['shock', 'Разряд', 'Механизм или конструкт Оглушён, если не прошёл Стойкость 15.']
];
const INV_PROTO = [
  ['guard', 'Телохранитель', 'Реакция: принимает атаку по вам на себя.'],
  ['hunt', 'Охотник', 'Запоминает врага: раз за бой +1d4 урона по нему.'],
  ['assist', 'Ассистент', 'В начале боя +1 Деталь. Раз за сцену ваша проверка Механики с преимуществом.'],
  ['self', 'Самостоятельность', 'Ходит на своей инициативе и больше не тратит ваш ДОП.'],
  ['ward', 'Страж', 'Пока стоит рядом с вами, +1 к вашей Защите (кап +10).'],
  ['own', 'Свой протокол', 'Придумайте сами — мастер уравнивает по силе с остальными.']
];
const INV_MEM = [3, 6, 10, 15];
const INV_STATS = {
  gadget: [['ОЗ', '3'], ['КБ', '10'], ['Движение', '3 тайла'], ['Действует', 'вашим ДОП'], ['Способностей', '1']],
  turret: [['ОЗ', '6'], ['КБ', '12'], ['Атака', 'ваша Механика −2'], ['Урон', '1 ЕУ +1d4'], ['Развернуть', 'ОСН, 2 Детали, раз за бой'], ['Выстрел', 'в конце вашего хода, 1 цель в зоне']],
  auto: [['ОЗ', '10'], ['КБ', '13'], ['Движение', '3 тайла'], ['Атака и Защита', 'ваши −2'], ['Урон', '1 ЕУ +1d6'], ['Развернуть', 'ОСН, раз за сцену; свернуть — ДОП рядом']]
};
const INV_MAT = {
  gadget: [['mech1', 2], ['tech_parts', 3], ['copper_ingot', 2], ['bat1', 1]],
  turret: [['precision', 1], ['steel', 3], ['tech_parts', 4], ['brass', 2], ['lens', 1]],
  auto: [['precision', 3], ['lum_core', 1], ['lumsteel', 2], ['brass', 4], ['lum_wire', 2], ['bat2', 1]]
};
const INV_DC = { gadget: 12, turret: 14, auto: 16 };
const INV_RULES = [
  ['1. Чертёж', 'Игрок пишет карточку: название, облик, питание, одну функцию, слабость. Как именно механизм работает — придумываете вы. Это и есть изобретение.'],
  ['2. Согласование', 'Мастер сверяет функцию с меню силы. Своя функция или протокол не может быть сильнее любой строки меню: не больше +2 к узкой проверке, не больше 1d4 или 1d6 урона, кап +10 действует.'],
  ['3. Сборка', 'На верстаке, из материалов слота. Проверка Механики: помощник 12, турель 14, автоматон 16. Провал — сборка переносится на следующее событие, материалы целы. Выпала 1 — половина материалов в лом.'],
  ['4. Испытание', 'Первое применение в сцене — рулетка 1d100. Не угадали — сбой: механизм срабатывает не так, как задумано, мастер описывает как. Дальше он работает стабильно.'],
  ['Слабость обязательна', 'У каждого механизма есть слабость. Без неё мастер не принимает чертёж. Хорошая слабость делает изобретение живым.'],
  ['Слоты', 'Слот занят, пока механизм существует. Разобрать изобретение — вернуть половину материалов и освободить слот. Гений механики даёт ещё один слот помощника.'],
  ['Поломки', 'Механизмы — те же конструкты: яды не действуют, вместо травм поломки, чинят ремкомплектом и «Полевым ремонтом». На 0 ОЗ — отключён до починки.']
];
const INV_AUTO_RULES = [
  ['Кейс', 'Автоматон сложен в кейс — вес 2, носится за спиной. Развернуть можно в бою, экспедиции, охране, на работе. В суде, салоне или храме мастер может запретить.'],
  ['Обучающийся разум', 'Автоматон копит Память (ПМ): +1 за событие, где он был развёрнут, и +1, когда в сцене сделал что-то впервые (по решению мастера). На 3, 6, 10 и 15 ПМ он учит новый протокол.'],
  ['Характер', 'С 10 ПМ у автоматона появляется характер: привычка, манера, любимое слово. Его описывает игрок — это повод для отыгрыша, а не бонус.'],
  ['Улучшения', 'Автоматона улучшают как конструкта: ядро, каркас, оптика, руки, обшивка — на странице «Протезы и конструкты». Ёмкость ядра ограничивает детали.'],
  ['Память в ядре', 'Тяжёлая поломка — рулетка 1d100. Не угадали — ядро повреждено, автоматон забывает последний выученный протокол.']
];
const Inventor = {
  mount(el) {
    const blank = () => ({ name: '', fn: 'scout', how: '', weak: 0, weakOwn: '', pow: 0 });
    const st = Object.assign({ t: 1, g: [blank(), blank(), blank()], tur: { name: '', zone: 'cone', mod: 'shot', how: '' }, auto: { name: '', mem: 0, proto: [], quirk: '' }, genius: false }, MH.store.get('inventor', {}));
    while (st.g.length < 3) st.g.push(blank());
    const save = () => MH.store.set('inventor', st);
    const T = () => INV_TIERS[st.t - 1];
    const nG = () => Math.min(3, T().slots.gadget + (st.genius ? 1 : 0));
    const opt = (list, cur, lab = x => x[1], val = (x, i) => x[0]) => list.map((x, i) => `<option value="${esc(val(x, i))}"${String(val(x, i)) === String(cur) ? ' selected' : ''}>${esc(lab(x))}</option>`).join('');
    const statRows = k => `<div class="kv iv-stats">${INV_STATS[k].map(([a, b]) => `<div class="wrow"><span>${a}</span><b>${b}</b></div>`).join('')}</div>`;
    const mats = k => `<div class="iv-mats"><small>Материалы · Механика ${INV_DC[k]}</small><div>${INV_MAT[k].map(([i, n]) => matChip(i, n)).join('')}</div></div>`;
    function zoneGrid(z) {
      const N = 7, on = new Set(); let tx = 3, ty = 6;
      if (z === 'cone') { for (let d = 1; d <= 3; d++) for (let w = -Math.min(1, d - 1); w <= Math.min(1, d - 1); w++) on.add(`${tx + w},${ty - d}`); }
      if (z === 'line') for (let d = 1; d <= 5; d++) on.add(`${tx},${ty - d}`);
      if (z === 'ring') { ty = 3; for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) if (!(x === tx && y === ty)) on.add(`${x},${y}`); }
      if (z === 'post') { [[3, 1], [4, 1], [3, 2], [4, 2]].forEach(([x, y]) => on.add(`${x},${y}`)); }
      let h = '';
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h += `<i class="${x === tx && y === ty ? 'me' : on.has(`${x},${y}`) ? 'on' : ''}"></i>`;
      return `<div class="iv-grid" aria-hidden="true">${h}</div>`;
    }
    const lock = (what, need) => `<article class="panel iv-card iv-lock"><div class="eyebrow">${what}</div><p class="muted">Откроется на ${need}.</p></article>`;
    function gadgetCard(i) {
      const g = st.g[i], fn = INV_FN.find(f => f[0] === g.fn) || INV_FN[0];
      return `<article class="panel iv-card" data-gi="${i}"><div class="iv-head">${iconImg('inv-fn-' + g.fn, 'iv-ic')}<div class="eyebrow">Слот помощника ${i + 1}</div></div>
        <label class="iv-f"><span>Название</span><input data-k="name" maxlength="60" value="${esc(g.name)}" placeholder="Например, «Сверчок» — латунный жук-отмычка"></label>
        <div class="iv-row"><label class="iv-f"><span>Функция</span><select data-k="fn">${opt(INV_FN, g.fn)}</select></label>
        <label class="iv-f"><span>Питание</span><select data-k="pow">${opt(INV_POWER, g.pow, x => x, (x, i) => i)}</select></label></div>
        <p class="iv-hint">${fn[2]}</p>
        <label class="iv-f"><span>Как он работает — своими словами</span><textarea data-k="how" rows="3" maxlength="600" placeholder="Облик, повадки, что именно делает и как выглядит со стороны">${esc(g.how)}</textarea></label>
        <label class="iv-f"><span>Слабость</span><select data-k="weak">${opt(INV_WEAK, g.weak, x => x, (x, i) => i)}</select></label>
        ${g.weak === INV_WEAK.length - 1 ? `<label class="iv-f"><span>Своя слабость</span><input data-k="weakOwn" maxlength="120" value="${esc(g.weakOwn)}"></label>` : ''}
        ${statRows('gadget')}${mats('gadget')}</article>`;
    }
    function turretCard() {
      const u = st.tur, z = INV_ZONE.find(x => x[0] === u.zone) || INV_ZONE[0], m = INV_MOD.find(x => x[0] === u.mod) || INV_MOD[0];
      return `<article class="panel iv-card iv-wide" data-tur><div class="iv-head">${iconImg('inv-tier2', 'iv-ic')}${iconImg('inv-mod-' + u.mod, 'iv-ic')}<div class="eyebrow">Боевая турель</div></div>
        <div class="iv-split"><div>
        <label class="iv-f"><span>Название</span><input data-k="name" maxlength="60" value="${esc(u.name)}" placeholder="Например, «Сторожевая цапля»"></label>
        <div class="iv-f"><span>Зона обстрела</span><div class="iv-seg" role="radiogroup">${INV_ZONE.map(x => `<button type="button" data-zone="${x[0]}" aria-checked="${x[0] === u.zone}" role="radio">${x[1]}</button>`).join('')}</div></div>
        <p class="iv-hint">${z[2]}</p>
        <label class="iv-f"><span>Модуль</span><select data-k="mod">${opt(INV_MOD, u.mod)}</select></label>
        <p class="iv-hint">${m[2]}</p>
        <label class="iv-f"><span>Как она работает — своими словами</span><textarea data-k="how" rows="3" maxlength="600" placeholder="Как разворачивается, чем стреляет, как выбирает цель">${esc(u.how)}</textarea></label>
        </div><div class="iv-zone">${zoneGrid(u.zone)}<small>■ турель · ▦ зона обстрела</small></div></div>
        <p class="iv-hint">Зону выбирают при развёртывании и не меняют до конца боя. ДОП и 1 Деталь — повернуть турель. Выпала 1 на Атаке турели — она бьёт ближайшего в зоне, даже союзника.</p>
        ${statRows('turret')}${mats('turret')}</article>`;
    }
    function autoCard() {
      const a = st.auto, open = INV_MEM.filter(n => a.mem >= n).length;
      return `<article class="panel iv-card iv-wide" data-auto><div class="iv-head">${iconImg('inv-tier3', 'iv-ic')}<div class="eyebrow">Автоматон в кейсе</div></div>
        <div class="iv-split"><div>
        <label class="iv-f"><span>Имя</span><input data-k="name" maxlength="60" value="${esc(a.name)}" placeholder="Например, «Фрейя-7» или просто «Ящик»"></label>
        <div class="iv-f"><span>Память: <b>${a.mem}</b> ПМ · протоколов ${a.proto.length} из ${open}</span><div class="iv-mem"><button type="button" class="btn small ghost" data-mem="-1" aria-label="Меньше памяти">−</button><input type="range" min="0" max="20" value="${a.mem}" data-k="mem" aria-label="Память автоматона"><button type="button" class="btn small ghost" data-mem="1" aria-label="Больше памяти">+</button></div>
        <ol class="iv-steps">${INV_MEM.map((n, i) => `<li class="${a.mem >= n ? 'on' : ''}">${n} ПМ</li>`).join('')}</ol></div>
        <div class="iv-protos">${INV_PROTO.map(p => { const on = a.proto.includes(p[0]); const can = on || a.proto.length < open; return `<button type="button" class="iv-proto${on ? ' on' : ''}" data-proto="${p[0]}" aria-pressed="${on}"${can ? '' : ' disabled'}>${iconImg('inv-pr-' + p[0], 'iv-pic')}<b>${p[1]}</b><small>${p[2]}</small></button>`; }).join('')}</div>
        <label class="iv-f"><span>Характер${a.mem >= 10 ? '' : ' — откроется на 10 ПМ'}</span><textarea data-k="quirk" rows="2" maxlength="400"${a.mem >= 10 ? '' : ' disabled'} placeholder="Привычка, манера, любимое слово">${esc(a.quirk)}</textarea></label>
        </div><div>${statRows('auto')}<p class="iv-hint">Улучшения — как у конструкта: <a href="#body">Протезы и конструкты</a>.</p></div></div>
        <div class="kv">${INV_AUTO_RULES.map(([k, v]) => `<div class="wrow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        ${mats('auto')}</article>`;
    }
    function text() {
      const L = [`Заявка изобретателя · ${T().name} (${st.t} тир)`];
      for (let i = 0; i < nG(); i++) { const g = st.g[i], fn = INV_FN.find(f => f[0] === g.fn); L.push(`\nПомощник ${i + 1}: ${g.name || 'без названия'}\nФункция: ${fn[1]} — ${fn[2]}\nПитание: ${INV_POWER[g.pow]}\nКак работает: ${g.how || '—'}\nСлабость: ${g.weak === INV_WEAK.length - 1 ? g.weakOwn || '—' : INV_WEAK[g.weak]}`); }
      if (T().slots.turret) { const u = st.tur, z = INV_ZONE.find(x => x[0] === u.zone), m = INV_MOD.find(x => x[0] === u.mod); L.push(`\nТурель: ${u.name || 'без названия'}\nЗона: ${z[1]} — ${z[2]}\nМодуль: ${m[1]} — ${m[2]}\nКак работает: ${u.how || '—'}`); }
      if (T().slots.auto) { const a = st.auto; L.push(`\nАвтоматон: ${a.name || 'без имени'}\nПамять: ${a.mem} ПМ\nПротоколы: ${a.proto.map(p => INV_PROTO.find(x => x[0] === p)[1]).join(', ') || '—'}${a.mem >= 10 ? `\nХарактер: ${a.quirk || '—'}` : ''}`); }
      return L.join('\n');
    }
    function draw() {
      const s = T().slots;
      el.innerHTML = `<div class="iv-tiers" role="radiogroup" aria-label="Тир изобретателя">${INV_TIERS.map(x => `<button type="button" role="radio" data-t="${x.t}" aria-checked="${x.t === st.t}">${iconImg('inv-tier' + x.t, 'iv-tic')}<span>${'I II III'.split(' ')[x.t - 1]}</span><b>${x.name}</b><small>${x.open}</small></button>`).join('')}</div>
        <label class="iv-genius"><input type="checkbox" id="ivGen"${st.genius ? ' checked' : ''}> Изучена вершина «Гений механики» — ещё один слот помощника</label>
        <div class="iv-cards">${[0, 1, 2].map(i => i < nG() ? gadgetCard(i) : i < 2 ? lock('Слот помощника ' + (i + 1), 'II тире') : '').join('')}
        ${s.turret ? turretCard() : lock('Боевая турель', 'II тире')}${s.auto ? autoCard() : lock('Автоматон в кейсе', 'III тире')}</div>
        <div class="iv-out"><button type="button" class="btn" id="ivCopy">Скопировать заявку мастеру</button><textarea id="ivTxt" hidden readonly rows="8"></textarea></div>`;
    }
    const cardOf = t => t.closest('[data-gi]') ? st.g[+t.closest('[data-gi]').dataset.gi] : t.closest('[data-tur]') ? st.tur : t.closest('[data-auto]') ? st.auto : null;
    el.addEventListener('input', e => {
      const t = e.target, k = t.dataset.k, o = cardOf(t); if (!k || !o) return;
      const num = ['weak', 'pow', 'mem'].includes(k);
      o[k] = num ? +t.value : t.value;
      if (k === 'mem') { const open = INV_MEM.filter(n => o.mem >= n).length; o.proto = o.proto.slice(0, open); }
      save();
      if (t.tagName === 'SELECT' || k === 'mem') draw();
    });
    el.addEventListener('change', e => { if (e.target.id === 'ivGen') { st.genius = e.target.checked; save(); play('click'); draw(); } });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { st.t = +b.dataset.t; }
      else if (b.dataset.zone) { st.tur.zone = b.dataset.zone; }
      else if (b.dataset.mem) { st.auto.mem = Math.max(0, Math.min(20, st.auto.mem + +b.dataset.mem)); st.auto.proto = st.auto.proto.slice(0, INV_MEM.filter(n => st.auto.mem >= n).length); }
      else if (b.dataset.proto) { const p = b.dataset.proto, a = st.auto; a.proto = a.proto.includes(p) ? a.proto.filter(x => x !== p) : [...a.proto, p]; }
      else if (b.id === 'ivCopy') {
        const txt = text(), ta = q('#ivTxt', el);
        const fb = () => { ta.hidden = false; ta.value = txt; ta.select(); };
        try { navigator.clipboard.writeText(txt).then(() => { b.textContent = 'Скопировано ✓'; setTimeout(() => b.textContent = 'Скопировать заявку мастеру', 1800); }, fb); } catch (_) { fb(); }
        return;
      } else return;
      play('click'); save(); draw();
    });
    draw();
  }
};
window.INV_RULES = INV_RULES;

/* ======================= РАЗВИТИЕ ПРОКЛЯТЫХ =======================
   Пять ступеней. Очки проклятия (ОП) копятся, когда носитель пользуется силой. Каждая ступень даёт способность и берёт цену. */
const CURSE_STEPS = [0, 10, 25, 45, 70];
const CURSE_DEV = {
  doppler: { gain: [['Сменить облик в сцене', '+1 ОП'], ['Пережить чужое Эхо памяти', '+2 ОП'], ['Удерживать чужой облик дольше суток', '+1 ОП'], ['Мутаген (Алхимия)', '+2 / +4 / +6 ОП']],
    hold: [['Сутки в собственном облике', '−1 ОП, раз в неделю'], ['Сдерживающий мутаген', '−2 ОП, раз за ивент']],
    steps: [
      ['Морфизм', 'Тело правда перестраивается: пол, раса, черты, рост, цвет кожи, волос и глаз, голос. На старте 2 своих облика. Расовые и классовые способности не передаются. Регенерация: 1 ОЗ раз в 3 хода.', 'Хрупкость: −2 к Стойкости.'],
      ['Приблизительная копия', 'Примите облик того, кого видели. Узнать подделку — Внимательность близкого против вашей Скрытности. Эмпатия: долгое касание выдаёт эмоции цели — страх, гнев, ложь в голосе.', 'Проблема плоти: при тяжёлом ранении мастер бросает рулетку — проигрыш, и облик сползает (глаза, кожа у раны).'],
      ['Перестройка плоти', 'Меняйте отдельные черты и комбинируйте облики. Когти: 1 ЕУ +1d4. Тонкие пальцы: взлом и механизмы с преимуществом. Регенерация: 1 ОЗ раз в 2 хода.', 'Чужое в зеркале: свой настоящий облик вспоминается с трудом.'],
      ['Эхо памяти', 'Глубокий контакт даёт осколок чужой памяти, у мёртвых — последние минуты жизни. Каждый осколок — фрагмент эха: с 3 фрагментами копия цели неотличима.', 'После Эха — помеха на Самообладание на 1d4 хода.'],
      ['Поглощение личности', 'Раз за ивент перенимаете память, манеры, знакомства и один обычный навык цели: +2 к одному её кубу до конца ивента, не выше капа. Магия и классовые способности не копируются.', 'Выветривание: чужое блекнет, а своё путается. При провале Самообладания 15 вы не знаете, чьё это воспоминание.']] },
  beast: { gain: [['Частичное превращение', '+1 ОП'], ['Убийство в звериной форме', '+2 ОП'], ['Поддаться инстинкту в сцене', '+1 ОП']],
    hold: [['Цепи и серебро в кризисную ночь', '−2 ОП, раз в неделю'], ['Сцена спокойной жизни среди людей', '−1 ОП, раз за ивент']],
    steps: [
      ['Звериное чутьё', '+1 Внимательность, выслеживание по запаху.', 'Раздражительность: помеха на Красноречие в толпе.'],
      ['Когти', 'Частичное превращение [ДОП]: когти 2 ЕУ с Апарту.', 'После боя — Самообладание 12, иначе продолжаешь рвать цель.'],
      ['Шкура', 'В частичной форме +1 КБ и +1 тайл движения.', 'Серебро наносит тебе +1 ЕУ.'],
      ['Зов стаи', '1 раз за бой рык: Страх у слабых врагов. Животные слушаются.', 'Запах крови или кризисная ночь — Самообладание 14, иначе полное превращение.'],
      ['Зверь', '1 раз за ивент полная форма: +2 ЕУ, +2 КБ, +1 ОЗ каждый ход.', 'В форме не различаешь своих. Выйти — Самообладание 16.']] },
  vrakhir: { gain: [['Кормление на живом', '+1 ОП'], ['Убийство при кормлении', '+3 ОП'], ['Обратить силу крови против живого', '+1 ОП']],
    hold: [['Кровь из донорского банка Талботов вместо живой', 'ОП не растут'], ['Сутки поста под присмотром', '−1 ОП, раз в неделю']],
    steps: [
      ['Вкус крови', 'Глоток крови восстанавливает 1 ОЗ, раз в сцену.', 'Обычная еда даёт половину эффекта.'],
      ['Жажда', 'После кормления +1 Тело на 3 часа и зрение в темноте.', 'Сутки без крови — помеха на Самообладание.'],
      ['Кровавая хватка', 'Укус 2 ЕУ, лечит тебя на нанесённый урон.', 'Солнечный свет: −1 ко всем проверкам.'],
      ['Повелитель крови', '1 раз за бой вызвать или остановить Кровотечение у цели в 3 тайлах.', 'Лечебные зелья действуют вполовину.'],
      ['Древняя кровь', '1 раз за ивент кормление восстанавливает все ОЗ. Взгляд очаровывает: цель проходит Самообладание 15.', 'Двое суток без крови — срыв: нападаешь на ближайшего живого.']] },
  possessed: { gain: [['Уступить тело сущности на ход', '+2 ОП'], ['Исполнить требование сущности', '+3 ОП'], ['Принять подсказку голоса', '+1 ОП']],
    hold: [['Обряд Веры или экзорцизм', '−2 ОП, раз в неделю'], ['Отказать сущности и выдержать её гнев (Самообладание 14)', '−1 ОП']],
    steps: [
      ['Шёпот', 'Сущность подсказывает: 1 раз за сцену переброс проверки знаний.', 'Голос мешает спать: Усталость наступает легче.'],
      ['Чужие глаза', 'Видишь духов и магические следы.', 'В священных местах — помеха на всё.'],
      ['Уступка', 'Отдаёшь тело на ход: +2 ЕУ, иммунитет к боли и Страху.', 'Этот ход ведёт мастер.'],
      ['Голос из глубины', '1 раз за бой враги в 3 тайлах проходят Самообладание 14, иначе Страх.', 'Сущность требует платы — поступок назначает мастер.'],
      ['Слияние', '1 раз за ивент сущность в полной силе: две способности на выбор мастера.', 'Каждый раз Самообладание 16, иначе сущность остаётся у руля до конца ивента.']] }
};
const CurseLab = {
  mount(el) {
    const curses = (window.M && M.curses) || [];
    const st = Object.assign({ c: 'doppler', op: 0 }, MH.store.get('curse', {}));
    const save = () => MH.store.set('curse', st);
    el.innerHTML = `<div class="cu-pick" role="radiogroup" aria-label="Проклятие">${curses.map(c => `<button type="button" data-curse="${c.id}"><img src="${c.emblem}" alt=""><b>${c.name}</b></button>`).join('')}</div>
      <div class="cu-wrap"><section class="panel cu-main" id="cuMain"></section><aside class="panel cu-side" id="cuSide"></aside></div>`;
    function draw() {
      qa('[data-curse]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.curse === st.c)));
      const c = curses.find(x => x.id === st.c) || curses[0], d = CURSE_DEV[c.id];
      if (d.stages) { stagesView(c, d); return; }
      const stage = CURSE_STEPS.filter(t => st.op >= t).length;
      q('#cuMain', el).innerHTML = `<div class="eyebrow">Проклятие · ${c.name}</div><p class="muted" style="margin:6px 0 14px">${c.text}</p>
        <label class="cu-op"><span>Очки проклятия: <b id="cuOpV">${st.op}</b></span><input type="range" min="0" max="90" value="${st.op}" id="cuOp" aria-label="Очки проклятия"></label>
        <ol class="cu-steps">${d.steps.map((s, i) => `<li class="${i < stage ? 'on' : ''}${i === stage - 1 ? ' cur' : ''}"><div class="cu-n">${iconImg(`curse-${c.id}-${i + 1}`, 'cu-ic')}<span>${'I II III IV V'.split(' ')[i]}</span><small>${CURSE_STEPS[i]} ОП</small></div><div><b>${s[0]}</b><p>${s[1]}</p><p class="cu-cost"><span>Цена:</span> ${s[2]}</p></div></li>`).join('')}</ol>`;
      side(c, d);
      q('#cuOp', el).oninput = e => { st.op = +e.target.value; save(); q('#cuOpV', el).textContent = st.op; const sg = CURSE_STEPS.filter(t => st.op >= t).length; qa('.cu-steps li', el).forEach((li, i) => { li.classList.toggle('on', i < sg); li.classList.toggle('cur', i === sg - 1); }); side(c, d); };
    }
    function stagesView(c, d) {
      const om = Math.min(st.om || 0, d.max), echo = st.echo || 0, cur = d.stages.filter(x => om >= x.req).length;
      q('#cuMain', el).innerHTML = `<div class="eyebrow">Проклятие · ${c.name} · по образцу: ${d.from}</div><p class="muted" style="margin:6px 0 14px">${d.about}</p>
        <label class="cu-op"><span>${d.unitName}: <b id="cuOmV">${om}</b> из ${d.max}</span><input type="range" min="0" max="${d.max}" value="${om}" id="cuOm" aria-label="${d.unitName}"></label>
        <ol class="cu-steps cu-stages">${d.stages.map((x, i) => `<li class="${i < cur ? 'on' : ''}${i === cur - 1 ? ' cur' : ''}"><div class="cu-n"><span>${'I II III'.split(' ')[i]}</span><small>${x.req} ${d.unit}</small></div><div><b>${x.name}</b><p class="muted" style="font-size:12.5px">${x.note}</p>
          ${x.plus.map(([n, t, txt]) => `<div class="cu-ab"><b>${n}</b> <em>${t}</em><p>${txt}</p></div>`).join('')}
          ${x.minus.map(([n, txt]) => `<p class="cu-cost"><span>${n}:</span> ${txt}</p>`).join('')}</div></li>`).join('')}</ol>
        <div class="cu-echo panel"><div class="eyebrow">Фрагменты эха — точная копия цели</div><div class="cu-echo-row">${[0, 1, 2, 3].map(n => `<button type="button" data-echo="${n}" aria-pressed="${n === echo}">${n}</button>`).join('')}<p id="cuEchoT">${d.echo[echo]}</p></div><p class="muted" style="font-size:13px;margin:8px 0 0">${d.echoSrc}</p></div>`;
      q('#cuOm', el).oninput = e => { st.om = +e.target.value; save(); q('#cuOmV', el).textContent = st.om; const k = d.stages.filter(x => st.om >= x.req).length; qa('.cu-stages > li', el).forEach((li, i) => { li.classList.toggle('on', i < k); li.classList.toggle('cur', i === k - 1); }); stageSide(c, d); };
      stageSide(c, d);
    }
    function stageSide(c, d) {
      const om = Math.min(st.om || 0, d.max), cur = d.stages.filter(x => om >= x.req).length;
      q('#cuSide', el).innerHTML = `<div class="eyebrow">${d.stages[cur - 1].name}</div>
        <div class="bl-meter cu-meter${cur >= 3 ? ' over' : ''}"><i style="width:${om / d.max * 100}%"></i><b>${om} ${d.unit}</b></div>
        <div class="al-sub">Как растёт проклятие</div><ul class="cu-list">${d.gain.map(([t, v]) => `<li>${t}<em>${v}</em></li>`).join('')}</ul>
        <div class="al-sub">Как сдержать</div><ul class="cu-list hold">${d.hold.map(([t, v]) => `<li>${t}<em>${v}</em></li>`).join('')}</ul>
        <p class="note" style="font-size:12.5px">Как у Морфлинга на Риверсайде: каждые 100 ВП дают 1 очко мутаций (ОМ), 2 ОМ — II стадия, 4 ОМ — III. ВП и ОМ ведёт мастер.</p>`;
    }
    function side(c, d) {
      const stage = CURSE_STEPS.filter(t => st.op >= t).length;
      q('#cuSide', el).innerHTML = `<div class="eyebrow">Ступень ${stage} из 5</div>
        <div class="bl-meter cu-meter${stage >= 5 ? ' over' : ''}"><i style="width:${Math.min(100, st.op / 70 * 100)}%"></i><b>${st.op} ОП</b></div>
        <div class="al-sub">Как растёт проклятие</div><ul class="cu-list">${d.gain.map(([t, v]) => `<li>${t}<em>${v}</em></li>`).join('')}</ul>
        <div class="al-sub">Как сдержать</div><ul class="cu-list hold">${d.hold.map(([t, v]) => `<li>${t}<em>${v}</em></li>`).join('')}</ul>
        <p class="note" style="font-size:12.5px">Ступени не теряются: сдерживание лишь замедляет рост. ОП ведёт мастер, игрок отыгрывает цену каждой ступени. Все числа черновые.</p>`;
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-curse]'), ec = e.target.closest('[data-echo]'); if (b) { st.c = b.dataset.curse; play('click'); save(); draw(); } else if (ec) { st.echo = +ec.dataset.echo; save(); qa('[data-echo]', el).forEach(x => x.setAttribute('aria-pressed', String(x === ec))); q('#cuEchoT', el).textContent = CURSE_DEV.doppler.echo[st.echo]; play('click'); } });
    draw();
  }
};

/* ======================= ФРАКЦИИ =======================
   Очки фракции (ОФ) приносят игроки. Все они идут в общий пул Дома, уровни пула открывают вещи для всех членов. */
const FACTION_LV = [[0, 'Основание'], [150, 'Признание'], [400, 'Влияние'], [800, 'Власть'], [1500, 'Наследие']];
const FP_SOURCES = [['Участие в ивенте на стороне Дома', '+10'], ['Выполненный заказ или поручение Дома', '+5'], ['Победа в стычке с другим Домом', '+15'], ['Сдача в казну: 10 слитков, 50 трав или 5 заготовок II тира', '+1'], ['Новый игрок принят в Дом', '+5'], ['Проваленное поручение или предательство', '−5 … −20']];
const TALBOT_LV = [
  ['Знак Талботов', 'Протезы и импланты I тира, собранные в мастерских Дома: −1 нагрузка у протезов рук и ног.'],
  ['Улучшенные протезы', 'Открыт рецепт протезов и имплантов II тира: Подавитель боли, Нейроускоритель, Скрытый клинок, Паровой насос и другие.'],
  ['Мастерские Дома', 'Ремонт протезов и деталей конструктов членам Дома — без затрат. Люмеритовые батареи II тира в лавке Дома.'],
  ['Мастерские протезы', 'Открыт III тир: Люмеритовый нейроконтур, Прицельная сетка, Люмеритовая катушка, Сердце Талботов, детали конструктов III тира.'],
  ['Наследие Табиты', 'Предел плоти членов Дома +2. Батарея Талботов и Сердце Талботов — по одной за ивент без крафта.']
];
const DORN_MAT = [
  // [id, название, уровень пула, рецепт, выход, эффект, к чему]
  ['dornsteel', 'Дорнская сталь', 1, [['steel', 2], ['coke', 2], ['oil', 1]], 1, '+1 к атаке оружием из неё. Заменяет сталь в любом рецепте.', 'all'],
  ['redtemper', 'Красная закалка', 1, [['oil', 3], ['sulfur', 1], ['coal', 2]], 1, 'Клинок не ломается и не выбивается. Атака Апарту +1 ЕУ.', 'melee'],
  ['tanksteel', 'Танковая сталь', 2, [['dornsteel', 3], ['rivets', 10], ['lead', 2]], 1, '+1 ЕУ двуручному и тяжёлому оружию. −1 к Инициативе.', 'heavy'],
  ['hotbarrel', 'Калёный ствол', 2, [['dornsteel', 2], ['oil', 2], ['coke', 1]], 1, 'Огнестрел: +2 тайла дальности.', 'fire'],
  ['powderalloy', 'Пороховой сплав Дорна', 3, [['brass', 2], ['gunpowder', 10], ['sulfur', 2]], 1, 'Огнестрел: +1 ЕУ. Выстрел слышно вдвое дальше.', 'fire'],
  ['slugcore', 'Литой сердечник', 3, [['dornsteel', 2], ['lead', 5]], 1, 'Дальнобойное оружие пробивает 1 КБ.', 'ranged'],
  ['bulkhead', 'Заводская переборка', 4, [['dornsteel', 3], ['precision', 2], ['lum_core', 1]], 1, 'Оружие получает 4-й слот улучшения.', 'all'],
  ['crimsonlum', 'Багровый люмерит', 5, [['lumsteel', 2], ['lum_pure', 3], ['dornsteel', 2]], 1, 'Игнорирует 1 КБ и магические щиты на 2. 1 раз за бой удар накладывает Горение.', 'all']
];
const MAT_FOR = { all: 'любое оружие', melee: 'холодное оружие', heavy: 'двуручное и тяжёлое', fire: 'огнестрел', ranged: 'дальнобойное' };
const matFits = (m, w) => m[6] === 'all' || (m[6] === 'melee' && MELEE.includes(w.fam)) || (m[6] === 'heavy' && (w.hands === 2 || w.fam === 'heavy')) || (m[6] === 'fire' && FIRE.includes(w.fam)) || (m[6] === 'ranged' && RANGED.includes(w.fam));
const Factions = {
  mount(el) {
    const st = Object.assign({ h: document.documentElement.dataset.house === 'dorn' ? 'dorn' : 'talbot', pool: { talbot: 0, dorn: 0 }, w: 'sword', m: 'dornsteel' }, MH.store.get('faction', {}));
    const save = () => MH.store.set('faction', st);
    const lvOf = n => FACTION_LV.filter(([t]) => n >= t).length;
    el.innerHTML = `<div class="fx-pick" role="radiogroup" aria-label="Дом"><button type="button" data-fh="talbot" class="fx-t"><img src="assets/houses/talbot-flag.webp" alt=""><b>Дом Талбот</b><small>Жёлтые · протезы и импланты</small></button><button type="button" data-fh="dorn" class="fx-d"><img src="assets/houses/dorn-flag.webp" alt=""><b>Дом Дорн</b><small>Красные · материалы для оружия</small></button></div>
      <div class="fx-wrap"><section class="panel fx-pool" id="fxPool"></section><aside class="panel fx-src"><div class="eyebrow">Очки фракции</div><p class="muted" style="font-size:13px">Каждый член Дома приносит ОФ. Все очки идут в один общий пул Дома — уровни открывают вещи сразу для всех его членов. Пул не тратится, только растёт. Уровни у обоих Домов одинаковые.</p><ul class="cu-list">${FP_SOURCES.map(([t, v]) => `<li>${t}<em>${v}</em></li>`).join('')}</ul><p class="note" style="font-size:12.5px">Пул ведёт мастер. Ползунок слева — чтобы посмотреть, что открыто на каждом уровне. Числа черновые.</p></aside></div>
      <div id="fxBody"></div>`;
    function draw() {
      qa('[data-fh]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.fh === st.h)));
      const pool = st.pool[st.h] || 0, lv = lvOf(pool), list = st.h === 'talbot' ? TALBOT_LV : DORN_MAT.map(m => [m[1], m[5]]);
      q('#fxPool', el).innerHTML = `<div class="eyebrow">Общий пул · ${st.h === 'talbot' ? 'Дом Талбот' : 'Дом Дорн'}</div>
        <label class="cu-op"><span>Пул: <b id="fxV">${pool}</b> ОФ</span><input type="range" min="0" max="2000" step="10" value="${pool}" id="fxR" aria-label="Пул очков фракции"></label>
        <ol class="fx-lv" id="fxLv">${FACTION_LV.map(([t, n], i) => `<li class="${i < lv ? 'on' : ''}"><span>${'I II III IV V'.split(' ')[i]}</span><b>${n}</b><small>${t} ОФ</small></li>`).join('')}</ol>`;
      q('#fxR', el).oninput = e => { st.pool[st.h] = +e.target.value; save(); q('#fxV', el).textContent = st.pool[st.h]; const l = lvOf(st.pool[st.h]); qa('#fxLv li', el).forEach((li, i) => li.classList.toggle('on', i < l)); body(); };
      body();
    }
    function body() {
      const lv = lvOf(st.pool[st.h] || 0);
      if (st.h === 'talbot') {
        q('#fxBody', el).innerHTML = `<div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Дом Талбот</div><h2>Протезы и улучшения</h2><p>Талботы — завод деталей и протезов. Их пул открывает улучшенные и мастерские протезы, импланты и детали конструктов. Весь каталог — на странице <a href="#body">Протезы и конструкты</a>.</p></div>
          <div class="fx-unlocks">${TALBOT_LV.map(([n, t], i) => `<div class="fx-u${i < lv ? ' on' : ''}"><span>${'I II III IV V'.split(' ')[i]}</span><div><b>${n}</b><p>${t}</p></div><em>${i < lv ? 'открыто' : FACTION_LV[i][0] + ' ОФ'}</em></div>`).join('')}</div>`;
      } else {
        const w = WEAPONS.find(x => x.id === st.w) || WEAPONS[0], m = DORN_MAT.find(x => x[0] === st.m) || DORN_MAT[0];
        const ok = matFits(m, w), open = m[2] <= lv;
        q('#fxBody', el).innerHTML = `<div class="sec-head" style="margin:40px 0 14px"><div class="eyebrow">Дом Дорн</div><h2>Материалы для оружия</h2><p>Дорны владеют крупнейшим заводом машин и оружия. Их пул открывает лучшие материалы: оружие, собранное из них, получает постоянный бонус. На одно оружие — один материал Дорна.</p></div>
          <div class="fx-fit panel"><div class="al-sub">Примерка материала</div><div class="fx-fit-row"><select id="fxW">${WEAPON_GROUPS.map(([g, gn]) => `<optgroup label="${gn}">${WEAPONS.filter(x => x.fam === g).map(x => `<option value="${x.id}"${x.id === w.id ? ' selected' : ''}>${x.name}</option>`).join('')}</optgroup>`).join('')}</select><span>+</span><select id="fxM">${DORN_MAT.map(x => `<option value="${x[0]}"${x[0] === m[0] ? ' selected' : ''}>${x[1]} · ур. ${x[2]}</option>`).join('')}</select></div>
            <div class="fx-res ${ok && open ? 'ok' : 'no'}"><b>${w.name} · ${m[1]}</b><p>${w.dmg} ЕУ${w.range ? ' · ' + tiles(w.range) : ''}${w.hands === 2 ? ' · двуручное' : ''}</p><p>${ok ? (open ? '✓ ' + m[5] : `Откроется на ${m[2]}-м уровне пула (${FACTION_LV[m[2] - 1][0]} ОФ).`) : `Не подходит: материал только для — ${MAT_FOR[m[6]]}.`}</p></div></div>
          <div class="hl-mgrid" style="margin-top:14px">${DORN_MAT.map(x => `<article class="hl-med kc fx-mat${x[2] <= lv ? '' : ' locked'}" style="--kc:#c23b2c"><h4>${artOr(x[0], '<i>◆</i>', true)}${x[1]}</h4><p>Ур. ${x[2]} · ${MAT_FOR[x[6]]} · ${x[5]}</p><div class="cc-rec">${x[3].map(([i, n]) => matChip(i, n)).join('')}</div><button type="button" class="cc-chain" data-mchain="${x[0]}">Цепочка до сырья</button></article>`).join('')}</div>`;
        q('#fxW', el).onchange = e => { st.w = e.target.value; save(); body(); };
        q('#fxM', el).onchange = e => { st.m = e.target.value; save(); body(); };
      }
    }
    el.addEventListener('click', e => {
      const h = e.target.closest('[data-fh]'), mc = e.target.closest('[data-mchain]');
      if (h) { st.h = h.dataset.fh; play('click'); save(); draw(); }
      else if (mc) { const x = DORN_MAT.find(m => m[0] === mc.dataset.mchain); showChain(x[1], STATIONS.forge[0] + ' Дорна', x[3], x[4]); }
    });
    draw();
  }
};

/* ======================= БРОННИК: КОНСТРУКТ =======================
   Конструкт не носит броню — он улучшает части тела. Характеристики считаются от каркаса, обшивки и деталей. */
const PART_FX = {
  frame_work: { def: 0 }, frame_light: { mob: 1 }, frame_cast: { kb: 1, mob: -1 }, frame_lum: { kb: 1, mdef: 2 },
  plate1: { def: 1 }, plate2: { def: 2, mdef: 1 }, plate3: { def: 3, kb: 1, mob: -1 }, plate4: { def: 3, mdef: 3, kb: 1 },
  sprint: { mob: 1 }, core3: { mdef: 1 }, cool3: { mdef: 1 }
};
const C_BASE = { def: 0, mdef: 0, kb: 0, mob: 4 };
const C_STATS = [['def', 'Защита', 6], ['mdef', 'Маг. защита', 6], ['kb', 'КБ', 3], ['mob', 'Движение', 6]];
const C_ORDER = ['frame', 'plating', 'core', 'cooling', 'brain', 'eyes', 'ears', 'voice', 'armL', 'armR', 'legs'];

const ConstructArmor = {
  mount(el) {
    const st = Object.assign({ pick: {} }, MH.store.get('carmor', {}));
    const start = () => Object.fromEntries(C_ORDER.map(k => { const p = PARTS.find(x => x[7] && (x[1] === k || (x[1] === 'arm' && k.startsWith('arm')))); return [k, p ? p[0] : '']; }));
    if (!Object.keys(st.pick).length) st.pick = start();
    const save = () => MH.store.set('carmor', st);
    const fits = (p, k) => p[6].includes('c') && (p[1] === k || (p[1] === 'arm' && k.startsWith('arm')));
    el.innerHTML = `<div class="armor"><div class="panel mannequin c-man"><div class="c-fig" id="cFig"></div><span class="corpus-badge" id="cBadge"></span><div class="c-cap" id="cCap"></div></div>
      <div class="panel lit"><div class="bench-top" style="margin-bottom:12px"><div><div class="eyebrow">Конструкт · улучшение частей тела</div><h3 style="margin:4px 0 0">Сборка корпуса</h3></div><button type="button" class="btn small ghost" id="cReset">Стартовый набор</button></div>
        <div class="gauges" id="cG"></div><div class="c-slots" id="cSlots"></div></div></div>
      <p class="note" style="margin-top:18px">Конструкт не носит доспехи — защиту даёт обшивка и каркас. Каждую часть тела меняют на деталь выше тиром: I тир делает любой инженер, II и III — мастерские Талботов по уровню пула фракции. Сумма нагрузки деталей не больше ёмкости ядра. Полный каталог, батареи и правила — в разделе <a href="#body">Протезы и конструкты</a>.</p>`;
    function draw() {
      const cur = { ...C_BASE };
      const used = C_ORDER.map(k => PART_BY[st.pick[k]]).filter(Boolean);
      used.forEach(p => Object.entries(PART_FX[p[0]] || {}).forEach(([k, v]) => cur[k] += v));
      const load = used.reduce((a, p) => a + p[4], 0), cap = CORE_CAP[st.pick.core] || 18;
      q('#cG', el).innerHTML = C_STATS.map(([k, l, max]) => gauge(l, cur[k], C_BASE[k], max)).join('');
      q('#cCap', el).innerHTML = `<div class="bl-meter${load > cap ? ' over' : ''}"><i style="width:${Math.min(100, load / cap * 100)}%"></i><b>Нагрузка ${load} / ${cap}</b></div>${load > cap ? '<p class="minus" style="font-size:12.5px;margin:0">Ядро не тянет: поставь ядро мощнее или сними детали.</p>' : ''}`;
      q('#cFig', el).innerHTML = figHTML('c', st.pick);
      q('#cBadge', el).textContent = (PART_BY[st.pick.frame] || ['', '', 'Каркас'])[2];
      q('#cSlots', el).innerHTML = C_ORDER.map(k => {
        const opts = PARTS.filter(p => fits(p, k)), cur = PART_BY[st.pick[k]];
        return `<div class="slot c-slot${cur ? ' filled' : ''}" data-cslot="${k}"><div class="sl"><span>${BODY_SLOTS[k][0]}</span><span>${BODY_SLOTS[k][1]}</span></div>
          <div class="c-tiers" role="group" aria-label="${BODY_SLOTS[k][0]}">${opts.map(p => `<button type="button" data-cs="${k}" data-cp="${p[0]}" aria-pressed="${st.pick[k] === p[0]}" title="${p[5]}"><b>${TIER_ROMAN(p[3])}</b>${p[2]}${p[4] ? `<small>нагр. ${p[4]}</small>` : ''}</button>`).join('')}</div>
          ${cur ? `<p class="c-eff">${cur[5]}</p>` : ''}</div>`;
      }).join('');
    }
    el.addEventListener('click', e => {
      const fp = e.target.closest('[data-fig]');
      if (fp) { const slot = q(`.c-slot[data-cslot="${fp.dataset.fig}"]`, el); if (slot) { slot.scrollIntoView({ behavior: 'smooth', block: 'center' }); slot.classList.add('flash'); setTimeout(() => slot.classList.remove('flash'), 900); } return; }
      const b = e.target.closest('[data-cp]');
      if (b) { st.pick[b.dataset.cs] = b.dataset.cp; play('click'); save(); draw(); }
      else if (e.target.closest('#cReset')) { st.pick = start(); save(); draw(); }
    });
    draw();
  }
};

const Armor = {
  mount(el) {
    const st = Object.assign({ who: 'l' }, MH.store.get('armorWho', {}));
    el.innerHTML = `<div class="bl-mode" role="radiogroup" aria-label="Кто"><button type="button" data-who="l"><b>Живой персонаж</b><small>Корпус брони и детали: наручи, наплечники, пластина, поножи, накладки</small></button><button type="button" data-who="c"><b>Конструкт</b><small>Брони не носит — улучшает части тела: каркас, обшивку, ядро, руки, ноги</small></button></div><div id="armHost"></div>`;
    const host = q('#armHost', el);
    let hostRef = host;
    function swap() { qa('[data-who]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.who === st.who))); const fresh = document.createElement('div'); fresh.id = 'armHost'; hostRef.replaceWith(fresh); hostRef = fresh; (st.who === 'c' ? ConstructArmor : ArmorLiving).mount(fresh); }
    qa('[data-who]', el).forEach(b => b.onclick = () => { st.who = b.dataset.who; MH.store.set('armorWho', st); play('click'); swap(); });
    swap();
  }
};
window.__mh = () => ({ REG, GATHER, RES, W_REC, M_REC, POTIONS, DISHES, setKey, depthOf, extra: [...PARTS.map(partRec).filter(Boolean), ...CONSTRUCT_CONS.map(c => c[3]), ...DORN_MAT.map(m => m[3])] });
window.__craftItems = craftItems; window.Gathering = Gathering; window.Blueprints = Blueprints; window.Crystal = Crystal; window.Inventor = Inventor; window.SPELL_COST = SPELL_COST; window.RECHARGE = RECHARGE; window.CRYSTAL_RULES = CRYSTAL_RULES; window.Tree = Tree; window.Forge = Forge; window.Armor = Armor; window.Craft = Craft; window.Recycler = Recycler; window.Eloquence = Eloquence; window.Alchemy = Alchemy; window.Cooking = Cooking; window.Healing = Healing; window.BodyLab = BodyLab; window.CurseLab = CurseLab; window.Factions = Factions;
})();
