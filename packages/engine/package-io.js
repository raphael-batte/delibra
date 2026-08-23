/* ==========================================================================
   Brand exchange: pack a libra into .lbr and read one back.

   One format only — a zip archive (BRAND-PACKAGE.md). Folder brands export
   through serve.js when available; local bundles zip in the browser.

   The CSS attached for comparison is NOT included: production code, not part
   of the system.
   ========================================================================== */
(function () {
  'use strict';

  var BUNDLE  = window.ENGINE_BUNDLE;
  var ARCHIVE = window.ENGINE_ARCHIVE;
  var REGISTRY = window.ENGINE_REGISTRY;

  function assetPaths(sections) {
    var found = {};
    JSON.stringify(sections || []).replace(/(?:src|href)=\\"([^"\\\\]+)/g, function (all, p) {
      if (/^(https?:|data:|blob:|#|\/|mailto:|tel:)/.test(p)) return all;
      if (!/\.[a-z0-9]{2,5}$/i.test(p)) return all;
      found[p] = 1;
      return all;
    });
    return Object.keys(found);
  }

  function readAll(source, manifest, sections) {
    var files = {};
    var wanted = [
      ['manifest.json', JSON.stringify(manifest, null, 2)],
      [manifest.css.tokens, null],
      [manifest.css.components, null],
      [manifest.sections || 'sections.json', null],
      [manifest.tokenMap, null],
      [manifest.legacyNames, null]
    ];

    function readText(path) {
      return Promise.resolve(source.text(path)).then(function (text) {
        return text;
      }).catch(function () { return null; });
    }

    function readAsset(p) {
      jobs.push(Promise.resolve().then(function () {
        if (source.kind === 'bundle') {
          var text = source.text(p);
          if (text != null) files[p] = text;
          return;
        }
        var url = source.url(p);
        if (!url) return;
        if (/^data:/.test(url)) {
          files[p] = url;
          return;
        }
        return fetch(url, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) return null;
          return r.arrayBuffer();
        }).then(function (buf) {
          if (!buf) return;
          var bytes = new Uint8Array(buf);
          files[p] = 'data:' + ARCHIVE.mimeOf(p) + ';base64,' + ARCHIVE.bytesToBase64(bytes);
        });
      }));
    }

    var jobs = wanted.filter(function (w) { return w[0]; }).map(function (w) {
      if (w[1] != null) { files[w[0]] = w[1]; return Promise.resolve(); }
      return readText(w[0]).then(function (text) {
        if (text != null) files[w[0]] = text;
      });
    });

    assetPaths(sections).forEach(function (p) {
      readAsset(p);
    });

    return Promise.all(jobs).then(function () { return files; });
  }

  function validateFiles(files) {
    var manifest;
    try { manifest = JSON.parse(files['manifest.json'] || 'null'); }
    catch (e) { return { error: 'badManifest', detail: e.message }; }
    if (!manifest || !manifest.css) return { error: 'badManifest' };

    var sectionsFile = manifest.sections || 'sections.json';
    var sections = null;
    if (files[sectionsFile]) {
      try { sections = JSON.parse(files[sectionsFile]); }
      catch (e) { return { error: 'badSections', detail: e.message }; }
      var problems = window.ENGINE_SECTIONS_CONTRACT.check(sections);
      if (problems.length) return { error: 'badSections', detail: problems[0] };
    }

    return {
      pack: { formatVersion: BUNDLE.FORMAT_VERSION, files: files },
      manifest: manifest,
      sections: sections
    };
  }

  function normalizeFilename(filename) {
    return filename.endsWith(ARCHIVE.EXT) ? filename : filename + ARCHIVE.EXT;
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Native save dialog when the browser supports it; otherwise <a download>. */
  function saveBlob(blob, filename) {
    var name = normalizeFilename(filename);
    if (typeof window.showSaveFilePicker !== 'function') {
      triggerDownload(blob, name);
      return Promise.resolve();
    }
    return window.showSaveFilePicker({
      suggestedName: name,
      types: [{
        description: 'DeLibra libra',
        accept: { 'application/zip': [ARCHIVE.EXT] }
      }]
    }).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable.write(blob).then(function () { return writable.close(); });
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      throw err;
    });
  }

  /* Ask where to save first — keeps the click gesture for showSaveFilePicker. */
  function pickSaveTarget(filename) {
    var name = normalizeFilename(filename);
    if (typeof window.showSaveFilePicker !== 'function') {
      return Promise.resolve({ mode: 'download' });
    }
    return window.showSaveFilePicker({
      suggestedName: name,
      types: [{
        description: 'DeLibra libra',
        accept: { 'application/zip': [ARCHIVE.EXT] }
      }]
    }).then(function (handle) {
      return { mode: 'handle', handle: handle, name: name };
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return { mode: 'cancelled' };
      throw err;
    });
  }

  function writePickTarget(pick, blob, suggestedName) {
    if (pick.mode === 'cancelled') return Promise.resolve();
    if (pick.mode === 'download') {
      triggerDownload(blob, normalizeFilename(suggestedName));
      return Promise.resolve();
    }
    return pick.handle.createWritable().then(function (writable) {
      return writable.write(blob).then(function () { return writable.close(); });
    });
  }

  window.ENGINE_PACKAGE = {
    ext: ARCHIVE.EXT,

    /* Storybook → files map (duplicate, local export fallback). */
    build: function (source, manifest, sections, name) {
      var m = JSON.parse(JSON.stringify(manifest));
      if (name) m.title = name;
      return readAll(source, m, sections).then(function (files) {
        var sectionsFile = m.sections || 'sections.json';
        /* Fallback export: in-memory catalog may be ahead of disk (unsaved agent work). */
        if (sections && sections.length) {
          var onDisk = files[sectionsFile];
          var empty = !onDisk || onDisk.trim() === '[]';
          if (empty) files[sectionsFile] = JSON.stringify(sections, null, 2);
        }
        files['manifest.json'] = JSON.stringify(m, null, 2);
        return { formatVersion: BUNDLE.FORMAT_VERSION, files: files };
      });
    },

    /* Files map → .lbr bytes. */
    zip: function (files) {
      return ARCHIVE.pack(ARCHIVE.filesToEntries(files));
    },

    /* .lbr bytes → validated package. */
    unzip: function (bytes) {
      var entries;
      try {
        entries = ARCHIVE.unpack(bytes);
      } catch (e) {
        return { error: 'notArchive', detail: e.message };
      }
      if (!entries['manifest.json']) return { error: 'notPackage' };
      return validateFiles(ARCHIVE.entriesToFiles(entries));
    },

    downloadBlob: function (blob, filename) {
      return saveBlob(blob, filename);
    },

    /* Pack object → .lbr download. */
    download: function (pack, filename) {
      var zip = ARCHIVE.pack(ARCHIVE.filesToEntries(pack.files));
      var blob = new Blob([zip], { type: ARCHIVE.MIME });
      return saveBlob(blob, filename);
    },

    /* Export a folder brand through serve.js. */
    exportFromServer: function (id) {
      return fetch('/__api/brand/' + encodeURIComponent(id) + '/export', { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
          return r.blob();
        });
    },

    /* Import .lbr into a new folder on serve.js. */
    importToServer: function (blob, title, slug) {
      var q = '?title=' + encodeURIComponent(title) + '&slug=' + encodeURIComponent(slug || title);
      return fetch('/__api/brand/import' + q, {
        method: 'POST',
        headers: { 'Content-Type': ARCHIVE.MIME },
        body: blob
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || r.status);
          return d.id;
        });
      });
    },

    /* Convenience: export current libra as .lbr. */
    exportStorybook: function (source, manifest, sections, filename) {
      var self = this;
      var name = filename || (source.id + ARCHIVE.EXT);

      function deliver(pick, blobPromise) {
        if (pick.mode === 'cancelled') return Promise.resolve();
        return blobPromise.then(function (blob) {
          return writePickTarget(pick, blob, name);
        });
      }

      function clientBlob() {
        return self.build(source, manifest, sections).then(function (pack) {
          return new Blob([ARCHIVE.pack(ARCHIVE.filesToEntries(pack.files))], { type: ARCHIVE.MIME });
        });
      }

      return pickSaveTarget(name).then(function (pick) {
        if (source.kind === 'bundle' && source.files) {
          var pack = { formatVersion: BUNDLE.FORMAT_VERSION, files: source.files };
          var blob = new Blob([ARCHIVE.pack(ARCHIVE.filesToEntries(pack.files))], { type: ARCHIVE.MIME });
          return writePickTarget(pick, blob, name);
        }

        if (source.kind === 'folder' && REGISTRY) {
          return REGISTRY.serverWritable().then(function (writable) {
            var blobPromise = writable
              ? self.exportFromServer(source.id).catch(function () { return clientBlob(); })
              : clientBlob();
            return deliver(pick, blobPromise);
          });
        }

        return deliver(pick, clientBlob());
      });
    }
  };
})();
