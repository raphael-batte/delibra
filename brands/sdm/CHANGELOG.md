# SDM design system changelog

Newest first. Versions only — the timeline lives in git.

## 0.2.0

### Changed
- Packaged as a brand: `manifest.js` declares tokens, components, sections and
  assets; the storybook no longer assumes SDM.
- Illustrations moved from the site's `images/` into `assets/img/`, so the
  package renders without the website checked out next to it.

### Added
- Token reference covering both breakpoints for every sized token.

### Fixed
- `--r-md` restored to 24px (the v0.1 export said 16).
- Card tints separated from track tints.
- Typography reconciled with the built markup across 29 divergences.
