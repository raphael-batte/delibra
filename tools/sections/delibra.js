/* ==========================================================================
   DeLibra — section authoring layer.

   Markup for the gallery chrome design system. Logic stays in the repo;
   emit writes ~/.delibra/libras/delibra/sections.json.

   Edit here, then run:
       node tools/emit-sections.js delibra
   ========================================================================== */
'use strict';

module.exports = function () {

  var mark =
    '<svg viewBox="0 0 38 36" fill="currentColor" aria-hidden="true">' +
      '<path d="M0 0H1.60938V36H0V0Z"/>' +
      '<path d="M6.55859 0H8.6941V36H6.55859V0Z"/>' +
      '<path d="M11.793 0H15.5171V36H11.793V0Z"/>' +
      '<path d="M18 0H23.8242V36H18V0Z"/>' +
      '<mask id="dl-mark-mask" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="11" y="0" width="27" height="36">' +
        '<path d="M37.8619 18C37.8619 27.9411 32.0262 36 24.8275 36C17.6287 36 11.793 27.9411 11.793 18C11.793 8.05887 17.6287 0 24.8275 0C32.0262 0 37.8619 8.05887 37.8619 18Z" fill="#fff"/>' +
      '</mask>' +
      '<g mask="url(#dl-mark-mask)">' +
        '<path d="M25.4531 -3.10156H39.729V37.864H25.4531V-3.10156Z"/>' +
      '</g>' +
    '</svg>';

  var chevron =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6"/></svg>';

  return [

  {
    id: 'buttons', group: 'Primitives', title: 'Buttons', code: '.g-btn-*',
    desc: 'Height 32, radius 16 (half height). Primary fill is --text-primary, hover --text-heading. Ghost and danger are outlined. Copy is the 24px inline chip.',
    examples: [
      { label: 'Primary, ghost, danger',         rows: [
          { kind: 'spec', name: 'Primary', cls: '.g-btn-primary', meta: '32',
            sample: '<button type="button" class="g-btn-primary">Save</button>' },
          { kind: 'spec', name: 'Ghost', cls: '.g-btn-ghost', meta: '32',
            sample: '<button type="button" class="g-btn-ghost">Cancel</button>' },
          { kind: 'spec', name: 'Danger', cls: '.g-btn-danger', meta: '32',
            sample: '<button type="button" class="g-btn-danger">Delete</button>' }
        ] },
      { label: 'Copy / inline ghost',         note: 'Same as ghost, height 24, padding 8, radius 6. Sits on --card-gray in path rows — hover lifts to --white-pure.',
        rows: [
          { kind: 'spec', name: 'Copy', cls: '.g-copy', meta: '24',
            sample: '<button type="button" class="g-copy">Copy</button>' },
          { kind: 'spec', name: 'Inline ghost', cls: '.g-btn-ghost--inline', meta: '24',
            sample: '<button type="button" class="g-btn-ghost g-btn-ghost--inline">Copy</button>' }
        ] },
      { label: 'Disabled',         note: 'Gray fill, pale label, no accent. Same recipe for every variant.',
        rows: [
          { kind: 'spec', name: 'Primary', cls: '.g-btn-primary:disabled', meta: 'opacity .55',
            sample: '<button type="button" class="g-btn-primary" disabled>Save</button>' },
          { kind: 'spec', name: 'Ghost', cls: '.g-btn-ghost:disabled', meta: 'opacity .55',
            sample: '<button type="button" class="g-btn-ghost" disabled>Cancel</button>' },
          { kind: 'spec', name: 'Danger', cls: '.g-btn-danger:disabled', meta: 'opacity .55',
            sample: '<button type="button" class="g-btn-danger" disabled>Delete</button>' }
        ] }
    ]
  },

  {
    id: 'fields', group: 'Primitives', title: 'Fields', code: '.g-field',
    desc: 'Height 32, radius 8, text 13. Label is 12/600 --text-muted. Disabled field sits on --bg.',
    examples: [
      { label: 'Text and select',
        html:
          '<div class="g-field" data-pick=".g-field">' +
            '<span class="g-field__label">Name</span>' +
            '<input type="text" value="DeLibra Design System">' +
            '<span class="g-field__hint">Shown in the sidebar and on the home card.</span>' +
          '</div>' +
          '<div class="g-field" data-pick=".g-field select">' +
            '<span class="g-field__label">Locale</span>' +
            '<select><option>English</option><option>Русский</option></select>' +
          '</div>' },
      { label: 'Disabled',
        html:
          '<div class="g-field" data-pick=".g-field input:disabled">' +
            '<span class="g-field__label">Read-only</span>' +
            '<input type="text" value="Library storybook" disabled>' +
          '</div>' },
      { label: 'Path row',
        note: 'Label + grey bar with value and inline copy. Hover on copy lifts off the bar.',
        html:
          '<div class="g-field g-field--path" data-pick=".g-field--path">' +
            '<span class="g-field__label">Folder</span>' +
            '<div class="g-field__value">' +
              '<code>~/.delibra/libras/delibra</code>' +
              '<button type="button" class="g-btn-ghost g-btn-ghost--inline">Copy</button>' +
            '</div>' +
          '</div>' },
      { label: 'Address',
        html: '<div class="g-address" data-pick=".g-address">localhost:8777/delibra</div>' }
    ]
  },

  {
    id: 'toggle', group: 'Primitives', title: 'Toggle', code: '.g-toggle',
    desc: 'Track 34×20, thumb 16, radius 10. Off is --border, on is --text-heading.',
    examples: [
      { label: 'Off, on, disabled',
        html:
          '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
            '<label class="g-toggle" data-pick=".g-toggle">' +
              '<input type="checkbox"><span class="g-toggle__track"></span>Compare with code</label>' +
            '<label class="g-toggle" data-pick=".g-toggle:has(input:checked)">' +
              '<input type="checkbox" checked><span class="g-toggle__track"></span>Live reload</label>' +
            '<label class="g-toggle is-disabled" data-pick=".g-toggle.is-disabled">' +
              '<input type="checkbox" disabled><span class="g-toggle__track"></span>Attach CSS first</label>' +
          '</div>' }
    ]
  },

  {
    id: 'tabs', group: 'Primitives', title: 'Tabs', code: '.g-tabs',
    desc: 'Overlay tabs. Idle is muted; .is-on sits on --card-gray.',
    examples: [
      { label: 'HTML / CSS',
        html:
          '<div class="g-tabs" data-pick=".g-tabs">' +
            '<button type="button" class="is-on" data-pick=".g-tabs button.is-on">HTML</button>' +
            '<button type="button" data-pick=".g-tabs button">CSS</button>' +
          '</div>' }
    ]
  },

  {
    id: 'badge', group: 'Primitives', title: 'Source badge', code: '.g-src-badge',
    desc: 'Monospace 11 on --card-gray, radius 4. Opens the code drawer.',
    examples: [
      { label: 'File range',
        html: '<button type="button" class="g-src-badge" data-pick=".g-src-badge">components.css §01</button>' }
    ]
  },

  {
    id: 'menu', group: 'Primitives', title: 'Menu', code: '.g-menu · .g-mi',
    desc: 'Min-width 264, radius 12, shadow --shadow-menu. Items 13/500, radius 6. Danger is --text-error, not a fill.',
    examples: [
      { label: 'Storybook menu',
        html:
          '<div class="g-menu" data-pick=".g-menu" style="position:relative">' +
            '<button type="button" class="g-mi" data-pick=".g-mi"><span class="grow">Settings</span></button>' +
            '<button type="button" class="g-mi"><span class="grow">View tokens.css</span></button>' +
            '<hr>' +
            '<button type="button" class="g-mi"><span class="grow">Duplicate</span>' +
              '<span class="badge" data-pick=".g-mi .badge">Library</span></button>' +
            '<hr>' +
            '<button type="button" class="g-mi danger" data-pick=".g-mi.danger"><span class="grow">Delete</span></button>' +
          '</div>' }
    ]
  },

  {
    id: 'choice', group: 'Primitives', title: 'Choice and callout', code: '.g-choice · .g-primary',
    desc: 'Create-storybook options: bordered tile, hover darkens the ring. Callout is the selected path on --card-gray.',
    examples: [
      { label: 'Choices',
        html:
          '<div class="g-choices" data-pick=".g-choices">' +
            '<button type="button" class="g-choice" data-pick=".g-choice">' +
              '<b>From a design</b><span>Paste a Figma URL. Tokens come from variables.</span></button>' +
            '<button type="button" class="g-choice">' +
              '<b>From CSS</b><span>Import a stylesheet. Custom properties become tokens.</span></button>' +
          '</div>' },
      { label: 'Callout',
        html:
          '<div class="g-primary" data-pick=".g-primary">' +
            '<b>Copy the fill prompt</b>' +
            '<p>The agent reads this storybook and fills tokens from the source CSS.</p>' +
          '</div>' }
    ]
  },

  {
    id: 'hint-code', group: 'Primitives', title: 'Hint and code', code: '.g-hint · .g-code',
    desc: 'Hint is #fff4e0 / #7a4b00. Code is #1f2430 / #d6deeb, 11.5px mono.',
    examples: [
      { label: 'Hint',
        html: '<div class="g-hint" data-pick=".g-hint">Typography sizes do not change with viewport width.</div>' },
      { label: 'Code',
        html: '<pre class="g-code" data-pick=".g-code">.g-btn-primary {\n  background: var(--text-primary);\n  color: var(--white-pure);\n}</pre>' }
    ]
  },

  {
    id: 'status', group: 'Primitives', title: 'Diff status', code: '.g-diff-head · .g-ok',
    desc: 'Warn head #fff4e0 / #7a4b00. Clean head #eaf7ec / #1d6b2a. Match is --green, mismatch is #b26a00.',
    examples: [
      { label: 'Heads',
        html:
          '<div class="g-diff" data-pick=".g-diff">' +
            '<div class="g-diff-head" data-pick=".g-diff-head">3 mismatches</div>' +
          '</div>' +
          '<div class="g-diff" style="margin-top:12px">' +
            '<div class="g-diff-head is-clean" data-pick=".g-diff-head.is-clean">Matches attached CSS</div>' +
          '</div>' +
          '<p style="margin:16px 0 0;font-size:13px">' +
            '<span class="g-ok" data-pick=".g-ok">match</span> · ' +
            '<span class="g-warn" data-pick=".g-warn">mismatch</span> · ' +
            '<span class="g-diff"><span class="now" data-pick=".g-diff .now">now</span> / ' +
            '<span class="was" data-pick=".g-diff .was">was</span></span></p>' }
    ]
  },

  {
    id: 'dialog', group: 'Blocks', title: 'Dialog', code: '.g-dialog',
    desc: 'Max 460, padding 24, radius 16, shadow --shadow-dialog. The app overlay centres it on a frosted scrim.',
    examples: [
      { label: 'Settings',
        html:
          '<div class="g-scrim" data-pick=".g-scrim">' +
            '<div class="g-dialog" data-pick=".g-dialog">' +
              '<h3>Storybook settings</h3>' +
              '<p class="g-dialog__lead">Name, locale, and the design source. Saving writes manifest.json.</p>' +
              '<div class="g-field"><span class="g-field__label">Title</span>' +
                '<input type="text" value="DeLibra Design System"></div>' +
              '<div class="g-dialog__error" data-pick=".g-dialog__error">Name is already taken.</div>' +
              '<div class="g-dialog__actions" data-pick=".g-dialog__actions">' +
                '<button type="button" class="g-btn-ghost">Cancel</button>' +
                '<button type="button" class="g-btn-primary">Save</button>' +
              '</div>' +
            '</div>' +
          '</div>' }
    ]
  },

  {
    id: 'empty', group: 'Blocks', title: 'Empty state', code: '.g-empty',
    desc: 'Title 20/700, lead 13 --text-secondary. Paths then actions, 32px between those groups.',
    examples: [
      { label: 'New storybook',
        html:
          '<div class="g-empty" data-pick=".g-empty">' +
            '<h2>DeLibra Design System</h2>' +
            '<p class="g-empty__lead">Tokens and components. Copy the fill prompt, or import a stylesheet.</p>' +
            '<div class="g-empty__tail">' +
              '<div class="g-empty__paths">' +
                '<div class="g-field g-field--path">' +
                  '<span class="g-field__label">Folder</span>' +
                  '<div class="g-field__value"><code>~/.delibra/libras/delibra</code>' +
                    '<button type="button" class="g-btn-ghost g-btn-ghost--inline">Copy</button></div>' +
                '</div>' +
              '</div>' +
              '<div class="g-empty__actions">' +
                '<button type="button" class="g-btn-ghost">Settings</button>' +
                '<button type="button" class="g-btn-primary">Copy fill prompt</button>' +
              '</div>' +
            '</div>' +
          '</div>' }
    ]
  },

  {
    id: 'about', group: 'Blocks', title: 'About', code: '.g-about',
    desc: 'Mark 56 on --card-gray, radius 12. Name, version, two lines, close.',
    examples: [
      { label: 'About DeLibra',
        html:
          '<div class="g-about" data-pick=".g-about">' +
            '<div class="g-about__mark" data-pick=".g-about__mark">' + mark + '</div>' +
            '<h3>DeLibra</h3>' +
            '<p class="g-about__ver">0.1.0</p>' +
            '<p class="g-about__tagline">A design system you can read.</p>' +
            '<p class="g-about__body">Tokens and components as data. The gallery is the readable form of the same files.</p>' +
            '<div class="g-dialog__actions"><button type="button" class="g-btn-ghost">Close</button></div>' +
          '</div>' }
    ]
  },

  {
    id: 'brandbar', group: 'Blocks', title: 'Brand bar', code: '.g-brandbar',
    desc: '32×32 mark, radius 6. Name 13/600 black, not brand colour. Height matches the top bar — 56.',
    examples: [
      { label: 'Workspace row',
        html:
          '<div class="g-brandbar" data-pick=".g-brandbar">' +
            '<button type="button" class="g-brandmark" data-pick=".g-brandmark">' + mark + '</button>' +
            '<button type="button" class="g-brandname" data-pick=".g-brandname">' +
              '<b>DeLibra Design System</b>' + chevron +
            '</button>' +
          '</div>' }
    ]
  },

  {
    id: 'nav', group: 'Blocks', title: 'Sidebar nav', code: '.g-nav',
    desc: 'Group title same size as items, just paler. Active and hover share --card-gray; active is 600.',
    examples: [
      { label: 'Tree',
        html:
          '<nav class="g-nav" data-pick=".g-nav">' +
            '<div class="g-sidebar-group" data-pick=".g-sidebar-group">Tokens</div>' +
            '<a href="#">Colours</a>' +
            '<a href="#">Type scale</a>' +
            '<div class="g-sidebar-group">Primitives</div>' +
            '<a href="#" class="is-active" data-pick=".g-nav a.is-active">Buttons</a>' +
            '<a href="#" data-pick=".g-nav a">Fields</a>' +
          '</nav>' }
    ]
  },

  {
    id: 'pane', group: 'Blocks', title: 'Pane and top bar', code: '.g-pane · .g-topbar',
    desc: 'Preview window: label on --card-gray, body --bg, radius 12. Top bar is 56, white, soft bottom border.',
    examples: [
      { label: 'Top bar',
        html:
          '<div class="g-panel" data-pick=".g-panel">' +
            '<div class="g-topbar" data-pick=".g-topbar">' +
              '<h1 class="g-current" data-pick=".g-current">Buttons</h1>' +
            '</div>' +
          '</div>' },
      { label: 'Preview pane',
        html:
          '<div class="g-pane" data-pick=".g-pane">' +
            '<div class="g-pane-label" data-pick=".g-pane-label">' +
              '<span>Desktop</span>' +
              '<select class="g-scale" data-pick=".g-scale"><option>100%</option><option>75%</option></select>' +
            '</div>' +
            '<div style="padding:16px">' +
              '<button type="button" class="g-btn-primary">Save</button>' +
            '</div>' +
          '</div>' },
      { label: 'Section head',
        html:
          '<div class="g-section-head" data-pick=".g-section-head">' +
            '<h2>Buttons</h2>' +
            '<button type="button" class="g-src-badge">.g-btn-*</button>' +
            '<span class="g-note" data-pick=".g-section-head .g-note">3 mismatches</span>' +
          '</div>' +
          '<p class="g-section-desc" data-pick=".g-section-desc">Height 32, radius 16. Primary fill is --text-primary.</p>' }
    ]
  },

  {
    id: 'overlay', group: 'Blocks', title: 'Overlay', code: '.g-overlay-panel',
    desc: 'Code drawer: 720 max, white sheet, close 30×30 on --card-gray.',
    examples: [
      { label: 'Head',
        html:
          '<div class="g-overlay-panel" data-pick=".g-overlay-panel">' +
            '<div class="g-overlay-head" data-pick=".g-overlay-head">' +
              '<div class="g-overlay-heading">' +
                '<div class="g-overlay-title" data-pick=".g-overlay-title">.g-btn-primary</div>' +
                '<div class="g-overlay-sel" data-pick=".g-overlay-sel">button.g-btn-primary</div>' +
              '</div>' +
              '<button type="button" class="g-overlay-close" data-pick=".g-overlay-close">×</button>' +
            '</div>' +
          '</div>' }
    ]
  },

  {
    id: 'reload', group: 'Blocks', title: 'Reload card', code: '.g-reload-card',
    desc: 'Frosted white, radius 18, blur 24. Shown over the gallery while files settle.',
    examples: [
      { label: 'Settling',
        html: '<div class="g-reload-card" data-pick=".g-reload-card">Updating storybook…</div>' }
    ]
  }

  ];
};
