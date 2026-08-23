/* ==========================================================================
   The prompts the gallery hands to an agent.

   Two of them: the workspace prompt points an agent at the repository, the
   fill prompt at one storybook. Both are plain text, copied by a button —
   the gallery never talks to an agent itself.

   The text is English on purpose, whatever the interface language: it is read
   by an agent alongside an English skill, not by the person clicking Copy.

   Works in node (module.exports) and in the browser (window.ENGINE_PROMPT).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_PROMPT = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function lines(parts) {
    return parts.filter(function (s) { return !!s; }).join('\n');
  }

  /* "Here is the repository, here is DeLibra." Used in workspace settings,
     before any libra is chosen. */
  function buildWorkspacePrompt(o) {
    o = o || {};
    return lines([
      'Repository delibra — design-system libras for DeLibra: ' + (o.root || '<repo>') + '.',
      'Libras live in ' + (o.brandsRoot || 'brands/') + ', one folder each.',
      o.galleryOrigin ? 'DeLibra serves them at ' + o.galleryOrigin + '.' : '',
      'Read ' + (o.skillPath || 'packages/engine/ENGINE_SKILL.md') +
        ' before touching a libra — start at ## Router.',
      'Do not create libra folders by hand — they are created in DeLibra, and you fill the folder that already exists.'
    ]);
  }

  /* "Fill this libra." Path + pointer — scenarios live in the skill Router. */
  function buildFillPrompt(o) {
    o = o || {};
    var path = o.brandPath || ('brands/' + (o.brandId || ''));

    return lines([
      'Fill the design-system libra in ' + path + '.',
      'Read ' + (o.skillPath || 'packages/engine/ENGINE_SKILL.md') +
        ' and follow it — start at ## Router, then Output contract.',
      o.galleryUrl ? 'DeLibra (reloads on file changes): ' + o.galleryUrl : ''
    ]);
  }

  return { buildWorkspacePrompt: buildWorkspacePrompt, buildFillPrompt: buildFillPrompt };
}));
