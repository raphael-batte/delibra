/* ==========================================================================
   Контракт «бренд ↔ движок».

   Хром галереи нарисован токенами бренда: заголовки, границы, ссылки, фон.
   Если бренд их не объявил, галерея открывается — и выглядит сломанной без
   единой ошибки в консоли. Поэтому список обязательных имён проверяется явно
   и одинаково для всех брендов, включая шаблон.
   ========================================================================== */
(function () {
  'use strict';

  var REQUIRED = [
    '--bg', '--white-pure', '--white-pure-rgb',   // хром шапки: rgb(var(--white-pure-rgb) / .88)
    '--border',
    '--text-primary', '--text-heading', '--text-muted',
    '--blue', '--font-family'
  ];

  /* Манифест: поля, без которых движку нечего грузить. */
  var REQUIRED_MANIFEST = ['id', 'title', 'css'];

  window.H.contractTests = function () {
    var H = window.H;

    H.g('Контракт бренда');

    H.t('манифест объявляет обязательные поля', function () {
      var m = H.gallery().win.BRAND_MANIFEST || {};
      var missing = REQUIRED_MANIFEST.filter(function (k) { return !m[k]; });
      H.eq(missing.length, 0, 'нет полей: ' + missing.join(', '));
      H.ok(m.css.tokens && m.css.components, 'css.tokens и css.components обязательны');
    });

    H.t('бренд объявляет токены, которыми нарисован хром', function () {
      var win = H.gallery().win;
      var root = win.getComputedStyle(win.document.documentElement);
      var missing = REQUIRED.filter(function (n) {
        return !String(root.getPropertyValue(n)).trim();
      });
      H.eq(missing.length, 0, 'не объявлены: ' + missing.join(', '));
    });

    H.t('версия контракта совпадает с движковой', function () {
      var win = H.gallery().win;
      var problem = win.ENGINE_BRAND.incompatible(win.BRAND_MANIFEST);
      H.eq(problem, null, problem || '');
    });

    H.t('бренд не тянет файлы из-за пределов своей папки', function () {
      var win = H.gallery().win, doc = H.gallery().doc;
      var base = win.ENGINE_BRAND.base;
      var stray = [];
      doc.querySelectorAll('iframe').forEach(function (f) {
        var d;
        try { d = f.contentDocument; } catch (e) { return; }
        if (!d) return;
        d.querySelectorAll('img[src]').forEach(function (img) {
          var u = new URL(img.getAttribute('src'), d.baseURI).pathname;
          if (u.indexOf(base) !== 0) stray.push(u);
        });
      });
      H.eq(stray.length, 0, 'ссылки наружу: ' + stray.slice(0, 3).join(', '));
    });
  };
})();
