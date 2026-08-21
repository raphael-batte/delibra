---
name: sdm-design-system
description: >
  Build SDM bank screens and components from Figma using the SDM design system.
  Use when laying out a page, section, card or component for SDM. Triggers:
  "build this screen", "match the mockup", "add a section", "lay out this card".
---

# SDM design system

## Source of truth

**`brands/sdm/tokens.css` + `brands/sdm/sdm.css`.** Nothing else.

The website's `ui2026/app/styles.css` is the *old* code being migrated away
from. It is a comparison target, never an authority: where the two disagree,
the design system is right and the site is behind. Do not copy class names or
values out of it.

The gallery is the readable form of the same thing. Open it before writing CSS:

```bash
cd design-systems && python3 -m http.server 8777
```

`http://localhost:8777/packages/engine/gallery.html` — click any element to get
its HTML, its CSS and the tokens it consumes.

## Working order

1. Find the closest existing component in the gallery.
2. Click it, copy the markup, **do not copy the styles** — they already exist.
3. Only if nothing matches: add tokens → add the rule to `sdm.css` → add a
   section to `sections.js` → add a test.

## Rules

- **Components use `var(--*)` only.** No raw hex, no raw px outside the token
  file. Exceptions: `0`, `none`, and 1px hairlines.
- **Desktop-first.** One `@media (max-width: 900px)` at the end of the file.
  A token holds both values; components never branch on breakpoint themselves.
- **Breakpoints:** `≤ 900` mobile, `≥ 901` desktop.
- **Dark surfaces are a context, not a variant.** `.card--dark` re-points the
  text and button tokens; children need no dark-specific classes.
- Never invent a token name. If the value is not in the system, follow the
  mismatch protocol below.

## Reading a Figma frame

Do not eyeball a screenshot. Pull these fields, in this order:

| Field | Maps to |
|---|---|
| node name and type | which component this is, or that it is new |
| `bounds` | width/height, and whether the size is fixed or hugging |
| `autoLayout` | direction, gap → `--gap-*`, padding → `--card-pad*`, alignment |
| `fills` | `--card-*` / `--bg` / gradient token — match, never sample-and-hardcode |
| typography | size / weight / lineHeight → `--font-*` |
| `cornerRadius` | `--r-*` |
| children | the actual structure, not what the flattened image suggests |
| `get_screenshot` | keep it, compare after the markup is written |

**A text node's bounds are not the icon size.** SF Symbols include ascenders and
descenders in the box: a 33×29 text bounds is a 24px icon. Icon sizes in this
system are 24 mobile / 36 desktop, inside 52/72 tiles. Measuring the box instead
of asking has produced wrong icon sizes twice.

**Square the canvas of any SVG you import.** Several source icons ship
non-square viewBoxes (37×50, 30×39, 40×29); at equal CSS height they look like
different sizes, and no amount of CSS fixes it. Normalise the viewBox, leave the
paths alone.

## When the Figma bridge is not answering

Say the specific line. Do not guess values from memory, and do not fall back to
reading PDFs — that is how the cover blocks went wrong.

| Situation | What to say |
|---|---|
| MCP not in the tool list | "Open Figma → Plugins → Development → Figma MCP Bridge" |
| `list_files` returns nothing | "Open the SDM-website file, and leave the plugin running" |
| `get_selection` is empty | "Select the root frame, not a group of vectors" |
| `fileKey` changed | "The file was re-saved — select the frame again" |
| an old bridge is holding the port | "Port 3999 is the other bridge; we work through Hopp on 1994" |

## Mismatch protocol

When Figma shows something the system does not have:

1. **Do not invent** a name or a value.
2. **Offer three options** with consequences:
   ```
   Mismatch: <what exactly>
   A — <name>: <what it means, what it costs>
   B — <name>: …
   C — <name>: …
   ```
3. Build the chosen one.
4. Record the decision: token or rule in the code, and a line in the changelog.

Typical cases: a fill outside `--card-*`; a new card type; a spacing value off
the scale; a dark surface on a component that has no dark context yet.

## Not in the system yet

Do not assume these exist — they are being migrated:

- header, mega menu, mobile menu, search dialog, footer
- package comparison table
- `--shadow-*`, `--blur-*`, `--ring-on-dark` are declared but only apply once
  the components above land

## Known divergences from the site

- The mint tint `#BCE3ED` exists in `styles.css` and **not** in the system.
  Teal replaced it.
- Card tints and track tints are separate now: `--card-blue` `#D3EAFD` is not
  `--track-blue` `#CDE1F4`.
- `--r-md` is 24px. The v0.1 Figma export said 16 — that was an export error,
  confirmed against both the built markup and the source frames.
- Typography comes from the built HTML mockups, checked against Figma blocks.
  `styles.css` has no semantic type tokens at all: sizes are inlined per
  component and mobile lives in a separate `--m-fs-*` set.

## Changelog

### 0.2.0
- Packaged as a brand: manifest, token descriptor, own assets.
- Token reference shows every sized token on both breakpoints.
- `--r-md` corrected to 24px; card tints split from track tints; typography
  reconciled with the built markup across 29 divergences.
- `.feature` removed — `.perk` is the surviving component.

### 0.1.0
- First token set exported from Figma.
