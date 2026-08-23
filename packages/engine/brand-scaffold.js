/* ==========================================================================
   The shell of an empty storybook — one definition for browser and server.

   Empty means empty: no tokens, no sections. Copying the template used to
   hand people someone else's palette to mistake for their own. The shell is
   exactly enough for the gallery to open; what fills it is the agent's job.

   `source` records how the storybook started (blank / css / figma) so the
   fill prompt can say what is already done and what is not.

   Works in node (module.exports) and in the browser (window.ENGINE_SCAFFOLD).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_SCAFFOLD = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SOURCES = ['blank', 'css', 'figma', 'import'];

  var DEFAULT_DESCRIPTION = 'Tokens and components';

  /* The manifest of an empty storybook. `id` is overwritten by the server with
     the folder name — identity is the folder, never the field. */
  function manifest(opts) {
    var o = opts || {};
    var m = {
      id: o.id || 'storybook',
      title: o.title || 'New storybook',
      description: o.description || DEFAULT_DESCRIPTION,
      version: '0.1.0',
      engine: 1,
      css: { tokens: 'tokens.css', components: 'components.css' },
      sections: 'sections.json',
      tokenMap: 'token-map.json',
      legacyNames: null,
      assetsBase: 'assets/',
      font: { family: null, href: null },
      breakpoints: { mobile: 900, desktopMin: 901 },
      preview: { mobileWidth: 390, desktopWidth: 1440, container: 1170 },
      compare: { legacy: null }
    };

    var url = (o.design || '').trim();
    /* A design link with no stated source means the storybook starts from a
       design file — that is what the fill prompt needs to know. */
    var source = SOURCES.indexOf(o.source) >= 0 ? o.source : (url ? 'figma' : 'blank');
    /* design is written only when there is something to say: an empty object
       in every manifest would read as a feature nobody uses. */
    if (url || source !== 'blank') {
      m.design = { source: source };
      if (url) m.design.url = url;
    }
    return m;
  }

  /* { files } in the package shape — the same map the server writes to disk
     and the browser keeps in storage. */
  function emptyPackage(opts) {
    return { files: {
      'manifest.json':  JSON.stringify(manifest(opts), null, 2),
      'tokens.css':     ':root {\n}\n',
      'components.css': '',
      'token-map.json': '{}',
      'sections.json':  '[]'
    } };
  }

  return { emptyPackage: emptyPackage, manifest: manifest, SOURCES: SOURCES,
           DEFAULT_DESCRIPTION: DEFAULT_DESCRIPTION };
}));
