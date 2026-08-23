/* ==========================================================================
   Engine specs — everything that can draw tokens without knowing whose they are.
   --------------------------------------------------------------------------
   Three layers live here:
     1. CSS custom property parsing (three contexts: base / desktop / mobile);
     2. catalog primitives — swatches, size tables, rows comparing mobile and
        desktop values;
     3. tokenSections(map) — ready sections Colors / Radii / Shadows / Blur /
        Typography / Sizes, assembled from the brand descriptor.

   The brand does not rewrite this markup: it supplies data (token-map.js) and
   receives sections. Token sections are therefore data, not code — needed when
   brands arrive as external files: you cannot execute foreign JS for a palette,
   but you can render foreign data.
   ========================================================================== */
(function () {
  'use strict';

  var BRAND = window.ENGINE_BRAND;
  var MAN = window.BRAND_MANIFEST || {};
  var t = BRAND.t;

  /* Legacy name map comes from the brand: the engine does not know what the same
     tokens were called in foreign production code. */
  var LEGACY = window.BRAND_LEGACY || {};
  var VARS = {
    tokens: { base: {}, desktop: {}, mobile: {} },
    sdm:    { base: {}, desktop: {}, mobile: {} },
    site:   { base: {}, desktop: {}, mobile: {} },
    ready: false
  };

  function parseVars(css) {
    var ctx = { base: {}, desktop: {}, mobile: {} };
    // strip comments so commented-out tokens do not enter the parse
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // @media blocks with balanced braces
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

    // base — everything outside @media
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

  /* Files are read from disk on every reload, so you can hit the moment the editor
     truncated the file but has not finished writing. We would silently draw an
     empty palette. Empty or suspiciously short responses are re-read — up to three tries. */
  /* Read a brand file. For a package in memory it is already read — nothing to
     re-read and no need to wait. Retries are only for folders: the file may have
     been rewritten exactly while the page loaded. */
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
      // file may have been read mid-write — parse is empty then.
      // Wait and re-read instead of showing an empty palette.
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

  /* CSS for comparison comes from the header: the developer attaches a file.
     Until then VARS.site is empty and swatches show no "what's in the code" column. */
  window.GALLERY_SET_SITE_CSS = function (text) {
    VARS.site = text ? parseVars(text) : { base: {}, desktop: {}, mobile: {} };
    VARS.hasSite = !!text;
    if (window.GALLERY_REFRESH) window.GALLERY_REFRESH();
  };


  /* Token value. bp: 'desktop' | 'mobile' | undefined (= desktop) */
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
    // in production code the same colour may live under a legacy name
    if (v === undefined && mode === 'current' && LEGACY[name]) v = pick(LEGACY[name]);
    if (v === undefined) return null;
    var m = String(v).match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (m) return val(m[1], mode, bp, depth + 1) || v;
    return v;
  }

  /* All known token names in the set */
  function allNames(set) {
    var out = {};
    ['base', 'desktop', 'mobile'].forEach(function (k) {
      Object.keys(set[k]).forEach(function (n) { out[n] = 1; });
    });
    return Object.keys(out);
  }

  /* Compare values: case, spaces, short hex (#fff === #FFFFFF) */
  function norm(v) {
    if (v == null) return v;
    return String(v).trim().toLowerCase().replace(/\s+/g, ' ')
      .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, '#$1$1$2$2$3$3');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Show any size token on both breakpoints at once.
     If values match — say so explicitly, not as if we forgot to specify. */
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

  /* Size table: one row per token, separate M and D columns */
  function sizeTable(rows) {
    /* Attached-CSS column appears only when comparison is on: otherwise empty
       for the whole table. */
    var compare = comparing();

    return '<table class="g-table"><thead><tr>' +
      '<th>' + t('tok.token') + '</th><th>' + t('tok.mobile') + '</th>' +
      '<th>' + t('tok.desktop') + '</th>' +
      (compare ? '<th>' + t('tok.inCode') + '</th>' : '') +
      '<th>' + t('tok.usage') + '</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        var x = bp(r[0]);
        var cls = x.same ? '' : ' class="g-add"';
        return '<tr><td><code>' + esc(r[0]) + '</code></td>' +
          '<td><code>' + esc(x.m == null ? '—' : x.m) + '</code></td>' +
          '<td' + cls + '><code>' + esc(x.d == null ? '—' : x.d) + '</code></td>' +
          (compare ? '<td>' + codeNote(r[0]) + '</td>' : '') +
          '<td>' + (r[1] || '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* What's in the attached CSS. Returns empty while comparison is off: the palette
     IS the design system, and constant talk about a foreign file is noise. Turn the
     toggle on — mismatches must show for components AND tokens: that's where they start. */
  /* Token kind by name. Without it value lookup finds false friends: 48px exists
     for radius, spacing, and heading — matching numbers mean nothing if they are
     different things. */
  function kindOf(name) {
    var n = name.replace(/^--/, '');
    if (/(^|-)(font|fs|lh|text|title|caption|lead)(-|$)/.test(n)) return 'type';
    if (/(^|-)(r|radius|rounded)(-|$)/.test(n)) return 'radius';
    if (/(^|-)(gap|pad|space|gutter|section|inset|margin)(-|$)/.test(n)) return 'space';
    if (/(^|-)(shadow|ring|blur)(-|$)/.test(n)) return 'effect';
    if (/(^|-)(h|w|width|height|size|min|max)(-|$)/.test(n)) return 'size';
    return 'other';
  }

  /* Same token under another name. Name comparison misses this: in production,
     typography sizes usually live in their own set (--m-fs-*), and an honest
     "no such name" is useless — the value is there. Search by value within the
     same kind and report what we find. */
  function sameValueName(name, value) {
    if (value == null) return null;
    var target = norm(value);
    var kind = kindOf(name);
    var words = name.replace(/^--/, '').split('-').filter(function (w) {
      return w.length > 1 && w !== 'font' && w !== 'size';
    });

    var best = null;
    ['base', 'desktop', 'mobile'].forEach(function (ctx) {
      var set = VARS.site[ctx] || {};
      Object.keys(set).forEach(function (n) {
        if (norm(set[n]) !== target) return;
        if (kindOf(n) !== kind) return;
        /* Among several carriers of one value prefer a name like ours:
           --m-fs-h1 beats --m-fs-32. */
        var score = words.filter(function (w) { return n.indexOf(w) >= 0; }).length;
        if (!best || score > best.score) best = { name: n, score: score };
      });
    });
    return best ? best.name : null;
  }

  function codeNote(name) {
    if (!VARS.ready || !VARS.hasSite) return '';
    if (!window.GALLERY_API || !window.GALLERY_API.isDiffOn()) return '';

    var mine = val(name, 'new');
    var inCode = val(name, 'current');
    var codeName = (VARS.site.base[name] === undefined && LEGACY[name]) ? LEGACY[name] : name;

    if (inCode == null) {
      /* Name missing — value may live under another. Sites work that way: mobile
         sizes use --m-fs-*, and "not there" is formally true but useless. Search
         both breakpoints: desktop value may be absent entirely. */
      var alias = sameValueName(name, mine) ||
                  sameValueName(name, val(name, 'new', 'mobile'));
      if (alias) return '<span class="g-ok">' + t('tok.sameValueAs', { name: esc(alias) }) + '</span>';

      /* "No such token" is the same mismatch as a different value: one reason to
         investigate, one colour. */
      return '<span class="g-warn">' + t('tok.notInCode') + '</span>';
    }
    if (norm(inCode) !== norm(mine)) {
      return '<span class="g-warn">' +
        t('tok.inCodeAs', { name: esc(codeName), value: esc(inCode) }) + '</span>';
    }
    if (codeName !== name) {
      return '<span class="g-ok">' + t('tok.inCodeNamed', { name: esc(codeName) }) + '</span>';
    }
    return '<span class="g-ok">' + t('tok.matchesCode') + '</span>';
  }

  /* Is comparison on? Token sections ask in several places — one answer. */
  function comparing() {
    return !!(VARS.ready && VARS.hasSite &&
              window.GALLERY_API && window.GALLERY_API.isDiffOn());
  }

  /* Mismatch row under a token — empty while comparison is off. */
  function noteRow(name) {
    var note = codeNote(name);
    return note ? '<div class="g-swatch-use">' + note + '</div>' : '';
  }

  /* ── Swatches ────────────────────────────────────────────────────────── */
  /* The palette IS the design system, so a swatch ALWAYS shows tokens.css and
     does not depend on the CSS switch. The switch controls what draws components,
     not brand colour. The line below notes what production code has now. */
  function swatch(name, label, use) {
    var v = val(name, 'new');
    var chip = v
      ? '<div class="g-swatch-chip" style="background:' + v + '"></div>'
      : '<div class="g-swatch-chip g-missing"></div>';

    return '<div class="g-swatch">' + chip +
      '<div class="g-swatch-meta">' +
        '<div class="g-swatch-name">' + esc(label) + '</div>' +
        '<div class="g-swatch-val">' + (v ? esc(v) : '<span class="g-warn">' + t('tok.missing') + '</span>') + '</div>' +
        '<div class="g-swatch-val">' + esc(name) + '</div>' +
        (use ? '<div class="g-swatch-use">' + esc(use) + '</div>' : '') +
        noteRow(name) +
      '</div></div>';
  }

  /* Show a gradient as the chip itself: no hex, so below — abbreviated stops from tokens.css. */
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

  /* Gradients arrive as a list from the descriptor: composition is the brand's job. */
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

  /* Subheading with optional note on the right. */
  function h3(title, extra) {
    return '<h3 class="g-group-title">' + esc(title) +
      (extra ? ' <span class="g-group-note">' + esc(extra) + '</span>' : '') + '</h3>';
  }

  /* ── Example markup helpers ─────────────────────────────────────
     Live in packages/engine/rows.js: used by the gallery and the script that
     assembles brand data. data-pick makes a node clickable. */
  var ROWS = window.ENGINE_ROWS;

  /* ══════════════════════════════════════════════════════════════════
     Token sections from the brand descriptor.

     Each section first checks CSS was read: otherwise it silently drew emptiness
     that looked like "colours disappeared".
     ══════════════════════════════════════════════════════════════════ */

  function guard(render) {
    return function () {
      if (VARS.broken) return '<div class="g-hint">' + t('token.brokenTokens') + '</div>';
      if (!VARS.ready)  return '<p class="g-section-desc">' + t('token.loading') + '</p>';
      return render();
    };
  }

  /* Shared wrapper: id and group from the engine, copy from the brand. */
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
    /* Both radii side by side: mobile left, desktop right — mismatch visible
       without switching panels. */
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
          noteRow(name) +
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
        '<div class="g-swatch-use">' + esc(use || '') + '</div>' +
        noteRow(name) + '</div></div>';
    }
    /* Gradient border is not a shadow: two backgrounds and background-clip,
       so it is demonstrated separately. */
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
        /* Backdrop deliberately contrasty: blur is unreadable on a smooth gradient.
           Only the right half is blurred — source on the left. */
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
            noteRow(r[0]) +
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
      var cmp = comparing();
      return h3(t('tok.scale')) + '<table class="g-table"><thead><tr>' +
        '<th>' + t('tok.style') + '</th><th>' + t('tok.token') + '</th>' +
        '<th>' + t('tok.mobileShort') + '</th><th>' + t('tok.desktopShort') + '</th>' +
        '<th>' + t('tok.weight') + '</th>' +
        (cmp ? '<th>' + t('tok.inCode') + '</th>' : '') +
        '<th>' + t('tok.usage') + '</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><b>' + esc(r[0]) + '</b></td>' +
            '<td><code>' + esc(r[1]) + '-size</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'mobile')  || '—') + '</code></td>' +
            '<td><code>' + esc(val(r[1] + '-size', 'new', 'desktop') || '—') + '</code></td>' +
            '<td><code>' + r[3] + '</code></td>' +
            (cmp ? '<td>' + codeNote(r[1] + '-size') + '</td>' : '') +
            '<td>' + esc(r[2] || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    /* Specimen in two columns: sizes set as explicit pixels from tokens, so both
       breakpoints show at once regardless of window width. */
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
              '<div class="g-swatch-val">' + esc(n) + '</div>' +
              noteRow(n) + '</div></div>';
          }).join('') + '</div>';
      }
      return out;
    });
  }

  /* Public assembly: brand supplies descriptor, gets ready sections.
     Missing section simply does not appear — template brand need not declare blur to open. */
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

  /* Helpers the brand uses to draw its component sections. */
  window.ENGINE_SPECS = {
    tokenSections: tokenSections,
    parseVars: parseVars,          // needed to import a design system from a CSS file
    val: val, bp: bp, bpCell: bpCell, esc: esc, norm: norm,
    swatch: swatch, swatches: swatches, group: group, h3: h3,
    sizeTable: sizeTable, vars: VARS,
    /* catalog rows — from the shared module */
    row: ROWS.row, specRow: ROWS.specRow, btnRow: ROWS.btnRow, tileRow: ROWS.tileRow,
    renderRows: ROWS.renderRows
  };
})();
