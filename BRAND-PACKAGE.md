# Brand package format

This is the format an agent writes and the gallery reads. A person never edits
it by hand — they read the result and hand the agent the next task.

A brand is a set of files plus a manifest that says what they are. Where those
files physically live — a folder on the server or a `.dsz` archive — is a
transport detail. The engine talks to a `BrandSource`, never to a filesystem.

```
BrandSource
  manifest()        → parsed manifest object
  url(path)         → a URL the browser can load (http path, or blob:)
  text(path)        → file contents as a string
```

Two transports, one contract:

| Transport | Role | Good for |
|---|---|---|
| `folder` | canonical at rest | development, the repo |
| `.dsz` (zip) | **the only exchange format** | handoff, backup, import |

**Canonical form is the plain folder.** A brand lives unpacked — readable,
diffable, editable in place — and that is the only form the engine reads at
rest. A `.dsz` file is an *exchange* artifact: produced on export, consumed on
import, unpacked back into a folder. Nothing runs out of the archive, so the
round trip must be lossless — export then import has to reproduce the folder
byte for byte, including the opaque payload the engine never interprets.

With `node packages/engine/serve.js`, export zips the whole brand folder;
import unpacks into a new folder under `brands/`.

## Layout

Same tree in the folder and inside the archive:

```
manifest.json        required — without it the file is a guess, not a brand
tokens.css
components.css
sections.json
token-map.json
assets/…
optional/            opaque: carried, never interpreted
```

Rules:

1. **`manifest.json` is mandatory.** It names the entry points; nothing is
   discovered by convention.
2. **Known keys are read** — `css.tokens`, `css.components`, `specs`,
   `tokenMap`, `assetsBase`, `font`, `preview`, `breakpoints`, `locale`.
3. **Everything else is opaque payload.** Store it, move it, hand it back on
   export; never interpret it. This is what makes "put whatever you want in
   there" safe rather than undefined.
4. **Versions gate compatibility.** `formatVersion` describes the container,
   `engine` the manifest contract (see VERSIONING.md). An old engine meeting a
   newer file must fail with a sentence, not an empty screen.

## Executable content

`sections.js` is JavaScript, and a folder brand in this repo is trusted code —
that is fine today. An imported file is not: a brand that arrived over chat or
email must not be evaluated just because someone opened it.

So the moment import lands, sections need one of:

- data-described sections (JSON descriptors the engine renders), or
- evaluation inside the sandboxed preview frame under a CSP, never in the
  gallery's own context.

The first is preferable and is where the token-section descriptor work is
already heading — `token-map.js` is data, not code.

## Explicitly out of scope

- A binary blob with no schema. Unreadable in two years, by anyone.
- Shipping the engine inside the package. That is an installer, not a brand.
- Auto-discovery of files by naming convention, in place of the manifest.
- A second exchange format (JSON bundle, etc.). One archive, one extension: `.dsz`.
