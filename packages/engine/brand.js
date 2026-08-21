/* ──────────────────────────────────────────────────────────────────────────
   Резолюция бренда.

   Движок нигде не знает имени дизайн-системы: она приходит параметром
   ?brand=<путь>, и все пути манифеста приводятся к абсолютным ОТ ПАПКИ
   БРЕНДА, а не от папки движка. Это принципиально: gallery.html и
   _frame.html лежат в packages/engine, а tokens.css — в brands/<id>,
   поэтому любой относительный путь из манифеста без этого шага порвётся.

   Бренд обязан отдаваться тем же http-сервером, что и галерея: движок
   читает CSS через fetch и вкидывает его в iframe. Для бренда из чужого
   репозитория достаточно симлинка внутрь brands/.
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var DEFAULT_BRAND = '../../brands/sdm';

  /* Версия движка и версия контракта — разные вещи.
     ENGINE_VERSION растёт с каждым релизом движка (SemVer).
     CONTRACT_MAJOR меняется только когда ломается формат манифеста:
     бренд объявляет `engine: 1`, и движок отказывается его открывать,
     если цифры разошлись. Это дешевле, чем ловить пустой экран. */
  var ENGINE_VERSION = '1.0.0';
  var CONTRACT_MAJOR = 1;

  var rel = new URLSearchParams(location.search).get('brand') || DEFAULT_BRAND;

  function brandBase() {
    var p = rel;
    // нормализуем к абсолютному пути с завершающим слэшем
    var url = new URL(p.replace(/\/+$/, '') + '/', location.href);
    return url.pathname;
  }

  var base = brandBase();

  window.ENGINE_VERSION = ENGINE_VERSION;

  window.ENGINE_BRAND = {
    version:  ENGINE_VERSION,
    contract: CONTRACT_MAJOR,

    /* Несовместимость возвращается строкой-объяснением, null — если всё в порядке. */
    incompatible: function (m) {
      if (!m) return 'Brand manifest not found.';
      var need = m.engine;
      if (need === undefined) return null;          // старые бренды не блокируем
      if (Number(need) === CONTRACT_MAJOR) return null;
      return 'Brand "' + (m.id || '?') + '" targets engine contract v' + need +
             ', this engine speaks v' + CONTRACT_MAJOR + '.';
    },

    base: base,      // абсолютный путь: /brands/sdm/
    rel:  rel,       // как бренд был указан — это и передаём фрейму

    /* путь внутри бренда → абсолютный */
    path: function (rel) {
      if (!rel) return null;
      if (/^(https?:)?\/\//.test(rel) || rel.charAt(0) === '/') return rel;
      return base + String(rel).replace(/^\.\//, '');
    },

    /* ключ localStorage, разведённый по брендам */
    key: function (name) {
      var id = (window.BRAND_MANIFEST && window.BRAND_MANIFEST.id) || 'brand';
      return id + ':' + name;
    },

    /* строка локали с подстановками: t('pane.mobile', {w: 390}) */
    t: function (key, vars) {
      var packs = window.ENGINE_I18N || {};
      var loc = (window.BRAND_MANIFEST && window.BRAND_MANIFEST.locale) || 'en';
      var s = (packs[loc] && packs[loc][key]);
      if (s === undefined) s = (packs.en && packs.en[key]);   // фолбэк на английский
      if (s === undefined) return key;                         // видно, что ключа нет
      return vars ? s.replace(/\{(\w+)\}/g, function (m, n) {
        return vars[n] !== undefined ? vars[n] : m;
      }) : s;
    }
  };
})();
