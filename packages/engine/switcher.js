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

  /* ── Empty storybook — golden path: paths + copy prompt ─ */
  (function onboardEmpty() {
    if (!window.BRAND_MANIFEST) return;
    if ((window.GALLERY || []).length) return;
    if (window.BRAND_SECTIONS && window.BRAND_SECTIONS.length) return;
    if (window.BRAND_TOKENS && Object.keys(window.BRAND_TOKENS).length) return;

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

  /* ── Global settings ──────────────────────────────────────────────
     Language is a property of the tool, not the system: otherwise opening two
     design systems side by side would show the gallery in two languages. */
  var wsBtn   = document.getElementById('g-ws-settings');
  var wsScrim = document.getElementById('g-ws-scrim');
  if (wsBtn && wsScrim) {
    var select = document.getElementById('g-ws-locale');
    var packs = Object.keys(window.ENGINE_I18N || {});
    var manifestLoc = (window.BRAND_MANIFEST || {}).locale || 'en';
    var saved = R.settings().locale || '';

    /* Empty value means "as in the storybook": the engine takes the manifest locale.
       That is not the same as explicitly chosen English. */
    var auto = document.createElement('option');
    auto.value = '';
    auto.textContent = t('ws.language.auto', { loc: manifestLoc });
    select.appendChild(auto);

    packs.forEach(function (code) {
      var o = document.createElement('option');
      o.value = code;
      o.textContent = code.toUpperCase();
      select.appendChild(o);
    });
    select.value = saved;

    select.addEventListener('change', function () {
      R.saveSettings({ locale: select.value || null });
      /* Chrome strings are set on load — reload the whole page instead of
         hunting them down one by one. */
      location.reload();
    });

    /* Hidden library storybooks are restored from here — otherwise "remove"
       becomes a one-way door. */
    var hiddenRow = document.getElementById('g-ws-hidden');
    function paintHidden() {
      var n = R.hidden().length;
      /* An empty "nothing hidden" line says nothing: the setting exists only
         when there is something to restore. */
      hiddenRow.hidden = !n;
      if (!n) return;
      hiddenRow.querySelector('.js-count').textContent = t('ws.hidden', { n: n });
    }
    hiddenRow.querySelector('button').textContent = t('ws.hidden.show');
    hiddenRow.querySelector('button').addEventListener('click', function () {
      R.unhideAll();
      location.reload();
    });
    paintHidden();

    var wsCopyBtn = document.getElementById('g-ws-copy-prompt');
    if (wsCopyBtn) {
      wsCopyBtn.addEventListener('click', function () {
        R.ping().then(function (info) {
          var text = info && info.root
            ? workspacePrompt(info)
            : window.ENGINE_PROMPT.buildWorkspacePrompt({ galleryOrigin: location.origin });
          copyFeedback(wsCopyBtn, text);
        });
      });
    }

    wsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      wsScrim.hidden = false;
    });
    function closeWs() { wsScrim.hidden = true; }
    document.getElementById('g-ws-close').addEventListener('click', closeWs);
    wsScrim.addEventListener('click', function (e) { if (e.target === wsScrim) closeWs(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWs(); });
  }

  /* About — the whole tool: mark, name, version, two lines about what it is.
     A separate window, not a menu row: read rarely, but in full. */
  var about      = document.getElementById('g-about');
  var aboutScrim = document.getElementById('g-about-scrim');
  if (about && aboutScrim) {
    document.getElementById('g-about-ver').textContent =
      t('about.version', { v: B.version, c: B.contract });

    about.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      aboutScrim.hidden = false;
    });
    function closeAbout() { aboutScrim.hidden = true; }
    document.getElementById('g-about-close').addEventListener('click', closeAbout);
    aboutScrim.addEventListener('click', function (e) {
      if (e.target === aboutScrim) closeAbout();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAbout();
    });
  }

  /* Confirm by typing a word. "Are you sure?" gets clicked without reading, so
     irreversible actions require typing the word by hand. */
  function confirmWord(opts) {
    var scrim = document.getElementById('g-confirm-scrim');
    var input = document.getElementById('g-confirm-input');
    var ok    = document.getElementById('g-confirm-ok');
    var word  = t('confirm.word');

    document.getElementById('g-confirm-title').textContent = opts.title;
    document.getElementById('g-confirm-lead').textContent =
      t('confirm.lead', { word: word });
    document.getElementById('g-confirm-label').textContent = t('confirm.label');
    ok.textContent = opts.action;
    input.value = '';
    ok.disabled = true;
    scrim.hidden = false;
    input.focus();

    function check() { ok.disabled = input.value.trim().toLowerCase() !== word; }
    function close() {
      scrim.hidden = true;
      input.removeEventListener('input', check);
      ok.removeEventListener('click', accept);
    }
    function accept() { close(); opts.onConfirm(); }

    input.addEventListener('input', check);
    ok.addEventListener('click', accept);
    document.getElementById('g-confirm-cancel').onclick = close;
    scrim.onclick = function (e) { if (e.target === scrim) close(); };
  }

  /* Delete / remove — one confirm dialog for menu and settings danger zone. */
  var deleteCanEraseFolder = false;
  var deleteIsLibrary = !B.source.writable;

  function refreshDeleteLabels() {
    var erase = deleteIsLibrary && !deleteCanEraseFolder;
    var action = t(erase ? 'settings.remove' : 'settings.delete');
    var menuDel = document.getElementById('g-delete');
    if (menuDel) {
      var grow = menuDel.querySelector('.grow');
      if (grow) grow.textContent = action;
    }
    var delBtn = document.getElementById('g-settings-delete');
    var delHint = document.getElementById('g-settings-delete-hint');
    if (delBtn) delBtn.textContent = action;
    if (delHint) {
      delHint.textContent = t(
        erase ? 'settings.remove.hint'
          : (deleteIsLibrary ? 'settings.deleteFolder.hint' : 'settings.delete.hint')
      );
    }
  }

  if (deleteIsLibrary) {
    R.serverWritable().then(function (writable) {
      deleteCanEraseFolder = writable;
      refreshDeleteLabels();
    });
  }

  function promptDeleteLibra(opts) {
    opts = opts || {};
    var suiteId = B.source.id;
    var M2 = window.BRAND_MANIFEST || {};
    var displayName = R.displayName(suiteId, M2.title);
    var canDelete = deleteIsLibrary ? deleteCanEraseFolder : false;
    var removeOnly = deleteIsLibrary && !canDelete;

    confirmWord({
      title:  t(removeOnly ? 'confirm.removeTitle' : 'confirm.deleteTitle',
                { name: displayName }),
      action: t(removeOnly ? 'settings.remove' : 'settings.delete'),
      onConfirm: function () {
        function leave() { location.href = '/'; }

        if (B.source.kind === 'bundle') {
          B.source.release();
          R.deleteSuite(suiteId);
          leave();
          return;
        }
        if (canDelete) {
          R.deleteBrand(suiteId).then(leave, function (err) {
            if (opts.onError) opts.onError(err);
          });
          return;
        }
        if (deleteIsLibrary) R.hide(suiteId);
        R.forget(suiteId);
        leave();
      }
    });
  }

  var menuDelete = document.getElementById('g-delete');
  if (menuDelete) {
    menuDelete.disabled = false;
    refreshDeleteLabels();
    menuDelete.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      promptDeleteLibra({
        onError: function (err) {
          var delHint = document.getElementById('g-settings-delete-hint');
          var settingsScrim = document.getElementById('g-settings-scrim');
          if (delHint) delHint.textContent = t('settings.deleteFailed', { error: err.message });
          if (settingsScrim) settingsScrim.hidden = false;
        }
      });
    });
  }

  /* ── Storybook settings ──────────────────────────────────────────
     Name and comparison file belong to a specific system, so they live here,
     not in the gallery header. */
  var settingsBtn   = document.getElementById('g-settings');
  var settingsScrim = document.getElementById('g-settings-scrim');
  if (settingsBtn && settingsScrim) {
    var nameInput = document.getElementById('g-settings-name');
    var nameHint  = document.getElementById('g-settings-name-hint');
    var descInput = document.getElementById('g-settings-description');
    var M2 = window.BRAND_MANIFEST || {};

    var suiteId = B.source.id;      // folder id, not manifest.id — see brand.js
    nameInput.value = R.displayName(suiteId, M2.title);
    descInput.value = (M2.description && M2.description.trim()) || '';
    descInput.placeholder = t('libra.defaultDescription');

    /* For a library brand the name is local: the browser does not write to the
       manifest on disk. Renaming works, but it is labelled for what it is —
       not presented as editing the package. */
    if (!B.source.writable) nameHint.textContent = t('settings.nameFolder');

    /* Changes apply on Save, not on every keystroke: otherwise the dialog changes
       the system while the user is still thinking, with nothing to undo. The
       button stays disabled until something changed. */
    var designField = document.getElementById('g-settings-design');
    designField.value = (M2.design && M2.design.url) || '';

    var saveBtn   = document.getElementById('g-settings-save');
    var cancelBtn = document.getElementById('g-settings-cancel');
    var cssInput  = document.getElementById('g-css-file');
    var cssName   = document.getElementById('g-css-name');
    var cssClear  = document.getElementById('g-css-clear');
    var initialName = nameInput.value;
    var initialDescription = (M2.description && M2.description.trim()) || '';
    var initialHasCompareCss = !!R.compareCss(suiteId);
    var initialCompareName = (R.suiteSettings(suiteId) || {}).compareName || '';
    var cssChange = null;      // null | 'clear' | { text, name }

    var initialDesign = designField.value;

    function refreshCssUi() {
      if (cssChange === 'clear') cssName.textContent = '';
      else if (cssChange && cssChange.name) cssName.textContent = cssChange.name;
      else cssName.textContent = initialCompareName;

      var showClear = cssChange === 'clear' ? false
        : (cssChange && cssChange.name) ? true
        : initialHasCompareCss;
      if (cssClear) cssClear.hidden = !showClear;
    }

    function cssDirty() {
      if (cssChange === null) return false;
      if (cssChange === 'clear') return initialHasCompareCss;
      return true;
    }

    function dirty() {
      return nameInput.value.trim() !== initialName.trim() ||
             descInput.value.trim() !== initialDescription.trim() ||
             designField.value.trim() !== initialDesign.trim() ||
             cssDirty();
    }
    function refreshSave() { saveBtn.disabled = !dirty(); }
    nameInput.addEventListener('input', refreshSave);
    descInput.addEventListener('input', refreshSave);
    designField.addEventListener('input', refreshSave);

    /* File is only remembered: applied and saved on Save. */
    if (cssInput) cssInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      file.text().then(function (text) {
        cssChange = { text: text, name: file.name };
        refreshCssUi();
        refreshSave();
      });
    });

    if (cssClear) cssClear.addEventListener('click', function () {
      if (cssChange && cssChange.text) cssChange = initialHasCompareCss ? 'clear' : null;
      else if (initialHasCompareCss) cssChange = 'clear';
      else cssChange = null;
      if (cssInput) cssInput.value = '';
      refreshCssUi();
      refreshSave();
    });

    function applyName() {
      var value = nameInput.value.trim();
      /* For a package the name is part of it and travels with the file. For a
         folder the browser does not write to the manifest on disk, so the name is local. */
      if (B.source.kind === 'bundle') {
        var pack = R.bundle(suiteId);
        if (pack) {
          var m = JSON.parse(pack.files['manifest.json']);
          m.title = value || m.title;
          pack.files['manifest.json'] = JSON.stringify(m, null, 2);
          R.saveBundle(suiteId, pack, m.title);
        }
      }
      R.rename(suiteId, value);
      var shown = R.displayName(suiteId, M2.title);
      var logo = document.getElementById('g-logo');
      if (logo) logo.textContent = shown;
      document.title = shown;
      initialName = nameInput.value;
      refreshSave();
    }

    function applyCss() {
      if (cssChange === 'clear') {
        R.clearCompareCss(suiteId);
        if (window.GALLERY_API) window.GALLERY_API.setCompareCss(null, '');
        initialHasCompareCss = false;
        initialCompareName = '';
        cssChange = null;
        refreshCssUi();
        return;
      }
      if (!cssChange || !cssChange.text) return;
      window.GALLERY_API.setCompareCss(cssChange.text, cssChange.name);
      var problem = R.saveCompareCss(suiteId, cssChange.text, cssChange.name);
      if (problem) cssName.textContent = cssChange.name + ' — ' + t('settings.compare.tooBig');
      else {
        initialHasCompareCss = true;
        initialCompareName = cssChange.name;
      }
      cssChange = null;
      refreshCssUi();
    }

    /* Write the link into the manifest — to disk via the server or into the
       package in storage: it must survive reload and leave with the package. */
    function applyDescription() {
      var value = descInput.value.trim();
      if (value === initialDescription) return;
      initialDescription = value;
      var fields = value ? { description: value } : { description: null };
      R.saveManifest(suiteId, fields, B.source.kind === 'folder');
      if (value) M2.description = value;
      else delete M2.description;
      if (window.GALLERY_API && window.GALLERY_API.setDefaultTitle) {
        window.GALLERY_API.setDefaultTitle(value || t('libra.defaultDescription'));
      }
    }

    function applyDesign() {
      var value = designField.value.trim();
      if (value === initialDesign.trim()) return;
      initialDesign = value;
      var prev = M2.design || {};
      var design = null;
      if (value) {
        design = { url: value, source: prev.source || 'figma' };
      } else if (prev.source && prev.source !== 'blank') {
        design = { source: prev.source };
      }
      R.saveManifest(suiteId, { design: design }, B.source.kind === 'folder');
      if (design && design.url) M2.design = design;
      else if (!design) delete M2.design;
    }

    var settingsCopyBtn = document.getElementById('g-settings-copy-prompt');
    if (settingsCopyBtn) {
      settingsCopyBtn.addEventListener('click', function () {
        var run = function (brandPath, skillPath) {
          copyFeedback(settingsCopyBtn, fillPrompt({ brandPath: brandPath, skillPath: skillPath }));
        };
        if (B.source.kind === 'folder') {
          R.ping().then(function (info) {
            if (info && info.brandsRoot) {
              run(info.brandsRoot + '/' + B.source.id,
                  info.root + '/packages/engine/ENGINE_SKILL.md');
            } else run(B.source.base, new URL('ENGINE_SKILL.md', location.href).pathname);
          });
        } else {
          run('brands/' + B.source.id, new URL('ENGINE_SKILL.md', location.href).pathname);
        }
      });
    }

    saveBtn.addEventListener('click', function () {
      applyName();
      applyDescription();
      applyDesign();
      applyCss();
      refreshSave();
      settingsScrim.hidden = true;
    });
    function discard() {
      nameInput.value = initialName;   // typed but unsaved — discard
      descInput.value = initialDescription;
      designField.value = initialDesign;
      cssChange = null;
      if (cssInput) cssInput.value = '';
      refreshCssUi();
      refreshSave();
    }

    refreshCssUi();

    cancelBtn.addEventListener('click', function () {
      discard();
      settingsScrim.hidden = true;
    });

    var delBtn  = document.getElementById('g-settings-delete');
    var delHint = document.getElementById('g-settings-delete-hint');

    refreshDeleteLabels();

    delBtn.addEventListener('click', function () {
      settingsScrim.hidden = true;
      promptDeleteLibra({
        onError: function (err) {
          delHint.textContent = t('settings.deleteFailed', { error: err.message });
          settingsScrim.hidden = false;
        }
      });
    });

    settingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      settingsScrim.hidden = false;
    });
    function closeSettings() {
      discard();
      settingsScrim.hidden = true;
    }
    settingsScrim.addEventListener('click', function (e) {
      if (e.target === settingsScrim) closeSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSettings();
    });
  }

})();
