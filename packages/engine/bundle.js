/* ==========================================================================
   Пакет дизайн-системы в памяти.

   Тот же контракт, что у папки (url / text / json / manifest), только файлы
   лежат не на сервере, а в объекте: так открывается сторибук, приехавший
   файлом. Формат — из BRAND-PACKAGE.md:

     { formatVersion, files: { "tokens.css": "…", "assets/i.svg": "…" } }

   Файлы хранятся строками: у нас всё текстовое (CSS, JSON, SVG). Двоичное
   появится вместе с растром — тогда сюда придёт data:-кодирование, а
   интерфейс источника не изменится.
   ========================================================================== */
(function () {
  'use strict';

  var FORMAT_VERSION = 1;

  /* Тип по расширению — для blob-URL: без него браузер не применит CSS
     и не покажет SVG. */
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
    /* Blob-URL живут, пока жива вкладка, поэтому кэшируем по файлу и даём
       способ отпустить их разом при переключении сторибука. */
    var urls = {};

    function norm(p) { return String(p || '').replace(/^\.\//, ''); }

    var source = {
      kind: 'bundle',
      id: id,
      base: '',            // базы нет: пути резолвит сам источник
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
        catch (e) { throw new Error('не разобрался JSON: ' + p + ' — ' + e.message); }
      },

      url: function (p) {
        var key = norm(p);
        if (/^(https?:)?\/\/|^data:|^blob:/.test(key)) return p;
        if (urls[key]) return urls[key];
        var body = files[key];
        if (body === undefined) return null;
        urls[key] = URL.createObjectURL(new Blob([body], { type: typeOf(key) }));
        return urls[key];
      },

      /* Отпустить выданные ссылки. Вызывается при смене сторибука: иначе
         за сессию накопятся сотни живых blob-URL. */
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

    /* Пустой пакет нужного вида — от него пляшут и «создать из шаблона»,
       и «создать из CSS». */
    empty: function () { return { formatVersion: FORMAT_VERSION, files: {} }; },

    /* Вес пакета в килобайтах: по нему решается, влезет ли он в хранилище. */
    sizeKb: function (pack) {
      return Math.round(JSON.stringify(pack).length / 1024);
    }
  };
})();
