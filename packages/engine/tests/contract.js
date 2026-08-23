/* ==========================================================================
   The brand ↔ engine contract.

   The gallery chrome is drawn with brand tokens: headings, borders, links,
   background. If a brand does not declare them the gallery still opens and
   simply looks broken, without a single console error — so the required names
   are checked explicitly, for every brand including the template.
   ========================================================================== */
(function () {
  'use strict';

  var REQUIRED = [
    '--bg', '--white-pure', '--white-pure-rgb',   // header chrome: rgb(var(--white-pure-rgb) / .88)
    '--border',
    '--text-primary', '--text-heading', '--text-muted',
    '--blue', '--font-family'
  ];

  /* Manifest: the fields without which the engine has nothing to load. */
  var REQUIRED_MANIFEST = ['id', 'title', 'css'];

  window.H.contractTests = function () {
    var H = window.H;

    H.g('Brand contract');

    H.t('manifest declares the required fields', function () {
      var m = H.gallery().win.BRAND_MANIFEST || {};
      var missing = REQUIRED_MANIFEST.filter(function (k) { return !m[k]; });
      H.eq(missing.length, 0, 'missing fields: ' + missing.join(', '));
      H.ok(m.css.tokens && m.css.components, 'css.tokens and css.components are required');
    });

    H.t('brand declares the tokens the chrome is drawn with', function () {
      var win = H.gallery().win;
      var root = win.getComputedStyle(win.document.documentElement);
      var missing = REQUIRED.filter(function (n) {
        return !String(root.getPropertyValue(n)).trim();
      });
      H.eq(missing.length, 0, 'not declared: ' + missing.join(', '));
    });

    H.t('contract version matches the engine', function () {
      var win = H.gallery().win;
      var problem = win.ENGINE_BRAND.incompatible(win.BRAND_MANIFEST);
      H.eq(problem, null, problem || '');
    });

    H.t('brand does not pull files from outside its folder', function () {
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
      H.eq(stray.length, 0, 'outside links: ' + stray.slice(0, 3).join(', '));
    });
  };
})();
