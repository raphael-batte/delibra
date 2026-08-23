#!/usr/bin/env node
/* ==========================================================================
   check-package — engine repo must not ship libra data or personal paths.

   The delibra git tree is the engine only. Library storybooks live in
   DELIBRA_DATA (~/.delibra/libras by default). This script fails when:

     · a libra folder or brands/index.json appears in the repo;
     · junk (.DS_Store, .tmp-*, *.bak) is present;
     · text files contain home paths, emails, token-shaped secrets, or Cyrillic
       outside i18n/ru.js (and brand section sources under tools/sections/).

   Run:  node packages/engine/check-package.js
   Used by:  node --test test/package-hygiene.test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEXT_EXT = new Set([
  '.js', '.md', '.html', '.json', '.css', '.svg', '.txt', '.yml', '.yaml'
]);

const SKIP_WALK = new Set(['.git', 'node_modules', '.bridge', '.cursor', 'dist']);

const ALLOWED_TOP = new Set([
  'README.md', 'GETTING-STARTED.md', 'HANDOFF.md', 'VERSIONING.md', 'BRAND-PACKAGE.md', 'UI-SUITES.md',
  'index.html', 'package.json', '.gitignore', 'packages', 'brands', 'tools', 'test', 'scripts'
]);

const FORBIDDEN_PATH = [
  [/^brands\/index\.json$/, 'catalog belongs in DELIBRA_DATA, not the repo'],
  [/^brands\/(?!_template(\/|$)|README\.md$)[^/]+/, 'libra data folder in repo — use DELIBRA_DATA'],
  [/^\.tmp-/, 'temp screenshot or scratch folder'],
  [/^\.DS_Store$/, 'macOS metadata'],
  [/\.bak(\.|$)/, 'backup file'],
  [/^node_modules\//, 'installed dependencies — not part of the package'],
  [/^\.bridge\//, 'local bridge state'],
];

const CYRILLIC_ALLOW = [
  /^packages\/engine\/i18n\/ru\.js$/,
  /^packages\/engine\/slug\.js$/,       /* transliteration table */
  /^tools\/sections\//                 /* brand section authoring (brand locale) */
];

const CYRILLIC = /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/;

const PERSONAL = [
  {
    re: /\/Users\/(?!me\/|you\/|jane\/|john\/)[A-Za-z0-9._-]+/g,
    why: 'absolute macOS home path'
  },
  {
    re: /\/home\/(?!user\/|ubuntu\/)[A-Za-z0-9._-]+/g,
    why: 'absolute Linux home path'
  },
  {
    re: /C:\\Users\\[^\\\s]+/gi,
    why: 'absolute Windows profile path'
  },
  {
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|ru|io|dev|org|net)\b/g,
    why: 'email address',
    allow: function (m) {
      return /@(example\.(com|org|net)|fonts\.googleapis\.com|localhost)$/i.test(m) ||
        /^(noreply|no-reply|support)@/i.test(m);
    }
  },
  { re: /\bsk-[A-Za-z0-9]{20,}\b/g, why: 'API key (sk-…)' },
  { re: /\bfigd_[A-Za-z0-9_-]{10,}\b/g, why: 'Figma personal access token' },
  { re: /\brafaelbatyrbaev\b/gi, why: 'machine username' }
];

function listFiles(root) {
  const onDisk = walkFiles(root, root, []);
  let tracked = [];
  try {
    const out = execSync('git ls-files -z', { cwd: root, encoding: 'buffer' });
    tracked = out.toString('utf8').split('\0').filter(Boolean);
  } catch (e) {
    return onDisk;
  }
  const seen = new Set(onDisk);
  tracked.forEach(function (rel) {
    if (!seen.has(rel)) {
      seen.add(rel);
      onDisk.push(rel);
    }
  });
  return onDisk;
}

function walkFiles(base, dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    if (SKIP_WALK.has(name)) return;
    const full = path.join(dir, name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) walkFiles(base, full, out);
    else out.push(rel);
  });
  return out;
}

function isTestPlaceholder(rel, match) {
  if (!rel.startsWith('test/') && !rel.startsWith('packages/engine/check-')) return false;
  if (/\/Users\/(me|alice)(\/|$)/.test(match)) return true;
  if (/<repo>/.test(match)) return true;
  return false;
}

function checkPackage(root) {
  root = path.resolve(root);
  const problems = [];
  const files = listFiles(root);

  const tops = new Set();
  files.forEach(function (rel) {
    const top = rel.split('/')[0];
    tops.add(top);
    const full = path.join(root, rel);
    const onDisk = fs.existsSync(full);
    FORBIDDEN_PATH.forEach(function (pair) {
      if (pair[0].test(rel)) {
        var detail = pair[1];
        if (!onDisk) detail += ' (still listed in git — git rm --cached ' + rel + ')';
        problems.push({ kind: 'path', file: rel, detail: detail });
      }
    });
  });

  tops.forEach(function (top) {
    if (!ALLOWED_TOP.has(top)) {
      problems.push({ kind: 'path', file: top + '/', detail: 'unexpected top-level entry' });
    }
  });

  files.forEach(function (rel) {
    const ext = path.extname(rel);
    if (!TEXT_EXT.has(ext)) return;
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return;

    const text = fs.readFileSync(full, 'utf8');

    if (!CYRILLIC_ALLOW.some(function (rx) { return rx.test(rel); }) && CYRILLIC.test(text)) {
      problems.push({
        kind: 'locale',
        file: rel,
        detail: 'Cyrillic outside i18n/ru.js — engine repo surface must be English'
      });
    }

    PERSONAL.forEach(function (rule) {
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        const hit = m[0];
        if (rule.allow && rule.allow(hit)) continue;
        if (isTestPlaceholder(rel, hit)) continue;
        problems.push({ kind: 'personal', file: rel, detail: rule.why + ': ' + hit.slice(0, 72) });
      }
    });
  });

  return problems;
}

function formatProblems(problems) {
  return problems.map(function (p) {
    return '  ✗ [' + p.kind + '] ' + p.file + ' — ' + p.detail;
  }).join('\n');
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..');
  const problems = checkPackage(root);
  if (problems.length) {
    console.log(formatProblems(problems));
    console.log('\nfindings: ' + problems.length);
    process.exit(1);
  }
  console.log('package is clean — no libra data, personal paths, or stray Cyrillic');
  process.exit(0);
}

module.exports = { checkPackage, formatProblems, listFiles, ALLOWED_TOP, FORBIDDEN_PATH };
