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
node packages/engine/serve.js        # port 8777
```

Then open <http://localhost:8777/packages/engine/gallery.html>.

`python3 -m http.server 8777` also works, and everything reads the same — but
deleting a storybook then only removes it from your list, because a page served
as plain static files cannot touch folders on disk. The bundled server adds
exactly that: it is local-only (127.0.0.1) and works strictly inside `brands/`.

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
node packages/engine/check-skill.js            # the skills' contract
node packages/engine/check-tokens.js brands/sdm  # dead tokens, phantoms, unapplied
node packages/engine/check-css.js brands/sdm     # raw hex and px outside var()
node brands/sdm/check-fonts.js <path-to-site-styles.css>
```

A token that is declared and shown in the catalogue but applied by no component
is not dead — it is deferred, and must say so in `brands/<id>/tokens.deferred.json`
with a reason. The check fails both ways: a new unexplained one, and one that
has since been applied but stayed on the list.

`check-fonts.js` is a migration check against the live site, not a gate. It
narrows and eventually dies as the site moves onto the design system.
