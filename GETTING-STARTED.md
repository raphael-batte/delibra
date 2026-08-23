# Getting started with DeLibra

DeLibra is a **local** design-system engine. You clone the repo, start a small
Node server, and open the gallery in the browser. Libras (your design-system
storybooks) are **not** in git — they live in a data folder on your machine.

## Requirements

- **Node.js** — 14+ to run the gallery server; **18+** for `npm test`
- A browser (Chrome, Safari, Firefox)
- No `npm install` — the engine has no package dependencies

## Install and run

```bash
git clone https://github.com/raphael-batte/delibra.git
cd delibra
node packages/engine/serve.js
```

Open **http://localhost:8777/** (home screen).

Optional port:

```bash
node packages/engine/serve.js 8799
```

The server binds **loopback only** (`127.0.0.1` and `::1`), so both
`http://localhost:8777/` and `http://127.0.0.1:8777/` work. It must not be
exposed to the network.

### If the page will not open

1. Confirm the process is from **this** repo (`~/Work/delibra`), not an old path:

   ```bash
   curl -s http://127.0.0.1:8777/__api/ping
   ```

   The JSON `root` field must point at your delibra checkout.

2. Kill stale servers and restart:

   ```bash
   pkill -f "packages/engine/serve.js"
   cd ~/path/to/delibra && node packages/engine/serve.js
   ```

3. Prefer `http://127.0.0.1:8777/` if `localhost` still fails.

Do **not** open `gallery.html` as a `file://` URL — the browser blocks `cssRules`,
and the CSS / token panels stay empty with no useful error.

## First libra

1. On the home screen, create a new libra (blank, from design link, or from CSS).
2. DeLibra writes a folder under your data directory and opens the gallery.
3. Copy the agent prompt from the empty / onboard screen and fill tokens and
   sections with your agent (see `packages/engine/ENGINE_SKILL.md`).

### Where files live

| What | Where |
|------|--------|
| Engine (this repo) | your clone of `delibra` |
| Libras (storybooks) | `~/.delibra/libras` by default |
| Catalog | `$DELIBRA_DATA/index.json` |

Override the data folder:

```bash
export DELIBRA_DATA=~/Work/libras
node packages/engine/serve.js
```

Each libra is `$DELIBRA_DATA/<id>/` (manifest, tokens, sections, assets).

Useful URLs with the server running:

| URL | Opens |
|-----|--------|
| `/` | Home — list of libras |
| `/new` | Create flow |
| `/<id>` | Gallery for that libra (e.g. `/sdm`) |
| `/_template` | Engine reference brand (read-only) |

## Import and share

- **Export** a libra as a `.lbr` archive from the gallery menu.
- **Import** a `.lbr` from the create flow — works with the server (disk) or
  offline in browser storage.
- Brand packages are **data only** (no executable code). See [BRAND-PACKAGE.md](BRAND-PACKAGE.md).

## Language

The UI language pack defaults to English; Russian is available in workspace
settings (`packages/engine/i18n/`). Brand content (section titles, copy) stays
in whatever language that design system uses.

## Checks (optional)

With Node 18+:

```bash
npm test
node packages/engine/check-package.js
```

Against the default libra in `$DELIBRA_DATA` (usually `sdm` if you have one):

```bash
node packages/engine/check-sections.js
node packages/engine/check-tokens.js
node packages/engine/check-css.js
```

## Next reading

- [README.md](README.md) — product overview, tests, CLI checks
- [BRAND-PACKAGE.md](BRAND-PACKAGE.md) — what a libra folder contains
- [VERSIONING.md](VERSIONING.md) — engine vs brand contract
- [packages/engine/ENGINE_SKILL.md](packages/engine/ENGINE_SKILL.md) — instructions for AI agents filling a libra
