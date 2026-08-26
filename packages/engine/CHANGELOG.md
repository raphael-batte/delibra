# Engine changelog

Newest first. Versions only — the timeline lives in git.

## 1.1.0

### Added
- Empty storybooks omit viewport numbers (`preview: {}`). A mobile pane appears
  only when the libra sets `preview.mobileWidth`.
- CSS import writes `breakpoints.mobile` from the largest `@media (max-width)`
  in the file. `900` is used only when mobile tokens exist but the width was
  not recorded.
- Fill prompt starts at Intake and states whether mobile, breakpoints, and
  dark specimens are already decided.

### Changed
- Desktop preview no longer falls back to a 1440 device frame when
  `desktopWidth` is omitted — the pane is the viewport.
- `parseVars` lives in `parse-vars.js` and treats any `max-width` / `min-width`
  as mobile / desktop buckets.

### Fixed
- Mobile pane label: brand breakpoint is `≤N`; an example phone frame that is
  not that breakpoint (e.g. 422) stays a plain width.

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
