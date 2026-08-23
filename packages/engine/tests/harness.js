/* ==========================================================================
   Test harness — the runner and gallery access shared by every test set.

   A test set is nothing but cases: the scaffolding, helpers and runner live
   here. Engine tests run against brands/_template, brand tests against their
   own brand — the difference is the ?brand= parameter of the test page.

   Usage:
     <script src="…/harness.js"></script>
     <script> H.g('Group'); H.t('what is checked', function () { … }); </script>
     <script> H.run(); </script>
   ========================================================================== */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var H = window.H = {
    /* Path to the gallery and the brand — relative to the test page. */
    galleryUrl: qs.get('gallery') || '../gallery.html',
    brand:      qs.get('brand')   || '../../../brands/_template',
    suite:      document.title || 'tests'
  };

  var results = [], group = '';
  function g(name) { group = name; }
  function t(name, fn) { results.push({ group: group, name: name, fn: fn }); }

  function eq(actual, expected, what) {
    if (String(actual) !== String(expected)) {
      throw new Error((what ? what + ': ' : '') + 'expected ' + expected + ', got ' + actual);
    }
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg || 'condition not met'); }

  /* ── gallery access ───────────────────────────────────────────────── */
  var G;                       // gallery window
  var D;                       // gallery document

  function frames(sectionId, sel) {
    var out = [];
    D.querySelectorAll('#' + sectionId + ' iframe').forEach(function (f) {
      try { if (!sel || f.contentDocument.querySelector(sel)) out.push(f); } catch (e) {}
    });
    return out;
  }
  /* A section holds several examples and the element may be in any of them —
     take the first pane of the breakpoint where the selector actually is. */
  function pane(sectionId, which, sel) {
    var list = D.querySelectorAll('#' + sectionId + ' .g-pane--' + which + ' iframe');
    ok(list.length, 'no ' + which + ' pane in section ' + sectionId);
    var first = null;
    for (var i = 0; i < list.length; i++) {
      var d;
      try { d = list[i].contentDocument; } catch (e) { continue; }
      if (!d) continue;
      if (!first) first = d;
      if (!sel) break;
      var el = d.querySelector(sel);
      if (el) return { doc: d, win: d.defaultView, el: el };
    }
    ok(first, which + ' panes did not load in ' + sectionId);
    return { doc: first, win: first.defaultView, el: sel ? first.querySelector(sel) : null };
  }
  function css(sectionId, which, sel, prop) {
    var p = pane(sectionId, which, sel);
    ok(p.el, sel + ' not found in ' + sectionId + '/' + which);
    return p.win.getComputedStyle(p.el)[prop];
  }
  function px(v) { return Math.round(parseFloat(v)); }

  /* Publish what the cases use. */
  H.g = g; H.t = t; H.eq = eq; H.ok = ok; H.wait = wait;
  H.pane = pane; H.css = css; H.px = px; H.frames = frames;
  H.gallery = function () { return { win: G, doc: D }; };

  var out = document.getElementById('out');
  var summary = document.getElementById('summary');
  var stageHost = document.getElementById('stage');

  function run() {
    out.innerHTML = '';
    summary.textContent = 'Loading the gallery…';
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    var f = document.createElement('iframe');
    f.style.cssText = 'width:1600px;height:1200px;border:0';
    /* The brand comes from ?brand= on the test page and is passed straight
       through: engine tests run on _template, brand tests on their own. */
    f.src = H.galleryUrl + '?brand=' + encodeURIComponent(H.brand) +
            '&css=new&test=1&t=' + Date.now();
    stage.appendChild(f);

    f.addEventListener('load', function () {
      G = f.contentWindow;
      D = f.contentDocument;
      G.__errors = [];
      G.addEventListener('error', function (e) { G.__errors.push(String(e.message)); });
      summary.textContent = 'Waiting for previews…';
      wait(5000).then(runAll);
    });
  }

  function runAll() {
    var pass = 0, fail = 0, lastGroup = null, chain = Promise.resolve();

    results.forEach(function (r) {
      chain = chain.then(function () {
        if (r.group !== lastGroup) {
          lastGroup = r.group;
          var h = document.createElement('div');
          h.className = 'grp';
          h.textContent = r.group;
          out.appendChild(h);
          var tb = document.createElement('table');
          out.appendChild(tb);
        }
        var table = out.querySelector('table:last-of-type');
        return Promise.resolve()
          .then(r.fn)
          .then(function () { pass++; row(table, 'ok', '✓', r.name, ''); },
                function (e) { fail++; row(table, 'fail', '✕', r.name, e.message); });
      });
    });

    chain.then(function () {
      summary.innerHTML = fail === 0
        ? '<span class="ok">All ' + pass + ' checks passed</span>'
        : '<span class="fail">Failed: ' + fail + '</span> · <span class="ok">passed: ' + pass + '</span>';
      document.title = (fail ? '✕ ' + fail : '✓ ' + pass) + ' — ' + H.suite;
      window.__testResult = { pass: pass, fail: fail };
    });
  }

  function row(table, cls, mark, name, msg) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="st ' + cls + '">' + mark + '</td><td>' + name +
      '</td><td class="msg">' + (msg || '') + '</td>';
    table.appendChild(tr);
  }

  H.run = run;
  H.results = results;

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('rerun');
    if (btn) btn.addEventListener('click', run);
  });
})();
