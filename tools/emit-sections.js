#!/usr/bin/env node
/* ==========================================================================
   Build brand sections: logic → data.

   Authoring layer (tools/sections/<brand>.js) describes sections with markup
   builders. This script runs it once and writes
   <brand>/sections.json — the file the gallery reads.

   Brand packages must be data-only: a storybook sent as a file opens without
   executing foreign code; logic stays in the repo where it can be reviewed.

   Run:  node tools/emit-sections.js sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = require('../packages/engine/data-root.js');
const brand = process.argv[2];

if (!brand) {
  console.error('brand id required:\n  node tools/emit-sections.js sdm');
  process.exit(2);
}

const srcFile = path.join(ROOT, 'tools', 'sections', brand + '.js');
const dataDir = path.join(DATA.dataRoot(ROOT), brand);
const repoDir = path.join(ROOT, 'brands', brand);
const brandDir = fs.existsSync(dataDir) ? dataDir : repoDir;
const outFile = path.join(brandDir, 'sections.json');

if (!fs.existsSync(srcFile)) {
  console.error('no authoring layer: ' + path.relative(ROOT, srcFile));
  process.exit(2);
}
if (!fs.existsSync(path.dirname(outFile))) {
  console.error('no brand folder: ' + path.relative(ROOT, path.dirname(outFile)));
  process.exit(2);
}

const sections = require(srcFile)();

/* Same checks as check-sections — fail at build time, not in the browser. */
const problems = [];
sections.forEach((s, i) => {
  if (!s.id)    problems.push(`section #${i}: missing id`);
  if (!s.title) problems.push(`${s.id || '#' + i}: missing title`);
  (s.examples || []).forEach((ex, j) => {
    const where = `${s.id}/${ex.label || '#' + j}`;
    if (!ex.label) problems.push(`${s.id}: example #${j} missing label`);
    const forms = ['html', 'rows'].filter(k => ex[k] !== undefined);
    if (forms.length !== 1) problems.push(`${where}: exactly one body form required, got ${forms.join('+') || 'none'}`);
    if (ex.wrap && !ex.rows) problems.push(`${where}: wrap requires rows`);
    if (ex.html && ex.html.indexOf('data-pick') < 0) problems.push(`${where}: markup missing data-pick`);
    if (typeof ex.html === 'function' || typeof ex.rows === 'function') problems.push(`${where}: function instead of data`);
  });
});

if (problems.length) {
  problems.forEach(p => console.error('  ✗ ' + p));
  console.error('\nnot written: ' + problems.length + ' problem(s)');
  process.exit(1);
}

fs.writeFileSync(outFile, JSON.stringify(sections, null, 2) + '\n');

const examples = sections.reduce((n, s) => n + (s.examples || []).length, 0);
const size = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`${path.relative(ROOT, outFile)} — ${sections.length} sections, ${examples} examples, ${size} KB`);
