---
name: storybook-engine
description: >
  Work on the brand-agnostic storybook engine, or wire a new design system into
  it. Use when adding a section, changing preview chrome, adding a language, or
  creating a brand package. Triggers: "add a section to the gallery", "wire up a
  brand", "the storybook shows the wrong…", "translate the gallery".
---

# Storybook engine

The engine renders a design system it knows nothing about. Everything specific
to a brand arrives through a manifest. If a change to the engine mentions a
brand by name, the change is in the wrong file.

## Run it

The gallery **must be served over `http://`**:

```bash
cd design-systems && python3 -m http.server 8777
```

Open `http://localhost:8777/packages/engine/gallery.html`, or another brand with
`?brand=../../brands/_template`.

Opened as `file://`, the browser refuses `document.styleSheets[].cssRules` and
blocks `fetch` of local files. The CSS tab and every token section come up empty
— with no error explaining why. If a token section is blank, check the protocol
before debugging anything else.

## Layout

```
packages/engine/
  gallery.html      chrome, styles, the loader that boots a brand
  gallery.js        sections, preview panes, scale, diff, live reload
  _frame.html       the sandbox iframe: real @media, real breakpoints
  engine-specs.js   CSS var parser, swatches, token-section renderers
  brand.js          brand resolution, i18n lookup, version gate
  i18n/en.js        default language pack
brands/<id>/
  manifest.js       the contract — see below
  tokens.css        custom properties only
  <components>.css  components, written against those properties
  token-map.js      descriptor: which tokens appear in which token section
  sections.js       component sections
  legacy.js         optional: old names of the same tokens in production code
```

## The manifest

```js
window.BRAND_MANIFEST = {
  id: 'acme',              // storage keys are prefixed with it
  title: 'ACME Design System',
  version: '0.1.0',
  engine: 1,               // engine contract major — see VERSIONING.md
  locale: 'en',            // omit for English

  css:   { tokens: 'tokens.css', components: 'acme.css' },
  specs: 'sections.js',
  tokenMap: 'token-map.js',
  legacyNames: null,
  assetsBase: 'assets/',

  font: { family: "'Inter', sans-serif", href: 'https://fonts.googleapis.com/…' },
  breakpoints: { mobile: 900, desktopMin: 901 },
  preview: { mobileWidth: 390, desktopWidth: 1440, container: 1170 },
  compare: { legacy: null }
};
```

Every path is relative **to the brand folder**, never to the engine. The engine
resolves them; inside the preview frame a `<base>` does the same for markup, so
a section can write `assets/icons/x.svg` and it lands in the brand.

## Adding a component section

Sections live in the brand's `sections.js` and are appended to
`window.BRAND_SECTIONS`. The engine composes the catalogue: token sections
first, components after.

```js
{
  id: 'cards',                    // becomes the URL anchor
  group: 'Blocks',                // sidebar grouping
  title: 'Cards',
  code: '.card',                  // what renders it, shown next to the title
  desc: 'One sentence on what is worth noticing.',
  examples: [
    { label: 'Default', html: card('Title', 'Body') },
    { label: 'Dark',    html: card('Title', 'Body', true), note: 'Not in production yet.' }
  ]
}
```

Rules that are load-bearing:

- **Every example needs at least one `data-pick="<selector>"`.** That attribute
  is what makes a node clickable and what fills the code overlay. Without it the
  example is decoration.
- **One example per distinct thing.** This is a storybook, not an asset dump:
  three tints of the same card are one example, not three.
- **`wide: true`** for anything full-bleed (heroes, scrolling rails); otherwise
  the sandbox gutter stacks on the component's own padding and the content comes
  out half width.
- **`htmlDesktop`** only when the two breakpoints genuinely differ in markup.

## Adding a token section

You do not. Token sections are rendered by the engine from the brand's
`token-map.js` — a data descriptor, no markup:

```js
window.BRAND_TOKENS = {
  colors: { title: 'Colours', groups: [{ title: 'Brand', swatches: [['--blue', 'Primary', 'CTA']] }] },
  radii:  { title: 'Radii', scale: ['--r-8'], semantic: [['--r-card', 'cards']] },
  sizes:  { title: 'Sizes', groups: [{ title: 'Buttons', rows: [['--btn-h', 'button height']] }] }
};
```

Sections you omit simply do not appear. Keeping this as data is deliberate: a
brand that arrives as a file must not be executed to show its palette.

If a token section needs a shape the engine does not have, add the renderer to
`engine-specs.js` for **all** brands — never a special case for one.

## Language

All chrome strings go through `t('key')`. `i18n/en.js` is the default and must
carry every key; other packs may be partial, and a missing key falls back to
English rather than rendering blank. Static markup uses `data-i18n`,
`data-i18n-title`, `data-i18n-hint`, `data-i18n-aria`.

Section titles, token labels and demo content stay in the brand's language —
they are brand data, not chrome.

## Forbidden

- Editing `gallery.js`, `_frame.html` or `engine-specs.js` to make one brand
  look right. If a brand needs it, it belongs in the manifest or the descriptor.
- Hardcoding a brand's viewport, container, font, or file names in the engine.
- A section without `data-pick`, or without a test asserting the invariant it
  exists to demonstrate.
- Assuming `file://` works. It does not, and it fails silently.

## Checks

```bash
node packages/engine/check-skill.js      # required anchors, forbidden strings, dates
node packages/engine/check-tokens.js <brand>   # dead and undeclared tokens
```

Engine tests run against `brands/_template`. A brand passing while the template
fails means the engine grew a dependency on that brand.
