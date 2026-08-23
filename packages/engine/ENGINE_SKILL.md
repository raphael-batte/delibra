---
name: storybook-engine
description: >
  Fill or extend a design-system storybook — the format an agent writes and a
  person reads. Use when filling a storybook with tokens taken from a design or
  a stylesheet, adding component sections, or working on the engine itself.
  Triggers: "fill this storybook", "create a design system from Figma", "take
  the tokens off the design", "add a section to the gallery", "wire up a brand",
  "the storybook shows the wrong…", "translate the gallery".
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
  rows.js           catalogue rows — shared by the gallery and the emitter
  brand.js          brand resolution, i18n lookup, version gate
  i18n/en.js        default language pack
brands/<id>/        DATA ONLY — nothing here is executed
  manifest.json     the contract — see below
  tokens.css        custom properties only
  <components>.css  components, written against those properties
  token-map.json    descriptor: which tokens appear in which token section
  sections.json     component sections
  legacy.json       optional: old names of the same tokens in production code
tools/
  sections/<id>.js  the authoring layer: builders that produce the sections
  emit-sections.js  runs it, writes brands/<id>/sections.json
```

**A brand package contains only data.** Every file the gallery loads from a
brand is parsed, never executed — that is what lets a storybook arrive as a
file and be opened without running someone else's code. Logic lives in the
repository, under `tools/`.

## The manifest

```json
{
  "id": "acme",
  "title": "ACME Design System",
  "version": "0.1.0",
  "engine": 1,
  "locale": "en",

  "css": { "tokens": "tokens.css", "components": "acme.css" },
  "sections": "sections.json",
  "tokenMap": "token-map.json",
  "legacyNames": null,
  "assetsBase": "assets/",

  "design": { "url": "https://figma.com/design/…" },
  "font": { "family": "'Inter', sans-serif", "href": "https://fonts.googleapis.com/…" },
  "breakpoints": { "mobile": 900, "desktopMin": 901 },
  "preview": { "mobileWidth": 390, "desktopWidth": 1440, "container": 1170 },
  "compare": { "legacy": null }
}
```

`id` prefixes storage keys, `engine` is the contract major (see VERSIONING.md),
`locale` may be omitted for English. `design.url` is optional and points at the
file this system comes from — it is handed to you with the folder, and nothing
fetches it on its own. The older `manifest.js` form still loads,
but a brand in that shape cannot be exported or imported.

Every path is relative **to the brand folder**, never to the engine. The engine
resolves them; inside the preview frame a `<base>` does the same for markup, so
a section can write `assets/icons/x.svg` and it lands in the brand.

## Adding a component section

Sections are edited in `tools/sections/<brand>.js` — builders, loops, whatever
is convenient — and then emitted:

```bash
node tools/emit-sections.js <brand>
```

The result lands in `brands/<brand>/sections.json`, which is what the gallery
reads. Never hand-edit that file: the next emit overwrites it.

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

**Two shapes of example, exactly one per example:**

- `html` — a snapshot of the brand's own markup. Needs `data-pick`.
- `rows` — a descriptor for the engine's catalogue rows, with an optional
  `wrap` around them:

```js
{ label: 'Sizes',
  wrap: { tag: 'div', class: 'card card--dark', pick: '.card--dark' },
  rows: [
    { kind: 'btn',  size: 'SM', cls: '.btn-sm', text: 'Sign in', heights: '40 / 40' },
    { kind: 'gap',  size: 8 },
    { kind: 'tile', name: 'Icon', cls: '.icon', meta: 'M 24 · D 36', sample: '<img …>' }
  ] }
```

Use `rows` whenever the example is a list of variants with a metadata column:
that markup belongs to the engine, and freezing a snapshot of it would put a
copy of the engine's own chrome into every brand package.

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
`token-map.json` — a data descriptor, no markup:

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
node packages/engine/check-skill.js              # required anchors, forbidden strings, dates
node packages/engine/check-sections.js <brand>   # the package is data, and the section contract
node packages/engine/check-tokens.js <brand>     # dead, phantom and unapplied tokens
node packages/engine/check-css.js <brand>        # raw hex and px outside var()
```

`check-css.js` reads `brands/<id>/css.allow.json` for deliberate exceptions —
each keyed by line number with a reason, so an exception cannot be silent.

Engine tests run against `brands/_template`. A brand passing while the template
fails means the engine grew a dependency on that brand.
