/* ==========================================================================
   Slice a CSS file for the section-head source badge.

   Badge text is brand data, not a path:
     "tokens.css §1–6"   numbered comment headings in that file
     "tokens.css"        the whole file
     "--r-*" / ".btn"    the file sections whose uncommented body matches
   The engine infers tokens vs components from the pattern, not from the brand.
   ========================================================================== */
(function () {
  'use strict';

  function patternRe(p) {
    var esc = String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc.replace(/\*/g, '[\\w-]*'));
  }

  function uncommented(s) {
    return String(s).replace(/\/\*[\s\S]*?\*\//g, '');
  }

  function commentOpenBefore(text, idx) {
    var open = text.lastIndexOf('/*', idx);
    if (open < 0) return idx;
    var close = text.indexOf('*/', open);
    return (close < 0 || close >= idx) ? open : idx;
  }

  /* Headings like "   1. Brand" / "   5b. …" inside comment blocks. */
  function numberedChunks(text) {
    var re = /^[ \t]*(\d+)([a-z])?\.[ \t]+\S/gm;
    var heads = [];
    var m;
    while ((m = re.exec(text))) {
      heads.push({ n: +m[1], letter: m[2] || '', index: m.index });
    }
    return heads.map(function (h, i) {
      var start = commentOpenBefore(text, h.index);
      var end = heads[i + 1] ? commentOpenBefore(text, heads[i + 1].index) : text.length;
      return { n: h.n, start: start, end: end, text: text.slice(start, end) };
    });
  }

  /* Blocks that start with a /* ===== banner (component files). */
  function bannerChunks(text) {
    var re = /\/\*[ \t]*=+[ \t]*\r?\n/g;
    var marks = [];
    var m;
    while ((m = re.exec(text))) marks.push(m.index);
    if (!marks.length) return [];
    marks.push(text.length);
    var out = [];
    for (var i = 0; i < marks.length - 1; i++) {
      out.push({ start: marks[i], end: marks[i + 1], text: text.slice(marks[i], marks[i + 1]) });
    }
    return out;
  }

  function matches(body, patterns) {
    var src = uncommented(body);
    return patterns.some(function (p) { return patternRe(p).test(src); });
  }

  function joinChunks(chunks) {
    return chunks.map(function (c) { return c.text.replace(/\s+$/, ''); })
      .filter(Boolean).join('\n\n') + (chunks.length ? '\n' : '');
  }

  function parse(code, cssFiles) {
    code = String(code || '').trim();
    cssFiles = cssFiles || {};
    var tokens = cssFiles.tokens || 'tokens.css';
    var components = cssFiles.components || 'components.css';

    var range = /^([\w./-]+\.css)\s*§\s*(\d+)(?:\s*[–—-]\s*(\d+))?/.exec(code);
    if (range) {
      return {
        kind: 'range',
        file: range[1],
        from: +range[2],
        to: +(range[3] || range[2])
      };
    }

    if (/\.css$/i.test(code) && !/\s/.test(code)) {
      return { kind: 'file', file: code };
    }

    var patterns = code.split(/\s*·\s*/).map(function (p) { return p.trim(); })
      .filter(Boolean);
    var tokenish = patterns.length && patterns.every(function (p) {
      return p.indexOf('--') === 0 || p.charAt(0) !== '.';
    });
    return {
      kind: 'pattern',
      file: tokenish ? tokens : components,
      patterns: patterns
    };
  }

  function slice(text, spec) {
    text = String(text || '');
    if (!spec || spec.kind === 'file') return text;
    if (spec.kind === 'range') {
      var numbered = numberedChunks(text).filter(function (c) {
        return c.n >= spec.from && c.n <= spec.to;
      });
      return numbered.length ? joinChunks(numbered) : text;
    }
    if (spec.kind === 'pattern' && spec.patterns && spec.patterns.length) {
      var groups = numberedChunks(text);
      if (groups.length < 2) groups = bannerChunks(text);
      var hit = groups.filter(function (c) { return matches(c.text, spec.patterns); });
      if (hit.length) return joinChunks(hit);
    }
    return text;
  }

  window.ENGINE_SRC_SLICE = { parse: parse, slice: slice };
})();
