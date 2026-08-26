/* ==========================================================================
   Storybook switcher — behaviour of the two menus.

   Tile   → workspace: create, switch.
   Chevron → active storybook: export, delete.

   Items whose mechanics are not built yet (create, import, delete local)
   are shown disabled with a "not built yet" label. That is intentional: an
   empty menu does not explain what will happen, and a live item that does
   nothing is misleading.
   ========================================================================== */
(function () {
  'use strict';

  var B = window.ENGINE_BRAND;
  var R = window.ENGINE_REGISTRY;
  var t = B.t;

  /* On an empty first visit there is no manifest: substitute the tool name so
     the header is not blank. */
  if (!window.BRAND_MANIFEST) {
    var logoEl = document.getElementById('g-logo');
    if (logoEl) logoEl.textContent = t('product.name');
    document.title = t('product.name');
  }

  var mark  = document.getElementById('g-mark');
  var name  = document.getElementById('g-name');
  var menuW = document.getElementById('g-menu-workspace');
  var menuS = document.getElementById('g-menu-suite');
  if (!mark || !name) return;

  if (B.isReference && B.isReference()) {
    ['g-delete', 'g-settings'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  /* ── Open and close ──────────────────────────────────────────── */
  function closeAll() {
    [menuW, menuS].forEach(function (m) { m.classList.remove('is-open'); });
    [mark, name].forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  function toggle(trigger, menu) {
    return function (e) {
      e.stopPropagation();
      var wasOpen = menu.classList.contains('is-open');
      closeAll();
      if (wasOpen) return;
      var r = trigger.getBoundingClientRect();
      menu.style.top  = (r.bottom + 6) + 'px';
      menu.style.left = r.left + 'px';
      menu.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    };
  }

  mark.addEventListener('click', toggle(mark, menuW));
  name.addEventListener('click', toggle(name, menuS));
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  /* ── Workspace menu: home, settings — lib list lives on Home screen ─ */
  R.list().then(function (suites) {
    /* Nothing to show — open creation immediately: an empty gallery does not
       explain what to do next. The condition is deliberate: if the address is
       explicit (?brand= or ?suite=), the user knows where they were going and
       the dialog gets in the way — even when the list is empty. */
    /* Open the creation dialog when there is nothing to show or when the user
       arrived at /new from the home screen. */
    var opened = B.source.rel || B.suiteId;
    if (!opened || location.pathname === '/new') openNew();

    /* The address points to a package missing in this browser: usually a link
       sent from another machine. Say so plainly and offer to create a system,
       instead of showing an empty gallery. */
    if (B.missingSuite) {
      openNew();                                   // open first,
      showError('missingSuite', { id: B.suiteId }); // then explain: openNew
    }                                              // clears the previous error

    var current = B.source.base;      // absolute path of the open folder

    suites.forEach(function (suite) {
      if (!suite.brandPath) return;
      var suiteBase = new URL(suite.brandPath.replace(/\/+$/, '') + '/', location.href).pathname;
      if (suiteBase === current) R.setActive(suite.id);
    });
  });

  /* ── Actions on the active storybook ────────────────────────────────────────── */
  /* ── New storybook ────────────────────────────────────────────────
     One dialog for three branches: create and import are one intent — splitting
     them into menu items means choosing before showing options. It also serves
     as the empty-start screen. */
  var newScrim = document.getElementById('g-new-scrim');
  var newError = document.getElementById('g-new-error');

  function openNew() {
    newScrim.hidden = false;
    /* Always start with scenario choice: a dialog left mid-flow from the last
       visit is a source of errors, not a click saved. */
    backToChoices();
  }
  function closeNew() {
    newScrim.hidden = true;
    /* Cancelling creation must not leave the user on a blank screen: if there is
       nothing behind the dialog — go to the storybook list. Previously Cancel on
       /new just closed the window and left a bare gallery. */
    var opened = B.source.rel || B.suiteId;
    if (!opened || location.pathname === '/new') location.href = '/';
  }

  /* Open and close. Handlers sit next to the functions themselves: last time
     they moved away with a cut block and the menu item silently stopped working —
     exactly what tests now guard against. */
  document.getElementById('g-new').addEventListener('click', function (e) {
    e.stopPropagation();
    closeAll();
    openNew();
  });
  var homeBtn = document.getElementById('g-home');
  if (homeBtn) {
    homeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      location.href = '/';
    });
  }
  document.getElementById('g-new-close').addEventListener('click', closeNew);
  newScrim.addEventListener('click', function (e) { if (e.target === newScrim) closeNew(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !newScrim.hidden) closeNew();
  });

  function showError(key, vars) {
    newError.textContent = t('new.failed', { error: t('new.err.' + key, vars || {}) });
    newError.hidden = false;
  }

  /* ── Second step: name, address, file ──────────────────────────────────
     Scenario chosen — next ask what all three branches need and show the future
     address before creation, not after. */
  var step2   = document.getElementById('g-new-step2');
  var choices = newScrim.querySelector('.g-choices');
  var nameInput2 = document.getElementById('g-new-name');
  var addressEl  = document.getElementById('g-new-address');
  var addressRow = document.getElementById('g-new-address-row');
  var sourceRow  = document.getElementById('g-new-source');
  var srcInput   = document.getElementById('g-new-src-file');
  var srcName    = document.getElementById('g-new-src-name');
  var designInput = document.getElementById('g-new-design');
  var designRow   = document.getElementById('g-new-design-row');
  var createBtn  = document.getElementById('g-new-create');
  var backBtn    = document.getElementById('g-new-back');
  var leadEl     = document.getElementById('g-new-lead');

  var scenario = null;    // 'blank' | 'css' | 'import'
  var srcText  = null;    // contents of the chosen CSS file
  var srcBlob  = null;    // .lbr for import

  function refreshAddress() {
    var title = nameInput2.value.trim();
    var hasName = title.length > 0;
    if (addressRow) addressRow.hidden = !hasName;
    if (hasName) {
      addressEl.textContent = '/' + window.ENGINE_SLUG.slug(title);
    } else {
      addressEl.textContent = '';
    }
    var needsFile = scenario === 'css' ? !srcText : (scenario === 'import' ? !srcBlob : false);
    createBtn.disabled = !hasName || needsFile;
  }
  nameInput2.addEventListener('input', refreshAddress);

  srcInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (scenario === 'import') {
      srcBlob = file;
      srcText = null;
      srcName.textContent = file.name;
      if (!nameInput2.__touched) {
        nameInput2.value = file.name.replace(/\.[^.]+$/, '');
      }
      refreshAddress();
      return;
    }
    file.text().then(function (text) {
      srcText = text;
      srcBlob = null;
      srcName.textContent = file.name;
      /* Filename is a better guess at the title than "New storybook", but only
         until the user typed their own. */
      if (!nameInput2.__touched) {
        nameInput2.value = file.name.replace(/\.[^.]+$/, '');
      }
      refreshAddress();
    });
  });
  nameInput2.addEventListener('input', function () { nameInput2.__touched = true; });

  var SCENARIO_HINT = { blank: 'fromDesign', css: 'fromCss', import: 'import' };

  function step(which) {
    scenario = which;
    srcText = null;
    srcBlob = null;
    srcName.textContent = '';
    srcInput.value = '';
    nameInput2.__touched = false;
    nameInput2.value = which === 'blank' ? t('new.blank.name') : '';
    designInput.value = '';
    srcInput.accept = which === 'css' ? '.css,text/css'
      : (which === 'import' ? '.lbr,.dsz,application/zip' : '');

    choices.hidden = true;
    step2.hidden = false;
    sourceRow.hidden = which === 'blank';
    if (designRow) designRow.hidden = which !== 'blank';
    createBtn.hidden = false;
    backBtn.hidden = false;
    newError.hidden = true;
    if (leadEl) leadEl.textContent = t('new.' + (SCENARIO_HINT[which] || which) + '.hint');
    refreshAddress();
    nameInput2.focus();
  }

  /* Back to the first step. Separate function because the dialog opens the same
     way: state must match regardless of where we came from. */
  function backToChoices() {
    scenario = null;
    srcText = null;
    srcBlob = null;
    srcName.textContent = '';
    srcInput.value = '';
    choices.hidden = false;
    step2.hidden = true;
    createBtn.hidden = true;
    backBtn.hidden = true;
    newError.hidden = true;
    if (leadEl) leadEl.textContent = t('new.lead');
  }

  backBtn.addEventListener('click', backToChoices);

  /* Assemble storybook files by scenario. All three branches then share one path:
     give the server a folder; if that fails — store a package in the browser. */
  function filesFor(title) {
    if (scenario === 'css') {
      var css = window.ENGINE_CSS_IMPORT.build(srcText, srcName.textContent, t, title);
      return css.error ? { error: css.error } : { files: css.pack.files };
    }
    if (scenario === 'import') {
      return { error: 'internal' };
    }

    /* Empty means empty. The shell itself lives in brand-scaffold.js, shared
       with the server so both sides create the same storybook. */
    return window.ENGINE_SCAFFOLD.emptyPackage({
      title: title,
      design: designInput.value.trim(),
      source: designInput.value.trim() ? 'figma' : 'blank'
    });
  }

  /* Shared path: assembled files → folder on the server or package in the browser.
     Used by both the Create button and variable import from the bridge. */
  function create(files, title) {
    var built = { files: files };

    createBtn.disabled = true;
    R.serverWritable().then(function (writable) {
      if (writable) {
        return R.createBrand(window.ENGINE_SLUG.slug(title), title, built.files)
          .then(function (id) {
            R.setActive(id);
            location.href = R.addressOf({ id: id, brandPath: R.brandRel(id) });
          });
      }
      /* Static hosting cannot create a folder: store a package in the browser and
         say so plainly — otherwise the user waits for the agent to do the impossible. */
      var pack = window.ENGINE_BUNDLE.empty();
      pack.files = built.files;
      var id = R.newId(title);
      var problem = R.saveBundle(id, pack, title);
      if (problem) { showError(problem.error, problem); createBtn.disabled = false; return; }
      R.setActive(id);
      location.href = R.addressOf({ id: id, brandPath: null });
    }).catch(function (err) {
      showError('createFailed', { error: err.message });
      createBtn.disabled = false;
    });
  }

  createBtn.addEventListener('click', function () {
    var title = nameInput2.value.trim();

    if (scenario === 'import' && srcBlob) {
      createBtn.disabled = true;
      var slug = window.ENGINE_SLUG.slug(title);
      R.serverWritable().then(function (writable) {
        if (writable) {
          return window.ENGINE_PACKAGE.importToServer(srcBlob, title, slug)
            .then(function (id) {
              R.setActive(id);
              R.rename(id, title);
              location.href = R.addressOf({ id: id, brandPath: R.brandRel(id) });
            });
        }
        return srcBlob.arrayBuffer().then(function (buf) {
          var res = window.ENGINE_PACKAGE.unzip(new Uint8Array(buf));
          if (res.error) { showError(res.error, res); createBtn.disabled = false; return; }
          var files = Object.assign({}, res.pack.files);
          var m = JSON.parse(files['manifest.json']);
          m.title = title;
          files['manifest.json'] = JSON.stringify(m, null, 2);
          create(files, title);
        });
      }).catch(function (err) {
        showError('createFailed', { error: err.message });
        createBtn.disabled = false;
      });
      return;
    }

    var built = filesFor(title);
    if (built.error) { showError(built.error, built); return; }
    create(built.files, title);
  });

  document.getElementById('g-new-blank').addEventListener('click', function () { step('blank'); });
  document.getElementById('g-new-css').addEventListener('click', function () { step('css'); });
  document.getElementById('g-new-file').addEventListener('click', function () { step('import'); });

  function copyFeedback(btn, text) {
    navigator.clipboard.writeText(text).then(function () {
      var was = btn.textContent;
      btn.textContent = t('prompt.copied');
      setTimeout(function () { btn.textContent = was; }, 1200);
    });
  }

  function galleryUrl() {
    return window.ENGINE_SHORT_URLS
      ? location.origin + '/' + B.source.id
      : location.href.split('#')[0];
  }

  function fillPrompt(opts) {
    return window.ENGINE_PROMPT.buildFillPrompt({
      brandId: B.source.id,
      brandPath: opts.brandPath || '',
      skillPath: opts.skillPath || 'packages/engine/ENGINE_SKILL.md',
      manifest: window.BRAND_MANIFEST,
      galleryUrl: galleryUrl()
    });
  }

  function workspacePrompt(info) {
    return window.ENGINE_PROMPT.buildWorkspacePrompt({
      root: info.root,
      brandsRoot: info.brandsRoot,
      galleryOrigin: location.origin,
      skillPath: info.root + '/packages/engine/ENGINE_SKILL.md'
    });
  }

  function cssHasTokens() {
    var M = window.BRAND_MANIFEST || {};
    var file = M.css && M.css.tokens;
    if (!file || !B.source || typeof B.source.url !== 'function') return false;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', B.source.url(file) + (window.GALLERY_BUST || ''), false);
    try { xhr.send(); } catch (e) { return false; }
    if (xhr.status && xhr.status >= 400) return false;
    var body = String(xhr.responseText || '').replace(/\/\*[\s\S]*?\*\//g, '');
    return /--[\w-]+\s*:/.test(body);
  }

  /* ── Empty storybook — golden path: paths + copy prompt ─ */
  (function onboardEmpty() {
    if (!window.BRAND_MANIFEST) return;
    if ((window.GALLERY || []).length) return;
    if (window.BRAND_SECTIONS && window.BRAND_SECTIONS.length) return;
    if (window.BRAND_TOKENS && Object.keys(window.BRAND_TOKENS).length) return;
    /* Home counts tokens.css. Same rule here: one custom property is enough
       to leave the onboard screen. token-map.json may still be empty. */
    if (cssHasTokens()) return;

    var folder = B.source.kind === 'folder';
    var scroll = document.getElementById('g-panel');
    var onboard = document.getElementById('g-onboard');
    var repoField = document.getElementById('g-onboard-repo-field');
    var folderEl = document.getElementById('g-onboard-folder');
    var delibraEl = document.getElementById('g-onboard-delibra');
    var repoEl = document.getElementById('g-onboard-repo');
    var noFolderEl = document.getElementById('g-onboard-no-folder');
    var copyBtn = document.getElementById('g-copy-prompt');
    var settingsBtn = document.getElementById('g-onboard-settings');

    var paths = { repo: '', folder: '', delibra: galleryUrl() };

    function setPath(key, value) {
      paths[key] = value;
      var el = key === 'folder' ? folderEl : (key === 'repo' ? repoEl : delibraEl);
      if (el) el.textContent = value;
    }

    setPath('delibra', galleryUrl());

    var ctx = {
      brandPath: folder ? B.source.base : ('brands/' + B.source.id),
      skillPath: new URL('ENGINE_SKILL.md', location.href).pathname
    };

    function refreshPrompt() {
      if (copyBtn) copyBtn._prompt = fillPrompt(ctx);
    }
    refreshPrompt();

    onboard.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn || btn.disabled) return;
      var key = btn.getAttribute('data-copy');
      if (paths[key]) copyFeedback(btn, paths[key]);
    });

    if (settingsBtn) {
      settingsBtn.addEventListener('click', function () {
        var scrim = document.getElementById('g-settings-scrim');
        if (scrim) scrim.hidden = false;
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!copyBtn._prompt || copyBtn.disabled) return;
        copyFeedback(copyBtn, copyBtn._prompt);
      });
    }

    if (folder) {
      setPath('folder', ctx.brandPath);
      if (repoField) repoField.hidden = false;
    } else {
      setPath('folder', t('badge.browserOnly'));
      noFolderEl.hidden = false;
      if (copyBtn) copyBtn.disabled = true;
    }

    onboard.hidden = false;
    if (scroll) scroll.classList.add('g-scroll--empty');
    var sections = document.getElementById('g-sections');
    if (sections) sections.hidden = true;
    var panel = scroll && scroll.closest('.g-panel');
    if (panel) panel.classList.add('g-panel--empty');
    var shell = document.querySelector('.g-shell');
    if (shell) shell.classList.add('g-shell--empty');

    if (folder) R.ping().then(function (info) {
      if (!info || !info.brandsRoot) return;
      ctx.brandPath = info.brandsRoot + '/' + B.source.id;
      ctx.skillPath = info.root + '/packages/engine/ENGINE_SKILL.md';
      setPath('folder', ctx.brandPath);
      setPath('repo', info.root);
      refreshPrompt();
    });
  })();

  /* ── Show system CSS ──────────────────────────────────────────
     Someone using a design system should see its code, not only the result:
     otherwise "where does this live?" has to be asked. */
  function showCode(file) {
    if (!file) return;

    var folder = B.source.kind === 'folder';
    var path = folder ? B.source.base + file : null;

    Promise.resolve(B.source.text(file)).then(function (text) {
      window.GALLERY_API_FILE({
        title: file,
        path: path || t('badge.browserOnly'),
        text: text || '',
        actions: '<button class="g-copy" data-copy-file>' + t('overlay.copyCss') + '</button>' +
                 (folder ? '<button class="g-copy" data-reveal>' + t('menu.reveal') + '</button>' : '')
      });

      var actions = document.getElementById('g-ov-actions');
      actions.querySelector('[data-copy-file]').addEventListener('click', function (e) {
        navigator.clipboard.writeText(text || '').then(function () {
          var was = e.target.textContent;
          e.target.textContent = t('menu.codeCopied');
          setTimeout(function () { e.target.textContent = was; }, 1200);
        });
      });

      /* Reveal file in Finder: the gallery shows the system, but edits happen in
         files — otherwise the user hunts for the path by hand. */
      var revealBtn = actions.querySelector('[data-reveal]');
      if (revealBtn) revealBtn.addEventListener('click', function () {
        R.reveal(B.source.base + file).then(function (ok) {
          if (ok) return;
          revealBtn.textContent = t('menu.revealFailed');
        });
      });
    });
  }

  function wireView(btnId, field) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      var css = (window.BRAND_MANIFEST || {}).css || {};
      showCode(css[field]);
    });
  }
  wireView('g-view-tokens', 'tokens');
  wireView('g-view-components', 'components');

  /* ── Duplicate ───────────────────────────────────────────────────
     Full copy as a new libra. Folder sources export the whole tree via
     serve.js; bundles copy in memory. */
  (function duplicateLibra() {
    var dupScrim = document.getElementById('g-dup-scrim');
    var dupName  = document.getElementById('g-dup-name');
    var dupError = document.getElementById('g-dup-error');
    var dupCreate = document.getElementById('g-dup-create');
    var dupCancel = document.getElementById('g-dup-cancel');
    var dupBtn = document.getElementById('g-duplicate');
    if (!dupScrim || !dupBtn) return;

    function refreshDupCreate() {
      dupCreate.disabled = !dupName.value.trim();
    }

    function closeDup() {
      dupScrim.hidden = true;
      dupError.hidden = true;
      dupCreate.disabled = false;
    }

    function openDup() {
      var M = window.BRAND_MANIFEST || {};
      dupName.value = R.displayName(B.source.id, M.title) + t('menu.copySuffix');
      dupError.hidden = true;
      refreshDupCreate();
      dupScrim.hidden = false;
      dupName.focus();
      dupName.select();
    }

    function packFiles(pack, title) {
      var files = Object.assign({}, pack.files);
      var m = JSON.parse(files['manifest.json']);
      m.title = title;
      delete m.id;
      m.design = Object.assign({}, m.design || {}, {
        source: 'duplicate',
        duplicatedFrom: B.source.id
      });
      files['manifest.json'] = JSON.stringify(m, null, 2);
      return files;
    }

    function goToBrand(id, brandPath) {
      R.setActive(id);
      location.href = R.addressOf({ id: id, brandPath: brandPath });
    }

    function copySuiteSettings(fromId, toId, newTitle) {
      var settings = R.suiteSettings(fromId);
      if (settings && Object.keys(settings).length) {
        var copy = Object.assign({}, settings);
        delete copy.name;
        R.saveSuiteSettings(toId, copy);
      }
      var css = R.compareCss(fromId);
      if (css) {
        R.saveCompareCss(toId, css, (settings || {}).compareName);
      }
      if (newTitle) R.rename(toId, newTitle);
    }

    function runDuplicate(title) {
      var slug = window.ENGINE_SLUG.slug(title);
      var M = window.BRAND_MANIFEST || {};
      var sourceId = B.source.id;
      dupCreate.disabled = true;
      dupError.hidden = true;

      R.serverWritable().then(function (writable) {
        if (writable && B.source.kind === 'folder') {
          return R.duplicateBrand(sourceId, title, slug)
            .catch(function () {
              return window.ENGINE_PACKAGE.exportFromServer(sourceId)
                .catch(function () {
                  return window.ENGINE_PACKAGE.build(B.source, M, window.BRAND_SECTIONS || [], title)
                    .then(function (pack) {
                      return new Blob([window.ENGINE_PACKAGE.zip(pack.files)], {
                        type: window.ENGINE_ARCHIVE.MIME
                      });
                    });
                })
                .then(function (blob) {
                  return window.ENGINE_PACKAGE.importToServer(blob, title, slug);
                });
            })
            .then(function (id) {
              copySuiteSettings(sourceId, id, title);
              goToBrand(id, R.brandRel(id));
            });
        }

        var packPromise;
        if (B.source.kind === 'bundle' && B.source.files) {
          packPromise = Promise.resolve({
            formatVersion: window.ENGINE_BUNDLE.FORMAT_VERSION,
            files: JSON.parse(JSON.stringify(B.source.files))
          });
        } else {
          packPromise = window.ENGINE_PACKAGE.build(B.source, M, window.BRAND_SECTIONS || [], title);
        }

        return packPromise.then(function (pack) {
          var files = packFiles(pack, title);
          if (writable) {
            return R.createBrand(slug, title, files).then(function (id) {
              copySuiteSettings(sourceId, id, title);
              goToBrand(id, R.brandRel(id));
            });
          }
          var id = R.newId(title);
          var problem = R.saveBundle(id, {
            formatVersion: pack.formatVersion || window.ENGINE_BUNDLE.FORMAT_VERSION,
            files: files
          }, title);
          if (problem) throw new Error(t('new.err.' + problem.error, problem));
          copySuiteSettings(sourceId, id, title);
          goToBrand(id, null);
        });
      }).catch(function (err) {
        dupError.textContent = t('duplicate.failed', { error: (err && err.message) || err });
        dupError.hidden = false;
        dupCreate.disabled = !dupName.value.trim();
      });
    }

    dupBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      openDup();
    });
    dupCancel.addEventListener('click', closeDup);
    dupScrim.addEventListener('click', function (e) { if (e.target === dupScrim) closeDup(); });
    dupName.addEventListener('input', refreshDupCreate);
    dupCreate.addEventListener('click', function () {
      var title = dupName.value.trim();
      if (!title) return;
      runDuplicate(title);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dupScrim.hidden) closeDup();
    });
  })();

  /* ── Export as file ──────────────────────────────────────────────── */
  (function () {
    var exportBtn = document.getElementById('g-export');
    if (!exportBtn) return;
    var exportLabel = exportBtn.querySelector('.grow');
    exportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      var M = window.BRAND_MANIFEST || {};
      window.ENGINE_PACKAGE.exportStorybook(
        B.source,
        M,
        window.BRAND_SECTIONS || [],
        B.source.id + window.ENGINE_PACKAGE.ext
      ).catch(function (err) {
        if (!exportLabel) return;
        var was = exportLabel.textContent;
        exportLabel.textContent = t('export.failed', { error: (err && err.message) || err });
        setTimeout(function () { exportLabel.textContent = was; }, 2500);
      });
    });
  })();

  window.ENGINE_SWITCHER_SETTINGS.init({
    closeAll: closeAll,
    copyFeedback: copyFeedback,
    fillPrompt: fillPrompt,
    workspacePrompt: workspacePrompt
  });

})();
