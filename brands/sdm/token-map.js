/* ==========================================================================
   SDM — дескриптор токен-секций.
   Только данные: какие группы, какие токены, какие подписи. Разметку рисует
   движок (packages/engine/engine-specs.js). Благодаря этому палитру SDM
   можно будет отдать файлом, не отдавая исполняемый код.
   ========================================================================== */
window.BRAND_TOKENS = {

  colors: {
    group: 'Токены', title: 'Цвета', code: 'tokens.css §1–6',
    desc: 'Семь светлых тинтов и семь тёмных. Минта в палитре нет — #BCE3ED остался в styles.css. Нижняя строка свотча говорит, что сейчас в коде.',
    groups: [
      { title: '1. Brand', swatches: [
        ['--blue', 'Primary', 'CTA · футер · брендбар'],
        ['--blue-hero', 'Hover', 'btn-primary:hover · nav'],
        ['--blue-accent', 'Accent', 'ссылки · фокус'],
        ['--blue-light', 'Light tint', 'мягкий брендовый фон']
      ]},
      { title: '2. Text', swatches: [
        ['--text-heading', 'Heading', 'заголовки карточек'],
        ['--text-primary', 'Body', 'параграфы'],
        ['--text-muted', 'Muted', 'подписи · мета'],
        ['--text-on-dark', 'On dark', 'текст на тёмном'],
        ['--text-brand', 'Brand text', 'outline-кнопки'],
        ['--text-success', 'Success', '.badge.free'],
        ['--text-error', 'Error', 'валидация']
      ]},
      { title: '3. Backgrounds', swatches: [
        ['--bg', 'Page', 'body'],
        ['--white-pure', 'White', 'кнопки · оверлеи'],
        ['--white', 'Surface', 'альт. поверхность'],
        ['--card-gray', 'Card gray', '.news · .service · .price-card'],
        ['--card-gray-2', 'Card gray-2', 'вторичные плитки'],
        ['--hero-light-bg', 'Hero light', 'фон hero'],
        ['--hero-packages-bg', 'Packages hero', '.perk--a'],
        ['--border-hairline', 'Header line', 'мобильный хедер'],
        ['--green-bg', 'Green bg', 'фон .badge.free']
      ]},
      { title: '4. UI elements', swatches: [
        ['--border', 'Border', 'инпуты · .toggle'],
        ['--dark-toggle', 'Dark toggle', '.toggle.active']
      ]},
      { title: '5. Card tints — light', swatches: [
        ['--card-slate',  'Slate',  '.product.p5'],
        ['--card-blue',   'Blue',   '.step'],
        ['--card-indigo', 'Indigo', '.product.p4'],
        ['--card-lilac',  'Lilac',  '.product.p2'],
        ['--card-teal',   'Teal',   '.product.p3'],
        ['--card-peach',  'Peach',  '.product.p1'],
        ['--card-rose',   'Rose']
      ]},
      { title: '6. Card tints — dark', swatches: [
        ['--card-slate-dark', 'Slate dark'], ['--card-blue-dark', 'Blue dark'],
        ['--card-indigo-dark', 'Indigo dark'], ['--card-lilac-dark', 'Lilac dark'],
        ['--card-teal-dark', 'Teal dark'], ['--card-peach-dark', 'Peach dark'],
        ['--card-rose-dark', 'Rose dark'], ['--card-dark', 'Dark bg']
      ]}
    ],
    gradients: { title: '7. Градиенты', items: [
      ['--featured-pkg-border', 'Featured pkg', 'рамка активной карточки пакета'],
      ['--lilac-grad', 'Lilac', '.badge.reco · рамка FAQ и поиска'],
      ['--metal', 'Metal', '.icon-tile.num · .icon-tile--metal']
    ]}
  },

  radii: {
    group: 'Токены', title: 'Радиусы', code: '--r-*',
    desc: 'Десктоп: sm 12 · md 24 · pill 40 · btn 48. Мобайл: dot 4 · card 16 · badge 20 · btn 48.',
    scale: ['--r-4', '--r-6', '--r-8', '--r-12', '--r-16', '--r-20', '--r-24', '--r-40', '--r-48'],
    semantic: [
      ['--r-card', 'карточки'], ['--r-icon', '.icon-tile'], ['--r-badge', '.badge'],
      ['--r-input', 'инпуты'], ['--r-pill', '.toggle'], ['--r-btn', '.btn'], ['--r-dot', 'точки']
    ]
  },

  shadows: {
    group: 'Токены', title: 'Тени и кольца', code: '--shadow-* · --ring-*',
    desc: 'Drop-shadow в системе всего два. Рамки бывают двух видов: inset-кольцо сплошным цветом и градиентная через background-clip.',
    drop: [
      ['--shadow-card', 'Card', 'активная карточка в карусели'],
      ['--shadow-overlay', 'Overlay', '.mega-inner · .mini-inner'],
      ['--shadow-hairline', 'Hairline', 'sticky-бар в залипании']
    ],
    rings: [
      ['--ring', 'Brand ring', '.btn-outline'],
      ['--ring-border', 'Border ring', '.toggle · .pkg-compare__labels'],
      ['--ring-on-dark', 'On dark', 'мобильное меню', true]
    ],
    gradientBorders: [
      ['--featured-pkg-border', 'активная карточка пакета'],
      ['--lilac-grad', 'раскрытый пункт FAQ · поисковая строка']
    ]
  },

  blur: {
    group: 'Токены', title: 'Размытие', code: 'backdrop-filter',
    desc: 'Размывается подложка под оверлеями. Два значения: 100 — хедер и мега-меню, 50 — мобильное меню и диалог поиска.',
    rows: [
      ['--blur-header',  '.header · мега-меню'],
      ['--blur-overlay', 'мобильное меню · диалог поиска']
    ]
  },

  typography: {
    group: 'Токены', title: 'Типографика', code: '--font-*',
    desc: 'Шкала из свёрстанных макетов. Веса: 400 текст · 500 кнопки и навигация · 600 заголовки и цены · 700 цифры, бейджи, шаги.',
    pangram: 'Съешь ещё булок',
    /* Кнопки не попадают в специмен: их размер читается в разделе размеров,
       а в шкале они дублировали бы соседние строки. */
    specimenSkip: ['--font-btn'],
    weights: [
      ['400', 'Regular', 'тело, лид, подписи, ссылки меню'],
      ['500', 'Medium', 'кнопки, навигация, тогглеры, ссылки в FAQ'],
      ['600', 'Semi Bold', 'заголовки, карточки, цены'],
      ['700', 'Bold', 'цифры, бейджи, активная навигация, шаги']
    ],
    /* [ подпись, префикс токена, где применяется, вес ]
       Вес задан явно: у части стилей собственного токена веса нет. */
    scale: [
      ['H1',                '--font-h1',          '.hero h1', 600],
      ['Hero lead',         '--font-hero-lead',   '.hero-lead — 18px на обоих брейкпоинтах', 400],
      ['H2',                '--font-h2',          '.section-head h2', 600],
      ['H3',                '--font-h3',          '.product h3 · .service h3 · .perk h3 · .step h3 (700)', 600],
      ['Заголовок блока',   '--font-block-title', '.docs-acc__title', 600],
      ['Card',              '--font-card',        '.news h3 · .price-card h4', 600],
      ['CTA',               '--font-cta',         '.cta-band h3', 600],
      ['Цена',              '--font-price',       '.price-name', 600],
      ['Body L',            '--font-body-l',      '.check · .service p · .step p · тексты FAQ', 400],
      ['Body',              '--font-body',        'основной текст · .news .date', 400],
      ['Caption',           '--font-caption',     'мета', 400],
      ['Бейдж',             '--font-caption',     '.badge · .step-badge — тот же размер, вес 700', 700],
      ['Button',            '--font-btn',         '.btn в обложке', 500],
      ['Button (карточка)', '--font-btn-card',    '.btn в .product · .price-cta · .cta-band', 500],
      ['Цифра',             '--font-num',         '.icon-tile.num', 700]
    ],
    note: 'Шкала собрана из свёрстанных HTML-макетов и сверена с блоками в Figma. ' +
          'В <code>styles.css</code> семантических токенов типографики нет — размеры вписаны ' +
          'прямо в правила компонентов, а мобильные живут отдельным набором ' +
          '<code>--m-fs-*</code> / <code>--m-lh-*</code>. Это и чинит <code>sdm.css</code>: ' +
          'одно имя работает на обоих брейкпоинтах.'
  },

  sizes: {
    group: 'Токены', title: 'Размеры компонентов', code: '--btn-* · --input-* · --toggle-*',
    desc: 'Каждый размер на обоих брейкпоинтах. Подсветка в колонке Desktop — значение там меняется.',
    groups: [
      { title: 'Кнопки', note: '— на мобайле .btn-lg схлопывается до высоты .btn', rows: [
        ['--btn-h', 'высота .btn'], ['--btn-px', 'горизонтальный паддинг'],
        ['--btn-r', 'радиус'], ['--btn-gap', 'зазор с иконкой'],
        ['--btn-lg-h', 'высота .btn-lg'], ['--btn-lg-px', ''], ['--btn-lg-r', ''],
        ['--btn-sm-h', 'высота .btn-sm / .login'], ['--btn-sm-px', ''], ['--btn-sm-r', '']
      ]},
      { title: 'Поля ввода', rows: [
        ['--input-h', 'высота .input'], ['--input-px', ''], ['--input-r', ''],
        ['--input-fs', 'размер текста'], ['--textarea-min-h', 'минимальная высота .textarea']
      ]},
      { title: 'Переключатели', rows: [
        ['--toggle-h', '.toggle'], ['--toggle-px', ''], ['--toggle-py', 'вертикальный паддинг трека'],
        ['--toggle-fs', ''], ['--seg-h', '.seg'], ['--seg-px', ''], ['--seg-fs', '']
      ]},
      { title: 'Плитки, бейджи, шапка', rows: [
        ['--icon-tile', '.icon-tile'], ['--icon-tile-r', ''],
        ['--badge-h', '.badge'], ['--badge-px', ''], ['--badge-py', ''], ['--badge-fs', ''],
        ['--header-h', 'высота хедера'], ['--search-h', '.searchbar']
      ]},
      { title: 'Отступы и раскладка', rows: [
        ['--gutter', 'боковой отступ .container'],
        ['--container', 'максимальная ширина'],
        ['--card-gap', 'зазор в сетке карточек'],
        ['--card-3col', 'ширина карточки в 3 колонки'],
        ['--card-pad', '.step · .perk · .service'],
        ['--card-pad-lg', '.news · .price-card · .product · .docs-acc'],
        ['--card-pad-b', 'нижний паддинг .product'],
        ['--section-pt', 'верх секции'], ['--section-gap', ''], ['--section-pb', 'низ секции']
      ]}
    ],
    spacingTitle: 'Шкала отступов',
    spacingScale: ['--gap-2','--gap-4','--gap-8','--gap-12','--gap-16','--gap-24','--gap-32','--gap-40','--gap-48']
  }
};
