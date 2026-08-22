/* ==========================================================================
   Дизайн-система из CSS-файла.

   У большинства команд она уже есть — списком custom properties в чужом
   стайлшите, который никто не видел глазами. Разбирать этот файл движок уже
   умеет (parseVars в engine-specs.js читает :root и оба медиазапроса), так
   что работа здесь одна: разложить найденное по разделам справочника.

   Угадывание тут только в группировке, не в значениях. Поэтому правило
   простое: НИ ОДИН токен не пропадает. Что не опознано — уезжает в раздел
   «Прочие токены» списком, а не в тишину.
   ========================================================================== */
(function () {
  'use strict';

  var COLOR = /^(#|rgb|hsl|color\()/i;
  var GRADIENT = /gradient\(/i;
  var SHADOW = /^(inset\s+)?-?\d/;          // 0 2px 8px rgb(...)
  var LEN = /^-?\d*\.?\d+(px|rem|em)$/;

  function isColor(v)    { return COLOR.test(v.trim()); }
  function isGradient(v) { return GRADIENT.test(v); }
  function isShadow(v)   { return SHADOW.test(v.trim()) && /rgb|#|hsl/i.test(v); }
  function isLength(v)   { return LEN.test(v.trim()); }
  function px(v)         { return parseFloat(v); }

  /* Заголовок группы из префикса имени: --brand-blue → Brand. Имя, которое
     дал автор стилей, информативнее любой нашей классификации. */
  function groupOf(name) {
    var parts = name.replace(/^--/, '').split('-');
    var head = parts.length > 1 ? parts[0] : 'other';
    return head.charAt(0).toUpperCase() + head.slice(1);
  }

  function label(name) {
    return name.replace(/^--/, '').replace(/-/g, ' ')
               .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* Заголовки разделов в дескрипторе — данные бренда, а не интерфейс.
     Если брать их из языкового пака импортирующего, пакет уедет коллеге с
     русскими заголовками поверх английской галереи. Поэтому канонические
     английские: это имена разделов справочника, а не текст интерфейса. */
  var TITLES = {
    colors:   'Colours',
    gradients:'Gradients',
    radii:    'Radii',
    shadows:  'Shadows',
    sizes:    'Sizes',
    type:     'Type scale',
    spacing:  'Spacing',
    other:    'Other tokens'
  };

  /* Разбор → дескриптор токен-секций того же вида, что token-map.json. */
  function toTokenMap(vars, note) {
    var all = {};
    ['base', 'desktop', 'mobile'].forEach(function (ctx) {
      Object.keys(vars[ctx] || {}).forEach(function (n) {
        if (all[n] === undefined) all[n] = vars[ctx][n];
      });
    });

    var names = Object.keys(all).sort();
    if (!names.length) return null;

    var colorGroups = {};   // заголовок → список свотчей
    var gradients = [];
    var radii = [];
    var fonts = [];
    var shadows = [];
    var sizes = [];
    var other = [];

    names.forEach(function (n) {
      var v = String(all[n]).trim();

      if (isGradient(v))                 { gradients.push([n, label(n)]); return; }
      if (isColor(v)) {
        var g = groupOf(n);
        (colorGroups[g] = colorGroups[g] || []).push([n, label(n)]);
        return;
      }
      if (isShadow(v))                   { shadows.push([n, label(n)]); return; }
      if (/(^--r-|radius)/.test(n))      { radii.push([n, label(n)]); return; }
      if (/^--font|font-size|^--fs-/.test(n) && isLength(v)) { fonts.push([n, label(n)]); return; }
      if (isLength(v)) {
        /* Размер шрифта и отступ на глаз не различить, поэтому опираемся на
           имя, а по величине только сортируем: 10–96 обычно типографика. */
        (px(v) >= 10 && px(v) <= 96 && /size|text|lead|title/.test(n) ? fonts : sizes)
          .push([n, label(n)]);
        return;
      }
      other.push([n, label(n)]);
    });

    var map = {};

    var groups = Object.keys(colorGroups).map(function (title) {
      return { title: title, swatches: colorGroups[title] };
    });
    if (groups.length || gradients.length) {
      map.colors = {
        title: TITLES.colors,
        /* Единственное место, где сказано про отсутствие компонентов так,
           чтобы это было видно: первая секция каталога. */
        desc: note,
        groups: groups,
        gradients: gradients.length ? { title: TITLES.gradients, items: gradients } : undefined
      };
    }
    if (radii.length) {
      map.radii = { title: TITLES.radii, semantic: radii };
    }
    if (shadows.length) {
      map.shadows = { title: TITLES.shadows, drop: shadows.map(function (r) {
        return [r[0], r[1], ''];
      }) };
    }
    if (fonts.length) {
      /* Дескриптор типографики ждёт префиксы (--font-h1 → -size/-lh). У чужого
         файла таких пар обычно нет, поэтому показываем их таблицей размеров:
         честнее, чем делать вид, что шкала собралась. */
      map.sizes = map.sizes || { title: TITLES.sizes, groups: [] };
      map.sizes.groups.push({ title: TITLES.type, rows: fonts.map(function (r) {
        return [r[0], ''];
      }) });
    }
    if (sizes.length) {
      map.sizes = map.sizes || { title: TITLES.sizes, groups: [] };
      map.sizes.groups.push({ title: TITLES.spacing, rows: sizes.map(function (r) {
        return [r[0], ''];
      }) });
    }
    if (other.length) {
      map.sizes = map.sizes || { title: TITLES.sizes, groups: [] };
      map.sizes.groups.push({ title: TITLES.other, rows: other.map(function (r) {
        return [r[0], ''];
      }) });
    }

    return { map: map, count: names.length };
  }

  window.ENGINE_CSS_IMPORT = {
    /* CSS-файл → пакет сторибука. Возвращает { pack, title } или { error }. */
    build: function (css, filename, t) {
      var vars = window.ENGINE_SPECS.parseVars(css);
      var built = toTokenMap(vars, t('new.cssDesc', { file: filename }));
      if (!built) return { error: 'noTokens' };

      var title = t('new.cssName', { file: filename });
      var manifest = {
        id: 'imported',
        title: title,
        version: '0.1.0',
        engine: 1,
        css: { tokens: 'tokens.css', components: 'components.css' },
        sections: 'sections.json',
        tokenMap: 'token-map.json',
        legacyNames: null,
        assetsBase: 'assets/',
        font: { family: null, href: null },
        breakpoints: { mobile: 900, desktopMin: 901 },
        preview: { mobileWidth: 390, desktopWidth: 1440, container: 1170 },
        compare: { legacy: null }
      };

      var pack = window.ENGINE_BUNDLE.empty();
      pack.files['manifest.json']  = JSON.stringify(manifest, null, 2);
      pack.files['tokens.css']     = css;
      /* Компонентов нет — но файл должен существовать: движок грузит оба. */
      pack.files['components.css'] = '/* ' + t('new.cssDesc', { file: filename }) + ' */\n';
      pack.files['token-map.json'] = JSON.stringify(built.map, null, 2);
      pack.files['sections.json']  = '[]';

      return { pack: pack, title: title, count: built.count };
    }
  };
})();
