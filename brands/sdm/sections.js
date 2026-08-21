/* ==========================================================================
   SDM Gallery — реестр секций
   --------------------------------------------------------------------------
   Секция: { id, group, title, code, note, desc, render(mode), examples[] }
     render(mode) → HTML строкой, рисуется в родителе (токены, таблицы)
     examples[]   → { label, note, html, htmlDesktop, wide }
                    рендерятся в iframe: mobile 390 + desktop 1170

   В разметке примеров атрибут data-pick="Имя" делает узел кликабельным —
   по клику открывается оверлей с его HTML, CSS и задействованными токенами.
   ========================================================================== */
(function () {
  'use strict';

  var BRAND = window.ENGINE_BRAND, MAN = window.BRAND_MANIFEST;

  /* ── Парсер CSS-переменных ─────────────────────────────────────────
     Возвращает три контекста: base (:root вне медиа), desktop (min-width:901)
     и mobile (max-width:900). Так таблица типографики может показать оба
     брейкпоинта, не гадая.                                                  */
  var VARS = {
    tokens: { base: {}, desktop: {}, mobile: {} },
    sdm:    { base: {}, desktop: {}, mobile: {} },
    site:   { base: {}, desktop: {}, mobile: {} },
    ready: false
  };

  function parseVars(css) {
    var ctx = { base: {}, desktop: {}, mobile: {} };
    // вырезаем комментарии, чтобы закомментированные токены не попадали в разбор
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // @media-блоки с балансировкой скобок
    var mediaRe = /@media([^{]+)\{/g, m;
    var spans = [];
    while ((m = mediaRe.exec(css))) {
      var depth = 1, i = mediaRe.lastIndex;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      spans.push({ cond: m[1], from: m.index, bodyFrom: mediaRe.lastIndex, to: i });
      mediaRe.lastIndex = i;
    }

    function collect(chunk, bucket) {
      var re = /:root\s*\{([^}]*)\}/g, r;
      while ((r = re.exec(chunk))) {
        var vre = /(--[\w-]+)\s*:\s*([^;]+);/g, v;
        while ((v = vre.exec(r[1]))) bucket[v[1]] = v[2].trim();
      }
    }

    // base — всё, что вне @media
    var rest = '', cursor = 0;
    spans.forEach(function (sp) { rest += css.slice(cursor, sp.from); cursor = sp.to; });
    rest += css.slice(cursor);
    collect(rest, ctx.base);

    spans.forEach(function (sp) {
      var body = css.slice(sp.bodyFrom, sp.to - 1);
      if (/min-width\s*:\s*90[1-9]|min-width\s*:\s*9[1-9]\d/.test(sp.cond)) collect(body, ctx.desktop);
      else if (/max-width\s*:\s*900/.test(sp.cond)) collect(body, ctx.mobile);
    });
    return ctx;
  }

  var BUST = window.GALLERY_BUST || '';

  /* Файлы читаются с диска на каждой перезагрузке, поэтому можно попасть в
     момент, когда редактор уже обрезал файл, но ещё не дописал. Тогда мы бы
     молча нарисовали пустую палитру. Пустой или подозрительно короткий ответ
     перечитываем — до трёх попыток. */
  function grab(url, tries) {
    tries = tries == null ? 3 : tries;
    return fetch(url + (BUST ? BUST + '&n=' + tries : '?n=' + tries), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (text) {
        if (text && text.indexOf('--') >= 0) return text;
        if (tries <= 1) return text || '';
        return new Promise(function (res) { setTimeout(res, 250); })
          .then(function () { return grab(url, tries - 1); });
      })
      .catch(function () {
        if (tries <= 1) return '';
        return new Promise(function (res) { setTimeout(res, 250); })
          .then(function () { return grab(url, tries - 1); });
      });
  }

  function load(attempt) {
    return Promise.all([
      grab(BRAND.path(MAN.css.tokens)),
      grab(BRAND.path(MAN.css.components))
    ]).then(function (res) {
      var tokens = parseVars(res[0]);
      // файл мог быть прочитан в момент перезаписи — тогда разбор пуст.
      // Ждём и перечитываем, вместо того чтобы показывать пустую палитру.
      if (Object.keys(tokens.base).length === 0 && attempt < 4) {
        return new Promise(function (r) { setTimeout(r, 400 * attempt); })
          .then(function () { return load(attempt + 1); });
      }
      VARS.tokens = tokens;
      VARS.sdm    = parseVars(res[1]);
      VARS.ready  = true;
      VARS.broken = Object.keys(tokens.base).length === 0;
      if (window.GALLERY_REFRESH) window.GALLERY_REFRESH();
    });
  }

  load(1);

  /* CSS для сравнения приходит из шапки: разработчик прикладывает свой файл.
     Пока его нет, VARS.site пуст и свотчи не показывают колонку «что в коде». */
  window.GALLERY_SET_SITE_CSS = function (text) {
    VARS.site = text ? parseVars(text) : { base: {}, desktop: {}, mobile: {} };
    VARS.hasSite = !!text;
    if (window.GALLERY_REFRESH) window.GALLERY_REFRESH();
  };

  /* Карта имён: в styles.css те же цвета названы по-другому.
     Без неё режим «Текущий сайт» показывал бы «не задан» там, где цвет есть,
     просто под старым именем. null — значит в боевом коде такого токена
     действительно нет. */
  var LEGACY = {
    '--text-heading':    '--black',
    '--text-primary':    '--text',
    '--text-secondary':  '--text-2',
    '--text-muted':      '--muted',
    '--text-on-dark':    '--white-pure',
    '--text-brand':      '--blue',
    '--text-success':    '--green',
    '--border-hairline': '--m-header-border',
    '--track-blue':      '--card-blue',
    '--card-peach':      '--card-beige',
    '--r-card':          '--r-md',
    '--r-icon':          '--r-sm',
    '--r-badge':         '--r-20',
    '--r-input':         '--r-8',
    '--r-dot':           '--r-4',
    '--r-btn':           '--r-48'
  };

  /* Значение токена. bp: 'desktop' | 'mobile' | undefined (= desktop) */
  function val(name, mode, bp, depth) {
    depth = depth || 0;
    if (depth > 6) return null;
    var src = mode === 'current' ? VARS.site : VARS.tokens;
    var pick = function (n) {
      return (bp === 'mobile')
        ? (src.mobile[n] !== undefined ? src.mobile[n] : src.base[n])
        : (src.desktop[n] !== undefined ? src.desktop[n] : src.base[n]);
    };
    var v = pick(name);
    // в боевом коде тот же цвет может жить под старым именем
    if (v === undefined && mode === 'current' && LEGACY[name]) v = pick(LEGACY[name]);
    if (v === undefined) return null;
    var m = String(v).match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (m) return val(m[1], mode, bp, depth + 1) || v;
    return v;
  }

  /* Все известные имена токенов в наборе */
  function allNames(set) {
    var out = {};
    ['base', 'desktop', 'mobile'].forEach(function (k) {
      Object.keys(set[k]).forEach(function (n) { out[n] = 1; });
    });
    return Object.keys(out);
  }

  /* Сравнение значений: регистр, пробелы, короткая запись hex (#fff === #FFFFFF) */
  function norm(v) {
    if (v == null) return v;
    return String(v).trim().toLowerCase().replace(/\s+/g, ' ')
      .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, '#$1$1$2$2$3$3');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Любой размерный токен показываем сразу на обоих брейкпоинтах.
     Если значения совпадают — так и пишем, чтобы это было видно явно,
     а не выглядело как «забыли указать». */
  function bp(name) {
    var m = val(name, 'new', 'mobile');
    var d = val(name, 'new', 'desktop');
    return { m: m, d: d, same: norm(m) === norm(d) };
  }

  function bpCell(name) {
    var x = bp(name);
    if (x.m == null && x.d == null) return '<span class="g-warn">—</span>';
    if (x.same) return '<code>' + esc(x.d) + '</code> <span class="g-swatch-use">M = D</span>';
    return '<code>' + esc(x.m) + '</code> → <code>' + esc(x.d) + '</code>';
  }

  /* Таблица размеров: одна строка = токен, отдельные колонки M и D */
  function sizeTable(rows) {
    return '<table class="g-table"><thead><tr>' +
      '<th>Токен</th><th>Mobile ≤900</th><th>Desktop ≥901</th><th>Где применяется</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        var x = bp(r[0]);
        var cls = x.same ? '' : ' class="g-add"';
        return '<tr><td><code>' + esc(r[0]) + '</code></td>' +
          '<td><code>' + esc(x.m == null ? '—' : x.m) + '</code></td>' +
          '<td' + cls + '><code>' + esc(x.d == null ? '—' : x.d) + '</code></td>' +
          '<td>' + (r[1] || '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ── Свотчи ────────────────────────────────────────────────────────── */
  /* Палитра — это сама дизайн-система, поэтому свотч ВСЕГДА показывает
     значение из tokens.css и не зависит от переключателя CSS. Переключатель
     управляет тем, чем нарисованы компоненты, а не тем, какого цвета бренд.
     Строкой ниже — справка о том, что сейчас лежит в боевом коде. */
  function swatch(name, label, use) {
    var v = val(name, 'new');
    var chip = v
      ? '<div class="g-swatch-chip" style="background:' + v + '"></div>'
      : '<div class="g-swatch-chip g-missing"></div>';

    var inCode = val(name, 'current');
    var codeName = (VARS.site.base[name] === undefined && LEGACY[name]) ? LEGACY[name] : name;
    var note;
    if (!VARS.ready || !VARS.hasSite) note = '';   // сравнивать пока не с чем
    else if (inCode == null) note = '<span class="g-add">нового в коде нет</span>';
    else if (norm(inCode) !== norm(v)) note = '<span class="g-warn">в коде ' + esc(codeName) + ': ' + esc(inCode) + '</span>';
    else if (codeName !== name) note = '<span class="g-ok">в коде — ' + esc(codeName) + '</span>';
    else note = '<span class="g-ok">совпадает с кодом</span>';

    return '<div class="g-swatch">' + chip +
      '<div class="g-swatch-meta">' +
        '<div class="g-swatch-name">' + esc(label) + '</div>' +
        '<div class="g-swatch-val">' + (v ? esc(v) : '<span class="g-warn">нет в tokens.css</span>') + '</div>' +
        '<div class="g-swatch-val">' + esc(name) + '</div>' +
        (use ? '<div class="g-swatch-use">' + esc(use) + '</div>' : '') +
        '<div class="g-swatch-use">' + note + '</div>' +
      '</div></div>';
  }

  /* Градиент показываем самой плашкой: hex у него нет, поэтому под ней —
     сокращённая запись стопов из tokens.css. */
  function gradientSwatch(name, label, use) {
    var v = val(name, 'new');
    var stops = v ? v.replace(/^(linear|conic|radial)-gradient\(/, '').replace(/\)$/, '')
                     .replace(/\s+/g, ' ').slice(0, 90) + (v.length > 100 ? '…' : '') : null;
    return '<div class="g-swatch">' +
      (v ? '<div class="g-swatch-chip" style="height:72px;background:' + v + '"></div>'
         : '<div class="g-swatch-chip g-missing" style="height:72px"></div>') +
      '<div class="g-swatch-meta">' +
        '<div class="g-swatch-name">' + esc(label) + '</div>' +
        '<div class="g-swatch-val">' + esc(name) + '</div>' +
        (use ? '<div class="g-swatch-use">' + esc(use) + '</div>' : '') +
        '<div class="g-swatch-use">' + esc(stops || '—') + '</div>' +
      '</div></div>';
  }

  function group7Gradients() {
    return '<h3 style="margin:24px 0 10px;font-size:13px;font-weight:600">7. Градиенты</h3>' +
      '<div class="g-swatches">' +
        gradientSwatch('--featured-pkg-border', 'Featured pkg', 'рамка активной карточки пакета') +
        gradientSwatch('--lilac-grad', 'Lilac', '.badge.reco · рамка FAQ и поиска') +
        gradientSwatch('--metal', 'Metal', '.icon-tile.num · .icon-tile--metal') +
      '</div>';
  }

  function swatches(list) {
    return '<div class="g-swatches">' + list.map(function (i) {
      return swatch(i[0], i[1], i[2]);
    }).join('') + '</div>';
  }

  function group(title, list) {
    return '<h3 style="margin:24px 0 10px;font-size:13px;font-weight:600">' + title + '</h3>' +
           swatches(list);
  }

  /* ── Хелперы разметки примеров ─────────────────────────────────────
     Всё, что попадает внутрь iframe. data-pick делает узел кликабельным.  */
  function row(items, gap) {
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:' +
      (gap || 12) + 'px;margin-bottom:12px">' + items.join('') + '</div>';
  }

  /* Единая строка каталога: слева колонка метаданных, справа образец.
     Одна сетка (.g-row) на оба брейкпоинта — и для кнопок, и для плиток,
     чтобы подписи в мобильной и десктопной панелях стояли на одной вертикали. */
  function specRow(name, cls, meta, sample) {
    return '<div class="g-row">' +
      '<div class="g-row__meta">' +
        '<div class="g-row__name">' + name + '</div>' +
        '<div class="g-row__cls">' + cls + '</div>' +
        '<div class="g-row__meta-val">' + meta + '</div>' +
      '</div>' +
      '<div class="g-row__sample" data-pick="' + cls + '">' + sample + '</div>' +
    '</div>';
  }

  function btnRow(size, cls, text, heights) {
    var h = heights.split(' / ');
    return specRow(size, cls, 'M ' + h[0] + ' · D ' + h[1],
      '<a href="#" class="' + cls.replace(/^\./, 'btn ').replace(/\./g, ' ') + '">' + text + '</a>');
  }

  /* Иконки берём из assets/icons — это те же файлы, что в вёрстке
     (.perk — i-ban-01…03, .service — i-01…i-05,
     .perk — i-ban-01…03), но с приведённым к квадрату канвасом:
     в оригиналах он разный (37×50, 30×39, 47×37…), из-за чего иконки
     одной высоты выглядели разными по величине. Пути не менялись,
     только рамка viewBox. */
  function tileRow(name, cls, size, sample) {
    return specRow(name, cls, size,
      '<span style="display:inline-flex;align-items:center;gap:12px;padding:12px 16px;' +
      'border-radius:12px;background:var(--card-gray)">' + sample + '</span>');
  }

  function btn(cls, text) {
    return '<a href="#" class="' + cls + '" data-pick="' + cls + '">' + text + '</a>';
  }

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

  function illu(src, label, bg, h) {
    return '<div class="g-swatch"><div style="display:flex;align-items:center;justify-content:center;' +
      'height:' + (h || 140) + 'px;padding:12px;background:' + (bg || 'var(--card-gray)') + '">' +
      '<img src="' + (src.indexOf('/') >= 0 ? src : 'assets/img/' + src) + '" alt="" ' +
      'style="max-height:100%;max-width:100%;object-fit:contain">' +
      '</div><div class="g-swatch-meta"><div class="g-swatch-name">' + label + '</div>' +
      '<div class="g-swatch-val">' + src + '</div></div></div>';
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
     СЕКЦИИ
     ══════════════════════════════════════════════════════════════════ */
  window.GALLERY = [

  /* ─────────────────────────── ТОКЕНЫ ─────────────────────────────── */
  {
    id: 'colors', group: 'Токены', title: 'Цвета', code: 'tokens.css §1–6',
    desc: 'Семь светлых тинтов и семь тёмных. Минта в палитре нет — #BCE3ED остался в styles.css. Нижняя строка свотча говорит, что сейчас в коде.',
    render: function () {
      if (VARS.broken) {
        return '<div class="g-hint">Не удалось прочитать <code>tokens.css</code> — файл ' +
          'вернулся пустым. Обычно это значит, что его перезаписывали в момент загрузки ' +
          'страницы. Перезагрузите галерею.</div>';
      }
      return group('1. Brand', [
        ['--blue', 'Primary', 'CTA · футер · брендбар'],
        ['--blue-hero', 'Hover', 'btn-primary:hover · nav'],
        ['--blue-accent', 'Accent', 'ссылки · фокус'],
        ['--blue-light', 'Light tint', 'мягкий брендовый фон']
      ]) +
      group('2. Text', [
        ['--text-heading', 'Heading', 'заголовки карточек'],
        ['--text-primary', 'Body', 'параграфы'],
        ['--text-muted', 'Muted', 'подписи · мета'],
        ['--text-on-dark', 'On dark', 'текст на тёмном'],
        ['--text-brand', 'Brand text', 'outline-кнопки'],
        ['--text-success', 'Success', '.badge.free'],
        ['--text-error', 'Error', 'валидация']
      ]) +
      group('3. Backgrounds', [
        ['--bg', 'Page', 'body'],
        ['--white-pure', 'White', 'кнопки · оверлеи'],
        ['--white', 'Surface', 'альт. поверхность'],
        ['--card-gray', 'Card gray', '.news · .service · .price-card'],
        ['--card-gray-2', 'Card gray-2', 'вторичные плитки'],
        ['--hero-light-bg', 'Hero light', 'фон hero'],
        ['--hero-packages-bg', 'Packages hero', '.perk--a'],
        ['--border-hairline', 'Header line', 'мобильный хедер'],
        ['--green-bg', 'Green bg', 'фон .badge.free']
      ]) +
      group('4. UI elements', [
        ['--border', 'Border', 'инпуты · .toggle'],
        ['--dark-toggle', 'Dark toggle', '.toggle.active']
      ]) +
      group('5. Card tints — light', [
        ['--card-slate',  'Slate',  '.product.p5'],
        ['--card-blue',   'Blue',   '.step'],
        ['--card-indigo', 'Indigo', '.product.p4'],
        ['--card-lilac',  'Lilac',  '.product.p2'],
        ['--card-teal',   'Teal',   '.product.p3'],
        ['--card-peach',  'Peach',  '.product.p1'],
        ['--card-rose',   'Rose']
      ]) +
      group('6. Card tints — dark', [
        ['--card-slate-dark', 'Slate dark'], ['--card-blue-dark', 'Blue dark'],
        ['--card-indigo-dark', 'Indigo dark'], ['--card-lilac-dark', 'Lilac dark'],
        ['--card-teal-dark', 'Teal dark'], ['--card-peach-dark', 'Peach dark'],
        ['--card-rose-dark', 'Rose dark'], ['--card-dark', 'Dark bg']
      ]) +
      group7Gradients();
    }
  },

  {
    id: 'radii', group: 'Токены', title: 'Радиусы', code: '--r-*',
    desc: 'Десктоп: sm 12 · md 24 · pill 40 · btn 48. Мобайл: dot 4 · card 16 · badge 20 · btn 48.',
    render: function () {
      if (!VARS.ready) return '<p class="g-section-desc">Загружаю CSS…</p>';
      var list = ['--r-4', '--r-6', '--r-8', '--r-12', '--r-16', '--r-20', '--r-24', '--r-40', '--r-48'];
      var sem  = [['--r-card', 'карточки'], ['--r-icon', '.icon-tile'], ['--r-badge', '.badge'],
                  ['--r-input', 'инпуты'], ['--r-pill', '.toggle'], ['--r-btn', '.btn'], ['--r-dot', 'точки']];

      function box(n, label) {
        var x = bp(n);
        // рисуем оба радиуса: слева мобильный, справа десктопный
        var half = function (v, cap) {
          return '<div style="flex:1;height:56px;background:var(--card-blue);border-radius:' +
            (v || 0) + '"></div>';
        };
        return '<div class="g-swatch">' +
          '<div style="display:flex;gap:6px;margin:10px">' + half(x.m) + half(x.d) + '</div>' +
          '<div class="g-swatch-meta">' +
            '<div class="g-swatch-name">' + esc(x.m || '—') + ' / ' + esc(x.d || '—') + '</div>' +
            '<div class="g-swatch-val">' + esc(n) + '</div>' +
            '<div class="g-swatch-use">' + (x.same ? 'одинаково на M и D' : 'M / D — различаются') + '</div>' +
            (label ? '<div class="g-swatch-use">' + esc(label) + '</div>' : '') +
          '</div></div>';
      }

      return '<h3 style="margin:0 0 10px;font-size:13px;font-weight:600">Шкала</h3>' +
        '<div class="g-swatches">' + list.map(function (n) { return box(n); }).join('') + '</div>' +
        '<h3 style="margin:24px 0 10px;font-size:13px;font-weight:600">Семантика ' +
        '<span style="font-weight:400;color:var(--text-muted)">— слева мобильный, справа десктопный</span></h3>' +
        '<div class="g-swatches">' + sem.map(function (x) { return box(x[0], x[1]); }).join('') + '</div>';
    }
  },

  {
    id: 'shadows', group: 'Токены', title: 'Тени и кольца', code: '--shadow-* · --ring-*',
    desc: 'Drop-shadow в системе всего два. Рамки бывают двух видов: inset-кольцо сплошным цветом и градиентная через background-clip.',
    render: function () {
      if (!VARS.ready) return '<p class="g-section-desc">Загружаю CSS…</p>';

      function box(name, label, use, dark) {
        var v = val(name, 'new');
        return '<div class="g-swatch">' +
          '<div style="margin:16px;height:64px;border-radius:12px;background:' +
            (dark ? 'var(--dark-toggle)' : 'var(--white-pure)') + ';box-shadow:' + (v || 'none') + '"></div>' +
          '<div class="g-swatch-meta"><div class="g-swatch-name">' + esc(label) + '</div>' +
          '<div class="g-swatch-val">' + esc(v || '—') + '</div>' +
          '<div class="g-swatch-val">' + esc(name) + '</div>' +
          '<div class="g-swatch-use">' + esc(use) + '</div></div></div>';
      }
      function h(t, extra) {
        return '<h3 style="margin:24px 0 10px;font-size:13px;font-weight:600">' + t +
          (extra ? ' <span style="font-weight:400;color:var(--text-muted)">' + extra + '</span>' : '') + '</h3>';
      }

      return h('Drop shadows') +
        '<div class="g-swatches">' +
          box('--shadow-card', 'Card', 'активная карточка в карусели') +
          box('--shadow-overlay', 'Overlay', '.mega-inner · .mini-inner') +
          box('--shadow-hairline', 'Hairline', 'sticky-бар в залипании') +
        '</div>' +
        h('Inset-кольца', '— вместо border') +
        '<div class="g-swatches">' +
          box('--ring', 'Brand ring', '.btn-outline') +
          box('--ring-border', 'Border ring', '.toggle · .pkg-compare__labels') +
          box('--ring-on-dark', 'On dark', 'мобильное меню', true) +
        '</div>' +
        h('Градиентные рамки', '— это не тень, а background-clip') +
        '<div class="g-swatches">' +
          ['--featured-pkg-border:активная карточка пакета',
           '--lilac-grad:раскрытый пункт FAQ · поисковая строка'].map(function (x) {
            var p2 = x.split(':');
            return '<div class="g-swatch">' +
              '<div style="margin:16px;height:64px;border-radius:12px;border:2px solid transparent;' +
              'background:linear-gradient(var(--white-pure),var(--white-pure)) padding-box,' +
              'var(' + p2[0] + ') border-box"></div>' +
              '<div class="g-swatch-meta"><div class="g-swatch-name">' + p2[0] + '</div>' +
              '<div class="g-swatch-use">' + p2[1] + '</div></div></div>';
          }).join('') + '</div>';
    }
  },

  {
    id: 'blur', group: 'Токены', title: 'Размытие', code: 'backdrop-filter',
    desc: 'Размывается подложка под оверлеями. Два значения: 100 — хедер и мега-меню, 50 — мобильное меню и диалог поиска.',
    render: function () {
      if (!VARS.ready) return '<p class="g-section-desc">Загружаю CSS…</p>';
      var rows = [
        ['--blur-header',  '.header · мега-меню'],
        ['--blur-overlay', 'мобильное меню · диалог поиска']
      ];
      // подложка нарочно контрастная: на гладком градиенте размытие не читается.
      // Размываем только правую половину — слева видно исходник для сравнения.
      var backdrop =
        'background:' +
        'repeating-linear-gradient(45deg, var(--blue) 0 10px, var(--card-peach) 10px 20px),' +
        'var(--white-pure)';

      return '<div class="g-swatches">' + rows.map(function (r) {
        var v = val(r[0], 'new');
        return '<div class="g-swatch">' +
          '<div style="position:relative;height:110px;overflow:hidden;' + backdrop + '">' +
            '<div style="position:absolute;inset:0 0 0 50%;backdrop-filter:' + v + ';' +
            '-webkit-backdrop-filter:' + v + ';background:rgb(var(--white-pure-rgb)/.55)"></div>' +
            '<div style="position:absolute;left:8px;bottom:6px;font-size:9px;font-weight:700;' +
            'color:var(--white-pure);text-shadow:0 1px 2px rgb(0 0 0/.6)">без размытия</div>' +
            '<div style="position:absolute;right:8px;bottom:6px;font-size:9px;font-weight:700;' +
            'color:var(--text-heading)">размыто</div>' +
          '</div>' +
          '<div class="g-swatch-meta">' +
            '<div class="g-swatch-name">' + esc(v || '—') + '</div>' +
            '<div class="g-swatch-val">' + esc(r[0]) + '</div>' +
            '<div class="g-swatch-use">' + r[1] + '</div>' +
          '</div></div>';
      }).join('') + '</div>';
    }
  },

  {
    id: 'typography', group: 'Токены', title: 'Типографика', code: '--font-*',
    desc: 'Шкала из свёрстанных макетов. Веса: 400 текст · 500 кнопки и навигация · 600 заголовки и цены · 700 цифры, бейджи, шаги.',
    render: function () {
      if (!VARS.ready) return '<p class="g-section-desc">Загружаю CSS…</p>';

      // 4-й элемент — вес: у части стилей нет собственного токена веса,
      // поэтому задан явно, а не выведен фолбэком
      var rows = [
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
      ];

      var weights = '<h3 style="margin:0 0 10px;font-size:13px;font-weight:600">Веса</h3>' +
        '<table class="g-table"><tbody>' +
        [['400', 'Regular', 'тело, лид, подписи, ссылки меню'],
         ['500', 'Medium', 'кнопки, навигация, тогглеры, ссылки в FAQ'],
         ['600', 'Semi Bold', 'заголовки, карточки, цены'],
         ['700', 'Bold', 'цифры, бейджи, активная навигация, шаги']]
        .map(function (w) {
          return '<tr><td style="font-weight:' + w[0] + ';font-size:16px">' + w[1] + '</td>' +
                 '<td><code>' + w[0] + '</code></td><td>' + w[2] + '</td></tr>';
        }).join('') + '</tbody></table>';

      var table = '<h3 style="margin:28px 0 10px;font-size:13px;font-weight:600">Шкала</h3>' +
        '<table class="g-table"><thead><tr>' +
        '<th>Стиль</th><th>Токен</th><th>Mobile</th><th>Desktop</th><th>Вес</th><th>Где применяется</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><b>' + r[0] + '</b></td>' +
            '<td><code>' + r[1] + '-size</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'mobile')  || '—') + '</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'desktop') || '—') + '</code></td>' +
            '<td><code>' + r[3] + '</code></td>' +
            '<td>' + r[2] + '</td></tr>';
        }).join('') + '</tbody></table>';

      // Специмен в двух колонках: размеры подставлены явными пикселями из
      // токенов, поэтому обе версии видны одновременно и не зависят от того,
      // насколько широко открыто окно.
      function column(which, title) {
        return '<div><div class="g-pane-label" style="border:1px solid var(--border);' +
          'border-radius:8px 8px 0 0">' + title + '</div>' +
          '<div style="border:1px solid var(--border);border-top:0;border-radius:0 0 8px 8px;padding:16px">' +
          rows.filter(function (r) { return r[1].indexOf('--font-btn') !== 0; }).map(function (r) {
            var size = val(r[1] + '-size', 'new', which);
            var lh   = val(r[1] + '-lh', 'new', which) || 1.3;
            return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">' +
              '<div style="font-size:' + size + ';font-weight:' + r[3] + ';line-height:' + lh +
              ';color:var(--text-heading)">' + r[0] + ' — Съешь ещё булок</div>' +
              '<div class="g-swatch-val" style="margin-top:4px">' + esc(size) + ' / ' + r[3] + '</div>' +
            '</div>';
          }).join('') + '</div></div>';
      }

      var spec = '<h3 style="margin:28px 0 10px;font-size:13px;font-weight:600">Специмен</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">' +
          column('mobile', 'Mobile ≤ 900') + column('desktop', 'Desktop ≥ 901') +
        '</div>';

      var note = '<div class="g-hint" style="margin-top:24px">Шкала собрана из свёрстанных ' +
        'HTML-макетов и сверена с блоками в Figma. В <code>styles.css</code> семантических ' +
        'токенов типографики нет — размеры вписаны прямо в правила компонентов, а мобильные ' +
        'живут отдельным набором <code>--m-fs-*</code> / <code>--m-lh-*</code>. Это и чинит ' +
        '<code>sdm.css</code>: одно имя работает на обоих брейкпоинтах.</div>';

      return weights + table + spec + note;
    }
  },

  {
    id: 'sizes', group: 'Токены', title: 'Размеры компонентов', code: '--btn-* · --input-* · --toggle-*',
    desc: 'Каждый размер на обоих брейкпоинтах. Подсветка в колонке Desktop — значение там меняется.',
    render: function () {
      if (!VARS.ready) return '<p class="g-section-desc">Загружаю CSS…</p>';
      function h(t, extra) {
        return '<h3 style="margin:24px 0 10px;font-size:13px;font-weight:600">' + t +
          (extra ? ' <span style="font-weight:400;color:var(--text-muted)">' + extra + '</span>' : '') + '</h3>';
      }
      return h('Кнопки', '— на мобайле .btn-lg схлопывается до высоты .btn') +
        sizeTable([
          ['--btn-h', 'высота .btn'], ['--btn-px', 'горизонтальный паддинг'],
          ['--btn-r', 'радиус'], ['--btn-gap', 'зазор с иконкой'],
          ['--btn-lg-h', 'высота .btn-lg'], ['--btn-lg-px', ''], ['--btn-lg-r', ''],
          ['--btn-sm-h', 'высота .btn-sm / .login'], ['--btn-sm-px', ''], ['--btn-sm-r', '']
        ]) +
        h('Поля ввода') +
        sizeTable([
          ['--input-h', 'высота .input'], ['--input-px', ''], ['--input-r', ''],
          ['--input-fs', 'размер текста'], ['--textarea-min-h', 'минимальная высота .textarea']
        ]) +
        h('Переключатели') +
        sizeTable([
          ['--toggle-h', '.toggle'], ['--toggle-px', ''], ['--toggle-py', 'вертикальный паддинг трека'],
          ['--toggle-fs', ''], ['--seg-h', '.seg'], ['--seg-px', ''], ['--seg-fs', '']
        ]) +
        h('Плитки, бейджи, шапка') +
        sizeTable([
          ['--icon-tile', '.icon-tile'], ['--icon-tile-r', ''],
          ['--badge-h', '.badge'], ['--badge-px', ''], ['--badge-py', ''], ['--badge-fs', ''],
          ['--header-h', 'высота хедера'], ['--search-h', '.searchbar']
        ]) +
        h('Отступы и раскладка') +
        sizeTable([
          ['--gutter', 'боковой отступ .container'],
          ['--container', 'максимальная ширина'],
          ['--card-gap', 'зазор в сетке карточек'],
          ['--card-3col', 'ширина карточки в 3 колонки'],
          ['--card-pad', '.step · .perk · .service'],
          ['--card-pad-lg', '.news · .price-card · .product · .docs-acc'],
          ['--card-pad-b', 'нижний паддинг .product'],
          ['--section-pt', 'верх секции'], ['--section-gap', ''], ['--section-pb', 'низ секции']
        ]) +
        h('Шкала отступов') +
        '<div class="g-swatches">' +
          ['--gap-2','--gap-4','--gap-8','--gap-12','--gap-16','--gap-24','--gap-32','--gap-40','--gap-48']
          .map(function (n) {
            var v = val(n, 'new');
            return '<div class="g-swatch"><div style="padding:16px;display:flex;align-items:center">' +
              '<div style="height:24px;width:' + v + ';background:var(--blue);border-radius:2px"></div></div>' +
              '<div class="g-swatch-meta"><div class="g-swatch-name">' + esc(v) + '</div>' +
              '<div class="g-swatch-val">' + esc(n) + '</div></div></div>';
          }).join('') + '</div>';
    }
  },

  /* ───────────────────────── ПРИМИТИВЫ ────────────────────────────── */
  {
    id: 'buttons', group: 'Примитивы', title: 'Кнопки', code: '.btn',
    desc: 'Высоты: sm 40/40 · med 48/52 · lg 48/64. На мобайле .btn-lg схлопывается до .btn.',
    examples: [
      { label: 'Primary — три размера', mobileWidth: 900,
        html:
          btnRow('SM',  '.btn-sm.btn-primary',  'Войти',                     '40 / 40') +
          btnRow('MED', '.btn-primary',         'Открыть счет',              '48 / 52') +
          btnRow('LG',  '.btn-lg.btn-primary',  'Открыть счет в СДМ-Банке',  '48 / 64') },
      { label: 'Outline — три размера', mobileWidth: 900,
        note: 'Те же высоты, кольцо inset 2px --blue вместо заливки.',
        html:
          btnRow('SM',  '.btn-sm.btn-outline',  'Войти',          '40 / 40') +
          btnRow('MED', '.btn-outline',         'Узнать больше',  '48 / 52') +
          btnRow('LG',  '.btn-lg.btn-outline',  'Узнать больше',  '48 / 64') },
      { label: 'Инверсия на тёмной обложке — те же три размера', mobileWidth: 900,
        note: 'Контекст .card--dark инвертирует кнопки сам: primary становится белой с синим ' +
              'текстом, outline получает белое кольцо. Руками красить ничего не нужно, ' +
              'размеры и радиусы не меняются.',
        html: '<div class="card card--dark card--dark-blue" data-pick=".card--dark">' +
          btnRow('SM',  '.btn-sm.btn-primary',  'Войти',                    '40 / 40') +
          btnRow('MED', '.btn-primary',         'Оставить заявку',          '48 / 52') +
          btnRow('LG',  '.btn-lg.btn-primary',  'Открыть счет в СДМ-Банке', '48 / 64') +
          '<div style="height:8px"></div>' +
          btnRow('SM',  '.btn-sm.btn-outline',  'Войти',          '40 / 40') +
          btnRow('MED', '.btn-outline',         'Подробнее',      '48 / 52') +
          btnRow('LG',  '.btn-lg.btn-outline',  'Узнать больше',  '48 / 64') +
        '</div>' }
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
        html:
          tileRow('Иконка без плитки', '.icon', 'M 24 · D 36',
            '<img class="icon" src="assets/icons/i-h02.svg" alt="">') +
          tileRow('Малая плитка', '.icon-tile.icon-tile--sm', 'M 44 · D 72 (= обычной)',
            '<span class="icon-tile icon-tile--sm"><img src="assets/icons/i-case.svg" alt=""></span>') +
          tileRow('Обычная плитка', '.icon-tile', 'M 52 · D 72 · иконка 24 / 36',
            '<span class="icon-tile"><img src="assets/icons/i-h03.svg" alt=""></span>') +
          tileRow('Металлическая', '.icon-tile.icon-tile--metal', 'ангуляр-градиент --metal',
            '<span class="icon-tile icon-tile--metal"><img src="assets/icons/i-sm-01.svg" alt=""></span>') +
          tileRow('Числовая', '.icon-tile.num', 'плитка M 56 · D 72 · цифра 24/700 · 36/700',
            '<span class="icon-tile num">1</span><span class="icon-tile num">2</span><span class="icon-tile num">3</span>') }
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
})();