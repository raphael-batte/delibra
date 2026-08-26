/* ==========================================================================
   Parse :root custom properties from a stylesheet.

   Three buckets: base (outside @media), mobile (max-width), desktop (min-width).
   mobileMax is the largest max-width found — that number is libra data when
   written to the manifest, not an engine default.

   Works in node (module.exports) and in the browser (window.ENGINE_PARSE_VARS).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_PARSE_VARS = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseVars(css) {
    var ctx = { base: {}, desktop: {}, mobile: {} };
    css = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');

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

    var rest = '', cursor = 0;
    spans.forEach(function (sp) { rest += css.slice(cursor, sp.from); cursor = sp.to; });
    rest += css.slice(cursor);
    collect(rest, ctx.base);

    spans.forEach(function (sp) {
      var body = css.slice(sp.bodyFrom, sp.to - 1);
      var maxM = sp.cond.match(/max-width\s*:\s*(\d+)/);
      var minM = sp.cond.match(/min-width\s*:\s*(\d+)/);
      /* max-width wins when both appear: that block is the mobile range. */
      if (maxM) {
        var n = parseInt(maxM[1], 10);
        collect(body, ctx.mobile);
        if (n > 0 && (ctx.mobileMax == null || n > ctx.mobileMax)) ctx.mobileMax = n;
      } else if (minM) {
        collect(body, ctx.desktop);
      }
    });
    return ctx;
  }

  return { parseVars: parseVars };
}));
