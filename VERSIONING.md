# Versioning

Two things are versioned independently, and one number ties them together.

## Packages

| Package | Version lives in | Meaning |
|---|---|---|
| `packages/engine` | `ENGINE_VERSION` in `brand.js` | the storybook itself |
| `brands/<id>` | `version` in `manifest.js` | that design system's data |

Both follow SemVer, and they move on their own schedule: a colour fix in a
brand is not an engine release, and an engine fix does not restamp every brand.

### Engine — what each bump means

- **major** — the manifest contract changed in a way existing brands do not
  satisfy: a required field appeared, a field changed shape, or a `window.*`
  global a brand relies on was renamed. A major bump **must** raise
  `CONTRACT_MAJOR`.
- **minor** — new capability, old brands keep working: an optional manifest
  field, a new i18n key (with an English default), a new section helper.
- **patch** — behaviour fix with no contract change.

### Brand — what each bump means

- **major** — a token was removed or renamed, or a component's markup contract
  changed. Anyone who copied that markup has work to do.
- **minor** — a token or component was added; existing ones untouched.
- **patch** — a value corrected to match the design source, no names moved.

## The contract number

`CONTRACT_MAJOR` in `brand.js` is the only compatibility gate. Every brand
declares which one it speaks:

```js
// brands/<id>/manifest.js
engine: 1
```

On load the engine compares the two and refuses to render on a mismatch, with
a sentence saying which side is behind. A brand that omits `engine` is not
blocked — that keeps pre-contract brands openable — but new brands must set it.

The gate is deliberately coarse: one integer, checked once. Range expressions
(`^1.2`) would imply the engine tracks per-feature compatibility, and it does
not.

## Changelogs

`CHANGELOG.md` per package, newest first, versions only — **no dates**. Dates
in a library that other people install are noise; the timeline lives in git,
where it stays accurate. `check-skill.js` fails the build on a dated changelog
entry, so this is enforced, not merely agreed.

Group entries under `Added` / `Changed` / `Fixed` / `Removed`.

## Release procedure

1. Bump the version in `brand.js` or `manifest.js`.
2. Move the changelog's `Unreleased` items under the new version.
3. If the engine bumped major: raise `CONTRACT_MAJOR` and update every brand's
   `engine` field, in the same commit — a split commit leaves the repo in a
   state where nothing opens.
4. Tag: `engine-v1.2.0`, `sdm-v0.3.0`. Prefixed tags let one repo hold several
   packages without ambiguity, and survive the eventual `git subtree split`.

## Git history

The repo holds several packages, so every commit says which one it touched:

```
engine: route chrome strings through the i18n pack
sdm: split card tints from track tints
docs: describe the contract gate
repo: add .gitignore
```

Scopes are the folder names — `engine`, the brand id, `docs`, `repo`. A commit
that touches both the engine and a brand is usually two commits; the exception
is a contract major bump, which must land as one (see step 3 above).

Rules that matter more than the format:

- **One reason per commit.** "Fix icons and add versioning" cannot be reverted.
- **The body says why, not what** — the diff already says what.
- **No dates in files.** The timeline is `git log`, which stays correct when a
  file is copied, moved, or vendored; a hand-written date does not.
- **Tags are prefixed**: `engine-v1.2.0`, `sdm-v0.3.0`. This keeps releases
  unambiguous while packages share a repo, and survives `git subtree split`
  when the engine eventually moves out.
