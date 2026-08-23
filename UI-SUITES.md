# Storybook switcher — UI decisions

Recorded before implementation so the shape does not get re-litigated once
`BrandSource` lands. Nothing here is built yet; `ui-mock.html` is the mockup.

## Two menus, two scopes

Following Figma's split: the logo tile is the application, the name with the
chevron is the document.

**Logo — workspace scope.** What exists regardless of which storybook is open:

```
New storybook…
─────────────
✓ SDM Design System    Library
  ACME                 Local
  Template             Library
─────────────
Settings…              (later)
About                  ← engine version, contract, open storybook
```

The version does not belong under the logo: a line next to the name reads as
part of the name, and the number is wanted rarely. It lives in About.

## Creating a storybook

One entry, because creating and importing are branches of the same intent, and
the dialog that offers them is also the empty-start screen.

| Branch | Input | What you get |
|---|---|---|
| From a storybook file | `.dsz` | the whole package, as it was exported |
| From a CSS file | any stylesheet with custom properties | a token-only storybook, parsed |
| From the template | nothing | neutral tokens and one button |

**From CSS is the branch that matters.** Most teams already have a stylesheet
full of `--custom-properties`; that is a design system nobody can look at. The
engine already parses exactly this — `parseVars` in `engine-specs.js` reads
`:root`, the desktop media query and the mobile one — so the import is
classification, not parsing:

- `#hex` / `rgb()` / `hsl()` → colour swatches, grouped by name prefix
  (`--brand-*`, `--text-*`, `--bg-*`) and by what the value is;
- `px` / `rem` on a `--font-*`-ish name, or a value between 10 and 96 → type scale;
- `--r-*`, or any `px` under 100 used with `radius` in the name → radii;
- `0 … rgb()` shaped values → shadows;
- everything else → a "Other tokens" table, listed rather than hidden.

The guesswork is in the grouping, not the values, so the result is honest even
when the grouping is wrong: every token appears somewhere, and the descriptor
it produces is a plain `token-map.js` the user can correct by hand.

What CSS cannot give is components: a stylesheet has rules, but nothing says
which of them are worth showing or what markup demonstrates them. So a
CSS-imported storybook starts as tokens only, and sections get added the normal
way.

**Chevron — active storybook scope:**

```
Settings…      name · css to validate · preview widths
Duplicate
Export as file
─────────────
Delete…
```

## Where each setting lives

| Setting | Scope | Why |
|---|---|---|
| interface language | workspace | it is the chrome's language, not the brand's; the manifest `locale` is only the default, and a reader who does not speak it must be able to switch |
| default preview scale | workspace | a habit of the person, not a property of the system |
| live reload on/off | workspace | development convenience |
| name | storybook | part of the package; travels on export |
| css to validate | storybook | comparing against another storybook's file silently lies |
| preview widths | storybook | a property of the design system |

## Library vs local

| | Library (folder on disk) | Local (imported or created) |
|---|---|---|
| edited in | IDE | the file, via export/import |
| settings stored | workspace registry, keyed by path | inside the package |
| rename / delete | unavailable — offer **Duplicate** instead | available; delete asks first |
| survives clearing browser storage | yes, it is on disk | no |

The badge in the list is not decoration: two rows otherwise look identical
while behaving differently, and the difference is "does this survive".

**Delete depends on the server, and says which it is doing.** A page served as
static files cannot remove a folder — there is no browser API for it — so there
`Delete` reads *Remove from this gallery* and only drops the entry and its local
data. Run `packages/engine/serve.js` and the same button deletes the folder for
real, with the label and the warning changed to match. What must never happen is
a button that says "delete" and quietly does something smaller.

Deletion asks for the word `delete` to be typed. "Are you sure?" gets clicked
without reading; this does not.

**Identity is the folder, never `manifest.id`.** Copying a brand folder carries
the original id along, and settings, attached CSS and deletion would then all
address the wrong storybook — this was a real bug, caught by duplicating
`_template` and watching delete aim at the original.

## What export carries

The package: manifest, tokens, components, sections, descriptor, assets, name.

**Not** the attached comparison CSS. That is a local working file, often
somebody else's production code; a package sent to a colleague must not carry
it.

## Deliberately out of scope

Token editing in the UI, gallery theming, list sorting. The first is a separate
product; the rest are settings for their own sake.

## Known breaking point

Figma has no file switcher in the logo menu at all — files live on a separate
screen. Our list is short enough for a menu, but past roughly a dozen
storybooks it will need its own surface. Not a reason to change the structure
now, only to know where it cracks.
