# Design systems

A brand-agnostic storybook engine plus the design systems it renders.

```
packages/engine/    the storybook: chrome, preview frames, diff, i18n
brands/sdm/         SDM: tokens, components, sections, assets
brands/_template/   empty brand — proof the engine is actually detached
```

## Run

The gallery **must be served over `http://`**. Opened as a file, the browser
refuses to expose `cssRules`, so the CSS tab and the token sections come up
empty — with no error to explain why.

```bash
cd design-systems && python3 -m http.server 8777
```

Then open <http://localhost:8777/packages/engine/gallery.html>.

Another brand is a query parameter — the engine has no brand baked in:

```
gallery.html?brand=../../brands/_template
```

Paths inside a manifest resolve from the brand folder, so a brand living
outside this repo works through a symlink into `brands/`, as long as the same
server can reach it.

## Versioning

Engine and brands version independently; a single contract integer gates
compatibility. See [VERSIONING.md](VERSIONING.md).
