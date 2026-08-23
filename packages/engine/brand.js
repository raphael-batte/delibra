/* ==========================================================================
   Brand resolution.

   The engine never knows a design system by name: it arrives as an address,
   and manifest paths resolve from the BRAND folder, not the engine's. The
   gallery lives in packages/engine while tokens.css lives in brands/<id>, so
   without that step every relative path in a manifest would break.

   A brand must be served by the same http server as the gallery: its CSS is
   read over fetch. A brand from another repository works through a symlink.
   ========================================================================== */
(function () {
  'use strict';

  /* No default brand: an empty visit used to open the template silently, so
     people saw someone else's system instead of an offer to start their own. */

  /* Engine version and contract version are different things: the contract
     only moves when the manifest format breaks. See VERSIONING.md. */
  var ENGINE_VERSION = '1.0.0';
  var CONTRACT_MAJOR = 1;

  /* Where the storybook was opened from: /sdm is the address people see,
     ?brand= is the working entrance for tests and static servers, ?suite= is
     a package in the browser. The <base> tag is how we tell a short address
     from the engine's own path. */
  var qs = new URLSearchParams(location.search);
  var suiteId = qs.get('suite');
  var rel = qs.get('brand') || null;

  var short = null;
  if (!rel && !suiteId) {
    var servedShort = document.querySelector('base') &&
                      location.pathname.indexOf('/packages/') !== 0;
    var m = servedShort && location.pathname.match(/^\/([A-Za-z0-9._-]+)\/?$/);
    /* /new is the create screen, not a storybook: the word belongs to the
       interface, so a folder of that name cannot claim the address. */
    if (m && m[1] === 'new') m = null;
    if (m) {
      short = m[1];
      var cfg = window.ENGINE_CONFIG || {};
      if (cfg.brandUrlPrefix) {
        rel = cfg.brandUrlPrefix.replace(/\/+$/, '') + '/' + short;
      } else {
        rel = '../../brands/' + short;
      }
    }
  }

  window.ENGINE_SHORT_URLS = !!document.querySelector('base');

  function brandBase() {
    if (!rel) return '';
    // normalise to an absolute path with a trailing slash
    var url = new URL(rel.replace(/\/+$/, '') + '/', location.href);
    return url.pathname;
  }

  var base = brandBase();

  /* BrandSource: a folder on the server. url() gives an address the browser
     can load, text() the contents, manifest() the parsed manifest. */
  var SOURCE = {
    kind: 'folder',
    base: base,
    rel:  rel,

    /* Identity is the FOLDER, not manifest.id: a copied brand carries the
       original's id, and settings and deletion would address the original. */
    id: base.replace(/\/+$/, '').split('/').pop(),

    url: function (p) {
      if (!p) return null;
      if (/^(https?:)?\/\//.test(p) || p.charAt(0) === '/') return p;
      return base + String(p).replace(/^\.\//, '');
    },

    text: function (p) {
      return fetch(SOURCE.url(p), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + SOURCE.url(p));
        return r.text();
      });
    },

    /* Synchronous because the gallery assembles itself in one pass while the
       document loads. Missing file returns null: optional parts are normal. */
    json: function (p, bust) {
      if (!p) return null;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SOURCE.url(p) + (bust || ''), false);
      try { xhr.send(); } catch (e) { return null; }
      if (xhr.status && xhr.status >= 400) return null;
      try { return JSON.parse(xhr.responseText); }
      catch (e) {
        throw new Error('could not parse JSON: ' + SOURCE.url(p) + ' — ' + e.message);
      }
    },

    manifest: function () { return window.BRAND_MANIFEST || null; },

    /* Whether the browser may edit this storybook. A folder is edited in an
       IDE, so writing from the gallery would drift from disk. */
    writable: false
  };

  /* A package replaces the folder wholesale — same interface, so nothing
     downstream knows the difference. */
  var missingSuite = false;
  if (suiteId && window.ENGINE_BUNDLE && window.ENGINE_REGISTRY) {
    var pack = window.ENGINE_REGISTRY.bundle(suiteId);
    if (pack) SOURCE = window.ENGINE_BUNDLE.source(suiteId, pack);
    /* A link to a package only works where the package is; elsewhere it must
       say so rather than show an empty gallery. */
    else missingSuite = true;
  }

  window.ENGINE_VERSION = ENGINE_VERSION;

  window.ENGINE_BRAND = {
    version:  ENGINE_VERSION,
    suiteId:  suiteId,
    missingSuite: missingSuite,
    contract: CONTRACT_MAJOR,

    /* Returns a sentence explaining the mismatch, or null when compatible. */
    incompatible: function (m) {
      if (!m) return 'Brand manifest not found.';
      var need = m.engine;
      if (need === undefined) return null;          // pre-contract brands stay openable
      if (Number(need) === CONTRACT_MAJOR) return null;
      return 'Brand "' + (m.id || '?') + '" targets engine contract v' + need +
             ', this engine speaks v' + CONTRACT_MAJOR + '.';
    },

    get base() { return SOURCE.base; },
    get rel()  { return SOURCE.rel; },

    /* A path inside the brand to an absolute one. Kept as a thin wrapper
       because loaders and brand sections call it. */
    path: function (p) { return SOURCE.url(p); },

    /* Folder on the server or package in memory — one interface, so the rest
       of the engine never branches on it. See BRAND-PACKAGE.md. */
    get source() { return SOURCE; },

    /* localStorage key, scoped per storybook (folder name or package id) */
    key: function (name) { return SOURCE.id + ':' + name; },

    /* The chrome's language, not the brand's: the workspace setting wins and
       manifest.locale is only its default. Otherwise two systems side by side
       would speak two languages. */
    locale: function () {
      var chosen = window.ENGINE_REGISTRY && window.ENGINE_REGISTRY.settings().locale;
      if (chosen) return chosen;
      return (window.BRAND_MANIFEST && window.BRAND_MANIFEST.locale) || 'en';
    },

    /* A localised string with substitutions: t('pane.mobile', {w: 390}) */
    t: function (key, vars) {
      var packs = window.ENGINE_I18N || {};
      var loc = window.ENGINE_BRAND.locale();
      var s = (packs[loc] && packs[loc][key]);
      if (s === undefined) s = (packs.en && packs.en[key]);   // fall back to English
      if (s === undefined) return key;                         // a missing key stays visible
      return vars ? s.replace(/\{(\w+)\}/g, function (m, n) {
        return vars[n] !== undefined ? vars[n] : m;
      }) : s;
    },

    isReference: function () {
      return SOURCE.id === '_template';
    }
  };
})();
