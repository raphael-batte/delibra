/* ==========================================================================
   The sections contract — shared by the CLI and the browser.

   The same rules validate a package in the repository (check-sections.js) and
   a file brought in through Import. They must not drift apart, or the import
   would accept what the check rejects.

   Runs in node (module.exports) and in the browser (window.…CONTRACT).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_SECTIONS_CONTRACT = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Required fields per catalogue row kind. A row without cls renders but
     cannot be clicked; without text it is an empty button — defects visible
     only by eye. */
  var ROW_FIELDS = {
    btn:  ['size', 'cls', 'text', 'heights'],
    tile: ['name', 'cls', 'meta', 'sample'],
    spec: ['name', 'cls', 'meta', 'sample'],
    gap:  []
  };
  var KINDS = Object.keys(ROW_FIELDS);

  /* Returns problems as strings. An empty list means the sections are fine. */
  function check(sections) {
    var problems = [];
    var fail = function (m) { problems.push(m); };

    if (!Array.isArray(sections)) return ['sections must be an array'];

    sections.forEach(function (s, i) {
      var id = s.id || '#' + i;
      if (!s.id)    fail('section #' + i + ': no id');
      if (!s.title) fail(id + ': no title');
      if (s.render) fail(id + ': render() — rendering is the engine\'s job, not the brand\'s');
      if (!Array.isArray(s.examples) || !s.examples.length) fail(id + ': no examples');

      (s.examples || []).forEach(function (ex, j) {
        var where = id + '/' + (ex.label || '#' + j);
        if (!ex.label) fail(id + ': example #' + j + ' has no label');

        var forms = ['html', 'rows'].filter(function (k) { return ex[k] !== undefined; });
        if (forms.length !== 1) {
          fail(where + ': exactly one body form — html OR rows (now ' +
               (forms.join(' + ') || 'neither') + ')');
        }
        if (ex.wrap && !ex.rows) fail(where + ': wrap is only allowed together with rows');

        if (typeof ex.html === 'string') {
          if (ex.html.indexOf('data-pick') < 0) fail(where + ': no data-pick — the example is not clickable');
          if (/<script/i.test(ex.html)) fail(where + ': <script> in example markup');
        }
        (ex.rows || []).forEach(function (r, k) {
          if (KINDS.indexOf(r.kind) < 0) {
            fail(where + ': row #' + k + ' of unknown kind "' + r.kind + '"');
            return;
          }
          var missing = ROW_FIELDS[r.kind].filter(function (f) {
            return r[f] === undefined || r[f] === '';
          });
          if (missing.length) {
            fail(where + ': row #' + k + ' (' + r.kind + ') missing fields: ' + missing.join(', '));
          }
        });
        /* The wrapper is a shell, not markup: tag name, classes, data-pick. */
        if (ex.wrap && ex.wrap.tag && !/^[a-z][a-z0-9]*$/.test(ex.wrap.tag)) {
          fail(where + ': wrap.tag "' + ex.wrap.tag + '" — expected a tag name');
        }
      });
    });

    return problems;
  }

  return { check: check, ROW_FIELDS: ROW_FIELDS, KINDS: KINDS };
}));
