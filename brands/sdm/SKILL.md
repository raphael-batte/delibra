---
name: sdm-verstak
description: >
  Pixel-perfect верстка экранов и компонентов SDM-банка по Figma-макетам.
  Используй когда нужно сверстать страницу, секцию, карточку или компонент
  по макету SDM. Триггеры: «сверстай», «сделай по макету», «добавь секцию»,
  «сверстай карточку», «по дизайну».
---

# SDM Verstak Skill

Верстай точно по Figma-макету, используя существующие токены и классы из `styles.css`.
Не изобретай новые токены, классы или цвета — если нет точного матчинга, предложи варианты.

---

## 0. Перед началом работы

1. Проверь Figma MCP: `list_files` → убедись что `SDM-website` подключён
2. Прочитай `sdm/design system/tokens.css` — это источник правды для токенов
3. Прочитай нужную секцию `ui2026/app/styles.css` — там реальные классы
4. `get_node` или `get_selection` → получи размеры, отступы, цвета из Figma
5. `get_screenshot` → сравни результат с референсом

---

## 1. Breakpoints

```
≤ 900px  — mobile   (styles.css: @media (max-width: 900px))
≥ 901px  — desktop  (default, desktop-first)
```

Верстка desktop-first. Один `@media (max-width: 900px)` в конце файла.
Мобильные токены имеют префикс `--m-*`.

---

## 2. Canonical token names

### Цвета бренда
```css
--blue:          #012B5D   /* primary CTA, footer, brand */
--blue-hero:     #041D3C   /* btn:hover, nav dark */
--blue-accent:   #0094FF   /* links, focus ring */
--blue-light:    #D9ECFB   /* soft brand bg */
```

### Текст
```css
--text:          #333333   /* основной текст (в коде — --text, не --text-primary) */
--muted:         #757575   /* подписи, мета */
--black:         #000000   /* заголовки карточек */
--white-pure:    #FFFFFF   /* текст на тёмном */
```

> ⚠️ В `styles.css` используется `--text` и `--muted`, не `--text-primary`/`--text-muted` из `tokens.css`.
> `tokens.css` — Figma-экспорт, `styles.css` — боевой код. При конфликте — `styles.css` главнее.

### Фоны
```css
--bg:            #FBFCFD   /* body */
--white:         #FBFBFB   /* альт. поверхность */
--card-gray:     #F3F5F8   /* .news, .service, .price-card default */
--card-gray-2:   #EBF1F8   /* вторичные серые плитки */
```

### Card tints (ТЕКУЩИЕ в вёрстке — статус: расхождение с Figma)
```css
/* ⚠️ Эти значения из styles.css, NOT из tokens.css */
--card-beige:  #F8E5D1   /* .product.p1 */
--card-lilac:  #CBCFE7   /* .product.p2 */
--card-mint:   #BCE3ED   /* .product.p3, .feature.d */
--card-sky:    #D6E2FB   /* .product.p4 */
--card-blue:   #CDE1F4   /* .badge.ip, togglers, price-card */
--card-teal:   #B2C4C9   /* резервный */

/* Figma-токены (новые страницы) — пока НЕ применены в вёрстке */
--card-slate:  #B3C0D0
--card-peach:  #FAE4D5   /* ближайший к --card-beige */
--card-indigo: #DDE8FD
--card-teal-f: #ABD4D2   /* Figma teal, ≠ --card-teal в коде */
--card-rose:   #E7B9B4
```

**Статус матчинга тинтов: ❌ не решён.** При вёрстке новых карточек с тинтами —
предложи 3 варианта (см. раздел «Протокол несоответствий»).

### Тёмные обложки карточек
```css
--card-slate-dark:   #001C3E
--card-blue-dark:    #012B5D
--card-indigo-dark:  #21202E
--card-lilac-dark:   #0D2524
--card-teal-dark:    #232027
--card-peach-dark:   #3A161A
--card-rose-dark:    #3A161A
--card-dark:         #1F1F23
```

### UI-элементы
```css
--border:       #D5DBE8
--dark-toggle:  #1F1F23
--green:        #17AA26   /* .badge.free */
--green-bg:     #DEEFBE
```

### Радиусы
```css
--r-4:   4px
--r-8:   8px
--r-sm:  12px   /* иконки, скруглённые углы */
--r-16:  16px   /* мобильные карточки */
--r-md:  24px   /* все карточки desktop */
--r-pill: 40px  /* кнопки, тогглеры */
--r-48:  48px   /* .btn-lg */
```

---

## 3. Компоненты — классы и токены

### Кнопки

```css
/* Base */
.btn            h52 r40 px24 fs16/600   (desktop)
                h48 r40 px24 fs15/600   (mobile — --m-btn-*)

/* Variants */
.btn-primary    bg:--blue  color:#fff   hover:--blue-hero
.btn-outline    transparent  box-shadow: inset 0 0 0 2px --blue  color:--blue

/* Sizes */
.btn-lg         h64 r48 px32 fs18       (desktop)
                h52 r40 px24 fs16       (mobile)
.btn (default)  h52 px24 fs16           (desktop)
.login / .btn-sm h40 r40 px16 fs15/600  (desktop+mobile)
```

**Правило тёмной обложки:** на `.card--dark` кнопки инвертируются:
- `.btn-primary` → `bg:#fff color:--blue`
- `.btn-outline` → `box-shadow: inset 0 0 0 2px #fff; color:#fff`

### Feature cards (.feature)

```css
.feature        pad:24  r:--r-md  min-h:220px  flex col gap:24
                backdrop-filter: blur(24px)

/* Тинты (текущие) */
.feature.a      bg: rgb(--tint-lilac-rgb / .8)   /* #CBc3D7 80% */
.feature.b      bg: rgb(--card-beige-rgb / .8)   /* #F8E5D1 80% */
.feature.c      bg: rgb(--tint-blue-rgb / .8)    /* #C6D2EB 80% */
.feature.d      bg: rgb(--card-mint-rgb / .8)    /* #BCE3ED 80% */

.feature.is-active  bg:#fff  shadow: 0 10px 40px rgb(0 0 0 / .2)
```

### Price cards (.price-card)

```css
.price-card     pad:32  r:--r-md  bg:--card-gray  flex col gap:24
                overflow:hidden  isolation:isolate

.price-card.is-center   активная карточка в карусели, белый фон + градиентная рамка
```

### Product cards (.product)

```css
.product        pad: 32 32 48 32  r:--r-md  flex col gap:24
                position:absolute (карусель)

/* Тинты — текущие */
.product.p1     bg:--card-beige    /* #F8E5D1 */
.product.p2     bg:--card-lilac    /* #CBCFE7 */
.product.p3     bg:--card-mint     /* #BCE3ED */
.product.p4     bg:--card-sky      /* #D6E2FB */
.product.p5     bg:--card-mint     /* то же что p3 */

.product h3     fs:24/600  color:--black
.product .art   h:150px
```

### Service tiles (.service)

```css
.service        pad: 24 24 32 24  r:--r-md  bg:--card-gray
                flex col  justify:space-between  gap:24
                grid: 3 cols, gap:16
```

### Perk banners (.perk)

```css
.perk           pad: 24 24 32 24  r:24px  flex col gap:24
                flex: 1 1 0

/* Тинты */
.perk--a        bg:--hero-packages-bg   /* #DDE7FB */
.perk--b        bg:--perk-sky           /* #C9E6FD */
.perk--c        bg:--perk-lilac         /* #D9D0E6 */

.perk h3        fs:24/600  lh:1.4  color:--black
.perk .icon-tile  72×72  r:12px
```

### News cards (.news)

```css
.news           pad:32  r:--r-md  bg:--card-gray  flex col
```

### Badges (.badge)

```css
.badge          h:32px(mobile)  r:--r-20  px:12  fs:12/600  inline-flex
.badge.free     bg:--green-bg  color:--green
.badge.reco     bg:--lilac-grad  color:#fff
.badge.ip       bg:--card-blue  color:--blue
```

### Togglers / Segments

```css
/* .toggle (pill tabs) */
.toggle-row     bg:--card-blue  r:--r-pill
                h:40px(mobile) h:48px(desktop)

/* .seg (офисы/банкоматы) */
.seg            bg:--card-blue  r:48px
                h:40px  px:16  fs:14
```

### Icon tiles (.icon-tile)

```css
.icon-tile      56×56(mobile)  72×72(feature/perk)
                r:--r-sm(12px)
                bg: metal gradient или solid
```

---

## 4. Тёмная обложка — контекстный слой

Когда карточка использует тёмный тинт (`--card-*-dark`), добавляй класс-контекст
который инвертирует все дочерние элементы через CSS-переменные:

```css
.card--dark {
  color: var(--white-pure);

  /* Переопределяем текстовые токены внутри */
  --text:        #fff;
  --muted:       rgba(255,255,255,0.60);
  --black:       #fff;
  --border:      rgba(255,255,255,0.20);

  /* Кнопки */
  /* .btn-primary → bg:#fff color:--blue */
  /* .btn-outline → shadow inset white, color:#fff */
}
```

**Правило:** никогда не ставь `color:white` вручную на отдельные элементы внутри
тёмной карточки — только через контекст `.card--dark`.

> ⚠️ Статус: `.card--dark` пока не реализован в `styles.css`. При первом применении —
> добавь в конец файла перед `@media (max-width: 900px)`.

---

## 5. Типографика

| Стиль | Mobile | Desktop | Вес | Использование |
|---|---|---|---|---|
| Display | 36px | 56px | 700 | Hero h1 |
| H1 | 32px | 48px | 700 | Заголовки секций |
| H2 | 24px | 32px | 600 | Подзаголовки |
| H3/Card | 16px | 18px | 600 | `.feature h3`, `.price-card h4` |
| Body L | 16px | 18px | 400 | Длинные описания |
| Body | 14px | 16px | 400 | Основной текст |
| Caption | 12px | 14px | 400 | Мета, даты |
| Button | 15px | 16px | 600 | `.btn` |

Шрифт: `'Inter', -apple-system, sans-serif`

---

## 6. Spacing

**Базовая сетка: 4px** (все значения кратны 4).
Допустимые шаги: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96...
На мобайле мелкие gaps от 4px, на десктопе от 8px.

```
--m-gap-2    2px   ← только micro (dot, divider)
--m-gap-4    4px   ← мобайл micro gaps
--m-gap-8    8px   ← мобайл card gaps, check list
--m-gap-12   12px  ← допустимо (3×4)
--m-gap-16   16px  ← card grid gap, pkg-gap
--m-gap-24   24px  ← внутри карточек
--m-gap-32   32px  ← padding карточек, cta offset
--m-gap-40   40px
--m-gap-48   48px  ← nav gaps
--m-section-gap  56px
--m-section-pb   72px
--m-section-pt   48px
```

**Исключения** (задокументированы, не менять):
- `--m-btn-py: 10px` — визуальная высота btn 48px (py×2 + line-height = 48)
- `--m-icon-tile: 56px` — mobile icon tile (14×4)
- `--r-sm: 12px`, `--r-20: 20px`, `--r-badge: 20px` — дизайн-решения

---

## 7. Layout

```
Desktop: container = min(1170px, 100% - 40px)  gutter:20px
Mobile:  container = 100% - 32px               gutter:16px

3-col grid: (1170 - 2×16) / 3 ≈ 379px  gap:16px
Header: 64px  (desktop + mobile)
```

---

## 8. Протокол несоответствий ← КЛЮЧЕВОЕ ПРАВИЛО

Если при вёрстке нет точного матчинга токена или класса:

1. **Не изобретай** новое имя/значение
2. **Предложи 3 варианта** в формате:
   ```
   ❓ Несоответствие: [что именно]
   
   Вариант A — [название]: [описание + последствия]
   Вариант B — [название]: [описание + последствия]
   Вариант C — [название]: [описание + последствия]
   
   Жду выбор → после выбора верстаю + обновляю SKILL.md
   ```
3. **После выбора** — сверстай по выбранному варианту
4. **Обнови SKILL.md** — добавь решение в соответствующий раздел + запись в Changelog

**Примеры несоответствий:**
- Figma показывает цвет которого нет в `--card-*` переменных
- Новый тип карточки без существующего класса
- Размер/отступ не входит в шкалу spacing
- Тёмная обложка на компоненте который ещё не имеет `.card--dark` контекста

---

## 9. Правила верстки

### CSS vs JS — приоритет CSS

**Не используй JS для того, что решается CSS:**

| Задача | Не надо JS | CSS-решение |
|---|---|---|
| Показать/скрыть элемент | `el.style.display` | `.hidden { display: none }` + класс |
| Hover-эффект | `mouseenter/mouseleave` | `:hover` |
| Focus-стиль | JS-обработчик | `:focus-visible` |
| Sticky header | scroll-listener + class | `position: sticky` |
| Плавный скролл | JS scroll | `scroll-behavior: smooth` |
| Простая анимация | setTimeout + style | `transition` / `@keyframes` |
| Клапан аккордеона | JS height calc | `details/summary` или `grid-template-rows: 0fr → 1fr` |
| Адаптив | JS resize-listener | `@media` / `container queries` |

JS нужен только для: каруселей, сложных интерактивных состояний, данных из API,
событий которые CSS не покрывает (drag, swipe, keyboard nav).

---

### Структура JS — модули и компоненты

Проект уже разделён на слои — **соблюдай эту структуру**:

```
js/
  app.js              ← точка входа, только импорты и init-вызовы
  namespace.js        ← window.SDM, регистрация модулей
  components/         ← рендер-функции: возвращают HTML-строку или DOM-узел
    render.js         ← универсальный рендерер render(selector, data, component)
    priceCard.js      ← одна карточка пакета
    product.js        ← одна карточка продукта
    service.js        ← одна плитка сервиса
    press.js          ← одна новость
    heroFeature.js    ← одна feature-карточка
    docAccItem.js     ← один пункт аккордеона
  modules/            ← поведение: init-функции, без рендера
    header.js         ← sticky, blur
    headerMenus.js    ← mega-menu, mini-menu
    togglers.js       ← pill-tabs
    packagesCarousel.js
    ...
  data/               ← статические данные (массивы объектов)
```

**Правила:**
- `app.js` не содержит логики — только `render(...)` и `S.modules.X.init()`
- компонент = чистая функция `(data) → string | Node`, без побочных эффектов
- модуль = объект `{ init() {} }`, регистрируется в `window.SDM.modules`
- данные живут в `data/`, не инлайном в HTML и не в компонентах

---

### gallery.html — Component Gallery

Файл `sdm/design system/gallery.html` — единственное место где все компоненты собраны изолированно.

**Правило:** при добавлении нового компонента — **всегда** добавляй его секцию в `gallery.html`.

Структура секции в галерее:
```html
<section class="g-section" id="my-component">
  <div class="g-section-head">
    <h2>Название</h2>
    <code>.css-class</code>
  </div>
  <!-- варианты компонента -->
</section>
```

Галерея не подключает `modules/` (нет carousel-логики) — только `data/` + `components/`.

---

### Правило инстансов — 3+ повторений

Если элемент используется **3 и более раз** — выноси в компонент:

1. Создай файл `js/components/myElement.js`
2. Экспортируй функцию `(data) → htmlString`
3. Добавь данные в `js/data/`
4. В `app.js`: `render('[data-render="my-elements"]', S.data.myElements, myElement)`
5. В HTML: `<div data-render="my-elements"></div>` — пустой контейнер

**Что уже является компонентами:**
- `.price-card` → `priceCard.js` + `data/packages.js`
- `.product` → `product.js` + `data/products.js`
- `.service` → `service.js` + `data/services.js`
- `.news` → `press.js` + `data/press.js`
- `.feature` → `heroFeature.js` + `data/hero.js`

**Новые элементы** которые появляются на новых страницах и используются 3+ раз —
сразу делай компонентом, не инлайном в HTML.

---

## 10. Что использовать из Verstak-подхода

- **Не дублируй platform chrome** — не верстай браузерные рамки, системные бары
- **Скриншот для валидации** — после вёрстки `save_screenshots` → сравни с Figma
- **Decompose**: секция → карточка/блок → элементы (badge, кнопка, иконка)
- **Точные значения из Figma** — `get_node` даёт padding, radius, font-size напрямую

---

## 10a. Как добавить компонент в галерею

Компоненты в галерее **не хранятся отдельно** — это и есть боевой CSS.
Каждый пример: кусок HTML + классы из `sdm.css`. Никаких копий стилей,
поэтому расхождению взяться неоткуда.

Файлы:

```
tokens.css        значения (цвета, размеры, типографика)
sdm.css           правила компонента
gallery-specs.js  описание секции: что показать и какими примерами
gallery.js        движок — трогать не нужно
_frame.html       песочница превью — трогать не нужно
tests.html        проверки
```

### Один рендерер на всё

Любое превью — мобильное, десктопное или скрытый эталон для сравнения —
это **один и тот же `_frame.html`**, смонтированный единственной функцией
`mountFrame()` в `gallery.js`. Отличаются только ширина и набор CSS:

```js
makeFrame(html, 390, false)    // мобайл  — реальный @media срабатывает сам
makeFrame(html, 1440, true)    // десктоп — контейнер получает свои 1170
makeProbe(html, 'current')     // скрытый эталон для «Фигма ↔ код»
```

Поэтому мобильную версию **не надо описывать отдельно**: в галерею
попадает одна и та же разметка, а различия даёт медиазапрос в `sdm.css`.
Второго пути монтирования быть не должно — обвязка (адрес с
cache-buster'ом, рукопожатие `g:css` → `g:render`) живёт в одном месте
и при дублировании разъезжается.

### Шаги

**1. Токены.** Если появились новые значения — в `tokens.css`. Мобильное
значение в основном `:root`, десктопное в `@media (min-width: 901px)`.
Сырые цвета и размеры в `sdm.css` не пишем.

**2. Стили.** Правило компонента в `sdm.css`, в конец соответствующего
раздела. Только `var(--*)`. Мобильные отличия — в единственный
`@media (max-width: 900px)` в конце файла.

**3. Секция галереи.** В `gallery-specs.js` добавить объект в массив
`window.GALLERY`. Порядок в массиве = порядок в сайдбаре.

```js
{
  id: 'my-block',                 // якорь в url
  group: 'Блоки',                 // заголовок в сайдбаре
  title: 'Мой блок',
  code: '.my-block',              // подпись-класс рядом с заголовком
  desc: 'Откуда взяты значения и что здесь важно.',
  examples: [
    { label: 'Обычное состояние',
      note: 'необязательное пояснение под заголовком примера',
      html: '<div class="my-block" data-pick=".my-block">…</div>' }
  ]
}
```

Поля:

- `examples[].html` — разметка, рендерится в двух фреймах: 390px и 1440px.
- `data-pick="<имя>"` делает узел кликабельным: по клику открывается
  оверлей с его HTML, CSS и задействованными токенами. CSS собирается из
  живого документа, вручную ничего описывать не надо.
- `wide: true` — показать только десктопный фрейм (для широких таблиц).
- `htmlDesktop` — отдельная разметка для десктопа, если состав узлов
  отличается (например, третий шаг скрыт на мобайле).
- `render(mode)` вместо `examples` — если секция рисуется не компонентом,
  а таблицей или свотчами (так сделаны токен-секции).
- `g-bleed` в классах — для секций, которые на сайте идут во всю ширину
  (обложка): снимает гаттер песочницы.

**4. Тест.** В `tests.html` добавить проверку на то, что реально может
сломаться — размеры на двух брейкпоинтах, цвет в тёмном контексте,
раскладку. Хелперы: `css(section, 'mobile'|'desktop', selector, prop)`,
`pane(...)`, `px(...)`, `eq(...)`, `ok(...)`.

**5. Проверить.** Открыть `tests.html` — должно быть зелено. Затем в
галерее нажать «Фигма ↔ код» и посмотреть, чем новый компонент
отличается от текущей вёрстки.

### Правило

Новый компонент без секции в галерее не считается сделанным. Если элемент
встречается 3+ раза — он компонент, а не разметка, вписанная в страницу.

---

## 11. Changelog

```
v0.4  2026-08-19  Галерея переведена в режим референса + написан новый sdm.css.

                  Правила самой галереи:
                  · Токен-секции (цвета, типографика, радиусы, тени, размеры)
                    НЕ зависят от переключателя CSS — палитра и шкала это и есть
                    дизайн-система. Переключатель управляет только тем, чем
                    нарисованы компоненты. Справка «что сейчас в коде» — строкой
                    внутри свотча.
                  · Любой размерный токен показывается сразу на ОБОИХ
                    брейкпоинтах (Mobile ≤900 / Desktop ≥901), даже если значения
                    совпадают — тогда это подписано явно.
                  · Скрипты и CSS грузятся с cache-buster. Без него браузер отдавал
                    закешированный gallery-specs.js, и галерея молча показывала
                    вчерашнее состояние без единой ошибки в консоли.
                  · Карта LEGACY в gallery-specs.js связывает новые имена токенов
                    со старыми из styles.css (--text-primary ↔ --text,
                    --text-heading ↔ --black, --card-peach ↔ --card-beige и т.д.).
                  · Обе панели превью масштабируются ОДИНАКОВО, коэффициент
                    подписан. Раньше мобильная рисовалась 1:1, а десктопная
                    ужималась под колонку — при узком окне десктоп сжимался до
                    ~60%, и кнопка 52px выглядела меньше мобильной 48px.
                    Сравнивать размеры было нельзя. Кнопка «1:1» отключает
                    ужимание, десктопная панель получает прокрутку.
                  · Секции, которые на сайте идут во всю ширину (обложка),
                    помечаются классом .g-bleed — иначе гаттер песочницы
                    накладывается на их собственный паддинг и контент вдвое уже.

                  Аудит M/D (сравнение вычисленных значений в двух фреймах)
                  выявил и исправил:
                    · .toggle / .seg / .pkg-view — на десктопе оставался
                      UA-паддинг кнопки 1px: задан padding-block: 0
                    · .toggle на мобайле — убран бесполезный вертикальный
                      паддинг (высота фиксирована, контент центрируется флексом)
                    · кнопки обложки на мобайле переносились на две строки
                      из-за двойного отступа; в макете они стоят в строку
                    · --btn-r: радиус кнопки схлопнут в одно значение на обоих
                      брейкпоинтах. В макетах встречаются и 40, и 48 — причём
                      оба и на мобайле, и на десктопе; при высоте 48/52 любой
                      радиус ≥26 даёт полную «пилюлю», так что это дрейф макета,
                      а не решение
                    · .g-cover — фон по умолчанию только для светлой обложки,
                      иначе одноклассовый .card--dark-plain перебивался просто
                      по порядку объявления

                  Структура Design system/:
                    tokens.css   — токены, единственный источник значений
                    sdm.css      — новый боевой CSS (только var(--*))
                    gallery.html + gallery.js + gallery-specs.js — сторибук
                    _frame.html  — iframe-песочница для превью
                    assets/      — SVG, выгруженные напрямую из Figma

                  Решённые несоответствия (протокол §8):

                  1. Радиусы. tokens.css v0.1 объявлял --r-md: 16px / --r-lg: 24px.
                     Лист «1 / Tokens» в Figma говорит --r-md 24 — совпадает со
                     styles.css. Ошибка экспорта, исправлено. Введена числовая
                     шкала --r-4…--r-48 как примитив и семантические алиасы
                     (--r-card, --r-icon, --r-badge, --r-input) поверх неё.

                  2. Тени. Токен --shadow-header (0 2px 100px) удалён: у хедера
                     backdrop-filter: blur(100px), а не тень. В системе всего два
                     drop-shadow (--shadow-card, --shadow-overlay), всё остальное —
                     inset-кольца (--ring*) и один градиентный бордер.

                  3. --card-blue. В Figma #D3EAFD — тинт карточки, а #CDE1F4 —
                     трек переключателей, фон .badge.ip и .cta-band. В styles.css
                     обе роли слиты в одно имя. Разведено: --card-blue и --track-blue.

                  4. Тинт .product. В макетах #F5D5BF, глубже свотча --card-peach
                     (#FAE4D5). Заведён --card-peach-deep.

                  5. Типографика — ТОЛЬКО по свёрстанным макетам, сверенным с
                     блоками в Figma. Лист типографики в Figma расходится с кодом
                     (H2 36 vs 32, веса заголовков) и не используется.
                     Найденные и исправленные расхождения:
                       .hero h1            36 → 48   (было 48 на обоих)
                       .hero-lead          18 → 18   (отдельный токен, не body-l)
                       .price-name         24 → 36   (было 24 → 32)
                       .feature h3         16 → 24   \
                       .docs-acc__title    16 → 24   / общая пара --font-block-title
                       тексты FAQ          14 → 18   (было 16 → 20)
                       ссылка FAQ          вес 500   (была 600)
                       .cta-band h3        18 → 36   (собственная пара, не H2 и не H3)
                       .btn в обложке      15 → 16
                       .btn в карточках    14 → 16   (отдельный --font-btn-card-size)

                  6. Кнопки. Мобильный размер в карточках 14/500 — по макету.
                     styles.css:3835 ставит 15px, хотя его же комментарий строкой
                     выше говорит «Figma: 48×, py 10, px 24, r 48, 14/500».

                  7. .card--dark реализован как контекст: переопределяет текстовые
                     токены, поэтому .check, .btn и заголовки перекрашиваются сами.

                  8. Инпуты, textarea и радиогруппа написаны с нуля — в styles.css
                     их не существует, спека взята с листа «2 / Components».

                  Мобильные превью больше не подделываются !important-зеркалом:
                  каждый пример рендерится в iframe (390px и 1440px), настоящий
                  @media срабатывает сам. Клик по элементу открывает оверлей,
                  где HTML и CSS собираются из живого документа в рантайме.

                  Вёрстка ui2026 НЕ тронута — раскатка после приёмки галереи.

v0.3  2026-08-19  Добавлена gallery.html — component gallery для всех компонентов.
v0.2  2026-08-19  Добавлены правила верстки: CSS vs JS, структура модулей, правило инстансов.
v0.1  2026-08-19  Первая версия. Страница: homepage (index.html).
                  Компоненты: btn, feature, price-card, product, service, perk, news, badge, toggle.
                  Статус тинтов: расхождение не решено (открытый вопрос).
                  Тёмная обложка: .card--dark не реализован, концепция зафиксирована.
```

---

> Скилл эволюционирует по мере верстки новых страниц.
> После каждого решения несоответствия — обновляй раздел токенов + Changelog.
