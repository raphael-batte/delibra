#!/usr/bin/env node
/* Round-trip a brand folder plus UTF-8 names and binary assets. */
'use strict';

const fs = require('fs');
const path = require('path');
const ARCHIVE = require('./package-archive.js');

const brand = process.argv[2] || path.join(__dirname, '..', '..', 'brands', '_template');
const dir = path.resolve(brand);

function roundTrip(entries, label) {
  const zip = ARCHIVE.pack(entries);
  const back = ARCHIVE.unpack(zip);
  const missing = entries.filter(e => !back[e.path]);
  if (missing.length) {
    console.error(label + ' missing after unpack:', missing.map(e => e.path).join(', '));
    process.exit(1);
  }
  entries.forEach(e => {
    const a = e.data instanceof Uint8Array ? Buffer.from(e.data) : Buffer.from(e.data);
    const b = Buffer.from(back[e.path]);
    if (!a.equals(b)) {
      console.error(label + ' content mismatch:', e.path);
      process.exit(1);
    }
  });
}

if (fs.existsSync(dir)) {
  const entries = [];
  (function walk(base, rel) {
    fs.readdirSync(base).forEach(name => {
      const full = path.join(base, name);
      const entry = rel ? rel + '/' + name : name;
      if (fs.statSync(full).isDirectory()) walk(full, entry);
      else entries.push({ path: entry, data: fs.readFileSync(full) });
    });
  })(dir, '');
  roundTrip(entries, path.basename(dir));
  console.log('  ✓ folder:', entries.length, 'files');
}

const cyr = 'assets/café.svg';
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
roundTrip([{ path: cyr, data: svg }], 'utf-8 name');

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
roundTrip([{ path: 'assets/icon.png', data: png }], 'binary');

console.log('\narchive round-trip ok');
