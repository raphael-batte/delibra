# SDM design system

Tokens and components for the SDM bank site, packaged as a brand for the
storybook engine.

```
manifest.json   what the engine reads first
tokens.css      196 custom properties — the only place values live
sdm.css         components, written entirely against those properties
token-map.json  which tokens appear in which token section
sections.json   component sections for the gallery — generated, never hand-edited
legacy.json     the same tokens under their old names in the website's CSS
assets/         icons and illustrations used by the sections
```

Nothing here is executed: the gallery parses every one of these files. Sections
are authored in `tools/sections/sdm.js` and emitted with
`node tools/emit-sections.js sdm`.

## Open it

```bash
cd design-systems && python3 -m http.server 8777
```

`http://localhost:8777/packages/engine/gallery.html`

`http://` is required. Opened as a file, the browser blocks `cssRules` and
local `fetch`, and the token sections come up empty with no error.

## Load order

`tokens.css` first, then `sdm.css`. The components resolve their values at use
time, so the reverse order yields a page styled with nothing but fallbacks.

## What is not here yet

Header, mega menu, mobile menu, search dialog, footer, and the package
comparison table are still only in the website. `--shadow-*`, `--blur-*` and
`--ring-on-dark` are declared for them and apply once those components land.

## Checks

```bash
node packages/engine/check-sections.js brands/sdm    # the package is data
node packages/engine/check-tokens.js brands/sdm     # dead tokens, phantoms
node packages/engine/check-skill.js                 # the skill's contract
node tools/check-fonts.js <path-to-site>/app/styles.css   # migration diff
```

Open `tests.html` for the 30 brand cases; the engine's own suite lives in
`packages/engine/tests/`.
