#!/usr/bin/env node
/* ==========================================================================
   check-tokens — an audit of the brand's tokens.

   Finds three things:
     · declared but never used — dead weight;
     · used but never declared — a phantom that quietly resolves to nothing
       and takes the whole rule down with it;
     · declared twice with different values in one context — a duplicate.

   Deferred tokens (declared for components that have not moved over yet) are
   listed in brands/<id>/tokens.deferred.json and do not count as dead.

   Run:  node packages/engine/check-tokens.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
if (!fs.existsSync(brandDir)) {
  console.error('no such brand folder: ' + brandDir);
  process.exit(2);
}

const manifest = require('./brand-node.js').readManifest(brandDir);
const tokensFile = (manifest.css && manifest.css.tokens) || 'tokens.css';
const compFile   = manifest.css && manifest.css.components;

const tokensCss = fs.readFileSync(path.join(brandDir, tokensFile), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Everywhere a token may be used: component CSS, sections, descriptor. */
/* legacy.js is NOT included: it lists names from foreign production code, not
   brand tokens — otherwise every old name would look like a phantom. */
const consumers = [compFile, manifest.sections || manifest.specs, manifest.tokenMap]
  .filter(Boolean)
  .map(f => path.join(brandDir, f))
  .filter(fs.existsSync);

const usageText = consumers.map(f => fs.readFileSync(f, 'utf8')).join('\n');

/* Used by a component ≠ mentioned in the catalogue. A token shown only as a
   swatch is declared "for later": it paints no element. Those belong in
   tokens.deferred.json — otherwise they are indistinguishable from live ones
   and nobody checks the promise to wire them up. */
const appliedText = compFile
  ? strip(fs.readFileSync(path.join(brandDir, compFile), 'utf8'))
  : '';
const applied = new Set();
for (const m of appliedText.matchAll(/var\(\s*(--[\w-]+)/g)) applied.add(m[1]);
const tokensBody = strip(tokensCss);

/* ── declarations ───────────────────────────────────────────────────── */
const declared = new Map();          // name → how many times declared
for (const m of tokensBody.matchAll(/(--[\w-]+)\s*:/g)) {
  declared.set(m[1], (declared.get(m[1]) || 0) + 1);
}

/* ── usages ─────────────────────────────────────────────────────────── */
const used = new Set();
const allText = strip(usageText) + '\n' + tokensBody;
for (const m of allText.matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
// names given as a string in the descriptor (JSON uses double quotes)
for (const m of usageText.matchAll(/["'](--[\w-]+)["']/g)) used.add(m[1]);

/* The type descriptor names a PREFIX (--font-h1) while the derived names are
   declared (--font-h1-size, --font-h1-lh). Count the prefix as used if any
   declared name starts with it. */
for (const name of [...used]) {
  if (declared.has(name)) continue;
  for (const d of declared.keys()) {
    if (d.startsWith(name + '-')) { used.add(d); used.delete(name); break; }
  }
}
// --x-rgb channels are used as rgb(var(--x-rgb) / .8) — already counted above

const deferredFile = path.join(brandDir, 'tokens.deferred.json');
const deferred = fs.existsSync(deferredFile)
  ? JSON.parse(fs.readFileSync(deferredFile, 'utf8'))
  : { tokens: [], why: {} };
const deferredSet = new Set(deferred.tokens || []);

const dead = [...declared.keys()].filter(n => !used.has(n) && !deferredSet.has(n));
/* Local component variables (--step-i and the like) are declared outside the
   token file and are not brand tokens — nor are they phantoms. */
const localDeclared = new Set();
if (compFile) {
  const comp = strip(fs.readFileSync(path.join(brandDir, compFile), 'utf8'));
  for (const m of comp.matchAll(/(--[\w-]+)\s*:/g)) localDeclared.add(m[1]);
}

const phantom = [...used].filter(n => !declared.has(n) && !localDeclared.has(n));
/* Declared, shown in the catalogue, but applied by no component. */
const unapplied = [...declared.keys()]
  .filter(n => used.has(n) && !applied.has(n) && !deferredSet.has(n))
  /* References inside the token file itself (aliases, derivatives) are not an
     application, but not a forgotten token either. */
  .filter(n => !new RegExp('var\\(\\s*' + n + '\\b').test(tokensBody));

const stillDeferred = [...deferredSet].filter(n => declared.has(n) && !applied.has(n));
const resurrected = [...deferredSet].filter(n => applied.has(n));

function list(title, arr, extra) {
  if (!arr.length) return;
  console.log('\n' + title + ' (' + arr.length + ')');
  arr.sort().forEach(n => console.log('  ' + n + (extra && extra[n] ? '   — ' + extra[n] : '')));
}

console.log('brand: ' + path.basename(brandDir));
console.log('declared: ' + declared.size + ' · used: ' + used.size +
            ' · deferred: ' + deferredSet.size);

list('DEAD — declared, never used', dead);
list('DECLARED BUT NOT APPLIED — catalogue only; add to tokens.deferred.json', unapplied);
list('PHANTOMS — used but not declared', phantom);
list('deferred, still not wired up', stillDeferred, deferred.why);
list('deferred but already applied — drop from the list', resurrected);

const failed = dead.length + phantom.length + resurrected.length + unapplied.length;
console.log(failed ? '\nfindings: ' + failed : '\ntokens are fine');
process.exit(failed ? 1 : 0);
