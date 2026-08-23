/* ==========================================================================
   Storybook registry.

   A storybook is a design-system instance open in the gallery. Two kinds:

     library — folder in brands/ on disk. Edited in the IDE, read-only from the
               browser; survives storage clears.
     local   — package created or imported in the browser. Edited by exchanging
               files; lives only in this browser.

   For now this is only the registry and active selection: in-memory packages
   will appear with the second BrandSource. The library list is read from
   brands/index.json — the browser cannot enumerate a folder itself.
   ========================================================================== */
(function () {
  'use strict';

  var ACTIVE_KEY   = 'ds:active';       // which storybook is open
  var HIDDEN_KEY   = 'ds:hidden';       // library storybooks removed from the list
  var SETTINGS_KEY = 'ds:settings';     // workspace-wide settings
  var SUITE_KEY    = 'ds:suite:';       // + id → settings for a specific one
  var BUNDLE_KEY   = 'ds:bundle:';      // + id → the package itself
  var LOCAL_KEY    = 'ds:local';        // list of local storybooks

  /* Per-package limit. Browser storage is a working copy, not an archive: what
     does not fit must leave as a file, not disappear silently. */
  var MAX_BUNDLE_KB = 1024;

  /* Path to brands/index.json is resolved from the engine folder, not the document:
     tests open the gallery from elsewhere. */
  var INDEX_URL = new URL('../../brands/index.json', document.baseURI).pathname;

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* Whether the server serving the gallery can work with folders.
     python3 -m http.server — no; packages/engine/serve.js — yes.
     We check once and cache the promise. */
  var pingPromise = null;
  function ping() {
    if (!pingPromise) {
      pingPromise = fetch('/__api/ping', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { writable: false }; })
        .catch(function () { return { writable: false }; });
    }
    return pingPromise;
  }
  function serverWritable() {
    return ping().then(function (d) { return !!d.writable; });
  }

  function brandPathFor(entry) {
    var cfg = window.ENGINE_CONFIG || {};
    if (cfg.brandUrlPrefix) {
      return cfg.brandUrlPrefix.replace(/\/+$/, '') + '/' + entry.id;
    }
    var legacy = entry.path || ('brands/' + entry.id);
    return '../../' + String(legacy).replace(/^\/+/, '');
  }

  function fetchIndex() {
    var cfg = window.ENGINE_CONFIG || {};
    var url = cfg.indexUrl || INDEX_URL;
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { brands: [] }; })
      .catch(function () { return { brands: [] }; });
  }

  var Registry = {
    serverWritable: serverWritable,
    ping: ping,

    brandRel: function (id) {
      var cfg = window.ENGINE_CONFIG || {};
      if (cfg.brandUrlPrefix) {
        return cfg.brandUrlPrefix.replace(/\/+$/, '') + '/' + id;
      }
      return '../../brands/' + id;
    },

    /* Create a brand folder. Only via our server: the page cannot create files
       on disk itself. Returns the final id — the server may resolve a collision
       and name the folder differently than the browser predicted. */
    createBrand: function (slug, title, files) {
      return fetch('/__api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, title: title, files: files })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || r.status);
          return d.id;
        });
      });
    },

    /* Copy every file under brands/<id>/ — not a re-scaffold. */
    duplicateBrand: function (sourceId, title, slug) {
      return fetch('/__api/brand/' + encodeURIComponent(sourceId) + '/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, slug: slug })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || r.status);
          return d.id;
        });
      });
    },

    /* Whether a design bridge is available nearby. Ask once: the answer does not
       change within a session, and there is no need to hit the network on every
       dialog step. */
    designSource: function () {
      if (!Registry.__design) {
        Registry.__design = fetch('/__api/design/source', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : { connected: false }; })
          .catch(function () { return { connected: false }; });
      }
      return Registry.__design;
    },

    designFiles: function () {
      return fetch('/__api/design/files', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .catch(function () { return { connected: false }; });
    },

    designVariables: function (fileKey) {
      return fetch('/__api/design/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: fileKey })
      }).then(function (r) { return r.json(); });
    },

    /* Write fields to the manifest. For a folder — via the server; for a package —
       directly in it: the browser does not write to disk files, but it does write
       to its own storage. */
    saveManifest: function (id, fields, isFolder) {
      if (!isFolder) {
        var pack = Registry.bundle(id);
        if (!pack) return Promise.resolve(false);
        var m = JSON.parse(pack.files['manifest.json']);
        Object.keys(fields || {}).forEach(function (k) {
          if (fields[k] === null) delete m[k];
          else m[k] = fields[k];
        });
        pack.files['manifest.json'] = JSON.stringify(m, null, 2);
        var problem = Registry.saveBundle(id, pack, m.title);
        return Promise.resolve(!problem);
      }
      return fetch('/__api/brand/' + encodeURIComponent(id) + '/manifest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    /* Write files into an existing storybook. Folder — via server; package —
       directly into storage: one interface, different paths. */
    saveFiles: function (id, files, isFolder) {
      if (!isFolder) {
        var pack = Registry.bundle(id);
        if (!pack) return Promise.resolve(false);
        Object.keys(files).forEach(function (name) { pack.files[name] = files[name]; });
        var m = JSON.parse(pack.files['manifest.json']);
        return Promise.resolve(!Registry.saveBundle(id, pack, m.title));
      }
      return fetch('/__api/brand/' + encodeURIComponent(id) + '/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files })
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    /* Reveal a file in the file manager — only via our server: the page cannot
       show anything on disk itself. */
    reveal: function (relPath) {
      return fetch('/__api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath })
      }).then(function (r) { return r.ok; });
    },

    /* Actually delete a brand folder. Only via our server: the page does not
       touch files on disk itself. */
    deleteBrand: function (id) {
      return fetch('/__api/brand/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
          Registry.forget(id);
          return true;
        });
    },

    /* Storybook list. Library — from index.json, local — from the browser
       (always empty for now: import is not done yet). */
    list: function () {
      return fetchIndex()
        .then(function (data) {
          var library = (data.brands || []).map(function (b) {
            return {
              id: b.id,
              title: b.title || b.id,
              origin: 'library',
              brandPath: brandPathFor(b)
            };
          });
          var hidden = Registry.hidden();
          return library
            .filter(function (b) { return hidden.indexOf(b.id) < 0; })
            .concat(Registry.localSuites());
        });
    },

    /* ── Local storybooks: packages living in this browser ─────────── */

    localSuites: function () {
      return readJSON(LOCAL_KEY, []).map(function (rec) {
        return {
          id: rec.id,
          title: Registry.displayName(rec.id, rec.title),
          origin: 'local',
          brandPath: null            // no disk path — opens via ?suite=
        };
      });
    },

    bundle: function (id) { return readJSON(BUNDLE_KEY + id, null); },

    /* Saving returns a problem description as a string or null. Silently losing a
       package is not allowed: the user believes they still have the system. */
    saveBundle: function (id, pack, title) {
      var size = window.ENGINE_BUNDLE.sizeKb(pack);
      if (size > MAX_BUNDLE_KB) return { error: 'tooBig', sizeKb: size, maxKb: MAX_BUNDLE_KB };
      try {
        localStorage.setItem(BUNDLE_KEY + id, JSON.stringify(pack));
      } catch (e) {
        return { error: 'quota', sizeKb: size };
      }
      var list = readJSON(LOCAL_KEY, []);
      if (!list.some(function (r) { return r.id === id; })) {
        list.push({ id: id, title: title || id });
        writeJSON(LOCAL_KEY, list);
      } else if (title) {
        writeJSON(LOCAL_KEY, list.map(function (r) {
          return r.id === id ? { id: id, title: title } : r;
        }));
      }
      return null;
    },

    deleteSuite: function (id) {
      try { localStorage.removeItem(BUNDLE_KEY + id); } catch (e) {}
      writeJSON(LOCAL_KEY, readJSON(LOCAL_KEY, []).filter(function (r) { return r.id !== id; }));
      Registry.forget(id);
    },

    /* Fresh id: human-readable root plus timestamp — sortable and does not
       collide with folders in brands/. */
    newId: function (title) {
      var root = String(title || 'storybook').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'storybook';
      return root + '-' + Date.now().toString(36);
    },

    /* A library storybook cannot be deleted: it lives as a folder on disk.
       It can only be removed from THIS gallery — the hidden list lives here,
       while the folder itself stays untouched. */
    hidden: function () { return readJSON(HIDDEN_KEY, []); },
    hide: function (id) {
      var list = Registry.hidden();
      if (list.indexOf(id) < 0) list.push(id);
      writeJSON(HIDDEN_KEY, list);
    },
    unhideAll: function () { writeJSON(HIDDEN_KEY, []); },

    /* Local storybook data: name, attached CSS. */
    forget: function (id) {
      try {
        localStorage.removeItem(SUITE_KEY + id);
        localStorage.removeItem(SUITE_KEY + id + ':css');
      } catch (e) {}
    },

    activeId: function () { return localStorage.getItem(ACTIVE_KEY) || null; },

    setActive: function (id) {
      try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
    },

    /* Global settings — about the tool: language, scale, live reload. */
    settings: function () {
      return readJSON(SETTINGS_KEY, { locale: null, scale: null, liveReload: true });
    },
    saveSettings: function (patch) {
      var next = Object.assign(Registry.settings(), patch || {});
      writeJSON(SETTINGS_KEY, next);
      return next;
    },

    /* Settings for a specific storybook — about the system: name, CSS for
       comparison, preview widths. For a library storybook only what is NOT in
       the folder lives here — otherwise browser state diverges from disk. */
    suiteSettings: function (id) {
      return readJSON(SUITE_KEY + id, {});
    },

    /* Name under which the storybook is shown in this gallery.
       For a library brand this is a LOCAL name: the browser does not write to
       the manifest on disk, so renaming lives in the registry and overrides the
       manifest title only on this machine. */
    displayName: function (id, fallback) {
      var own = (Registry.suiteSettings(id) || {}).name;
      return (own && own.trim()) || fallback || id;
    },
    rename: function (id, name) {
      Registry.saveSuiteSettings(id, { name: (name || '').trim() || null });
    },

    /* CSS for comparison is part of the storybook, not the session: attach once
       and it is still there on the next open. The file can be hundreds of kilobytes,
       so it is stored separately with an explicit error on quota overflow:
       silently losing an attached file is worse than saying it did not fit. */
    saveCompareCss: function (id, text, name) {
      try {
        localStorage.setItem(SUITE_KEY + id + ':css', text || '');
        Registry.saveSuiteSettings(id, { compareName: name || null });
        return null;
      } catch (e) {
        return e && e.name === 'QuotaExceededError' ? 'quota' : 'failed';
      }
    },
    compareCss: function (id) {
      try { return localStorage.getItem(SUITE_KEY + id + ':css') || null; }
      catch (e) { return null; }
    },
    clearCompareCss: function (id) {
      try { localStorage.removeItem(SUITE_KEY + id + ':css'); } catch (e) {}
      Registry.saveSuiteSettings(id, { compareName: null });
    },
    saveSuiteSettings: function (id, patch) {
      var next = Object.assign(Registry.suiteSettings(id), patch || {});
      writeJSON(SUITE_KEY + id, next);
      return next;
    },

    /* Switching = change the active one and reload the gallery with the new brand.
       A package has no disk path, so it opens via ?suite=.
       ?brand= remains a working address: tests and developers use it, and it must
       not depend on browser state. */
    open: function (suite) {
      /* Blob URLs live while the tab lives: when leaving a storybook, release them
         immediately, otherwise hundreds accumulate in memory over a session of switches. */
      var src = window.ENGINE_BRAND && window.ENGINE_BRAND.source;
      if (src && src.release) src.release();
      Registry.setActive(suite.id);
      location.href = Registry.addressOf(suite);
    },

    /* Storybook address. Short (/sdm) when the gallery is served by our server;
       otherwise the previous form with a parameter. A package has no folder — it
       always opens via ?suite=. */
    addressOf: function (suite) {
      if (!suite.brandPath) {
        return (window.ENGINE_SHORT_URLS ? '/packages/engine/gallery.html' : location.pathname) +
               '?suite=' + encodeURIComponent(suite.id);
      }
      if (window.ENGINE_SHORT_URLS) return '/' + suite.id;
      return location.pathname + '?brand=' + encodeURIComponent(suite.brandPath);
    }
  };

  window.ENGINE_REGISTRY = Registry;
})();
