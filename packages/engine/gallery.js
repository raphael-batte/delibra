/* ==========================================================================
   Storybook engine
   --------------------------------------------------------------------------
   Sections are described in gallery-specs.js (window.GALLERY).
   Each example renders in iframe _frame.html: mobile viewport (default 900px)
   and desktop at the brand preview width. The catalogue row is 100% of the
   pane; viewport width applies only to the specimen so real @media fires.
   ========================================================================== */
(function () {
  'use strict';

  var B = window.ENGINE_BRAND;

  /* No storybook open — nothing to draw a catalog from. Normal case (first visit,
     link to someone else's package), not an error: the gallery stays quiet and
     switcher shows the creation screen. Without this check the engine crashed
     building sections without a brand — and switcher never started, so the user
     saw a blank screen with no explanation. */
  if (!window.ENGINE_SPECS || !window.BRAND_MANIFEST) {
    window.GALLERY = [];
    return;
  }

  /* Catalog = token sections (engine draws them from the brand descriptor)
     plus the brand's component sections. Composition lives here, not in the brand:
     otherwise every new brand must remember to attach tokens. */
  var SPECS = window.ENGINE_SPECS.tokenSections(window.BRAND_TOKENS)
                .concat(window.BRAND_SECTIONS || []);
  window.GALLERY = SPECS;
  var M = window.BRAND_MANIFEST || {};
  var t = B.t;

  /* Desktop frame is the brand's real viewport: only there does the container
     get its width and a 3-column grid gives honest columns. Value comes from the
     manifest; the engine has no default of its own. */
  var PREVIEW = M.preview || {};
  var DESKTOP_W = PREVIEW.desktopWidth || 1440;
  var MOBILE_W  = PREVIEW.mobileWidth  || 390;
  var CONTAINER = PREVIEW.container    || 1170;

  /* Preview scale is per panel: 50 / 75 / 100 %.
     Shared default from localStorage (starts at 75%), but choosing in one panel
     changes only that panel. */
  var SCALE_KEY = B.key('gallery-scale');   // keys scoped per brand
  var defaultScale = parseFloat(localStorage.getItem(SCALE_KEY) || '0.75');
  if (!(defaultScale > 0)) defaultScale = 0.75;

  /* Gallery always renders the design system (tokens.css + components.css).
     The "New DS / Current site" switch is gone: it changed styles inside previews,
     but token sections did not depend on it, and components missing from styles.css
     showed bare markup — that looked broken, not like comparison. Use the
     "Compare with code" toggle for comparison. */
  var mode = 'new';

  /* ── Frame registry ────────────────────────────────────────────────── */
  var frames = [];
  var frameSeq = 0;

  function post(iframe, msg) {
    if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
  }

  /* ── Single place where previews are created ─────────────────────────
     Any object render — mobile, desktop, or hidden reference for comparison —
     is the same _frame.html. Only width and CSS set differ. All wiring lives
     below: URL with cache-buster and g:css → g:render handshake. Do not
     duplicate it — it will drift. */
  function mountFrame(opts) {
    var id = opts.id || ('f' + (++frameSeq));
    var iframe = document.createElement('iframe');
    /* For a folder the frame loads the manifest and CSS links itself — path
       is enough. A package has no server files: URL stays bare and styles arrive
       by message right after load. */
    var fromFolder = B.source.kind === 'folder';
    iframe.src = '_frame.html?' + (fromFolder ? 'brand=' + encodeURIComponent(B.rel) + '&' : '') +
                 'css=' + opts.cssMode + '&id=' + id +
                 (opts.surface === 'dark' ? '&surface=dark' : '') +
                 (opts.embed ? '&embed=1' : '') +
                 (window.GALLERY_BUST ? '&' + window.GALLERY_BUST.slice(1) : '');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', opts.title || 'preview');
    iframe.style.width = opts.width + 'px';

    var rec = { id: id, iframe: iframe, width: opts.width, ready: false };

    iframe.addEventListener('load', function () {
      var w = iframe.contentWindow;
      if (!w) return;
      if (!fromFolder) {
        w.postMessage({
          type: 'g:brandcss',
          tokens: B.source.text(M.css.tokens) || '',
          components: B.source.text(M.css.components) || '',
          container: CONTAINER,
          font: (M.font && M.font.href) || null
        }, '*');
      }
      if (opts.userCss) w.postMessage({ type: 'g:usercss', text: opts.userCss }, '*');
      else if (fromFolder) w.postMessage({ type: 'g:css', mode: opts.cssMode }, '*');
      w.postMessage({ type: 'g:render', html: assetUrls(opts.html) }, '*');
      // give a frame for styles to apply, then signal ready
      setTimeout(function () {
        rec.ready = true;
        if (rec.onready) rec.onready(rec);
      }, opts.settle || 0);
    });
    return rec;
  }

  /* Asset paths in example markup. Folder resolves them via <base> in the frame;
     package has no base — substitute blob URLs for in-memory files. */
  function assetUrls(html) {
    if (!html || B.source.kind === 'folder') return html;
    return String(html).replace(/(src|href)="([^"]+)"/g, function (all, attr, path) {
      if (/^(https?:|data:|blob:|#|\/)/.test(path)) return all;
      var url = B.source.url(path);
      return url ? attr + '="' + url + '"' : all;
    });
  }

  /* Visible preview in a gallery column */
  function makeFrame(html, width, isDesktop, surface) {
    var wrap = document.createElement('div');
    wrap.className = 'g-frame-wrap' + (surface === 'dark' ? ' g-frame-wrap--dark' : '');

    var rec = mountFrame({ html: html, width: width, cssMode: mode, surface: surface, embed: true });
    rec.iframe.className = 'g-frame' + (isDesktop ? ' g-frame--desktop' : '');
    rec.wrap = wrap;
    wrap.appendChild(rec.iframe);
    bindHits(rec);
    rec.html = html;
    rec.desktop = isDesktop;
    rec.scale = defaultScale;
    frames.push(rec);
    return rec;
  }

  /* Catalogue row is 100% of the pane. Viewport width is only the iframe
     (so brand @media still sees 900 / 1440). Highlight is painted here. */
  function bindHits(rec) {
    var layer = document.createElement('div');
    layer.className = 'g-row-hits';
    rec.wrap.insertBefore(layer, rec.iframe);
    rec.hits = layer;
    rec.wrap.addEventListener('mousemove', function (e) {
      var k = rec.scale || 1;
      var visW = rec.iframe.getBoundingClientRect().width;
      var rect = rec.wrap.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x <= visW) return;
      var y = (e.clientY - rect.top) / k;
      var boxes = rec.rowBoxes || [];
      var idx = -1;
      for (var i = 0; i < boxes.length; i++) {
        if (y >= boxes[i].y && y < boxes[i].y + boxes[i].h) { idx = i; break; }
      }
      setHit(rec, idx);
    });
    rec.wrap.addEventListener('mouseleave', function () { setHit(rec, -1); });
    rec.wrap.addEventListener('click', function (e) {
      var k = rec.scale || 1;
      var visW = rec.iframe.getBoundingClientRect().width;
      var rect = rec.wrap.getBoundingClientRect();
      if (e.clientX - rect.left <= visW) return;
      var y = (e.clientY - rect.top) / k;
      var boxes = rec.rowBoxes || [];
      for (var i = 0; i < boxes.length; i++) {
        if (y >= boxes[i].y && y < boxes[i].y + boxes[i].h) {
          post(rec.iframe, { type: 'g:pickrow', index: i });
          break;
        }
      }
    });
  }

  function paintHits(rec) {
    if (!rec.hits) return;
    rec.hits.innerHTML = '';
    (rec.rowBoxes || []).forEach(function () {
      var hit = document.createElement('div');
      hit.className = 'g-row-hit';
      rec.hits.appendChild(hit);
    });
    layoutHits(rec);
  }

  function layoutHits(rec) {
    if (!rec.hits) return;
    var k = rec.scale || 1;
    var kids = rec.hits.children;
    var boxes = rec.rowBoxes || [];
    for (var i = 0; i < kids.length; i++) {
      var b = boxes[i];
      if (!b) continue;
      kids[i].style.top = (b.y * k) + 'px';
      kids[i].style.height = (b.h * k) + 'px';
    }
  }

  function setHit(rec, idx) {
    if (!rec.hits) return;
    Array.prototype.forEach.call(rec.hits.children, function (el, i) {
      el.classList.toggle('is-on', i === idx);
    });
  }

  /* One scale for BOTH panels.
     Previously mobile drew 1:1 and desktop shrank with transform to column width.
     In a narrow window desktop hit ~60% and a 52px button looked SMALLER than
     mobile 48px — sizes could not be compared. Now both panels scale the same,
     factor shown in the label, and 1:1 disables shrinking entirely. */
  /* Scale is chosen manually: 50 / 75 / 100 %. At 100% a wide desktop panel may
     not fit the column — right edge is clipped (overflow: hidden), height follows
     content. Auto-shrink is forbidden: panels would land at different scales and
     comparing sizes would be impossible — exactly the old bug. */
  /* Scale is the same number in both panes so a 52px button is comparable.
     Viewport width is only for the specimen: mobile iframe stays 900/390 so
     @media (max-width: 900px) fires. The outer row is 100% of the pane —
     desktop iframe is sized so after scale it fills the wrap, and does not
     inherit the mobile viewport. */
  function applyFrameScale(f) {
    var k = f.scale || defaultScale;
    f.wrap.style.width = '100%';
    f.wrap.style.overflow = 'hidden';
    if (f.desktop) {
      var paneW = f.wrap.clientWidth;
      var cssW = (k && paneW) ? paneW / k : f.width;
      f.iframe.style.width = cssW + 'px';
    } else {
      f.iframe.style.width = f.width + 'px';
    }
    f.iframe.style.transform = k === 1 ? 'none' : 'scale(' + k + ')';
    if (f.contentH) f.wrap.style.height = (f.contentH * k) + 'px';
    layoutHits(f);
  }

  function applyScale() { frames.forEach(applyFrameScale); }


  /* ── Messages from frames ──────────────────────────────────────────── */
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    var rec = frames.filter(function (f) { return f.id === d.frameId; })[0];

    if (d.type === 'g:height' && rec) {
      rec.contentH = d.height;
      rec.rowBoxes = d.rows || rec.rowBoxes;
      rec.iframe.style.height = d.height + 'px';
      rec.wrap.style.height = d.height * (rec.scale || defaultScale) + 'px';
      paintHits(rec);
    }
    else if (d.type === 'g:rowhover' && rec) setHit(rec, d.index);
    else if (d.type === 'g:pick') openOverlay(d);
  });

  /* ── Code overlay ───────────────────────────────────────────────── */
  var ov = document.getElementById('g-overlay');
  var ovBody = document.getElementById('g-ov-body');
  var current = null, tab = 'html';

  function openOverlay(d) {
    current = d;
    document.getElementById('g-ov-toolbar').hidden = false;
    document.getElementById('g-ov-tabs').hidden = false;
    document.getElementById('g-ov-actions').innerHTML = '';
    document.getElementById('g-ov-title').textContent = d.name || t('overlay.component');
    document.getElementById('g-ov-sel').textContent = d.selector || '';
    ov.classList.add('is-open');
    document.body.classList.add('g-no-scroll');
    paintTab();
  }
  function closeOverlay() {
    ov.classList.remove('is-open');
    document.body.classList.remove('g-no-scroll');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function paintTab() {
    if (!current) return;
    Array.prototype.forEach.call(document.querySelectorAll('#g-ov-tabs button'), function (b) {
      b.classList.toggle('is-on', b.dataset.tab === tab);
    });

    var actions = document.getElementById('g-ov-tab-actions');
    actions.innerHTML = '';

    if (tab === 'html') {
      actions.innerHTML =
        '<button class="g-copy" data-copy>' + t('overlay.copyHtml') + '</button>';
      ovBody.innerHTML = '<pre class="g-code">' + esc(current.html) + '</pre>';
    } else {
      var body = '';
      if (current.cssBlocked) {
        body += '<div class="g-hint">' + t('overlay.fileProtocol') + '</div>';
      } else if (!current.css) {
        body += '<div class="g-hint">' + t('overlay.noRules') + '</div>';
      } else {
        actions.innerHTML =
          '<button class="g-copy" data-copy>' + t('overlay.copyCss') + '</button>';
        body += '<pre class="g-code">' + esc(current.css) + '</pre>';
      }
      if (current.tokens && current.tokens.length) {
        body += '<div class="g-token-list"><h4>' + t('overlay.tokens') + '</h4><table class="g-table">' +
          current.tokens.map(function (tok) {
            return '<tr><td><code>' + esc(tok.name) + '</code></td><td><code>' + esc(tok.value) + '</code></td></tr>';
          }).join('') + '</table></div>';
      }
      ovBody.innerHTML = body;
    }
  }

  document.getElementById('g-ov-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) { tab = b.dataset.tab; paintTab(); }
  });
  document.getElementById('g-ov-close').addEventListener('click', closeOverlay);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlay(); });
  document.getElementById('g-ov-toolbar').addEventListener('click', function (e) {
    if (!e.target.closest('[data-copy]')) return;
    var text = tab === 'html' ? current.html : current.css;
    navigator.clipboard.writeText(text).then(function () {
      e.target.textContent = t('overlay.copied');
      setTimeout(function () {
        e.target.textContent = t(tab === 'html' ? 'overlay.copyHtml' : 'overlay.copyCss');
      }, 1400);
    });
  });

  /* ── Render sections ─────────────────────────────────────────────────── */
  var host = document.getElementById('g-sections');
  var nav = document.getElementById('g-nav');
  var tokenSections = [];

  /* Panel header: viewport label on the left, scale picker on the right.
     Selects in all panels show one value and change it globally. */
  function paneLabel(text, rec) {
    var box = el('div', 'g-pane-label');
    box.appendChild(el('span', null, text));

    var sel = document.createElement('select');
    sel.className = 'g-scale';
    sel.title = t('pane.scale.title');
    [['0.5', '50%'], ['0.75', '75%'], ['1', '100%']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      sel.appendChild(opt);
    });
    sel.value = String(rec.scale || defaultScale);
    sel.addEventListener('change', function () {
      rec.scale = parseFloat(sel.value) || defaultScale;
      // remember as default for future loads
      localStorage.setItem(SCALE_KEY, String(rec.scale));
      applyFrameScale(rec);
    });
    box.appendChild(sel);
    return box;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function sectionHref(id) {
    return location.pathname + location.search + '#' + id;
  }

  var lastGroup = null;
  SPECS.forEach(function (spec) {
    if (spec.group && spec.group !== lastGroup) {
      nav.appendChild(el('div', 'g-sidebar-group', spec.group));
      lastGroup = spec.group;
    }
    var a = el('a', null, spec.title);
    a.href = sectionHref(spec.id);
    a.dataset.sectionId = spec.id;
    nav.appendChild(a);

    var sec = el('section', 'g-section');
    sec.id = spec.id;
    var head = el('div', 'g-section-head');
    var h2 = document.createElement('h2');
    h2.textContent = spec.title;
    head.appendChild(h2);
    if (spec.code) {
      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'g-src-badge';
      badge.textContent = spec.code;
      badge.setAttribute('aria-haspopup', 'dialog');
      badge.addEventListener('click', function () { openSourceBadge(spec.code); });
      head.appendChild(badge);
    }
    if (spec.note) head.appendChild(el('span', 'g-note', spec.note));
    sec.appendChild(head);
    if (spec.desc) sec.appendChild(el('div', 'g-section-desc', spec.desc));

    if (spec.render) {
      var slot = el('div');
      sec.appendChild(slot);
      tokenSections.push({ spec: spec, slot: slot });
    }

    (spec.examples || []).forEach(function (ex) {
      var box = el('div', 'g-example');

      /* Each example has exactly one body shape: brand markup snapshot (html) or
         catalog row descriptor (rows) — the engine draws those so its own layout
         is not baked into every package. */
      var html = window.ENGINE_SPECS.renderExample(ex);
      var htmlDesktop = ex.htmlDesktop || html;

      box.__html = htmlDesktop;
      box.__surface = ex.surface;
      if (ex.label) box.appendChild(el('p', 'g-example-label', ex.label));
      if (ex.note) box.appendChild(el('p', 'g-example-note', ex.note));

      var split = el('div', 'g-split' + (ex.wide ? ' g-split--wide' : ''));

      if (!ex.wide) {
        var mp = el('div', 'g-pane g-pane--mobile');
        /* Mobile frame width can be set per example.
           Default 900: still the @media (max-width: 900px) branch, and the
           catalogue row is 100% of that container. Blocks that need a phone
           pass mobileWidth (390 / 422). */
        var mw = ex.mobileWidth || 900;
        var mRec = makeFrame(html, mw, false, ex.surface);
        mp.appendChild(paneLabel(t('pane.mobile', { w: mw >= 900 ? '≤900' : mw }), mRec));
        mp.appendChild(mRec.wrap);
        split.appendChild(mp);
      }

      var dp = el('div', 'g-pane g-pane--desktop');
      var dRec = makeFrame(htmlDesktop, DESKTOP_W, true, ex.surface);
      dp.appendChild(paneLabel(t('pane.desktop', { w: DESKTOP_W, c: CONTAINER }), dRec));
      dp.appendChild(dRec.wrap);
      split.appendChild(dp);

      box.appendChild(split);
      sec.appendChild(box);
    });

    host.appendChild(sec);
  });

  function renderTokenSections() {
    tokenSections.forEach(function (t) { t.slot.innerHTML = t.spec.render(mode); });
  }
  // specs redraw token sections after CSS files load and parse
  window.GALLERY_REFRESH = renderTokenSections;

  /* ── Scroll spy ───────────────────────────────────────────────────
     Single source of truth: when the active section changes, update sidebar
     highlight, header title, and address-bar anchor.

     Compute from scroll geometry, not IntersectionObserver: IO does not fire in a
     frame clipped by its parent (as in tests.html) and misses when a section is
     above the viewport. Walking all sections is cheap — a couple dozen — and
     throttled via requestAnimationFrame. */
  var defaultTitle = (M.description && M.description.trim()) || M.defaultTitle || t('topbar.defaultTitle');
  var titleEl = document.getElementById('g-current');
  var activeId;          // undefined, not null: first setActive(null) must paint
  var spyTick = false;

  function setDefaultTitle(text) {
    defaultTitle = (text && text.trim()) || t('topbar.defaultTitle');
    if (!activeId) titleEl.textContent = defaultTitle;
  }

  function sectionTitle(id) {
    var head = document.querySelector('#' + id + ' .g-section-head h2');
    return head ? head.textContent : '';
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;

    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      a.classList.toggle('is-active', !!id && a.dataset.sectionId === id);
    });
    titleEl.textContent = id ? sectionTitle(id) : defaultTitle;

    /* replaceState, not pushState: otherwise Back would step through sections per
       click. Build the full URL: relative "#id" resolves via <base>, and on short
       /sdm the anchor jumped to /packages/engine/. */
    if (id) {
      if (location.hash !== '#' + id) {
        history.replaceState(null, '', location.pathname + location.search + '#' + id);
      }
    } else if (location.hash) {
      // back at the very top — clear the anchor too
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  /* The content panel scrolls, not the window: spy must listen to it.
     Document fallback remains when there is no panel (tests mount the gallery in
     a narrow frame). */
  function scroller() {
    return document.getElementById('g-panel') || document.documentElement;
  }

  function pickActive() {
    // at the very top no section is selected — show the default title
    if (scroller().scrollTop < 8) { setActive(null); return; }

    var secs = document.querySelectorAll('.g-section');
    var found = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].offsetParent === null) continue;      // hidden section
      // boundary just below header: section is current once it reaches it
      if (secs[i].getBoundingClientRect().top <= 80) found = secs[i].id;
      else break;
    }
    setActive(found);
  }

  /* Throttle by time, not requestAnimationFrame: rAF stalls in a nearly invisible
     frame (tests.html), and spy went silent. */
  function scheduleSpy() {
    if (spyTick) return;
    spyTick = true;
    setTimeout(function () { spyTick = false; pickActive(); }, 80);
  }

  (document.getElementById('g-panel') || window)
    .addEventListener('scroll', scheduleSpy, { passive: true });
  window.addEventListener('resize', function () {
    applyScale();
    scheduleSpy();
  });

  // initial state: from hash, else from current position
  (function initSpy() {
    var id = (location.hash || '').replace('#', '');
    if (id && document.getElementById(id)) setActive(id);
    else { setActive(null); pickActive(); }
  })();

  /* ── Live reload ────────────────────────────────────────────
     Storybooks change often and an open tab easily stays on an old version:
     cache-buster only works on a real document load. Every 2 seconds ask
     Last-Modified on sources and reload once something changed. */
  (function watch() {
    /* Engine files sit next door; brand files in the brand folder. */
    var WATCH = ['gallery.html', 'gallery.js', 'src-slice.js', '_frame.html', 'brand.js']
      .concat([M.sections || M.specs, M.tokenMap, M.legacyNames,
               M.css && M.css.tokens, M.css && M.css.components]
        .filter(Boolean).map(B.path));
    var stamps = {}, dirty = false, quiet = 0, note = null, bootstrapped = false;

    /* Full-page glass overlay: live style edits redraw dozens of iframes and a
       half-built state flickers worse than a corner badge. Frosted glass dampens
       that shimmer and honestly shows the gallery is busy. Chrome takes brand
       token colours with a neutral fallback. */
    function banner(text) {
      if (!note) {
        note = document.createElement('div');
        note.className = 'g-reload';
        note.innerHTML = '<div class="g-reload__card">' +
                           '<span class="g-reload__spin"></span>' +
                           '<span class="g-reload__text"></span>' +
                         '</div>';
        document.body.appendChild(note);
        // reflow: without it the browser collapses initial and final state
        //  and appearance jumps with no transition
        void note.offsetWidth;
        note.classList.add('is-on');
      }
      note.querySelector('.g-reload__text').textContent = text;
    }

    function head(url) {
      return fetch(url + '?w=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { return r.headers.get('Last-Modified') || ''; })
        .catch(function () { return ''; });
    }

    function tick() {
      Promise.all(WATCH.map(head)).then(function (vals) {
        var changed = false;
        WATCH.forEach(function (f, i) {
          if (!vals[i]) return;
          if (bootstrapped) {
            if (stamps[f] && stamps[f] !== vals[i]) changed = true;
            if (!stamps[f] && vals[i]) changed = true;
          }
          stamps[f] = vals[i];
        });
        bootstrapped = true;
        // Edits arrive in batches (tokens → css → specs). Reloading on the
        // first change means catching mid-batch and showing a
        // half-built gallery. Wait until files "settle".
        if (changed) {
          dirty = true;
          quiet = 0;
          banner(t('reload.changed'));
        } else if (dirty) {
          quiet++;
          if (quiet >= 2) {          // ~4 seconds with no changes
            banner(t('reload.reloading'));
            setTimeout(function () { location.reload(); }, 200);
            return;
          }
        }
        setTimeout(tick, 2000);
      });
    }
    tick();
  })();


  /* ══════════════════════════════════════════════════════════════════════
     Figma ↔ code mode
     ----------------------------------------------------------------------
     Under each example we show how current markup (styles.css) differs from the
     design system (tokens + brand components). The same markup renders in a second,
     hidden frame with a second stylesheet and we compare computed values — nothing
     hand-described.
     ══════════════════════════════════════════════════════════════════ */
  /* ── CSS for comparison ──────────────────────────────────────────────
     Gallery is the DS reference. The developer brings what to compare against:
     attach a file and the toggle unlocks. With no file there is nothing to
     compare — toggle stays disabled. */
  var compareCss = null;
  var diffOn = false;
  var diffBtn = document.getElementById('g-diff');   // checkbox toggle
  var diffLabel = document.getElementById('g-diff-label');
  var cssName = document.getElementById('g-css-name');

  function setCompareCss(text, label) {
    compareCss = text || null;
    cssName.textContent = compareCss ? label : '';
    diffBtn.disabled = !compareCss;
    diffLabel.classList.toggle('is-disabled', !compareCss);
    if (compareCss) {
      diffLabel.title = t('topbar.compare.title', { file: label });
      diffLabel.removeAttribute('data-hint');
    } else {
      diffLabel.removeAttribute('title');
      diffLabel.setAttribute('data-hint', t('topbar.compare.hint'));
    }

    // attached a different file — previous calculations invalid
    if (diffOn) setDiff(false);
    Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
      if (box.__probes) {
        box.__probes.ds.host.remove();
        box.__probes.code.host.remove();
        box.__probes = null;
      }
    });
    if (window.GALLERY_SET_SITE_CSS) window.GALLERY_SET_SITE_CSS(compareCss);
  }

  /* File picking is handled in settings: Save lives there, and applying the file
     before that means changing the storybook while the user may still Cancel. */

  /* Restore attached CSS after first paint so catalog display is not delayed
     parsing someone else's file. */
  (function restoreCompareCss() {
    var R = window.ENGINE_REGISTRY;
    if (!R) return;
    var id = B.source.id;
    var text = R.compareCss(id);
    if (!text) return;
    var name = (R.suiteSettings(id) || {}).compareName || 'CSS';
    setTimeout(function () { setCompareCss(text, name); }, 0);
  })();


  var DIFF_PROPS = [
    /* Labels come from the language pack via prop.<property> keys. */
    'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor',
    'borderTopLeftRadius', 'boxShadow', 'paddingTop', 'paddingLeft',
    'columnGap', 'rowGap', 'height', 'minHeight'
  ];

  function selectorOf(el) {
    var cls = (el.getAttribute('class') || '').split(/\s+/)
      .filter(function (c) { return c && c !== 'g-pick'; });
    return cls.length ? '.' + cls.join('.') : null;
  }

  function computeDiff(docNew, docOld) {
    var rows = [], seen = {};
    var nodes = docNew.querySelectorAll('[class]');
    for (var i = 0; i < nodes.length; i++) {
      var sel = selectorOf(nodes[i]);
      if (!sel || seen[sel]) continue;
      seen[sel] = 1;

      var a, b;
      try {
        a = docNew.querySelectorAll(sel);
        b = docOld.querySelectorAll(sel);
      } catch (e) { continue; }
      if (!b.length || a.length !== b.length) continue;

      var ca = docNew.defaultView.getComputedStyle(a[0]);
      var cb = docOld.defaultView.getComputedStyle(b[0]);
      DIFF_PROPS.forEach(function (p) {
        var va = ca[p], vb = cb[p];
        if (!va || !vb || va === vb) return;
        // compare height only on a noticeable diff — it drifts with text
        if ((p === 'height' || p === 'minHeight') &&
            Math.abs(parseFloat(va) - parseFloat(vb)) < 4) return;
        rows.push({ sel: sel, prop: t('prop.' + p), now: va, was: vb });
      });
    }
    return rows;
  }

  /* state: 'loading' | 'ready' | 'error' */
  function renderDiff(box, rows, state) {
    var old = box.querySelector('.g-diff');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'g-diff';
    if (state === 'loading') {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.computing') + '</div>';
    } else if (state === 'error') {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.failed') + '</div>';
    } else if (!rows.length) {
      el.innerHTML = '<div class="g-diff-head is-clean">' + t('diff.clean') + '</div>';
    } else {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.count', { n: rows.length }) + '</div>' +
        '<table><tbody>' + rows.map(function (r) {
          return '<tr><td class="sel">' + r.sel + '</td><td class="prop">' + r.prop + '</td>' +
            '<td><span class="was">' + r.was + '</span> → <span class="now">' + r.now + '</span></td></tr>';
        }).join('') + '</tbody></table>';
    }
    box.appendChild(el);
  }

  /* Comparison does NOT depend on the view switch: we keep two own hidden frames —
     one with brand CSS, one with attached — and compare them. Previously the main
     frame was the reference and in "Current site" mode the button compared code to itself. */
  /* Hidden comparison reference — same mountFrame, just off-screen */
  function makeProbe(html, cssMode, surface) {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + DESKTOP_W +
                         'px;height:1400px;overflow:hidden;pointer-events:none';

    var rec = mountFrame({
      html: html, width: DESKTOP_W, cssMode: cssMode, surface: surface,
      userCss: cssMode === 'current' ? compareCss : null,
      id: 'probe' + (++frameSeq), title: 'diff probe', settle: 350
    });
    rec.iframe.style.height = '1400px';
    rec.iframe.style.border = '0';
    rec.iframe.setAttribute('aria-hidden', 'true');

    host.appendChild(rec.iframe);
    document.body.appendChild(host);
    rec.host = host;
    rec.frame = rec.iframe;   // name buildDiffFor knows it by
    return rec;
  }

  function buildDiffFor(box, done) {
    var pr = box.__probes = {
      ds:   makeProbe(box.__html, 'new', box.__surface),
      code: makeProbe(box.__html, 'current', box.__surface)
    };
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      // hidden frames no longer needed — free memory
      pr.ds.host.remove();
      pr.code.host.remove();
      if (done) done();
    }

    function paint() {
      if (!diffOn) { finish(); return; }
      if (!pr.ds.ready || !pr.code.ready) return;
      try {
        renderDiff(box, computeDiff(pr.ds.frame.contentDocument,
                                    pr.code.frame.contentDocument), 'ready');
      } catch (e) {
        renderDiff(box, [], 'error');
      }
      finish();
    }

    pr.ds.onready = pr.code.onready = paint;

    // safety: if a frame never loads, do not hold the queue forever
    setTimeout(function () {
      if (finished) return;
      if (!pr.ds.ready || !pr.code.ready) {
        renderDiff(box, [], 'error');   // honest, not a silent "matches"
      } else { paint(); }
      finish();
    }, 8000);
  }

  /* Lazy queued build.
     Previously every example immediately got a pair of hidden frames — 42 examples
     meant 80+ iframes at once, each with tokens, components, and attached CSS. Some
     never finished loading and panels stuck forever on "Computing differences…".
     Now we only compute what enters the viewport, at most two examples at a time. */
  var diffQueue = [], diffBusy = 0, diffIO = null;
  var DIFF_PARALLEL = 2;

  function pump() {
    while (diffBusy < DIFF_PARALLEL && diffQueue.length) {
      var box = diffQueue.shift();
      if (!diffOn || box.__probes) continue;
      diffBusy++;
      buildDiffFor(box, function () { diffBusy--; pump(); });
    }
  }

  function enqueue(box) {
    if (!diffOn || box.__probes || diffQueue.indexOf(box) >= 0) return;
    renderDiff(box, [], 'loading');
    diffQueue.push(box);
    pump();
  }

  function setDiff(on) {
    /* Token sections render once and learn about comparison only here: without
       redraw the "in attached CSS" column appeared only after reload. */
    setTimeout(function () { if (window.GALLERY_REFRESH) window.GALLERY_REFRESH(); }, 0);
    if (on && !compareCss) return;   // nothing to compare against
    diffOn = on;
    diffBtn.checked = on;

    if (!on) {
      if (diffIO) { diffIO.disconnect(); diffIO = null; }
      diffQueue.length = 0;
      Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
        var d = box.querySelector('.g-diff');
        if (d) d.remove();
        if (box.__probes) {
          box.__probes.ds.host.remove();
          box.__probes.code.host.remove();
          box.__probes = null;
        }
      });
      diffBusy = 0;
      return;
    }

    diffIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) enqueue(en.target); });
    }, { rootMargin: '200px 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
      diffIO.observe(box);
    });
  }

  diffBtn.addEventListener('change', function () { setDiff(diffBtn.checked); });

  /* Small public API — used by tests (tests.html) and handy from the console:
     panel build is lazy and scroll-driven; this lets a section compute now. */
  /* Show an arbitrary system file in the drawer. Same overlay as components: no
     need for a second one for file text — the user already knows this window.
     Hide tabs: a file has no second side. */
  var fileCopyBound = false;
  function bindFileCopy() {
    if (fileCopyBound) return;
    fileCopyBound = true;
    document.getElementById('g-ov-actions').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy-file]');
      if (!btn || !current || current.fileText == null) return;
      navigator.clipboard.writeText(current.fileText).then(function () {
        var was = btn.textContent;
        btn.textContent = t('overlay.copied');
        setTimeout(function () { btn.textContent = was; }, 1400);
      });
    });
  }

  window.GALLERY_API_FILE = function (opts) {
    current = { fileText: opts.text || '' };
    document.getElementById('g-ov-title').textContent = opts.title || '';
    document.getElementById('g-ov-sel').textContent = opts.path || '';
    document.getElementById('g-ov-toolbar').hidden = true;
    document.getElementById('g-ov-tabs').hidden = true;

    document.getElementById('g-ov-actions').innerHTML = opts.actions ||
      ('<button class="g-copy" data-copy-file>' + t('overlay.copyCss') + '</button>');
    ovBody.innerHTML = '<pre class="g-code">' + esc(opts.text || '') + '</pre>';
    bindFileCopy();

    ov.classList.add('is-open');
    document.body.classList.add('g-no-scroll');
    return ovBody;
  };

  function openSourceBadge(code) {
    var cssFiles = (M.css || {});
    var parsed = window.ENGINE_SRC_SLICE.parse(code, cssFiles);
    Promise.resolve(B.source.text(parsed.file)).then(function (text) {
      window.GALLERY_API_FILE({
        title: code,
        path: parsed.file,
        text: window.ENGINE_SRC_SLICE.slice(text || '', parsed),
        actions: '<button class="g-copy" data-copy-file>' + t('overlay.copyCss') + '</button>'
      });
    }).catch(function () {
      window.GALLERY_API_FILE({
        title: code,
        path: parsed.file,
        text: t('overlay.fileMissing')
      });
    });
  }

  window.GALLERY_API = {
    setDiff: setDiff,
    isDiffOn: function () { return diffOn; },
    spy: function () { pickActive(); return activeId || null; },
    setCompareCss: setCompareCss,
    setDefaultTitle: setDefaultTitle,
    openSource: openSourceBadge,
    hasCompareCss: function () { return !!compareCss; },
    diffSection: function (id) {
      if (!diffOn) setDiff(true);
      var boxes = document.querySelectorAll('#' + id + ' .g-example');
      Array.prototype.forEach.call(boxes, enqueue);
      return boxes.length;
    },
    frames: function () {
      return frames.map(function (f) {
        return { id: f.id, w: f.width, desktop: !!f.desktop, contentH: f.contentH || null };
      });
    },
    sections: function () {
      return Array.prototype.map.call(document.querySelectorAll('.g-section'),
        function (s) { return s.id; });
    }
  };
  // choosing a section resets the mode
  nav.addEventListener('click', function () { if (diffOn) setDiff(false); });

  /* First pass: token sections used to be drawn by setMode, which is gone.
     Specs will call GALLERY_REFRESH again after CSS loads and parses. */
  renderTokenSections();

  setTimeout(applyScale, 300);
  setTimeout(applyScale, 1200);
})();
