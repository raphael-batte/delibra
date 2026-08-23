#!/usr/bin/env node
/* ==========================================================================
   check-sections — a brand package must consist of data.

   Checks two things:
     · the brand data files (manifest, token map, legacy map, sections) parse
       as JSON and carry no executable code;
     · sections match the contract: an example has exactly one body form —
       a markup snapshot (html) or a catalogue row descriptor (rows).

   Why: a storybook that arrived as a file opens without running foreign
   code. This check catches logic seeping back into a package.

   Run:  node packages/engine/check-sections.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
const rel = p => path.relative(ROOT, p);

if (!fs.existsSync(brandDir)) {
  console.error('no such brand folder: ' + brandDir);
  process.exit(2);
}

const problems = [];
const fail = m => problems.push(m);

/* ── Manifest ────────────────────────────────────────────────────────── */
const manifestJson = path.join(brandDir, 'manifest.json');
const manifestJs   = path.join(brandDir, 'manifest.js');

if (!fs.existsSync(manifestJson)) {
  fail(fs.existsSync(manifestJs)
    ? `${rel(manifestJs)}: the manifest is still code — manifest.json is required`
    : `${rel(brandDir)}: no manifest.json`);
}

const manifest = fs.existsSync(manifestJson)
  ? JSON.parse(fs.readFileSync(manifestJson, 'utf8'))
  : {};

/* ── Not a single executable file in the package ─────────────────────── */
/* tests.html and *.md are not part of the package: repository tooling. */
const NOT_PACKAGE = new Set(['tests.html']);
fs.readdirSync(brandDir).forEach(name => {
  if (name.endsWith('.js') && !NOT_PACKAGE.has(name)) {
    fail(`${rel(path.join(brandDir, name))}: executable file in a brand package`);
  }
});

/* ── Data parses ─────────────────────────────────────────────────────── */
function readData(field, target) {
  const file = manifest[field];
  if (!file) return null;
  const full = path.join(brandDir, file);
  if (!file.endsWith('.json')) {
    fail(`${field}: ${file} — brand data must be JSON`);
    return null;
  }
  if (!fs.existsSync(full)) { fail(`${field}: file missing — ${rel(full)}`); return null; }
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch (e) { fail(`${rel(full)}: does not parse — ${e.message}`); return null; }
}

readData('tokenMap');
readData('legacyNames');
const sections = readData('sections');

/* ── Sections contract ───────────────────────────────────────────────── */
/* The rules live in a shared module: the same ones validate a file brought in
   through Import in the gallery, so the two cannot drift apart. */
const contract = require('./sections-contract.js');
if (sections) contract.check(sections).forEach(fail);

const name = path.basename(brandDir);
problems.forEach(p => console.log('  ✗ ' + p));
if (!problems.length) {
  const count = sections ? sections.length : 0;
  const examples = sections ? sections.reduce((n, s) => n + (s.examples || []).length, 0) : 0;
  console.log(`  ✓ ${name}: ${count} sections, ${examples} examples — data only`);
}
process.exit(problems.length ? 1 : 0);
