# DeLibra

**Design systems, structured for engineers and AI agents.**

**New here?** → [GETTING-STARTED.md](GETTING-STARTED.md) — clone, run, create your first libra.  
**No GitHub?** → [HANDOFF.md](HANDOFF.md) — zip the engine and send a `.lbr` file.

Repository name: **`delibra`**. Product name in the UI: **DeLibra**. A **libra**
is one design-system instance (storybook package), not the git repo.

Turn design systems into agent-ready data. A person reads a libra — tokens,
components, the code that renders them, side by side with the production CSS.
An agent writes it: you point it at the libra's folder and its skill, and
it carries the values over from Figma, or from a stylesheet you already have.

There is no magic button. What DeLibra gives an agent is a place to write
into and a contract to follow; what it gives you is the result, readable and
comparable. The source of truth stays the files in the folder.

Two ways in: **from a design**, through whatever Figma access your agent has,
or **from a CSS file** — the gallery reads its custom properties and builds the
token reference itself.

```
packages/engine/    DeLibra engine: chrome, preview frames, diff, i18n
brands/_template/   empty reference brand — engine contract tests only
tools/              logic that produces brand data, and CLI checks
```

**Engine repo and libra data are separate.** All storybooks live in a data
directory on disk — not in git:

```bash
export DELIBRA_DATA=~/Work/libras    # optional; default ~/.delibra/libras
node packages/engine/serve.js
```

Each libra is `$DELIBRA_DATA/<id>/` plus an entry in `$DELIBRA_DATA/index.json`.
Migrate existing folders out of the repo once:

```bash
node scripts/migrate-brands-to-data.js
```

A brand package contains data and nothing else — no file inside `brands/` is
executed. That is what makes a storybook safe to send as a file and open on
another machine. Sections are authored in `tools/sections/<brand>.js` and
emitted with `node tools/emit-sections.js <brand>`.

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
exactly that: it is local-only (loopback IPv4 + IPv6) and works strictly inside
`DELIBRA_DATA`.

Another brand is a query parameter — the engine has no brand baked in:

```
gallery.html?brand=../../brands/_template
```

Paths inside a manifest resolve from the brand folder. With `serve.js`, libras
load from `/__data/<id>/` while files live under `DELIBRA_DATA/<id>/`.

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
`_template` via `?id=_template` — that is the point: green on SDM and red on
the template means the engine grew a dependency on SDM.

**Node:** `serve.js` runs on Node 14+; the test runner (`node --test`) needs **Node 18+**.

```bash
npm test                                # node --test test/*.test.js (Node 18+)
node packages/engine/check-package.js   # same hygiene rules, CLI output
```

Browser suites (with `node packages/engine/serve.js` running):

| Page | What it checks |
|------|----------------|
| `packages/engine/tests/engine.html` | gallery on `_template` (`?id=_template`) |
| `/__data/sdm/tests.html` or `?id=sdm` | SDM brand values (data home) |
| `packages/engine/tests/empty.html` | onboard, settings, duplicate regression (creates temp libras via API) |

Command-line checks (default libra: `$DELIBRA_DATA/sdm`, usually `~/.delibra/libras/sdm`):

```bash
node packages/engine/check-package.js
node packages/engine/check-skill.js
node packages/engine/check-sections.js          # or pass path / id
node packages/engine/check-tokens.js
node packages/engine/check-css.js
node tools/check-fonts.js <path-to-site-styles.css>
```

A token that is declared and shown in the catalogue but applied by no component
is not dead — it is deferred, and must say so in `brands/<id>/tokens.deferred.json`
with a reason. The check fails both ways: a new unexplained one, and one that
has since been applied but stayed on the list.

`check-fonts.js` is a migration check against the live site, not a gate. It
narrows and eventually dies as the site moves onto the design system.

## License

Copyright 2026 Raphael Batyrbaev. Licensed under the [Apache License 2.0](LICENSE).
