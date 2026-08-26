/* ==========================================================================
   Workspace settings and libra settings.

   Language, hidden libras, workspace prompt, About, confirm-by-typing,
   delete/remove, and the per-libra dialog (name, description, design URL,
   compare file). confirmWord / refreshDeleteLabels / promptDeleteLibra are
   shared by both dialogs, so they travel together.

   Browser only: window.ENGINE_SWITCHER_SETTINGS.init({ closeAll, copyFeedback,
   fillPrompt, workspacePrompt }). The script loads before switcher.js; init
   runs from there once those helpers exist.
   ========================================================================== */
(function (root) {
  'use strict';

  function init(deps) {
    var closeAll = deps.closeAll;
    var copyFeedback = deps.copyFeedback;
    var fillPrompt = deps.fillPrompt;
    var workspacePrompt = deps.workspacePrompt;
    var B = window.ENGINE_BRAND;
    var R = window.ENGINE_REGISTRY;
    var t = B.t;

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
      /* Clicks inside the sheet must not count as "outside". A field click
         bubbling to the scrim would close the dialog before the input focused. */
      var settingsDialog = settingsScrim.querySelector('.g-dialog');
      if (settingsDialog) {
        settingsDialog.addEventListener('click', function (e) { e.stopPropagation(); });
        settingsDialog.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      }
      settingsScrim.addEventListener('click', function (e) {
        if (e.target === settingsScrim) closeSettings();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSettings();
      });
    }

  }

  root.ENGINE_SWITCHER_SETTINGS = { init: init };
}(typeof self !== 'undefined' ? self : this));
