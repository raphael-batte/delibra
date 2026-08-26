/* ==========================================================================
   SDM — section authoring layer.

   Markup builders (cover, prod, perk, step, …) and section definitions live
   here. This is LOGIC, so it belongs in the repo, not in the brand package:
   packages hold data and metadata only; otherwise opening a shared storybook
   would mean running someone else's code.

   Edit here, then run:
       node tools/emit-sections.js sdm
   Output lands in $DELIBRA_DATA/<brand>/sections.json (or brands/<brand>/ if present).

   Catalog rows (btnRow / tileRow / specRow) stay out of here — that chrome is
   engine-owned via the `rows` descriptor; baking it into every package would
   be wrong.
   ========================================================================== */
'use strict';

module.exports = function () {

  /* Only engine helper used here — flex row for small specimens like badges.
     Everything below is brand-specific markup. */
  var row = require('../../packages/engine/rows.js').row;



  function check(text) {
    return '<div class="check"><span class="ic"></span>' + text + '</div>';
  }

  function checks() {
    return check('Открытие и обслуживание') +
           check('Платежи внутри Банка') +
           check('Платежи физическим лицам');
  }

  function prod(mod, art, title, items, cta) {
    return '<div class="product ' + mod + '" data-pick=".product.' + mod + '">' +
      '<div class="art"><img src="assets/img/' + art + '" alt=""></div>' +
      '<h3>' + title + '</h3>' +
      '<div class="price-list">' + items.map(check).join('') + '</div>' +
      '<a href="#" class="btn btn-outline">' + cta + '</a>' +
    '</div>';
  }

  /* Структура повторяет js/components/priceCard.js: верхняя группа обёрнута
     в <div>, поэтому между группами работает gap карточки, а внутри группы —
     маргины у названия и цены. */
  function priceCard(name, amount, per, items, center) {
    return '<div class="price-card' + (center ? ' is-center' : '') + '" data-pick=".price-card' +
      (center ? '.is-center' : '') + '">' +
      '<div>' +
        '<div class="top"><img class="picon" src="assets/icons/pack-i-start.svg" alt="">' +
          '<span class="badge free">Бесплатный</span></div>' +
        '<h3 class="price-name">' + name + '</h3>' +
        '<p class="price-amount">' + amount + ' <span>/ ' + per + '</span></p>' +
      '</div>' +
      '<h4>Что входит</h4>' +
      '<div class="price-list">' + items.map(check).join('') + '</div>' +
      '<div class="price-cta"><a href="#" class="btn btn-primary">Активировать</a></div>' +
    '</div>';
  }

  function service(icon, title, text) {
    return '<a href="#" class="service" data-pick=".service">' +
      '<div class="service__main">' +
        '<span class="icon-tile"><img src="assets/icons/' + icon + '" alt=""></span>' +
        '<h3>' + title + '</h3><p>' + text + '</p>' +
      '</div><span class="arrow">→</span></a>';
  }

  function newsCard(title, date) {
    return '<article class="news" data-pick=".news"><div><h3>' + title + '</h3>' +
      '<div class="date">' + date + '</div></div><span class="arrow">→</span></article>';
  }

  function perk(mod, icon, title, text, metal) {
    var cls = ('perk ' + (mod || '')).trim();
    var tile = 'icon-tile' + (metal ? ' icon-tile--metal' : '');
    return '<div class="' + cls + '" data-pick=".perk">' +
      '<span class="' + tile + '"><img src="assets/icons/' + icon + '" alt=""></span>' +
      '<h3>' + title + '</h3><p>' + text + '</p></div>';
  }

  /* Настоящая разметка обложки из ui2026/app/index.html:271.
     Фон приходит инлайново из данных слайда — так же, как на сайте
     (js/data/hero.js → heroCarousel.js), а не классом. */
  function cover(bg, title, lead, art, dark, split) {
    var cls = 'hero g-inset' + (split ? ' hero--split' : '') +
              (dark ? ' card--dark card--dark-plain' : '');
    // тёмная и split задают фон классом, остальным он приходит из данных слайда
    var style = bg ? ' style="background-color:' + bg + '"' : '';
    return '<section class="' + cls + '"' + style +
      ' data-pick="' + (dark ? 'Тёмная обложка' : '.hero') + '">' +
      '<div class="container hero-shell">' +
        '<div class="hero-top"><div class="hero-intro">' +
          '<div class="hero-text">' +
            '<h1>' + title + '</h1>' +
            '<p class="hero-lead">' + lead + '</p>' +
          '</div>' +
          '<div class="hero-actions">' +
            '<a href="#" class="btn btn-primary">Заполнить заявку</a>' +
            '<a href="#" class="btn btn-outline">Открыть счет</a>' +
          '</div>' +
        '</div></div>' +
        '<div class="hero-bottom"><div class="hero-visual"><div class="hero-art">' +
          '<div class="hero-art__scene">' +
            '<img class="hero-art__cover" src="assets/img/' + art + '" alt="">' +
          '</div>' +
        '</div></div></div>' +
      '</div>' +
    '</section>';
  }


  function step(n, title, text, badge, arrow) {
    return '<div class="step" data-pick=".step">' +
      '<div class="step-head"><span class="icon-tile num">' + n + '</span>' +
        (badge ? '<span class="step-badge">' + badge + '</span>' : '') +
      '</div>' +
      '<h3>' + title + '</h3><p>' + text + '</p>' +
      (arrow ? '<span class="step-arrow" aria-hidden="true">→</span>' : '') +
    '</div>';
  }

  function acc(title, open, body) {
    return '<div class="docs-acc__item' + (open ? ' is-open' : '') + '" data-pick=".docs-acc__item">' +
      '<button type="button" class="docs-acc__head" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="docs-acc__title">' + title + '</span>' +
        '<span class="docs-acc__icon" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="docs-acc__body"><div class="docs-acc__body-inner">' + body + '</div></div>' +
    '</div>';
  }

  function field(label, control) {
    return '<div class="field" style="margin-bottom:16px">' +
      '<span class="field__label">' + label + '</span>' + control + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════
     СЕКЦИИ КОМПОНЕНТОВ
     ══════════════════════════════════════════════════════════════════════ */
  return [
{
    id: 'buttons', group: 'Примитивы', title: 'Кнопки', code: '.btn',
    desc: 'Высоты: sm 40/40 · med 48/52 · lg 48/64. На мобайле .btn-lg схлопывается до .btn.',
    examples: [
      { label: 'Primary — три размера', mobileWidth: 900,
        rows: [
          { kind: 'btn', size: 'SM',  cls: '.btn-sm.btn-primary', text: 'Войти',                    heights: '40 / 40' },
          { kind: 'btn', size: 'MED', cls: '.btn-primary',        text: 'Открыть счет',             heights: '48 / 52' },
          { kind: 'btn', size: 'LG',  cls: '.btn-lg.btn-primary', text: 'Открыть счет в СДМ-Банке', heights: '48 / 64' }
        ] },
      { label: 'Outline — три размера', mobileWidth: 900,
        note: 'Те же высоты, кольцо inset 2px --blue вместо заливки.',
        rows: [
          { kind: 'btn', size: 'SM',  cls: '.btn-sm.btn-outline', text: 'Войти',         heights: '40 / 40' },
          { kind: 'btn', size: 'MED', cls: '.btn-outline',        text: 'Узнать больше', heights: '48 / 52' },
          { kind: 'btn', size: 'LG',  cls: '.btn-lg.btn-outline', text: 'Узнать больше', heights: '48 / 64' }
        ] },
      { label: 'Инверсия на тёмной обложке — те же три размера', mobileWidth: 900,
        note: 'Превью под шапкой панели — тёмное (--g-surface-dark, по умолчанию #333). ' +
              'Контекст .card--dark на кадре инвертирует кнопки: primary белая, outline с белым кольцом.',
        surface: 'dark',
        rows: [
          { kind: 'btn', size: 'SM',  cls: '.btn-sm.btn-primary', text: 'Войти',                    heights: '40 / 40' },
          { kind: 'btn', size: 'MED', cls: '.btn-primary',        text: 'Оставить заявку',          heights: '48 / 52' },
          { kind: 'btn', size: 'LG',  cls: '.btn-lg.btn-primary', text: 'Открыть счет в СДМ-Банке', heights: '48 / 64' },
          { kind: 'gap', size: 8 },
          { kind: 'btn', size: 'SM',  cls: '.btn-sm.btn-outline', text: 'Войти',         heights: '40 / 40' },
          { kind: 'btn', size: 'MED', cls: '.btn-outline',        text: 'Подробнее',     heights: '48 / 52' },
          { kind: 'btn', size: 'LG',  cls: '.btn-lg.btn-outline', text: 'Узнать больше', heights: '48 / 64' }
        ] }
    ]
  },

  {
    id: 'badges', group: 'Примитивы', title: 'Бейджи', code: '.badge',
    desc: 'Высота 32, радиус 20, вес 700. Размер 12 на мобайле, 14 на десктопе.',
    examples: [
      { label: 'Варианты',
        html: row([
          '<span class="badge free" data-pick=".badge.free">Бесплатный</span>',
          '<span class="badge reco" data-pick=".badge.reco">Рекомендуем</span>',
          '<span class="badge ip" data-pick=".badge.ip">Для ИП</span>'
        ]) }
    ]
  },

  {
    id: 'check', group: 'Примитивы', title: 'Чек-лист', code: '.check',
    desc: 'Галочка — CSS-маска, тонируется background-color, поэтому в тёмном контексте белеет сама.',
    examples: [
      { label: 'Светлый и тёмный контекст',
        html: '<div class="price-list" data-pick=".price-list">' + checks() + '</div>' +
              '<div class="card card--dark card--dark-slate" style="margin-top:16px" data-pick="Тёмный контекст">' +
              '<div class="price-list">' + checks() + '</div></div>' }
    ]
  },

  {
    id: 'icon-tiles', group: 'Примитивы', title: 'Иконки и плитки', code: '.icon · .icon-tile',
    desc: 'Иконка 24/36 — и отдельно, и в плитке. Плитки: малая 44, обычная 52/72, числовая 56/72. Плитка под иконку белая, металл только у цифр.',
    examples: [
      { label: 'Четыре типа', mobileWidth: 900,
        rows: [
          { kind: 'tile', name: 'Иконка без плитки', cls: '.icon', meta: 'M 24 · D 36',
            sample: '<img class="icon" src="assets/icons/i-h02.svg" alt="">' },
          { kind: 'tile', name: 'Малая плитка', cls: '.icon-tile.icon-tile--sm', meta: 'M 44 · D 72 (= обычной)',
            sample: '<span class="icon-tile icon-tile--sm"><img src="assets/icons/i-case.svg" alt=""></span>' },
          { kind: 'tile', name: 'Обычная плитка', cls: '.icon-tile', meta: 'M 52 · D 72 · иконка 24 / 36',
            sample: '<span class="icon-tile"><img src="assets/icons/i-h03.svg" alt=""></span>' },
          { kind: 'tile', name: 'Металлическая', cls: '.icon-tile.icon-tile--metal', meta: 'ангуляр-градиент --metal',
            sample: '<span class="icon-tile icon-tile--metal"><img src="assets/icons/i-sm-01.svg" alt=""></span>' },
          { kind: 'tile', name: 'Числовая', cls: '.icon-tile.num', meta: 'плитка M 56 · D 72 · цифра 24/700 · 36/700',
            sample: '<span class="icon-tile num">1</span><span class="icon-tile num">2</span><span class="icon-tile num">3</span>' }
        ] }
    ]
  },

  {
    id: 'togglers', group: 'Примитивы', title: 'Переключатели', code: '.toggle · .seg',
    desc: '.toggle — фильтр-чипы, активный уходит в --dark-toggle. .seg — трек с подложкой, он же радиогруппа.',
    examples: [
      { label: '.toggle — фильтры',
        note: 'На мобайле чипы не переносятся, а едут вбок — обёртка .scroll-bleed, как на сайте.',
        html: '<div class="scroll-bleed"><div class="togglers" data-pick=".togglers">' +
          '<button class="toggle active">Рекомендуем</button>' +
          '<button class="toggle">Начинающим</button>' +
          '<button class="toggle">ИП</button>' +
          '<button class="toggle">Эквайринг</button>' +
          '<button class="toggle">Много платежей</button>' +
        '</div></div>' },
      { label: '.seg — радиогруппа (Физические / Юридические лица)',
        html: '<div class="seg" data-pick=".seg">' +
          '<button>Физические лица</button><button class="active">Юридические лица</button></div>' }
    ]
  },

  {
    id: 'inputs', group: 'Примитивы', title: 'Поля ввода', code: '.input · .textarea',
    note: 'нового в styles.css нет',
    desc: 'В styles.css инпутов нет вовсе — спека с листа «2 / Components». Высота 56/64, радиус 8.',
    examples: [
      { label: 'Состояния поля',
        note: 'Focus показан подставленным кольцом — кликните в первое поле, чтобы увидеть настоящий.',
        html:
          field('Default', '<input class="input" placeholder="ФИО контактного лица" data-pick=".input">') +
          field('Focus',   '<input class="input" placeholder="ФИО контактного лица" ' +
                           'style="box-shadow:var(--input-ring-focus)" data-pick=".input:focus">') +
          field('Filled',  '<input class="input" value="Иванов Сергей Петрович" data-pick=".input (filled)">') +
          field('Error',   '<input class="input is-error" value="ivanov@" data-pick=".input.is-error">' +
                           '<span class="field__error">Проверьте адрес почты</span>') },
      { label: 'Многострочное поле',
        html: field('Textarea', '<textarea class="textarea" placeholder="Краткое описание предложения" data-pick=".textarea"></textarea>') }
    ]
  },

  /* ───────────────────────── БЛОКИ ────────────────────────────────── */
  {
    id: 'steps', group: 'Блоки', title: 'Онбординг / шаги', code: '.steps · .step',
    desc: 'Фон --card-blue, min-height 276 на десктопе. Бейдж «2 минуты» в шапке первого шага, стрелка — только на мобайле.',
    examples: [
      { label: 'Три шага + CTA', wide: false,
        html: '<div class="steps is-revealed" data-pick=".steps">' +
          step(1, 'Заполнить заявку', 'Заполните заявку или закажите обратный звонок', '2 минуты', true) +
          step(2, 'Подпишите договор', 'Онлайн или офлайн') +
          step(3, 'Начинайте принимать платежи', 'Пользуйтесь сервисом') +
        '</div>' +
        '<div class="center-btn"><a href="#" class="btn btn-primary btn-lg">Открыть счет в СДМ-Банке</a></div>' }
    ]
  },

  {
    id: 'faq', group: 'Блоки', title: 'FAQ / аккордеон', code: '.docs-acc',
    desc: 'На сайте это «Тарифы и документы» (.docs-acc). Раскрытие через grid-template-rows 0fr → 1fr, без JS-замеров высоты.',
    examples: [
      { label: 'Открытый и закрытый пункт',
        html: '<div class="docs-acc" data-pick=".docs-acc">' +
          acc('Где можно узнать больше о страховании вкладов', true,
              '<p class="docs-acc__text">Самостоятельно проверить участие кредитной организации можно через ' +
              'открытый перечень банков на сайте АСВ. Фонд обязательного страхования вкладов формируется ' +
              'из регулярных перечислений банков.</p>' +
              '<a class="docs-acc__link" href="#">Перейти на сайт АСВ →</a>') +
          acc('Как посмотреть реестр', false, '<p class="docs-acc__text">Содержимое второго пункта.</p>') +
          acc('Тарифы на расчетно-кассовое обслуживание', false,
              '<ul class="docs-acc__list">' +
              '<li class="docs-acc__line">Тарифы на РКО юридических лиц и ИП (с 22.06.2026)</li>' +
              '<li class="docs-acc__line">Заявление об открытии счета</li>' +
              '<li class="docs-acc__line">Доверенность</li></ul>') +
        '</div>' }
    ]
  },

  {
    id: 'banner', group: 'Блоки', title: 'Баннер', code: '.cta-band',
    desc: 'Десктоп — строка с иллюстрацией справа. Мобайл — колонка, арт наверх, кнопка на всю ширину.',
    examples: [
      { label: 'Не можете определиться с пакетом?',
        html: '<div class="cta-band" data-pick=".cta-band">' +
          '<div><h3>Не можете определиться с пакетом?</h3>' +
          '<p>Задайте параметры, и мы подберём выгодный тариф под ваши цели</p>' +
          '<a href="#" class="btn btn-outline">Открыть помощника</a></div>' +
          '<div class="cta-art"><img src="assets/banner-bubbles.svg" alt=""></div>' +
        '</div>' }
    ]
  },

  {
    id: 'product-cards', group: 'Блоки', title: 'Карточки продуктов', code: '.product',
    desc: 'Паддинг 32/32/48/32, радиус 24, арт 150. Ширина фиксированная: 379 на десктопе, 330 на мобайле.',
    examples: [
      { label: 'Карточка продукта',
        note: 'Тинт задаётся модификатором p1–p5 из палитры — сами тинты показаны в разделе «Цвета».',
        html: prod('p1', 'i-banner01.svg', 'Интернет эквайринг',
               ['Можно работать без сайта', 'Готовые решения для CMS', 'Встроенное решение с фискализацией'],
               'Узнать больше') }
    ]
  },

  {
    id: 'price-cards', group: 'Блоки', title: 'Карточки пакетов', code: '.price-card',
    desc: 'Активная (.is-center) — не тень, а градиентный бордер через background-clip. Ширина 379/330.',
    examples: [
      { label: 'Обычная и активная',
        note: 'Активная (.is-center) отличается только градиентным бордером — состояние, а не отдельный компонент.',
        html: '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:780px">' +
          priceCard('Стартовый', '0 ₽', 'мес',
            ['Открытие и обслуживание', 'Платежи внутри Банка', 'Платежи физическим лицам']) +
          priceCard('Оптимальный', 'от 0 ₽', 'мес',
            ['Комиссия за эквайринг', '10 онлайн расписаний', '11,5 ₽/уведомление'], true) +
        '</div>' }
    ]
  },

  {
    id: 'content-cards', group: 'Блоки', title: 'Контентные карточки', code: '.service',
    desc: 'В ДС «Content cards», в коде .service. Паддинг 24/24/32/24, радиус 24.',
    examples: [
      { label: 'Контентная карточка',
        note: 'Показана в своей сетке .grid--3 — ширина колонки настоящая, плашка не тянется.',
        html: '<div class="grid grid--3">' +
          service('i-01.svg', 'СДМ-Эквайринг', 'Система отчетов по эквайрингу') +
        '</div>' }
    ]
  },

  {
    id: 'news', group: 'Блоки', title: 'Новости', code: '.news',
    desc: 'Десктоп: 4 колонки, min-height 246, паддинг 32. Мобайл: лента вбок, карточка 300, min-height 200.',
    examples: [
      { label: 'Карточка новости',
        note: 'Показана в своей сетке: на десктопе .press — 4 колонки, на мобайле лента ' +
              '.press-scroll с карточками по 300px.',
        html: '<div class="press-scroll"><div class="press">' +
          newsCard('СДМ-Банк повысил ставки по вкладам', '12 августа 2026') +
          newsCard('Обновление интернет-банка для бизнеса', '5 августа 2026') +
        '</div></div>' }
    ]
  },

  {
    id: 'perks', group: 'Блоки', title: 'Перк', code: '.perk',
    desc: '.feature и .perk — один компонент, в правилах остаётся .perk. Ширина 379 на десктопе, 250 на мобайле.',
    examples: [
      { label: 'Перк',
        html: '<div class="perks">' +
          perk('', 'i-ban-01.svg', 'Персональный менеджер', 'Один контакт на все вопросы') +
        '</div>' },
      { label: 'Перк с металлическим плейсхолдером',
        note: 'Та же карточка, но у плитки иконки конический градиент --metal вместо белой подложки.',
        html: '<div class="perks">' +
          perk('', 'i-ban-01.svg', 'Персональный менеджер', 'Один контакт на все вопросы', true) +
        '</div>' }
    ]
  },

  {
    id: 'covers', group: 'Блоки', title: 'Обложки', code: '.hero',
    desc: 'Десктоп 768, шелл pt118/pb24, арт до 522×380. Мобайл 680, паддинг 96/16/32, арт до 310×300. Фон приходит из данных слайда, а не из класса.',
    examples: [
      /* 422 = 390 телефона + 32 на отступ и рамку песочницы: сама обложка
         получает ровно 390, как на устройстве, и при этом видна как компонент */
      { label: 'Обложка главной — арт по центру снизу', mobileWidth: 422,
        note: 'Текст центрирован, визуал 440×320 под ним. Фон приходит из данных слайда, ' +
              'а не из класса — четыре тинта главной показаны в разделе «Цвета».',
        html: cover('#DCD7E6', 'Бесплатный эквайринг для вашего бизнеса',
                    'Честный 0% комиссии и честные 6 месяцев', 'c-o1-big.svg') },
      { label: 'Обложка пакетов — арт справа (.hero--split)', mobileWidth: 422,
        note: 'На десктопе шелл становится рядом 1170×360: текст слева, визуал 331×360 справа. ' +
              'На мобайле вариант совпадает с обычной обложкой — колонка, арт снизу.',
        html: cover(null, 'Открыть расчетный счет', 'Индивидуальный подход к вашему бизнесу',
                    'hero-packages.svg', false, true) },
      { label: 'Тёмная обложка', mobileWidth: 422,
        note: 'Есть в ДС, в styles.css отсутствует — собрана контекстом .card--dark.',
        html: cover(null, 'Торговый эквайринг', 'Честный 0% комиссии · Честные 6 месяцев',
                    'c-o4-big.svg', true) }
    ]
  }

  ];

  /* Бренд объявляет только свои компоненты. Секции токенов собирает движок
     из token-map.js и ставит их перед этими — порядок групп в сайдбаре
     задаётся composition в gallery.js, а не сортировкой. */

};
