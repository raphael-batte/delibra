/* ==========================================================================
   Figma ↔ code comparison.

   Hidden probe frames, a two-at-a-time queue, and getComputedStyle against a
   property list. The gallery calls create() after mountFrame exists and wires
   the returned methods into GALLERY_API.

   Works in node (module.exports) and in the browser (window.ENGINE_GALLERY_DIFF).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_GALLERY_DIFF = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(opts) {
    var t = opts.t;
    var B = opts.B;
    var mountFrame = opts.mountFrame;
    var DESKTOP_W = opts.desktopWidth;
    var probeSeq = 0;

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
      /* Measuring stand, not a declared viewport — used only when the brand
         omitted desktopWidth. */
      var probeW = DESKTOP_W || 1280;
      var host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + probeW +
                           'px;height:1400px;overflow:hidden;pointer-events:none';

      var rec = mountFrame({
        html: html, width: probeW, cssMode: cssMode, surface: surface,
        userCss: cssMode === 'current' ? compareCss : null,
        id: 'probe' + (++probeSeq), title: 'diff probe', settle: 350
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

    return {
      setCompareCss: setCompareCss,
      setDiff: setDiff,
      isDiffOn: function () { return diffOn; },
      hasCompareCss: function () { return !!compareCss; },
      enqueue: enqueue
    };
  }

  return { create: create };
}));
