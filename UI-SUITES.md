# Storybook switcher — UI decisions

Recorded before implementation so the shape does not get re-litigated once
`BrandSource` lands. Nothing here is built yet; `ui-mock.html` is the mockup.

## Two menus, two scopes

Following Figma's split: the logo tile is the application, the name with the
chevron is the document.

**Logo — workspace scope.** What exists regardless of which storybook is open:

```
New…
Import file…
─────────────
✓ SDM Design System    Library
  ACME                 Local
  Template             Library
─────────────
Settings…              (later)
About                  (later)
```

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

`Delete` on a library brand must be disabled, never wired to remove the folder
— the browser cannot, and a menu item that does something other than what it
says is worse than a missing one.

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
