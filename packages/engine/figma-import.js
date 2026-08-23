/* ==========================================================================
   A design system out of design variables.

   Whatever bridge answered, the payload looks the same: collections of
   variables with a name and a value per mode. This turns them into the shape
   the shared token builder expects — the grouping itself is not repeated here.
   ========================================================================== */
(function () {
  'use strict';

  function hex(c) {
    function part(x) {
      var v = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16);
      return v.length === 1 ? '0' + v : v;
    }
    var base = '#' + part(c.r) + part(c.g) + part(c.b);
    /* Alpha only when it is actually transparent: #012B5Dff reads as noise. */
    return c.a === undefined || c.a >= 1 ? base.toUpperCase() : base.toUpperCase() + part(c.a);
  }

  /* "Colors primary/Blue-main" → "--colors-primary-blue-main" */
  function tokenName(name) {
    return '--' + String(name).toLowerCase()
      .replace(/[\/\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function valueOf(variable) {
    var modes = variable.valuesByMode || {};
    var keys = Object.keys(modes);
    if (!keys.length) return null;
    /* First mode only. Themes are a separate feature, and guessing which mode
       is "the" one would be worse than saying we took the first. */
    var v = modes[keys[0]];
    if (v == null) return null;
    if (typeof v === 'object' && v.type === 'COLOR') return hex(v);
    if (typeof v === 'number') return Number.isInteger(v) ? v + 'px' : v.toFixed(2) + 'px';
    if (typeof v === 'string') return v;
    return null;
  }

  window.ENGINE_FIGMA_IMPORT = {
    /* Bridge payload → { base, desktop, mobile }, the builder's input. */
    toVars: function (payload) {
      var base = {};
      ((payload && payload.collections) || []).forEach(function (collection) {
        (collection.variables || []).forEach(function (variable) {
          var value = valueOf(variable);
          if (value != null) base[tokenName(variable.name)] = value;
        });
      });
      return { base: base, desktop: {}, mobile: {} };
    },

    build: function (payload, fileName, t, title, designUrl) {
      var vars = window.ENGINE_FIGMA_IMPORT.toVars(payload);
      var built = window.ENGINE_TOKEN_BUILD.buildPackage(vars, {
        title: title || t('new.figmaName', { file: fileName }),
        note: t('new.figmaDesc', { file: fileName }),
        deferred: t('new.figmaDeferred', { file: fileName }),
        designUrl: designUrl || null
      });
      if (built.error) return { error: built.error };

      var pack = window.ENGINE_BUNDLE.empty();
      pack.files = built.files;
      return { pack: pack, title: built.title, count: built.count };
    }
  };
})();
