# Brand package format

This is the format an agent writes and the gallery reads. A person never edits
it by hand — they read the result and hand the agent the next task.

A brand is a set of files plus a manifest that says what they are. Where those
files physically live — a folder on the server, one JSON file, a zip — is a
transport detail. The engine talks to a `BrandSource`, never to a filesystem.

```
BrandSource
  manifest()        → parsed manifest object
  url(path)         → a URL the browser can load (http path, or blob:)
  text(path)        → file contents as a string
```

Three transports, one contract:

| Transport | Status | `url()` returns | Good for |
|---|---|---|---|
| `folder` | shipped | `/brands/<id>/…` | development, the repo |
| `.ds.json` | deferred | `blob:` from memory | exchange between machines |
| `.dsz` (zip) | deferred | `blob:` from memory | heavy assets, arbitrary payload |

**Canonical form is the plain folder.** A brand lives unpacked — readable,
diffable, editable in place — and that is the only form the engine reads at
rest. An archive is an *exchange* artifact: produced on export, consumed on
import, unpacked back into a folder. Nothing runs out of the archive, so the
round trip must be lossless — export then import has to reproduce the folder
byte for byte, including the opaque payload the engine never interprets.

**Current decision: the folder is the only transport.** Export and import wait
until the gallery can hold several design systems at once — until then there is
no second slot to import into, and a bundle would only round-trip a folder to
itself. This document exists so that when the work starts, the format is a
decision already made rather than one improvised under deadline.

What that defers, concretely: `BrandSource` is not extracted yet, the engine
still resolves brand paths directly. The refactor is small and local to
`brand.js`, and nothing else should grow a dependency on those paths meanwhile.

## Why JSON first

Not a rejection of a real container — the same contract, without the zip
dependency. The engine has no build step and no dependencies; reading a zip in
the browser means shipping a library or writing an inflater, and for a brand
whose assets are SVG that buys nothing. JSON also diffs in git, which a zip
does not.

The move to zip is mechanical: the fields stay, the files become entries, and
`BrandSource` does not change.

## Layout

Same shape in every transport — in `.ds.json` the tree is the `files` map, in
`.dsz` it is the archive entries.

```
manifest.json        required — without it the file is a guess, not a brand
tokens.css
components.css
sections.js
token-map.js
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
