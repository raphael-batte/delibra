---
name: delibra-engine
description: >
  Fill or extend a design-system libra — structured data an agent writes and a
  person reads in DeLibra. Always start at ## Router. Use when filling a libra with
  tokens from a design or stylesheet, adding component sections, or working on
  the engine. Triggers: "fill this libra", "copy fill prompt", "create a
  design system from Figma", "take the tokens off the design", "add a section
  to DeLibra", "wire up a brand", "the libra shows the wrong…".
---

# DeLibra engine

The engine renders a design system it knows nothing about. Everything specific
to a brand arrives through a manifest. If a change to the engine mentions a
brand by name, the change is in the wrong file.

**Read this skill top-down. When the user gives a storybook folder path, start
at [## Router](#router) — do not skip it.**

## Router

Run this decision tree **before writing any file**. Open
`brands/<id>/manifest.json` in the folder the user gave you (or in their fill
prompt).

| Step | Condition | What to do |
|------|-----------|------------|
| 1 | `brands/<id>/SKILL.md` exists | Read it **after** this router. Brand rules override generic ones where they conflict. |
| 2 | `manifest.design.source === 'css'` **or** `tokens.css` already has variables and `token-map.json` is non-empty | **Components path.** Tokens are done. Add or extend `components.css`, `sections.json`, assets. Do **not** re-import or rewrite tokens unless the user asks. |
| 3 | `manifest.design.url` is set | **Design path.** Read the design with your Figma access (MCP, local bridge, plugin). Map what you read into tokens and sections. See [Reading the design](#reading-the-design). |
| 4 | No `design.url`, empty tokens, `source` is `blank` or missing | **Stop.** Do not invent tokens or components. Tell the user: add a Figma link in gallery settings, import CSS on the empty screen, or paste a design URL in chat. Wait for a source. |
| 5 | User pasted a Figma URL in chat but manifest has none | Ask whether to add it to `manifest.design.url` (via gallery settings) or proceed with that URL only for this session — still **read** the file, do not guess. |
| 6 | Folder was not created in the gallery | Do not create `brands/<id>/` by hand unless the user explicitly asks. Prefer the gallery or `POST /__api/brand` with `brand-scaffold.js`. |

**Gallery:** `http://localhost:8777/<id>` when `serve.js` runs — the tab reloads
when files change. Open it to verify; do not describe pixels you have not checked
there.

**Done means:** all checks in [Checks](#checks) pass for that brand, not “looks
about right”.

## Output contract (strict — no hallucination)

Everything you write must be **traceable** and **gallery-shaped**.

### Traceability

- **Every token name and value** comes from one of:
  1. A field you read from the design (Figma MCP, bridge, variables export);
  2. An existing line in `tokens.css` / `token-map.json`;
  3. A CSS file the user imported (already in the package);
  4. An explicit user choice after you ran the [Mismatch protocol](#mismatch-protocol).
- **Never** fill gaps from memory, screenshots, “typical” palettes, or other
  design systems.
- **Never** add a component, section, or token “for completeness” unless it
  exists in the design or the user asked for it.
- If you cannot read the design, **stop** and say what is missing — see
  [When the bridge is not answering](#when-the-bridge-is-not-answering).

### File roles (one source of truth each)

| File | Holds | Must not hold |
|------|--------|----------------|
| `tokens.css` | Custom properties only (`:root`, optional `@media` blocks) | Component selectors, layout rules |
| `components.css` | Classes, layout, states — **only** `var(--*)` for colours and sizes | Raw `#hex`, raw `px`/`rem` (except `0`, `none`, `1px`/`2px` hairlines) |
| `token-map.json` | Which tokens appear in which **token catalogue** sections | Markup, component logic |
| `sections.json` | Component **gallery** sections (examples as data) | `render()` functions |
| `assets/` | Icons, images referenced from examples | — |

### Visual and CSS discipline (storybook UI style)

Write so the gallery looks like a **token-first design system reference**, not
a one-off landing page.

- **Token-first:** declare values once in `tokens.css`; components consume
  `var(--*)` only.
- **Desktop-first:** default rules for desktop; **one**
  `@media (max-width: <manifest.breakpoints.mobile>px)` block at the **end** of
  `components.css` for mobile overrides. Put paired mobile/desktop values in
  tokens (`--x` / `--x-m` or separate custom properties), not duplicated rules
  everywhere.
- **Naming:** short BEM-like classes (`.card`, `.card__title`, `.btn--ghost`).
  One component family per block; modifiers with `--`. Match names already in
  the brand before inventing new ones.
- **Chrome tokens:** every brand needs at least the gallery chrome set:
  `--bg`, `--white-pure`, `--border`, `--text-primary`, `--text-heading`,
  `--text-muted`, `--font-family`, plus one radius and one brand accent — see
  `brands/_template/tokens.css`.
- **Token-map section titles** in the descriptor are **English** catalogue
  labels (`Colours`, `Radii`, `Type scale`, …) — they are data, not UI i18n.
- **Sections:** one gallery example per **distinct** component or variant; every
  example must include `data-pick="<selector>"` on a clickable node.
- **Prefer catalogue `rows`** for button/size/icon matrices; use `html` snapshots
  for composed blocks (cards, heroes). Never snapshot the engine’s own row
  chrome into `html` — use `rows` instead.

### Consistency checks before you finish

```bash
node packages/engine/check-sections.js brands/<id>
node packages/engine/check-tokens.js brands/<id>
node packages/engine/check-css.js brands/<id>
```

Fix every reported problem. Do not declare the task complete if a check fails.

## Run it

The gallery **must be served over `http://`**:

```bash
node packages/engine/serve.js 8777
```

Open `http://localhost:8777/<id>` or
`http://localhost:8777/packages/engine/gallery.html?brand=../../brands/_template`.

Opened as `file://`, the browser refuses `document.styleSheets[].cssRules` and
blocks `fetch` of local files. The CSS tab and every token section come up empty
— with no error explaining why.

## Layout

```
packages/engine/
  ENGINE_SKILL.md   this file — router + contract
  gallery.html      chrome, loader
  gallery.js        sections, preview, diff, live reload
  _frame.html       sandbox iframe — real @media
  engine-specs.js   var parser, swatches, token-section renderers
  brand-scaffold.js empty package shape (same as gallery create)
  token-build.js    CSS/Figma variables → token-map (deterministic)
brands/<id>/        DATA ONLY — nothing here is executed
  manifest.json
  tokens.css
  components.css    (or brand-named file from manifest.css.components)
  token-map.json
  sections.json
  assets/
  SKILL.md          optional brand runbook — read when present
tools/
  sections/<id>.js  optional authoring layer → emit-sections.js
```

**A brand package contains only data.** Logic lives under `packages/engine/` and
`tools/`.

## The manifest

```json
{
  "id": "acme",
  "title": "ACME Design System",
  "description": "Tokens and components",
  "version": "0.1.0",
  "engine": 1,
  "css": { "tokens": "tokens.css", "components": "components.css" },
  "sections": "sections.json",
  "tokenMap": "token-map.json",
  "design": { "source": "blank", "url": "https://figma.com/design/…" },
  "breakpoints": { "mobile": 900, "desktopMin": 901 },
  "preview": { "mobileWidth": 390, "desktopWidth": 1440, "container": 1170 }
}
```

`design.source` is one of `blank`, `css`, `figma`, `import`. The gallery sets
it when the storybook is created. **`id` in the file is overwritten to match the
folder name** on disk.

`description` is a one-line summary for humans (home card, lists). Default:
`Tokens and components`. It is not the top-bar section title.

Paths in the manifest are relative to the brand folder.

## Reading the design

Do not eyeball a screenshot or invent from a thumbnail.

**Order of work:**

1. Confirm access (MCP tool, local bridge, or user-provided export).
2. Read **variables/styles** when the file uses Figma variables — map them to
   `--*` names in `tokens.css` and entries in `token-map.json`.
3. For components, read **structure** (frames, auto-layout, text, fills), not
   flattened images alone.
4. Keep `get_screenshot` (or equivalent) and compare after markup exists.

| Design field | Maps to |
|--------------|---------|
| Variables / styles | `tokens.css` + `token-map.json` |
| Frame name / type | Existing component or new section |
| Auto-layout gap, padding | spacing tokens + component rules |
| Fills, strokes | colour tokens — match names, do not hardcode in components |
| Typography | `--font-*` / size tokens |
| Corner radius | `--r-*` |
| Icons / images | export to `assets/`, reference in section `html` |

If a value does not map cleanly, use the [Mismatch protocol](#mismatch-protocol)
— do not silently round or rename.

## When the bridge is not answering

Say the **specific** failure. Do not guess values or continue from memory.

| Situation | What to tell the user |
|-----------|------------------------|
| No Figma tool in the agent | How to enable Figma MCP or the local bridge they use |
| `list_files` / file list empty | Open the design file in Figma; keep the plugin running |
| Selection empty | Select the target frame or page, not an empty canvas |
| Wrong or stale `fileKey` | Re-save or re-link the file; update `design.url` in settings |
| Port / bridge mismatch | Which bridge the repo expects (e.g. Hopp on 1994) vs what is running |

Then **stop** until access works, unless the user explicitly asks to work from
CSS or a pasted export only.

## Mismatch protocol

When the design shows something the storybook does not have yet:

1. **Do not invent** a token name or value.
2. **Stop and offer three options** with consequences:
   ```
   Mismatch: <what exactly, with design value if known>
   A — <option>: <what it means for tokens/sections>
   B — <option>: …
   C — <option>: …
   ```
3. Implement **only** the option the user chooses.
4. Record new tokens in `tokens.css` + `token-map.json`; new rules in
   `components.css`; new examples in `sections.json`.

Typical mismatches: colour off the palette, spacing off the scale, new component
family, desktop/mobile pair not yet in tokens.

## Writing tokens

- Group colours by name prefix in `token-map.json` (`--brand-*`, `--text-*`, …).
- Every declared `--*` in `tokens.css` must appear somewhere in `token-map.json`
  (or in `tokens.deferred.json` with a reason if not yet used in components).
- Unclassifiable tokens go in an **Other tokens** group — never drop them.
- Use the same grouping logic as `token-build.js` when importing CSS or
  variables (colours, radii, type scale, spacing, shadows, other).

## Adding component sections

**New storybook (no `tools/sections/<id>.js` yet):** write `sections.json`
directly as JSON matching the contract below, then run
`check-sections.js`.

**Existing brand with `tools/sections/<id>.js`:** edit the JS builder and run:

```bash
node tools/emit-sections.js <id>
```

Never hand-edit `sections.json` if an emit script owns it — the next emit
overwrites your changes.

```js
{
  id: 'cards',
  group: 'Blocks',
  title: 'Cards',
  code: '.card',
  desc: 'One sentence on what is worth noticing.',
  examples: [
    { label: 'Default', html: '<div class="card" data-pick=".card">…</div>' }
  ]
}
```

**Example shapes — exactly one per example:**

- `html` — brand markup with `data-pick`.
- `rows` — catalogue rows (`btn`, `tile`, `spec`, `gap`) with optional `wrap`.

Load-bearing rules:

- Every example has at least one `data-pick="<selector>"`.
- One example per distinct thing — not an asset dump.
- `wide: true` for full-bleed layouts.
- `htmlDesktop` only when markup genuinely differs by breakpoint.

## Adding a token section

You do not add token sections by hand in the gallery UI. You edit
`token-map.json`:

```json
{
  "colors": {
    "title": "Colours",
    "groups": [{ "title": "Brand", "swatches": [["--blue", "Primary", "CTA"]] }]
  },
  "radii": {
    "title": "Radii",
    "scale": ["--r-8"],
    "semantic": [["--r-card", "cards"]]
  }
}
```

If the engine lacks a renderer shape, add it in `engine-specs.js` for **all**
brands — never a one-brand fork in the engine.

## Golden path (how humans start)

1. User creates a storybook in the gallery → `brands/<id>/` + `index.json`.
2. User opens this repo in their agent and copies the **fill prompt** (folder
   path + pointer to this skill).
3. You run [## Router](#router), then write files.
4. Gallery tab reloads; user reviews tokens and components there.

Do not create parallel folders or skip the router because the prompt sounds
urgent.

## Language

Chrome strings use `t('key')` in `i18n/en.js`. Section titles and token labels
inside the brand package follow the brand’s `locale` — they are brand data.

## Forbidden

- Inventing token names, hex values, or components not read from a source and
  not approved via the mismatch protocol.
- Writing raw `#hex` or raw `px`/`rem` in `components.css` (see `check-css.js`).
- Editing `gallery.js`, `_frame.html`, or `engine-specs.js` to fix one brand.
- A section example without `data-pick`.
- Creating `brands/<id>/` outside the gallery flow without explicit user request.
- Assuming `file://` or guessing Figma data when tools fail.
- Describing the gallery state you have not verified after writing files.

## Checks

```bash
node packages/engine/check-skill.js
node packages/engine/check-sections.js brands/<id>
node packages/engine/check-tokens.js brands/<id>
node packages/engine/check-css.js brands/<id>
```

`check-css.js` honours `css.allow.json` per line — exceptions need a reason.

Engine tests use `brands/_template`. A brand passing while the template fails
means the engine regressed.
