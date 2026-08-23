# Handoff without GitHub

Send **two files**. Recipients need nothing installed except Node.js and a browser.

| File | What it is |
|------|------------|
| `delibra-engine.zip` | DeLibra engine (this repo, no git, no libra data) |
| `*.lbr` | One design-system libra (export from the gallery) |

## You — build the engine archive

From this repo:

```bash
./scripts/make-handoff.sh
```

Output: `dist/delibra-engine.zip` (contains `delibra/` + `START.txt`).

## You — export the libra

1. `node packages/engine/serve.js`
2. Open the libra (e.g. http://127.0.0.1:8777/sdm)
3. Libra menu (chevron) → **Export** → save `sdm.lbr` (name varies)

## You — send

- `dist/delibra-engine.zip`
- `sdm.lbr` (or whatever you exported)
- Optional: link to https://nodejs.org if they may not have Node

## They — install

See `START.txt` inside the zip. Summary:

```bash
unzip delibra-engine.zip
cd delibra-engine/delibra
node packages/engine/serve.js
```

Open http://127.0.0.1:8777/ → **Import libra** → choose the `.lbr` file.

More detail: `GETTING-STARTED.md` inside `delibra/`.
