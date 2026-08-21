/* ==========================================================================
   Engine specs — всё, что умеет рисовать токены, не зная, чьи они.
   --------------------------------------------------------------------------
   Здесь живут три слоя:
     1. разбор CSS-переменных (три контекста: base / desktop / mobile);
     2. примитивы каталога — свотчи, таблицы размеров, строки со сравнением
        мобильной и десктопной величины;
     3. tokenSections(map) — готовые секции «Цвета / Радиусы / Тени / Размытие /
        Типографика / Размеры», собранные по дескриптору бренда.

   Бренд не переписывает эту разметку: он отдаёт данные (token-map.js) и
   получает секции. Из-за этого секции токенов — данные, а не код, что
   понадобится, когда бренды начнут приезжать файлом извне: выполнять чужой
   JS ради палитры нельзя, отрисовать чужие данные — можно.
   ========================================================================== */
(function () {
  'use strict';

  var BRAND = window.ENGINE_BRAND;
  var MAN = window.BRAND_MANIFEST || {};
  var t = BRAND.t;

  /* Карта старых имён приходит от бренда: движок не знает, как в чужом
     боевом коде назывались те же токены. */
  var LEGACY = window.BRAND_LEGACY || {};
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
  /* Чтение файла бренда. У пакета в памяти он уже прочитан — перечитывать
     нечего и незачем ждать. Повторы нужны только папке: файл могли
     перезаписывать ровно в момент загрузки страницы. */
  function grabFile(file) {
    var src = BRAND.source;
    if (src.kind !== 'folder') return Promise.resolve(src.text(file) || '');
    return grab(src.url(file));
  }

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
      grabFile(MAN.css.tokens),
      grabFile(MAN.css.components)
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
    if (x.same) return '<code>' + esc(x.d) + '</code> <span class="g-swatch-use">' + t('tok.same') + '</span>';
    return '<code>' + esc(x.m) + '</code> → <code>' + esc(x.d) + '</code>';
  }

  /* Таблица размеров: одна строка = токен, отдельные колонки M и D */
  function sizeTable(rows) {
    return '<table class="g-table"><thead><tr>' +
      '<th>' + t('tok.token') + '</th><th>' + t('tok.mobile') + '</th>' +
      '<th>' + t('tok.desktop') + '</th><th>' + t('tok.usage') + '</th>' +
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
    else if (inCode == null) note = '<span class="g-add">' + t('tok.notInCode') + '</span>';
    else if (norm(inCode) !== norm(v)) note = '<span class="g-warn">' +
      t('tok.inCodeAs', { name: esc(codeName), value: esc(inCode) }) + '</span>';
    else if (codeName !== name) note = '<span class="g-ok">' + t('tok.inCodeNamed', { name: esc(codeName) }) + '</span>';
    else note = '<span class="g-ok">' + t('tok.matchesCode') + '</span>';

    return '<div class="g-swatch">' + chip +
      '<div class="g-swatch-meta">' +
        '<div class="g-swatch-name">' + esc(label) + '</div>' +
        '<div class="g-swatch-val">' + (v ? esc(v) : '<span class="g-warn">' + t('tok.missing') + '</span>') + '</div>' +
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

  /* Градиенты приходят списком из дескриптора: их состав — дело бренда. */
  function gradientGroup(title, items) {
    if (!items || !items.length) return '';
    return '<h3 class="g-group-title">' + esc(title) + '</h3>' +
      '<div class="g-swatches">' + items.map(function (g) {
        return gradientSwatch(g[0], g[1], g[2]);
      }).join('') + '</div>';
  }

  function swatches(list) {
    return '<div class="g-swatches">' + list.map(function (i) {
      return swatch(i[0], i[1], i[2]);
    }).join('') + '</div>';
  }

  function group(title, list) {
    return '<h3 class="g-group-title">' + esc(title) + '</h3>' + swatches(list);
  }

  /* Подзаголовок с необязательным пояснением справа. */
  function h3(title, extra) {
    return '<h3 class="g-group-title">' + esc(title) +
      (extra ? ' <span class="g-group-note">' + esc(extra) + '</span>' : '') + '</h3>';
  }

  /* ── Хелперы разметки примеров ─────────────────────────────────────
     Живут в packages/engine/rows.js: их использует и галерея, и скрипт,
     который собирает данные бренда. data-pick делает узел кликабельным. */
  var ROWS = window.ENGINE_ROWS;

  /* ══════════════════════════════════════════════════════════════════
     Секции токенов из дескриптора бренда.

     Каждая секция сначала проверяет, что CSS вообще прочитан: без этого
     она молча рисовала пустоту, и выглядело это как «пропали цвета».
     ══════════════════════════════════════════════════════════════════ */

  function guard(render) {
    return function () {
      if (VARS.broken) return '<div class="g-hint">' + t('token.brokenTokens') + '</div>';
      if (!VARS.ready)  return '<p class="g-section-desc">' + t('token.loading') + '</p>';
      return render();
    };
  }

  /* Общая обвязка: id и группа задаются движком, тексты — брендом. */
  function section(id, d, render) {
    return {
      id: id, group: d.group || t('tok.group'), title: d.title, code: d.code, desc: d.desc,
      render: guard(render)
    };
  }

  function colorsSection(d) {
    return section('colors', d, function () {
      return (d.groups || []).map(function (g) {
        return group(g.title, g.swatches);
      }).join('') + gradientGroup(d.gradients && d.gradients.title || t('tok.gradients'),
                                  d.gradients && d.gradients.items);
    });
  }

  function radiiSection(d) {
    /* Оба радиуса рядом: слева мобильный, справа десктопный — расхождение
       видно сразу, без переключения панелей. */
    function box(name, label) {
      var x = bp(name);
      var half = function (v) {
        return '<div class="g-radius-half" style="border-radius:' + (v || 0) + '"></div>';
      };
      return '<div class="g-swatch">' +
        '<div class="g-radius-pair">' + half(x.m) + half(x.d) + '</div>' +
        '<div class="g-swatch-meta">' +
          '<div class="g-swatch-name">' + esc(x.m || '—') + ' / ' + esc(x.d || '—') + '</div>' +
          '<div class="g-swatch-val">' + esc(name) + '</div>' +
          '<div class="g-swatch-use">' + t(x.same ? 'tok.sameBoth' : 'tok.differs') + '</div>' +
          (label ? '<div class="g-swatch-use">' + esc(label) + '</div>' : '') +
        '</div></div>';
    }
    return section('radii', d, function () {
      var out = '';
      if (d.scale && d.scale.length) {
        out += h3(t('tok.scale')) + '<div class="g-swatches">' +
               d.scale.map(function (n) { return box(n); }).join('') + '</div>';
      }
      if (d.semantic && d.semantic.length) {
        out += h3(t('tok.semantics'), t('tok.mobileLeft')) + '<div class="g-swatches">' +
               d.semantic.map(function (r) { return box(r[0], r[1]); }).join('') + '</div>';
      }
      return out;
    });
  }

  function shadowsSection(d) {
    function box(name, label, use, dark) {
      var v = val(name, 'new');
      return '<div class="g-swatch">' +
        '<div class="g-shadow-demo' + (dark ? ' is-dark' : '') + '" style="box-shadow:' + (v || 'none') + '"></div>' +
        '<div class="g-swatch-meta"><div class="g-swatch-name">' + esc(label) + '</div>' +
        '<div class="g-swatch-val">' + esc(v || '—') + '</div>' +
        '<div class="g-swatch-val">' + esc(name) + '</div>' +
        '<div class="g-swatch-use">' + esc(use || '') + '</div></div></div>';
    }
    /* Градиентная рамка — не тень: она рисуется двумя фонами и
       background-clip, поэтому и демонстрируется отдельно. */
    function borderBox(name, use) {
      return '<div class="g-swatch">' +
        '<div class="g-gradborder-demo" style="background:' +
          'linear-gradient(var(--white-pure),var(--white-pure)) padding-box,' +
          'var(' + name + ') border-box"></div>' +
        '<div class="g-swatch-meta"><div class="g-swatch-name">' + esc(name) + '</div>' +
        '<div class="g-swatch-use">' + esc(use || '') + '</div></div></div>';
    }
    function block(title, extra, items, fn) {
      if (!items || !items.length) return '';
      return h3(title, extra) + '<div class="g-swatches">' + items.map(fn).join('') + '</div>';
    }
    return section('shadows', d, function () {
      return block(t('tok.dropShadows'), '', d.drop, function (r) { return box(r[0], r[1], r[2]); }) +
             block(t('tok.insetRings'), t('tok.insteadOfBorder'), d.rings,
                   function (r) { return box(r[0], r[1], r[2], r[3]); }) +
             block(t('tok.gradientBorders'), t('tok.notAShadow'), d.gradientBorders,
                   function (r) { return borderBox(r[0], r[1]); });
    });
  }

  function blurSection(d) {
    return section('blur', d, function () {
      return '<div class="g-swatches">' + (d.rows || []).map(function (r) {
        var v = val(r[0], 'new');
        /* Подложка нарочно контрастная: на гладком градиенте размытие не
           читается. Размыта только правая половина — слева исходник. */
        return '<div class="g-swatch">' +
          '<div class="g-blur-demo">' +
            '<div class="g-blur-demo__veil" style="backdrop-filter:' + v +
              ';-webkit-backdrop-filter:' + v + '"></div>' +
            '<div class="g-blur-demo__tag is-left">' + t('tok.blurOff') + '</div>' +
            '<div class="g-blur-demo__tag is-right">' + t('tok.blurOn') + '</div>' +
          '</div>' +
          '<div class="g-swatch-meta">' +
            '<div class="g-swatch-name">' + esc(v || '—') + '</div>' +
            '<div class="g-swatch-val">' + esc(r[0]) + '</div>' +
            '<div class="g-swatch-use">' + esc(r[1] || '') + '</div>' +
          '</div></div>';
      }).join('') + '</div>';
    });
  }

  function typographySection(d) {
    var rows = d.scale || [];        // [ label, tokenPrefix, usage, weight ]

    function weightsTable() {
      if (!d.weights || !d.weights.length) return '';
      return h3(t('tok.weights')) + '<table class="g-table"><tbody>' +
        d.weights.map(function (w) {
          return '<tr><td style="font-weight:' + w[0] + ';font-size:16px">' + esc(w[1]) + '</td>' +
                 '<td><code>' + w[0] + '</code></td><td>' + esc(w[2] || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    function scaleTable() {
      return h3(t('tok.scale')) + '<table class="g-table"><thead><tr>' +
        '<th>' + t('tok.style') + '</th><th>' + t('tok.token') + '</th>' +
        '<th>' + t('tok.mobileShort') + '</th><th>' + t('tok.desktopShort') + '</th>' +
        '<th>' + t('tok.weight') + '</th><th>' + t('tok.usage') + '</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><b>' + esc(r[0]) + '</b></td>' +
            '<td><code>' + esc(r[1]) + '-size</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'mobile')  || '—') + '</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'desktop') || '—') + '</code></td>' +
            '<td><code>' + r[3] + '</code></td>' +
            '<td>' + esc(r[2] || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    /* Специмен в двух колонках: размеры подставлены явными пикселями из
       токенов, поэтому оба брейкпоинта видны одновременно и не зависят от
       того, насколько широко открыто окно. */
    function column(which, title) {
      var skip = d.specimenSkip || [];
      return '<div><div class="g-pane-label g-specimen-head">' + esc(title) + '</div>' +
        '<div class="g-specimen">' +
        rows.filter(function (r) {
          return skip.every(function (p) { return r[1].indexOf(p) !== 0; });
        }).map(function (r) {
          var size = val(r[1] + '-size', 'new', which);
          var lh   = val(r[1] + '-lh', 'new', which) || 1.3;
          return '<div class="g-specimen__row">' +
            '<div style="font-size:' + size + ';font-weight:' + r[3] + ';line-height:' + lh + '">' +
              esc(r[0]) + ' — ' + esc(d.pangram || 'The quick brown fox') + '</div>' +
            '<div class="g-swatch-val" style="margin-top:4px">' + esc(size) + ' / ' + r[3] + '</div>' +
          '</div>';
        }).join('') + '</div></div>';
    }

    return section('typography', d, function () {
      return weightsTable() + scaleTable() +
        h3(t('tok.specimen')) +
        '<div class="g-specimen-cols">' +
          column('mobile', t('tok.mobile')) + column('desktop', t('tok.desktop')) +
        '</div>' +
        (d.note ? '<div class="g-hint" style="margin-top:24px">' + d.note + '</div>' : '');
    });
  }

  function sizesSection(d) {
    return section('sizes', d, function () {
      var out = (d.groups || []).map(function (g) {
        return h3(g.title, g.note) + sizeTable(g.rows);
      }).join('');

      if (d.spacingScale && d.spacingScale.length) {
        out += h3(d.spacingTitle || t('tok.spacingScale')) + '<div class="g-swatches">' +
          d.spacingScale.map(function (n) {
            var v = val(n, 'new');
            return '<div class="g-swatch"><div class="g-space-demo">' +
              '<div class="g-space-bar" style="width:' + v + '"></div></div>' +
              '<div class="g-swatch-meta"><div class="g-swatch-name">' + esc(v) + '</div>' +
              '<div class="g-swatch-val">' + esc(n) + '</div></div></div>';
          }).join('') + '</div>';
      }
      return out;
    });
  }

  /* Публичная сборка: бренд отдаёт дескриптор, получает готовые секции.
     Отсутствующий раздел просто не появляется — шаблонному бренду не нужно
     объявлять размытие, чтобы открыться. */
  function tokenSections(map) {
    map = map || {};
    var built = [
      map.colors     && colorsSection(map.colors),
      map.radii      && radiiSection(map.radii),
      map.shadows    && shadowsSection(map.shadows),
      map.blur       && blurSection(map.blur),
      map.typography && typographySection(map.typography),
      map.sizes      && sizesSection(map.sizes)
    ];
    return built.filter(Boolean);
  }

  /* Хелперы, которыми бренд рисует свои компонентные секции. */
  window.ENGINE_SPECS = {
    tokenSections: tokenSections,
    parseVars: parseVars,          // нужен импорту дизайн-системы из CSS-файла
    val: val, bp: bp, bpCell: bpCell, esc: esc, norm: norm,
    swatch: swatch, swatches: swatches, group: group, h3: h3,
    sizeTable: sizeTable, vars: VARS,
    /* строки каталога — из общего модуля */
    row: ROWS.row, specRow: ROWS.specRow, btnRow: ROWS.btnRow, tileRow: ROWS.tileRow,
    renderRows: ROWS.renderRows
  };
})();
