#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const DATA = require('../packages/engine/data-root.js');

const ROOT = path.resolve(__dirname, '..');
const REPO_BRANDS = DATA.repoBrands(ROOT);
const DATA_ROOT = DATA.dataRoot(ROOT);
const KEEP = new Set(['_template', 'README.md', '.gitkeep']);

DATA.ensureDataRoot(DATA_ROOT);

const indexFile = path.join(DATA_ROOT, 'index.json');
let index = fs.existsSync(indexFile)
  ? JSON.parse(fs.readFileSync(indexFile, 'utf8'))
  : { brands: [] };

const repoIndex = path.join(REPO_BRANDS, 'index.json');
if (fs.existsSync(repoIndex)) {
  const legacy = JSON.parse(fs.readFileSync(repoIndex, 'utf8'));
  (legacy.brands || []).forEach(function (b) {
    if (b.id === '_template') return;
    if (!index.brands.some(function (x) { return x.id === b.id; })) {
      index.brands.push({ id: b.id, title: b.title || b.id });
    }
  });
}

if (!fs.existsSync(REPO_BRANDS)) {
  console.log('nothing to migrate — no repo brands/ folder');
  process.exit(0);
}

fs.readdirSync(REPO_BRANDS).forEach(function (name) {
  if (KEEP.has(name)) return;
  const from = path.join(REPO_BRANDS, name);
  if (!fs.statSync(from).isDirectory()) return;
  const to = path.join(DATA_ROOT, name);
  if (fs.existsSync(to)) {
    console.log('skip (exists in data):', name);
    return;
  }
  fs.renameSync(from, to);
  console.log('moved:', name, '→', to);
  if (!index.brands.some(function (b) { return b.id === name; })) {
    index.brands.push({ id: name, title: name });
  }
});

index.brands = index.brands.filter(function (b) { return b.id !== '_template'; });
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');

if (fs.existsSync(repoIndex)) fs.unlinkSync(repoIndex);

console.log('\ndata home:', DATA_ROOT);
console.log('index entries:', index.brands.length);
