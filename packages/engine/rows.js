/* ==========================================================================
   Catalogue rows — the markup the engine shows examples with.

   This is engine chrome, not brand components: metadata column on the left,
   the sample on the right. It lives in its own module because two places need
   it — the gallery (engine-specs.js) and the brand data build script
   (tools/emit-sections.js).

   Runs in the browser and in node: exposed as window.ENGINE_ROWS or
   module.exports.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_ROWS = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function row(items, gap) {
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:' +
      (gap || 12) + 'px;margin-bottom:12px">' + items.join('') + '</div>';
  }

  /* One catalogue row: metadata column left, sample right. A single grid
     (.g-row) across both breakpoints, so labels in the mobile and desktop
     panes line up vertically. */
  function specRow(name, cls, meta, sample) {
    return '<div class="g-row">' +
      '<div class="g-row__meta">' +
        '<div class="g-row__name">' + name + '</div>' +
        '<div class="g-row__cls">' + cls + '</div>' +
        '<div class="g-row__meta-val">' + meta + '</div>' +
      '</div>' +
      '<div class="g-row__sample" data-pick="' + cls + '">' + sample + '</div>' +
    '</div>';
  }

  function btnRow(size, cls, text, heights) {
    var h = heights.split(' / ');
    return specRow(size, cls, 'M ' + h[0] + ' · D ' + h[1],
      '<a href="#" class="' + cls.replace(/^\./, 'btn ').replace(/\./g, ' ') + '">' + text + '</a>');
  }

  /* Icons come from assets/icons — the same files as in the markup
     (.perk — i-ban-01…03, .service — i-01…i-05), but with the viewBox squared
     off: the originals vary (37×50, 30×39, 47×37…), so icons of equal height
     looked different in size. Only the viewBox changed, not the paths. */
  function tileRow(name, cls, size, sample) {
    return specRow(name, cls, size,
      '<span style="display:inline-flex;align-items:center;gap:12px;padding:12px 16px;' +
      'border-radius:12px;background:var(--card-gray)">' + sample + '</span>');
  }

  /* Spacer between families of examples: named for what it is, instead of an
     attribute on the neighbouring row. */
  function gap(size) {
    return '<div style="height:' + (size || 8) + 'px"></div>';
  }

  /* A catalogue row from a descriptor. kind picks the helper above: the brand
     supplies data, the engine picks the markup. */
  function renderRow(r) {
    switch (r.kind) {
      case 'btn':  return btnRow(r.size, r.cls, r.text, r.heights);
      case 'tile': return tileRow(r.name, r.cls, r.meta, r.sample);
      case 'spec': return specRow(r.name, r.cls, r.meta, r.sample);
      case 'gap':  return gap(r.size);
      default:     throw new Error('unknown row kind: ' + r.kind);
    }
  }

  /* A whole example: rows plus an optional brand wrapper around them (dark
     context, coloured backdrop). The wrapper is a shell only — tag, classes
     and data-pick, no logic. */
  function renderRows(example) {
    var inner = (example.rows || []).map(renderRow).join('');
    var w = example.wrap;
    if (!w) return inner;
    var tag = w.tag || 'div';
    return '<' + tag + ' class="' + (w.class || '') + '"' +
           (w.pick ? ' data-pick="' + w.pick + '"' : '') + '>' + inner + '</' + tag + '>';
  }

  return {
    row: row, specRow: specRow, btnRow: btnRow, tileRow: tileRow,
    gap: gap, renderRow: renderRow, renderRows: renderRows
  };
}));
