#!/usr/bin/env node
/* ==========================================================================
   check-css — brand components must be written with tokens.

   Catches two kinds of raw value in the components file:
     · a hex colour — colour must always come from the palette;
     · px outside var() — size must come from the scale.

   Deliberately allowed:
     0 and none                   — absence of a value, nothing to tokenise;
     1px / 2px in border, outline — line width has no scale of its own;
     values inside @media         — those are the breakpoints themselves;
     --*: … declarations          — the components file may declare a local
                                    variable (--step-i and the like);
     anything listed in the brand's css.allow.json, with a reason.

   Run:  node packages/engine/check-css.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
const manifest = require('./brand-node.js').readManifest(brandDir);
const compFile = manifest.css && manifest.css.components;
if (!compFile) {
  console.error('css.components is not declared in the manifest');
  process.exit(2);
}

const allowFile = path.join(brandDir, 'css.allow.json');
const allow = fs.existsSync(allowFile)
  ? JSON.parse(fs.readFileSync(allowFile, 'utf8'))
  : { lines: {} };

const src = fs.readFileSync(path.join(brandDir, compFile), 'utf8');
const lines = src.split('\n');

/* Strip comments line by line so line numbers stay real. */
let inComment = false;
const clean = lines.map(line => {
  let out = '', i = 0;
  while (i < line.length) {
    if (inComment) {
      const end = line.indexOf('*/', i);
      if (end < 0) { i = line.length; break; }
      inComment = false; i = end + 2;
    } else {
      const start = line.indexOf('/*', i);
      if (start < 0) { out += line.slice(i); break; }
      out += line.slice(i, start); inComment = true; i = start + 2;
    }
  }
  return out;
});

const problems = [];
let mediaDepth = 0;

clean.forEach((line, i) => {
  const n = i + 1;
  if (/@media/.test(line)) mediaDepth = 1;
  if (mediaDepth && /\{/.test(line)) mediaDepth++;
  if (mediaDepth && /\}/.test(line)) mediaDepth--;

  const why = allow.lines && allow.lines[String(n)];
  if (why) return;                                   // explicitly allowed

  if (/^\s*--[\w-]+\s*:/.test(line)) return;         // local variable

  const hex = line.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) problems.push([n, 'raw colour ' + hex[0], line]);

  /* px outside var(): strip var() contents so fallbacks do not count. */
  const noVars = line.replace(/var\([^)]*\)/g, 'var()');
  if (/@media/.test(line)) return;                   // breakpoints are px by nature
  const pxs = [...noVars.matchAll(/(-?\d*\.?\d+)px/g)].map(m => m[0]);
  pxs.forEach(v => {
    const num = parseFloat(v);
    const isHairline = (num === 1 || num === 2) && /border|outline|inset/.test(noVars);
    if (num === 0 || isHairline) return;
    problems.push([n, 'raw size ' + v, line]);
  });
});

const rel = path.join(path.basename(brandDir), compFile);
problems.forEach(([n, what, line]) =>
  console.log(`  ✗ ${rel}:${n}  ${what}\n      ${line.trim().slice(0, 90)}`));

const allowed = Object.keys(allow.lines || {}).length;
console.log(problems.length
  ? `\nfindings: ${problems.length}` + (allowed ? ` · explicitly allowed: ${allowed}` : '')
  : `\ncomponents are written with tokens` + (allowed ? ` · explicitly allowed: ${allowed}` : ''));
process.exit(problems.length ? 1 : 0);
