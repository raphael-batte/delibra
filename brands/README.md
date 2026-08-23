# Engine reference brand only

Libras (design-system storybooks) **do not live in this repository**.

They live in your data directory:

```bash
export DELIBRA_DATA=~/Work/libras   # optional — default is ~/.delibra/libras
node packages/engine/serve.js
```

Each libra is a folder there plus an entry in `$DELIBRA_DATA/index.json`.

**`_template/`** stays here — the engine contract proof for tests
(`packages/engine/tests/`). It is not listed on the home screen.
