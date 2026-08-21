# Engine changelog

Newest first. Versions only — the timeline lives in git.

## 1.0.0

First release as a standalone engine, extracted from the SDM storybook.

### Added
- Manifest contract: a brand is `?brand=<path>` plus a `manifest.js`.
- Path resolution from the brand folder, including a `<base>` inside the
  preview frame so brand markup can use plain relative asset paths.
- Language packs (`i18n/en.js` default, `i18n/ru.js`), with per-key fallback
  to English; brands pick a locale in the manifest.
- Contract gate: the engine refuses a brand built for another contract major
  and says which side is behind.
- Glass reload overlay while watched files settle.
- Thin, hover-revealed scrollbars in the chrome.

### Changed
- Brand-specific constants (viewport widths, container, watch list, storage
  keys, title, font) now come from the manifest.
- `localStorage` keys are prefixed with the brand id.

### Removed
- Hardcoded SDM stylesheets, font, and the site's `styles.css` from the
  preview frame; comparison CSS is attached by the user or declared per brand.
