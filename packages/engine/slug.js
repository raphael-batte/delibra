/* ==========================================================================
   Слаг сторибука — общий для браузера и сервера.

   Слаг это одновременно имя папки и адрес: /sdm. Поэтому он латиницей, в
   нижнем регистре и без сюрпризов для файловой системы. Кириллицу
   транслитерируем, а не выбрасываем: «Мой бренд» должен стать /moy-brend,
   а не /storybook-2.

   Считают его двое: браузер показывает предсказание во втором шаге диалога,
   сервер выносит финал — только он знает, какие имена уже заняты. Правила
   обязаны совпадать, поэтому модуль один.
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

  /* Свободное имя рядом с занятыми: new-storybook → new-storybook-2.
     `taken` — массив или функция-предикат: сервер смотрит на диск, браузер
     на список сторибуков. */
  function unique(name, taken) {
    var busy = typeof taken === 'function'
      ? taken
      : function (s) { return (taken || []).indexOf(s) >= 0; };

    var base = slug(name);
    if (!busy(base)) return base;
    for (var n = 2; n < 1000; n++) {
      if (!busy(base + '-' + n)) return base + '-' + n;
    }
    /* Тысяча одноимённых — уже не про интерфейс: разводим временем. */
    return base + '-' + Date.now().toString(36);
  }

  return { slug: slug, unique: unique, FALLBACK: FALLBACK };
}));
