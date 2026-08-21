/* Engine chrome strings. This is the default pack — every other locale falls
   back to it key by key, so a missing translation shows English, never blank. */
window.ENGINE_I18N = window.ENGINE_I18N || {};
window.ENGINE_I18N.en = {
  /* topbar */
  'topbar.defaultTitle':    'Design system and site components',
  'topbar.attach':          'Attach CSS',
  'topbar.attach.title':    'Attach a CSS file to compare the design system against',
  'topbar.compare':         'Compare with code',
  'topbar.compare.hint':    'Attach a CSS file to enable comparison',
  'topbar.compare.title':   'Compare the design system with {file}',
  'topbar.readFailed':      'could not read the file',

  /* preview panes */
  'pane.mobile':            'Mobile · {w}px',
  'pane.desktop':           'Desktop · {w}px (container {c})',
  'pane.scale.title':       'Scale of this preview',

  /* code overlay */
  'overlay.component':      'Component',
  'overlay.tab.html':       'HTML',
  'overlay.tab.css':        'CSS',
  'overlay.copyHtml':       'Copy HTML',
  'overlay.copyCss':        'Copy CSS',
  'overlay.copied':         'Copied ✓',
  'overlay.tokens':         'Tokens in use',
  'overlay.close':          'Close',
  'overlay.noRules':        'No rules matched this element in the loaded stylesheets.',
  'overlay.fileProtocol':   'The browser withheld <code>cssRules</code>. This happens when the page is opened over <code>file://</code> — serve the gallery over <code>http://</code> and the rules will appear.',

  /* diff panel */
  'diff.computing':         'Computing differences…',
  'diff.clean':             'Matches the attached CSS',
  'diff.count':             'Differences from the attached CSS: {n}',
  'diff.failed':            'Could not compute — the preview did not finish loading',

  /* diff property names */
  'prop.fontSize':          'size',
  'prop.fontWeight':        'weight',
  'prop.lineHeight':        'line height',
  'prop.color':             'text colour',
  'prop.backgroundColor':   'background',
  'prop.borderTopLeftRadius': 'radius',
  'prop.boxShadow':         'shadow / ring',
  'prop.paddingTop':        'padding top',
  'prop.paddingLeft':       'padding left',
  'prop.columnGap':         'column gap',
  'prop.rowGap':            'row gap',
  'prop.height':            'height',
  'prop.minHeight':         'min height',

  /* live reload */
  /* Токен-секции: подписи структуры. Состав секций задаёт бренд. */
  'tok.group':          'Tokens',
  'tok.token':          'Token',
  'tok.mobile':         'Mobile ≤ 900',
  'tok.desktop':        'Desktop ≥ 901',
  'tok.mobileShort':    'Mobile',
  'tok.desktopShort':   'Desktop',
  'tok.usage':          'Where it is used',
  'tok.style':          'Style',
  'tok.weight':         'Weight',
  'tok.weights':        'Weights',
  'tok.scale':          'Scale',
  'tok.semantics':      'Semantics',
  'tok.specimen':       'Specimen',
  'tok.gradients':      'Gradients',
  'tok.dropShadows':    'Drop shadows',
  'tok.insetRings':     'Inset rings',
  'tok.insteadOfBorder':'— instead of border',
  'tok.gradientBorders':'Gradient borders',
  'tok.notAShadow':     '— not a shadow but background-clip',
  'tok.spacingScale':   'Spacing scale',
  'tok.mobileLeft':     '— mobile on the left, desktop on the right',
  'tok.same':           'M = D',
  'tok.sameBoth':       'same on M and D',
  'tok.differs':        'M / D — they differ',
  'tok.blurOff':        'no blur',
  'tok.blurOn':         'blurred',
  'tok.missing':        'not in the token file',
  'tok.notInCode':      'the new one is absent from the code',
  'tok.inCodeAs':       'in code {name}: {value}',
  'tok.inCodeNamed':    'in code — {name}',
  'tok.matchesCode':    'matches the code',

  'reload.changed':         'Files changed…',
  'reload.reloading':       'Reloading…',

  /* token sections */
  'token.missing':          'not in this set',
  'token.loading':          'Loading CSS…',
  'token.brokenTokens':     'Could not read the token file — it came back empty. Usually it was being rewritten while the page loaded. Reload the gallery.'
};
