/* ==========================================================================
   A design system out of a stylesheet.

   Most teams already have one — a list of custom properties in a file nobody
   ever looks at. Parsing is already solved (parseVars in engine-specs reads
   :root and both media queries), so the work here is only the wrapping.
   ========================================================================== */
(function () {
  'use strict';

  window.ENGINE_CSS_IMPORT = {
    /* Returns { pack, title, count } or { error }. */
    build: function (css, filename, t, title) {
      var vars = window.ENGINE_SPECS.parseVars(css);
      var built = window.ENGINE_TOKEN_BUILD.buildPackage(vars, {
        title: title || t('new.cssName', { file: filename }),
        note: t('new.cssDesc', { file: filename }),
        deferred: t('new.cssDeferred', { file: filename }),
        /* Keep the original file rather than a regenerated one: comments and
           order are part of what the author wrote. */
        css: css,
        source: 'css'
      });
      if (built.error) return { error: built.error };

      var pack = window.ENGINE_BUNDLE.empty();
      pack.files = built.files;
      return { pack: pack, title: built.title, count: built.count };
    }
  };
})();
