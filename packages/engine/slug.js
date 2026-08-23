/* ==========================================================================
   Storybook slug — shared by browser and server.

   The slug is both the folder name and the address (/sdm), so it stays lower
   case ASCII. Cyrillic is transliterated, not dropped: «Мой бренд» becomes
   /moy-brend rather than /storybook-2.

   Both sides compute it — the browser previews it in step two of the dialog,
   the server decides, since only it knows which names are taken.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_SLUG = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RU = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i',
    й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t',
    у:'u', ф:'f', х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'',
    э:'e', ю:'yu', я:'ya'
  };

  var FALLBACK = 'storybook';
  var MAX = 40;

  function slug(name) {
    var s = String(name == null ? '' : name).toLowerCase();

    s = s.replace(/[Ѐ-ӿ]/g, function (ch) {
      return RU[ch] !== undefined ? RU[ch] : '-';
    });

    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX)
         .replace(/-+$/, '');

    return s || FALLBACK;
  }

  /* A free name next to the taken ones: new-storybook → new-storybook-2.
     `taken` is an array or a predicate — disk on the server, list in the browser. */
  function unique(name, taken) {
    var busy = typeof taken === 'function'
      ? taken
      : function (s) { return (taken || []).indexOf(s) >= 0; };

    var base = slug(name);
    if (!busy(base)) return base;
    for (var n = 2; n < 1000; n++) {
      if (!busy(base + '-' + n)) return base + '-' + n;
    }
    /* A thousand of the same name is past UI territory: fall back to time. */
    return base + '-' + Date.now().toString(36);
  }

  return { slug: slug, unique: unique, FALLBACK: FALLBACK };
}));
