/* ==========================================================================
   Token builder — one path from raw values to a storybook package.

   Both entrances end here: custom properties parsed out of a stylesheet, and
   variables read from a design file. Duplicating the grouping for each would
   let them drift, and the rule that matters is shared — no token is dropped,
   whatever the grouping guesses.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports
    ? require('./brand-scaffold.js')
    : root.ENGINE_SCAFFOLD);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_TOKEN_BUILD = api;
}(typeof self !== 'undefined' ? self : this, function (SCAFFOLD) {
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

  /* Group heading from the name prefix: --brand-blue → Brand. The author's
     own naming says more than any classification of ours. */
  function groupOf(name) {
    var parts = name.replace(/^--/, '').split('-');
    var head = parts.length > 1 ? parts[0] : 'other';
    return head.charAt(0).toUpperCase() + head.slice(1);
  }

  function label(name) {
    return name.replace(/^--/, '').replace(/-/g, ' ')
               .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* Section headings live in brand data, not in the UI, so they are English
     by convention — otherwise a package exported from a Russian gallery would
     carry Russian headings into an English one. */
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

  /* Parsed vars → a token-section descriptor shaped like token-map.json. */
  function toTokenMap(vars, note) {
    var all = {};
    ['base', 'desktop', 'mobile'].forEach(function (ctx) {
      Object.keys(vars[ctx] || {}).forEach(function (n) {
        if (all[n] === undefined) all[n] = vars[ctx][n];
      });
    });

    var names = Object.keys(all).sort();
    if (!names.length) return null;

    var colorGroups = {};   // heading → list of swatches
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
        /* Font size and spacing are indistinguishable by value, so go by name
           and use the number only for sorting: 10–96 is usually type. */
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
        /* The one place that says "no components yet" where it will be seen:
           the first section of the catalogue. */
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
      /* The type descriptor expects prefixed pairs (--font-h1 → -size/-lh).
         A foreign file rarely has them, so show a size table instead of
         pretending a scale came together. */
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


  /* Files of a token-only package: everything a storybook needs to open.
     Components are not here — a stylesheet or a variable list cannot say
     which rules are worth showing. */
  function buildPackage(vars, meta) {
    var built = toTokenMap(vars, meta.note || '');
    if (!built) return { error: 'noTokens' };

    var names = [];
    ['base', 'desktop', 'mobile'].forEach(function (ctx) {
      Object.keys(vars[ctx] || {}).forEach(function (n) {
        if (names.indexOf(n) < 0) names.push(n);
      });
    });

    /* Same shell as an empty storybook, only with tokens in it: the manifest
       shape lives in one place. */
    var manifest = SCAFFOLD.manifest({
      title: meta.title,
      design: meta.designUrl,
      source: meta.source
    });

    var why = {};
    names.forEach(function (n) { why[n] = meta.deferred || meta.note || ''; });

    return {
      files: {
        'manifest.json': JSON.stringify(manifest, null, 2),
        'tokens.css': meta.css || cssFrom(vars),
        'components.css': meta.note ? '/* ' + meta.note + ' */\n' : '',
        'token-map.json': JSON.stringify(built.map, null, 2),
        /* Declared but applied by nothing yet — true by construction here,
           and check-tokens would otherwise report every single one. */
        'tokens.deferred.json': JSON.stringify({
          _comment: meta.deferred || meta.note || '',
          tokens: names.slice().sort(),
          why: why
        }, null, 2),
        'sections.json': '[]'
      },
      count: built.count,
      title: meta.title
    };
  }

  /* A stylesheet for values that never came from one — design variables. */
  function cssFrom(vars) {
    function block(set, indent) {
      return Object.keys(set || {}).sort().map(function (n) {
        return indent + n + ': ' + set[n] + ';';
      }).join('\n');
    }
    var out = ':root {\n' + block(vars.base, '  ') + '\n}\n';
    if (Object.keys(vars.desktop || {}).length) {
      out += '\n@media (min-width: 901px) {\n  :root {\n' +
             block(vars.desktop, '    ') + '\n  }\n}\n';
    }
    if (Object.keys(vars.mobile || {}).length) {
      out += '\n@media (max-width: 900px) {\n  :root {\n' +
             block(vars.mobile, '    ') + '\n  }\n}\n';
    }
    return out;
  }

  return { buildPackage: buildPackage, cssFrom: cssFrom, TITLES: TITLES };
}));
