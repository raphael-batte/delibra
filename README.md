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

## Tests

Three layers, each answering a different question:

| Suite | Question | Run against |
|---|---|---|
| `packages/engine/tests/engine.html` | does the storybook work with any brand? | `_template`, and any brand via `?brand=` |
| `brands/<id>/tests.html` | are this brand's values right? | that brand |
| `contract.js` (inside the engine suite) | does the brand plug in correctly? | every brand |

Open them in the browser with the server running. Engine tests default to
`brands/_template` — that is the point: green on SDM and red on the template
means the engine grew a dependency on SDM.

Command-line checks:

```bash
node packages/engine/check-skill.js
node brands/sdm/check-fonts.js <path-to-site-styles.css>
```

`check-fonts.js` is a migration check against the live site, not a gate. It
narrows and eventually dies as the site moves onto the design system.
