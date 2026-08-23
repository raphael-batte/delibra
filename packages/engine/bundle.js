/* ==========================================================================
   Design-system package in memory.

   Same contract as a folder (url / text / json / manifest), but the files sit
   in an object rather than on a server — this is how a storybook that arrived
   as a file opens. Format: see BRAND-PACKAGE.md:

     { formatVersion, files: { "tokens.css": "…", "assets/i.svg": "…" } }

   Files are kept as strings: everything here is text (CSS, JSON, SVG). Binary
   arrives with raster images — then data: encoding lands here and the source
   interface stays the same.
   ========================================================================== */
(function () {
  'use strict';

  var FORMAT_VERSION = 1;

  /* Type by extension — required for blob URLs, or the browser will not apply
     the CSS or render the SVG. */
  var TYPES = {
    css:  'text/css',
    json: 'application/json',
    svg:  'image/svg+xml',
    js:   'text/javascript',
    md:   'text/markdown'
  };

  function typeOf(path) {
    var ext = String(path).split('.').pop().toLowerCase();
    return TYPES[ext] || 'text/plain';
  }

  function makeSource(id, pack) {
    var files = (pack && pack.files) || {};
    /* Blob URLs live as long as the tab, so cache per file and offer a way to
       release them all when switching storybooks. */
    var urls = {};

    function norm(p) { return String(p || '').replace(/^\.\//, ''); }

    var source = {
      kind: 'bundle',
      id: id,
      base: '',            // no base: the source resolves paths itself
      rel: 'suite:' + id,
      writable: true,
      files: files,

      has: function (p) { return Object.prototype.hasOwnProperty.call(files, norm(p)); },

      text: function (p) {
        var v = files[norm(p)];
        return v === undefined ? null : v;
      },

      json: function (p) {
        var v = source.text(p);
        if (v == null) return null;
        try { return JSON.parse(v); }
        catch (e) { throw new Error('could not parse JSON: ' + p + ' — ' + e.message); }
      },

      url: function (p) {
        var key = norm(p);
        if (/^(https?:)?\/\/|^data:|^blob:/.test(key)) return p;
        if (urls[key]) return urls[key];
        var body = files[key];
        if (body === undefined) return null;
        if (/^data:/.test(body)) return body;
        urls[key] = URL.createObjectURL(new Blob([body], { type: typeOf(key) }));
        return urls[key];
      },

      /* Release the handed-out URLs. Called when switching storybooks, or a
         session accumulates hundreds of live blob URLs. */
      release: function () {
        Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); });
        urls = {};
      },

      manifest: function () { return source.json('manifest.json'); }
    };

    return source;
  }

  window.ENGINE_BUNDLE = {
    FORMAT_VERSION: FORMAT_VERSION,
    typeOf: typeOf,
    source: makeSource,

    /* An empty package of the right shape — the starting point for both
       "create from template" and "create from CSS". */
    empty: function () { return { formatVersion: FORMAT_VERSION, files: {} }; },

    /* Package size in kilobytes: decides whether it fits in storage. */
    sizeKb: function (pack) {
      return Math.round(JSON.stringify(pack).length / 1024);
    }
  };
})();
